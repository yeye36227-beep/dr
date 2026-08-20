/* ============================================
   Dr.Judge — 피드 카드 상세 보기
   ============================================ */

(function () {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );

  const fmtDate = (isoStr) => {
    const d = isoStr ? new Date(isoStr) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  };

  const box = document.getElementById('detail');
  const id = new URLSearchParams(location.search).get('id');

  /* 게시물 상세 API 가 아직 없어서, 목록 화면이 넘겨준 내용을 씁니다.
     Store 는 로그인 세션이 있을 때만 저장되기 때문에, 세션과 무관하게 남는
     sessionStorage 를 먼저 봅니다. (common.js 의 FeedHandoff) */
  const card =
    (typeof FeedHandoff !== 'undefined' ? FeedHandoff.get(id) : null) ||
    (Store.getResult ? Store.getResult('post:' + id) : null) ||
    (typeof FEED_CARDS !== 'undefined'
      ? FEED_CARDS.find((c) => String(c.id) === id)
      : null);

  /* 넘겨받은 내용이 없을 때 예시 카드로 떨어지면 안 됩니다.
     예전에는 FEED_CARDS[1] 로 떨어져서, 어떤 카드를 눌러도 같은 값이 떴습니다. */
  if (!card) {
    box.innerHTML =
      '<div class="empty">' +
      '<p class="empty__title">카드를 불러오지 못했어요</p>' +
      '<p class="empty__desc">목록에서 다시 눌러 주세요.</p>' +
      '</div>';
    return;
  }

  /* result 는 등급 키(clinical…), levelLabel 은 한글 라벨입니다.
     마이페이지는 라벨만 갖고 있어서 두 가지를 모두 받아 줍니다. */
  const lv =
    (typeof levelOf === 'function' ? levelOf(card.result) : null) ||
    (typeof EVIDENCE_LEVELS !== 'undefined'
      ? EVIDENCE_LEVELS.find(
          (l) => l.name === (card.levelLabel || card.result),
        ) || null
      : null);
  const detail = card.detail || {};

  const title = card.title || card.summary || '';
  const category = card.category || '';
  /* 마이페이지 목록은 이미 만들어진 date 문자열을 갖고 있습니다 */
  const date = card.date || fmtDate(card.createdAt);
  const name = card.levelLabel || detail.verdict || (lv && lv.name) || '판정 결과';
  const suffix =
    detail.summary ||
    (typeof LEVEL_SUFFIX !== 'undefined' && card.result ? LEVEL_SUFFIX[card.result] : '');

  /* 신뢰도 별점 — 5단계 점수를 그대로 별로 옮깁니다 */
  const score = lv ? lv.score : 0;
  const stars =
    '<span class="stars"><b>' + '★'.repeat(score) + '</b>' + '★'.repeat(5 - score) + '</span>';

  /* 판정 정보 — 값이 있는 줄만 보여 줍니다 */
  const infoRows = [];
  const fromMock = {};
  (detail.info || []).forEach((row) => {
    fromMock[row[0]] = row[1];
  });

  if (fromMock['대상']) infoRows.push(['대상', esc(fromMock['대상'])]);
  if (title) infoRows.push(['주장', esc(title)]);
  if (lv) infoRows.push(['신뢰도', stars]);
  if (date) infoRows.push(['판정일', esc(date)]);
  if (fromMock['근거 버전']) infoRows.push(['근거 버전', esc(fromMock['근거 버전'])]);

  /* 체크포인트 — 없으면 근거 설명을 한 줄로 대신 씁니다 */
  const checks =
    (detail.checkpoints && detail.checkpoints.length && detail.checkpoints) ||
    (card.desc ? [card.desc] : []);

  const CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>';

  box.innerHTML = `
    <section class="rc vcard">
      <div class="vcard__top">
        <div class="vcard__thumb">
          ${
            card.imageUrl
              ? `<img src="${esc(card.imageUrl)}" alt="" />`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                   <rect x="3" y="5" width="18" height="14" rx="2.5" />
                   <path d="m4 16 4.5-4.5 3 3 3-3L20 16" />
                 </svg>`
          }
        </div>

        <div class="vcard__info">
          <h2 class="vcard__claim">${esc(title)}</h2>
          <span class="vcard__state">판정 완료</span>
          <p class="vcard__meta">
            <b>${esc(category)}</b>
            <span>${esc(date)}</span>
          </p>
        </div>
      </div>

      <div class="vcard__result">
        <span class="vmark" aria-hidden="true">${esc((lv && lv.icon) || '?')}</span>
        <div>
          <p class="vcard__vlabel">판정 결과</p>
          <p class="vcard__vname">
            ${esc(name)}
            ${suffix ? `<span>(${esc(suffix)})</span>` : ''}
          </p>
        </div>
      </div>
    </section>

    ${
      infoRows.length
        ? `<section class="detail__card">
      <h3 class="detail__h" style="margin-top: 0">판정 정보</h3>
      <table class="infotable">
        <tbody>
          ${infoRows
            .map(
              ([k, v]) =>
                `<tr><th>${esc(k)}</th><td class="is-wrap">${v}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </section>`
        : ''
    }

    ${
      checks.length
        ? `<section class="checkbox-card">
      <h3 class="checkbox-card__title">구체적인 체크포인트</h3>
      <ul class="checkbox-card__list">
        ${checks
          .map(
            (t) =>
              `<li><span class="checkbox-card__mark" aria-hidden="true">${CHECK_SVG}</span>${esc(t)}</li>`,
          )
          .join('')}
      </ul>
    </section>`
        : ''
    }

    <p class="detail__note">
      이 서비스는 의료 진단·처방을 대체하지 않습니다. 증상이 있다면 전문의와 상담하세요.
    </p>
  `;
})();
