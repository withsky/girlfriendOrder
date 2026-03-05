const express = require('express');
const fs = require('fs');
const path = require('path');
const defaultData = require('./data/defaultData');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const SPICE_LEVELS = ['不辣', '微辣', '中辣', '特辣'];

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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

function migrateDb(raw) {
  const db = raw && typeof raw === 'object' ? raw : {};
  const fallbackById = new Map(defaultData.dishes.map((d) => [d.id, d]));

  const categories = Array.isArray(db.categories) && db.categories.length
    ? db.categories
    : defaultData.categories;

  const dishes = Array.isArray(db.dishes)
    ? db.dishes.map((dish) => {
      const fallback = fallbackById.get(dish.id) || {};
      return {
        id: dish.id || createId('dish'),
        name: dish.name || fallback.name || '未命名菜品',
        categoryId: dish.categoryId || fallback.categoryId || categories[0].id,
        image: typeof dish.image === 'string' && dish.image.trim() ? dish.image.trim() : (fallback.image || ''),
        spiceLevel: SPICE_LEVELS.includes(dish.spiceLevel) ? dish.spiceLevel : (fallback.spiceLevel || '微辣'),
        estimateMinutes: Number.isFinite(dish.estimateMinutes) ? Math.max(1, Math.floor(dish.estimateMinutes)) : (fallback.estimateMinutes || 15),
        orderCount: Number.isFinite(dish.orderCount) ? Math.max(0, Math.floor(dish.orderCount)) : 0,
        manualOrder: Number.isFinite(dish.manualOrder) ? dish.manualOrder : (fallback.manualOrder || 1),
        description: dish.description || fallback.description || '',
        ingredients: Array.isArray(dish.ingredients) ? dish.ingredients : (fallback.ingredients || []),
        seasonings: Array.isArray(dish.seasonings) ? dish.seasonings : (fallback.seasonings || []),
        steps: Array.isArray(dish.steps) ? dish.steps : (fallback.steps || []),
        updatedAt: dish.updatedAt || nowIso()
      };
    })
    : defaultData.dishes;

  const settings = {
    kitchenSortMode: ['manual', 'name', 'count'].includes(db.settings && db.settings.kitchenSortMode)
      ? db.settings.kitchenSortMode
      : defaultData.settings.kitchenSortMode,
    updatedAt: nowIso()
  };

  const orders = Array.isArray(db.orders)
    ? db.orders.map((order) => ({
      id: order.id || createId('order'),
      status: ['pending', 'cooking', 'ready', 'served', 'cancelled'].includes(order.status) ? order.status : 'pending',
      note: order.note || '',
      createdAt: order.createdAt || nowIso(),
      updatedAt: order.updatedAt || nowIso(),
      items: Array.isArray(order.items) ? order.items : []
    }))
    : [];

  normalizeCategoryOrder(categories);
  normalizeDishOrder(dishes);

  const categorySet = new Set(categories.map((c) => c.id));
  dishes.forEach((dish) => {
    if (!categorySet.has(dish.categoryId)) {
      dish.categoryId = categories[0] ? categories[0].id : 'meat';
    }
  });

  return { categories, dishes, orders, settings };
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
  <circle cx="390" cy="80" r="64" fill="rgba(255,255,255,0.5)"/>
  <text x="40" y="130" font-size="38" font-weight="700" fill="#23303a">${safe}</text>
  <text x="40" y="180" font-size="22" fill="#42525c">家庭私房菜</text>
  <text x="40" y="230" font-size="18" fill="#5f6d74">可在管理页替换真实图片 URL</text>
</svg>`;
}

app.get('/api/bootstrap', (req, res) => {
  const db = readDb();
  const mode = req.query.sortMode || db.settings.kitchenSortMode || 'manual';
  const categoryId = req.query.categoryId || '';

  const dishes = sortedDishes(db.dishes, mode).filter((dish) => !categoryId || dish.categoryId === categoryId);

  res.json({
    categories: sortedCategories(db.categories),
    dishes,
    settings: db.settings,
    spiceLevels: SPICE_LEVELS,
    orderStatuses: ['pending', 'cooking', 'ready', 'served', 'cancelled']
  });
});

app.get('/api/categories', (_, res) => {
  const db = readDb();
  res.json(sortedCategories(db.categories));
});

app.post('/api/categories', (req, res) => {
  const db = readDb();
  const name = String(req.body.name || '').trim();
  const icon = String(req.body.icon || '🍽️').trim() || '🍽️';

  if (!name) {
    return res.status(400).json({ message: '分类名称不能为空' });
  }

  const category = {
    id: createId('cat'),
    name,
    icon,
    manualOrder: db.categories.length + 1
  };

  db.categories.push(category);
  normalizeCategoryOrder(db.categories);
  writeDb(db);
  return res.json(category);
});

app.patch('/api/categories/:id', (req, res) => {
  const db = readDb();
  const category = db.categories.find((item) => item.id === req.params.id);
  if (!category) {
    return res.status(404).json({ message: '分类不存在' });
  }

  if (typeof req.body.name === 'string' && req.body.name.trim()) {
    category.name = req.body.name.trim();
  }
  if (typeof req.body.icon === 'string' && req.body.icon.trim()) {
    category.icon = req.body.icon.trim();
  }

  writeDb(db);
  return res.json(category);
});

app.delete('/api/categories/:id', (req, res) => {
  const db = readDb();
  const targetId = req.params.id;

  if (db.categories.length <= 1) {
    return res.status(400).json({ message: '至少保留一个分类' });
  }

  if (db.dishes.some((dish) => dish.categoryId === targetId)) {
    return res.status(400).json({ message: '该分类下还有菜品，无法删除' });
  }

  db.categories = db.categories.filter((item) => item.id !== targetId);
  normalizeCategoryOrder(db.categories);
  writeDb(db);
  return res.json({ ok: true });
});

app.post('/api/categories/reorder', (req, res) => {
  const db = readDb();
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length !== db.categories.length) {
    return res.status(400).json({ message: '分类拖拽数据无效' });
  }

  const set = new Set(ids);
  if (set.size !== db.categories.length) {
    return res.status(400).json({ message: '分类拖拽数据重复' });
  }

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

  if (categoryId) {
    result = result.filter((dish) => dish.categoryId === categoryId);
  }

  if (keyword) {
    result = result.filter((dish) => dish.name.includes(keyword) || dish.description.includes(keyword));
  }

  res.json({ sortMode, dishes: result });
});

app.get('/api/dishes/:id', (req, res) => {
  const db = readDb();
  const dish = db.dishes.find((item) => item.id === req.params.id);
  if (!dish) {
    return res.status(404).json({ message: '菜品不存在' });
  }
  return res.json(dish);
});

app.get('/api/dishes/:id/placeholder.svg', (req, res) => {
  const db = readDb();
  const dish = db.dishes.find((item) => item.id === req.params.id);
  const text = dish ? dish.name : '菜品图片';
  res.type('image/svg+xml').send(placeholderSvg(text));
});

app.post('/api/dishes', (req, res) => {
  const db = readDb();
  const categoryId = req.body.categoryId || (db.categories[0] && db.categories[0].id);

  if (!categoryId || !db.categories.find((c) => c.id === categoryId)) {
    return res.status(400).json({ message: '分类无效' });
  }

  const name = String(req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ message: '菜名不能为空' });
  }

  const dish = {
    id: createId('dish'),
    name,
    categoryId,
    image: String(req.body.image || '').trim(),
    spiceLevel: SPICE_LEVELS.includes(req.body.spiceLevel) ? req.body.spiceLevel : '微辣',
    estimateMinutes: Number.isFinite(req.body.estimateMinutes) ? Math.max(1, Math.floor(req.body.estimateMinutes)) : 15,
    orderCount: Number.isFinite(req.body.orderCount) ? Math.max(0, Math.floor(req.body.orderCount)) : 0,
    manualOrder: db.dishes.length + 1,
    description: String(req.body.description || '').trim(),
    ingredients: Array.isArray(req.body.ingredients) ? req.body.ingredients : [],
    seasonings: Array.isArray(req.body.seasonings) ? req.body.seasonings : [],
    steps: Array.isArray(req.body.steps) ? req.body.steps : [],
    updatedAt: nowIso()
  };

  db.dishes.push(dish);
  normalizeDishOrder(db.dishes);
  writeDb(db);
  return res.json(dish);
});

app.patch('/api/dishes/:id', (req, res) => {
  const db = readDb();
  const dish = db.dishes.find((item) => item.id === req.params.id);
  if (!dish) {
    return res.status(404).json({ message: '菜品不存在' });
  }

  if (typeof req.body.name === 'string' && req.body.name.trim()) {
    dish.name = req.body.name.trim();
  }
  if (typeof req.body.categoryId === 'string' && db.categories.find((c) => c.id === req.body.categoryId)) {
    dish.categoryId = req.body.categoryId;
  }
  if (typeof req.body.image === 'string') {
    dish.image = req.body.image.trim();
  }
  if (SPICE_LEVELS.includes(req.body.spiceLevel)) {
    dish.spiceLevel = req.body.spiceLevel;
  }
  if (Number.isFinite(req.body.estimateMinutes)) {
    dish.estimateMinutes = Math.max(1, Math.floor(req.body.estimateMinutes));
  }
  if (Number.isFinite(req.body.orderCount)) {
    dish.orderCount = Math.max(0, Math.floor(req.body.orderCount));
  }
  if (typeof req.body.description === 'string') {
    dish.description = req.body.description;
  }
  if (Array.isArray(req.body.ingredients)) {
    dish.ingredients = req.body.ingredients;
  }
  if (Array.isArray(req.body.seasonings)) {
    dish.seasonings = req.body.seasonings;
  }
  if (Array.isArray(req.body.steps)) {
    dish.steps = req.body.steps;
  }

  dish.updatedAt = nowIso();
  writeDb(db);
  return res.json(dish);
});

app.delete('/api/dishes/:id', (req, res) => {
  const db = readDb();
  const before = db.dishes.length;
  db.dishes = db.dishes.filter((item) => item.id !== req.params.id);
  if (db.dishes.length === before) {
    return res.status(404).json({ message: '菜品不存在' });
  }
  normalizeDishOrder(db.dishes);
  writeDb(db);
  return res.json({ ok: true });
});

app.post('/api/dishes/reorder', (req, res) => {
  const db = readDb();
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length !== db.dishes.length) {
    return res.status(400).json({ message: '菜品排序数据无效' });
  }

  const set = new Set(ids);
  if (set.size !== db.dishes.length) {
    return res.status(400).json({ message: '菜品排序数据重复' });
  }

  ids.forEach((id, index) => {
    const dish = db.dishes.find((item) => item.id === id);
    if (dish) dish.manualOrder = index + 1;
  });

  normalizeDishOrder(db.dishes);
  db.settings.kitchenSortMode = 'manual';
  writeDb(db);
  return res.json(sortedDishes(db.dishes, 'manual'));
});

app.post('/api/settings/sort-mode', (req, res) => {
  const db = readDb();
  const mode = req.body.mode;
  if (!['manual', 'name', 'count'].includes(mode)) {
    return res.status(400).json({ message: '排序模式无效' });
  }
  db.settings.kitchenSortMode = mode;
  writeDb(db);
  return res.json({ kitchenSortMode: mode });
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

  if (!items.length) {
    return res.status(400).json({ message: '菜单为空，无法下单' });
  }

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
      estimateMinutes: dish.estimateMinutes
    });
    dish.orderCount += qty;
  }

  if (!normalizedItems.length) {
    return res.status(400).json({ message: '有效菜品为空，无法下单' });
  }

  const order = {
    id: createId('order'),
    status: 'pending',
    note,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    items: normalizedItems
  };

  db.orders.push(order);
  writeDb(db);
  return res.json(order);
});

app.patch('/api/orders/:id', (req, res) => {
  const db = readDb();
  const order = db.orders.find((item) => item.id === req.params.id);
  if (!order) {
    return res.status(404).json({ message: '订单不存在' });
  }

  if (typeof req.body.status === 'string' && ['pending', 'cooking', 'ready', 'served', 'cancelled'].includes(req.body.status)) {
    order.status = req.body.status;
  }
  if (typeof req.body.note === 'string') {
    order.note = req.body.note;
  }
  order.updatedAt = nowIso();
  writeDb(db);
  return res.json(order);
});

app.get('/api/health', (_, res) => {
  res.json({ ok: true, ts: nowIso() });
});

app.listen(PORT, () => {
  ensureDb();
  console.log(`Girlfriend order app running on http://0.0.0.0:${PORT}`);
});
