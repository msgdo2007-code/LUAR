(() => {
  const params = new URLSearchParams(location.search), attribution = {};
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(key => { const value = params.get(key); if (value) attribution[key] = value.slice(0,120); });
  const persistAttribution = () => {
    if (!Object.keys(attribution).length || (!window.LuarConsent?.allows('analytics') && !window.LuarConsent?.allows('advertising'))) return;
    localStorage.setItem('luar-attribution', JSON.stringify({ ...attribution, landingPage: location.pathname, capturedAt: new Date().toISOString() }));
  };
  persistAttribution();
  window.addEventListener('luar:consentchange', persistAttribution);
  window.dataLayer = window.dataLayer || [];
  const emit = (event, details = {}) => {
    if (!window.LuarConsent?.allows('analytics') && !window.LuarConsent?.allows('advertising')) return false;
    return window.LuarConsent.track(event, { ...attribution, ...details });
  };
  emit('landing_page_view');
  document.addEventListener('click', event => { if (event.target.closest('[data-auth-open="signup"],a[href*="#signup"]')) emit('create_account_click'); if (event.target.closest('[data-upgrade],a[href="/precos"],a[href="#vitalicio"]')) emit('plan_view_click'); });
  const plan = document.querySelector('#vitalicio');
  if (plan && 'IntersectionObserver' in window) { const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { emit('plan_view'); observer.disconnect(); } }, { threshold: .35 }); observer.observe(plan); }
  window.LuarTracking = { emit, attribution: () => ({ ...attribution }), config: () => ({ ...(window.LUAR_TRACKING_CONFIG || {}) }) };
})();
