const dishListEl = document.getElementById('dishList');
const sortModeEl = document.getElementById('sortMode');
const template = document.getElementById('dishCardTemplate');

let dishes = [];
let sortMode = 'manual';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '请求失败');
  }
  return res.json();
}

function render() {
  dishListEl.innerHTML = '';

  dishes.forEach((dish, index) => {
    const node = template.content.cloneNode(true);
    const name = node.querySelector('.dish-name');
    const meta = node.querySelector('.dish-meta');
    const detailLink = node.querySelector('.detail-link');
    const orderBtn = node.querySelector('.order-btn');
    const spiceSelect = node.querySelector('.spice-select');
    const countInput = node.querySelector('.count-input');
    const minusBtn = node.querySelector('.minus');
    const plusBtn = node.querySelector('.plus');
    const manualOnly = node.querySelector('.manual-only');
    const upBtn = node.querySelector('.up');
    const downBtn = node.querySelector('.down');

    name.textContent = dish.name;
    meta.textContent = `辣度：${dish.spiceLevel} | 点菜次数：${dish.orderCount}`;
    detailLink.href = `/detail.html?id=${encodeURIComponent(dish.id)}`;

    spiceSelect.value = dish.spiceLevel;
    countInput.value = String(dish.orderCount);

    orderBtn.addEventListener('click', async () => {
      await request(`/api/dishes/${dish.id}/order`, { method: 'POST' });
      await loadDishes();
    });

    spiceSelect.addEventListener('change', async () => {
      await request(`/api/dishes/${dish.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ spiceLevel: spiceSelect.value })
      });
      await loadDishes();
    });

    minusBtn.addEventListener('click', async () => {
      await updateCount(dish.id, dish.orderCount - 1);
    });

    plusBtn.addEventListener('click', async () => {
      await updateCount(dish.id, dish.orderCount + 1);
    });

    countInput.addEventListener('change', async () => {
      await updateCount(dish.id, Number(countInput.value));
    });

    if (sortMode === 'manual') {
      upBtn.disabled = index === 0;
      downBtn.disabled = index === dishes.length - 1;
      upBtn.addEventListener('click', async () => moveDish(index, -1));
      downBtn.addEventListener('click', async () => moveDish(index, 1));
    } else {
      manualOnly.style.display = 'none';
    }

    dishListEl.appendChild(node);
  });
}

async function updateCount(id, val) {
  const safeValue = Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 0;
  await request(`/api/dishes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ orderCount: safeValue })
  });
  await loadDishes();
}

async function moveDish(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= dishes.length) return;
  const list = [...dishes];
  const [item] = list.splice(index, 1);
  list.splice(targetIndex, 0, item);
  await request('/api/sort', {
    method: 'POST',
    body: JSON.stringify({ mode: 'manual', ids: list.map((dish) => dish.id) })
  });
  await loadDishes();
}

async function changeSortMode(mode) {
  await request('/api/sort', {
    method: 'POST',
    body: JSON.stringify({ mode })
  });
  await loadDishes(mode);
}

async function loadDishes(forceMode = sortMode) {
  const data = await request(`/api/dishes?mode=${encodeURIComponent(forceMode)}`);
  dishes = data.dishes;
  sortMode = data.sortMode;
  sortModeEl.value = sortMode;
  render();
}

sortModeEl.addEventListener('change', async () => {
  await changeSortMode(sortModeEl.value);
});

loadDishes().catch((err) => {
  dishListEl.innerHTML = `<p class="error">加载失败：${err.message}</p>`;
});
