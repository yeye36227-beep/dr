/* ============================================
   Dr.Judge — 판정 탭 (허브)
   최근 판정은 로그인한 계정의 이력에서 읽습니다.
   ============================================ */

(function () {
  const list = document.getElementById('judgeList');
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );

  const me = Store.current();
  const history = me ? me.history.slice(0, 3) : [];

  if (!history.length) {
    list.innerHTML = `
      <li class="empty">
        <p class="empty__title">${me ? '아직 판정한 내역이 없어요' : '로그인하면 판정 이력이 쌓여요'}</p>
        <p class="empty__desc">위에서 판정 방식을 골라 시작해 보세요.</p>
      </li>`;
    return;
  }

  list.innerHTML = history
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
})();
