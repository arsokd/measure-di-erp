import fs from 'fs';
import path from 'path';

try {
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  if (!fs.existsSync('dist/js')) {
    fs.mkdirSync('dist/js', { recursive: true });
  }
  if (fs.existsSync('js')) {
    fs.cpSync('js', 'dist/js', { recursive: true });
    console.log('[build] Copied js/ -> dist/js/');
  }
  const rootFiles = ['auth-guard.js', '_redirects', 'firebase-applet-config.json'];
  for (const f of rootFiles) {
    if (fs.existsSync(f)) {
      fs.copyFileSync(f, path.join('dist', f));
      console.log(`[build] Copied ${f} -> dist/${f}`);
    }
  }
  console.log('[build] Static assets prepared successfully.');
} catch (err) {
  console.warn('[build] Warning during asset copying:', err.message);
}
