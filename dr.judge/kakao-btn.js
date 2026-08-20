/* ============================================
   Dr.Judge — '카카오로 시작하기' 버튼

   누르면 카카오 로그인 화면으로 보냅니다.
   돌아오는 건 kakao-callback.html 이 받습니다.
   ============================================ */

(function () {
  const btn = document.getElementById('kakaoBtn');
  if (!btn) return;

  const url = API.kakaoAuthUrl();

  /* REST API 키를 아직 안 넣었으면, 눌렀을 때 무엇을 해야 하는지 알려 줍니다.
     (버튼을 숨기면 왜 없는지 알 수 없어서 그대로 두고 안내만 합니다) */
  if (!url) {
    btn.setAttribute('aria-disabled', 'true');
    btn.addEventListener('click', () => {
      alert(
        '카카오 REST API 키가 아직 없어요.\n' +
          'api.js 의 KAKAO_CLIENT_ID 에 키를 넣으면 동작합니다.\n\n' +
          '카카오에 등록할 Redirect URI:\n' +
          API.kakaoRedirectUri(),
      );
    });
    return;
  }

  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = '카카오로 이동 중…';
    location.href = url;
  });
})();
