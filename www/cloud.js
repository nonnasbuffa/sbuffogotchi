// Accounts and cloud save through Firebase's REST APIs. Fill in CONFIG after creating the project.
const Cloud = (() => {
  const CONFIG = { apiKey: 'AIzaSyDLvvssfQY6noFYcg4_c8HxWSCEfUp4RJs', projectId: 'sbuffogotchi' };
  const SESSION_KEY = 'sbuffogotchi.session';
  const OFFSET_KEY = 'sbuffogotchi.timeOffset';
  let authBase = 'https://identitytoolkit.googleapis.com/v1';
  let tokenBase = 'https://securetoken.googleapis.com/v1';
  let dbBase = 'https://firestore.googleapis.com/v1';
  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { /* signed out */ }
  let offset = Number(localStorage.getItem(OFFSET_KEY)) || 0;

  const configured = () => !!(CONFIG.apiKey && CONFIG.projectId);
  const email = (name) => `${name.trim().toLowerCase()}@players.sbuffogotchi.game`;
  const friendly = {
    EMAIL_EXISTS: 'errTaken',
    INVALID_LOGIN_CREDENTIALS: 'errWrong',
    EMAIL_NOT_FOUND: 'errWrong',
    INVALID_PASSWORD: 'errWrong',
    INVALID_EMAIL: 'errEmail',
  };

  function remember(s) {
    session = s;
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }

  async function auth(path, name, password) {
    if (!configured()) throw new Error(I18n.t('errOff'));
    const res = await fetch(`${authBase}/accounts:${path}?key=${CONFIG.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email(name), password, returnSecureToken: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      const code = String(data.error?.message || '').split(' ')[0];
      throw new Error(friendly[code] ? I18n.t(friendly[code]) : code.startsWith('WEAK_PASSWORD') ? I18n.t('errWeak') : I18n.t('errGeneric', { code: code || res.status }));
    }
    remember({ uid: data.localId, name: name.trim(), token: data.idToken, refresh: data.refreshToken, expires: Date.now() + data.expiresIn * 1000 });
  }

  async function token() {
    if (session.expires - Date.now() > 60000) return session.token;
    const res = await fetch(`${tokenBase}/token?key=${CONFIG.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refresh)}`,
    });
    if (!res.ok) throw new Error('refresh failed');
    const data = await res.json();
    remember({ ...session, token: data.id_token, refresh: data.refresh_token, expires: Date.now() + data.expires_in * 1000 });
    return session.token;
  }

  const docUrl = () => `${dbBase}/projects/${CONFIG.projectId}/databases/(default)/documents/users/${session.uid}`;

  function learnTime(serverIso) {
    offset = new Date(serverIso).getTime() - Date.now();
    localStorage.setItem(OFFSET_KEY, String(offset));
  }

  // Each save returns the server's write time, which keeps streak days honest.
  async function push(save) {
    if (!session || !configured()) return false;
    const res = await fetch(docUrl(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ fields: { save: { stringValue: JSON.stringify(save) } } }),
    });
    if (!res.ok) throw new Error(`save failed ${res.status}`);
    learnTime((await res.json()).updateTime);
    return true;
  }

  async function pull() {
    if (!session || !configured()) return null;
    const res = await fetch(docUrl(), { headers: { Authorization: `Bearer ${await token()}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`load failed ${res.status}`);
    return JSON.parse((await res.json()).fields.save.stringValue);
  }

  return {
    configured, push, pull,
    user: () => session,
    login: (n, p) => auth('signInWithPassword', n, p),
    signup: (n, p) => auth('signUp', n, p),
    logout: () => remember(null),
    now: () => Date.now() + offset,
    useEmulator(host, projectId) {
      CONFIG.apiKey = 'demo'; CONFIG.projectId = projectId;
      authBase = `http://${host}:9099/identitytoolkit.googleapis.com/v1`;
      tokenBase = `http://${host}:9099/securetoken.googleapis.com/v1`;
      dbBase = `http://${host}:8080/v1`;
    },
  };
})();
