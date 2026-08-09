(() => {
  let installPrompt = null;
  if (location.pathname === '/instalar') {
    const actions = document.querySelector('.hero-actions');
    if (actions && !actions.querySelector('[data-install-luar]')) actions.insertAdjacentHTML('afterbegin', '<button class="nav-cta" type="button" data-install-luar hidden>Instalar o LUAR agora</button>');
  }
  const emit = (event, details = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...details });
  };
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    document.querySelectorAll('[data-install-luar]').forEach(button => button.hidden = false);
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-install-luar]');
    if (!button || !installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    emit('pwa_install_prompt_result', { outcome: choice.outcome });
    installPrompt = null;
    button.hidden = true;
  });
  window.addEventListener('appinstalled', () => emit('pwa_install'));
})();
