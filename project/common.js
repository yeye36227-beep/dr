/* ============================================
   Dr.Judge — 공통 스크립트
   ============================================ */

/**
 * assets 이미지가 아직 없을 때 자리표시자로 대체.
 * <img data-fallback="character"> 처럼 사용.
 * 실제 이미지를 넣으면 자동으로 사라집니다.
 */
function initImageFallback(root = document) {
  root.querySelectorAll('img[data-fallback]').forEach((img) => {
    if (img.dataset.watched) return;
    img.dataset.watched = '1';

    const replace = () => {
      if (img.dataset.replaced) return;
      img.dataset.replaced = '1';
      const box = document.createElement('div');
      box.className = `img-placeholder ${img.dataset.fallback}`;
      box.textContent = img.alt || 'image';
      img.replaceWith(box);
    };

    // 진짜 실패했을 때만 자리표시자로 바꿉니다.
    img.addEventListener('error', replace, { once: true });
    img.addEventListener(
      'load',
      () => {
        if (img.naturalWidth === 0) replace();
      },
      { once: true },
    );

    // 아직 내려받는 중인 이미지를 실패로 오해하지 않도록,
    // 페이지 로딩이 모두 끝난 뒤에 한 번 더 확인합니다.
    const settle = () => {
      if (img.complete && img.naturalWidth === 0) replace();
    };
    if (document.readyState === 'complete') setTimeout(settle, 400);
    else window.addEventListener('load', settle, { once: true });
  });
}

/* ---------- 하단 탭바 (홈 · 판정 · 피드 · 마이) ---------- */
const TABS = [
  {
    key: 'home',
    label: '홈',
    href: './home.html',
    icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2 3.4 10.2c-.3.2-.4.5-.4.8v9c0 .6.4 1 1 1h5.2c.5 0 .9-.4.9-1v-4.3c0-.6.4-1 1-1h1.8c.6 0 1 .4 1 1V20c0 .6.4 1 .9 1H20c.6 0 1-.4 1-1v-9c0-.3-.1-.6-.4-.8L12 3.2Z"/></svg>`,
  },
  {
    key: 'judge',
    label: '판정',
    href: './judge.html',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M9 13.5l2 2 4-4"/></svg>`,
  },
  {
    key: 'feed',
    label: '피드',
    href: './feed.html',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>`,
  },
  {
    key: 'my',
    label: '마이',
    href: './mypage.html',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c.7-3.6 3.6-5.6 7.2-5.6s6.5 2 7.2 5.6"/></svg>`,
  },
];

/**
 * <nav class="tabbar" data-active="home"></nav> 를 채웁니다.
 * data-active 값: home | judge | feed | my
 */
function renderTabbar(root = document) {
  root.querySelectorAll('.tabbar').forEach((nav) => {
    const active = nav.dataset.active;
    nav.innerHTML = TABS.map(
      (t) => `
      <a href="${t.href}" class="tabbar__item ${t.key === active ? 'is-active' : ''}"
         ${t.key === active ? 'aria-current="page"' : ''}>
        ${t.icon}
        <span>${t.label}</span>
      </a>`,
    ).join('');
  });
}

/**
 * 비밀번호 표시 토글 (4-2 눈 감기 ↔ 4-3 눈 뜨기)
 * <button class="field__eye" data-toggle="#password"> 형태로 사용합니다.
 */
function initPasswordToggles(root = document) {
  root.querySelectorAll('.field__eye[data-toggle]').forEach((eye) => {
    const target = root.querySelector(eye.dataset.toggle) ||
      document.querySelector(eye.dataset.toggle);
    if (!target) return;

    eye.addEventListener('click', () => {
      const show = target.type === 'password';
      target.type = show ? 'text' : 'password';
      eye.classList.toggle('is-visible', show);
      eye.setAttribute('aria-pressed', String(show));
      eye.setAttribute('aria-label', show ? '비밀번호 숨기기' : '비밀번호 표시');
      target.focus();
    });
  });
}

/** 상대 시간 표기 (3분 전 / 2일 전) */
function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}일 전`;
  return `${Math.floor(diff / 2592000)}개월 전`;
}

/* ============================================
   로그인 상태 관리
   ============================================ */

/** 로그인이 필요한 화면에서 부릅니다. 안 되어 있으면 로그인으로 보냅니다. */
function requireLogin() {
  if (typeof Store === 'undefined' || Store.isLoggedIn()) return true;
  const next = location.pathname.split('/').pop() + location.search;
  location.replace(`./login.html?next=${encodeURIComponent(next)}`);
  return false;
}

/* 통신 중 로그인이 풀리면 알려주고 로그인 화면으로 보냅니다 */
window.addEventListener('drjudge:session-expired', () => {
  const here = location.pathname.split('/').pop();
  if (here === 'login.html' || here === 'start.html' || here === 'share.html') return;

  alert('로그인이 만료됐어요. 다시 로그인해 주세요.');
  location.replace(
    `./login.html?next=${encodeURIComponent(here + location.search)}`,
  );
});

/* ============================================
   네트워크 끊김 안내
   ============================================ */
function initOfflineBanner() {
  const bar = document.createElement('div');
  bar.className = 'offlinebar';
  bar.textContent = '인터넷 연결이 끊겼어요';
  bar.hidden = true;
  document.body.appendChild(bar);

  const sync = () => {
    bar.hidden = navigator.onLine !== false;
  };
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  sync();
}

document.addEventListener('DOMContentLoaded', () => {
  initOfflineBanner();
  initImageFallback();
  renderTabbar();
});
