(() => {
  'use strict';

  const button = document.getElementById('fullscreenBtn');
  const hint = document.getElementById('fullscreenHint');
  let dismissTimer;

  function resetHint() {
    clearTimeout(dismissTimer);
    hint.textContent = '';
  }

  function sync() {
    const active = Boolean(document.fullscreenElement);
    button.setAttribute('aria-pressed', String(active));
    const label = active ? '退出全屏' : '进入全屏';
    button.setAttribute('aria-label', label);
    button.title = label;
    resetHint();
  }

  function showShortcut() {
    resetHint();
    hint.textContent = '可通过浏览器菜单进入全屏。';
    dismissTimer = setTimeout(resetHint, 4500);
  }

  button.addEventListener('click', async () => {
    resetHint();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled) await document.documentElement.requestFullscreen();
      else showShortcut();
    } catch {
      showShortcut();
    }
  });

  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !document.fullscreenElement) return;
    if (document.querySelector('dialog[open]') || !document.getElementById('modal').hidden) return;
    // Browsers which forward the native exit key should not also toggle game pause.
    event.preventDefault();
    event.stopImmediatePropagation();
    document.exitFullscreen().catch(showShortcut);
  }, true);
  sync();
})();
