/* ============================================
   Dr.Judge — 판정 탭 (허브)
   최근 판정은 서버에서 읽습니다 (GET /api/judgments).
   예전에는 Store 안의 history 를 읽었는데, 그 값은 어디에서도
   채워지지 않는 목업 잔재라 화면이 통째로 죽었습니다.
   ============================================ */

(function () {
  const list = document.getElementById('judgeList');
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );

  /* 판정 이력이 없을 때 — 로그인 여부에 따라 문구만 다릅니다 */
  function renderEmpty(loggedIn) {
    list.innerHTML = `
      <li class="empty">
        <p class="empty__title">${loggedIn ? '아직 판정한 내역이 없어요' : '로그인하면 판정 이력이 쌓여요'}</p>
        <p class="empty__desc">위에서 판정 방식을 골라 시작해 보세요.</p>
      </li>`;
  }

  function renderList(items) {
    list.innerHTML = items
      .map((h) => {
        const s = HISTORY_STATUS[h.status] || HISTORY_STATUS.vague;
        return `
      <li class="judgecard">
        <div class="judgecard__top">
          <span class="chip">${esc(h.category)}</span>
          <span class="verdict verdict--${h.status}">${s.mark} ${s.label}</span>
          <span class="judgecard__time">${esc(h.at)}</span>
        </div>
        <h3 class="judgecard__title">${esc(h.title)}</h3>
      </li>`;
      })
      .join('');
  }

  if (!Store.isLoggedIn()) {
    renderEmpty(false);
    return;
  }

  (async () => {
    /* 서버가 잠깐 안 되더라도 판정 방식 카드는 그대로 쓸 수 있어야 하므로,
       실패하면 오류를 띄우지 않고 '내역 없음'으로 둡니다. */
    const res = await API.getJudgmentHistory({ page: 1, size: 3 });
    const items = res.ok && res.data ? res.data.items || [] : [];

    if (!items.length) renderEmpty(true);
    else renderList(items);
  })();
})();
