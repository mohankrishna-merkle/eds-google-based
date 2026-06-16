import { createOptimizedPicture, loadCSS } from '../../scripts/aem.js';
import {
  CART_UPDATE_EVENT,
  formatPrice,
  getCart,
  getCartCount,
  getCartSubtotal,
  removeFromCart,
  updateCartQuantity,
} from '../../scripts/cart.js';

let panel;
let list;
let subtotalEl;
let countEl;

/**
 * @param {object} item
 * @returns {HTMLElement}
 */
function renderCartItem(item) {
  const li = document.createElement('li');
  li.className = 'cart-item';
  li.dataset.id = item.id;

  if (item.image) {
    const media = document.createElement('a');
    media.className = 'cart-item-image';
    media.href = item.path || '#';
    media.append(createOptimizedPicture(item.image, item.title, false, [{ width: '120' }]));
    li.append(media);
  }

  const body = document.createElement('div');
  body.className = 'cart-item-body';

  const title = document.createElement('a');
  title.className = 'cart-item-title';
  title.href = item.path || '#';
  title.textContent = item.title;
  body.append(title);

  const price = document.createElement('p');
  price.className = 'cart-item-price';
  price.textContent = formatPrice(item.price);
  body.append(price);

  const controls = document.createElement('div');
  controls.className = 'cart-item-controls';

  const qtyLabel = document.createElement('span');
  qtyLabel.className = 'cart-item-qty-label';
  qtyLabel.textContent = 'Qty';

  const decrease = document.createElement('button');
  decrease.type = 'button';
  decrease.className = 'cart-item-qty-btn';
  decrease.setAttribute('aria-label', `Decrease quantity of ${item.title}`);
  decrease.textContent = '−';

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.className = 'cart-item-qty-input';
  qtyInput.min = '1';
  qtyInput.max = '99';
  qtyInput.value = String(item.quantity);
  qtyInput.setAttribute('aria-label', `Quantity for ${item.title}`);

  const increase = document.createElement('button');
  increase.type = 'button';
  increase.className = 'cart-item-qty-btn';
  increase.setAttribute('aria-label', `Increase quantity of ${item.title}`);
  increase.textContent = '+';

  decrease.addEventListener('click', () => {
    const current = getCart().find((entry) => entry.id === item.id);
    if (current) updateCartQuantity(item.id, current.quantity - 1);
  });

  increase.addEventListener('click', () => {
    const current = getCart().find((entry) => entry.id === item.id);
    if (current) updateCartQuantity(item.id, current.quantity + 1);
  });

  qtyInput.addEventListener('change', () => {
    const value = parseInt(qtyInput.value, 10);
    updateCartQuantity(item.id, Number.isNaN(value) ? 1 : value);
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'cart-item-remove';
  removeBtn.textContent = 'Remove';
  removeBtn.setAttribute('aria-label', `Remove ${item.title} from cart`);
  removeBtn.addEventListener('click', () => removeFromCart(item.id));

  controls.append(qtyLabel, decrease, qtyInput, increase, removeBtn);
  body.append(controls);
  li.append(body);
  return li;
}

function renderCartItems() {
  if (!list || !subtotalEl || !countEl) return;

  const items = getCart();
  list.textContent = '';

  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'cart-empty';
    empty.textContent = 'Your cart is empty.';
    list.append(empty);
  } else {
    items.forEach((item) => list.append(renderCartItem(item)));
  }

  const count = getCartCount();
  const subtotal = getCartSubtotal();
  countEl.textContent = count ? `(${count})` : '';
  subtotalEl.textContent = formatPrice(subtotal);
}

function closeCart() {
  if (!panel?.open) return;
  panel.close();
  document.body.classList.remove('cart-open');
}

/**
 * Opens the cart drawer.
 */
export function openCart() {
  if (!panel) return;
  renderCartItems();
  panel.showModal();
  document.body.classList.add('cart-open');
  panel.querySelector('.cart-close')?.focus();
}

/**
 * Updates cart count badges in the header.
 */
export function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('.nav-cart-count').forEach((badge) => {
    badge.textContent = count > 0 ? String(count) : '';
    badge.hidden = count === 0;
  });
}

/**
 * @param {Element} nav
 * @returns {Element|null}
 */
function ensureCartTrigger(nav) {
  const tools = nav.querySelector('.nav-tools');
  if (!tools) return null;

  let trigger = [...tools.querySelectorAll('a')].find(
    (a) => a.classList.contains('nav-cart-trigger')
      || a.textContent.trim().toLowerCase() === 'cart'
      || a.getAttribute('href') === '#cart',
  );

  if (!trigger) {
    const wrapper = document.createElement('p');
    wrapper.className = 'nav-cart-wrapper';
    trigger = document.createElement('a');
    trigger.href = '#cart';
    trigger.textContent = 'Cart';
    wrapper.append(trigger);
    tools.append(wrapper);
  }

  trigger.classList.add('nav-cart-trigger');
  if (trigger.getAttribute('href') === '#cart') {
    trigger.setAttribute('href', '#');
  }

  if (!trigger.querySelector('.nav-cart-count')) {
    const badge = document.createElement('span');
    badge.className = 'nav-cart-count';
    badge.hidden = true;
    badge.setAttribute('aria-label', 'Items in cart');
    trigger.append(badge);
  }

  return trigger;
}

/**
 * Initializes cart panel and header triggers.
 * @param {Element} navRoot
 */
export async function initCart(navRoot) {
  await loadCSS(`${window.hlx.codeBasePath}/blocks/cart/cart.css`);

  if (!panel) {
    panel = document.createElement('dialog');
    panel.className = 'cart-panel';
    panel.setAttribute('aria-labelledby', 'cart-panel-title');

    panel.innerHTML = `
      <div class="cart-panel-inner">
        <header class="cart-header">
          <h2 id="cart-panel-title">Your cart <span class="cart-header-count"></span></h2>
          <button type="button" class="cart-close" aria-label="Close cart">
            <span class="icon icon-close"></span>
          </button>
        </header>
        <ul class="cart-items" role="list"></ul>
        <footer class="cart-footer">
          <p class="cart-subtotal">
            <span>Subtotal</span>
            <strong class="cart-subtotal-value"></strong>
          </p>
        </footer>
      </div>
    `;

    document.body.append(panel);
    list = panel.querySelector('.cart-items');
    subtotalEl = panel.querySelector('.cart-subtotal-value');
    countEl = panel.querySelector('.cart-header-count');

    panel.querySelector('.cart-close').addEventListener('click', closeCart);
    panel.addEventListener('click', (e) => {
      if (e.target === panel) closeCart();
    });
    panel.addEventListener('close', () => {
      document.body.classList.remove('cart-open');
    });
    panel.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeCart();
    });
  }

  const trigger = ensureCartTrigger(navRoot);
  if (trigger) {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      openCart();
    });
  }

  window.addEventListener(CART_UPDATE_EVENT, () => {
    updateCartBadge();
    if (panel?.open) renderCartItems();
  });

  updateCartBadge();
}
