const express = require('express');
const fs = require('fs');
const path = require('path');
const defaultDishes = require('./data/defaultDishes');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function ensureDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      dishes: defaultDishes,
      settings: {
        sortMode: 'manual',
        updatedAt: new Date().toISOString()
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDb(db) {
  db.settings.updatedAt = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function normalizeOrder(dishes) {
  dishes
    .sort((a, b) => (a.manualOrder || 0) - (b.manualOrder || 0))
    .forEach((dish, index) => {
      dish.manualOrder = index + 1;
    });
}

function sortedByMode(dishes, mode) {
  const list = [...dishes];
  if (mode === 'name') {
    return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }
  if (mode === 'count') {
    return list.sort((a, b) => b.orderCount - a.orderCount || a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }
  return list.sort((a, b) => a.manualOrder - b.manualOrder);
}

app.get('/api/dishes', (req, res) => {
  const db = readDb();
  const mode = req.query.mode || db.settings.sortMode || 'manual';
  const list = sortedByMode(db.dishes, mode);
  res.json({
    sortMode: mode,
    dishes: list
  });
});

app.get('/api/dishes/:id', (req, res) => {
  const db = readDb();
  const dish = db.dishes.find((item) => item.id === req.params.id);
  if (!dish) {
    return res.status(404).json({ message: '菜品不存在' });
  }
  return res.json(dish);
});

app.patch('/api/dishes/:id', (req, res) => {
  const db = readDb();
  const dish = db.dishes.find((item) => item.id === req.params.id);
  if (!dish) {
    return res.status(404).json({ message: '菜品不存在' });
  }

  const { spiceLevel, orderCount } = req.body;

  if (typeof spiceLevel === 'string') {
    dish.spiceLevel = spiceLevel;
  }
  if (typeof orderCount === 'number' && Number.isFinite(orderCount)) {
    dish.orderCount = Math.max(0, Math.floor(orderCount));
  }

  writeDb(db);
  return res.json(dish);
});

app.post('/api/dishes/:id/order', (req, res) => {
  const db = readDb();
  const dish = db.dishes.find((item) => item.id === req.params.id);
  if (!dish) {
    return res.status(404).json({ message: '菜品不存在' });
  }

  dish.orderCount += 1;
  writeDb(db);
  return res.json({ id: dish.id, orderCount: dish.orderCount });
});

app.post('/api/sort', (req, res) => {
  const db = readDb();
  const { mode, ids } = req.body;

  if (!['manual', 'name', 'count'].includes(mode)) {
    return res.status(400).json({ message: '排序模式无效' });
  }

  if (mode === 'manual') {
    if (!Array.isArray(ids) || ids.length !== db.dishes.length) {
      return res.status(400).json({ message: '手动排序数据不完整' });
    }

    const set = new Set(ids);
    if (set.size !== db.dishes.length) {
      return res.status(400).json({ message: '手动排序数据重复' });
    }

    ids.forEach((id, idx) => {
      const dish = db.dishes.find((item) => item.id === id);
      if (dish) {
        dish.manualOrder = idx + 1;
      }
    });
    normalizeOrder(db.dishes);
  }

  db.settings.sortMode = mode;
  writeDb(db);

  return res.json({
    sortMode: mode,
    dishes: sortedByMode(db.dishes, mode)
  });
});

app.get('/api/health', (_, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.listen(PORT, () => {
  ensureDb();
  console.log(`Girlfriend order app running on http://0.0.0.0:${PORT}`);
});
