/* ============================================
   Dr.Judge — 로그인 화면 스크립트
   spec: 3 / 3-1 / 4 / 4-1 / 4-2 / 4-3 / 5 / 6
   ============================================ */

(function () {
  const formEl = document.getElementById('loginForm');
  const submitBtn = document.getElementById('loginBtn');
  const alertEl = document.getElementById('loginAlert');

  const form = createForm(formEl, { submitBtn });

  initPasswordToggles(formEl);

  /* 5 — 제출 */
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertEl.hidden = true;

    // 3-1 / 4-1 — 미입력·잘못입력이면 빨간 표시하고 진행하지 않음
    if (!form.validateAll()) return;

    setLoading(true);
    const { userId, password } = form.values();
    const res = await API.login({ userId: userId.trim(), password });
    setLoading(false);

    if (res.ok) {
      // 로그인이 풀려서 밀려온 경우 원래 보던 화면으로 돌려보냅니다
      const next = new URLSearchParams(location.search).get('next');
      location.href = next && /^[\w.-]+\.html/.test(next) ? `./${next}` : './home.html';
      return;
    }

    // 서버가 알려준 칸에 오류 표시 (아이디 없음 / 비밀번호 불일치 등)
    if (res.field || res.fields) {
      form.applyApiError(res);
      if (res.fields) {
        alertEl.textContent = res.text;
        alertEl.hidden = false;
      }
    } else {
      alertEl.textContent = res.text;
      alertEl.hidden = false;
    }
  });

  function setLoading(on) {
    submitBtn.disabled = on; // 통신 중에만 잠급니다
    submitBtn.textContent = on ? '로그인 중…' : '로그인';
    formEl.classList.toggle('is-loading', on);
    if (!on) form.updateSubmit();
  }
})();
