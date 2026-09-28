import fs from 'node:fs';
import path from 'node:path';
const publicDir = path.resolve('public');
for (const file of ['index.html', 'app.js', 'style.css']) {
  if (!fs.existsSync(path.join(publicDir, file))) throw new Error(`Missing public/${file}`);
}
console.log('Netlify static site ready:', publicDir);
