const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const adminDir = path.join(publicDir, 'admin');

// 1. Копируем supabase
const supabaseSrc = path.join(projectRoot, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const supabaseDest = path.join(publicDir, 'js', 'supabase.js');

if (fs.existsSync(supabaseSrc)) {
    fs.copyFileSync(supabaseSrc, supabaseDest);
    console.log('supabase.js скопирован локально.');
} else {
    console.error('Не найден supabase.js в node_modules!');
}

// 2. Функция замены
function replaceInFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    const supabaseRegex = /https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2/g;
    if (supabaseRegex.test(content)) {
        content = content.replace(supabaseRegex, '/js/supabase.js');
        changed = true;
    }

    const lucideRegex = /https:\/\/unpkg\.com\/lucide@latest/g;
    if (lucideRegex.test(content)) {
        content = content.replace(lucideRegex, '/js/lucide.min.js');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log('Изменен файл:', filePath);
    }
}

// 3. Проходимся по всем HTML в public
fs.readdirSync(publicDir).forEach(file => {
    if (file.endsWith('.html')) {
        replaceInFile(path.join(publicDir, file));
    }
});

// 4. Проходимся по всем HTML в public/admin
if (fs.existsSync(adminDir)) {
    fs.readdirSync(adminDir).forEach(file => {
        if (file.endsWith('.html')) {
            replaceInFile(path.join(adminDir, file));
        }
    });
}

console.log('Замена CDN завершена.');
