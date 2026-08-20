/* ============================================
   Dr.Judge — 판정 요청 화면 공통 로직
   글자수 카운트 · 제출 버튼 활성 · 한도 초과 모달
   ============================================ */

/**
 * @param {object} o
 * @param {() => boolean} o.isReady   제출 가능한 상태인지
 * @param {() => object}  o.payload   서버로 보낼 값
 */
function initJudgeRequest(o) {
  const submitBtn = document.getElementById('submitBtn');
  const limitLink = document.getElementById('limitLink');
  const modal = document.getElementById('limitModal');
  const modalOk = document.getElementById('limitOk');

  function update() {
    submitBtn.disabled = !o.isReady();
  }

  function openModal() {
    modal.hidden = false;
  }
  function closeModal() {
    modal.hidden = true;
  }

  modalOk.addEventListener('click', () => {
    closeModal();
    location.href = './judge-limit.html';
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  // 링크는 안내 화면으로, 실제로 한도에 걸렸을 때는 모달로 알립니다
  limitLink.addEventListener('click', () => {
    location.href = './judge-limit.html';
  });

  submitBtn.addEventListener('click', async () => {
    if (submitBtn.disabled) return;

    submitBtn.disabled = true;
    const label = submitBtn.innerHTML;
    submitBtn.textContent = '판정 중…';

    const res = await API.requestJudge(o.payload());

    submitBtn.innerHTML = label;
    update();

    if (res.ok) {
      const id = res.data.id || res.data.judgmentId;
      location.href = `./judge-result.html?id=${encodeURIComponent(id)}`;
      return;
    }
    if (res.code === 'DAILY_LIMIT') openModal();
    else if (res.code === 'OCR_FAILED') location.href = './judge-fail.html';
    else alert(res.text);
  });

  update();
  return { update, openModal, closeModal };
}

/** 글자수 카운터 연결 */
function bindCounter(input, countEl, onChange) {
  input.addEventListener('input', () => {
    countEl.textContent = input.value.length;
    onChange && onChange();
  });
}
