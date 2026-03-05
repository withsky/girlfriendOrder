const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const defaultData = require('./data/defaultData');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const SPICE_LEVELS = ['不辣', '微辣', '中辣', '特辣'];
const ORDER_STATUSES = ['pending', 'cooking', 'ready', 'served', 'cancelled'];

app.use(express.json({ limit: '4mb' }));
app.use(express.static(PUBLIC_DIR));

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const imageStorage = multer.diskStorage({
  destination: (_, __, cb) => {
    const folder = path.join(UPLOAD_DIR, new Date().toISOString().slice(0, 10));
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`);
  }
});

const uploadImages = multer({
  storage: imageStorage,
  limits: { fileSize: 35 * 1024 * 1024, files: 20 }
});

const uploadDb = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 1 }
});

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeStringList(input) {
  if (!Array.isArray(input)) return [];
  return input.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeImages(input, fallback = []) {
  let source = [];
  if (Array.isArray(input)) {
    source = input;
  } else if (typeof input === 'string') {
    source = [input];
  } else {
    source = fallback;
  }

  const clean = source.map((item) => String(item || '').trim()).filter(Boolean);
  return [...new Set(clean)].slice(0, 12);
}

function normalizeCategoryOrder(categories) {
  categories
    .sort((a, b) => (a.manualOrder || 0) - (b.manualOrder || 0))
    .forEach((item, index) => {
      item.manualOrder = index + 1;
    });
}

function normalizeDishOrder(dishes) {
  dishes
    .sort((a, b) => (a.manualOrder || 0) - (b.manualOrder || 0))
    .forEach((item, index) => {
      item.manualOrder = index + 1;
    });
}

function recomputeDishOrderCount(db) {
  const counter = new Map();
  (db.orders || []).forEach((order) => {
    (order.items || []).forEach((item) => {
      const qty = Number.isFinite(item.qty) ? Math.max(0, Math.floor(item.qty)) : 0;
      counter.set(item.dishId, (counter.get(item.dishId) || 0) + qty);
    });
  });
  (db.dishes || []).forEach((dish) => {
    dish.orderCount = counter.get(dish.id) || 0;
  });
}

function migrateDb(raw) {
  const db = raw && typeof raw === 'object' ? raw : {};
  const fallbackById = new Map(defaultData.dishes.map((d) => [d.id, d]));

  const categories = Array.isArray(db.categories) && db.categories.length
    ? db.categories
    : defaultData.categories;

  const dishes = Array.isArray(db.dishes)
    ? db.dishes.map((dish) => {
      const fallback = fallbackById.get(dish.id) || {};
      const images = normalizeImages(dish.images, normalizeImages(dish.image, fallback.images || []));
      return {
        id: dish.id || createId('dish'),
        name: dish.name || fallback.name || '未命名菜品',
        categoryId: dish.categoryId || fallback.categoryId || categories[0].id,
        image: images[0] || '',
        images,
        spiceLevel: SPICE_LEVELS.includes(dish.spiceLevel) ? dish.spiceLevel : (fallback.spiceLevel || '微辣'),
        estimateMinutes: Number.isFinite(dish.estimateMinutes) ? Math.max(1, Math.floor(dish.estimateMinutes)) : (fallback.estimateMinutes || 15),
        orderCount: Number.isFinite(dish.orderCount) ? Math.max(0, Math.floor(dish.orderCount)) : 0,
        manualOrder: Number.isFinite(dish.manualOrder) ? dish.manualOrder : (fallback.manualOrder || 1),
        description: dish.description || fallback.description || '',
        ingredients: normalizeStringList(Array.isArray(dish.ingredients) && dish.ingredients.length ? dish.ingredients : fallback.ingredients || []),
        seasonings: normalizeStringList(Array.isArray(dish.seasonings) && dish.seasonings.length ? dish.seasonings : fallback.seasonings || []),
        steps: normalizeStringList(Array.isArray(dish.steps) && dish.steps.length ? dish.steps : fallback.steps || []),
        updatedAt: dish.updatedAt || nowIso()
      };
    })
    : defaultData.dishes.map((dish) => ({ ...dish, images: normalizeImages(dish.images, dish.image), image: normalizeImages(dish.images, dish.image)[0] || '' }));

  const settings = {
    kitchenSortMode: ['manual', 'name', 'count'].includes(db.settings && db.settings.kitchenSortMode)
      ? db.settings.kitchenSortMode
      : defaultData.settings.kitchenSortMode,
    brand: {
      title: String((db.settings && db.settings.brand && db.settings.brand.title) || defaultData.settings.brand.title || '宝宝餐厅').trim(),
      subtitle: String((db.settings && db.settings.brand && db.settings.brand.subtitle) || defaultData.settings.brand.subtitle || '').trim(),
      image: String((db.settings && db.settings.brand && db.settings.brand.image) || defaultData.settings.brand.image || '').trim()
    },
    updatedAt: nowIso()
  };

  const orders = Array.isArray(db.orders)
    ? db.orders.map((order) => ({
      id: order.id || createId('order'),
      status: ORDER_STATUSES.includes(order.status) ? order.status : 'pending',
      note: order.note || '',
      createdAt: order.createdAt || nowIso(),
      updatedAt: order.updatedAt || nowIso(),
      items: Array.isArray(order.items) ? order.items : [],
      kitchenPlan: order.kitchenPlan && typeof order.kitchenPlan === 'object' ? order.kitchenPlan : null
    }))
    : [];

  normalizeCategoryOrder(categories);
  normalizeDishOrder(dishes);

  const categorySet = new Set(categories.map((c) => c.id));
  dishes.forEach((dish) => {
    if (!categorySet.has(dish.categoryId)) {
      dish.categoryId = categories[0] ? categories[0].id : 'meat';
    }
    dish.images = normalizeImages(dish.images, dish.image);
    dish.image = dish.images[0] || '';
  });

  const tempDb = { categories, dishes, orders, settings };
  recomputeDishOrderCount(tempDb);

  return tempDb;
}

function ensureDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    return;
  }
  const current = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  const migrated = migrateDb(current);
  fs.writeFileSync(DB_FILE, JSON.stringify(migrated, null, 2), 'utf-8');
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDb(db) {
  db.settings.updatedAt = nowIso();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function sortedCategories(categories) {
  return [...categories].sort((a, b) => a.manualOrder - b.manualOrder);
}

function sortedDishes(dishes, mode) {
  const list = [...dishes];
  if (mode === 'name') {
    return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }
  if (mode === 'count') {
    return list.sort((a, b) => b.orderCount - a.orderCount || a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }
  return list.sort((a, b) => a.manualOrder - b.manualOrder);
}

function placeholderSvg(title) {
  const safe = String(title || '菜品').replace(/[<>&"']/g, '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffd8a8"/>
      <stop offset="1" stop-color="#d6f5d6"/>
    </linearGradient>
  </defs>
  <rect width="480" height="320" fill="url(#bg)"/>
  <text x="40" y="130" font-size="38" font-weight="700" fill="#23303a">${safe}</text>
  <text x="40" y="180" font-size="22" fill="#42525c">家庭私房菜</text>
</svg>`;
}

function sanitizeDish(dish) {
  return {
    ...dish,
    images: normalizeImages(dish.images, dish.image),
    image: normalizeImages(dish.images, dish.image)[0] || ''
  };
}

function parseDeepseekJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('AI 返回为空');
  const direct = tryParse(raw);
  if (direct) return direct;
  const block = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (block && tryParse(block[1])) return tryParse(block[1]);
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const sliced = raw.slice(start, end + 1);
    if (tryParse(sliced)) return tryParse(sliced);
  }
  throw new Error('AI 返回不是合法 JSON');
}

function tryParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function buildDeepseekPrompt(input) {
  return `你是一位专业中餐家常菜顾问。请根据菜名补全菜品信息，只输出 JSON，不要输出 markdown。

要求：
1) 语言使用简体中文。
2) 输出字段必须完整：description, estimateMinutes, spiceLevel, ingredients, seasonings, steps。
3) description: 1-2 句，口语化，适合点餐页展示。
4) estimateMinutes: 整数，范围 5-120。
5) spiceLevel: 只能是不辣/微辣/中辣/特辣。
6) ingredients: 3-8 条，每条包含食材和大概用量。
7) seasonings: 3-8 条，每条包含调料和大概用量。
8) steps: 3-8 条，每条一句话，步骤清晰。
9) 如果菜名信息不足，按常见家常做法合理补全。

输入：
- 菜名: ${input.name}
- 当前辣度(可参考): ${input.spiceLevel || '微辣'}
- 分类(可参考): ${input.categoryName || '未提供'}

只返回 JSON，示例结构：
{"description":"...","estimateMinutes":15,"spiceLevel":"微辣","ingredients":["..."],"seasonings":["..."],"steps":["..."]}`;
}

function buildOrderOptimizePrompt(input) {
  return `你是一位家庭厨房出餐优化专家。目标是在保证可执行和安全的前提下，给出“最快备餐出餐流程”。

请基于订单信息输出 JSON（不要 markdown）：
1) 输出字段必须完整：summary, totalMinutes, timeline, tips。
2) totalMinutes: 整数，表示整单预计完成分钟数。
3) timeline: 数组，按时间先后排序。每个节点结构：
   - minute: 整数，表示从第0分钟开始的时间点
   - phase: 阶段名（如“预处理”“并行烹饪”“收尾出餐”）
   - actions: 字符串数组，列出该时间点要做的动作，动作尽量细（洗/切/腌/焯/炒/蒸/装盘）
   - parallel: 字符串数组，可选，写出“可并行做”的动作
4) tips: 字符串数组，给出 3-8 条提速建议（例如炉灶分配、锅具切换、先后顺序）。
5) 强调并行思路：烧水时切菜、蒸煮时备下一道、等待收汁时处理配菜。
6) 所有内容使用简体中文，步骤可执行，不要空话。

订单信息：
${input.items.map((it, idx) => `${idx + 1}. ${it.name} x${it.qty}（辣度:${it.spiceLevel}，单道参考时长:${it.estimateMinutes}分钟）`).join('\n')}
订单备注：${input.note || '无'}

只返回 JSON，示例结构：
{"summary":"...","totalMinutes":35,"timeline":[{"minute":0,"phase":"预处理","actions":["..."],"parallel":["..."]}],"tips":["..."]}`;
}

function sanitizeKitchenPlan(parsed) {
  const timelineRaw = Array.isArray(parsed.timeline) ? parsed.timeline : [];
  const timeline = timelineRaw.map((item) => ({
    minute: Math.max(0, Math.floor(Number(item.minute) || 0)),
    phase: String(item.phase || '流程').trim() || '流程',
    actions: normalizeStringList(item.actions),
    parallel: normalizeStringList(item.parallel)
  })).sort((a, b) => a.minute - b.minute);

  return {
    summary: String(parsed.summary || '').trim(),
    totalMinutes: Math.max(1, Math.min(300, Math.floor(Number(parsed.totalMinutes) || 30))),
    timeline,
    tips: normalizeStringList(parsed.tips)
  };
}

async function callDeepseekWithPrompt(prompt) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY');
  }

  const endpoint = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1/chat/completions';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你输出必须是可解析 JSON。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek 调用失败: ${errText.slice(0, 180)}`);
  }

  const data = await response.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return parseDeepseekJson(content);
}

app.get('/api/bootstrap', (req, res) => {
  const db = readDb();
  const mode = req.query.sortMode || db.settings.kitchenSortMode || 'manual';
  const categoryId = req.query.categoryId || '';
  const dishes = sortedDishes(db.dishes, mode).filter((dish) => !categoryId || dish.categoryId === categoryId).map(sanitizeDish);

  res.json({
    categories: sortedCategories(db.categories),
    dishes,
    settings: db.settings,
    spiceLevels: SPICE_LEVELS,
    orderStatuses: ORDER_STATUSES,
    aiEnabled: Boolean(process.env.DEEPSEEK_API_KEY)
  });
});

app.post('/api/uploads', uploadImages.array('images', 20), async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return res.status(400).json({ message: '未上传文件' });
  }

  try {
    const results = [];
    for (const file of files) {
      const dir = path.dirname(file.path);
      const ext = path.extname(file.path).toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.avif', '.heic', '.heif'].includes(ext);
      if (!isImage) {
        fs.unlink(file.path, () => {});
        continue;
      }

      const baseName = path.basename(file.path, ext);
      const originalPath = path.join(dir, `${baseName}__orig.webp`);
      const thumbPath = path.join(dir, `${baseName}__thumb.webp`);

      await sharp(file.path)
        .rotate()
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 86 })
        .toFile(originalPath);

      await sharp(file.path)
        .rotate()
        .resize({ width: 420, height: 420, fit: 'cover' })
        .webp({ quality: 78 })
        .toFile(thumbPath);

      fs.unlink(file.path, () => {});

      const relativeOriginal = path.relative(PUBLIC_DIR, originalPath).split(path.sep).join('/');
      results.push(`/${relativeOriginal}`);
    }

    if (!results.length) {
      return res.status(400).json({ message: '未检测到可处理的图片格式' });
    }
    return res.json({ urls: results });
  } catch (error) {
    return res.status(400).json({ message: `图片处理失败: ${error.message}` });
  }
});

app.get('/api/admin/export-db', (req, res) => {
  ensureDb();
  const fileName = `girlfriend-order-db-${new Date().toISOString().slice(0, 10)}.json`;
  res.download(DB_FILE, fileName);
});

app.post('/api/admin/import-db', uploadDb.single('db'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '未上传 db.json 文件' });

  try {
    const text = req.file.buffer.toString('utf-8');
    const raw = JSON.parse(text);
    const migrated = migrateDb(raw);
    writeDb(migrated);
    return res.json({
      ok: true,
      dishes: migrated.dishes.length,
      categories: migrated.categories.length,
      orders: migrated.orders.length
    });
  } catch (error) {
    return res.status(400).json({ message: `导入失败: ${error.message}` });
  }
});

app.post('/api/ai/fill-dish', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ message: '请先输入菜名' });
  }

  const prompt = buildDeepseekPrompt({
    name,
    spiceLevel: String(req.body.spiceLevel || '').trim(),
    categoryName: String(req.body.categoryName || '').trim()
  });

  try {
    const parsed = await callDeepseekWithPrompt(prompt);

    const payload = {
      description: String(parsed.description || '').trim(),
      estimateMinutes: Math.max(5, Math.min(120, Number(parsed.estimateMinutes) || 15)),
      spiceLevel: SPICE_LEVELS.includes(parsed.spiceLevel) ? parsed.spiceLevel : '微辣',
      ingredients: normalizeStringList(parsed.ingredients),
      seasonings: normalizeStringList(parsed.seasonings),
      steps: normalizeStringList(parsed.steps)
    };

    return res.json({
      prompt,
      data: payload
    });
  } catch (error) {
    const msg = String(error.message || '调用失败');
    const status = msg.includes('未配置 DEEPSEEK_API_KEY') ? 400 : 500;
    return res.status(status).json({ message: msg });
  }
});

app.get('/api/categories', (_, res) => {
  const db = readDb();
  res.json(sortedCategories(db.categories));
});

app.post('/api/categories', (req, res) => {
  const db = readDb();
  const name = String(req.body.name || '').trim();
  const icon = String(req.body.icon || '🍽️').trim() || '🍽️';
  if (!name) return res.status(400).json({ message: '分类名称不能为空' });

  const category = { id: createId('cat'), name, icon, manualOrder: db.categories.length + 1 };
  db.categories.push(category);
  normalizeCategoryOrder(db.categories);
  writeDb(db);
  return res.json(category);
});

app.patch('/api/categories/:id', (req, res) => {
  const db = readDb();
  const category = db.categories.find((item) => item.id === req.params.id);
  if (!category) return res.status(404).json({ message: '分类不存在' });

  if (typeof req.body.name === 'string' && req.body.name.trim()) category.name = req.body.name.trim();
  if (typeof req.body.icon === 'string' && req.body.icon.trim()) category.icon = req.body.icon.trim();

  writeDb(db);
  return res.json(category);
});

app.delete('/api/categories/:id', (req, res) => {
  const db = readDb();
  const targetId = req.params.id;
  if (db.categories.length <= 1) return res.status(400).json({ message: '至少保留一个分类' });
  if (db.dishes.some((dish) => dish.categoryId === targetId)) return res.status(400).json({ message: '该分类下还有菜品，无法删除' });

  db.categories = db.categories.filter((item) => item.id !== targetId);
  normalizeCategoryOrder(db.categories);
  writeDb(db);
  return res.json({ ok: true });
});

app.post('/api/categories/reorder', (req, res) => {
  const db = readDb();
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length !== db.categories.length) return res.status(400).json({ message: '分类拖拽数据无效' });
  if (new Set(ids).size !== db.categories.length) return res.status(400).json({ message: '分类拖拽数据重复' });

  ids.forEach((id, index) => {
    const cat = db.categories.find((item) => item.id === id);
    if (cat) cat.manualOrder = index + 1;
  });
  normalizeCategoryOrder(db.categories);
  writeDb(db);
  return res.json(sortedCategories(db.categories));
});

app.get('/api/dishes', (req, res) => {
  const db = readDb();
  const sortMode = req.query.sortMode || db.settings.kitchenSortMode || 'manual';
  const categoryId = req.query.categoryId || '';
  const keyword = String(req.query.keyword || '').trim();

  let result = sortedDishes(db.dishes, sortMode);
  if (categoryId) result = result.filter((dish) => dish.categoryId === categoryId);
  if (keyword) result = result.filter((dish) => dish.name.includes(keyword) || dish.description.includes(keyword));

  res.json({ sortMode, dishes: result.map(sanitizeDish) });
});

app.get('/api/dishes/:id', (req, res) => {
  const db = readDb();
  const dish = db.dishes.find((item) => item.id === req.params.id);
  if (!dish) return res.status(404).json({ message: '菜品不存在' });
  return res.json(sanitizeDish(dish));
});

app.get('/api/dishes/:id/placeholder.svg', (req, res) => {
  const db = readDb();
  const dish = db.dishes.find((item) => item.id === req.params.id);
  res.type('image/svg+xml').send(placeholderSvg(dish ? dish.name : '菜品图片'));
});

app.post('/api/dishes', (req, res) => {
  const db = readDb();
  const categoryId = req.body.categoryId || (db.categories[0] && db.categories[0].id);
  if (!categoryId || !db.categories.find((c) => c.id === categoryId)) return res.status(400).json({ message: '分类无效' });

  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: '菜名不能为空' });

  const images = normalizeImages(req.body.images, req.body.image);
  const dish = {
    id: createId('dish'),
    name,
    categoryId,
    image: images[0] || '',
    images,
    spiceLevel: SPICE_LEVELS.includes(req.body.spiceLevel) ? req.body.spiceLevel : '微辣',
    estimateMinutes: Number.isFinite(req.body.estimateMinutes) ? Math.max(1, Math.floor(req.body.estimateMinutes)) : 15,
    orderCount: Number.isFinite(req.body.orderCount) ? Math.max(0, Math.floor(req.body.orderCount)) : 0,
    manualOrder: db.dishes.length + 1,
    description: String(req.body.description || '').trim(),
    ingredients: normalizeStringList(req.body.ingredients),
    seasonings: normalizeStringList(req.body.seasonings),
    steps: normalizeStringList(req.body.steps),
    updatedAt: nowIso()
  };

  db.dishes.push(dish);
  normalizeDishOrder(db.dishes);
  writeDb(db);
  return res.json(sanitizeDish(dish));
});

app.patch('/api/dishes/:id', (req, res) => {
  const db = readDb();
  const dish = db.dishes.find((item) => item.id === req.params.id);
  if (!dish) return res.status(404).json({ message: '菜品不存在' });

  if (typeof req.body.name === 'string' && req.body.name.trim()) dish.name = req.body.name.trim();
  if (typeof req.body.categoryId === 'string' && db.categories.find((c) => c.id === req.body.categoryId)) dish.categoryId = req.body.categoryId;
  if (typeof req.body.image === 'string' || Array.isArray(req.body.images)) {
    dish.images = normalizeImages(req.body.images, req.body.image || dish.images || dish.image);
    dish.image = dish.images[0] || '';
  }
  if (SPICE_LEVELS.includes(req.body.spiceLevel)) dish.spiceLevel = req.body.spiceLevel;
  if (Number.isFinite(req.body.estimateMinutes)) dish.estimateMinutes = Math.max(1, Math.floor(req.body.estimateMinutes));
  if (Number.isFinite(req.body.orderCount)) dish.orderCount = Math.max(0, Math.floor(req.body.orderCount));
  if (typeof req.body.description === 'string') dish.description = req.body.description;
  if (Array.isArray(req.body.ingredients)) dish.ingredients = normalizeStringList(req.body.ingredients);
  if (Array.isArray(req.body.seasonings)) dish.seasonings = normalizeStringList(req.body.seasonings);
  if (Array.isArray(req.body.steps)) dish.steps = normalizeStringList(req.body.steps);

  dish.updatedAt = nowIso();
  writeDb(db);
  return res.json(sanitizeDish(dish));
});

app.delete('/api/dishes/:id', (req, res) => {
  const db = readDb();
  const before = db.dishes.length;
  db.dishes = db.dishes.filter((item) => item.id !== req.params.id);
  if (db.dishes.length === before) return res.status(404).json({ message: '菜品不存在' });
  normalizeDishOrder(db.dishes);
  writeDb(db);
  return res.json({ ok: true });
});

app.post('/api/dishes/reorder', (req, res) => {
  const db = readDb();
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length !== db.dishes.length) return res.status(400).json({ message: '菜品排序数据无效' });
  if (new Set(ids).size !== db.dishes.length) return res.status(400).json({ message: '菜品排序数据重复' });

  ids.forEach((id, index) => {
    const dish = db.dishes.find((item) => item.id === id);
    if (dish) dish.manualOrder = index + 1;
  });

  normalizeDishOrder(db.dishes);
  db.settings.kitchenSortMode = 'manual';
  writeDb(db);
  return res.json(sortedDishes(db.dishes, 'manual').map(sanitizeDish));
});

app.post('/api/settings/sort-mode', (req, res) => {
  const db = readDb();
  const mode = req.body.mode;
  if (!['manual', 'name', 'count'].includes(mode)) return res.status(400).json({ message: '排序模式无效' });
  db.settings.kitchenSortMode = mode;
  writeDb(db);
  return res.json({ kitchenSortMode: mode });
});

app.patch('/api/settings/brand', (req, res) => {
  const db = readDb();
  if (!db.settings.brand || typeof db.settings.brand !== 'object') {
    db.settings.brand = { title: '宝宝餐厅', subtitle: '', image: '' };
  }

  if (typeof req.body.title === 'string' && req.body.title.trim()) {
    db.settings.brand.title = req.body.title.trim();
  }
  if (typeof req.body.subtitle === 'string') {
    db.settings.brand.subtitle = req.body.subtitle.trim();
  }
  if (typeof req.body.image === 'string') {
    db.settings.brand.image = req.body.image.trim();
  }

  writeDb(db);
  return res.json(db.settings.brand);
});

app.get('/api/orders', (_, res) => {
  const db = readDb();
  const list = [...db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

app.post('/api/orders', (req, res) => {
  const db = readDb();
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const note = String(req.body.note || '').trim();
  if (!items.length) return res.status(400).json({ message: '菜单为空，无法下单' });

  const normalizedItems = [];
  for (const item of items) {
    const dish = db.dishes.find((d) => d.id === item.dishId);
    if (!dish) continue;
    const qty = Number.isFinite(item.qty) ? Math.max(1, Math.floor(item.qty)) : 1;
    const spiceLevel = SPICE_LEVELS.includes(item.spiceLevel) ? item.spiceLevel : dish.spiceLevel;
    normalizedItems.push({
      dishId: dish.id,
      name: dish.name,
      qty,
      spiceLevel,
      estimateMinutes: dish.estimateMinutes,
      image: (dish.images && dish.images[0]) || dish.image || ''
    });
  }

  if (!normalizedItems.length) return res.status(400).json({ message: '有效菜品为空，无法下单' });

  const order = {
    id: createId('order'),
    status: 'pending',
    note,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    items: normalizedItems,
    kitchenPlan: null
  };

  db.orders.push(order);
  recomputeDishOrderCount(db);
  writeDb(db);
  return res.json(order);
});

app.patch('/api/orders/:id', (req, res) => {
  const db = readDb();
  const order = db.orders.find((item) => item.id === req.params.id);
  if (!order) return res.status(404).json({ message: '订单不存在' });

  if (typeof req.body.status === 'string' && ORDER_STATUSES.includes(req.body.status)) order.status = req.body.status;
  if (typeof req.body.note === 'string') order.note = req.body.note;
  order.updatedAt = nowIso();
  writeDb(db);
  return res.json(order);
});

app.delete('/api/orders/:id', (req, res) => {
  const db = readDb();
  const before = db.orders.length;
  db.orders = db.orders.filter((item) => item.id !== req.params.id);
  if (db.orders.length === before) return res.status(404).json({ message: '订单不存在' });
  recomputeDishOrderCount(db);
  writeDb(db);
  return res.json({ ok: true });
});

app.post('/api/orders/:id/optimize', async (req, res) => {
  const db = readDb();
  const order = db.orders.find((item) => item.id === req.params.id);
  if (!order) return res.status(404).json({ message: '订单不存在' });
  if (!Array.isArray(order.items) || !order.items.length) return res.status(400).json({ message: '订单没有菜品，无法优化' });

  const prompt = buildOrderOptimizePrompt({
    items: order.items,
    note: order.note || ''
  });

  try {
    const parsed = await callDeepseekWithPrompt(prompt);
    const plan = sanitizeKitchenPlan(parsed);
    order.kitchenPlan = {
      ...plan,
      generatedAt: nowIso(),
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      prompt
    };
    order.updatedAt = nowIso();
    writeDb(db);
    return res.json(order.kitchenPlan);
  } catch (error) {
    const msg = String(error.message || '调用失败');
    const status = msg.includes('未配置 DEEPSEEK_API_KEY') ? 400 : 500;
    return res.status(status).json({ message: msg });
  }
});

app.get('/api/health', (_, res) => {
  res.json({ ok: true, ts: nowIso() });
});

app.listen(PORT, () => {
  ensureDb();
  console.log(`Girlfriend order app running on http://0.0.0.0:${PORT}`);
});
