/* Dr.Judge — 이미지로 판정 요청 */
(function () {
  if (!requireLogin()) return;

  const zone = document.getElementById('dropzone');
  const file = document.getElementById('fileInput');
  const preview = document.getElementById('preview');
  const clearBtn = document.getElementById('clearFile');

  let picked = null;
  let base64 = null; // 서버로 보낼 base64 (헤더 제외)

  const req = initJudgeRequest({
    isReady: () => Boolean(picked) && Boolean(base64),
    payload: () => ({
      type: 'image',
      fileName: picked && picked.name,
      imageBase64: base64,
    }),
  });

  function setFile(f) {
    if (!f || !f.type.startsWith('image/')) return;
    picked = f;
    base64 = null;
    preview.src = URL.createObjectURL(f);
    zone.classList.add('has-file');
    req.update();

    // data:image/png;base64,XXXX → XXXX 만 보냅니다
    const reader = new FileReader();
    reader.onload = () => {
      base64 = String(reader.result).split(',')[1] || null;
      req.update();
    };
    reader.readAsDataURL(f);
  }

  file.addEventListener('change', () => setFile(file.files[0]));

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    picked = null;
    base64 = null;
    file.value = '';
    preview.removeAttribute('src');
    zone.classList.remove('has-file');
    req.update();
  });

  // 드래그 앤 드롭
  ['dragenter', 'dragover'].forEach((t) =>
    zone.addEventListener(t, (e) => {
      e.preventDefault();
      zone.classList.add('is-over');
    }),
  );
  ['dragleave', 'drop'].forEach((t) =>
    zone.addEventListener(t, (e) => {
      e.preventDefault();
      zone.classList.remove('is-over');
    }),
  );
  zone.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));
})();
