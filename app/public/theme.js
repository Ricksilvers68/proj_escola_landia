const toggle = document.getElementById('themeToggle');
const html = document.documentElement;

// Carrega tema salvo
const savedTheme = localStorage.getItem('theme') || 'light';
html.setAttribute('data-bs-theme', savedTheme);
toggle.innerText = savedTheme === 'dark' ? 'MODO' : 'MODO';

toggle.addEventListener('click', () => {
  const current = html.getAttribute('data-bs-theme');
  const next = current === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-bs-theme', next);
  localStorage.setItem('theme', next);
  toggle.innerText = next === 'dark' ? 'MODO' : 'MODO';
});