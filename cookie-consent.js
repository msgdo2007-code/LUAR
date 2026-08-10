(() => {
  'use strict';

  const STORAGE_KEY = 'luar_cookie_consent_v2';
  const VERSION = 2;
  const COOKIE_LIFETIME_DAYS = 180;
  const defaults = Object.freeze({ necessary: true, analytics: false, advertising: false, personalization: false });
  const config = () => window.LUAR_TRACKING_CONFIG || {};
  let current = readPreference();
  let uiReady = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });
  window.gtag('set', 'ads_data_redaction', true);

  function readPreference() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || saved.version !== VERSION || !saved.choices) return null;
      const savedAt = Date.parse(saved.savedAt || '');
      if (!savedAt || Date.now() - savedAt > COOKIE_LIFETIME_DAYS * 86400000) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return { ...defaults, ...saved.choices, necessary: true };
    } catch {
      return null;
    }
  }

  function savePreference(choices) {
    current = { ...defaults, ...choices, necessary: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: VERSION,
      savedAt: new Date().toISOString(),
      expiresAfterDays: COOKIE_LIFETIME_DAYS,
      choices: current
    }));
    applyConsent(current, true);
    closePanels();
    announce('Preferências de cookies salvas. Você pode alterá-las a qualquer momento no rodapé.');
  }

  function consentState(choices) {
    return {
      analytics_storage: choices.analytics ? 'granted' : 'denied',
      ad_storage: choices.advertising ? 'granted' : 'denied',
      ad_user_data: choices.advertising ? 'granted' : 'denied',
      ad_personalization: choices.advertising && choices.personalization ? 'granted' : 'denied'
    };
  }

  function applyConsent(choices, isUpdate = false) {
    window.gtag('consent', isUpdate ? 'update' : 'default', consentState(choices));
    const analyticsId = String(config().googleAnalyticsId || '').trim();
    if (analyticsId) window[`ga-disable-${analyticsId}`] = !choices.analytics;
    if (choices.analytics || choices.advertising) loadGoogleTag();
    if (choices.advertising) {
      loadMetaPixel();
      loadTikTokPixel();
      loadMicrosoftUet();
    } else if (isUpdate) {
      disableOptionalTracking();
    }
    window.dispatchEvent(new CustomEvent('luar:consentchange', { detail: { ...choices } }));
  }

  function appendScript(id, src, attributes = {}) {
    if (!src || document.getElementById(id)) return null;
    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.src = src;
    Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, value));
    document.head.appendChild(script);
    return script;
  }

  function loadGoogleTag() {
    const ids = [config().googleAnalyticsId, config().googleAdsId].map(value => String(value || '').trim()).filter(Boolean);
    if (!ids.length) return;
    appendScript('luar-google-tag', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids[0])}`);
    if (!window.__luarGoogleBooted) {
      window.__luarGoogleBooted = true;
      window.gtag('js', new Date());
    }
    window.__luarGoogleConfiguredIds = window.__luarGoogleConfiguredIds || new Set();
    if (current?.analytics && config().googleAnalyticsId && !window.__luarGoogleConfiguredIds.has(config().googleAnalyticsId)) {
      window.gtag('config', config().googleAnalyticsId, { anonymize_ip: true });
      window.__luarGoogleConfiguredIds.add(config().googleAnalyticsId);
    }
    if (current?.advertising && config().googleAdsId && !window.__luarGoogleConfiguredIds.has(config().googleAdsId)) {
      window.gtag('config', config().googleAdsId);
      window.__luarGoogleConfiguredIds.add(config().googleAdsId);
    }
  }

  function loadMetaPixel() {
    const id = String(config().metaPixelId || '').trim();
    if (!id || window.fbq) return;
    const fbq = window.fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
    appendScript('luar-meta-pixel', 'https://connect.facebook.net/pt_BR/fbevents.js');
    fbq('init', id); fbq('track', 'PageView');
  }

  function loadTikTokPixel() {
    const id = String(config().tiktokPixelId || '').trim();
    if (!id || window.ttq) return;
    const ttq = window.ttq = []; ttq.methods = ['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];
    ttq.setAndDefer = (target, method) => { target[method] = function () { target.push([method].concat([].slice.call(arguments))); }; };
    ttq.methods.forEach(method => ttq.setAndDefer(ttq, method));
    ttq.instance = key => { const instance = ttq._i[key] || []; ttq.methods.forEach(method => ttq.setAndDefer(instance, method)); return instance; };
    ttq.load = key => { ttq._i = ttq._i || {}; ttq._i[key] = []; ttq._i[key]._u = 'https://analytics.tiktok.com/i18n/pixel/events.js'; appendScript('luar-tiktok-pixel', `${ttq._i[key]._u}?sdkid=${encodeURIComponent(key)}&lib=ttq`); };
    ttq.load(id); ttq.page();
  }

  function loadMicrosoftUet() {
    const id = String(config().microsoftUetId || '').trim();
    if (!id || window.uetq?.__luarReady) return;
    const queue = window.uetq = window.uetq || [];
    queue.__luarReady = true;
    const script = appendScript('luar-microsoft-uet', 'https://bat.bing.com/bat.js');
    script?.addEventListener('load', () => {
      if (typeof window.UET !== 'function') return;
      const tracker = new window.UET({ ti: id, enableAutoSpaTracking: true, q: queue });
      tracker.__luarReady = true;
      window.uetq = tracker;
      window.uetq.push('pageLoad');
    }, { once: true });
  }

  function track(name, details = {}) {
    if (!name || (!current?.analytics && !current?.advertising)) return false;
    const payload = { page_path: location.pathname, ...details };
    if (current.analytics || current.advertising) window.gtag('event', name, payload);
    if (current.advertising) {
      try { window.fbq?.('trackCustom', name, payload); } catch {}
      try { window.ttq?.track?.(name, payload); } catch {}
      try { window.uetq?.push?.('event', name, payload); } catch {}
    }
    return true;
  }

  function disableOptionalTracking() {
    const analyticsId = String(config().googleAnalyticsId || '').trim();
    if (analyticsId) window[`ga-disable-${analyticsId}`] = true;
    try { window.fbq?.('consent', 'revoke'); } catch {}
    try { window.ttq?.disableCookie?.(); } catch {}
    if (!current?.analytics && !current?.advertising) localStorage.removeItem('luar-attribution');
    ['_ga', '_gid', '_gat', '_gcl_au', '_fbp', '_fbc', '_uetmsclkid', '_uetsid', '_uetvid'].forEach(removeCookieFamily);
  }

  function removeCookieFamily(name) {
    const names = document.cookie.split(';').map(item => item.split('=')[0].trim()).filter(item => item === name || item.startsWith(`${name}_`));
    names.forEach(cookieName => {
      document.cookie = `${cookieName}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = `${cookieName}=; Max-Age=0; path=/; domain=.${location.hostname}; SameSite=Lax`;
    });
  }

  function announce(message) {
    const live = document.getElementById('luarConsentStatus');
    if (live) live.textContent = message;
  }

  function closePanels() {
    document.getElementById('luarCookieBanner')?.setAttribute('hidden', '');
    const modal = document.getElementById('luarCookiePreferences');
    if (modal) { modal.setAttribute('hidden', ''); modal.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('cookie-preferences-open');
  }

  function openPreferences() {
    const modal = document.getElementById('luarCookiePreferences');
    if (!modal) return;
    const choices = current || defaults;
    ['analytics', 'advertising', 'personalization'].forEach(key => { const input = modal.querySelector(`[name="${key}"]`); if (input) input.checked = !!choices[key]; });
    modal.removeAttribute('hidden'); modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cookie-preferences-open');
    modal.querySelector('button, input')?.focus();
  }

  function renderUi() {
    if (uiReady) return;
    uiReady = true;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="cookie-consent" id="luarCookieBanner" role="dialog" aria-modal="false" aria-labelledby="luarCookieTitle" ${current ? 'hidden' : ''}>
        <div class="cookie-consent__copy"><img src="/scripts/icon-192.png" width="42" height="42" alt=""><div><strong id="luarCookieTitle">Sua privacidade, sua escolha</strong><p>Usamos armazenamento necessário para o LUAR funcionar. Analytics, pixels de campanha e personalização só são ativados com sua autorização.</p><a href="/cookies.html">Ver Política de Cookies</a></div></div>
        <div class="cookie-consent__actions"><button type="button" data-consent="accept">Aceitar todos</button><button type="button" data-consent="reject">Rejeitar não essenciais</button><button type="button" data-consent="manage">Gerenciar preferências</button></div>
      </div>
      <div class="cookie-preferences" id="luarCookiePreferences" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="luarPreferencesTitle" hidden>
        <div class="cookie-preferences__panel"><header><div><span>CONTROLE DE PRIVACIDADE</span><h2 id="luarPreferencesTitle">Preferências de cookies</h2><p>Escolha quais categorias opcionais podem funcionar neste navegador.</p></div><button type="button" data-consent="close" aria-label="Fechar preferências">×</button></header>
          <div class="cookie-category"><div><strong>Cookies necessários</strong><p>Sessão, segurança, backup local e preferências essenciais. Duração: sessão ou até a exclusão dos dados da conta.</p></div><span>Sempre ativos</span></div>
          <label class="cookie-category"><div><strong>Analytics</strong><p>Mede páginas e eventos para melhorar o LUAR. Google Analytics: até 14 meses, conforme a configuração da propriedade.</p></div><input type="checkbox" name="analytics"><i aria-hidden="true"></i></label>
          <label class="cookie-category"><div><strong>Publicidade e marketing</strong><p>Permite pixels de campanha do Google Ads, Meta, TikTok e Microsoft. Duração definida por cada fornecedor, detalhada na Política de Cookies.</p></div><input type="checkbox" name="advertising"><i aria-hidden="true"></i></label>
          <label class="cookie-category"><div><strong>Personalização</strong><p>Permite adaptar conteúdo e anúncios com base nas escolhas autorizadas. Duração máxima prevista: 180 dias.</p></div><input type="checkbox" name="personalization"><i aria-hidden="true"></i></label>
          <footer><button type="button" data-consent="save">Salvar minhas escolhas</button><button type="button" data-consent="reject">Rejeitar não essenciais</button></footer>
        </div>
      </div>
      <p class="sr-only" id="luarConsentStatus" role="status" aria-live="polite"></p>`);

    document.addEventListener('click', event => {
      const button = event.target.closest('[data-consent]');
      if (!button) return;
      const action = button.dataset.consent;
      if (action === 'accept') savePreference({ analytics: true, advertising: true, personalization: true });
      if (action === 'reject') savePreference(defaults);
      if (action === 'manage') openPreferences();
      if (action === 'close') closePanels();
      if (action === 'save') {
        const modal = document.getElementById('luarCookiePreferences');
        savePreference({ analytics: modal.querySelector('[name="analytics"]').checked, advertising: modal.querySelector('[name="advertising"]').checked, personalization: modal.querySelector('[name="personalization"]').checked });
      }
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.classList.contains('cookie-preferences-open')) closePanels(); });

    document.querySelectorAll('footer nav, .settings-footer nav').forEach(nav => {
      if (nav.querySelector('[data-consent="manage"]')) return;
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.consent = 'manage'; button.className = 'cookie-settings-link'; button.textContent = 'Configurar cookies';
      nav.appendChild(button);
    });
    if (!document.querySelector('footer')) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.consent = 'manage'; button.className = 'cookie-settings-floating'; button.textContent = 'Configurar cookies';
      document.body.appendChild(button);
    }
  }

  window.LuarConsent = Object.freeze({
    allows: category => category === 'necessary' || !!current?.[category],
    choices: () => ({ ...(current || defaults) }),
    hasChoice: () => !!current,
    track,
    open: openPreferences,
    reset: () => { localStorage.removeItem(STORAGE_KEY); current = null; disableOptionalTracking(); location.reload(); }
  });

  if (current) applyConsent(current, false);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderUi, { once: true }); else renderUi();
})();
