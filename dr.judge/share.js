/* ============================================
   Dr.Judge — 공유 링크 열람 (로그인 없이)
   주소가 /share/{token} 이거나 ?token= 둘 다 받습니다.
   ============================================ */

(function () {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );

  const box = document.getElementById('result');
  const claim = document.getElementById('claimText');

  function token() {
    const q = new URLSearchParams(location.search).get('token');
    if (q) return q;
    const m = /\/share\/([^/?#]+)/.exec(location.pathname);
    return m ? m[1] : null;
  }

  function showMessage(title, desc) {
    box.innerHTML = `
      <div class="empty">
        <p class="empty__title">${esc(title)}</p>
        <p class="empty__desc">${esc(desc || '')}</p>
      </div>`;
  }

  function render(r) {
    /* 서버가 판정 문장(extractedText)을 비워서 주는 경우가 있습니다.
       그대로 두면 따옴표만 남아 “” 로 보여서, 안내 문구로 대신합니다. */
    if (r.claim) {
      claim.textContent = `“${r.claim}”`;
      claim.classList.remove('is-empty');
    } else {
      claim.textContent = '판정한 내용을 불러오지 못했어요.';
      claim.classList.add('is-empty');
    }

    /* 신뢰도 라벨 */
    const levelCard = document.getElementById('levelCard');
    levelCard.hidden = false;
    document.getElementById('levelName').textContent =
      r.levelLabel ||
      (EVIDENCE_LEVELS.find((l) => l.key === r.level) || {}).name ||
      '판정 결과';
    document.getElementById('levelSources').textContent = r.sources
      .map((s) => s.title)
      .join(' · ');
    document.getElementById('levelDesc').textContent =
      (EVIDENCE_LEVELS.find((l) => l.key === r.level) || {}).desc || '';

    if (r.level !== 'clinical' && r.level !== 'expert') {
      levelCard.querySelector('.tagcard__mark').style.background = 'var(--gray-400)';
    }

    /* 이해상충 */
    if (r.conflict) {
      const c = document.getElementById('conflictCard');
      c.hidden = false;
      document.getElementById('conflictName').textContent = r.conflictBadge;
      document.getElementById('conflictDesc').textContent = r.conflictDesc;
    }

    /* 근거 */
    if (r.sources.length || r.evidence) {
      document.getElementById('evidenceSect').hidden = false;
      document.getElementById('sourceList').innerHTML = r.sources
        .map(
          (s) =>
            `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</li>`,
        )
        .join('');
      document.getElementById('evidenceText').textContent = r.evidence || '';
    }

    /* 구매 기준 */
    const tips = (r.guideCard && r.guideCard.tips) || [];
    if (tips.length) {
      document.getElementById('guideSect').hidden = false;
      if (r.guideCard.title) {
        document.getElementById('guideTitle').textContent = r.guideCard.title;
      }
      document.getElementById('guideTips').innerHTML = tips
        .map((t) => `<li>${esc(t)}</li>`)
        .join('');
    }

    /* 안전 안내 */
    if (r.safetyNotice) {
      document.getElementById('safetyText').textContent = r.safetyNotice;
    }
  }

  (async () => {
    const t = token();
    if (!t) {
      showMessage('링크가 올바르지 않아요', '공유받은 주소를 다시 확인해 주세요.');
      return;
    }

    const res = await API.getSharedJudgment(t);

    if (!res.ok) {
      showMessage(
        res.code === 'SHARE_GONE' ? '만료된 링크예요' : '링크를 찾을 수 없어요',
        res.text,
      );
      return;
    }
    render(res.data);
  })();
})();
