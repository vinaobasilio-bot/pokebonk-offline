document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-pick],[data-surv]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  parent.postMessage({
    type: 'yugibonk-offline-select',
    mode: button.hasAttribute('data-surv') ? 'endless' : 'standard',
  }, location.origin);
}, true);
