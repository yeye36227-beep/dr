/* ============================================
   Dr.Judge — 폼 검증 공통 모듈
   로그인 · 회원가입이 같은 규칙과 같은 오류 표시를 씁니다.

   상태
     .is-focused  포커스 중
     .is-filled   유효한 값이 들어옴 (연두색)
     .is-error    미입력 또는 잘못 입력 (빨간색 + 하단 문구)
   ============================================ */

/* ---------- 검증 규칙 ----------
   각 규칙은 { test, empty, invalid } 형태입니다.
   empty   = 미입력일 때 문구
   invalid = 형식이 틀렸을 때 문구 */
const RULES = {
  name: {
    test: (v) => /^[가-힣a-zA-Z][가-힣a-zA-Z\s]{0,19}$/.test(v.trim()),
    empty: '이름을 다시 확인해 주세요.',
    invalid: '이름을 다시 확인해 주세요.',
  },
  nickname: {
    test: (v) => v.trim().length >= 2 && v.trim().length <= 10,
    empty: '닉네임을 다시 확인해 주세요.',
    invalid: '닉네임을 10자 이내로 입력해 주세요.',
  },
  email: {
    test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    empty: '이메일 주소를 다시 확인해 주세요.',
    invalid: '이메일 주소를 다시 확인해 주세요.',
  },
  userId: {
    test: (v) => /^[A-Za-z0-9_]{4,20}$/.test(v.trim()),
    empty: '아이디를 다시 확인해 주세요.',
    invalid: '아이디를 다시 확인해 주세요.',
  },
  password: {
    test: (v) => v.length >= 10,
    empty: '비밀번호를 다시 확인해 주세요.',
    invalid: '비밀번호를 다시 확인해 주세요.',
  },
  passwordConfirm: {
    test: (v, form) => v.length > 0 && v === form.password,
    empty: '비밀번호를 다시 확인해 주세요.',
    invalid: '비밀번호를 다시 확인해 주세요.',
  },
};

/**
 * 폼 하나를 관리합니다.
 * @param {HTMLFormElement|HTMLElement} root  .field 들을 담고 있는 요소
 * @param {object} options
 * @param {HTMLButtonElement} options.submitBtn  제출 버튼 (잠그지 않고 색만 바뀝니다)
 * @param {(values) => boolean} [options.canSubmit]  추가 조건 (예: 약관 동의)
 * @param {() => void} [options.onChange]
 */
function createForm(root, options = {}) {
  const submitBtn = options.submitBtn || null;
  const fields = [...root.querySelectorAll('.field[data-field]')];

  const state = {}; // { userId: 'abc', ... }

  function inputOf(field) {
    return field.querySelector('.field__input');
  }
  function errorOf(field) {
    return field.querySelector('.field__error');
  }
  function fieldByKey(key) {
    return fields.find((f) => f.dataset.field === key) || null;
  }

  /** 값을 모아서 { key: value } 로 */
  function values() {
    const out = {};
    fields.forEach((f) => {
      out[f.dataset.field] = inputOf(f).value;
    });
    return out;
  }

  function isValid(field) {
    const key = field.dataset.field;
    const rule = RULES[key];
    if (!rule) return inputOf(field).value.trim().length > 0;
    return rule.test(inputOf(field).value, values());
  }

  /** 오류 표시 — text 를 주면 그 문구를, 없으면 규칙 기본 문구를 씁니다. */
  function showError(key, text) {
    const field = fieldByKey(key);
    if (!field) return;
    const rule = RULES[key] || {};
    const empty = inputOf(field).value.trim().length === 0;

    errorOf(field).textContent = text || (empty ? rule.empty : rule.invalid) || '';
    field.classList.add('is-error');
    field.classList.remove('is-filled');
    updateSubmit();
  }

  function clearError(key) {
    const field = fieldByKey(key);
    if (field) field.classList.remove('is-error');
    updateSubmit();
  }

  /** 값이 유효하면 연두색, 아니면(그리고 showError=true면) 빨간색 */
  function check(field, withError) {
    const ok = isValid(field);
    field.classList.toggle('is-filled', ok);
    if (ok) {
      field.classList.remove('is-error');
    } else if (withError) {
      showError(field.dataset.field);
    }
    return ok;
  }

  function allValid() {
    return fields.every(isValid);
  }

  /**
   * 버튼은 항상 누를 수 있습니다.
   * 대신 눌렀을 때 validateAll() 로 막고 각 칸에 오류를 표시합니다.
   * (모두 유효할 때는 is-ready 를 붙여 색만 바뀝니다)
   */
  function updateSubmit() {
    if (!submitBtn) return;
    const extra = options.canSubmit ? options.canSubmit(values()) : true;
    submitBtn.disabled = false;
    submitBtn.classList.toggle('is-ready', allValid() && extra);
  }

  /* ---------- 이벤트 ---------- */
  fields.forEach((field) => {
    const input = inputOf(field);

    input.addEventListener('focus', () => {
      field.classList.add('is-focused');
      // 빨간 표시는 값을 고칠 때(input) 사라집니다.
      // 여기서 지우면 제출 직후 자동 포커스로 오류가 바로 없어져 버립니다.
    });

    input.addEventListener('blur', () => {
      field.classList.remove('is-focused');
      // 비워둔 채 넘어가면 미입력 오류, 값이 있으면 형식 검사
      check(field, true);
      updateSubmit();
    });

    input.addEventListener('input', () => {
      check(field, false);
      // 비밀번호를 고치면 확인 칸도 다시 검사
      if (field.dataset.field === 'password') {
        const confirm = fieldByKey('passwordConfirm');
        if (confirm && inputOf(confirm).value) check(confirm, false);
      }
      updateSubmit();
      options.onChange && options.onChange(values());
    });
  });

  updateSubmit();

  return {
    values,
    allValid,
    updateSubmit,
    showError,
    clearError,
    /** 제출 직전 전체 검사 — 잘못된 칸을 전부 빨갛게 표시하고 첫 칸에 포커스 */
    validateAll() {
      const bad = fields.filter((f) => !check(f, true));
      updateSubmit();
      if (bad.length) inputOf(bad[0]).focus();
      return bad.length === 0;
    },
    /**
     * API 응답을 화면 오류로 반영합니다.
     *   { field: 'userId' }              → 한 칸에 표시
     *   { fields: ['userId','password'] } → 여러 칸에 동시에 표시
     */
    applyApiError(res) {
      const keys = res.fields || (res.field ? [res.field] : []);
      keys.forEach((k) => showError(k, res.text));
      return res.text;
    },
  };
}
