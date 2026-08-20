/* ============================================
   Dr.Judge — 판정 결과
   서버에서 결과를 받아 그립니다. 아직 판정 중이면 잠시 기다립니다.
   ============================================ */

(function () {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );

  /* 판정 글 안에서 URL 줄은 흐리게, 첫 문장(또는 문장부호 없는 짧은 한 줄 전체)은
     굵게+따옴표로 강조합니다. 백엔드가 강조 정보를 따로 주지 않으므로
     프론트에서 형식적으로 추정합니다. */
  const URL_LINE_RE = /^(https?:\/\/|www\.)\S+$/i;

  function formatClaim(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';

    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    let leadDone = false;

    const quote = (s) => `“${s}”`;

    return lines
      .map((line) => {
        if (URL_LINE_RE.test(line)) {
          return `<span class="vcard__claim-link">${esc(line)}</span>`;
        }
        if (!leadDone) {
          leadDone = true;
          const m = line.match(/^(.+?[.!?])(\s|$)/); // 첫 문장 경계 (.!?) 까지만 굵게
          if (m) {
            const lead = m[1];
            const rest = line.slice(lead.length);
            return `<span class="vcard__claim-lead">${quote(esc(lead))}</span>${esc(rest)}`;
          }
          return `<span class="vcard__claim-lead">${quote(esc(line))}</span>`;
        }
        return esc(line);
      })
      .join('<br>');
  }

  const box = document.querySelector('.result2');
  const id = new URLSearchParams(location.search).get('id');

  /* ---------- 판정 중 안내 ---------- */
  function showWaiting(text) {
    document.getElementById('claimText').textContent = text || '판정하고 있어요…';
    box.classList.add('is-waiting');
  }
  function hideWaiting() {
    box.classList.remove('is-waiting');
  }

  /* 링크에 판정 번호를 달아 둡니다. 설명 화면에서 현재 등급을 표시하는 데 씁니다. */
  function linkWithId(el, judgmentId, extra) {
    if (!el || !judgmentId) return;
    el.href =
      el.getAttribute('href').split('?')[0] +
      '?id=' +
      encodeURIComponent(judgmentId) +
      (extra || '');
  }

  const fmtDate = (isoStr) => {
    const d = isoStr ? new Date(isoStr) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  };

  /* 서버가 주는 tip 은 한 줄짜리 문자열이라, 화면에서는 제목과 설명으로 나눕니다.
     "제목 → 설명" 이나 { title, desc } 형태면 나눠서, 아니면 제목만 보여 줍니다. */
  function splitTip(tip) {
    if (tip && typeof tip === 'object') {
      return { title: tip.title || tip.name || '', desc: tip.desc || tip.detail || '' };
    }
    const text = String(tip || '');
    const m = text.split(/\s*(?:→|->|\||\n)\s*/);
    return { title: m[0] || text, desc: m.slice(1).join(' ') };
  }

  /* ---------- 화면 그리기 ---------- */
  function render(r) {
    hideWaiting();

    const judgmentId = r.id || id;
    const lv = typeof levelOf === 'function' ? levelOf(r.level) : null;

    /* 주장 · 상태 · 분류 */
    const claimEl = document.getElementById('claimText');
    claimEl.innerHTML = formatClaim(r.claim) || '판정 결과';
    /* 카드에는 서버가 뽑아준 짧은 주장(title)을 보여주고,
       입력 원문 전체(extractedText)는 hover 로 확인할 수 있게 둡니다. */
    claimEl.title = r.fullText || r.claim || '';

    document.getElementById('stateChip').textContent =
      r.status === 'DONE' || !r.status ? '판정 완료' : '판정 중';

    const cat =
      r.categoryName ||
      (typeof CATEGORIES !== 'undefined' && r.categoryId
        ? CATEGORIES[r.categoryId] || ''
        : '');
    document.getElementById('catText').textContent = cat;
    document.getElementById('dateText').textContent = fmtDate(r.createdAt);

    /* 썸네일 — 실제 이미지가 있을 때만 보여주고, 없으면 아예 숨깁니다 */
    const thumbUrl = r.thumbnailUrl || r.imageUrl || null;
    const thumbEl = document.getElementById('thumb');
    if (thumbUrl) {
      thumbEl.hidden = false;
      thumbEl.innerHTML = `<img src="${esc(thumbUrl)}" alt="" />`;
    } else {
      thumbEl.hidden = true;
    }

    /* 판정 결과 줄 */
    const name =
      r.levelLabel || (lv && lv.name) || (r.status === 'DONE' ? '판정 결과' : '판정 중');
    document.getElementById('levelName').textContent = name;

    const suffix =
      typeof LEVEL_SUFFIX !== 'undefined' && r.level ? LEVEL_SUFFIX[r.level] : '';
    document.getElementById('levelSuffix').textContent = suffix ? `(${suffix})` : '';

    const mark = document.getElementById('levelMark');
    mark.textContent = (lv && lv.icon) || '?';

    /* 5칸 게이지 — EVIDENCE_LEVELS 의 score 만큼만 채웁니다 */
    const gaugeScore = (lv && lv.score) || 0;
    document.getElementById('levelGauge').innerHTML = [1, 2, 3, 4, 5]
      .map((n) => `<span class="${n <= gaugeScore ? 'is-on' : ''}"></span>`)
      .join('');

    /* 상업적 가능성 (= 이해상충) */
    const sect = document.getElementById('conflictSect');
    if (!r.conflict) {
      sect.hidden = true;
    } else {
      sect.hidden = false;
      if (r.conflictBadge) document.getElementById('conflictHead').textContent = r.conflictBadge;
      if (r.conflictDesc) document.getElementById('conflictDesc').textContent = r.conflictDesc;
    }

    /* 근거 요약 */
    const sources = r.sources || [];
    const lines = r.evidence
      ? String(r.evidence)
          .split(/\n+/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const items = lines.length
      ? lines.map((t) => esc(t))
      : sources.map((sc) =>
          sc.url
            ? `<a href="${esc(sc.url)}" target="_blank" rel="noopener">${esc(sc.title)}</a>`
            : esc(sc.title || ''),
        );

    document.getElementById('sourceList').innerHTML = items.length
      ? items.map((t) => `<li>${t}</li>`).join('')
      : '<li>확인된 근거가 아직 없어요.</li>';

    /* 구매 기준 카드 */
    const tips = (r.guideCard && r.guideCard.tips) || [];
    document.getElementById('criteriaPreview').innerHTML = tips.length
      ? tips
          .map((tip, i) => {
            const { title, desc } = splitTip(tip);
            return `
      <li class="steps__item">
        <span class="steps__no" aria-hidden="true">${i + 1}</span>
        <div>
          <p class="steps__title">${esc(title)}</p>
          ${desc ? `<p class="steps__desc">→ ${esc(desc)}</p>` : ''}
        </div>
      </li>`;
          })
          .join('')
      : '<li class="steps__item"><div><p class="steps__desc">확인 기준이 준비되지 않았어요.</p></div></li>';

    if (r.guideCard && r.guideCard.title) {
      document.getElementById('guideTitle').textContent = r.guideCard.title;
    }

    /* 의료 안전 안내 — 서버가 문구를 주면 그걸 씁니다 */
    if (r.safetyNotice) {
      document.getElementById('safetyText').textContent = r.safetyNotice;
    }

    /* 설명 화면들이 현재 판정을 알 수 있게 링크에 번호를 답니다 */
    // 라벨 설명 화면은 '지금 적용된 라벨'을 위에 띄우므로 등급도 함께 넘깁니다
    linkWithId(
      document.getElementById('labelLink'),
      judgmentId,
      r.level ? '&level=' + encodeURIComponent(r.level) : '',
    );
    linkWithId(document.getElementById('badgeLink'), judgmentId);
    linkWithId(document.getElementById('evidenceLink'), judgmentId);

    wireShare(r);
  }

  /* ---------- 공유 ---------- */
  function wireShare(r) {
    const postBtn = document.getElementById('postBtn');

    /* 이미 피드에 올린 판정이면 버튼을 잠급니다 */
    const already = (Store.current() || { cards: [] }).cards.some(
      (c) => String(c.judgmentId) === String(r.id || id),
    );
    if (already) {
      postBtn.disabled = true;
      postBtn.textContent = '이미 게시했어요';
    }

    postBtn.addEventListener('click', async () => {
      if (postBtn.disabled) return;
      if (!Store.isLoggedIn()) {
        location.href = './login.html';
        return;
      }

      postBtn.disabled = true;
      postBtn.textContent = '게시하는 중…';

      const res = await API.publishToFeed(r.id || id);

      postBtn.disabled = false;
      postBtn.textContent = '↑ 공유 피드에 게시하기';

      if (!res.ok) {
        alert(res.text);
        return;
      }

      const d = new Date();
      // 공유 회수(6.3)에 필요한 judgmentId 를 기억해 둡니다
      Store.addCard({
        judgmentId: r.id || id,
        postId: res.data.postId,
        category: r.levelLabel || '건강 · 판정 결과',
        date: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
        title: r.claim,
        result: r.levelLabel || '',
      });

      postBtn.disabled = true;
      postBtn.textContent = '이미 게시했어요';
      alert('공유 피드에 게시했어요. 마이페이지에서 확인할 수 있습니다.');
      location.href = './mypage.html';
    });

    const confirmBox = document.getElementById('shareConfirm');
    const open = () => (confirmBox.hidden = false);
    const close = () => (confirmBox.hidden = true);

    document.getElementById('linkBtn').addEventListener('click', open);
    document.getElementById('shareCancel').addEventListener('click', close);
    confirmBox.addEventListener('click', (e) => {
      if (e.target === confirmBox) close();
    });

    const shareOk = document.getElementById('shareOk');

    shareOk.addEventListener('click', async () => {
      shareOk.disabled = true;
      shareOk.textContent = '만드는 중…';

      // 서버에서 공유 전용 링크를 발급받습니다 (로그인 없이 열리는 주소)
      const res = await API.createShareLink(r.id || id);

      shareOk.disabled = false;
      shareOk.textContent = '공유하기';

      if (!res.ok) {
        close();
        alert(res.text);
        return;
      }
      close();

      const url = res.data.shareUrl || location.href;
      const text = `Dr.Judge 판정 결과 — ${r.claim}`;

      if (navigator.share) {
        try {
          await navigator.share({ title: 'Dr.Judge', text, url });
          return;
        } catch (e) {
          /* 사용자가 취소한 경우 */
        }
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert('공유 링크를 복사했어요.');
      }
    });
  }

  /* ---------- 시작 ---------- */
  (async () => {
    if (!id) {
      // 직접 열어본 경우 — 예시로 보여줍니다
      render({
        claim: RESULT_SAMPLE.claim,
        level: RESULT_SAMPLE.level,
        levelLabel: null,
        evidence: RESULT_SAMPLE.scope,
        conflict: RESULT_SAMPLE.conflict,
        conflictBadge: '상업적 가능성',
        conflictDesc:
          '이 정보의 출처는 제조사 또는 판매사와 연관된 채널입니다.',
        sources: RESULT_SAMPLE.sources.map((t) => ({ title: t })),
        guideCard: {
          title: '이렇게 확인하세요',
          tips: BUY_CRITERIA[0].items.map(([t, d]) => `${t} → ${d}`),
        },
        categoryId: 3,
        createdAt: new Date().toISOString(),
        status: 'DONE',
        safetyNotice: null,
      });
      return;
    }

    // 저장된 결과가 이미 완료 상태면 바로 그립니다
    const saved = Store.getResult(String(id));
    if (saved && saved.status === 'DONE') {
      render(saved);
      return;
    }

    showWaiting();
    const res = await API.waitForJudgment(id);

    if (!res.ok) {
      showWaiting(res.text);
      return;
    }
    if (res.data.status === 'FAILED') {
      location.replace('./judge-fail.html');
      return;
    }
    render(res.data);
  })();
})();
