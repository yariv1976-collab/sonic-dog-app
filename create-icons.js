const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Simple SVG-based icon — green background + dog emoji
function makeSvg(size) {
  const r = Math.round(size * 0.2);
  const fontSize = Math.round(size * 0.58);
  const cy = Math.round(size * 0.52);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#1D9E75"/>
  <text x="50%" y="${cy}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,serif">🐕</text>
</svg>`;
}

const sizes = [96, 192, 512];
sizes.forEach(size => {
  const svgPath = path.join(outDir, `icon-${size}.svg`);
  fs.writeFileSync(svgPath, makeSvg(size));
  console.log(`Created icon-${size}.svg`);
});

console.log('SVG icons created. For PNG conversion, run: npm install sharp && node convert-icons.js');
console.log('Or just use the SVG icons — update manifest.json to use .svg files.');

// Update manifest to use svg
const manifestPath = path.join(__dirname, 'public', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.icons = sizes.map(s => ({
  src: `/icons/icon-${s}.svg`,
  sizes: `${s}x${s}`,
  type: 'image/svg+xml',
  purpose: s >= 192 ? 'any maskable' : 'any'
}));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('manifest.json updated to use SVG icons');
