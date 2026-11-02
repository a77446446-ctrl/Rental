const { execSync } = require('child_process');
try {
  const out = execSync('"d:\\Рабочий стол D\\GPT Ai\\Projects\\eco-gorniy\\eco-gorniy\\cabin-rental-app\\pocketbase.exe" --version');
  console.log('PocketBase version:', out.toString());
} catch (e) {
  console.error('Error running PB:', e.message);
}
