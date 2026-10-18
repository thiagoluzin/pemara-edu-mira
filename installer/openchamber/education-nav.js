document.querySelectorAll('[data-area]').forEach(button => button.addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.textContent = 'Abrindo…';
  try {
    await window.pemaraNavigation.open(button.dataset.area);
    if (button.dataset.area !== 'exports') document.querySelectorAll('[data-area]').forEach(item => item.setAttribute('aria-current', String(item === button)));
    status.textContent = 'Aulas com IA pelo OpenCode. Apresentações offline.';
  } catch { status.textContent = 'Não foi possível abrir. Feche e abra o programa para tentar novamente. Seus dados foram preservados.'; }
}));
