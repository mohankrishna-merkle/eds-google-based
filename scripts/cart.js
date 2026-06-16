const CART_STORAGE_KEY = 'eds-cart';
export const CART_UPDATE_EVENT = 'cart:updated';

/**
 * @param {string} value
 * @returns {number}
 */
export function parsePrice(value) {
  const numeric = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isNaN(numeric) ? 0 : numeric;
}

/**
 * @param {number} value
 * @returns {string}
 */
export function formatPrice(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * @returns {object[]}
 */
export function getCart() {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * @param {object[]} items
 */
function saveCart(items) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  window.dispatchEvent(new CustomEvent(CART_UPDATE_EVENT, {
    detail: { items, count, subtotal },
  }));
}

/**
 * @param {object} product
 * @param {number} quantity
 */
export function addToCart(product, quantity = 1) {
  const qty = Math.max(1, Math.min(99, quantity));
  const items = getCart();
  const existing = items.find((item) => item.id === product.id);

  if (existing) {
    existing.quantity = Math.min(99, existing.quantity + qty);
  } else {
    items.push({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image || '',
      path: product.path || '',
      quantity: qty,
    });
  }

  saveCart(items);
}

/**
 * @param {string} id
 * @param {number} quantity
 */
export function updateCartQuantity(id, quantity) {
  const items = getCart();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  if (quantity <= 0) {
    saveCart(items.filter((entry) => entry.id !== id));
    return;
  }

  item.quantity = Math.min(99, quantity);
  saveCart(items);
}

/**
 * @param {string} id
 */
export function removeFromCart(id) {
  saveCart(getCart().filter((item) => item.id !== id));
}

/**
 * @returns {number}
 */
export function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * @returns {number}
 */
export function getCartSubtotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.quantity, 0);
}
