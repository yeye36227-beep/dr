/* ============================================
   Dr.Judge — 관심분야 변경 (여러 개 선택)
   ============================================ */

(function () {
  if (!requireLogin()) return;

  const list = document.getElementById('interestList');
  const error = document.getElementById('interestError');
  const saveBtn = document.getElementById('saveBtn');

  const me = Store.current();
  if (!me) {
    location.replace('./login.html');
    return;
  }

  /* 지금 설정된 분야들을 먼저 표시합니다 */
  const picked = new Set(
    me.profile.interests || (me.profile.interest ? [me.profile.interest] : []),
  );

  const options = [...list.querySelectorAll('.optlist__opt')];
  const paint = () =>
    options.forEach((o) =>
      o.classList.toggle('is-selected', picked.has(o.dataset.value)),
    );
  paint();

  /* 서버에 저장된 값(1.6)이 오면 그걸로 맞춥니다.
     다른 기기에서 바꿨을 수도 있어서, 화면의 값보다 서버 값이 정확합니다. */
  API.syncProfile().then((res) => {
    // 서버가 관심분야를 안 내려주면 화면에 있는 값을 그대로 둡니다
    if (!res.ok || !res.data.interests || !res.data.interests.length) return;
    picked.clear();
    res.data.interests.forEach((v) => picked.add(v));
    paint();
    update();
  });

  options.forEach((opt) => {
    opt.addEventListener('click', () => {
      const v = opt.dataset.value;
      if (picked.has(v)) picked.delete(v);
      else picked.add(v);

      opt.classList.toggle('is-selected', picked.has(v));
      list.classList.remove('is-error');
      error.hidden = true;
      update();
    });
  });

  function update() {
    saveBtn.classList.toggle('is-ready', picked.size > 0);
  }

  /* 버튼은 항상 눌리고, 하나도 안 고르면 알려줍니다 */
  saveBtn.addEventListener('click', async () => {
    if (picked.size === 0) {
      list.classList.add('is-error');
      error.hidden = false;
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중…';

    // 바꾼 것만 보냅니다 (PATCH)
    const res = await API.updateOnboarding({ interests: [...picked] });

    saveBtn.disabled = false;
    saveBtn.textContent = '변경하기';

    if (!res.ok) {
      error.textContent = res.text;
      error.hidden = false;
      return;
    }
    location.href = './profile-edit.html';
  });

  update();
})();
