let navigationRequest = 0;
document.querySelectorAll('[data-area]').forEach(button => button.addEventListener('click', async () => {
  const request = ++navigationRequest;
  const status = document.getElementById('status');
  status.textContent = 'Abrindo…';
  try {
    await window.pemaraNavigation.open(button.dataset.area);
    if (request !== navigationRequest) return;
    if (button.dataset.area !== 'exports') document.querySelectorAll('[data-area]').forEach(item => item.setAttribute('aria-current', String(item === button)));
    status.textContent = 'Aulas com IA pelo OpenCode. Apresentações offline.';
  } catch { if (request === navigationRequest) status.textContent = 'Não foi possível abrir. Clique novamente para tentar. Seus dados foram preservados.'; }
}));
