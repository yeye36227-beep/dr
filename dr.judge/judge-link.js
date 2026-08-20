/* Dr.Judge — 링크로 판정 요청 */
(function () {
  if (!requireLogin()) return;

  const input = document.getElementById('linkInput');
  const count = document.getElementById('linkCount');

  const isUrl = (v) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(v.trim());

  const req = initJudgeRequest({
    isReady: () => isUrl(input.value),
    payload: () => ({ type: 'link', url: input.value.trim() }),
  });

  bindCounter(input, count, req.update);
})();
