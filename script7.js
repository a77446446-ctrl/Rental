const fs = require('fs');
let js = fs.readFileSync('public/js/admin-cabins.js', 'utf8');

js = js.replace(/editModal\.classList\.add\('open'\);/g, 'editModal.classList.add(\'open\'); document.body.style.overflow = \'hidden\';');
js = js.replace(/editModal\.classList\.remove\('open'\);/g, 'editModal.classList.remove(\'open\'); document.body.style.overflow = \'\';');

if (js.includes('photosModal')) {
  js = js.replace(/photosModal\.classList\.add\('open'\);/g, 'photosModal.classList.add(\'open\'); document.body.style.overflow = \'hidden\';');
  js = js.replace(/photosModal\.classList\.remove\('open'\);/g, 'photosModal.classList.remove(\'open\'); document.body.style.overflow = \'\';');
}

fs.writeFileSync('public/js/admin-cabins.js', js, 'utf8');
console.log('Fixed modals scroll JS!');
