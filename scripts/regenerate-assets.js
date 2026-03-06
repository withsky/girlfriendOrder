const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const defaultDishes = require('../data/defaultDishes');

const root = path.join(__dirname, '..');
const uploadsDir = path.join(root, 'public', 'uploads');
const generatedDir = path.join(uploadsDir, 'generated');
const dbPath = path.join(root, 'data', 'db.json');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmDirSafe(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function palette(name, variant = 0) {
  const h = (hashCode(name) + variant * 37) % 360;
  const h2 = (h + 62) % 360;
  const h3 = (h + 130) % 360;
  return {
    c1: `hsl(${h}, 74%, 72%)`,
    c2: `hsl(${h2}, 65%, 56%)`,
    c3: `hsl(${h3}, 58%, 26%)`
  };
}

function esc(s) {
  return String(s || '').replace(/[<>&"']/g, '');
}

function dishSvg(name, variant = 0) {
  const p = palette(name, variant);
  const n = esc(name);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="960" viewBox="0 0 1280 960">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.c1}"/>
      <stop offset="1" stop-color="${p.c2}"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="960" fill="url(#bg)"/>
  <circle cx="1060" cy="190" r="170" fill="rgba(255,255,255,0.25)"/>
  <circle cx="970" cy="740" r="240" fill="rgba(255,255,255,0.18)"/>
  <rect x="70" y="120" rx="36" ry="36" width="700" height="280" fill="rgba(255,255,255,0.28)"/>
  <text x="110" y="245" font-size="84" font-weight="800" fill="${p.c3}">${n}</text>
  <text x="110" y="332" font-size="42" fill="${p.c3}">宝宝餐厅 · AI 生成菜品图</text>
  <text x="110" y="845" font-size="34" fill="${p.c3}">点击详情可查看原图</text>
</svg>`;
}

function brandSvg(name) {
  const p = palette(name, 9);
  const n = esc(name);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 960 960">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.c1}"/>
      <stop offset="1" stop-color="${p.c2}"/>
    </linearGradient>
  </defs>
  <rect width="960" height="960" rx="120" ry="120" fill="url(#bg)"/>
  <circle cx="760" cy="210" r="150" fill="rgba(255,255,255,0.26)"/>
  <text x="110" y="430" font-size="126" font-weight="800" fill="${p.c3}">${n}</text>
  <text x="110" y="530" font-size="52" fill="${p.c3}">私房点餐</text>
</svg>`;
}

async function writeImagePair(basePath, svg) {
  const orig = `${basePath}__orig.webp`;
  const thumb = `${basePath}__thumb.webp`;
  const buf = Buffer.from(svg, 'utf-8');

  await sharp(buf).webp({ quality: 88 }).toFile(orig);
  await sharp(buf).resize({ width: 420, height: 420, fit: 'cover' }).webp({ quality: 78 }).toFile(thumb);

  return {
    orig: orig.replace(path.join(root, 'public'), '').split(path.sep).join('/'),
    thumb: thumb.replace(path.join(root, 'public'), '').split(path.sep).join('/')
  };
}

async function main() {
  rmDirSafe(uploadsDir);
  ensureDir(generatedDir);

  const dishImages = {};
  for (const dish of defaultDishes) {
    const p1 = await writeImagePair(path.join(generatedDir, `${dish.id}-1`), dishSvg(dish.name, 1));
    const p2 = await writeImagePair(path.join(generatedDir, `${dish.id}-2`), dishSvg(dish.name, 2));
    dishImages[dish.id] = [p1.orig, p2.orig];
  }

  const brand = await writeImagePair(path.join(generatedDir, 'brand-baby-restaurant'), brandSvg('宝宝餐厅'));

  const defaultDataPath = path.join(root, 'data', 'defaultData.js');
  let defaultDataText = fs.readFileSync(defaultDataPath, 'utf-8');
  defaultDataText = defaultDataText
    .replace(
      /function buildDishImages\(id\) \{[\s\S]*?\n\}/,
      "function buildDishImages(id) {\n  return [`/uploads/generated/${id}-1__orig.webp`, `/uploads/generated/${id}-2__orig.webp`];\n}"
    )
    .replace(
      /title:\s*'[^']*'/,
      "title: '宝宝餐厅'"
    )
    .replace(
      /image:\s*'[^']*'/,
      "image: '/uploads/generated/brand-baby-restaurant__orig.webp'"
    );
  fs.writeFileSync(defaultDataPath, defaultDataText, 'utf-8');

  if (fs.existsSync(dbPath)) {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    if (Array.isArray(db.dishes)) {
      db.dishes = db.dishes.map((d) => {
        const imgs = dishImages[d.id] || [];
        return {
          ...d,
          images: imgs,
          image: imgs[0] || ''
        };
      });
    }
    db.settings = db.settings || {};
    db.settings.brand = db.settings.brand || {};
    db.settings.brand.title = '宝宝餐厅';
    db.settings.brand.image = '/uploads/generated/brand-baby-restaurant__orig.webp';
    if (!db.settings.brand.subtitle) {
      db.settings.brand.subtitle = '唯有爱与美食不可辜负';
    }
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
  }

  console.log('Generated dish images:', Object.keys(dishImages).length * 2);
  console.log('Generated brand image:', brand.orig);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
