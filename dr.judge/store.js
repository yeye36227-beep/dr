/* ============================================
   Dr.Judge — 계정별 데이터 저장소

   백엔드가 붙기 전까지 브라우저에 계정별로 나눠 보관합니다.
   화면들은 Store 만 보고 그리므로, 나중에 서버를 붙일 때는
   이 파일의 함수 안쪽만 API 호출로 바꾸면 됩니다.

   구조
     drjudge = {
       session: 'userId',
       users: { userId: { profile, points, history, cards } }
     }
   ============================================ */

const Store = (() => {
  const KEY = 'drjudge';

  /* 저장 형식이 바뀌면 올립니다.
     v1 에는 비밀번호가 들어 있었는데, 서버 로그인으로 바뀌면서
     더 이상 저장하지 않습니다. 예전 데이터는 다음 실행 때 지워집니다. */
  const SCHEMA = 2;

  /* 가입 시 자동으로 붙는 닉네임 후보 */
  const RANDOM_NICKNAMES = [
    '건강한하루',
    '성분탐정',
    '팩트체커',
    '오늘도판정',
    '꼼꼼한소비자',
    '라벨읽는사람',
    '근거먼저',
    '차분한리서처',
  ];

  /* ---------- 저장 위치 ----------
     localStorage 가 우선이지만, 파일을 더블클릭해서 여는 file:// 환경에서는
     브라우저가 localStorage 를 막습니다. 그때는 window.name 에 담아
     같은 탭 안에서 화면을 옮겨다녀도 데이터가 유지되게 합니다. */
  const TAG = '#drjudge#';

  function canUseLocal() {
    try {
      localStorage.setItem('__t', '1');
      localStorage.removeItem('__t');
      return true;
    } catch (e) {
      return false;
    }
  }
  const USE_LOCAL = canUseLocal();

  function rawGet() {
    if (USE_LOCAL) {
      try {
        return localStorage.getItem(KEY);
      } catch (e) {
        return null;
      }
    }
    const n = String(window.name || '');
    return n.startsWith(TAG) ? n.slice(TAG.length) : null;
  }
  function rawSet(text) {
    if (USE_LOCAL) {
      try {
        localStorage.setItem(KEY, text);
      } catch (e) {}
      return;
    }
    window.name = TAG + text;
  }

  const emptyDb = () => ({ v: SCHEMA, session: null, users: {} });

  function read() {
    try {
      const db = JSON.parse(rawGet());
      if (!db) return emptyDb();

      // 예전 형식이면 통째로 비우고 시작합니다 (비밀번호 잔재 제거)
      if (db.v !== SCHEMA) {
        const fresh = emptyDb();
        write(fresh);
        return fresh;
      }
      return db;
    } catch (e) {
      return emptyDb();
    }
  }
  function write(db) {
    rawSet(JSON.stringify(db));
  }

  const now = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  /** 새 계정의 초기 상태 — 비어 있는 채로 시작합니다 */
  /** 문자열 → 숫자 (같은 입력이면 항상 같은 값) */
  function hashOf(str) {
    let h = 0;
    for (let i = 0; i < String(str).length; i++) {
      h = (h * 31 + String(str).charCodeAt(i)) >>> 0;
    }
    return h;
  }

  function blank(userId, profile) {
    return {
      profile: {
        userId,
        // 아이디에서 계산하므로 같은 계정은 늘 같은 닉네임을 받습니다
        nickname:
          (profile && profile.nickname) ||
          RANDOM_NICKNAMES[hashOf(userId) % RANDOM_NICKNAMES.length],
        name: (profile && profile.name) || '',
        email: (profile && profile.email) || '',
        studentNo: (profile && profile.studentNo) || '',
        interest: (profile && profile.interest) || null,
      },
      points: [],
      done: [], // 포인트를 이미 준 판정 번호
      cards: [], // 공유 회수에 필요한 postId ↔ judgmentId 만 보관
    };
  }

  /* ---------- 계정 ----------
     로그인·중복확인은 서버가 합니다. 여기서는 화면에 보여줄
     프로필만 들고 있습니다. 비밀번호는 저장하지 않습니다. */

  /** 로그인·가입 성공 후, 이 기기에 프로필 자리를 만듭니다 */
  function createProfile(userId, profile) {
    const db = read();
    const isNew = !db.users[userId];
    if (isNew) db.users[userId] = blank(userId, profile);
    else if (profile) Object.assign(db.users[userId].profile, profile);

    db.session = userId;
    write(db);

    if (isNew) addPoint('가입 축하 포인트', 1000);
    return { ok: true, isNew, user: db.users[userId] };
  }

  /* ---------- 세션 ---------- */

  /** 세션 열기 — 이 기기에 없는 계정이면 자리를 만들어 줍니다 */
  function signIn(userId, profile) {
    return createProfile(userId, profile);
  }

  function signOut() {
    const db = read();
    db.session = null; // 계정 데이터는 남기고 세션만 끊습니다
    db.tokens = null;
    write(db);
  }

  const currentId = () => read().session;
  const isLoggedIn = () => Boolean(currentId());

  /** 현재 로그인한 계정의 데이터 (없으면 null) */
  function current() {
    const db = read();
    return db.session ? db.users[db.session] : null;
  }

  /* ---------- 프로필 ---------- */
  function updateProfile(patch) {
    const db = read();
    if (!db.session) return null;
    Object.assign(db.users[db.session].profile, patch);
    write(db);
    return db.users[db.session].profile;
  }

  /* ---------- 포인트 ----------
     서버가 포인트를 관리하면(API.LIVE.points) 여기에는 쌓지 않습니다.
     양쪽에 다 쌓이면 숫자가 두 배로 보이기 때문입니다. */
  const serverPoints = () =>
    typeof API !== 'undefined' && API.LIVE && API.LIVE.points === true;

  function addPoint(label, amount) {
    if (serverPoints()) return;
    const db = read();
    if (!db.session) return;
    db.users[db.session].points.unshift({ label, at: now(), amount });
    write(db);
  }
  function totalPoint() {
    const u = current();
    return u ? u.points.reduce((s, p) => s + p.amount, 0) : 0;
  }

  /* ---------- 판정 이력 ---------- */
  /* 판정 이력은 서버에서 받아옵니다(3.3).
     여기서는 포인트를 한 번만 주기 위해 처리한 판정 번호만 기억합니다. */
  function hasHistory(id) {
    const u = current();
    return Boolean(u && (u.done || []).includes(String(id)));
  }

  function markJudged(id) {
    const db = read();
    if (!db.session) return;
    const u = db.users[db.session];
    u.done = u.done || [];
    if (u.done.includes(String(id))) return;

    u.done.unshift(String(id));
    u.done = u.done.slice(0, 200); // 너무 쌓이지 않게
    write(db);
    addPoint('판정 완료', 50);
  }

  /* ---------- 공유 카드 ---------- */
  function addCard(card) {
    const db = read();
    if (!db.session) return;
    db.users[db.session].cards.unshift({ id: 'm' + Date.now(), likes: 0, ...card });
    write(db);
    addPoint('카드 공유', 50);
  }
  function removeCard(id) {
    const db = read();
    if (!db.session) return;
    const u = db.users[db.session];
    u.cards = u.cards.filter((c) => c.id !== id);
    write(db);
  }

  /**
   * 서버에서 받은 내 데이터를 그대로 채워 넣습니다.
   * 연동 후에는 로그인 직후 한 번 호출해 주면
   * 화면 코드는 지금과 똑같이 Store 만 읽으면 됩니다.
   *   Store.hydrate({ profile, points, history, cards })
   */
  function hydrate(data) {
    const db = read();
    if (!db.session || !data) return;
    const u = db.users[db.session];
    if (data.profile) Object.assign(u.profile, data.profile);
    if (data.points) u.points = data.points;
    write(db);
  }

  /* ---------- 토큰 ----------
     화면을 옮겨도 로그인이 유지되도록 저장소에 함께 보관합니다.
     주의: 브라우저 저장소는 스크립트가 읽을 수 있습니다.
           실제 서비스라면 httpOnly 쿠키로 옮기는 편이 안전합니다. */
  function saveTokens(t) {
    const db = read();
    db.tokens = t
      ? {
          accessToken: t.accessToken || null,
          refreshToken: t.refreshToken || null,
          /* 온보딩 저장(2.1)에 쓰는 1회용 토큰.
             지금 로그인 응답에는 없지만, 서버가 주기 시작하면 그대로 보관됩니다. */
          onboardingToken: t.onboardingToken || null,
        }
      : null;
    write(db);
  }
  function tokens() {
    return (
      read().tokens || { accessToken: null, refreshToken: null, onboardingToken: null }
    );
  }

  /* ---------- 판정 결과 ---------- */
  function saveResult(result) {
    const db = read();
    if (!db.session) return result;
    const u = db.users[db.session];
    u.results = u.results || {};
    u.results[result.id] = result;
    write(db);
    return result;
  }
  function getResult(id) {
    const u = current();
    return u && u.results ? u.results[id] || null : null;
  }

  /** 탈퇴 — 이 계정의 데이터를 통째로 지웁니다 (되돌릴 수 없음) */
  function removeAccount(userId) {
    const db = read();
    const id = userId || db.session;
    if (!id) return false;
    delete db.users[id];
    if (db.session === id) {
      db.session = null;
      db.tokens = null;
    }
    write(db);
    return true;
  }

  /** 개발용 — 저장된 계정을 전부 지웁니다 */
  function reset() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
  }

  return {
    createProfile,
    signIn,
    signOut,
    current,
    currentId,
    isLoggedIn,
    updateProfile,
    addPoint,
    totalPoint,
    markJudged,
    hasHistory,
    addCard,
    removeCard,
    removeAccount,
    saveTokens,
    tokens,
    saveResult,
    getResult,
    hashOf,
    hydrate,
    reset,
    RANDOM_NICKNAMES,
  };
})();
