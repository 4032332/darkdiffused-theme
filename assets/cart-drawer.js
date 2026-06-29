(function () {
  'use strict';

  /* ── State ────────────────────────────────────────────────────────────── */
  var noteDebounceTimer = null;
  var qtyLocked = false;

  /* ── DOM refs ─────────────────────────────────────────────────────────── */
  var drawer, overlay, closeBtn, continueBtn, itemsEl, metaEl, totalEl, noteToggle, noteInput;

  /* ── Open / close ─────────────────────────────────────────────────────── */
  function openDrawer() {
    drawer.removeAttribute('hidden');
    requestAnimationFrame(function () {
      drawer.classList.add('is-open');
      overlay.classList.add('is-open');
    });
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
    refreshCart();
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    var trigger = document.querySelector('[data-cart-trigger]');
    if (trigger) trigger.focus();
  }

  /* ── Fetch & re-render ────────────────────────────────────────────────── */
  function refreshCart() {
    itemsEl.classList.add('is-loading');
    fetch('/cart.js')
      .then(function (r) { return r.json(); })
      .then(function (cart) { renderCart(cart); })
      .catch(function () { itemsEl.classList.remove('is-loading'); });
  }

  function renderCart(cart) {
    metaEl.textContent = cart.item_count + (cart.item_count === 1 ? ' item' : ' items');
    totalEl.textContent = formatMoney(cart.total_price);

    document.querySelectorAll('.cart-count').forEach(function (el) {
      el.textContent = cart.item_count > 0 ? String(cart.item_count) : '';
      el.dataset.count = cart.item_count;
    });

    while (itemsEl.firstChild) itemsEl.removeChild(itemsEl.firstChild);

    if (cart.item_count === 0) {
      var empty = mkEl('div', 'cart-drawer__empty');
      var rule = mkEl('div', 'cart-drawer__empty-rule');
      var msg = mkEl('p', 'cart-drawer__empty-text');
      msg.textContent = 'Your bag is empty.';
      var link = mkEl('a', 'cart-drawer__empty-link');
      link.href = '/collections/all';
      link.textContent = 'Explore the ranges →';
      empty.appendChild(rule);
      empty.appendChild(msg);
      empty.appendChild(link);
      itemsEl.appendChild(empty);
    } else {
      cart.items.forEach(function (item) {
        itemsEl.appendChild(buildItemEl(item));
      });
      bindItemEvents();
    }

    itemsEl.classList.remove('is-loading');
  }

  /* Build a single cart item using safe DOM methods — no innerHTML with user data */
  function buildItemEl(item) {
    var row = mkEl('div', 'cart-item');
    row.dataset.key = item.key;

    /* Image link */
    var imgLink = mkEl('a', 'cart-item__img-wrap');
    imgLink.href = item.url;
    imgLink.tabIndex = -1;
    if (item.image) {
      var img = mkEl('img', 'cart-item__img');
      img.src = item.image;
      img.alt = item.title;
      img.width = 80;
      img.height = 100;
      img.loading = 'lazy';
      imgLink.appendChild(img);
    } else {
      var ph = mkEl('div', 'cart-item__img-placeholder');
      var letter = mkEl('span');
      letter.textContent = item.product_title ? item.product_title.slice(0, 1) : '';
      ph.appendChild(letter);
      imgLink.appendChild(ph);
    }
    row.appendChild(imgLink);

    /* Details column */
    var details = mkEl('div', 'cart-item__details');

    var type = mkEl('span', 'cart-item__type');
    type.textContent = item.product_type || '';
    details.appendChild(type);

    var nameLink = mkEl('a', 'cart-item__name');
    nameLink.href = item.url;
    nameLink.textContent = item.product_title || item.title;
    details.appendChild(nameLink);

    if (item.variant_title && item.variant_title !== 'Default Title') {
      var variant = mkEl('span', 'cart-item__variant');
      variant.textContent = item.variant_title;
      details.appendChild(variant);
    }

    var qty = mkEl('div', 'cart-item__qty');
    qty.dataset.key = item.key;

    var decBtn = mkEl('button', 'cart-item__qty-btn');
    decBtn.dataset.action = 'decrement';
    decBtn.setAttribute('aria-label', 'Decrease quantity');
    decBtn.textContent = '−';
    if (item.quantity <= 1) decBtn.disabled = true;

    var qtyVal = mkEl('span', 'cart-item__qty-val');
    qtyVal.textContent = String(item.quantity);

    var incBtn = mkEl('button', 'cart-item__qty-btn');
    incBtn.dataset.action = 'increment';
    incBtn.setAttribute('aria-label', 'Increase quantity');
    incBtn.textContent = '+';

    qty.appendChild(decBtn);
    qty.appendChild(qtyVal);
    qty.appendChild(incBtn);
    details.appendChild(qty);
    row.appendChild(details);

    /* Right column */
    var right = mkEl('div', 'cart-item__right');

    var price = mkEl('span', 'cart-item__price');
    price.textContent = formatMoney(item.final_line_price);
    right.appendChild(price);

    var removeBtn = mkEl('button', 'cart-item__remove');
    removeBtn.dataset.key = item.key;
    removeBtn.setAttribute('aria-label', 'Remove ' + item.title);
    removeBtn.textContent = 'Remove';
    right.appendChild(removeBtn);

    row.appendChild(right);
    return row;
  }

  /* ── Cart mutations ───────────────────────────────────────────────────── */
  function addToCart(variantId) {
    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: 1 })
    }).then(function (r) { return r.json(); });
  }

  function changeQty(key, quantity) {
    return fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: key, quantity: quantity })
    }).then(function (r) { return r.json(); });
  }

  function updateNote(note) {
    return fetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ note: note })
    }).then(function (r) { return r.json(); });
  }

  /* ── Bind events on dynamically rendered items ────────────────────────── */
  function bindItemEvents() {
    itemsEl.querySelectorAll('.cart-item__qty').forEach(function (qtyEl) {
      qtyEl.querySelectorAll('.cart-item__qty-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (qtyLocked) return;
          var key = qtyEl.dataset.key;
          var valEl = qtyEl.querySelector('.cart-item__qty-val');
          var current = parseInt(valEl.textContent, 10);
          var next = btn.dataset.action === 'increment' ? current + 1 : current - 1;
          if (next < 1) return;
          qtyLocked = true;
          valEl.textContent = String(next);
          setTimeout(function () {
            changeQty(key, next)
              .then(function (cart) { renderCart(cart); qtyLocked = false; })
              .catch(function () { qtyLocked = false; refreshCart(); });
          }, 200);
        });
      });
    });

    itemsEl.querySelectorAll('.cart-item__remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (qtyLocked) return;
        qtyLocked = true;
        changeQty(btn.dataset.key, 0)
          .then(function (cart) { renderCart(cart); qtyLocked = false; })
          .catch(function () { qtyLocked = false; refreshCart(); });
      });
    });
  }

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  function mkEl(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* ── Public API ───────────────────────────────────────────────────────── */
  window.CartDrawer = {
    open: openDrawer,
    close: closeDrawer,
    addAndOpen: function (variantId, quantity) {
      return fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: quantity || 1 })
      })
        .then(function (r) { return r.json(); })
        .then(function () { openDrawer(); });
    }
  };

  /* ── Init ─────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    drawer      = document.getElementById('cart-drawer');
    overlay     = document.getElementById('cart-overlay');
    closeBtn    = document.getElementById('cart-drawer-close');
    continueBtn = document.getElementById('cart-drawer-continue');
    itemsEl     = document.getElementById('cart-drawer-items');
    metaEl      = document.getElementById('cart-drawer-meta');
    totalEl     = document.getElementById('cart-drawer-total');
    noteToggle  = document.getElementById('cart-note-toggle');
    noteInput   = document.getElementById('cart-note-input');

    if (!drawer) return;

    /* Cart trigger in header */
    document.querySelectorAll('[data-cart-trigger]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openDrawer();
      });
    });

    /* Quick-add on product cards (delegated) */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-quick-add]');
      if (!btn) return;
      e.preventDefault();
      var variantId = parseInt(btn.dataset.variantId, 10);
      if (!variantId) return;
      btn.disabled = true;
      addToCart(variantId)
        .then(function () { openDrawer(); })
        .catch(function () { window.location.href = '/cart'; })
        .finally(function () { btn.disabled = false; });
    });

    /* Close */
    closeBtn.addEventListener('click', closeDrawer);
    continueBtn.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
    });

    /* Order note toggle */
    noteToggle.addEventListener('click', function () {
      var expanded = noteToggle.getAttribute('aria-expanded') === 'true';
      noteToggle.setAttribute('aria-expanded', String(!expanded));
      if (expanded) {
        noteInput.setAttribute('hidden', '');
      } else {
        noteInput.removeAttribute('hidden');
        noteInput.focus();
      }
    });

    /* Order note — debounced save */
    noteInput.addEventListener('input', function () {
      clearTimeout(noteDebounceTimer);
      noteDebounceTimer = setTimeout(function () {
        updateNote(noteInput.value);
      }, 600);
    });
  });

})();
