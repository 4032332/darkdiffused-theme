# Design Spec: Gentleman's Study Atmospheric Upgrade + Sidecar Cart
**Dark & Diffused Shopify Theme**
Date: 2026-06-28
Status: Approved in brainstorming

---

## 1. Design Direction

### Concept
"Speakeasy at Midnight" — the user has pushed open a heavy oak door at 11pm. A single overhead Edison filament bulb casts a warm amber pool into the centre of the room. The corners are dark. The brass bar rail catches the light. Smoke drifts upward. Everything else is shadow and dark walnut.

### Palette (existing tokens, confirmed)
| Token | Value | Role |
|---|---|---|
| `--coal` | `#060402` | Page background |
| `--walnut` | `#1A0E04` | Header, panel surfaces |
| `--brass-light` | `#D4AE50` | Accents, borders, badge highlight |
| `--amber` | `#FF9A2E` | Primary hover, glow |
| `--fog` | `#A89878` | Body text, secondary nav |
| `--parchment` | `#EAD8B8` | Headings |

### Range colour coding (carried through all components)
- **I — The Elevated Man**: brass gold `#D4AE50`
- **II — The Man Child**: copper `#B87333`
- **III — Happy Wife, Happy Life**: silver-grey `#C8B8A8`

---

## 2. Filament Interaction System

A shared interaction language used across all interactive elements. Every hover state uses the same filament animation — consistent, recognisable, on-brand.

### Behaviour
1. On hover, a 1px line appears at the top edge of the element
2. The line ignites from the **centre outward** to both sides simultaneously (0.5s, `cubic-bezier(0.2,0,0.4,1)`)
3. Once fully extended, it flickers organically — never fully steady, like a real incandescent filament
4. On mouse-out, the line fades with the element's existing transition

### Filament gradient (white-hot core → orange → deep amber at edges)
```css
background: linear-gradient(90deg,
  transparent 0%,
  rgba(180,80,10,0.4) 6%,
  rgba(255,120,20,0.8) 18%,
  rgba(255,200,80,1) 30%,
  rgba(255,245,220,1) 44%,
  rgba(255,255,255,1) 50%,
  rgba(255,245,220,1) 56%,
  rgba(255,200,80,1) 70%,
  rgba(255,120,20,0.8) 82%,
  rgba(180,80,10,0.4) 94%,
  transparent 100%
);
box-shadow:
  0 0 1px rgba(255,255,255,1),
  0 0 4px rgba(255,255,200,0.9),
  0 0 10px rgba(255,140,30,0.7),
  0 0 24px rgba(220,90,10,0.45),
  0 0 48px rgba(160,50,5,0.2);
```

### Keyframes
```css
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
}
```

### Applied to
- Navigation links (already implemented)
- Product card quick-add button
- Cart drawer header (permanent, not hover-gated)
- Checkout button (hover-gated)
- All `btn-brass` and `btn-ghost` elements

---

## 3. Hero Section (`sections/hero.liquid`)

### Layout
- Full-viewport-height (`100vh`), dark walnut wood-grain background
- Wainscoting: two nested brass-border rectangles inset from the edges (existing, keep)
- Bar surface: 56px dark walnut strip at bottom with polished brass rail across the top
- Range navigation links sit inside the bar surface

### Edison Bulb (centre, overhead)
Rendered as inline SVG — not a CSS blob, a proper detailed bulb.

**Structure (top to bottom):**
- Ceiling rose: 24×8px dark walnut disc
- Twisted fabric cord: 3px wide, 70–120px long, repeating stripe pattern simulating twist
- Knurled brass socket: 34×38px, repeating horizontal bands to simulate knurling, side set-screw detail
- Globe: 100px wide × 108px tall, rounded-top teardrop (`border-radius: 50% 50% 42% 42%`)

**Filament (squirrel-cage starburst):**
- Bottom anchor post and top anchor post rendered as 1.5px brass lines
- 9 fine wires radiating from bottom anchor to points distributed around the top arc
- Each wire rendered twice: outer glow pass (2.2px, 25% opacity, amber) then crisp wire pass (0.7px, 88–95% opacity, cream-white)
- Two diagonal cross-wires at 0.5px for depth
- Warm radial bloom (`radial-gradient`) behind filament group
- Entire filament group animates with `bulb-flicker` (3.8s ease-in-out, subtle opacity variation)

**Light pool:**
- 900×700px radial gradient (`rgba(255,154,46,0.14)` at top → transparent at 70%)
- Centred below the bulb, animates in sync with bulb flicker

### Smoke
Existing `assets/smoke.js` v10 — 8-strand branching system. Retained as-is.

---

## 4. Header (`sections/header.liquid`)

No structural changes to layout or dropdown behaviour. Mobile nav retained.

### Filament on nav links
The filament system does not yet exist in `header.liquid`. Step 1 creates `filament.css` with the shared keyframes and a `.filament-target` utility class. Step 1b adds `filament-target` to `.site-nav__item > a` and `.site-nav__trigger` so the `::before` pseudo-element fires on hover.

### Cart trigger
The `<a href="/cart" class="header-cart">` on line 385 of `header.liquid` must be changed to a `<button>` (or have its default navigation intercepted). The `cart-drawer.js` listener attaches to `[data-cart-trigger]` — add `data-cart-trigger` to the element in `header.liquid`. On click: open cart drawer, prevent default navigation.

---

## 5. Product Cards (`snippets/product-card.liquid`)

### Grid layout
3-column grid with 2px gaps on a brass-tinted background (creates a fine ruled-line effect between cards). First card in each range collection is featured (spans 2 columns).

### Card anatomy
```
┌─────────────────────────────┐
│  [RANGE BADGE top-left]     │
│                             │
│    Product image / photo    │  ← aspect-ratio: 3/4
│    (full bleed, dark bg)    │
│                             │
│  [QUICK-ADD — slides up     │  ← hover only
│   from bottom, filament]    │
├─────────────────────────────┤
│  Range label (small caps)   │
│  Product name (Playfair)    │
│  ─── (brass ornament rule)  │
│  Scent descriptor (italic)  │
│  Price              200ml   │
└─────────────────────────────┘
```

### Quick-add button
- Hidden by default (`opacity: 0; transform: translateY(4px)`)
- Appears on card hover (`opacity: 1; transform: translateY(0)`)
- Has `overflow: hidden` and `::before` pseudo-element for filament
- Filament ignites from centre on button appearance
- On click: adds to cart via Shopify AJAX API, opens cart drawer

### Image treatment
- Real product photography drops in as `object-fit: cover`
- No forced background — photo is full bleed
- Bottom gradient overlay (`rgba(6,4,2,0.7) → transparent`) ensures text contrast on quick-add

### Featured card (2-column span)
- `aspect-ratio: 16/9` for image area
- Larger product name (`font-size: 24px`)
- Used for the first product in a collection view
- `main-collection.liquid` passes `featured: forloop.first` into the render call: `{% render 'product-card', product: product, featured: featured %}`
- Inside `product-card.liquid`, use `{% if featured %}` to apply the `product-card--featured` modifier class

---

## 6. Sidecar Cart Drawer

### Trigger
- Opens when: "Add to Bag" quick-add clicked, or cart icon in header clicked
- Closes when: ✕ button clicked, overlay clicked, or Escape key pressed

### Overlay
- Semi-transparent black (`rgba(0,0,0,0.55)`) with `backdrop-filter: blur(2px)`
- Covers entire page behind drawer
- Click overlay → close drawer

### Drawer dimensions
- Width: 420px (desktop), 100vw (mobile ≤480px)
- Full height, fixed position, slides in from right
- `transform: translateX(100%)` → `translateX(0)` transition (`0.35s cubic-bezier(0.4,0,0.2,1)`)

### Drawer structure (top to bottom)

**Header** (`flex-shrink: 0`)
- Permanent filament line at very top edge (not hover-gated — always burning)
- Eyebrow: "The Bag" (small caps, muted brass)
- Title: "Your Selection" (Playfair Display 22px)
- Item count + shipping status line
- ✕ close button (top right, brass border on hover)

**Items list** (scrollable `flex: 1`)
- Custom scrollbar: 3px, brass tinted
- Each item: 80px product thumbnail | details | price+remove
- Thumbnail: mini diffuser bottle silhouette (replaced by product image when available), range numeral badge top-left
- Details: range label → product name (Playfair) → scent descriptor (italic) → size/variant → qty stepper
- Qty stepper: `−` | count | `+` — inline, brass border, updates cart via AJAX
- Remove: small text link, bottom right of item, muted until hover

**Order note** (collapsible, `flex-shrink: 0`)
- Toggle button with rotating `+` → `×` icon
- Expands textarea below: dark bg, brass border on focus, italic placeholder

**Footer** (`flex-shrink: 0`)
- Subtotal label + amount (Playfair, 22px)
- Free shipping confirmation line
- Checkout button: full-width brass gradient, filament on hover, navigates to `/checkout`
- "← Continue Shopping" text button below: closes drawer
- Trust row: Secure checkout · All major cards · AU shipping (icon + label, muted)

### AJAX behaviour
All cart mutations use Shopify's Cart API:
- `POST /cart/add.js` — add item (called from quick-add)
- `POST /cart/change.js` — qty update and remove
- `POST /cart/update.js` — order note field (`{ note: "..." }`)
- `GET /cart.js` — re-render item list and totals after each mutation
- Drawer re-renders items section only (not full page reload)
- Cart count in header updates after each mutation
- Qty stepper calls are debounced (200ms) and locked while a request is in flight to prevent overlapping AJAX calls

### Snippet render call
`cart-drawer.liquid` is rendered in `layout/theme.liquid` via:
```liquid
{% render 'cart-drawer', cart: cart %}
```
Inside the snippet, `cart.items` and `cart.total_price` are available through the passed `cart` object.

### Empty state
When cart is empty, items area shows:
- Brass ornament rule
- "Your bag is empty." (Playfair italic, centred)
- Link: "Explore the ranges →" → `/collections/all`

---

## 7. Implementation Order

1. **`assets/filament.css`** — Define filament keyframes (`filament-ignite`, `filament-flicker`) and shared `.filament-target` utility class (`::before` pseudo-element, `transform-origin: center`, `overflow: hidden` on parent). Load via `{{ 'filament.css' | asset_url | stylesheet_tag }}` in the `<head>` of `layout/theme.liquid`.

2. **`sections/header.liquid`** — Add `filament-target` class to `.site-nav__item > a` and `.site-nav__trigger`. Change cart `<a href="/cart">` to add `data-cart-trigger` attribute and prevent default navigation on click. Also add `.filament-target` to the cart button.

3. **`snippets/cart-drawer.liquid`** — New snippet. Full drawer HTML structure, rendered via `{% render 'cart-drawer', cart: cart %}`. Uses `cart.items` for line items and `cart.total_price` for subtotal.

4. **`assets/cart-drawer.js`** — Drawer open/close (triggered by `[data-cart-trigger]` and `[data-quick-add]`), overlay click, Escape key, AJAX calls to `/cart/add.js`, `/cart/change.js`, `/cart/update.js`, and `/cart.js`, qty stepper with 200ms debounce + in-flight lock, order note toggle, cart count update in header. Also add `filament-target` class to `btn-brass` and `btn-ghost` elements via JS at init, or add directly in `base.css`.

5. **`snippets/product-card.liquid`** — Rebuild with new card anatomy, quick-add button with `data-quick-add` and `data-variant-id`, filament interaction (via `filament-target`), and featured modifier via `{% if featured %}`.

6. **`sections/main-collection.liquid`** — Apply 3-column grid CSS, pass `featured: forloop.first` to `{% render 'product-card' %}`.

7. **`sections/hero.liquid`** — Replace CSS blob bulb with detailed inline SVG Edison bulb (squirrel-cage filament, knurled socket, twisted cord, ceiling rose). Remove oil lantern elements.

8. **`layout/theme.liquid`** — Add `{{ 'filament.css' | asset_url | stylesheet_tag }}` in `<head>`. Add `{% render 'cart-drawer', cart: cart %}` before `</body>`. Load `cart-drawer.js` deferred.

---

## 8. Out of Scope

- Reviews app integration (requires third-party app install by store owner)
- Real product photography (provided by store owner)
- Product detail page redesign (separate spec)
- Footer redesign (separate spec)
- Mobile nav redesign beyond existing implementation
