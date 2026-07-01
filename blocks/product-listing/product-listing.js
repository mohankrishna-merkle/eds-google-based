import { createOptimizedPicture, readBlockConfig } from '../../scripts/aem.js';

/**
 * @param {string} source
 * @returns {Promise<object[]|null>}
 */
async function fetchIndex(source) {
  const response = await fetch(source);
  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error('Product listing: failed to load index', source);
    return null;
  }
  const json = await response.json();
  return json?.data || [];
}

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

// function parseDate(dateString) {
//   if (!dateString) return 0;

//   const date = new Date(dateString);

//   if (Number.isNaN(date.getTime())) {
//     return 0;
//   }

//   return date.getTime();
// }

function parseDate(value) {
  if (!value) return 0;

  // Excel serial number
  if (!Number.isNaN(Number(value))) {
    return excelSerialToDate(Number(value)).getTime();
  }

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.getTime();
  }

  return 0;
}

function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

function formatPublishDate(value) {
  if (!value) return '';

  // Excel / Google Sheet serial number
  if (!Number.isNaN(Number(value))) {
    return excelSerialToDate(Number(value)).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // Normal date string
  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return value;
}

/**
 * @param {object} item
 * @param {string} headingTag
 * @returns {HTMLElement}
 */
function renderProductCard(item, headingTag) {
  const li = document.createElement('li');
  li.className = 'product-listing-card';

  const link = document.createElement('a');
  link.className = 'product-listing-card-link';
  link.href = item.path;

  if (item.image) {
    const media = document.createElement('div');
    media.className = 'product-listing-card-image';
    media.append(createOptimizedPicture(item.image, item.title || '', false, [{ width: '600' }]));
    link.append(media);
  }

  const body = document.createElement('div');
  body.className = 'product-listing-card-body';

  if (item.category) {
    const category = document.createElement('p');
    category.className = 'product-listing-card-category';
    category.textContent = item.category;
    body.append(category);
  }

  if (item.title) {
    const title = document.createElement(headingTag);
    title.className = 'product-listing-card-title';
    title.textContent = item.title;
    body.append(title);
  }

  /* new section */

  if (item.publishDate || item.published_by) {
    const meta = document.createElement('div');
    meta.className = 'product-listing-card-meta';

    if (item.publishDate) {
      const date = document.createElement('span');
      date.className = 'product-listing-card-date';
      date.textContent = formatPublishDate(item.publishDate);
      meta.append(date);
    }

    if (item.publishDate && item.published_by) {
      const divider = document.createElement('span');
      divider.className = 'product-listing-card-divider';
      divider.textContent = '|';
      meta.append(divider);
    }

    if (item.published_by) {
      const author = document.createElement('span');
      author.className = 'product-listing-card-author';
      author.textContent = `By ${item.published_by}`;
      meta.append(author);
    }

    body.append(meta);
  }

  if (item.description) {
    const description = document.createElement('p');
    description.className = 'product-listing-card-description';
    description.textContent = item.description;
    body.append(description);
  }

  if (item.price) {
    const price = document.createElement('p');
    price.className = 'product-listing-card-price';
    price.textContent = formatPrice(item.price);
    body.append(price);
  }

  link.append(body);
  li.append(link);
  return li;
}

/**
 * @param {Element} block
 * @returns {string}
 */
function findHeadingTag(block) {
  let preceding = block.parentElement;
  while (preceding) {
    const heading = [...preceding.querySelectorAll('h1, h2, h3, h4, h5, h6')].pop();
    if (heading) {
      const level = parseInt(heading.nodeName[1], 10);
      return level < 6 ? `H${level + 1}` : 'H6';
    }
    preceding = preceding.previousElementSibling || preceding.parentElement;
  }
  return 'H2';
}

/**
 * @param {object[]} data
 * @param {string} query
 * @param {string} category
 * @returns {object[]}
 */
function filterProducts(data, query, category) {
  let items = data.filter((item) => item.path && item.title);

  if (category) {
    items = items.filter((item) => (item.category || '').toLowerCase() === category.toLowerCase());
  }

  if (query) {
    const terms = query.toLowerCase();
    items = items.filter((item) => (
      (item.title || '').toLowerCase().includes(terms)
      || (item.description || '').toLowerCase().includes(terms)
      || (item.category || '').toLowerCase().includes(terms)
      || (item.published_by || '').toLowerCase().includes(terms)
    ));
  }

  return items;
}

/**
 * @param {object[]} data
 * @param {string} sort
 * @returns {object[]}
 */
function sortProducts(data, sort) {
  const items = [...data];

  switch (sort) {
    case 'latest':
      items.sort((a, b) => parseDate(b.publishDate) - parseDate(a.publishDate));
      break;

    case 'oldest':
      items.sort((a, b) => parseDate(a.publishDate) - parseDate(b.publishDate));
      break;

    case 'title':
      items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;

    case 'price-asc':
      items.sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
      break;

    case 'price-desc':
      items.sort((a, b) => parseFloat(b.price || 0) - parseFloat(a.price || 0));
      break;

    default:
      break;
  }

  return items;
}

/**
 * loads and decorates the product listing block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);
  const source = config['index-source'] || config.source || block.querySelector('a[href]')?.href || '/query-index.json' || '/products/query-index.json';
  const categoryFilter = config.category || '';
  const limit = parseInt(config.limit || '0', 10) || 0;
  // const sectionTitle = config.title || 'Shop all articles';
  const headingTag = findHeadingTag(block);

  block.textContent = '';
  block.classList.add('product-listing-loading');

  const header = document.createElement('div');
  header.className = 'product-listing-header';

  const title = document.createElement('h2');
  title.className = 'product-listing-title';
  // title.textContent = sectionTitle;
  header.append(title);

  const toolbar = document.createElement('div');
  toolbar.className = 'product-listing-toolbar';

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'product-listing-search';
  search.placeholder = 'Search articles...';
  search.setAttribute('aria-label', 'Search articles');

  const categorySelect = document.createElement('select');
  categorySelect.className = 'product-listing-category';
  categorySelect.setAttribute('aria-label', 'Filter by category');
  categorySelect.append(document.createElement('option'));

  const sortSelect = document.createElement('select');
  sortSelect.className = 'product-listing-sort';
  sortSelect.setAttribute('aria-label', 'Sort articles');
  [
    ['featured', 'Featured'],
    ['latest', 'Latest'],
    ['oldest', 'Oldest'],
    ['title', 'Name A–Z']
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    sortSelect.append(option);
  });

  toolbar.append(search, categorySelect, sortSelect);
  header.append(toolbar);

  const grid = document.createElement('ul');
  grid.className = 'product-listing-grid';
  grid.setAttribute('role', 'list');

  const status = document.createElement('p');
  status.className = 'product-listing-status';
  status.setAttribute('aria-live', 'polite');

  block.append(header, status, grid);

  const data = await fetchIndex(source);
  block.classList.remove('product-listing-loading');

  if (!data?.length) {
    status.textContent = 'No articles found. Publish product pages with price and image metadata.';
    return;
  }

  const productItems = data.filter((item) => item.price || item.path?.includes('/products/'));
  const categories = [...new Set(productItems.map((item) => item.category).filter(Boolean))].sort();

  const allOption = categorySelect.querySelector('option');
  allOption.value = '';
  allOption.textContent = 'All categories';
  categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    categorySelect.append(option);
  });

  if (categoryFilter) {
    categorySelect.value = categoryFilter;
    const match = [...categorySelect.options].find(
      (opt) => opt.value.toLowerCase() === categoryFilter.toLowerCase(),
    );
    if (match) categorySelect.value = match.value;
  }

  const render = () => {
    grid.textContent = '';
    let items = filterProducts(
      productItems,
      search.value.trim(),
      categorySelect.value,
    );
    items = sortProducts(items, sortSelect.value);
    if (limit > 0) items = items.slice(0, limit);

    if (!items.length) {
      status.textContent = 'No articles match your filters.';
      grid.setAttribute('aria-hidden', 'true');
      return;
    }

    status.textContent = `${items.length} product${items.length === 1 ? '' : 's'}`;
    grid.removeAttribute('aria-hidden');
    items.forEach((item) => {
      grid.append(renderProductCard(item, headingTag));
    });
  };

  search.addEventListener('input', render);
  categorySelect.addEventListener('change', render);
  sortSelect.addEventListener('change', render);
  render();
}
