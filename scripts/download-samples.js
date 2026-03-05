const fs = require('fs');
const path = require('path');
const defaultData = require('../data/defaultData');

const outDir = path.join(__dirname, '..', 'public', 'uploads', 'samples');
fs.mkdirSync(outDir, { recursive: true });

async function download(url, filePath) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(filePath, data);
}

async function main() {
  let ok = 0;
  for (const dish of defaultData.dishes) {
    for (let i = 1; i <= 2; i += 1) {
      const file = path.join(outDir, `${dish.id}-${i}.jpg`);
      const url = `https://picsum.photos/seed/${encodeURIComponent(dish.id + '-' + i)}/960/720`;
      try {
        await download(url, file);
        ok += 1;
        process.stdout.write(`Downloaded: ${path.basename(file)}\n`);
      } catch (err) {
        process.stdout.write(`Failed: ${path.basename(file)} ${err.message}\n`);
      }
    }
  }
  process.stdout.write(`Done. total files downloaded: ${ok}\n`);
}

main();
