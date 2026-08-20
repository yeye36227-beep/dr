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

    /* 서버가 title 을 비워서 주면 예전에는 '오늘은 , 관련 소식이 도착했어요.' 처럼
       빈 자리만 남았습니다. 쓸 수 있는 키워드가 없으면 문장을 바꿉니다. */
    const keywords = items
      .map((i) => String(i.title || i.summary || '').split(/[,·]/)[0].trim())
      .filter(Boolean)
      .slice(0, 3);

    summaryText.innerHTML = keywords.length
      ? `오늘은 ${keywords.map((k) => `<b>${esc(k.length > 14 ? k.slice(0, 14) + '…' : k)}</b>`).join(', ')}<br />관련 소식이 도착했어요.`
      : `오늘 도착한 브리핑 <b>${items.length}건</b>을 아래에서 확인해 보세요.`;

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

    /* 제목·요약·라벨이 비어 오는 카드가 있습니다. 그대로 그리면 글자가 하나도
       없는 빈 줄이 되어 '아무것도 안 보인다'가 됩니다. 있는 값으로 채우고,
       그마저 없으면 빈 칸을 아예 그리지 않습니다. */
    list.innerHTML = shown
      .map((b) => {
        const title = b.title || b.summary || '제목이 없는 브리핑';
        const desc = b.title && b.summary !== b.title ? b.summary : '';
        return `
      <li class="bitem" data-key="${esc(b.key)}" data-id="${esc(b.id || '')}" data-archive="${esc(b.archiveId || '')}">
        <div class="bitem__body">
          <span class="chip">${esc(b.category || '기타')}</span>
          <h3 class="bitem__title">${esc(title)}</h3>
          ${desc ? `<p class="bitem__desc">${esc(desc)}</p>` : ''}
          ${b.levelLabel ? `<span class="bitem__time">${esc(b.levelLabel)}</span>` : ''}
        </div>
        <span class="bitem__arrow" aria-hidden="true">›</span>
      </li>`;
      })
      .join('');

    empty.hidden = shown.length > 0;

    list.querySelectorAll('.bitem').forEach((el) => {
      el.addEventListener('click', () => {
        // 오픈율 지표(4.3) — briefingId 가 오는 응답일 때만 보냅니다
        if (el.dataset.id) API.markBriefingOpened(el.dataset.id);

        /* 브리핑 상세 API 가 따로 없어서 피드 상세 화면을 함께 씁니다.
           서버 응답에 briefingId 가 없는 경우가 있어, 넘어가기 전에
           지금 카드의 내용을 담아 둡니다. 담지 않으면 상세가 빈 화면이 됩니다. */
        const item = items.find((i) => i.key === el.dataset.key);
        const target = el.dataset.archive || el.dataset.key;

        if (item) {
          FeedHandoff.set({
            id: target,
            title: item.title || item.summary,
            category: item.category,
            levelLabel: item.levelLabel,
            desc: item.summary,
          });
        }

        location.href = `./feed-detail.html?id=${encodeURIComponent(target)}`;
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
