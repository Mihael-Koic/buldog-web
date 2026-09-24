(function () {
  const money = (value) => Number(value || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const normalize = (value) => String(value || '').toLocaleLowerCase('hr-HR').replace(/\s+/g, ' ').trim();
  const active = (product, now) => product.is_visible && new Date(product.starts_at || 0) <= now && (!product.ends_at || new Date(product.ends_at) > now);

  function categoryFor(item) {
    const section = item.closest('section[id]');
    return section ? section.id : '';
  }

  function productForItem(item, products) {
    const title = item.querySelector('h3');
    if (!title) return null;
    const category = categoryFor(item);
    const name = normalize(title.textContent);
    return products.find((product) => normalize(product.category) === normalize(category) && normalize(product.name) === name) || null;
  }

  function renderItem(item, product) {
    if (!product) return;
    item.hidden = !active(product, new Date());
    const info = item.querySelector('.menu-info');
    if (!info) return;
    const oldPrices = info.querySelectorAll('span, .cijena-sl, br');
    oldPrices.forEach((element) => element.remove());
    const options = Array.isArray(product.options) ? product.options : [];
    const priceList = document.createElement('div');
    priceList.className = 'menu-prices';
    options.forEach((option) => {
      const element = document.createElement('span');
      element.className = 'menu-price-option';
      element.textContent = `${option.label && option.label !== 'Standardno' ? option.label + ' ' : ''}${money(option.price)}`;
      priceList.appendChild(element);
    });
    info.appendChild(priceList);
    item.dataset.priceProductId = product.id;
  }

  async function loadMenuPrices() {
    if (!window.supabaseClient) return;
    const { data, error } = await window.supabaseClient.from('menu_products').select('*').order('id');
    if (error || !data) return;
    document.querySelectorAll('.menu-item').forEach((item) => renderItem(item, productForItem(item, data)));
    document.dispatchEvent(new CustomEvent('buldog:prices-loaded', { detail: data }));
  }

  window.BuldogPrices = { money, normalize, active, loadMenuPrices };
  document.addEventListener('DOMContentLoaded', loadMenuPrices);
})();
