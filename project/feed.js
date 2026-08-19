/* ============================================
   Dr.Judge — 공유 피드 탭
   ============================================ */

(function () {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );

  /* 판정 등급 정보는 data.js 한 곳에서 가져옵니다 (아이콘·안내 문구·이름) */
  const lvOf = (key) => (typeof levelOf === 'function' ? levelOf(key) : null) || null;

  const list = document.getElementById('cardList');
  const pills = document.getElementById('sortPills');
  const moreBtn = document.getElementById('feedMore');

  let sort = 'recent';
  let page = 1;
  let totalPages = 1;
  let items = [];
  let loading = false;

  function fmt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return timeAgo(d);
  }

  function render() {
    list.innerHTML = items.length
      ? items
          .map((c) => {
            const lv = lvOf(c.result);
            const title = c.title || c.summary || '';
            // 카테고리가 없으면(6.5 미제공) 올린 시각으로 대신 채웁니다
            const top = c.category || fmt(c.createdAt);
            return `
      <li class="pcard" data-id="${esc(c.id)}">
        <div class="pcard__top">
          <span class="pcard__cat">${esc(top)}</span>
          <span class="badge-done">판정 완료</span>
        </div>
        <h2 class="pcard__title">“${esc(title)}”</h2>
        ${c.desc ? `<p class="pcard__desc">${esc(c.desc)}</p>` : ''}

        <div class="verdict-row">
          <span class="verdict-row__icon">${esc((lv && lv.icon) || '?')}</span>
          <span class="verdict-row__label">${esc(c.levelLabel || (lv && lv.name) || '')}</span>
          <span class="verdict-row__hint">${esc((lv && lv.action) || '')}</span>
        </div>

        <div class="pcard__foot">
          <span class="pcard__author">@${esc(c.author)}</span>
          <button type="button" class="pcard__like ${c.liked ? 'is-liked' : ''}" data-like="${esc(c.id)}" aria-label="좋아요" aria-pressed="${Boolean(c.liked)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
              <path d="M12 20s-7.2-4.4-7.2-9.3A4.2 4.2 0 0 1 12 8.1a4.2 4.2 0 0 1 7.2 2.6C19.2 15.6 12 20 12 20Z" />
            </svg>
            <span>${c.likes}</span>
          </button>
        </div>
      </li>`;
          })
          .join('')
      : `<li class="empty"><p class="empty__title">아직 공유된 판정이 없어요</p><p class="empty__desc">판정 결과를 피드에 게시하면 여기에 보여요.</p></li>`;

    list.querySelectorAll('.pcard').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-like]')) return; // 하트는 이동하지 않습니다
        // 게시물 상세 API 가 아직 없어서, 목록에서 받은 내용을 넘겨줍니다
        const item = items.find((i) => i.id === el.dataset.id);
        if (item) Store.saveResult({ ...item, id: 'post:' + item.id });
        location.href = `./feed-detail.html?id=${encodeURIComponent(el.dataset.id)}`;
      });
    });

    /* 좋아요 토글 */
    list.querySelectorAll('[data-like]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        btn.disabled = true;

        // 지금 눌러져 있으면 취소(DELETE), 아니면 좋아요(POST)
        const nowLiked = btn.classList.contains('is-liked');
        const res = await API.toggleLike(btn.dataset.like, nowLiked);

        btn.disabled = false;
        if (!res.ok) {
          alert(res.text);
          return;
        }

        // 서버가 알려준 상태로 맞춥니다
        const item = items.find((i) => i.id === btn.dataset.like);
        if (item) {
          item.liked = res.data.liked;
          item.likes = res.data.likeCount;
        }
        btn.classList.toggle('is-liked', res.data.liked);
        btn.setAttribute('aria-pressed', String(res.data.liked));
        btn.querySelector('span').textContent = res.data.likeCount;
      });
    });

    moreBtn.hidden = page >= totalPages;
  }

  async function load(next) {
    if (loading) return;
    loading = true;
    moreBtn.textContent = '불러오는 중…';

    const res = await API.getFeedPosts({ sort, page: next ? page + 1 : 1 });

    loading = false;
    moreBtn.textContent = '더 보기';

    if (!res.ok) {
      list.innerHTML = `<li class="empty"><p class="empty__title">피드를 불러오지 못했어요</p><p class="empty__desc">${esc(res.text)}</p></li>`;
      moreBtn.hidden = true;
      return;
    }

    page = res.data.page;
    totalPages = res.data.totalPages;
    items = next ? items.concat(res.data.items) : res.data.items;
    render();
  }

  pills.addEventListener('click', (e) => {
    const btn = e.target.closest('.pills__item');
    if (!btn) return;
    sort = btn.dataset.sort === 'popular' ? 'popular' : 'recent';
    pills
      .querySelectorAll('.pills__item')
      .forEach((b) => b.classList.toggle('is-active', b === btn));
    load(false);
  });

  moreBtn.addEventListener('click', () => load(true));

  load(false);
})();
