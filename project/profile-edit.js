/* ============================================
   Dr.Judge — 내 정보 수정
   프로필 사진은 기본 캐릭터로 고정입니다.
   ============================================ */

(function () {
  if (!requireLogin()) return;

  const me = Store.current();
  if (!me) {
    location.replace('./login.html');
    return;
  }

  const p = me.profile;
  const nickEl = document.getElementById('nickValue');
  const interestEl = document.getElementById('interestValue');

  nickEl.textContent = p.nickname;
  document.getElementById('mailValue').textContent = p.email || '—';

  const show = (list) =>
    (interestEl.textContent = list && list.length ? list.join(', ') : '미설정');

  show(p.interests || (p.interest ? [p.interest] : []));

  /* 저장된 값을 먼저 보여주고, 서버 값(1.6)이 오면 바꿉니다 */
  API.syncProfile().then((res) => {
    if (!res.ok) return;
    if (res.data.nickname) nickEl.textContent = res.data.nickname;
    show(res.data.interests);
  });
})();
