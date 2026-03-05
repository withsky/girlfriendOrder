const baseDishes = require('./defaultDishes');

const categories = [
  { id: 'meat', name: '荤菜系列', icon: '🥩', manualOrder: 1 },
  { id: 'seafood', name: '海鲜系列', icon: '🦐', manualOrder: 2 },
  { id: 'veggie', name: '素菜系列', icon: '🥬', manualOrder: 3 },
  { id: 'cold', name: '凉菜系列', icon: '🥗', manualOrder: 4 }
];

const categoryByName = {
  '蒜蓉虾': 'seafood',
  '炒花蛤': 'seafood',
  '凉拌黄瓜': 'cold',
  '凉拌茄子': 'cold',
  '香菜鸡蛋干': 'cold',
  '酸辣白萝卜丝': 'cold',
  '蒜蓉西蓝花': 'veggie',
  '清炒豆芽': 'veggie',
  '素炒胡萝卜丝': 'veggie',
  '红菜苔': 'veggie',
  '苋菜': 'veggie',
  '酸辣包菜': 'veggie',
  '蒜蓉空心菜': 'veggie',
  '蒜蓉生菜': 'veggie',
  '莴笋丝': 'veggie',
  '炒秋葵': 'veggie'
};

const dishImageQueryByName = {
  '西红柿炒鸡蛋': 'tomato scrambled eggs chinese food',
  '香菇焖鸡': 'braised chicken mushroom chinese food',
  '黄焖鸡': 'huangmen chicken chinese food',
  '啤酒鸭': 'beer duck chinese food',
  '蒜蓉虾': 'garlic shrimp chinese food',
  '炒花蛤': 'stir fried clams chinese food',
  '辣椒炒肉': 'chili pork stir fry chinese food',
  '豆干炒肉': 'tofu pork stir fry chinese food',
  '葱爆猪肉': 'scallion pork stir fry chinese food',
  '腐竹炒肉': 'tofu skin pork stir fry chinese food',
  '芹菜炒牛肉': 'celery beef stir fry chinese food',
  '洋葱炒牛肉': 'onion beef stir fry chinese food',
  '可乐鸡翅': 'cola chicken wings chinese food',
  '凉拌黄瓜': 'chinese cucumber salad',
  '蒜蓉西蓝花': 'garlic broccoli stir fry chinese food',
  '清炒豆芽': 'bean sprouts stir fry chinese food',
  '酸辣白萝卜丝': 'spicy sour shredded radish chinese food',
  '素炒胡萝卜丝': 'shredded carrot stir fry chinese food',
  '凉拌茄子': 'chinese eggplant salad',
  '香菜鸡蛋干': 'cilantro tofu salad chinese food',
  '红菜苔': 'chinese kale stir fry',
  '苋菜': 'amaranth greens stir fry',
  '酸辣包菜': 'hot sour cabbage stir fry chinese food',
  '蒜蓉空心菜': 'water spinach garlic stir fry chinese food',
  '蒜蓉生菜': 'garlic lettuce stir fry chinese food',
  '莴笋丝': 'shredded celtuce chinese salad',
  '炒秋葵': 'okra stir fry chinese food'
};

function buildDishImage(name, index) {
  const query = encodeURIComponent(dishImageQueryByName[name] || `${name} chinese food`);
  return `https://loremflickr.com/800/600/${query}?lock=${index + 1}`;
}

function guessMinutes(name) {
  if (name.includes('凉拌')) return 8;
  if (name.includes('焖') || name.includes('鸭')) return 35;
  if (name.includes('鸡翅')) return 28;
  if (name.includes('虾') || name.includes('花蛤')) return 18;
  if (name.includes('牛肉')) return 16;
  return 15;
}

const dishes = baseDishes.map((dish) => ({
  ...dish,
  categoryId: categoryByName[dish.name] || 'meat',
  image: buildDishImage(dish.name, dish.manualOrder || 0),
  estimateMinutes: guessMinutes(dish.name),
  updatedAt: new Date().toISOString()
}));

module.exports = {
  categories,
  dishes,
  orders: [],
  settings: {
    kitchenSortMode: 'manual',
    updatedAt: new Date().toISOString()
  }
};
