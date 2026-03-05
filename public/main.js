const state = {
  categories: [],
  dishes: [],
  orders: [],
  spiceLevels: ['不辣', '微辣', '中辣', '特辣'],
  activeCategoryId: '',
  sortMode: 'manual',
  keyword: '',
  view: 'kitchen',
  cart: [],
  dragCategoryIds: [],
  dragDishIds: [],
  editingDishId: null,
  modalDishId: null
};

const els = {
  searchInput: document.getElementById('searchInput'),
  sortMode: document.getElementById('sortMode'),
  categoryList: document.getElementById('categoryList'),
  activeCategoryTitle: document.getElementById('activeCategoryTitle'),
  dishList: document.getElementById('dishList'),
  cartBar: document.getElementById('cartBar'),
  cartCount: document.getElementById('cartCount'),
  openCartBtn: document.getElementById('openCartBtn'),
  dishModal: document.getElementById('dishModal'),
  cartModal: document.getElementById('cartModal'),
  dishEditorModal: document.getElementById('dishEditorModal'),
  modalImage: document.getElementById('modalImage'),
  modalName: document.getElementById('modalName'),
  modalDesc: document.getElementById('modalDesc'),
  modalTime: document.getElementById('modalTime'),
  modalSpice: document.getElementById('modalSpice'),
  modalIngredients: document.getElementById('modalIngredients'),
  modalSeasonings: document.getElementById('modalSeasonings'),
  modalSteps: document.getElementById('modalSteps'),
  modalAddBtn: document.getElementById('modalAddBtn'),
  cartItems: document.getElementById('cartItems'),
  submitOrderBtn: document.getElementById('submitOrderBtn'),
  orderNote: document.getElementById('orderNote'),
  ordersList: document.getElementById('ordersList'),
  adminCategoryList: document.getElementById('adminCategoryList'),
  addCategoryForm: document.getElementById('addCategoryForm'),
  saveCategoryOrderBtn: document.getElementById('saveCategoryOrderBtn'),
  adminDishOrderList: document.getElementById('adminDishOrderList'),
  saveDishOrderBtn: document.getElementById('saveDishOrderBtn'),
  newDishBtn: document.getElementById('newDishBtn'),
  dishForm: document.getElementById('dishForm'),
  formCategory: document.getElementById('formCategory'),
  editorTitle: document.getElementById('editorTitle')
};

function notify(msg) {
  window.alert(msg);
}

function localSaveCart() {
  localStorage.setItem('gf-order-cart', JSON.stringify(state.cart));
}

function localLoadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem('gf-order-cart') || '[]');
    if (Array.isArray(parsed)) state.cart = parsed;
  } catch {
    state.cart = [];
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || '请求失败');
  }
  return response.json();
}

function dishImageUrl(dish) {
  return dish.image && dish.image.trim() ? dish.image.trim() : `/api/dishes/${dish.id}/placeholder.svg`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { hour12: false });
}

function statusLabel(status) {
  const map = {
    pending: '待处理',
    cooking: '制作中',
    ready: '可上桌',
    served: '已完成',
    cancelled: '已取消'
  };
  return map[status] || status;
}

function cartTotalCount() {
  return state.cart.reduce((sum, item) => sum + item.qty, 0);
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.bottom-nav button').forEach((el) => el.classList.remove('active'));
  document.getElementById(`${view}View`).classList.add('active');
  document.querySelector(`.bottom-nav button[data-view="${view}"]`).classList.add('active');
  render();
}

async function loadBootstrap() {
  const data = await api('/api/bootstrap');
  state.categories = data.categories;
  state.dishes = data.dishes;
  state.spiceLevels = data.spiceLevels;
  state.sortMode = data.settings.kitchenSortMode || 'manual';

  if (!state.activeCategoryId || !state.categories.find((c) => c.id === state.activeCategoryId)) {
    state.activeCategoryId = state.categories[0] ? state.categories[0].id : '';
  }

  els.sortMode.value = state.sortMode;
  state.dragCategoryIds = state.categories.map((c) => c.id);
  state.dragDishIds = state.dishes.map((d) => d.id);
}

async function loadOrders() {
  state.orders = await api('/api/orders');
}

async function refreshDishes() {
  const params = new URLSearchParams({ sortMode: state.sortMode });
  if (state.activeCategoryId) params.set('categoryId', state.activeCategoryId);
  if (state.keyword) params.set('keyword', state.keyword);
  const data = await api(`/api/dishes?${params.toString()}`);
  state.dishes = data.dishes;
  state.dragDishIds = data.dishes.map((d) => d.id);
}

function renderCategoryList() {
  els.categoryList.innerHTML = '';
  const active = state.categories.find((c) => c.id === state.activeCategoryId);
  els.activeCategoryTitle.textContent = active ? `${active.icon} ${active.name}` : '菜品';

  state.categories.forEach((cat) => {
    const li = document.createElement('li');
    li.className = cat.id === state.activeCategoryId ? 'active' : '';
    li.textContent = `${cat.icon} ${cat.name}`;
    li.onclick = async () => {
      state.activeCategoryId = cat.id;
      await refreshDishes();
      render();
    };
    els.categoryList.appendChild(li);
  });
}

function dishCard(dish) {
  const card = document.createElement('article');
  card.className = 'dish-card';

  const img = document.createElement('img');
  img.src = dishImageUrl(dish);
  img.alt = dish.name;

  const info = document.createElement('div');
  info.className = 'dish-info';
  info.innerHTML = `
    <h3>${dish.name}</h3>
    <p class="muted">${dish.description || '暂无介绍'}</p>
    <p class="tags"><span>${dish.spiceLevel}</span><span>${dish.estimateMinutes}分钟</span><span>点过 ${dish.orderCount} 次</span></p>
  `;

  const actions = document.createElement('div');
  actions.className = 'dish-actions';
  const detailBtn = document.createElement('button');
  detailBtn.className = 'ghost';
  detailBtn.textContent = '详情';
  detailBtn.onclick = () => openDishModal(dish.id);

  const addBtn = document.createElement('button');
  addBtn.textContent = '加入菜单';
  addBtn.onclick = () => addToCart(dish.id, dish.spiceLevel, 1);

  actions.append(detailBtn, addBtn);
  card.append(img, info, actions);
  return card;
}

function renderDishes() {
  els.dishList.innerHTML = '';
  if (!state.dishes.length) {
    els.dishList.innerHTML = '<p class="muted">当前条件下没有菜品</p>';
    return;
  }
  state.dishes.forEach((dish) => els.dishList.appendChild(dishCard(dish)));
}

function openDishModal(dishId) {
  const dish = state.dishes.find((d) => d.id === dishId) || null;
  if (!dish) return;
  state.modalDishId = dish.id;

  els.modalImage.src = dishImageUrl(dish);
  els.modalName.textContent = dish.name;
  els.modalDesc.textContent = dish.description || '暂无介绍';
  els.modalTime.textContent = String(dish.estimateMinutes || 0);

  els.modalSpice.innerHTML = '';
  state.spiceLevels.forEach((sp) => {
    const opt = document.createElement('option');
    opt.value = sp;
    opt.textContent = sp;
    if (dish.spiceLevel === sp) opt.selected = true;
    els.modalSpice.appendChild(opt);
  });

  fillList(els.modalIngredients, dish.ingredients || []);
  fillList(els.modalSeasonings, dish.seasonings || []);
  fillList(els.modalSteps, dish.steps || []);

  els.dishModal.showModal();
}

function fillList(el, data) {
  el.innerHTML = '';
  if (!data.length) {
    const li = document.createElement('li');
    li.textContent = '暂无';
    el.appendChild(li);
    return;
  }
  data.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  });
}

function addToCart(dishId, spiceLevel, qty) {
  const dish = state.dishes.find((d) => d.id === dishId);
  if (!dish) return;

  const existing = state.cart.find((item) => item.dishId === dishId && item.spiceLevel === spiceLevel);
  if (existing) {
    existing.qty += qty;
  } else {
    state.cart.push({
      dishId,
      spiceLevel,
      qty,
      name: dish.name,
      estimateMinutes: dish.estimateMinutes
    });
  }
  localSaveCart();
  renderCartBar();
}

function renderCartBar() {
  const count = cartTotalCount();
  els.cartCount.textContent = String(count);
  els.cartBar.classList.toggle('hidden', count === 0);
}

function renderCartModal() {
  els.cartItems.innerHTML = '';
  if (!state.cart.length) {
    els.cartItems.innerHTML = '<p class="muted">菜单为空</p>';
    return;
  }

  state.cart.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <p class="muted">辣度：${item.spiceLevel} | 预计 ${item.estimateMinutes} 分钟</p>
      </div>
      <div class="inline">
        <button class="ghost">-</button>
        <span>${item.qty}</span>
        <button>+</button>
        <button class="danger">删</button>
      </div>
    `;

    const [minus, plus, del] = row.querySelectorAll('button');
    minus.onclick = () => {
      item.qty -= 1;
      if (item.qty <= 0) state.cart = state.cart.filter((it) => it !== item);
      localSaveCart();
      renderCartModal();
      renderCartBar();
    };
    plus.onclick = () => {
      item.qty += 1;
      localSaveCart();
      renderCartModal();
      renderCartBar();
    };
    del.onclick = () => {
      state.cart = state.cart.filter((it) => it !== item);
      localSaveCart();
      renderCartModal();
      renderCartBar();
    };

    els.cartItems.appendChild(row);
  });
}

function renderOrders() {
  els.ordersList.innerHTML = '';
  if (!state.orders.length) {
    els.ordersList.innerHTML = '<p class="muted">暂时没有订单</p>';
    return;
  }

  state.orders.forEach((order) => {
    const card = document.createElement('article');
    card.className = 'order-card';

    const items = order.items.map((item) => `${item.name} x${item.qty}（${item.spiceLevel}）`).join('、');
    card.innerHTML = `
      <div class="panel-title">
        <strong>订单 ${order.id.slice(-6)}</strong>
        <span class="status ${order.status}">${statusLabel(order.status)}</span>
      </div>
      <p>${items}</p>
      <p class="muted">下单时间：${formatTime(order.createdAt)}</p>
      <p class="muted">备注：${order.note || '无'}</p>
      <div class="inline"></div>
    `;

    const action = card.querySelector('.inline');
    [['cooking', '开始制作'], ['ready', '制作完成'], ['served', '已上桌'], ['cancelled', '取消订单']].forEach(([status, label]) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = status === 'cancelled' ? 'danger' : 'ghost';
      btn.disabled = order.status === status || order.status === 'served' || order.status === 'cancelled';
      btn.onclick = async () => {
        await api(`/api/orders/${order.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status })
        });
        await loadOrders();
        renderOrders();
      };
      action.appendChild(btn);
    });

    els.ordersList.appendChild(card);
  });
}

function makeDraggableList(listEl, ids, onChange) {
  let dragging = null;
  listEl.querySelectorAll('li').forEach((li) => {
    li.draggable = true;
    li.ondragstart = () => {
      dragging = li.dataset.id;
      li.classList.add('dragging');
    };
    li.ondragend = () => {
      dragging = null;
      li.classList.remove('dragging');
    };
    li.ondragover = (e) => e.preventDefault();
    li.ondrop = (e) => {
      e.preventDefault();
      if (!dragging || dragging === li.dataset.id) return;
      const from = ids.indexOf(dragging);
      const to = ids.indexOf(li.dataset.id);
      if (from < 0 || to < 0) return;
      const arr = [...ids];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      onChange(arr);
    };
  });
}

function renderAdminCategories() {
  els.adminCategoryList.innerHTML = '';
  state.dragCategoryIds.forEach((id) => {
    const cat = state.categories.find((c) => c.id === id);
    if (!cat) return;
    const li = document.createElement('li');
    li.dataset.id = cat.id;
    li.innerHTML = `
      <span>↕ ${cat.icon} ${cat.name}</span>
      <div class="inline">
        <button class="ghost">改名</button>
        <button class="danger">删</button>
      </div>
    `;

    const [editBtn, delBtn] = li.querySelectorAll('button');
    editBtn.onclick = async () => {
      const name = window.prompt('输入新分类名', cat.name);
      if (!name) return;
      const icon = window.prompt('输入新图标', cat.icon);
      await api(`/api/categories/${cat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, icon: icon || cat.icon })
      });
      await loadBootstrap();
      render();
    };
    delBtn.onclick = async () => {
      if (!window.confirm(`确认删除分类 ${cat.name}？`)) return;
      try {
        await api(`/api/categories/${cat.id}`, { method: 'DELETE' });
      } catch (err) {
        notify(err.message);
      }
      await loadBootstrap();
      render();
    };

    els.adminCategoryList.appendChild(li);
  });

  makeDraggableList(els.adminCategoryList, state.dragCategoryIds, (ids) => {
    state.dragCategoryIds = ids;
    renderAdminCategories();
  });
}

function renderAdminDishOrder() {
  els.adminDishOrderList.innerHTML = '';
  state.dragDishIds.forEach((id) => {
    const dish = state.dishes.find((d) => d.id === id) || null;
    if (!dish) return;
    const category = state.categories.find((c) => c.id === dish.categoryId);
    const li = document.createElement('li');
    li.dataset.id = dish.id;
    li.innerHTML = `
      <span>↕ ${dish.name} <small class="muted">${category ? category.name : ''}</small></span>
      <div class="inline">
        <button class="ghost">编辑</button>
      </div>
    `;
    li.querySelector('button').onclick = () => openDishEditor(dish.id);
    els.adminDishOrderList.appendChild(li);
  });

  makeDraggableList(els.adminDishOrderList, state.dragDishIds, (ids) => {
    state.dragDishIds = ids;
    renderAdminDishOrder();
  });
}

function listToLines(arr) {
  return (arr || []).join('\n');
}

function linesToList(str) {
  return String(str || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function openDishEditor(dishId) {
  const dish = state.dishes.find((d) => d.id === dishId);
  if (!dish) return;
  state.editingDishId = dishId;
  els.editorTitle.textContent = `编辑菜品：${dish.name}`;

  els.dishForm.id.value = dish.id;
  els.dishForm.name.value = dish.name;
  els.dishForm.categoryId.value = dish.categoryId;
  els.dishForm.image.value = dish.image || '';
  els.dishForm.spiceLevel.value = dish.spiceLevel;
  els.dishForm.estimateMinutes.value = String(dish.estimateMinutes || 15);
  els.dishForm.orderCount.value = String(dish.orderCount || 0);
  els.dishForm.description.value = dish.description || '';
  els.dishForm.ingredients.value = listToLines(dish.ingredients);
  els.dishForm.seasonings.value = listToLines(dish.seasonings);
  els.dishForm.steps.value = listToLines(dish.steps);

  els.dishEditorModal.showModal();
}

function openNewDishEditor() {
  state.editingDishId = null;
  els.editorTitle.textContent = '新增菜品';
  els.dishForm.reset();
  els.dishForm.id.value = '';
  if (state.categories[0]) {
    els.dishForm.categoryId.value = state.categories[0].id;
  }
  els.dishForm.spiceLevel.value = '微辣';
  els.dishForm.estimateMinutes.value = '15';
  els.dishForm.orderCount.value = '0';
  els.dishEditorModal.showModal();
}

function fillCategoryOptions() {
  els.formCategory.innerHTML = '';
  state.categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.name}`;
    els.formCategory.appendChild(opt);
  });
}

function renderAdmin() {
  fillCategoryOptions();
  renderAdminCategories();
  renderAdminDishOrder();
}

function render() {
  renderCategoryList();
  renderDishes();
  renderCartBar();
  if (state.view === 'orders') renderOrders();
  if (state.view === 'admin') renderAdmin();
}

async function init() {
  localLoadCart();
  await loadBootstrap();
  await refreshDishes();
  await loadOrders();
  render();
}

els.searchInput.addEventListener('input', async () => {
  state.keyword = els.searchInput.value.trim();
  await refreshDishes();
  render();
});

els.sortMode.addEventListener('change', async () => {
  state.sortMode = els.sortMode.value;
  await api('/api/settings/sort-mode', {
    method: 'POST',
    body: JSON.stringify({ mode: state.sortMode })
  });
  await refreshDishes();
  render();
});

els.modalAddBtn.addEventListener('click', () => {
  if (!state.modalDishId) return;
  addToCart(state.modalDishId, els.modalSpice.value, 1);
  els.dishModal.close();
});

els.openCartBtn.addEventListener('click', () => {
  renderCartModal();
  els.cartModal.showModal();
});

els.submitOrderBtn.addEventListener('click', async () => {
  if (!state.cart.length) {
    notify('菜单为空');
    return;
  }

  await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ items: state.cart, note: els.orderNote.value.trim() })
  });

  state.cart = [];
  els.orderNote.value = '';
  localSaveCart();
  els.cartModal.close();
  await refreshDishes();
  await loadOrders();
  render();
  notify('下单成功');
});

els.addCategoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(els.addCategoryForm);
  await api('/api/categories', {
    method: 'POST',
    body: JSON.stringify({
      icon: String(form.get('icon') || '').trim(),
      name: String(form.get('name') || '').trim()
    })
  });
  els.addCategoryForm.reset();
  await loadBootstrap();
  if (state.view === 'kitchen') {
    await refreshDishes();
  }
  render();
});

els.saveCategoryOrderBtn.addEventListener('click', async () => {
  await api('/api/categories/reorder', {
    method: 'POST',
    body: JSON.stringify({ ids: state.dragCategoryIds })
  });
  await loadBootstrap();
  if (state.view === 'kitchen') {
    await refreshDishes();
  }
  render();
  notify('分类顺序已保存');
});

els.saveDishOrderBtn.addEventListener('click', async () => {
  await api('/api/dishes/reorder', {
    method: 'POST',
    body: JSON.stringify({ ids: state.dragDishIds })
  });
  state.sortMode = 'manual';
  els.sortMode.value = 'manual';
  if (state.view === 'kitchen') {
    await refreshDishes();
  } else {
    await loadBootstrap();
  }
  render();
  notify('菜品手动顺序已保存');
});

els.newDishBtn.addEventListener('click', () => {
  openNewDishEditor();
});

els.dishForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(els.dishForm);

  const payload = {
    name: String(form.get('name') || '').trim(),
    categoryId: String(form.get('categoryId') || '').trim(),
    image: String(form.get('image') || '').trim(),
    spiceLevel: String(form.get('spiceLevel') || '微辣').trim(),
    estimateMinutes: Number(form.get('estimateMinutes') || 15),
    orderCount: Number(form.get('orderCount') || 0),
    description: String(form.get('description') || '').trim(),
    ingredients: linesToList(form.get('ingredients')),
    seasonings: linesToList(form.get('seasonings')),
    steps: linesToList(form.get('steps'))
  };

  const id = String(form.get('id') || '').trim();

  if (id) {
    await api(`/api/dishes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  } else {
    await api('/api/dishes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  els.dishEditorModal.close();
  await loadBootstrap();
  if (state.view === 'kitchen') {
    await refreshDishes();
  }
  render();
  notify('菜品已保存');
});

document.querySelectorAll('.bottom-nav button').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const view = btn.dataset.view;
    if (view === 'orders') await loadOrders();
    if (view === 'admin') await loadBootstrap();
    setView(view);
  });
});

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => {
    btn.closest('dialog').close();
  });
});

init().catch((err) => {
  console.error(err);
  notify(`初始化失败：${err.message}`);
});
