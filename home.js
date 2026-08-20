/* ============================================
   Dr.Judge — 메인(홈) 화면 스크립트
   spec: 1 검색 바 / 2 카테고리 선택 바 / 3 공유 피드 / 4 데일리 브리핑
   데이터: data.js
   ============================================ */

/* ---------- 4. 데일리 브리핑 캐러셀 ---------- */
const track = document.getElementById('briefingTrack');
const dots = document.getElementById('briefingDots');
let slideIndex = 0;
let autoTimer = null;

let slides = BRIEFINGS; // 서버에서 받아오면 교체됩니다
let slidesFromServer = false; // 기본 배너의 id 는 서버에 없는 값이라 지표를 보내지 않습니다

function renderBriefings() {
  track.innerHTML = slides.map(
    (b) => `
    <button class="briefing__slide" data-id="${b.id}" data-href="${b.href || './briefing.html'}" type="button">
      <span class="briefing__badge">DAILY BRIEFING</span>
      <h3 class="briefing__title">${b.title}</h3>
      <p class="briefing__desc">${b.desc}</p>
      <span class="briefing__cta">${b.cta} <span aria-hidden="true">›</span></span>
      <img class="briefing__char" src="./assets/character-head.png" alt="Dr.Judge" data-fallback="character" />
    </button>
  `,
  ).join('');

  dots.innerHTML = slides.map(
    (_, i) => `<span class="${i === 0 ? 'is-active' : ''}"></span>`,
  ).join('');

  initImageFallback(track);

  // 터치 시 그 장에 정해진 화면으로 이동합니다
  track.querySelectorAll('.briefing__slide').forEach((el) => {
    el.addEventListener('click', () => goSlide(el.dataset.id, el.dataset.href));
  });
}

function goSlide(briefingId, href) {
  /* 오픈율 지표(4.3) — 서버에서 받은 브리핑 카드일 때만 보냅니다.
     사용법·포인트·공지 카드는 서버에 없는 id 라 보내지 않습니다. */
  const isServerBriefing = slidesFromServer && briefingId && !/^b-/.test(briefingId);
  if (isServerBriefing) API.markBriefingOpened(briefingId);

  location.href = href || './briefing.html';
}

function syncDots() {
  const w = track.clientWidth;
  if (!w) return;
  slideIndex = Math.round(track.scrollLeft / w);
  dots
    .querySelectorAll('span')
    .forEach((d, i) => d.classList.toggle('is-active', i === slideIndex));
}

function startAuto() {
  stopAuto();
  if (slides.length < 2) return; // 카드가 하나면 넘길 필요 없음
  autoTimer = setInterval(() => {
    slideIndex = (slideIndex + 1) % slides.length;
    track.scrollTo({ left: slideIndex * track.clientWidth, behavior: 'smooth' });
  }, 4500);
}
function stopAuto() {
  clearInterval(autoTimer);
}

track.addEventListener('scroll', syncDots, { passive: true });
track.addEventListener('pointerdown', stopAuto);
track.addEventListener('pointerup', startAuto);

/* ---------- 1. 검색 바 ---------- */
const searchbar = document.getElementById('searchbar');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const searchIcon = document.getElementById('searchIcon');
let keyword = '';

/* ---------- 공유 피드 (서버에서 최신 몇 개만) ---------- */
const homeFeed = document.getElementById('homeFeed');
let feedItems = [];

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

function highlight(text) {
  const safe = esc(text);
  if (!keyword) return safe;
  const re = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return safe.replace(re, (m) => `<span class="hl">${m}</span>`);
}

function visibleFeeds() {
  if (!keyword) return feedItems;
  const k = keyword.toLowerCase();
  const hit = (f) =>
    `${f.title || ''} ${f.summary || ''}`.toLowerCase().includes(k);
  return [...feedItems.filter(hit), ...feedItems.filter((f) => !hit(f))];
}

function renderFeed() {
  const list = visibleFeeds();
  const k = keyword.toLowerCase();
  const isHit = (f) =>
    keyword && `${f.title || ''} ${f.summary || ''}`.toLowerCase().includes(k);

  homeFeed.innerHTML = list.length
    ? list
        .map(
          (c) => `
    <li class="pcard ${isHit(c) ? 'is-hit' : ''}" data-id="${esc(c.id)}">
      <div class="pcard__top">
        <span class="pcard__cat">${esc(c.category || c.levelLabel || '')}</span>
        <span class="badge-done">판정 완료</span>
      </div>
      <h3 class="pcard__title">“${highlight(c.title || c.summary || '')}”</h3>
      <div class="pcard__foot">
        <span class="pcard__author">@${esc(c.author)}</span>
        <span class="pcard__like">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
            <path d="M12 20s-7.2-4.4-7.2-9.3A4.2 4.2 0 0 1 12 8.1a4.2 4.2 0 0 1 7.2 2.6C19.2 15.6 12 20 12 20Z" />
          </svg>
          ${c.likes}
        </span>
      </div>
    </li>`,
        )
        .join('')
    : `<li class="empty"><p class="empty__title">아직 공유된 판정이 없어요</p><p class="empty__desc">판정 결과를 피드에 게시하면 여기에 보여요.</p></li>`;

  homeFeed.querySelectorAll('.pcard').forEach((el) => {
    el.addEventListener('click', () => {
      /* 서버 id 는 숫자, dataset 값은 문자열이라 === 로는 못 찾습니다 */
      const item = feedItems.find((i) => String(i.id) === el.dataset.id);
      if (item) {
        FeedHandoff.set(item);
        Store.saveResult({ ...item, id: 'post:' + item.id });
      }
      location.href = `./feed-detail.html?id=${encodeURIComponent(el.dataset.id)}`;
    });
  });
}

async function loadFeed() {
  const res = await API.getFeedPosts({ sort: 'recent', page: 1, size: 5 });
  if (!res.ok) {
    homeFeed.innerHTML = `<li class="empty"><p class="empty__title">피드를 불러오지 못했어요</p><p class="empty__desc">${esc(res.text)}</p></li>`;
    return;
  }
  feedItems = res.data.items;
  renderFeed();
}

// 돋보기 아이콘 터치 시 키보드가 올라옴 (input focus)
searchIcon.addEventListener('click', () => searchInput.focus());
searchInput.addEventListener('focus', () =>
  searchbar.classList.add('is-focused'),
);
searchInput.addEventListener('blur', () =>
  searchbar.classList.remove('is-focused'),
);
searchInput.addEventListener('input', () => {
  keyword = searchInput.value.trim();
  searchClear.hidden = keyword.length === 0;
  renderFeed();
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  keyword = '';
  searchClear.hidden = true;
  renderFeed();
  searchInput.focus();
});

/* ---------- 오늘의 브리핑 ---------- */
async function loadBriefing() {
  const res = await API.getTodayBriefing();
  if (!res.ok || !res.data.items.length) return; // 실패하면 기본 배너 유지

  /* 첫 장(브리핑 카드)의 문구만 오늘 받은 내용으로 바꿉니다.
     나머지 장은 사용법·포인트·공지 안내라 그대로 둡니다. */
  const top = res.data.items[0];
  slides = BRIEFINGS.map((s) =>
    s.live
      ? {
          ...s,
          id: top.id || s.id,
          title: top.title || s.title,
          desc: top.summary || top.levelLabel || s.desc,
        }
      : s,
  );
  slidesFromServer = true;
  renderBriefings();
  startAuto();
}

/* ---------- init ---------- */
renderBriefings();
startAuto();
loadBriefing();
loadFeed();
window.addEventListener('resize', syncDots);
