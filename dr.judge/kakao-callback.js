/* ============================================
   Dr.Judge — 카카오 로그인 돌아오는 화면

   카카오가 ?code= 를 붙여 이 화면으로 보내 줍니다.
   그 코드를 백엔드에 넘기면 두 갈래로 갈립니다.
     기존 회원 → 토큰 받고 홈으로
     신규 회원 → onboardingToken 받고 온보딩으로
   ============================================ */

(function () {
  const msg = document.getElementById('msg');
  const err = document.getElementById('err');
  const retry = document.getElementById('retry');

  function fail(text) {
    msg.textContent = '로그인하지 못했어요';
    err.textContent = text;
    err.hidden = false;
    retry.hidden = false;
  }

  const q = new URLSearchParams(location.search);
  const code = q.get('code');

  /* 사용자가 카카오 화면에서 취소한 경우 */
  if (q.get('error')) {
    fail(
      q.get('error') === 'access_denied'
        ? '카카오 로그인을 취소했어요.'
        : q.get('error_description') || '카카오 로그인에 실패했어요.',
    );
    return;
  }

  if (!code) {
    fail('로그인 정보가 없어요. 처음부터 다시 시도해 주세요.');
    return;
  }

  (async () => {
    const res = await API.kakaoLogin({ code });

    if (!res.ok) {
      fail(res.text);
      return;
    }

    if (res.data.needsOnboarding) {
      // 신규 회원 — 관심 분야까지 받고 나서 로그인이 끝납니다
      msg.textContent = '거의 다 됐어요';
      location.replace('./signup.html?mode=onboarding');
      return;
    }

    msg.textContent = '로그인됐어요';
    location.replace('./home.html');
  })();
})();
