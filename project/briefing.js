/* ============================================
   Dr.Judge — 오늘의 브리핑
   ============================================ */

(function () {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );

  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  function fmtDate(iso) {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return String(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} (${DAYS[d.getDay()]})`;
  }

  const dateLabel = document.getElementById('dateLabel');
  const chips = document.getElementById('catChips');
  const list = document.getElementById('briefList');
  const empty = document.getElementById('briefEmpty');
  const summaryText = document.getElementById('summaryText');
  const summaryStats = document.getElementById('summaryStats');

  let items = [];
  let current = '전체';

  /* ---------- 날짜 이동 (4.1 오늘 / 4.2 특정 날짜) ---------- */
  const iso = (d) => {
    const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return t.toISOString().slice(0, 10);
  };
  const TODAY = iso(new Date());
  const shift = (isoStr, days) => {
    const d = new Date(isoStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return iso(d);
  };

  const prevBtn = document.getElementById('prevDay');
  const nextBtn = document.getElementById('nextDay');

  // ?date=YYYY-MM-DD 로 들어오면 그 날짜부터 봅니다
  const asked = new URLSearchParams(location.search).get('date');
  let viewDate = /^\d{4}-\d{2}-\d{2}$/.test(asked || '') && asked <= TODAY ? asked : TODAY;

  /* ---------- 카테고리 칩 ---------- */
  function renderChips() {
    const cats = ['전체', ...new Set(items.map((i) => i.category).filter(Boolean))];
    chips.innerHTML = cats
      .map(
        (c) =>
          `<button type="button" class="bchip ${c === current ? 'is-active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`,
      )
      .join('');
  }

  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('.bchip');
    if (!btn) return;
    current = btn.dataset.cat;
    chips
      .querySelectorAll('.bchip')
      .forEach((b) => b.classList.toggle('is-active', b === btn));
    renderList();
  });

  /* ---------- 요약 ---------- */
  function renderSummary() {
    if (!items.length) {
      summaryText.textContent =
        viewDate === TODAY
          ? '오늘은 새로 도착한 브리핑이 없어요.'
          : '이 날은 브리핑이 없어요.';
      summaryStats.innerHTML = '';
      return;
    }

    const keywords = items.map((i) => i.title.split(/[,·]/)[0].trim()).slice(0, 3);
    summaryText.innerHTML =
      `오늘은 ${keywords.map((k) => `<b>${esc(k.length > 14 ? k.slice(0, 14) + '…' : k)}</b>`).join(', ')}<br />관련 소식이 도착했어요.`;

    const levels = new Set(items.map((i) => i.levelLabel).filter(Boolean));
    const stats = [
      ['오늘의 카드', `${items.length}건`],
      ['분야', `${new Set(items.map((i) => i.category)).size}개`],
      ['신뢰도 라벨', `${levels.size}종`],
    ];
    summaryStats.innerHTML = stats
      .map(
        ([label, value]) =>
          `<div class="summary__stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>`,
      )
      .join('');
  }

  /* ---------- 목록 ---------- */
  function renderList() {
    const shown =
      current === '전체' ? items : items.filter((i) => i.category === current);

    list.innerHTML = shown
      .map(
        (b) => `
      <li class="bitem" data-id="${esc(b.id)}" data-archive="${esc(b.archiveId || '')}">
        <div class="bitem__body">
          <span class="chip">${esc(b.category || '기타')}</span>
          <h3 class="bitem__title">${esc(b.title)}</h3>
          <p class="bitem__desc">${esc(b.summary)}</p>
          <span class="bitem__time">${esc(b.levelLabel)}</span>
        </div>
        <span class="bitem__arrow" aria-hidden="true">›</span>
      </li>`,
      )
      .join('');

    empty.hidden = shown.length > 0;

    list.querySelectorAll('.bitem').forEach((el) => {
      el.addEventListener('click', () => {
        // 오픈율 지표(4.3) — 결과를 기다리지 않고 바로 이동합니다
        API.markBriefingOpened(el.dataset.id);

        const archive = el.dataset.archive;
        location.href = archive
          ? `./feed-detail.html?id=${encodeURIComponent(archive)}`
          : `./feed-detail.html?id=${encodeURIComponent(el.dataset.id)}`;
      });
    });
  }

  /* ---------- 공유 ---------- */
  document.getElementById('shareBtn').addEventListener('click', async () => {
    const text = `Dr.Judge ${dateLabel.textContent} 브리핑`;
    // 보고 있는 날짜가 링크에 담기도록 합니다
    const url = location.origin + location.pathname + '?date=' + viewDate;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Dr.Judge', text, url });
        return;
      } catch (e) {
        /* 취소 */
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert('브리핑 링크를 복사했어요.');
    }
  });

  /* ---------- 불러오기 ---------- */
  let loading = false;

  async function load(date) {
    if (loading) return;
    loading = true;

    viewDate = date;
    dateLabel.textContent = fmtDate(date) + (date === TODAY ? ' · 오늘' : '');
    summaryText.textContent = '브리핑을 불러오는 중…';
    summaryStats.innerHTML = '';
    list.innerHTML = '';
    empty.hidden = true;

    // 오늘이면 4.1, 아니면 4.2 — getBriefing 이 알아서 갈라 줍니다
    const res = await API.getBriefing(date);

    loading = false;
    nextBtn.disabled = viewDate >= TODAY;

    if (!res.ok) {
      // 그 날 브리핑이 없는 건 오류가 아니라 '비어 있음'으로 보여 줍니다
      items = [];
      renderChips();
      summaryText.textContent =
        res.code === 'BRIEFING_NOT_FOUND' ? '이 날은 브리핑이 없어요.' : res.text;
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }

    dateLabel.textContent =
      fmtDate(res.data.date) + (res.data.date === TODAY ? ' · 오늘' : '');
    items = res.data.items;
    current = '전체';

    renderChips();
    renderSummary();
    renderList();
  }

  prevBtn.addEventListener('click', () => load(shift(viewDate, -1)));
  nextBtn.addEventListener('click', () => {
    if (viewDate >= TODAY) return;
    load(shift(viewDate, 1));
  });

  /* ---------- 시작 ---------- */
  load(viewDate);
})();
