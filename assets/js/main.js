// ============ Mobile Menu ============
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('open');
}

// ============ Active nav link ============
document.addEventListener('DOMContentLoaded', function () {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === path || 
        (path.includes('/blog') && a.getAttribute('href') && a.getAttribute('href').includes('/blog'))) {
      a.classList.add('active');
    }
  });
});
