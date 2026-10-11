(() => {
  function show(view) {
    for (const section of document.querySelectorAll('main > section')) section.hidden=section.id!==`view-${view}`;
    for (const button of document.querySelectorAll('.workspace-nav button')) {
      const selected=button.dataset.view===view; button.classList.toggle('active',selected); button.setAttribute('aria-current',selected?'page':'false');
    }
  }
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>show(button.dataset.view));
  $('uploadFilter').onchange=()=>renderItems();
  appReady.then(()=>{ if(!acc.hasApp || !acc.accounts.length) show('accounts'); });
})();
