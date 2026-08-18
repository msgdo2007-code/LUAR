(() => {
  'use strict';
  // Remove sessões antigas que o SDK do Supabase guardava em JavaScript.
  // A autenticação atual usa somente cookies HttpOnly emitidos pelo backend.
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index) || '';
    if (/^sb-.*-auth-token(?:-code-verifier)?$/i.test(key)) localStorage.removeItem(key);
  }
  const listeners = new Set();
  let cachedSession = null;
  let initialRequest = null;

  const emit = (event, session = cachedSession) => {
    for (const listener of listeners) {
      try { listener(event, session); } catch (error) { console.error('LUAR auth listener:', error); }
    }
  };
  const request = async (action, body = {}) => {
    const response = await fetch(`/api/create-account?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Não foi possível acessar sua conta.');
    return result;
  };
  const loadSession = async () => {
    if (!initialRequest) initialRequest = request('session').then(result => {
      cachedSession = result.session || null;
      if (cachedSession && location.hash === '#reset-password') setTimeout(() => emit('PASSWORD_RECOVERY', cachedSession), 0);
      return cachedSession;
    }).catch(() => null);
    return initialRequest;
  };

  window.luarAuthClient = {
    auth: {
      async getSession() {
        const session = cachedSession || await loadSession();
        return { data: { session }, error: null };
      },
      async refreshSession() {
        try {
          const result = await request('refresh');
          cachedSession = result.session || null;
          initialRequest = Promise.resolve(cachedSession);
          if (cachedSession) emit('TOKEN_REFRESHED', cachedSession);
          return { data: { session: cachedSession }, error: null };
        } catch (error) {
          cachedSession = null;
          initialRequest = Promise.resolve(null);
          return { data: { session: null }, error };
        }
      },
      async signInWithPassword({ email, password }) {
        try {
          const result = await request('login', { email, password });
          cachedSession = result.session || null;
          initialRequest = Promise.resolve(cachedSession);
          emit('SIGNED_IN', cachedSession);
          return { data: { user: result.user, session: cachedSession }, error: null };
        } catch (error) { return { data: {}, error }; }
      },
      async signInWithOAuth({ provider }) {
        if (!['google', 'discord'].includes(String(provider || '').toLowerCase())) return { data: {}, error: new Error('Provedor inválido.') };
        const url = `/api/create-account?action=oauth&provider=${encodeURIComponent(provider)}`;
        location.assign(url);
        return { data: { url }, error: null };
      },
      async updateUser(update) {
        try {
          const result = await request('update', update || {});
          if (cachedSession && result.user) cachedSession = { ...cachedSession, user: result.user };
          emit('USER_UPDATED', cachedSession);
          return { data: { user: result.user }, error: null };
        } catch (error) { return { data: {}, error }; }
      },
      async resetPasswordForEmail(email) {
        try { await request('recovery', { email }); return { data: {}, error: null }; }
        catch (error) { return { data: {}, error }; }
      },
      async signOut() {
        try { await request('signout'); }
        catch (error) { return { error }; }
        cachedSession = null;
        initialRequest = Promise.resolve(null);
        emit('SIGNED_OUT', null);
        return { error: null };
      },
      onAuthStateChange(callback) {
        listeners.add(callback);
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
      },
    },
  };
})();
