// Patches dist/index.html's viewport meta tag after `expo export -p web`.
// Metro's "single" web output always emits @expo/cli's built-in template, which has no
// viewport-fit=cover -- without it, CSS env(safe-area-inset-bottom) reports 0 on every
// mobile browser (see react-native-safe-area-context's web implementation), so the tab
// bar can't detect the browser's own bottom chrome/gesture bar to sit above it.
// (app/+html.tsx has no effect here -- that customization path only applies when
// app.json's web.output is "static", not "single".)
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const patched = html.replace(
  '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />'
);
if (patched === html) {
  throw new Error("fix-web-viewport: viewport meta tag not found in dist/index.html -- Expo's template may have changed.");
}
fs.writeFileSync(indexPath, patched);
