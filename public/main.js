const state = {
  categories: [],
  allDishes: [],
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
  modalDishId: null,
  aiEnabled: false,
  editorImages: [],
  orderFilter: 'all',
  orderPage: 1,
  orderPageSize: 8,
  kitchenMode: false,
  previewImages: [],
  previewIndex: 0,
  previewDishName: '',
  brand: {
    title: '宝宝餐厅',
    subtitle: '',
    image: ''
  }
};

const els = {
  searchInput: document.getElementById('searchInput'),
  brandImage: document.getElementById('brandImage'),
  brandEmoji: document.getElementById('brandEmoji'),
  brandTitle: document.getElementById('brandTitle'),
  brandSubtitle: document.getElementById('brandSubtitle'),
  sortMode: document.getElementById('sortMode'),
  categoryList: document.getElementById('categoryList'),
  activeCategoryTitle: document.getElementById('activeCategoryTitle'),
  dishList: document.getElementById('dishList'),
  cartBar: document.getElementById('cartBar'),
  cartCount: document.getElementById('cartCount'),
  openCartBtn: document.getElementById('openCartBtn'),
  dishModal: document.getElementById('dishModal'),
  cartModal: document.getElementById('cartModal'),
  orderPlanModal: document.getElementById('orderPlanModal'),
  dishEditorModal: document.getElementById('dishEditorModal'),
  modalImage: document.getElementById('modalImage'),
  modalThumbs: document.getElementById('modalThumbs'),
  modalName: document.getElementById('modalName'),
  modalDesc: document.getElementById('modalDesc'),
  modalTime: document.getElementById('modalTime'),
  modalSpice: document.getElementById('modalSpice'),
  imagePreviewModal: document.getElementById('imagePreviewModal'),
  imagePreviewImage: document.getElementById('imagePreviewImage'),
  imagePreviewMeta: document.getElementById('imagePreviewMeta'),
  imagePreviewPrevBtn: document.getElementById('imagePreviewPrevBtn'),
  imagePreviewNextBtn: document.getElementById('imagePreviewNextBtn'),
  modalIngredients: document.getElementById('modalIngredients'),
  modalSeasonings: document.getElementById('modalSeasonings'),
  modalSteps: document.getElementById('modalSteps'),
  modalLastOrdered: document.getElementById('modalLastOrdered'),
  modalHistoryToggle: document.getElementById('modalHistoryToggle'),
  modalHistoryList: document.getElementById('modalHistoryList'),
  modalAddBtn: document.getElementById('modalAddBtn'),
  cartItems: document.getElementById('cartItems'),
  submitOrderBtn: document.getElementById('submitOrderBtn'),
  orderNote: document.getElementById('orderNote'),
  planTitle: document.getElementById('planTitle'),
  planSummary: document.getElementById('planSummary'),
  planTotal: document.getElementById('planTotal'),
  planTimeline: document.getElementById('planTimeline'),
  planTips: document.getElementById('planTips'),
  ordersList: document.getElementById('ordersList'),
  ordersPager: document.getElementById('ordersPager'),
  orderFilterBar: document.getElementById('orderFilterBar'),
  kitchenModeBtn: document.getElementById('kitchenModeBtn'),
  adminCategoryList: document.getElementById('adminCategoryList'),
  addCategoryForm: document.getElementById('addCategoryForm'),
  saveCategoryOrderBtn: document.getElementById('saveCategoryOrderBtn'),
  adminDishOrderList: document.getElementById('adminDishOrderList'),
  saveDishOrderBtn: document.getElementById('saveDishOrderBtn'),
  newDishBtn: document.getElementById('newDishBtn'),
  dishForm: document.getElementById('dishForm'),
  formCategory: document.getElementById('formCategory'),
  editorTitle: document.getElementById('editorTitle'),
  uploadImageBtn: document.getElementById('uploadImageBtn'),
  imageUploadInput: document.getElementById('imageUploadInput'),
  editorImagePreview: document.getElementById('editorImagePreview'),
  aiFillBtn: document.getElementById('aiFillBtn')
  ,
  brandForm: document.getElementById('brandForm'),
  brandImageUploadInput: document.getElementById('brandImageUploadInput'),
  uploadBrandImageBtn: document.getElementById('uploadBrandImageBtn'),
  brandImagePreview: document.getElementById('brandImagePreview'),
  exportDbBtn: document.getElementById('exportDbBtn'),
  importDbInput: document.getElementById('importDbInput'),
  importDbBtn: document.getElementById('importDbBtn')
};

function formField(name) {
  return els.dishForm.elements.namedItem(name);
}

function notify(msg) {
  window.alert(msg);
}

const CATEGORY_ALL = '__all__';
const CATEGORY_FREQUENT = '__frequent__';
const DRAFT_DISH_KEY = 'gf-draft-dish-editor-v1';
const DRAFT_BRAND_KEY = 'gf-draft-brand-v1';
const DRAFT_ORDER_NOTE_KEY = 'gf-draft-order-note-v1';

function loadDraft(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveDraft(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

function clearDraft(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
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
  try {
    els.orderNote.value = localStorage.getItem(DRAFT_ORDER_NOTE_KEY) || '';
  } catch {}
}

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || '请求失败');
  }
  return response.json();
}

function dishImages(dish) {
  const list = Array.isArray(dish.images) ? dish.images.filter(Boolean) : [];
  if (list.length) return list;
  if (dish.image) return [dish.image];
  return [`/api/dishes/${dish.id}/placeholder.svg`];
}

function toThumbUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return raw;
  if (raw.endsWith('__orig.webp')) return raw.replace('__orig.webp', '__thumb.webp');
  return raw;
}

function dishImageUrl(dish) {
  const first = dishImages(dish)[0];
  return toThumbUrl(first);
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { hour12: false });
}

function orderNoByTime(iso) {
  const d = new Date(iso);
  const pad = (num) => String(num).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function dishOrderHistory(dishId) {
  const history = [];
  state.orders.forEach((order) => {
    if (order.status === 'cancelled') return;
    const hasDish = Array.isArray(order.items) && order.items.some((item) => item.dishId === dishId);
    if (hasDish && order.createdAt) history.push(order.createdAt);
  });
  history.sort((a, b) => new Date(b) - new Date(a));
  return history;
}

function daysFromNow(iso) {
  const date = new Date(iso);
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((now - date) / oneDay));
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
  state.allDishes = data.dishes;
  state.dishes = data.dishes;
  state.spiceLevels = data.spiceLevels;
  state.sortMode = data.settings.kitchenSortMode || 'manual';
  state.brand = {
    title: (data.settings.brand && data.settings.brand.title) || '宝宝餐厅',
    subtitle: (data.settings.brand && data.settings.brand.subtitle) || '',
    image: (data.settings.brand && data.settings.brand.image) || ''
  };
  state.aiEnabled = Boolean(data.aiEnabled);

  const kitchenIds = [CATEGORY_ALL, CATEGORY_FREQUENT, ...state.categories.map((c) => c.id)];
  if (!state.activeCategoryId || !kitchenIds.includes(state.activeCategoryId)) {
    state.activeCategoryId = CATEGORY_ALL;
  }

  els.sortMode.value = state.sortMode;
  state.dragCategoryIds = state.categories.map((c) => c.id);
  state.dragDishIds = state.allDishes.map((d) => d.id);
}

function renderBrandHeader() {
  els.brandTitle.textContent = state.brand.title || '宝宝餐厅';
  els.brandSubtitle.textContent = state.brand.subtitle || '';
  document.title = state.brand.title || '宝宝餐厅';
  if (state.brand.image) {
    els.brandImage.src = state.brand.image;
    els.brandImage.style.display = 'block';
    els.brandEmoji.style.display = 'none';
  } else {
    els.brandImage.removeAttribute('src');
    els.brandImage.style.display = 'none';
    els.brandEmoji.style.display = 'grid';
  }
}

async function loadOrders() {
  state.orders = await api('/api/orders');
}

async function refreshDishes() {
  const params = new URLSearchParams({ sortMode: state.sortMode });
  if (state.keyword) params.set('keyword', state.keyword);
  const data = await api(`/api/dishes?${params.toString()}`);
  state.allDishes = data.dishes;
  if (state.activeCategoryId === CATEGORY_ALL) {
    state.dishes = [...state.allDishes];
  } else if (state.activeCategoryId === CATEGORY_FREQUENT) {
    state.dishes = [...state.allDishes]
      .filter((dish) => (dish.orderCount || 0) > 0)
      .sort((a, b) => b.orderCount - a.orderCount || a.name.localeCompare(b.name, 'zh-Hans-CN'));
  } else {
    state.dishes = state.allDishes.filter((dish) => dish.categoryId === state.activeCategoryId);
  }
  state.dragDishIds = data.dishes.map((d) => d.id);
}

function renderCategoryList() {
  els.categoryList.innerHTML = '';
  const kitchenCategories = [
    { id: CATEGORY_ALL, icon: '📋', name: '所有菜' },
    { id: CATEGORY_FREQUENT, icon: '🔥', name: '常点菜' },
    ...state.categories
  ];
  const active = kitchenCategories.find((c) => c.id === state.activeCategoryId);
  els.activeCategoryTitle.textContent = active ? `${active.icon} ${active.name}` : '菜品';

  kitchenCategories.forEach((cat) => {
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
  card.onclick = () => openDishModal(dish.id);

  const img = document.createElement('img');
  img.src = dishImageUrl(dish);
  img.alt = dish.name;
  img.loading = 'lazy';

  const info = document.createElement('div');
  info.className = 'dish-info';
  info.innerHTML = `
    <h3>${dish.name}</h3>
    <p class="muted">${dish.description || '暂无介绍'}</p>
    <p class="tags"><span>${dish.spiceLevel}</span><span>${dish.estimateMinutes}分钟</span><span>点过 ${dish.orderCount} 次</span><span>${dishImages(dish).length}张图</span></p>
  `;

  const actions = document.createElement('div');
  actions.className = 'dish-actions';
  const addBtn = document.createElement('button');
  addBtn.className = 'plus-btn';
  addBtn.textContent = '+';
  addBtn.title = '加入菜单';
  addBtn.onclick = (e) => {
    e.stopPropagation();
    addToCart(dish.id, dish.spiceLevel, 1);
  };

  actions.append(addBtn);
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

  const images = dishImages(dish);
  let activeIndex = 0;
  els.modalImage.src = images[0];
  els.modalThumbs.innerHTML = '';
  const setActiveImage = (index) => {
    activeIndex = index;
    els.modalImage.src = images[index];
    els.modalThumbs.querySelectorAll('.modal-thumb').forEach((node, i) => {
      node.classList.toggle('is-active', i === index);
    });
  };
  images.forEach((url, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal-thumb';
    btn.setAttribute('aria-label', `查看第 ${index + 1} 张菜品图`);
    btn.setAttribute('aria-pressed', String(index === activeIndex));
    btn.onclick = () => {
      setActiveImage(index);
      els.modalThumbs.querySelectorAll('.modal-thumb').forEach((node, i) => {
        node.setAttribute('aria-pressed', String(i === index));
      });
    };

    const t = document.createElement('img');
    t.src = toThumbUrl(url);
    t.alt = `${dish.name} 图片 ${index + 1}`;
    t.loading = 'lazy';
    t.decoding = 'async';
    btn.appendChild(t);
    els.modalThumbs.appendChild(btn);
  });
  setActiveImage(0);
  els.modalImage.onclick = () => openImagePreview(images, activeIndex, dish.name);

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
  const history = dishOrderHistory(dish.id);
  els.modalHistoryList.innerHTML = '';
  if (!history.length) {
    els.modalLastOrdered.textContent = '暂无点单记录';
    els.modalHistoryToggle.classList.add('hidden');
    els.modalHistoryList.classList.add('hidden');
  } else {
    const last = history[0];
    const days = daysFromNow(last);
    els.modalLastOrdered.textContent = `上次点单：${days} 天前（${formatTime(last)}）`;
    els.modalHistoryToggle.classList.remove('hidden');
    els.modalHistoryList.classList.add('hidden');
    els.modalHistoryToggle.textContent = `查看历史日期（${history.length} 次）`;
    history.forEach((time, index) => {
      const li = document.createElement('li');
      li.textContent = `${index + 1}. ${formatTime(time)}`;
      els.modalHistoryList.appendChild(li);
    });
    els.modalHistoryToggle.onclick = () => {
      const hidden = els.modalHistoryList.classList.toggle('hidden');
      els.modalHistoryToggle.textContent = hidden ? `查看历史日期（${history.length} 次）` : '收起历史日期';
    };
  }

  els.dishModal.showModal();
}

function updateImagePreview() {
  if (!state.previewImages.length) return;
  const index = Math.max(0, Math.min(state.previewIndex, state.previewImages.length - 1));
  state.previewIndex = index;
  els.imagePreviewImage.src = state.previewImages[index];
  els.imagePreviewImage.alt = `${state.previewDishName} 大图 ${index + 1}`;
  els.imagePreviewMeta.textContent = `${state.previewDishName} · ${index + 1}/${state.previewImages.length}`;
  const disabled = state.previewImages.length <= 1;
  els.imagePreviewPrevBtn.disabled = disabled;
  els.imagePreviewNextBtn.disabled = disabled;
}

function openImagePreview(images, startIndex = 0, dishName = '菜品') {
  state.previewImages = Array.isArray(images) ? images.filter(Boolean) : [];
  if (!state.previewImages.length) return;
  state.previewIndex = Number.isInteger(startIndex) ? startIndex : 0;
  state.previewDishName = dishName || '菜品';
  updateImagePreview();
  els.imagePreviewModal.showModal();
}

function shiftPreview(step) {
  if (!state.previewImages.length) return;
  const total = state.previewImages.length;
  state.previewIndex = (state.previewIndex + step + total) % total;
  updateImagePreview();
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
  const chips = [
    { id: 'all', label: '全部' },
    { id: 'pending', label: '待处理' },
    { id: 'cooking', label: '制作中' },
    { id: 'done', label: '已完成' }
  ];
  els.orderFilterBar.innerHTML = '';
  chips.forEach((chip) => {
    const btn = document.createElement('button');
    btn.className = `chip ${state.orderFilter === chip.id ? 'active' : ''}`;
    btn.textContent = chip.label;
    btn.onclick = () => {
      state.orderFilter = chip.id;
      state.orderPage = 1;
      renderOrders();
    };
    els.orderFilterBar.appendChild(btn);
  });
  els.kitchenModeBtn.textContent = `厨房模式：${state.kitchenMode ? '开' : '关'}`;
  document.getElementById('ordersView').classList.toggle('kitchen-mode', state.kitchenMode);

  els.ordersList.innerHTML = '';
  let list = [...state.orders];
  if (state.orderFilter === 'pending') list = list.filter((o) => o.status === 'pending');
  if (state.orderFilter === 'cooking') list = list.filter((o) => o.status === 'cooking');
  if (state.orderFilter === 'done') list = list.filter((o) => ['ready', 'served'].includes(o.status));

  if (!list.length) {
    els.ordersList.innerHTML = '<p class="muted">暂时没有订单</p>';
    els.ordersPager.classList.add('hidden');
    els.ordersPager.innerHTML = '';
    return;
  }

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / state.orderPageSize));
  if (state.orderPage > totalPages) state.orderPage = totalPages;
  if (state.orderPage < 1) state.orderPage = 1;
  const start = (state.orderPage - 1) * state.orderPageSize;
  list = list.slice(start, start + state.orderPageSize);

  list.forEach((order) => {
    const card = document.createElement('article');
    card.className = 'order-card';

    const items = order.items.map((item) => `${item.name} x${item.qty}（${item.spiceLevel}）`).join('、');
    card.innerHTML = `
      <div class="panel-title order-header">
        <strong>订单 ${orderNoByTime(order.createdAt)}</strong>
        <span class="status ${order.status}">${statusLabel(order.status)}</span>
      </div>
      <p class="order-items">${items}</p>
      <p class="muted order-meta"><span>下单时间：</span>${formatTime(order.createdAt)}</p>
      <p class="muted order-meta"><span>备注：</span>${order.note || '无'}</p>
      <div class="inline order-actions"></div>
    `;

    const action = card.querySelector('.order-actions');
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

    const aiBtn = document.createElement('button');
    aiBtn.className = 'ghost';
    aiBtn.textContent = state.aiEnabled ? 'AI 优化出餐' : 'AI 优化出餐（需配置 Key）';
    aiBtn.disabled = !state.aiEnabled;
    aiBtn.onclick = async () => {
      aiBtn.disabled = true;
      aiBtn.textContent = '生成中...';
      try {
        await api(`/api/orders/${order.id}/optimize`, { method: 'POST' });
        await loadOrders();
        renderOrders();
        const latest = state.orders.find((it) => it.id === order.id);
        if (latest && latest.kitchenPlan) {
          openOrderPlanModal(latest);
        }
      } catch (err) {
        notify(err.message);
      } finally {
        aiBtn.disabled = !state.aiEnabled;
        aiBtn.textContent = state.aiEnabled ? 'AI 优化出餐' : 'AI 优化出餐（需配置 Key）';
      }
    };
    action.appendChild(aiBtn);

    const viewBtn = document.createElement('button');
    viewBtn.className = 'ghost';
    viewBtn.textContent = order.kitchenPlan ? '查看优化方案' : '暂无优化方案';
    viewBtn.disabled = !order.kitchenPlan;
    viewBtn.onclick = () => openOrderPlanModal(order);
    action.appendChild(viewBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = '删除订单';
    delBtn.onclick = async () => {
      if (!window.confirm('确认删除此订单？会重新计算菜品点单次数。')) return;
      await api(`/api/orders/${order.id}`, { method: 'DELETE' });
      await refreshDishes();
      await loadOrders();
      render();
    };
    action.appendChild(delBtn);

    els.ordersList.appendChild(card);
  });
  renderOrdersPager(total, totalPages);
}

function renderOrdersPager(total, totalPages) {
  if (totalPages <= 1) {
    els.ordersPager.classList.add('hidden');
    els.ordersPager.innerHTML = '';
    return;
  }

  els.ordersPager.classList.remove('hidden');
  els.ordersPager.innerHTML = '';

  const prev = document.createElement('button');
  prev.className = 'ghost';
  prev.textContent = '上一页';
  prev.disabled = state.orderPage <= 1;
  prev.onclick = () => {
    if (state.orderPage <= 1) return;
    state.orderPage -= 1;
    renderOrders();
  };

  const text = document.createElement('span');
  text.className = 'pager-text';
  text.textContent = `第 ${state.orderPage}/${totalPages} 页 · 共 ${total} 条`;

  const next = document.createElement('button');
  next.className = 'ghost';
  next.textContent = '下一页';
  next.disabled = state.orderPage >= totalPages;
  next.onclick = () => {
    if (state.orderPage >= totalPages) return;
    state.orderPage += 1;
    renderOrders();
  };

  els.ordersPager.append(prev, text, next);
}

function openOrderPlanModal(order) {
  if (!order || !order.kitchenPlan) return;
  const plan = order.kitchenPlan;
  els.planTitle.textContent = `AI 出餐优化方案（订单 ${orderNoByTime(order.createdAt)}）`;
  els.planSummary.textContent = plan.summary || '已生成整体出餐优化流程';
  els.planTotal.textContent = String(plan.totalMinutes || 0);

  els.planTimeline.innerHTML = '';
  (plan.timeline || []).forEach((item) => {
    const node = document.createElement('article');
    node.className = 'timeline-item';
    const actions = (item.actions || []).map((s) => `<li>${s}</li>`).join('');
    const parallel = (item.parallel || []).map((s) => `<li>${s}</li>`).join('');
    node.innerHTML = `
      <div class="timeline-time">T+${item.minute} 分钟</div>
      <div class="timeline-body">
        <h4>${item.phase || '流程'}</h4>
        <ul>${actions || '<li>无</li>'}</ul>
        ${parallel ? `<p class="muted">可并行：</p><ul>${parallel}</ul>` : ''}
      </div>
    `;
    els.planTimeline.appendChild(node);
  });

  els.planTips.innerHTML = '';
  const tips = plan.tips || [];
  if (!tips.length) {
    const li = document.createElement('li');
    li.textContent = '暂无';
    els.planTips.appendChild(li);
  } else {
    tips.forEach((tip) => {
      const li = document.createElement('li');
      li.textContent = tip;
      els.planTips.appendChild(li);
    });
  }

  els.orderPlanModal.showModal();
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
    const dish = state.allDishes.find((d) => d.id === id) || null;
    if (!dish) return;
    const category = state.categories.find((c) => c.id === dish.categoryId);
    const li = document.createElement('li');
    li.dataset.id = dish.id;
    li.innerHTML = `
      <span class="dish-mini">
        <img src="${dishImageUrl(dish)}" alt="${dish.name}" loading="lazy" />
        <span>↕ ${dish.name} <small class="muted">${category ? category.name : ''}</small></span>
      </span>
      <div class="inline">
        <button class="ghost">编辑</button>
        <button class="danger">删</button>
      </div>
    `;
    const [editBtn, delBtn] = li.querySelectorAll('button');
    editBtn.onclick = () => openDishEditor(dish.id);
    delBtn.onclick = async () => {
      if (!window.confirm(`确认删除菜品 ${dish.name}？`)) return;
      await api(`/api/dishes/${dish.id}`, { method: 'DELETE' });
      await loadBootstrap();
      render();
    };
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

function renderEditorPreview() {
  els.editorImagePreview.innerHTML = '';
  state.editorImages.forEach((url, index) => {
    const box = document.createElement('div');
    box.className = 'editor-image-item';
    box.draggable = true;
    box.dataset.index = String(index);
    box.innerHTML = `
      <img src="${toThumbUrl(url)}" alt="预览" />
      <button type="button" class="img-remove">×</button>
    `;

    box.querySelector('.img-remove').onclick = () => {
      state.editorImages = state.editorImages.filter((_, i) => i !== index);
      renderEditorPreview();
    };

    box.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', String(index));
    };
    box.ondragover = (e) => e.preventDefault();
    box.ondrop = (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData('text/plain'));
      const to = index;
      if (!Number.isInteger(from) || from === to) return;
      const arr = [...state.editorImages];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      state.editorImages = arr;
      renderEditorPreview();
    };

    els.editorImagePreview.appendChild(box);
  });
  saveDishDraft();
}

function saveDishDraft() {
  if (!els.dishEditorModal.open) return;
  saveDraft(DRAFT_DISH_KEY, {
    target: state.editingDishId || 'new',
    values: {
      name: formField('name').value,
      categoryId: formField('categoryId').value,
      spiceLevel: formField('spiceLevel').value,
      estimateMinutes: formField('estimateMinutes').value,
      orderCount: formField('orderCount').value,
      description: formField('description').value,
      ingredients: formField('ingredients').value,
      seasonings: formField('seasonings').value,
      steps: formField('steps').value
    },
    editorImages: state.editorImages
  });
}

function restoreDishDraft(target) {
  const draft = loadDraft(DRAFT_DISH_KEY, null);
  if (!draft || draft.target !== target || !draft.values) return;
  const v = draft.values;
  formField('name').value = v.name || '';
  if (v.categoryId) formField('categoryId').value = v.categoryId;
  if (v.spiceLevel) formField('spiceLevel').value = v.spiceLevel;
  if (v.estimateMinutes) formField('estimateMinutes').value = v.estimateMinutes;
  if (v.orderCount) formField('orderCount').value = v.orderCount;
  formField('description').value = v.description || '';
  formField('ingredients').value = v.ingredients || '';
  formField('seasonings').value = v.seasonings || '';
  formField('steps').value = v.steps || '';
  if (Array.isArray(draft.editorImages)) state.editorImages = draft.editorImages;
  renderEditorPreview();
  notify('已恢复未保存菜品草稿');
}

function openDishEditor(dishId) {
  const dish = state.allDishes.find((d) => d.id === dishId);
  if (!dish) return;
  state.editingDishId = dishId;
  els.editorTitle.textContent = `编辑菜品：${dish.name}`;

  formField('id').value = dish.id;
  formField('name').value = dish.name;
  formField('categoryId').value = dish.categoryId;
  state.editorImages = dishImages(dish);
  formField('spiceLevel').value = dish.spiceLevel;
  formField('estimateMinutes').value = String(dish.estimateMinutes || 15);
  formField('orderCount').value = String(dish.orderCount || 0);
  formField('description').value = dish.description || '';
  formField('ingredients').value = listToLines(dish.ingredients);
  formField('seasonings').value = listToLines(dish.seasonings);
  formField('steps').value = listToLines(dish.steps);

  renderEditorPreview();
  restoreDishDraft(dishId);
  els.dishEditorModal.showModal();
}

function openNewDishEditor() {
  state.editingDishId = null;
  els.editorTitle.textContent = '新增菜品';
  els.dishForm.reset();
  formField('id').value = '';
  if (state.categories[0]) {
    formField('categoryId').value = state.categories[0].id;
  }
  formField('spiceLevel').value = '微辣';
  formField('estimateMinutes').value = '15';
  formField('orderCount').value = '0';
  state.editorImages = [];
  renderEditorPreview();
  restoreDishDraft('new');
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
  if (els.brandForm) {
    const brandDraft = loadDraft(DRAFT_BRAND_KEY, null);
    const title = (brandDraft && brandDraft.title) || state.brand.title || '';
    const subtitle = (brandDraft && brandDraft.subtitle) || state.brand.subtitle || '';
    const image = (brandDraft && brandDraft.image) || state.brand.image || '';
    els.brandForm.elements.title.value = title;
    els.brandForm.elements.subtitle.value = subtitle;
    els.brandImagePreview.src = image;
    els.brandImagePreview.style.display = image ? 'block' : 'none';
  }
  fillCategoryOptions();
  renderAdminCategories();
  renderAdminDishOrder();
  els.aiFillBtn.disabled = !state.aiEnabled;
  if (!state.aiEnabled) {
    els.aiFillBtn.textContent = 'AI 填写（需配置 DEEPSEEK_API_KEY）';
  } else {
    els.aiFillBtn.textContent = 'AI 填写（DeepSeek）';
  }
}

function render() {
  renderBrandHeader();
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
  clearDraft(DRAFT_ORDER_NOTE_KEY);
  localSaveCart();
  els.cartModal.close();
  await refreshDishes();
  await loadOrders();
  render();
  notify('下单成功');
});

els.orderNote.addEventListener('input', () => {
  try {
    localStorage.setItem(DRAFT_ORDER_NOTE_KEY, els.orderNote.value || '');
  } catch {}
});

els.kitchenModeBtn.addEventListener('click', () => {
  state.kitchenMode = !state.kitchenMode;
  renderOrders();
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

els.uploadImageBtn.addEventListener('click', async () => {
  const files = els.imageUploadInput.files;
  if (!files || !files.length) {
    notify('请先选择图片');
    return;
  }
  els.uploadImageBtn.disabled = true;
  const oldText = els.uploadImageBtn.textContent;
  els.uploadImageBtn.textContent = '上传处理中...';
  const fd = new FormData();
  Array.from(files).forEach((file) => fd.append('images', file));
  try {
    const result = await api('/api/uploads', {
      method: 'POST',
      body: fd
    });

    const merged = [...state.editorImages, ...result.urls];
    state.editorImages = [...new Set(merged)];
    els.imageUploadInput.value = '';
    renderEditorPreview();
  } catch (err) {
    notify(err.message);
  } finally {
    els.uploadImageBtn.disabled = false;
    els.uploadImageBtn.textContent = oldText;
  }
});

els.uploadBrandImageBtn.addEventListener('click', async () => {
  const file = els.brandImageUploadInput.files && els.brandImageUploadInput.files[0];
  if (!file) {
    notify('请先选择标题图片');
    return;
  }
  const fd = new FormData();
  fd.append('images', file);
  const result = await api('/api/uploads', { method: 'POST', body: fd });
  if (!result.urls || !result.urls.length) return;
  state.brand.image = result.urls[0];
  saveDraft(DRAFT_BRAND_KEY, {
    title: els.brandForm.elements.title.value || state.brand.title || '',
    subtitle: els.brandForm.elements.subtitle.value || state.brand.subtitle || '',
    image: state.brand.image
  });
  els.brandImagePreview.src = state.brand.image;
  els.brandImagePreview.style.display = 'block';
  renderBrandHeader();
  els.brandImageUploadInput.value = '';
});

els.brandForm.addEventListener('input', () => {
  saveDraft(DRAFT_BRAND_KEY, {
    title: els.brandForm.elements.title.value || '',
    subtitle: els.brandForm.elements.subtitle.value || '',
    image: state.brand.image || ''
  });
});

els.brandForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = String(els.brandForm.elements.title.value || '').trim();
  if (!title) {
    notify('标题不能为空');
    return;
  }
  const subtitle = String(els.brandForm.elements.subtitle.value || '').trim();
  const brand = await api('/api/settings/brand', {
    method: 'PATCH',
    body: JSON.stringify({
      title,
      subtitle,
      image: state.brand.image || ''
    })
  });
  state.brand = {
    title: brand.title || title,
    subtitle: brand.subtitle || subtitle,
    image: brand.image || ''
  };
  clearDraft(DRAFT_BRAND_KEY);
  renderBrandHeader();
  notify('标题设置已保存');
});

els.exportDbBtn.addEventListener('click', () => {
  window.location.href = '/api/admin/export-db';
});

els.importDbBtn.addEventListener('click', async () => {
  const file = els.importDbInput.files && els.importDbInput.files[0];
  if (!file) {
    notify('请先选择 db.json 文件');
    return;
  }
  const fd = new FormData();
  fd.append('db', file);
  const result = await api('/api/admin/import-db', { method: 'POST', body: fd });
  await loadBootstrap();
  await refreshDishes();
  await loadOrders();
  render();
  notify(`导入成功：${result.categories} 个分类，${result.dishes} 道菜，${result.orders} 个订单`);
  els.importDbInput.value = '';
});

els.aiFillBtn.addEventListener('click', async () => {
  const name = String(formField('name').value || '').trim();
  if (!name) {
    notify('请先填写菜名再用 AI');
    return;
  }
  const categoryId = String(formField('categoryId').value || '').trim();
  const category = state.categories.find((c) => c.id === categoryId);

  els.aiFillBtn.disabled = true;
  const origin = els.aiFillBtn.textContent;
  els.aiFillBtn.textContent = 'AI 生成中...';

  try {
    const result = await api('/api/ai/fill-dish', {
      method: 'POST',
      body: JSON.stringify({
        name,
        spiceLevel: String(formField('spiceLevel').value || '微辣'),
        categoryName: category ? category.name : ''
      })
    });

    const data = result.data;
    formField('description').value = data.description || '';
    formField('estimateMinutes').value = String(data.estimateMinutes || 15);
    if (data.spiceLevel) formField('spiceLevel').value = data.spiceLevel;
    formField('ingredients').value = listToLines(data.ingredients || []);
    formField('seasonings').value = listToLines(data.seasonings || []);
    formField('steps').value = listToLines(data.steps || []);
    notify('AI 已完成填充');
  } catch (err) {
    notify(err.message);
  } finally {
    els.aiFillBtn.disabled = !state.aiEnabled;
    els.aiFillBtn.textContent = origin;
  }
});

els.dishForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(els.dishForm);

  const payload = {
    name: String(form.get('name') || '').trim(),
    categoryId: String(form.get('categoryId') || '').trim(),
    images: state.editorImages,
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
  clearDraft(DRAFT_DISH_KEY);
  await loadBootstrap();
  if (state.view === 'kitchen') {
    await refreshDishes();
  }
  render();
  notify('菜品已保存');
});

els.dishForm.addEventListener('input', () => {
  saveDishDraft();
});

els.imagePreviewPrevBtn.addEventListener('click', () => shiftPreview(-1));
els.imagePreviewNextBtn.addEventListener('click', () => shiftPreview(1));

document.addEventListener('keydown', (e) => {
  if (!els.imagePreviewModal.open) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    shiftPreview(-1);
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    shiftPreview(1);
  }
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
