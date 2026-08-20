/* ============================================
   Dr.Judge — 가입 완료 화면
   확인을 누르면 자동 로그인 상태로 홈으로 이동합니다.
   ============================================ */

(function () {
  /* ---------- 콘페티 ---------- */
  const box = document.getElementById('confetti');
  const PIECES = [
    { x: 20, y: 40, w: 8, h: 8, c: '#f5c84c', type: 'dot' },
    { x: 72, y: 34, w: 8, h: 8, c: '#f5c84c', type: 'dot' },
    { x: 30, y: 44, w: 9, h: 3, c: '#7bc93f', type: 'bar', r: -40 },
    { x: 76, y: 48, w: 10, h: 2, c: '#c7e88a', type: 'bar', r: 0 },
    { x: 44, y: 62, w: 9, h: 2, c: '#c7e88a', type: 'bar', r: 0 },
    { x: 66, y: 64, w: 9, h: 3, c: '#7bc93f', type: 'bar', r: -40 },
  ];

  box.innerHTML = PIECES.map(
    (p, i) => `<i class="${p.type}" style="
      left:${p.x}%; top:${p.y}%;
      width:${p.w}px; height:${p.h}px;
      background:${p.c};
      transform:rotate(${p.r || 0}deg);
      animation-delay:${0.15 + i * 0.06}s;
    "></i>`,
  ).join('');

  /* ---------- 1. 확인 → 홈으로 ----------
     가입 시 발급받은 토큰이 있으면 그대로 로그인 상태로 홈에 들어갑니다.
     토큰이 없다면(세션 만료 등) 로그인 화면으로 보냅니다. */
  document.getElementById('okBtn').addEventListener('click', () => {
    location.replace(API.getToken() ? './home.html' : './login.html');
  });
})();
