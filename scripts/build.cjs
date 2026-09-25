const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = ['background.js', 'content.js', 'plan.js', 'popup.html', 'popup.css', 'popup.js'];
for (const [target, manifest] of [['chrome', 'manifest.json'], ['zen', 'manifest.zen.json']]) {
  const folder = path.join(root, 'build', target);
  fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(folder, { recursive: true });
  for (const file of files) fs.copyFileSync(path.join(root, file), path.join(folder, file));
  fs.copyFileSync(path.join(root, manifest), path.join(folder, 'manifest.json'));
  console.log(`Built ${folder}`);
}
