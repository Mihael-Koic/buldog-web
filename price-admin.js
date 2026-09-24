(function () {
  const formatDate = (value) => value ? new Date(value).toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'short' }) : 'Odmah';
  const inputDate = (value) => value ? new Date(value).toISOString().slice(0, 16) : '';
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  let allProducts = [];

  async function isAdmin() {
    const { data } = await window.supabaseClient.auth.getSession();
    if (!data.session) return false;
    const result = await window.supabaseClient.from('admin_users').select('user_id').eq('user_id', data.session.user.id).maybeSingle();
    return !result.error && !!result.data;
  }

  function render(products) {
    const list = document.getElementById('priceAdminList');
    if (!list) return;
    const search = String(document.getElementById('priceAdminSearch')?.value || '').toLocaleLowerCase('hr-HR').trim();
    const category = document.getElementById('priceAdminCategory')?.value || 'all';
    const visibleProducts = products.filter((product) => (!search || `${product.name} ${product.category}`.toLocaleLowerCase('hr-HR').includes(search)) && (category === 'all' || product.category === category));
    list.innerHTML = visibleProducts.map((product) => `<article class="price-admin-card price-admin-card--${escapeHtml(product.category)}" data-product-id="${product.id}">
      <header class="price-admin-heading"><div><span class="price-admin-category">${escapeHtml(product.category)}</span><strong>${escapeHtml(product.name)}</strong></div><span class="price-admin-status ${product.is_visible ? 'is-active' : 'is-hidden'}">${product.is_visible ? 'Aktivno' : 'Sakriveno'}</span></header>
      <section class="price-admin-section"><div class="price-admin-section-title"><strong>Cijene</strong><small>Svaka varijanta posebno</small></div><div class="price-admin-options">${(product.options || []).map((option, index) => `<label><span>${escapeHtml(option.label)}</span><div class="price-input"><input aria-label="${escapeHtml(product.name)} ${escapeHtml(option.label)} cijena" type="number" min="0" step="0.01" data-option-index="${index}" value="${Number(option.price || 0).toFixed(2)}"><b>€</b></div></label>`).join('')}</div></section>
      <section class="price-admin-section"><div class="price-admin-section-title"><strong>Dostupnost</strong><small>Odredi kada se cijena prikazuje</small></div><div class="price-admin-schedule"><label><span>Prikaži od</span><input aria-label="Početak prikaza" type="datetime-local" data-start value="${inputDate(product.starts_at)}"></label><label><span>Sakrij od</span><input aria-label="Kraj prikaza" type="datetime-local" data-end value="${inputDate(product.ends_at)}"></label></div><label class="price-admin-visible"><input type="checkbox" data-visible ${product.is_visible ? 'checked' : ''}><span>Proizvod je vidljiv na jelovniku</span></label></section>
      <footer class="price-admin-footer"><small>Zadnja promjena: ${formatDate(product.updated_at)}</small><button type="button" class="btn-primary" data-save>Spremi promjene</button><p class="form-message" data-message></p></footer>
    </article>`).join('');
    list.querySelectorAll('[data-save]').forEach((button) => button.addEventListener('click', () => save(button, allProducts)));
    const stats = document.getElementById('priceAdminStats');
    if (stats) stats.innerHTML = `<div><strong>${products.length}</strong><span>proizvoda</span></div><div><strong>${products.filter((product) => product.is_visible).length}</strong><span>aktivno</span></div><div><strong>${products.filter((product) => !product.is_visible).length}</strong><span>skriveno</span></div>`;
  }

  async function save(button, products) {
    const card = button.closest('[data-product-id]');
    const product = products.find((item) => item.id === card.dataset.productId);
    const message = card.querySelector('[data-message]');
    const options = (product.options || []).map((option, index) => ({ ...option, price: Number(card.querySelector(`[data-option-index="${index}"]`).value) }));
    const start = card.querySelector('[data-start]').value;
    const end = card.querySelector('[data-end]').value;
    const payload = { options, starts_at: start ? new Date(start).toISOString() : new Date().toISOString(), ends_at: end ? new Date(end).toISOString() : null, is_visible: card.querySelector('[data-visible]').checked, updated_at: new Date().toISOString() };
    button.disabled = true;
    const result = await window.supabaseClient.from('menu_products').update(payload).eq('id', product.id);
    button.disabled = false;
    if (result.error) { message.textContent = 'Greška: ' + result.error.message; message.className = 'form-message is-error'; return; }
    message.textContent = 'Spremljeno.';
    message.className = 'form-message';
    loadProducts();
  }

  async function loadProducts() {
    const result = await window.supabaseClient.from('menu_products').select('*').order('category').order('name');
    if (result.error) { document.getElementById('priceAdminList').textContent = 'Cijene nisu učitane: ' + result.error.message; return; }
    render(result.data || []);
    allProducts = result.data || [];
    const categorySelect = document.getElementById('priceAdminCategory');
    if (categorySelect) {
      const selected = categorySelect.value;
      categorySelect.innerHTML = '<option value="all">Sve kategorije</option>' + [...new Set(allProducts.map((product) => product.category))].map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
      categorySelect.value = selected || 'all';
    }
    render(allProducts);
    const history = await window.supabaseClient.from('menu_price_history').select('*').order('changed_at', { ascending: false }).limit(50);
    const historyElement = document.getElementById('adminPriceHistory');
    if (historyElement) historyElement.innerHTML = (history.data || []).map((row) => `<div class="price-history-row"><strong>${escapeHtml(row.product_name)}</strong><span>${formatDate(row.changed_at)} · ${(row.options || []).map((option) => `${escapeHtml(option.label)} ${Number(option.price).toFixed(2)} €`).join(', ')}${row.is_visible ? '' : ' · sakriveno'}</span></div>`).join('') || 'Nema promjena.';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('priceAdminList') || !window.supabaseClient || !(await isAdmin())) return;
    loadProducts();
    document.getElementById('priceAdminSearch')?.addEventListener('input', () => render(allProducts));
    document.getElementById('priceAdminCategory')?.addEventListener('change', () => render(allProducts));
    const refreshButton = document.getElementById('refreshPrices');
    refreshButton?.addEventListener('click', async () => {
      refreshButton.disabled = true;
      refreshButton.textContent = 'Osvježavam...';
      await loadProducts();
      refreshButton.disabled = false;
      refreshButton.textContent = 'Osvježi cijene';
    });

    const modal = document.getElementById('bulkPriceModal');
    const bulkButton = document.getElementById('bulkPriceEdit');
    const closeBulkButton = document.getElementById('closeBulkPriceModal');
    const bulkForm = document.getElementById('bulkPriceForm');
    const bulkMessage = document.getElementById('bulkPriceMessage');
    const closeBulkModal = () => { if (modal) modal.hidden = true; };
    bulkButton?.addEventListener('click', () => {
      if (modal) modal.hidden = false;
      bulkForm?.elements.bulk_start && (bulkForm.elements.bulk_start.value = new Date().toISOString().slice(0, 16));
      bulkForm?.elements.bulk_start?.focus();
    });
    closeBulkButton?.addEventListener('click', closeBulkModal);
    modal?.addEventListener('click', (event) => { if (event.target === modal) closeBulkModal(); });
    bulkForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!allProducts.length) return;
      const formData = new FormData(bulkForm);
      const start = String(formData.get('bulk_start') || '');
      const end = String(formData.get('bulk_end') || '');
      if (!start) return;
      if (end && new Date(end) <= new Date(start)) {
        bulkMessage.textContent = 'Kraj prikaza mora biti nakon početka.';
        bulkMessage.className = 'form-message is-error';
        return;
      }
      const submit = bulkForm.querySelector('.bulk-submit');
      submit.disabled = true;
      submit.textContent = 'Spremam raspored...';
      bulkMessage.textContent = '';
      const updates = allProducts.map((product) => {
        return window.supabaseClient.from('menu_products').update({
          starts_at: new Date(start).toISOString(),
          ends_at: end ? new Date(end).toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq('id', product.id);
      });
      const results = await Promise.all(updates);
      const error = results.find((result) => result.error)?.error;
      submit.disabled = false;
      submit.textContent = 'Spremi raspored';
      if (error) {
        bulkMessage.textContent = 'Promjena nije spremljena: ' + error.message;
        bulkMessage.className = 'form-message is-error';
        return;
      }
      bulkMessage.textContent = `Spremljeno za ${allProducts.length} proizvoda.`;
      bulkMessage.className = 'form-message is-success';
      await loadProducts();
    });
  });
})();
