const { execSync } = require('child_process');

try {
  console.log('Adding files...');
  execSync('git add -A', { stdio: 'inherit' });
  console.log('Committing...');
  execSync('git commit -m "fix(theme): overhaul light theme with high contrast and adapt cabin page"', { stdio: 'inherit' });
  console.log('Pushing to origin main...');
  execSync('git push origin main', { stdio: 'inherit' });
  console.log('Done!');
} catch (e) {
  console.error('Git error:', e.message);
  process.exit(1);
}
