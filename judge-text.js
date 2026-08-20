/* Dr.Judge — 텍스트로 판정 요청 */
(function () {
  if (!requireLogin()) return;

  const input = document.getElementById('claimInput');
  const count = document.getElementById('claimCount');

  const req = initJudgeRequest({
    isReady: () => input.value.trim().length >= 5,
    payload: () => ({ type: 'text', text: input.value.trim() }),
  });

  bindCounter(input, count, req.update);
})();
