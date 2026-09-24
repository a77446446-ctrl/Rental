const fs = require('fs');
let js = fs.readFileSync('public/js/admin-mobile.js', 'utf8');

const observerCode = `
// Universal fix for double scrollbars on mobile modals
document.addEventListener('DOMContentLoaded', () => {
  const observer = new MutationObserver((mutations) => {
    let hasOpenModal = false;
    document.querySelectorAll('.modal-overlay').forEach(m => {
      if (m.classList.contains('open') || m.style.display === 'grid' || m.style.display === 'flex' || m.style.display === 'block') {
        hasOpenModal = true;
      }
    });
    
    if (hasOpenModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    observer.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
  });
});
`;

if (!js.includes('Universal fix for double scrollbars')) {
  js += '\n' + observerCode;
  fs.writeFileSync('public/js/admin-mobile.js', js, 'utf8');
  console.log('Added observer to admin-mobile.js!');
} else {
  console.log('Already added!');
}
