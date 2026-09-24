(function () {
  const CART_KEY = 'buldogCart';
  const STATUS_LABELS = {
    novo: 'Na čekanju',
    prihvacena: 'Prihvaćena',
    priprema: 'U pripremi',
    dostava: 'U dostavi',
    zavrsena: 'Završena',
    otkazana: 'Otkazana',
  };

  function money(value) {
    return Number(value || 0).toLocaleString('hr-HR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' EUR';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char]));
  }

  function parsePrice(text) {
    const match = String(text || '').match(/(\d+(?:[,.]\d{1,2})?)\s*€/);
    return match ? Number(match[1].replace(',', '.')) : null;
  }

  function optionName(text) {
    return String(text || '')
      .replace(/\d+(?:[,.]\d{1,2})?\s*€/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanBaseName(name, prefix) {
    return String(name || '')
      .replace(new RegExp('^' + prefix + '\\s+', 'i'), '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function productPrices(item) {
    const prices = [];
    item.querySelectorAll('span, .cijena-sl').forEach((priceEl) => {
      const price = parsePrice(priceEl.textContent);
      if (price === null) return;
      prices.push({
        label: optionName(priceEl.textContent),
        price,
      });
    });
    return prices;
  }

  function buildSpecialOptions() {
    const pizzaOptions = [];
    const burgerOptions = [];

    document.querySelectorAll('#pizze .menu-item').forEach((item) => {
      const title = item.querySelector('h3');
      if (!title) return;
      const name = title.textContent.trim();
      if (/pizza\s+bianca/i.test(name)) return;

      productPrices(item).forEach((option) => {
        const size = option.label ? ' ' + option.label : '';
        pizzaOptions.push({
          label: `(${cleanBaseName(name, 'Pizza')}${size}) + vrhnje`,
          price: Number(option.price) + 1,
        });
      });
    });

    document.querySelectorAll('#burgeri .menu-item').forEach((item) => {
      const title = item.querySelector('h3');
      if (!title) return;
      const name = title.textContent.trim();
      if (/egg\s+burger/i.test(name) || /pohani\s+sir/i.test(name)) return;

      productPrices(item).forEach((option) => {
        const variant = option.label ? ' ' + option.label : '';
        burgerOptions.push({
          label: `(${name}${variant}) + jaje`,
          price: Number(option.price) + 1,
        });
      });
    });

    return { pizzaOptions, burgerOptions };
  }

  function cart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (error) {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCartCounter();
  }

  function itemPrice(item) {
    return Number(item.price || 0);
  }

  function total(items) {
    return items.reduce((sum, item) => sum + itemPrice(item) * Number(item.quantity || 1), 0);
  }

  function formatDateTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function updateCartCounter() {
    const count = cart().reduce((sum, item) => sum + Number(item.quantity || 1), 0);
    document.querySelectorAll('#cartCounter').forEach((el) => {
      el.textContent = String(count);
    });
    updateCheckoutShortcut(count);
  }

  function updateCheckoutShortcut(count) {
    let shortcut = document.querySelector('.checkout-shortcut');
    if (!shortcut) {
      shortcut = document.createElement('a');
      shortcut.className = 'checkout-shortcut';
      shortcut.href = 'checkout.html';
      document.body.appendChild(shortcut);
    }
    shortcut.textContent = `Završi narudžbu (${count})`;
    const isCheckoutPage = window.location.pathname.split('/').pop() === 'checkout.html';
    shortcut.hidden = !count || isCheckoutPage;
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const value = Math.random() * 16 | 0;
      return (char === 'x' ? value : (value & 0x3 | 0x8)).toString(16);
    });
  }

  function toLocalDateTimeInputValue(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function showToast(message) {
    let toast = document.querySelector('.cart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'cart-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `${escapeHtml(message)} <a href="checkout.html">Idi na tvoju narudžbu</a>`;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 3500);
  }

  function addToCart(id, name, price, option, options) {
    const items = cart();
    const normalizedOptions = Array.isArray(options) && options.length
      ? options.map((item) => ({
        label: item.label || 'Standardno',
        price: Number(item.price || 0),
      }))
      : [{ label: option || 'Standardno', price: Number(price || 0) }];
    const normalized = {
      id: String(id || name),
      name: String(name || 'Proizvod'),
      option: option || normalizedOptions[0].label,
      price: Number(price || normalizedOptions[0].price || 0),
      optionIndex: 0,
      options: normalizedOptions,
    };
    const existing = items.find((item) => (
      item.name === normalized.name
    ));

    if (existing) {
      existing.quantity += 1;
      existing.options = normalizedOptions;
      const selected = existing.options[Number(existing.optionIndex || 0)] || existing.options[0];
      existing.optionIndex = existing.options.indexOf(selected);
      existing.option = selected.label || 'Standardno';
      existing.price = Number(selected.price || 0);
    } else {
      items.push({ ...normalized, quantity: 1 });
    }

    saveCart(items);
    showToast('Dodano u narudžbu');
  }

  function setupMenuOrdering() {
    const specialOptions = buildSpecialOptions();

    document.querySelectorAll('.menu-item').forEach((item, index) => {
      const info = item.querySelector('.menu-info');
      const title = info ? info.querySelector('h3') : null;
      if (!info || !title || info.querySelector('.order-actions')) return;

      info.querySelectorAll('button[onclick*="addToCart"]').forEach((button) => button.remove());

      let prices = productPrices(item);
      const productName = title.textContent.trim();

      if (/^egg\s+burger$/i.test(productName) && specialOptions.burgerOptions.length) {
        prices = specialOptions.burgerOptions;
      }

      if (/^pizza\s+bianca$/i.test(productName) && specialOptions.pizzaOptions.length) {
        prices = specialOptions.pizzaOptions;
      }

      if (!prices.length) {
        prices.push({
          label: 'Cijena po dogovoru',
          price: 0,
        });
      }

      const actions = document.createElement('div');
      actions.className = 'order-actions';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button order-button';
      button.textContent = 'Dodaj u narudžbu';
      button.addEventListener('click', () => {
        addToCart(
          `${index}`,
          title.textContent.trim(),
          prices[0].price,
          prices[0].label,
          prices
        );
      });
      actions.appendChild(button);

      const allergenButton = info.querySelector('.allergen-btn');
      if (allergenButton) {
        let row = info.querySelector('.menu-action-row');
        if (!row) {
          row = document.createElement('div');
          row.className = 'menu-action-row';
          allergenButton.parentNode.insertBefore(row, allergenButton);
          row.appendChild(allergenButton);
        }
        row.appendChild(actions);
      } else {
        info.appendChild(actions);
      }
    });
    updateCartCounter();
  }

  function alignMenuActionRows() {
    document.querySelectorAll('.menu-item').forEach((item) => {
      const info = item.querySelector('.menu-info');
      const allergenButton = info ? info.querySelector('.allergen-btn') : null;
      const actions = info ? info.querySelector('.order-actions') : null;
      if (!info || !allergenButton || !actions) return;

      let row = info.querySelector('.menu-action-row');
      if (!row) {
        row = document.createElement('div');
        row.className = 'menu-action-row';
        info.appendChild(row);
      }
      if (allergenButton.parentElement !== row) row.appendChild(allergenButton);
      if (actions.parentElement !== row) row.appendChild(actions);
    });
  }

  function setupCheckout() {
    const list = document.getElementById('checkoutItems');
    const totalEl = document.getElementById('checkoutTotal');
    const emptyEl = document.getElementById('emptyCart');
    const form = document.getElementById('checkoutForm');
    const submit = document.getElementById('submitOrder');
    const message = document.getElementById('checkoutMessage');
    const orderTimeType = document.getElementById('orderTimeType');
    const scheduledForLabel = document.getElementById('scheduledForLabel');
    const scheduledForInput = document.getElementById('scheduledForInput');
    if (!list || !totalEl || !form) return;

    function setMinimumScheduleTime() {
      if (!scheduledForInput) return;
      const now = new Date();
      now.setMinutes(now.getMinutes() + 20);
      now.setSeconds(0, 0);
      scheduledForInput.min = toLocalDateTimeInputValue(now);
    }

    function updateScheduleFields() {
      const isScheduled = orderTimeType && orderTimeType.value === 'scheduled';
      if (scheduledForLabel) scheduledForLabel.hidden = !isScheduled;
      if (scheduledForInput) {
        scheduledForInput.required = !!isScheduled;
        scheduledForInput.disabled = !isScheduled;
        if (isScheduled) setMinimumScheduleTime();
        else scheduledForInput.value = '';
      }
    }

    if (orderTimeType) orderTimeType.addEventListener('change', updateScheduleFields);
    updateScheduleFields();

    function render() {
      const items = cart();
      list.textContent = '';
      if (emptyEl) emptyEl.hidden = items.length > 0;
      if (submit) submit.disabled = !items.length;

      items.forEach((item, index) => {
        const options = Array.isArray(item.options) && item.options.length
          ? item.options
          : [{ label: item.option || 'Standardno', price: Number(item.price || 0) }];
        const choiceLabel = /^egg\s+burger$/i.test(item.name)
          ? 'Odaberi burger'
          : (/^pizza\s+bianca$/i.test(item.name) ? 'Odaberi pizzu' : 'Veličina / varijanta');
        const row = document.createElement('div');
        row.className = 'cart-row';
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <label class="cart-option-label">
              ${choiceLabel}
              <select data-action="option" data-index="${index}">
                ${options.map((option, optionIndex) => `
                  <option value="${optionIndex}" ${Number(item.optionIndex || 0) === optionIndex ? 'selected' : ''}>
                    ${escapeHtml(option.label || 'Standardno')} - ${money(option.price)}
                  </option>
                `).join('')}
              </select>
            </label>
          </div>
          <div class="qty-controls">
            <button type="button" data-action="dec" data-index="${index}">-</button>
            <span>${item.quantity}</span>
            <button type="button" data-action="inc" data-index="${index}">+</button>
          </div>
          <strong>${money(itemPrice(item) * Number(item.quantity || 1))}</strong>
          <button class="remove-item" type="button" data-action="remove" data-index="${index}">Ukloni</button>
        `;
        list.appendChild(row);
      });

      totalEl.textContent = money(total(items));
      updateCartCounter();
    }

    list.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const items = cart();
      const index = Number(button.dataset.index);
      const item = items[index];
      if (!item) return;

      if (button.dataset.action === 'inc') item.quantity += 1;
      if (button.dataset.action === 'dec') item.quantity -= 1;
      if (button.dataset.action === 'remove' || item.quantity <= 0) items.splice(index, 1);
      saveCart(items);
      render();
    });

    list.addEventListener('change', (event) => {
      const select = event.target.closest('select[data-action="option"]');
      if (!select) return;
      const items = cart();
      const index = Number(select.dataset.index);
      const item = items[index];
      if (!item) return;
      const options = Array.isArray(item.options) && item.options.length
        ? item.options
        : [{ label: item.option || 'Standardno', price: Number(item.price || 0) }];
      const selected = options[Number(select.value)] || options[0];
      item.optionIndex = Number(select.value);
      item.option = selected.label || 'Standardno';
      item.price = Number(selected.price || 0);
      saveCart(items);
      render();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const items = cart();
      if (!items.length) return;

      if (!window.supabaseClient) {
        message.textContent = 'Supabase nije učitan. Provjeri supabase.js.';
        message.className = 'form-message is-error';
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Šaljem narudžbu...';
      message.textContent = '';

      const formData = new FormData(form);
      const orderId = createId();
      const isScheduled = formData.get('order_time_type') === 'scheduled';
      const scheduledFor = isScheduled ? String(formData.get('scheduled_for') || '') : '';
      if (isScheduled && !scheduledFor) {
        message.textContent = 'Odaberi vrijeme za zakazanu narudžbu.';
        message.className = 'form-message is-error';
        submit.disabled = false;
        submit.textContent = 'Pošalji narudžbu';
        return;
      }
      const payload = {
        id: orderId,
        customer_name: String(formData.get('customer_name') || '').trim(),
        phone: String(formData.get('phone') || '').trim(),
        address: String(formData.get('address') || '').trim(),
        note: String(formData.get('note') || '').trim(),
        delivery_type: formData.get('delivery_type'),
        payment_method: formData.get('payment_method'),
        items,
        total: total(items),
        status: 'novo',
      };
      if (isScheduled) {
        payload.scheduled_for = new Date(scheduledFor).toISOString();
        payload.is_scheduled = true;
      }

      const { error } = await window.supabaseClient.from('orders').insert(payload);
      if (error) {
        const missingScheduledColumn =
          error.message && (error.message.includes('is_scheduled') || error.message.includes('scheduled_for'));
        message.textContent = missingScheduledColumn
          ? 'Narudžba nije poslana: pokreni supabase-order-updates.sql u Supabase SQL Editoru pa probaj ponovno.'
          : 'Narudžba nije poslana: ' + error.message;
        message.className = 'form-message is-error';
        submit.disabled = false;
        submit.textContent = 'Pošalji narudžbu';
        return;
      }

      saveCart([]);
      localStorage.setItem('buldogLastOrder', JSON.stringify({ id: orderId, phone: payload.phone }));
      form.reset();
      updateScheduleFields();
      render();
      message.innerHTML = `Narudžba je poslana. Broj narudžbe je <strong>${escapeHtml(String(orderId).slice(0, 8))}</strong>. <a href="status.html?order=${encodeURIComponent(orderId)}">Prati status</a>.`;
      message.className = 'form-message is-success';
      submit.textContent = 'Pošalji narudžbu';
    });

    render();
  }

  function playAdminSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.85);
    } catch (error) {
      // Browser may block audio until the admin clicks the page.
    }
  }

  function statusSteps(currentStatus) {
    const steps = ['novo', 'prihvacena', 'priprema', 'dostava', 'zavrsena'];
    const currentIndex = steps.indexOf(currentStatus);
    return steps.map((step, index) => ({
      value: step,
      label: STATUS_LABELS[step],
      active: currentStatus === 'otkazana' ? false : index <= currentIndex,
    }));
  }

  function renderCustomerStatus(resultEl, order) {
    const cancelled = order.status === 'otkazana';
    const items = Array.isArray(order.items) ? order.items : [];
    resultEl.innerHTML = `
      <article class="customer-status ${cancelled ? 'is-cancelled' : ''}">
        <div class="admin-order-head">
          <div>
            <span class="order-number">#${escapeHtml(String(order.id).slice(0, 8))}</span>
            <h3>${cancelled ? 'Narudžba je otkazana' : STATUS_LABELS[order.status]}</h3>
          </div>
          <span class="status-pill">${STATUS_LABELS[order.status]}</span>
        </div>
        <div class="status-steps">
          ${statusSteps(order.status).map((step) => `
            <div class="status-step ${step.active ? 'is-active' : ''}">
              <span></span>
              <strong>${step.label}</strong>
            </div>
          `).join('')}
        </div>
        ${order.is_scheduled && order.scheduled_for ? `<p class="admin-note">Zakazano za: ${escapeHtml(formatDateTime(order.scheduled_for))}</p>` : ''}
        <ul class="admin-items">
          ${items.map((item) => `<li><strong>${escapeHtml(item.quantity)}x</strong> ${escapeHtml(item.name)} ${item.option ? `<span>${escapeHtml(item.option)}</span>` : ''}</li>`).join('')}
        </ul>
        <div class="admin-order-bottom">
          <strong>${money(order.total)}</strong>
          <span>${formatDateTime(order.created_at)}</span>
        </div>
        ${['novo', 'prihvacena', 'priprema'].includes(order.status) ? `<button class="danger-button cancel-order-button" type="button" data-cancel-order="${escapeHtml(order.id)}">Otkaži narudžbu</button>` : ''}
      </article>
    `;
  }

  function renderStatusList(resultEl, orders) {
    resultEl.textContent = '';
    orders.forEach((order) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'status-result-item';
      renderCustomerStatus(wrapper, order);
      resultEl.appendChild(wrapper.firstElementChild);
    });
  }

  function setupStatusPage() {
    const form = document.getElementById('statusForm');
    const orderInput = document.getElementById('statusOrderId');
    const phoneInput = document.getElementById('statusPhone');
    const result = document.getElementById('statusResult');
    if (!form || !orderInput || !phoneInput || !result) return;

    const params = new URLSearchParams(window.location.search);
    const stored = (() => {
      try {
        return JSON.parse(localStorage.getItem('buldogLastOrder') || 'null');
      } catch (error) {
        return null;
      }
    })();
    if (params.get('order')) orderInput.value = params.get('order');
    else if (stored && stored.id) orderInput.value = stored.id;
    if (stored && stored.phone) phoneInput.value = stored.phone;
    let refreshTimer = null;
    let statusChannel = null;

    async function checkStatus() {
      if (!window.supabaseClient) {
        result.innerHTML = '<p class="form-message is-error">Supabase nije učitan.</p>';
        return;
      }
      result.innerHTML = '<p class="form-message">Provjeravam status...</p>';
      const orderId = orderInput.value.trim();
      const phone = phoneInput.value.trim();
      const request = orderId
        ? window.supabaseClient.rpc('get_order_status', { p_order_id: orderId, p_phone: phone })
        : window.supabaseClient.rpc('get_orders_by_phone', { p_phone: phone });
      const { data, error } = await request;

      if (error) {
        result.innerHTML = `<p class="form-message is-error">Status nije moguće dohvatiti: ${escapeHtml(error.message)}</p>`;
        return;
      }
      if (!data || !data.length) {
        result.innerHTML = '<p class="form-message is-error">Narudžba nije pronađena. Provjeri broj narudžbe i telefon.</p>';
        return;
      }
      if (orderId) {
        renderCustomerStatus(result, data[0]);
        startStatusRealtime(data[0].id);
      } else {
        renderStatusList(result, data);
        data.forEach((order) => startStatusRealtime(order.id));
      }
      window.clearInterval(refreshTimer);
      refreshTimer = window.setInterval(checkStatus, 30000);
    }

    function startStatusRealtime(orderId) {
      if (!window.supabaseClient) return;
      if (!statusChannel) statusChannel = {};
      if (statusChannel[orderId]) return;
      statusChannel[orderId] = window.supabaseClient
        .channel(`order-status-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${orderId}`,
          },
          () => {
            checkStatus();
          }
        )
        .subscribe();
    }

    result.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-cancel-order]');
      if (!button || !window.supabaseClient) return;
      if (!phoneInput.value.trim()) {
        alert('Upiši telefon koji je korišten za narudžbu.');
        return;
      }
      if (!window.confirm('Želiš otkazati ovu narudžbu?')) return;
      button.disabled = true;
      button.textContent = 'Otkazujem...';
      const { data, error } = await window.supabaseClient.rpc('cancel_order', {
        p_order_id: button.dataset.cancelOrder,
        p_phone: phoneInput.value.trim(),
      });
      if (error || !data || !data.length) {
        alert(error ? 'Narudžba nije otkazana: ' + error.message : 'Narudžbu više nije moguće otkazati.');
        button.disabled = false;
        button.textContent = 'Otkaži narudžbu';
        return;
      }
      if (orderInput.value.trim()) renderCustomerStatus(result, data[0]);
      else checkStatus();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      checkStatus();
    });

    if (orderInput.value && phoneInput.value) checkStatus();
  }

  function orderCard(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const card = document.createElement('article');
    card.className = `admin-order status-${order.status || 'novo'}`;
    const scheduledHtml = order.is_scheduled && order.scheduled_for
      ? `<span class="admin-meta-badge admin-meta-badge--scheduled">Zakazano: ${escapeHtml(formatDateTime(order.scheduled_for))}</span>`
      : '';
    card.innerHTML = `
      <div class="admin-order-head">
        <div>
          <span class="order-number">#${String(order.id).slice(0, 8)}</span>
          <h3>${escapeHtml(order.customer_name || 'Kupac')}</h3>
          <p>${escapeHtml(order.phone || '')}</p>
        </div>
        <span class="status-pill">${STATUS_LABELS[order.status] || order.status}</span>
      </div>
      <div class="admin-order-meta">
        <span>${order.delivery_type === 'pickup' ? 'Preuzimanje' : 'Dostava'}</span>
        <span>${order.payment_method === 'card' ? 'Kartica' : 'Gotovina'}</span>
        <span>${formatDateTime(order.created_at)}</span>
        ${scheduledHtml}
      </div>
      <p class="admin-address">${escapeHtml(order.address || 'Bez adrese')}</p>
      <ul class="admin-items">
        ${items.map((item) => `<li><strong>${escapeHtml(item.quantity)}x</strong> ${escapeHtml(item.name)} ${item.option ? `<span>${escapeHtml(item.option)}</span>` : ''}</li>`).join('')}
      </ul>
      ${order.note ? `<p class="admin-note">${escapeHtml(order.note)}</p>` : ''}
      <div class="admin-order-bottom">
        <strong>${money(order.total)}</strong>
        <div class="admin-card-actions">
          <select data-order-status="${order.id}">
            ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${value === order.status ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
          <button class="danger-button" type="button" data-delete-order="${order.id}">Obriši</button>
        </div>
      </div>
    `;
    return card;
  }

  function setupAdmin() {
    const list = document.getElementById('adminOrders');
    const loginPanel = document.getElementById('adminLoginPanel');
    const appPanel = document.getElementById('adminAppPanel');
    const loginForm = document.getElementById('adminLoginForm');
    const loginMessage = document.getElementById('adminLoginMessage');
    const adminEmail = document.getElementById('adminEmail');
    const adminStats = document.getElementById('adminStats');
    const logoutBtn = document.getElementById('adminLogout');
    const deleteVisibleBtn = document.getElementById('deleteVisibleOrders');
    const soundBtn = document.getElementById('enableSound');
    const refreshBtn = document.getElementById('refreshOrders');
    const statusFilter = document.getElementById('statusFilter');
    const adminSearch = document.getElementById('adminSearch');
    const connection = document.getElementById('adminConnection');
    if (!list) return;

    let orders = [];
    let soundEnabled = true;
    let adminChannel = null;

    function updateSoundButton() {
      if (!soundBtn) return;
      soundBtn.textContent = soundEnabled ? 'Ugasi zvuk' : 'Uključi zvuk';
      soundBtn.classList.toggle('secondary-button', soundEnabled);
      soundBtn.classList.toggle('btn-primary', !soundEnabled);
      soundBtn.classList.toggle('is-muted', !soundEnabled);
    }

    function renderStats() {
      if (!adminStats) return;
      const counts = {
        all: orders.length,
        novo: 0,
        priprema: 0,
        dostava: 0,
        scheduled: 0,
      };
      orders.forEach((order) => {
        if (counts[order.status] !== undefined) counts[order.status] += 1;
        if (order.is_scheduled || order.scheduled_for) counts.scheduled += 1;
      });
      adminStats.innerHTML = `
        <div><strong>${counts.all}</strong><span>ukupno</span></div>
        <div><strong>${counts.novo}</strong><span>na čekanju</span></div>
        <div><strong>${counts.priprema}</strong><span>u pripremi</span></div>
        <div><strong>${counts.dostava}</strong><span>dostava</span></div>
        <div><strong>${counts.scheduled}</strong><span>zakazano</span></div>
      `;
    }

    function render() {
      const filter = statusFilter ? statusFilter.value : 'all';
      const query = adminSearch ? adminSearch.value.trim().toLowerCase() : '';
      const visible = orders.filter((order) => {
        const statusMatches = filter === 'all' || order.status === filter;
        if (!statusMatches) return false;
        if (!query) return true;
        const haystack = [
          order.id,
          order.customer_name,
          order.phone,
          order.address,
          order.note,
          order.status,
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      });
      renderStats();
      list.textContent = '';
      if (!visible.length) {
        const empty = document.createElement('p');
        empty.className = 'admin-empty';
        empty.textContent = 'Nema narudžbi za odabrani status.';
        list.appendChild(empty);
        return;
      }
      visible.forEach((order) => list.appendChild(orderCard(order)));
    }

    async function currentSession() {
      if (!window.supabaseClient) return null;
      const { data } = await window.supabaseClient.auth.getSession();
      return data.session || null;
    }

    async function isAdminSession(session) {
      if (!window.supabaseClient || !session || !session.user) return false;
      const { data, error } = await window.supabaseClient
        .from('admin_users')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      return !error && !!data;
    }

    function showAdminApp(session) {
      if (loginPanel) loginPanel.hidden = true;
      if (appPanel) appPanel.hidden = false;
      if (adminEmail) adminEmail.textContent = session && session.user ? session.user.email : '';
    }

    function showAdminLogin(message) {
      if (loginPanel) loginPanel.hidden = false;
      if (appPanel) appPanel.hidden = true;
      if (loginMessage) {
        loginMessage.textContent = message || '';
        loginMessage.className = message ? 'form-message is-error' : 'form-message';
      }
    }

    async function loadOrders() {
      if (!window.supabaseClient) {
        if (connection) connection.textContent = 'Supabase nije učitan.';
        return;
      }
      const session = await currentSession();
      if (!session) {
        showAdminLogin('Prijavi se za pregled admin narudžbi.');
        return;
      }
      const allowed = await isAdminSession(session);
      if (!allowed) {
        await window.supabaseClient.auth.signOut();
        showAdminLogin('Ovaj Supabase korisnik nije dodan kao admin.');
        return;
      }
      if (connection) connection.textContent = 'Učitavam narudžbe...';
      const { data, error } = await window.supabaseClient
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80);

      if (error) {
        if (connection) connection.textContent = 'Greska: ' + error.message;
        return;
      }

      orders = data || [];
      if (connection) connection.textContent = 'Spojeno. Čekam nove narudžbe.';
      render();
    }

    function startRealtime() {
      if (!window.supabaseClient || adminChannel) return;
      adminChannel = window.supabaseClient
        .channel('admin-orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          orders = [payload.new, ...orders.filter((order) => order.id !== payload.new.id)];
          if (soundEnabled) playAdminSound();
          render();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
          orders = orders.map((order) => order.id === payload.new.id ? payload.new : order);
          render();
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => {
          orders = orders.filter((order) => order.id !== payload.old.id);
          render();
        })
        .subscribe((status) => {
          if (connection && status === 'SUBSCRIBED') connection.textContent = 'Spojeno. Čekam nove narudžbe.';
        });
    }

    list.addEventListener('change', async (event) => {
      const select = event.target.closest('select[data-order-status]');
      if (!select || !window.supabaseClient) return;
      const id = select.dataset.orderStatus;
      const status = select.value;
      const { error } = await window.supabaseClient.from('orders').update({ status }).eq('id', id);
      if (error) {
        alert('Status nije spremljen: ' + error.message);
        loadOrders();
        return;
      }
      orders = orders.map((order) => order.id === id ? { ...order, status } : order);
      render();
    });

    list.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-delete-order]');
      if (!button || !window.supabaseClient) return;
      const id = button.dataset.deleteOrder;
      const order = orders.find((item) => item.id === id);
      const label = order ? `${order.customer_name || 'narudžbu'} #${String(order.id).slice(0, 8)}` : 'ovu narudžbu';
      if (!window.confirm(`Obrisati ${label}?`)) return;

      button.disabled = true;
      button.textContent = 'Brišem...';
      const { data, error } = await window.supabaseClient
        .from('orders')
        .delete()
        .eq('id', id)
        .select('id');
      if (error) {
        alert('Narudžba nije obrisana: ' + error.message);
        button.disabled = false;
        button.textContent = 'Obriši';
        return;
      }
      if (!data || !data.length) {
        alert('Supabase nije potvrdio brisanje. Provjeri RLS delete policy.');
        button.disabled = false;
        button.textContent = 'Obriši';
        return;
      }
      orders = orders.filter((item) => !data.some((deleted) => deleted.id === item.id));
      render();
    });

    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        updateSoundButton();
        if (soundEnabled) playAdminSound();
      });
    }
    updateSoundButton();
    if (refreshBtn) refreshBtn.addEventListener('click', loadOrders);
    if (statusFilter) statusFilter.addEventListener('change', render);
    if (adminSearch) adminSearch.addEventListener('input', render);
    if (deleteVisibleBtn) {
      deleteVisibleBtn.addEventListener('click', async () => {
        if (!window.supabaseClient) return;
        const filter = statusFilter ? statusFilter.value : 'all';
        const visible = filter === 'all' ? orders : orders.filter((order) => order.status === filter);
        if (!visible.length) {
          alert('Nema narudžbi za brisanje.');
          return;
        }
        const text = filter === 'all'
          ? `Obrisati svih ${visible.length} narudžbi?`
          : `Obrisati ${visible.length} narudžbi sa statusom "${STATUS_LABELS[filter] || filter}"?`;
        if (!window.confirm(text)) return;

        deleteVisibleBtn.disabled = true;
        deleteVisibleBtn.textContent = 'Brišem...';
        const ids = visible.map((order) => order.id);
        const { data, error } = await window.supabaseClient
          .from('orders')
          .delete()
          .in('id', ids)
          .select('id');
        deleteVisibleBtn.disabled = false;
        deleteVisibleBtn.textContent = 'Obriši prikazane';
        if (error) {
          alert('Narudžbe nisu obrisane: ' + error.message);
          return;
        }
        const deletedIds = (data || []).map((order) => order.id);
        if (!deletedIds.length) {
          alert('Supabase nije potvrdio brisanje. Provjeri RLS delete policy.');
          return;
        }
        orders = orders.filter((order) => !deletedIds.includes(order.id));
        render();
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!window.supabaseClient) return;
        const formData = new FormData(loginForm);
        if (loginMessage) {
          loginMessage.textContent = 'Prijava...';
          loginMessage.className = 'form-message';
        }
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
          email: String(formData.get('email') || '').trim(),
          password: String(formData.get('password') || ''),
        });
        if (error) {
          showAdminLogin('Prijava nije uspjela: ' + error.message);
          return;
        }
        const allowed = await isAdminSession(data.session);
        if (!allowed) {
          await window.supabaseClient.auth.signOut();
          showAdminLogin('Prijava je uspješna, ali korisnik nije dodan kao admin.');
          return;
        }
        showAdminApp(data.session);
        loginForm.reset();
        startRealtime();
        loadOrders();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (window.supabaseClient) await window.supabaseClient.auth.signOut();
        if (adminChannel && window.supabaseClient) {
          await window.supabaseClient.removeChannel(adminChannel);
          adminChannel = null;
        }
        orders = [];
        render();
        showAdminLogin('');
      });
    }

    currentSession().then(async (session) => {
      if (session && await isAdminSession(session)) {
        showAdminApp(session);
        startRealtime();
        loadOrders();
      } else {
        if (session) await window.supabaseClient.auth.signOut();
        showAdminLogin('');
      }
    });
  }

  window.addToCart = addToCart;
  window.BuldogOrders = { cart, saveCart, updateCartCounter, money };

  document.addEventListener('DOMContentLoaded', () => {
    setupMenuOrdering();
    window.setTimeout(alignMenuActionRows, 0);
    setupCheckout();
    setupStatusPage();
    setupAdmin();
    updateCartCounter();
  });

  document.addEventListener('buldog:prices-loaded', () => {
    setupMenuOrdering();
    alignMenuActionRows();
  });
})();
