document.addEventListener('DOMContentLoaded', () => {
  const html = document.documentElement;
  const toggle = document.getElementById('themeToggle');

  // Lê preferência salva
  const savedTheme = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-bs-theme', savedTheme);

  // Atualiza estado do botão, se existir na página
  if (toggle) {
    toggle.checked = savedTheme === 'dark';

    toggle.addEventListener('change', () => {
      const next = toggle.checked ? 'dark' : 'light';
      html.setAttribute('data-bs-theme', next);
      localStorage.setItem('theme', next);
    });
  }
});