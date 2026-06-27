/* Dark & Diffused — Theme JS */

// ── MOBILE NAV ──
const menuToggle = document.querySelector('.header-menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
const mobileClose = document.querySelector('.mobile-nav__close');

if (menuToggle && mobileNav) {
  menuToggle.addEventListener('click', () => {
    mobileNav.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  });
}

if (mobileClose && mobileNav) {
  mobileClose.addEventListener('click', () => {
    mobileNav.classList.remove('is-open');
    document.body.style.overflow = '';
  });
}

// ── PRODUCT GALLERY THUMBNAILS ──
document.querySelectorAll('.product-page__thumb').forEach(thumb => {
  thumb.addEventListener('click', () => {
    const img = thumb.querySelector('img');
    const main = document.querySelector('.product-page__gallery-main img');
    if (img && main) {
      main.src = img.src.replace('_80x80', '_800x800');
      main.srcset = '';
      document.querySelectorAll('.product-page__thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    }
  });
});

// ── QUANTITY SELECTOR ──
document.querySelectorAll('.product-form__qty').forEach(wrap => {
  const input = wrap.querySelector('input');
  const dec = wrap.querySelector('[data-action="decrement"]');
  const inc = wrap.querySelector('[data-action="increment"]');

  if (dec && input) {
    dec.addEventListener('click', () => {
      const val = parseInt(input.value, 10);
      if (val > 1) input.value = val - 1;
    });
  }

  if (inc && input) {
    inc.addEventListener('click', () => {
      const val = parseInt(input.value, 10);
      input.value = val + 1;
    });
  }
});

// ── ACTIVE NAV LINK ──
const currentPath = window.location.pathname;
document.querySelectorAll('.site-nav__item a').forEach(link => {
  if (link.getAttribute('href') === currentPath) {
    link.classList.add('active');
  }
});

// ── CART COUNT BADGE ──
async function updateCartCount() {
  try {
    const res = await fetch('/cart.js');
    const cart = await res.json();
    const badge = document.querySelector('.cart-count');
    if (badge) badge.textContent = cart.item_count;
  } catch (e) {
    // silently fail
  }
}
updateCartCount();

// ── ADD TO CART (AJAX) ──
document.querySelectorAll('.product-form').forEach(form => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.product-form__submit');
    const originalText = btn.textContent;
    const variantId = form.querySelector('[name="id"]')?.value;
    const qty = form.querySelector('[name="quantity"]')?.value || 1;

    if (!variantId) return;

    btn.textContent = 'Adding...';
    btn.disabled = true;

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: parseInt(qty, 10) })
      });

      if (res.ok) {
        btn.textContent = 'Added ✓';
        updateCartCount();
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1800);
      } else {
        btn.textContent = 'Unavailable';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1800);
      }
    } catch {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
});

// ── SCROLL REVEAL ──
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.reveal-on-scroll').forEach(el => {
    revealObserver.observe(el);
  });
}
