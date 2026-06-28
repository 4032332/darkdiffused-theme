# Gentleman's Study Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full Gentleman's Study atmospheric upgrade — filament interaction system, Edison SVG bulb in hero, product card quick-add with AJAX, and slide-in sidecar cart drawer.

**Architecture:** Shared filament CSS loaded globally; cart drawer rendered as a Liquid snippet with a vanilla JS controller; product card quick-add fires AJAX and opens the drawer; hero bulb replaced with a detailed inline SVG.

**Tech Stack:** Shopify Liquid, vanilla JS (ES2020, no build step), CSS custom properties, Shopify Cart AJAX API (`/cart/add.js`, `/cart/change.js`, `/cart/update.js`, `/cart.js`)

**Spec:** `docs/superpowers/specs/2026-06-28-gentleman-study-upgrade-design.md`

---

## Chunk 1: Filament CSS + Header Wiring

### Task 1: Create `assets/filament.css`

**Files:**
- Create: `assets/filament.css`

- [ ] Create `assets/filament.css` with the shared keyframes and `.filament-target` utility:

```css
/* ── Filament interaction system ──────────────────────────────────────────
   Apply .filament-target to any element whose top edge should ignite on hover.
   The parent must have position:relative and overflow:hidden.
   The ::before pseudo-element is the glowing wire.
────────────────────────────────────────────────────────────────────────── */

@keyframes filament-ignite {
  0%   { transform: scaleX(0); opacity: 0; }
  12%  { opacity: 1; }
  100% { transform: scaleX(1); opacity: 1; }
}

@keyframes filament-flicker {
  0%, 100% { opacity: 1;    filter: brightness(1); }
  18%       { opacity: 0.82; filter: brightness(0.88); }
  35%       { opacity: 1;    filter: brightness(1.06); }
  60%       { opacity: 0.9;  filter: brightness(0.94); }
  78%       { opacity: 1;    filter: brightness(1.02); }
}

/* White-hot core, orange mid, deep amber at edges */
.filament-target {
  position: relative;
  overflow: hidden;
}

.filament-target::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  transform: scaleX(0);
  transform-origin: center;
  background: linear-gradient(90deg,
    transparent                   0%,
    rgba(180, 80, 10, 0.4)        6%,
    rgba(255, 120, 20, 0.8)      18%,
    rgba(255, 200, 80, 1)        30%,
    rgba(255, 245, 220, 1)       44%,
    rgba(255, 255, 255, 1)       50%,
    rgba(255, 245, 220, 1)       56%,
    rgba(255, 200, 80, 1)        70%,
    rgba(255, 120, 20, 0.8)      82%,
    rgba(180, 80, 10, 0.4)       94%,
    transparent                  100%
  );
  box-shadow:
    0 0 1px  rgba(255, 255, 255, 1),
    0 0 4px  rgba(255, 255, 200, 0.9),
    0 0 10px rgba(255, 140, 30, 0.7),
    0 0 24px rgba(220, 90, 10, 0.45),
    0 0 48px rgba(160, 50, 5, 0.2);
  pointer-events: none;
  opacity: 0;
}

.filament-target:hover::before {
  animation:
    filament-ignite  0.5s cubic-bezier(0.2, 0, 0.4, 1) forwards,
    filament-flicker 3.2s ease-in-out 0.5s infinite;
}

/* Permanent variant — always burning, used on cart drawer header */
.filament-permanent::before {
  animation:
    filament-ignite  0.6s cubic-bezier(0.2, 0, 0.4, 1) forwards,
    filament-flicker 3.5s ease-in-out 0.6s infinite;
}
```

- [ ] Verify the file saved correctly:
```bash
grep -c "filament-ignite" assets/filament.css
```
Expected output: `2`

- [ ] Commit:
```bash
git add assets/filament.css
git commit -m "feat: add shared filament interaction CSS system"
```

---

### Task 2: Load `filament.css` in `layout/theme.liquid` and wire nav links

**Files:**
- Modify: `layout/theme.liquid` (line ~32)
- Modify: `sections/header.liquid` (nav classes + cart trigger)

- [ ] In `layout/theme.liquid`, add the filament stylesheet tag directly after the `base.css` tag (line 32):

```liquid
  {{ 'base.css' | asset_url | stylesheet_tag }}
  {{ 'filament.css' | asset_url | stylesheet_tag }}
```

- [ ] In `sections/header.liquid`, add `filament-target` to the nav link `<a>` and the collections trigger `<button>`:

Line ~342 — home link:
```liquid
<a href="/" class="filament-target" {% if request.path == '/' %}aria-current="page"{% endif %}>Home</a>
```

Line ~346 — collections trigger button:
```liquid
<button class="site-nav__trigger filament-target" aria-expanded="false" aria-controls="collections-dropdown">
```

Line ~368 — Our Scents link:
```liquid
<a href="/pages/our-scents" class="filament-target">Our Scents</a>
```

- [ ] Also in `sections/header.liquid`, update the cart `<a>` (line ~385) to add `data-cart-trigger` (JS intercepts click, href is no-JS fallback):

```liquid
<a href="/cart" class="header-cart filament-target" data-cart-trigger aria-label="Cart — {{ cart.item_count }} items">
```

- [ ] Commit:
```bash
git add layout/theme.liquid sections/header.liquid
git commit -m "feat: load filament CSS, wire filament to nav links and cart trigger"
```

---

## Chunk 2: Sidecar Cart Drawer

### Task 3: Create `snippets/cart-drawer.liquid`

**Files:**
- Create: `snippets/cart-drawer.liquid`

- [ ] Create `snippets/cart-drawer.liquid`:

```liquid
<div class="cart-overlay" id="cart-overlay" aria-hidden="true"></div>

<div class="cart-drawer filament-permanent" id="cart-drawer" role="dialog" aria-modal="true" aria-label="Your bag" hidden>

  <div class="cart-drawer__header">
    <div class="cart-drawer__header-top">
      <span class="cart-drawer__eyebrow">The Bag</span>
      <button class="cart-drawer__close" id="cart-drawer-close" aria-label="Close cart">&#x2715;</button>
    </div>
    <div class="cart-drawer__title">Your Selection</div>
    <div class="cart-drawer__meta" id="cart-drawer-meta">
      {{ cart.item_count }} {% if cart.item_count == 1 %}item{% else %}items{% endif %}
    </div>
  </div>

  <div class="cart-drawer__items" id="cart-drawer-items">
    {% if cart.item_count == 0 %}
      <div class="cart-drawer__empty">
        <div class="cart-drawer__empty-rule"></div>
        <p class="cart-drawer__empty-text">Your bag is empty.</p>
        <a href="/collections/all" class="cart-drawer__empty-link">Explore the ranges &#x2192;</a>
      </div>
    {% else %}
      {% for item in cart.items %}
        <div class="cart-item" data-key="{{ item.key | escape }}">
          <a href="{{ item.url | escape }}" class="cart-item__img-wrap" tabindex="-1">
            {% if item.image %}
              <img
                class="cart-item__img"
                src="{{ item.image | image_url: width: 160 }}"
                alt="{{ item.image.alt | escape | default: item.title }}"
                width="80" height="100" loading="lazy"
              >
            {% else %}
              <div class="cart-item__img-placeholder">
                <span>{{ item.title | slice: 0 }}</span>
              </div>
            {% endif %}
          </a>

          <div class="cart-item__details">
            <span class="cart-item__type">{{ item.product.type | escape }}</span>
            <a href="{{ item.url | escape }}" class="cart-item__name">{{ item.product.title | escape }}</a>
            {% if item.variant.title != 'Default Title' %}
              <span class="cart-item__variant">{{ item.variant.title | escape }}</span>
            {% endif %}
            <div class="cart-item__qty" data-key="{{ item.key | escape }}">
              <button class="cart-item__qty-btn" data-action="decrement" aria-label="Decrease quantity">&#x2212;</button>
              <span class="cart-item__qty-val">{{ item.quantity }}</span>
              <button class="cart-item__qty-btn" data-action="increment" aria-label="Increase quantity">&#x2B;</button>
            </div>
          </div>

          <div class="cart-item__right">
            <span class="cart-item__price">{{ item.final_line_price | money }}</span>
            <button class="cart-item__remove" data-key="{{ item.key | escape }}" aria-label="Remove {{ item.title | escape }}">Remove</button>
          </div>
        </div>
      {% endfor %}
    {% endif %}
  </div>

  <div class="cart-drawer__note-section">
    <button class="cart-drawer__note-toggle" id="cart-note-toggle" aria-expanded="false">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="cart-note-icon">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Add a note to your order
    </button>
    <textarea
      class="cart-drawer__note-input"
      id="cart-note-input"
      rows="2"
      placeholder="Any special instructions&#x2026;"
      aria-label="Order note"
      hidden
    >{{ cart.note | escape }}</textarea>
  </div>

  <div class="cart-drawer__footer">
    <div class="cart-drawer__subtotal-row">
      <span class="cart-drawer__subtotal-label">Subtotal</span>
      <span class="cart-drawer__subtotal-amount" id="cart-drawer-total">{{ cart.total_price | money }}</span>
    </div>
    {% if cart.total_price >= 8000 %}
      <p class="cart-drawer__shipping-note">Free shipping applied &#x2713;</p>
    {% else %}
      {% assign remaining = 8000 | minus: cart.total_price %}
      <p class="cart-drawer__shipping-note">{{ remaining | money }} away from free shipping</p>
    {% endif %}

    <a href="/checkout" class="btn-brass filament-target cart-drawer__checkout">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
      </svg>
      Proceed to Checkout
    </a>
    <button class="cart-drawer__continue" id="cart-drawer-continue">&#x2190; Continue Shopping</button>

    <div class="cart-drawer__trust">
      <span class="cart-drawer__trust-item">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Secure checkout
      </span>
      <span class="cart-drawer__trust-item">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        All major cards
      </span>
      <span class="cart-drawer__trust-item">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        AU shipping
      </span>
    </div>
  </div>

</div>
```

- [ ] Commit:
```bash
git add snippets/cart-drawer.liquid
git commit -m "feat: add cart drawer Liquid snippet"
```

---

### Task 4: Create `assets/cart-drawer.css`

**Files:**
- Create: `assets/cart-drawer.css`

- [ ] Create `assets/cart-drawer.css`:

```css
/* ── Cart overlay ─────────────────────────────────────────────────────── */
.cart-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.35s ease;
}
.cart-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}

/* ── Drawer shell ─────────────────────────────────────────────────────── */
.cart-drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 420px;
  z-index: 201;
  display: flex;
  flex-direction: column;
  background:
    repeating-linear-gradient(
      90.4deg,
      transparent 0px, transparent 9px,
      rgba(60, 30, 8, 0.09) 9px, rgba(60, 30, 8, 0.09) 10px
    ),
    linear-gradient(180deg, #1A0E04 0%, #120A02 100%);
  border-left: 1px solid rgba(200, 133, 26, 0.2);
  box-shadow: -24px 0 80px rgba(0, 0, 0, 0.7);
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.cart-drawer.is-open {
  transform: translateX(0);
}
/* hidden attr overridden — keep flex layout when JS removes hidden */
.cart-drawer[hidden] { display: flex; }

@media (max-width: 480px) {
  .cart-drawer { width: 100vw; }
}

/* ── Header ───────────────────────────────────────────────────────────── */
.cart-drawer__header {
  padding: 24px 28px 20px;
  border-bottom: 1px solid rgba(200, 133, 26, 0.12);
  flex-shrink: 0;
  position: relative; /* filament-permanent ::before anchors here */
}
.cart-drawer__header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.cart-drawer__eyebrow {
  font-size: 8px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(139, 105, 20, 0.6);
  font-family: var(--font-ui, 'Inter', sans-serif);
}
.cart-drawer__close {
  width: 32px; height: 32px;
  background: none;
  border: 1px solid rgba(212, 174, 80, 0.15);
  color: #7A6848;
  cursor: pointer;
  font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.2s, border-color 0.2s;
}
.cart-drawer__close:hover { color: #D4AE50; border-color: rgba(212, 174, 80, 0.4); }
.cart-drawer__title {
  font-family: var(--font-display, 'Playfair Display', serif);
  font-size: 22px; font-weight: 700;
  color: #D4B896;
}
.cart-drawer__meta {
  font-size: 11px; color: #6A5830;
  margin-top: 2px; letter-spacing: 0.05em;
}

/* ── Items list ───────────────────────────────────────────────────────── */
.cart-drawer__items {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.cart-drawer__items::-webkit-scrollbar { width: 3px; }
.cart-drawer__items::-webkit-scrollbar-track { background: transparent; }
.cart-drawer__items::-webkit-scrollbar-thumb { background: rgba(212, 174, 80, 0.2); border-radius: 2px; }

/* Empty state */
.cart-drawer__empty {
  padding: 48px 28px;
  text-align: center;
}
.cart-drawer__empty-rule {
  width: 40px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212,174,80,0.4), transparent);
  margin: 0 auto 24px;
}
.cart-drawer__empty-text {
  font-family: var(--font-display, 'Playfair Display', serif);
  font-style: italic;
  font-size: 18px;
  color: #5A4A2A;
  margin-bottom: 16px;
}
.cart-drawer__empty-link {
  font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
  color: #C8A840; text-decoration: none;
  transition: color 0.2s;
}
.cart-drawer__empty-link:hover { color: #D4AE50; }

/* Individual cart item */
.cart-item {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  gap: 16px;
  padding: 20px 28px;
  border-bottom: 1px solid rgba(212, 174, 80, 0.06);
  align-items: start;
  transition: background 0.2s;
}
.cart-item:hover { background: rgba(212, 174, 80, 0.025); }

.cart-item__img-wrap { display: block; flex-shrink: 0; }
.cart-item__img {
  width: 80px; height: 100px;
  object-fit: cover;
  border: 1px solid rgba(212, 174, 80, 0.1);
  display: block;
}
.cart-item__img-placeholder {
  width: 80px; height: 100px;
  background: linear-gradient(160deg, #100A04, #080502);
  border: 1px solid rgba(212, 174, 80, 0.1);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display, 'Playfair Display', serif);
  font-size: 24px; color: rgba(212, 174, 80, 0.2);
}

.cart-item__details { min-width: 0; }
.cart-item__type {
  display: block;
  font-size: 8px; letter-spacing: 0.2em; text-transform: uppercase;
  color: rgba(139, 105, 20, 0.6);
  margin-bottom: 4px;
}
.cart-item__name {
  display: block;
  font-family: var(--font-display, 'Playfair Display', serif);
  font-size: 15px; font-weight: 600;
  color: #D4B896; line-height: 1.25;
  text-decoration: none;
  margin-bottom: 4px;
  transition: color 0.2s;
}
.cart-item__name:hover { color: #EAD8B8; }
.cart-item__variant {
  display: block;
  font-size: 10px; color: #4A3A1A;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
}

/* Qty stepper */
.cart-item__qty {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(212, 174, 80, 0.15);
  margin-top: 8px;
}
.cart-item__qty-btn {
  width: 28px; height: 28px;
  background: none; border: none;
  color: #8A6828; font-size: 14px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.2s, background 0.2s;
  line-height: 1;
}
.cart-item__qty-btn:hover { color: #D4AE50; background: rgba(212, 174, 80, 0.06); }
.cart-item__qty-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.cart-item__qty-val {
  width: 32px; text-align: center;
  font-size: 12px; color: #C8A840;
  border-left: 1px solid rgba(212, 174, 80, 0.15);
  border-right: 1px solid rgba(212, 174, 80, 0.15);
  padding: 6px 0; line-height: 16px;
  pointer-events: none;
}

.cart-item__right {
  display: flex; flex-direction: column;
  align-items: flex-end; gap: 8px;
  flex-shrink: 0;
}
.cart-item__price { font-size: 14px; color: #C8A840; white-space: nowrap; }
.cart-item__remove {
  background: none; border: none; cursor: pointer;
  font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
  color: #3A2A0A; font-family: var(--font-ui, 'Inter', sans-serif);
  transition: color 0.2s; padding: 0;
}
.cart-item__remove:hover { color: rgba(212, 174, 80, 0.5); }

/* ── Order note ───────────────────────────────────────────────────────── */
.cart-drawer__note-section {
  padding: 16px 28px;
  border-bottom: 1px solid rgba(212, 174, 80, 0.06);
  flex-shrink: 0;
}
.cart-drawer__note-toggle {
  background: none; border: none; cursor: pointer;
  font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
  color: #5A4A2A;
  display: flex; align-items: center; gap: 6px;
  transition: color 0.2s;
  font-family: var(--font-ui, 'Inter', sans-serif);
  padding: 0;
}
.cart-drawer__note-toggle:hover { color: #D4AE50; }
.cart-drawer__note-toggle svg { transition: transform 0.25s; }
.cart-drawer__note-toggle[aria-expanded="true"] svg { transform: rotate(45deg); }
.cart-drawer__note-input {
  width: 100%; margin-top: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(212, 174, 80, 0.12);
  color: #D4B896;
  font-family: var(--font-ui, 'Inter', sans-serif);
  font-size: 12px; font-style: italic;
  resize: none; line-height: 1.5; outline: none;
  transition: border-color 0.2s;
}
.cart-drawer__note-input::placeholder { color: #3A2A0A; }
.cart-drawer__note-input:focus { border-color: rgba(212, 174, 80, 0.3); }
.cart-drawer__note-input[hidden] { display: none; }

/* ── Footer ───────────────────────────────────────────────────────────── */
.cart-drawer__footer {
  padding: 20px 28px 28px;
  border-top: 1px solid rgba(200, 133, 26, 0.12);
  flex-shrink: 0;
  background: linear-gradient(0deg, rgba(10, 6, 2, 0.6), transparent);
}
.cart-drawer__subtotal-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}
.cart-drawer__subtotal-label {
  font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase;
  color: #5A4A2A;
  font-family: var(--font-ui, 'Inter', sans-serif);
}
.cart-drawer__subtotal-amount {
  font-family: var(--font-display, 'Playfair Display', serif);
  font-size: 22px; color: #C8A840;
}
.cart-drawer__shipping-note {
  font-size: 10px; color: #3A2A0A;
  letter-spacing: 0.05em; margin-bottom: 20px;
}
.cart-drawer__checkout {
  display: flex; align-items: center; justify-content: center;
  gap: 10px; width: 100%;
  text-decoration: none;
}
.cart-drawer__continue {
  display: block; width: 100%; margin-top: 10px; padding: 10px;
  background: none; border: none; cursor: pointer;
  font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
  color: #3A2A0A; font-family: var(--font-ui, 'Inter', sans-serif);
  transition: color 0.2s; text-align: center;
}
.cart-drawer__continue:hover { color: rgba(212, 174, 80, 0.5); }

/* Trust row */
.cart-drawer__trust {
  display: flex; gap: 16px; justify-content: center;
  margin-top: 16px; padding-top: 16px;
  border-top: 1px solid rgba(212, 174, 80, 0.06);
  flex-wrap: wrap;
}
.cart-drawer__trust-item {
  display: flex; align-items: center; gap: 5px;
  font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
  color: #3A2A0A;
  font-family: var(--font-ui, 'Inter', sans-serif);
}
.cart-drawer__trust-item svg { opacity: 0.35; flex-shrink: 0; }

/* Loading state */
.cart-drawer__items.is-loading { opacity: 0.5; pointer-events: none; }
```

- [ ] Commit:
```bash
git add assets/cart-drawer.css
git commit -m "feat: add cart drawer styles"
```

---

### Task 5: Create `assets/cart-drawer.js`

**Files:**
- Create: `assets/cart-drawer.js`

All dynamic HTML is built using `textContent` and `setAttribute` for safe DOM construction — no `innerHTML` with untrusted data. The only place `innerHTML` is used is for the static empty-state HTML that contains no user data.

- [ ] Create `assets/cart-drawer.js`:

```js
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
    // Header meta
    metaEl.textContent = cart.item_count + (cart.item_count === 1 ? ' item' : ' items');
    totalEl.textContent = formatMoney(cart.total_price);

    // Header cart count badge
    document.querySelectorAll('.cart-count').forEach(function (el) {
      el.textContent = cart.item_count > 0 ? String(cart.item_count) : '';
      el.dataset.count = cart.item_count;
    });

    // Items area
    while (itemsEl.firstChild) itemsEl.removeChild(itemsEl.firstChild);

    if (cart.item_count === 0) {
      itemsEl.innerHTML =
        '<div class="cart-drawer__empty">' +
          '<div class="cart-drawer__empty-rule"></div>' +
          '<p class="cart-drawer__empty-text">Your bag is empty.</p>' +
          '<a href="/collections/all" class="cart-drawer__empty-link">Explore the ranges →</a>' +
        '</div>';
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
    var row = el('div', 'cart-item');
    row.dataset.key = item.key;

    /* Image link */
    var imgLink = el('a', 'cart-item__img-wrap');
    imgLink.href = item.url;
    imgLink.tabIndex = -1;
    if (item.image) {
      var img = el('img', 'cart-item__img');
      img.src = item.image;
      img.alt = item.title;
      img.width = 80;
      img.height = 100;
      img.loading = 'lazy';
      imgLink.appendChild(img);
    } else {
      var ph = el('div', 'cart-item__img-placeholder');
      var letter = el('span');
      letter.textContent = item.product_title ? item.product_title.slice(0, 1) : '';
      ph.appendChild(letter);
      imgLink.appendChild(ph);
    }
    row.appendChild(imgLink);

    /* Details column */
    var details = el('div', 'cart-item__details');

    var type = el('span', 'cart-item__type');
    type.textContent = item.product_type || '';
    details.appendChild(type);

    var nameLink = el('a', 'cart-item__name');
    nameLink.href = item.url;
    nameLink.textContent = item.product_title || item.title;
    details.appendChild(nameLink);

    if (item.variant_title && item.variant_title !== 'Default Title') {
      var variant = el('span', 'cart-item__variant');
      variant.textContent = item.variant_title;
      details.appendChild(variant);
    }

    var qty = el('div', 'cart-item__qty');
    qty.dataset.key = item.key;

    var decBtn = el('button', 'cart-item__qty-btn');
    decBtn.dataset.action = 'decrement';
    decBtn.setAttribute('aria-label', 'Decrease quantity');
    decBtn.textContent = '−';
    if (item.quantity <= 1) decBtn.disabled = true;

    var qtyVal = el('span', 'cart-item__qty-val');
    qtyVal.textContent = String(item.quantity);

    var incBtn = el('button', 'cart-item__qty-btn');
    incBtn.dataset.action = 'increment';
    incBtn.setAttribute('aria-label', 'Increase quantity');
    incBtn.textContent = '+';

    qty.appendChild(decBtn);
    qty.appendChild(qtyVal);
    qty.appendChild(incBtn);
    details.appendChild(qty);
    row.appendChild(details);

    /* Right column: price + remove */
    var right = el('div', 'cart-item__right');

    var price = el('span', 'cart-item__price');
    price.textContent = formatMoney(item.final_line_price);
    right.appendChild(price);

    var removeBtn = el('button', 'cart-item__remove');
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
  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

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
      var variantId = btn.dataset.variantId;
      if (!variantId) return;
      btn.disabled = true;
      addToCart(parseInt(variantId, 10))
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
```

- [ ] Commit:
```bash
git add assets/cart-drawer.js
git commit -m "feat: add cart drawer JS controller with safe DOM construction"
```

---

### Task 6: Wire cart drawer into `layout/theme.liquid`

**Files:**
- Modify: `layout/theme.liquid`

- [ ] In `<head>`, add CSS tags after `base.css`:

```liquid
  {{ 'base.css' | asset_url | stylesheet_tag }}
  {{ 'filament.css' | asset_url | stylesheet_tag }}
  {{ 'cart-drawer.css' | asset_url | stylesheet_tag }}
```

- [ ] Just before `</body>`, add the snippet and JS:

```liquid
  {% render 'cart-drawer', cart: cart %}
  {{ 'theme.js' | asset_url | script_tag }}
  <script src="{{ 'smoke.js' | asset_url }}" defer></script>
  <script src="{{ 'cart-drawer.js' | asset_url }}" defer></script>
</body>
```

- [ ] Commit:
```bash
git add layout/theme.liquid
git commit -m "feat: render cart drawer snippet and load JS/CSS in theme layout"
```

---

## Chunk 3: Product Card Quick-Add + Collection Grid

### Task 7: Update `snippets/product-card.liquid`

**Files:**
- Modify: `snippets/product-card.liquid`

Preserve all existing logic (range colour detection, scarcity badges, image srcset). Changes: add `featured` param, replace the form-submit add button with a `data-quick-add` button, add range badge overlay, add `filament-target` to the quick-add button.

- [ ] Replace the entire contents of `snippets/product-card.liquid`:

```liquid
{% comment %}
  Params:
    product  — required
    featured — optional boolean (true for first card = 2-col span)
{% endcomment %}

{% assign inv = product.selected_or_first_available_variant.inventory_quantity %}
{% assign inv_policy = product.selected_or_first_available_variant.inventory_management %}
{% assign is_scarce  = false %}
{% assign is_limited = false %}
{% if inv_policy == 'shopify' %}
  {% if inv <= 5 and inv > 0 %}
    {% assign is_scarce = true %}
  {% elsif inv <= 30 and inv > 5 %}
    {% assign is_limited = true %}
  {% endif %}
{% endif %}

{% assign range_colour = '#D4AE50' %}
{% assign range_label  = '' %}
{% for tag in product.tags %}
  {% if tag == 'range-2' or tag contains 'man-child' %}
    {% assign range_colour = '#B87333' %}
  {% elsif tag == 'range-3' or tag contains 'happy-wife' %}
    {% assign range_colour = '#C8B8A8' %}
  {% endif %}
  {% if tag contains 'range:' %}
    {% assign range_label = tag | remove: 'range:' | strip %}
  {% endif %}
{% endfor %}

{% assign card_class = 'product-card reveal-on-scroll' %}
{% if featured %}
  {% assign card_class = 'product-card product-card--featured reveal-on-scroll' %}
{% endif %}

<article class="{{ card_class }}" style="--range-accent: {{ range_colour }};">

  <div class="product-card__image-wrap">
    <a href="{{ product.url }}" tabindex="-1" aria-hidden="true">
      {% if product.featured_image != blank %}
        <img
          class="product-card__image"
          src="{{ product.featured_image | image_url: width: 600 }}"
          srcset="
            {{ product.featured_image | image_url: width: 300 }} 300w,
            {{ product.featured_image | image_url: width: 600 }} 600w,
            {{ product.featured_image | image_url: width: 900 }} 900w
          "
          sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
          alt="{{ product.featured_image.alt | escape | default: product.title }}"
          loading="lazy"
          width="600" height="750"
        >
        {% if product.images.size > 1 %}
          <img
            class="product-card__image product-card__image--hover"
            src="{{ product.images[1] | image_url: width: 600 }}"
            alt="{{ product.images[1].alt | escape | default: product.title }}"
            loading="lazy"
            width="600" height="750"
            aria-hidden="true"
          >
        {% endif %}
      {% else %}
        <div class="product-card__placeholder" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="m21 15-5-5L5 21"/>
          </svg>
        </div>
      {% endif %}
    </a>

    <span class="product-card__range-badge" style="color: {{ range_colour }}; border-color: {{ range_colour }};">
      {% if range_label != blank %}{{ range_label }}{% else %}{{ product.type }}{% endif %}
    </span>

    {% if is_scarce %}
      <span class="product-card__badge product-card__badge--scarce">Only {{ inv }} left</span>
    {% elsif is_limited %}
      <span class="product-card__badge product-card__badge--limited">Limited</span>
    {% elsif product.compare_at_price > product.price %}
      <span class="product-card__badge">Sale</span>
    {% endif %}

    {% if product.available %}
      <button
        class="product-card__quick-add filament-target"
        data-quick-add
        data-variant-id="{{ product.selected_or_first_available_variant.id }}"
        aria-label="Add {{ product.title | escape }} to bag"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add to Bag
      </button>
    {% endif %}
  </div>

  <div class="product-card__info">
    {% if range_label != blank %}
      <span class="product-card__range" style="color: {{ range_colour }};">{{ range_label }}</span>
    {% elsif product.type != blank %}
      <span class="product-card__range" style="color: {{ range_colour }};">{{ product.type }}</span>
    {% endif %}

    <a href="{{ product.url }}" class="product-card__name-link">
      <h3 class="product-card__name">{{ product.title }}</h3>
    </a>

    <div class="product-card__stars" aria-label="Reviews">
      <span class="stars-placeholder" data-product-id="{{ product.id }}">
        <span class="star-fill" style="width: 0%"></span>
      </span>
      <span class="review-count"></span>
    </div>

    {% if product.metafields.custom.subtitle != blank %}
      <p class="product-card__sub">{{ product.metafields.custom.subtitle }}</p>
    {% elsif product.description != blank %}
      <p class="product-card__sub">{{ product.description | strip_html | truncate: 75 }}</p>
    {% endif %}

    <div class="product-card__footer">
      <span class="product-card__price">
        {% if product.compare_at_price > product.price %}
          <s style="color: var(--stone); font-size: 13px; margin-right: 5px;">{{ product.compare_at_price | money }}</s>
        {% endif %}
        {{ product.price | money }}
      </span>
      {% unless product.available %}
        <span class="product-card__sold-out">Sold out</span>
      {% endunless %}
    </div>
  </div>

</article>
```

- [ ] Add the new CSS rules to `assets/base.css` — find the existing `.product-card__add` rule and add below it (or replace it entirely):

```css
/* ── Quick-add overlay ───────────────────────────────────────── */
.product-card__image-wrap {
  position: relative;
  overflow: hidden;
  display: block;
}

.product-card__range-badge {
  position: absolute;
  top: 14px; left: 14px;
  font-size: 8px; letter-spacing: 0.2em; text-transform: uppercase;
  padding: 4px 10px;
  border: 1px solid;
  background: rgba(6, 4, 2, 0.7);
  font-family: var(--font-ui);
  pointer-events: none;
  z-index: 2;
}

.product-card__quick-add {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  padding: 13px 16px;
  background: rgba(6, 4, 2, 0.85);
  border: none; border-top: 1px solid rgba(212, 174, 80, 0.15);
  color: #C8A030;
  font-family: var(--font-ui);
  font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.3s ease, transform 0.3s ease, color 0.2s;
  backdrop-filter: blur(8px);
  z-index: 3;
}
.product-card:hover .product-card__quick-add {
  opacity: 1;
  transform: translateY(0);
  color: #D4AE50;
}
.product-card__quick-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Featured card (2-col span) ──────────────────────────────── */
.product-card--featured {
  grid-column: span 2;
}
.product-card--featured .product-card__image-wrap img,
.product-card--featured .product-card__placeholder {
  aspect-ratio: 16 / 9;
  width: 100%;
  object-fit: cover;
}
.product-card--featured .product-card__name {
  font-size: 22px;
}
```

- [ ] Remove the old form-based `.product-card__add` button CSS from `base.css` (the rule targeting `product-card__add`) to avoid dead styles.

- [ ] Commit:
```bash
git add snippets/product-card.liquid assets/base.css
git commit -m "feat: product card quick-add with filament, AJAX, and featured card support"
```

---

### Task 8: Update `sections/main-collection.liquid` — featured first card

**Files:**
- Modify: `sections/main-collection.liquid` (lines ~257–262)

- [ ] Replace the `{% for product %}` loop:

```liquid
  <div class="product-grid product-grid--3">
    {% for product in collection.products %}
      {% assign featured = false %}
      {% if forloop.first %}
        {% assign featured = true %}
      {% endif %}
      {% render 'product-card', product: product, featured: featured %}
    {% else %}
      <p style="color: var(--fog); font-style: italic; grid-column: 1/-1; padding: var(--space-xl) 0; text-align: center;">No products in this collection yet.</p>
    {% endfor %}
  </div>
```

- [ ] Commit:
```bash
git add sections/main-collection.liquid
git commit -m "feat: pass featured:true to first product card in collection grid"
```

---

## Chunk 4: Hero SVG Bulb

### Task 9: Replace CSS blob with detailed SVG Edison bulb in `sections/hero.liquid`

**Files:**
- Modify: `sections/hero.liquid`

The existing hero has a small CSS blob bulb and two `.hero__lantern` side-glow divs. Both are replaced: the lanterns are removed entirely (per design decision), and the bulb becomes a full SVG.

- [ ] In the `<style>` block of `sections/hero.liquid`, remove these rule blocks entirely:
  - `.hero__cord`
  - `.hero__bulb`
  - `.hero__bulb::after`
  - `@keyframes filamentFlicker`
  - `.hero__light-pool` and `@keyframes lightBreathe`
  - `.hero__lantern`, `.hero__lantern--left`, `.hero__lantern--right`

- [ ] Add these new rules in their place:

```css
/* ── Edison SVG Bulb ── */
.hero__bulb-wrap {
  position: absolute;
  top: 0; left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero__bulb-glow {
  position: absolute;
  top: 80px; left: 50%; transform: translateX(-50%);
  width: 900px; height: 700px;
  background: radial-gradient(ellipse at 50% 0%,
    rgba(255, 154, 46, 0.14) 0%,
    rgba(200, 133, 26, 0.07) 30%,
    rgba(139, 105, 20, 0.03) 55%,
    transparent 70%
  );
  pointer-events: none;
  z-index: 2;
  animation: lightBreathe 4.2s ease-in-out infinite;
}

@keyframes lightBreathe {
  0%, 100% { opacity: 1; }
  18%       { opacity: 0.86; }
  35%       { opacity: 1; }
  72%       { opacity: 0.91; }
}

.hero__bulb-filaments {
  animation: bulbFlicker 3.8s ease-in-out infinite;
}

@keyframes bulbFlicker {
  0%, 100% { opacity: 1; }
  15%       { opacity: 0.88; }
  40%       { opacity: 0.96; }
  70%       { opacity: 0.84; }
  85%       { opacity: 0.97; }
}
```

- [ ] In the `<section class="hero">` HTML, replace the entire `<div class="hero__bulb-wrap">` block and the two `<div class="hero__lantern">` divs with:

```html
  <!-- Detailed Edison bulb -->
  <div class="hero__bulb-wrap" aria-hidden="true">
    <div class="hero__bulb-glow"></div>
    <svg width="120" height="200" viewBox="0 0 120 200" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">
      <defs>
        <radialGradient id="halo" cx="50%" cy="45%">
          <stop offset="0%"   stop-color="#FF9A20" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#FF9A20" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glass" cx="38%" cy="32%" r="62%">
          <stop offset="0%"   stop-color="#FFF0C0" stop-opacity="0.20"/>
          <stop offset="30%"  stop-color="#FFD060" stop-opacity="0.10"/>
          <stop offset="70%"  stop-color="#CC8020" stop-opacity="0.06"/>
          <stop offset="100%" stop-color="#441808" stop-opacity="0.03"/>
        </radialGradient>
        <radialGradient id="bloom" cx="50%" cy="62%">
          <stop offset="0%"   stop-color="#FFEA80" stop-opacity="0.85"/>
          <stop offset="30%"  stop-color="#FFB030" stop-opacity="0.45"/>
          <stop offset="65%"  stop-color="#FF6010" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#FF6010" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="spec" cx="32%" cy="28%" r="30%">
          <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.10"/>
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="brass" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stop-color="#3A2608"/>
          <stop offset="20%"  stop-color="#8A6220"/>
          <stop offset="45%"  stop-color="#C49030"/>
          <stop offset="65%"  stop-color="#A07828"/>
          <stop offset="100%" stop-color="#2A1A06"/>
        </linearGradient>
      </defs>

      <!-- Twisted cord -->
      <line x1="60" y1="0"  x2="60" y2="22" stroke="#5A3818" stroke-width="3"/>
      <line x1="60" y1="0"  x2="60" y2="22" stroke="#8A5828" stroke-width="1.2"
            stroke-dasharray="3 3"/>
      <!-- Ceiling rose -->
      <ellipse cx="60" cy="4" rx="14" ry="5" fill="#2A1A08"/>

      <!-- Knurled brass socket -->
      <rect x="43" y="22" width="34" height="36" rx="3" fill="url(#brass)"/>
      <line x1="43" y1="28" x2="77" y2="28" stroke="rgba(0,0,0,0.35)" stroke-width="0.8"/>
      <line x1="43" y1="33" x2="77" y2="33" stroke="rgba(0,0,0,0.35)" stroke-width="0.8"/>
      <line x1="43" y1="38" x2="77" y2="38" stroke="rgba(0,0,0,0.35)" stroke-width="0.8"/>
      <line x1="43" y1="43" x2="77" y2="43" stroke="rgba(0,0,0,0.35)" stroke-width="0.8"/>
      <line x1="43" y1="48" x2="77" y2="48" stroke="rgba(0,0,0,0.35)" stroke-width="0.8"/>
      <circle cx="80" cy="35" r="4" fill="url(#brass)" stroke="rgba(160,120,40,0.3)" stroke-width="0.5"/>
      <rect x="46" y="24" width="5" height="32" rx="2" fill="rgba(255,220,120,0.12)"/>

      <!-- Globe ambient halo -->
      <ellipse cx="60" cy="102" rx="60" ry="62" fill="url(#halo)"/>
      <!-- Globe neck -->
      <path d="M48,58 C46,68 44,78 44,88 L76,88 C76,78 74,68 72,58 Z" fill="rgba(20,12,4,0.7)"/>
      <!-- Globe glass -->
      <ellipse cx="60" cy="112" rx="52" ry="56" fill="url(#glass)"/>

      <!-- Filament warm bloom -->
      <ellipse cx="60" cy="118" rx="26" ry="28" fill="url(#bloom)" class="hero__bulb-filaments"/>

      <!-- Squirrel-cage filament wires -->
      <g class="hero__bulb-filaments" stroke-linecap="round">
        <line x1="60" y1="148" x2="60" y2="132" stroke="#CC8010" stroke-width="2"/>
        <line x1="60" y1="88"  x2="60" y2="98"  stroke="#CC8010" stroke-width="1.8"/>
        <ellipse cx="60" cy="132" rx="5" ry="2.5" fill="#AA7010" stroke="#CC9020" stroke-width="0.6"/>
        <ellipse cx="60" cy="98"  rx="4" ry="2"   fill="#AA7010" stroke="#CC9020" stroke-width="0.5"/>
        <!-- Outer glow wires -->
        <line x1="60" y1="132" x2="26" y2="98"  stroke="#FF9020" stroke-width="2.4" opacity="0.22"/>
        <line x1="60" y1="132" x2="33" y2="90"  stroke="#FF9020" stroke-width="2.2" opacity="0.20"/>
        <line x1="60" y1="132" x2="46" y2="86"  stroke="#FF9020" stroke-width="2.2" opacity="0.18"/>
        <line x1="60" y1="132" x2="60" y2="86"  stroke="#FF9020" stroke-width="2.4" opacity="0.22"/>
        <line x1="60" y1="132" x2="74" y2="86"  stroke="#FF9020" stroke-width="2.2" opacity="0.18"/>
        <line x1="60" y1="132" x2="87" y2="90"  stroke="#FF9020" stroke-width="2.2" opacity="0.20"/>
        <line x1="60" y1="132" x2="94" y2="98"  stroke="#FF9020" stroke-width="2.4" opacity="0.22"/>
        <line x1="60" y1="132" x2="82" y2="114" stroke="#FF9020" stroke-width="2.0" opacity="0.15"/>
        <line x1="60" y1="132" x2="38" y2="114" stroke="#FF9020" stroke-width="2.0" opacity="0.15"/>
        <!-- Crisp bright wires -->
        <line x1="60" y1="132" x2="26" y2="98"  stroke="#FFEA80" stroke-width="0.75" opacity="0.90"/>
        <line x1="60" y1="132" x2="33" y2="90"  stroke="#FFEA80" stroke-width="0.75" opacity="0.87"/>
        <line x1="60" y1="132" x2="46" y2="86"  stroke="#FFF0A0" stroke-width="0.75" opacity="0.84"/>
        <line x1="60" y1="132" x2="60" y2="86"  stroke="#FFF8C0" stroke-width="0.85" opacity="0.95"/>
        <line x1="60" y1="132" x2="74" y2="86"  stroke="#FFF0A0" stroke-width="0.75" opacity="0.84"/>
        <line x1="60" y1="132" x2="87" y2="90"  stroke="#FFEA80" stroke-width="0.75" opacity="0.87"/>
        <line x1="60" y1="132" x2="94" y2="98"  stroke="#FFEA80" stroke-width="0.75" opacity="0.90"/>
        <line x1="60" y1="132" x2="82" y2="114" stroke="#FFD060" stroke-width="0.65" opacity="0.72"/>
        <line x1="60" y1="132" x2="38" y2="114" stroke="#FFD060" stroke-width="0.65" opacity="0.72"/>
        <!-- Cross-wires -->
        <line x1="33" y1="90" x2="87" y2="114" stroke="#FFFBE0" stroke-width="0.5" opacity="0.55"/>
        <line x1="87" y1="90" x2="33" y2="114" stroke="#FFFBE0" stroke-width="0.5" opacity="0.50"/>
      </g>

      <!-- Specular highlight -->
      <ellipse cx="60" cy="112" rx="52" ry="56" fill="url(#spec)"/>
      <!-- Glass rim -->
      <ellipse cx="60" cy="112" rx="52" ry="56" fill="none" stroke="rgba(200,140,40,0.22)" stroke-width="1"/>
      <!-- Neck connector to socket -->
      <path d="M50,162 L48,168 L72,168 L70,162 Z" fill="rgba(20,12,4,0.85)"/>
    </svg>
  </div>
```

- [ ] Commit:
```bash
git add sections/hero.liquid
git commit -m "feat: replace CSS blob bulb with detailed SVG Edison bulb, remove lanterns"
```

---

## Chunk 5: Final Wiring and Verification

### Task 10: Confirm `layout/theme.liquid` asset order

**Files:**
- Modify: `layout/theme.liquid` if needed

- [ ] Confirm `layout/theme.liquid` `<head>` has:
```liquid
{{ 'base.css' | asset_url | stylesheet_tag }}
{{ 'filament.css' | asset_url | stylesheet_tag }}
{{ 'cart-drawer.css' | asset_url | stylesheet_tag }}
```

- [ ] Confirm just before `</body>`:
```liquid
  {% render 'cart-drawer', cart: cart %}
  {{ 'theme.js' | asset_url | script_tag }}
  <script src="{{ 'smoke.js' | asset_url }}" defer></script>
  <script src="{{ 'cart-drawer.js' | asset_url }}" defer></script>
</body>
```

- [ ] Commit any remaining changes and push:
```bash
git add -p
git commit -m "chore: confirm asset load order in theme layout"
git push origin main
```

---

### Task 11: End-to-end verification checklist

After Shopify syncs from GitHub (usually ~30 seconds), verify in the Shopify preview:

- [ ] **Filament on nav** — hover Home / Collections / Our Scents → filament ignites from centre outward, flickers
- [ ] **Hero bulb** — SVG Edison bulb visible at top centre with squirrel-cage filament, knurled socket, twisted cord; filament flickers
- [ ] **Light pool** — amber radial glow beneath bulb breathes slowly in sync with flicker
- [ ] **Cart trigger** — clicking the Bag link in header opens drawer without navigating to `/cart`
- [ ] **Cart drawer** — slides in from right, filament burns at the top edge permanently, overlay dims page
- [ ] **Overlay close** — clicking outside the drawer closes it
- [ ] **Escape close** — pressing Escape closes the drawer
- [ ] **Product card quick-add** — hover a card → "Add to Bag" slides up from bottom with filament ignite animation
- [ ] **Quick-add → drawer** — clicking "Add to Bag" adds item via AJAX and opens drawer showing the item
- [ ] **Qty stepper** — `+` / `−` update quantity, total updates, decrement disabled at qty 1
- [ ] **Remove item** — removes line item; shows empty state when last item removed
- [ ] **Order note** — toggle expands textarea; typing saves to `/cart/update.js` after 600ms debounce
- [ ] **Featured card** — first card in any collection spans 2 columns
- [ ] **Checkout button** — filament ignites on hover; clicking navigates to `/checkout`
