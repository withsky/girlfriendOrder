function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

async function loadDetail() {
  const id = getParam('id');
  if (!id) {
    document.body.innerHTML = '<p>缺少菜品 ID</p>';
    return;
  }

  const res = await fetch(`/api/dishes/${encodeURIComponent(id)}`);
  if (!res.ok) {
    document.body.innerHTML = '<p>菜品不存在</p>';
    return;
  }

  const dish = await res.json();
  document.getElementById('title').textContent = dish.name;
  document.getElementById('desc').textContent = dish.description;
  document.getElementById('spice').textContent = dish.spiceLevel;
  document.getElementById('count').textContent = String(dish.orderCount);

  const ingredients = document.getElementById('ingredients');
  dish.ingredients.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    ingredients.appendChild(li);
  });

  const seasonings = document.getElementById('seasonings');
  dish.seasonings.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    seasonings.appendChild(li);
  });

  const steps = document.getElementById('steps');
  dish.steps.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    steps.appendChild(li);
  });
}

loadDetail();
