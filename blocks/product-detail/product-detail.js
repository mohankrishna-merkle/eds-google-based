import { createOptimizedPicture, getMetadata } from '../../scripts/aem.js';

/**
 * @param {string} value
 * @returns {string}
 */
function formatPrice(value) {
  if (!value) return '';
  const numeric = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  if (Number.isNaN(numeric)) return value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numeric);
}

/**
 * @param {Element} row
 * @returns {Element|null}
 */
function getRowImage(row) {
  if (!row) return null;
  const img = row.querySelector('picture img, img');
  if (!img) return null;
  const alt = img.getAttribute('alt') || '';
  const src = img.getAttribute('src') || img.closest('picture')?.querySelector('source')?.getAttribute('srcset')?.split(' ')[0];
  if (!src) return null;
  return createOptimizedPicture(src, alt, true, [
    { media: '(min-width: 900px)', width: '1200' },
    { width: '750' },
  ]);
}

/**
 * @param {Element} block
 * @returns {object}
 */
function parseProductContent(block) {
  const rows = [...block.children];
  const content = {
    imageRow: rows[0],
    title: '',
    price: '',
    category: '',
    sku: '',
    description: null,
    cta: null,
  };

  const titleRow = rows[1];
  if (titleRow) {
    const cells = [...titleRow.children];
    const titleEl = cells[0]?.querySelector('h1, h2, h3, h4, h5, h6') || cells[0]?.querySelector('p, strong');
    content.title = titleEl?.textContent?.trim() || cells[0]?.textContent?.trim() || '';
    const priceEl = cells[1]?.querySelector('p, strong, em') || cells[1];
    content.price = priceEl?.textContent?.trim() || '';
  }

  const metaRow = rows[2];
  if (metaRow) {
    const cells = [...metaRow.children];
    content.category = cells[0]?.textContent?.trim() || '';
    content.sku = cells[1]?.textContent?.trim() || '';
  }

  const descriptionRow = rows[3];
  if (descriptionRow) {
    const cell = descriptionRow.firstElementChild || descriptionRow;
    if (cell?.querySelector('p, ul, ol')) {
      content.description = cell.cloneNode(true);
    } else {
      content.description = document.createElement('div');
      content.description.className = 'product-detail-description';
      const p = document.createElement('p');
      p.textContent = cell?.textContent?.trim() || '';
      content.description.append(p);
    }
  }

  const ctaRow = rows[4];
  if (ctaRow) {
    content.cta = ctaRow.querySelector('a') || ctaRow.querySelector('p a');
  }

  if (!content.title) content.title = getMetadata('og:title') || document.querySelector('main h1')?.textContent?.trim() || '';
  if (!content.price) content.price = getMetadata('price');
  if (!content.category) content.category = getMetadata('category');
  if (!content.description) {
    const desc = getMetadata('description');
    if (desc) {
      content.description = document.createElement('div');
      content.description.className = 'product-detail-description';
      const p = document.createElement('p');
      p.textContent = desc;
      content.description.append(p);
    }
  }

  return content;
}

/**
 * @param {object} product
 */
function setProductJsonLd(product) {
  const scriptId = 'product-detail-jsonld';
  if (document.getElementById(scriptId)) return;

  const img = product.imageRow?.querySelector('img');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description?.textContent?.trim() || getMetadata('description'),
    sku: product.sku || undefined,
    category: product.category || undefined,
    image: img?.src || getMetadata('og:image') || undefined,
    offers: product.price ? {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: parseFloat(String(product.price).replace(/[^0-9.]/g, '')) || product.price,
      availability: 'https://schema.org/InStock',
    } : undefined,
  };

  const script = document.createElement('script');
  script.id = scriptId;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.append(script);
}

/**
 * loads and decorates the product detail block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const product = parseProductContent(block);
  block.textContent = '';
  block.classList.add('product-detail-loaded');

  const layout = document.createElement('div');
  layout.className = 'product-detail-layout';

  const gallery = document.createElement('div');
  gallery.className = 'product-detail-gallery';
  const picture = getRowImage(product.imageRow);
  if (picture) {
    gallery.append(picture);
  } else {
    const ogImage = getMetadata('og:image');
    if (ogImage) {
      gallery.append(createOptimizedPicture(ogImage, product.title, true, [{ width: '1200' }]));
    }
  }

  const info = document.createElement('div');
  info.className = 'product-detail-info';

  if (product.category) {
    const category = document.createElement('p');
    category.className = 'product-detail-category';
    category.textContent = product.category;
    info.append(category);
  }

  if (product.title) {
    const title = document.createElement('h1');
    title.className = 'product-detail-title';
    title.textContent = product.title;
    info.append(title);
  }

  if (product.sku) {
    const sku = document.createElement('p');
    sku.className = 'product-detail-sku';
    sku.innerHTML = `<span>SKU</span> ${product.sku}`;
    info.append(sku);
  }

  if (product.price) {
    const price = document.createElement('p');
    price.className = 'product-detail-price';
    price.setAttribute('aria-label', 'Price');
    price.textContent = formatPrice(product.price);
    info.append(price);
  }

  if (product.description) {
    const description = document.createElement('div');
    description.className = 'product-detail-description';
    description.append(...product.description.childNodes);
    info.append(description);
  }

  const actions = document.createElement('div');
  actions.className = 'product-detail-actions';
  if (product.cta) {
    const cta = product.cta.cloneNode(true);
    cta.classList.add('button', 'primary');
    actions.append(cta);
  } else {
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'button primary';
    cta.textContent = 'Add to cart';
    cta.addEventListener('click', () => {
      cta.textContent = 'Added to cart';
      cta.disabled = true;
    });
    actions.append(cta);
  }
  info.append(actions);

  layout.append(gallery, info);
  block.append(layout);
  setProductJsonLd(product);
}
