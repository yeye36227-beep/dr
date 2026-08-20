/* ============================================
   Dr.Judge — 닉네임 변경
   spec: 3-2 입력 / 3-3 변경하기 / 3-4 오류
   ============================================ */

(function () {
  if (!requireLogin()) return;

  const box = document.getElementById('nickBox');
  const input = document.getElementById('nickInput');
  const error = document.getElementById('nickError');
  const saveBtn = document.getElementById('saveBtn');

  const me = Store.current();
  if (!me) {
    location.replace('./login.html');
    return;
  }

  /* 3-2. 기존 닉네임 표시 — 저장된 값을 먼저, 서버 값(1.6)이 오면 바꿔 줍니다.
     지우고 다시 쓸 때를 대비해 placeholder 에도 현재 닉네임을 넣어 둡니다. */
  input.value = me.profile.nickname || '';
  input.placeholder = me.profile.nickname || '';

  let touched = false;
  input.addEventListener('input', () => (touched = true), { once: true });

  API.syncProfile().then((res) => {
    // 이미 고쳐 쓰고 있으면 건드리지 않습니다
    if (res.ok && res.data.nickname && !touched) {
      input.value = res.data.nickname;
      input.placeholder = res.data.nickname;
    }
  });

  const isValid = (v) => v.trim().length >= 2 && v.trim().length <= 10;

  /* 3-3. 2~10자일 때만 버튼 색이 바뀝니다 (버튼은 항상 눌립니다) */
  function update() {
    saveBtn.classList.toggle('is-ready', isValid(input.value));
  }

  input.addEventListener('input', () => {
    box.classList.remove('is-error');
    error.hidden = true;
    update();
  });

  /* 3-4. 조건을 못 채우면 빨간 테두리 + 문구 */
  input.addEventListener('blur', () => {
    if (input.value.length === 0) return;
    const bad = !isValid(input.value);
    box.classList.toggle('is-error', bad);
    error.hidden = !bad;
  });

  saveBtn.addEventListener('click', async () => {
    // 3-4. 조건을 못 채웠으면 빨간 테두리 + 문구만 띄우고 넘어가지 않습니다
    if (!isValid(input.value)) {
      box.classList.add('is-error');
      error.textContent = '2~10자로 입력해 주세요.';
      error.hidden = false;
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '변경 중…';

    const res = await API.updateMe({ nickname: input.value.trim() });

    saveBtn.disabled = false;
    saveBtn.textContent = '변경하기';

    if (!res.ok) {
      // 이미 쓰는 닉네임이면 입력 칸에 바로 표시합니다
      box.classList.add('is-error');
      error.textContent = res.text;
      error.hidden = false;
      return;
    }

    location.href = './profile-edit.html';
  });

  update();
})();
