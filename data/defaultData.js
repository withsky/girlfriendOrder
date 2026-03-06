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

function buildDishImages(id) {
  return [`/uploads/generated/${id}-1__orig.webp`, `/uploads/generated/${id}-2__orig.webp`];
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
  image: buildDishImages(dish.id)[0],
  images: buildDishImages(dish.id),
  estimateMinutes: guessMinutes(dish.name),
  updatedAt: new Date().toISOString()
}));

module.exports = {
  categories,
  dishes,
  orders: [],
  settings: {
    kitchenSortMode: 'manual',
    brand: {
      title: '宝宝餐厅',
      subtitle: '唯有爱与美食不可辜负',
      image: '/uploads/generated/brand-baby-restaurant__orig.webp'
    },
    updatedAt: new Date().toISOString()
  }
};
