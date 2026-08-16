#!/usr/bin/env node
/**
 * Appends more Mango products to Firestore (does NOT delete existing ones).
 * Run after save-products.js has saved dresses.
 */
const admin = require('firebase-admin');
const puppeteerCore = require('../node_modules/puppeteer-core');
const path = require('path');

const serviceAccount = require('../service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const CATEGORIES = [
  'https://shop.mango.com/qa/en/c/women/tops/227371cd',
  'https://shop.mango.com/qa/en/c/women/t-shirts/8e23bdfb',
  'https://shop.mango.com/qa/en/c/women/shirts---blouses/b8003173',
  'https://shop.mango.com/qa/en/c/women/trousers/0bf28b3b',
  'https://shop.mango.com/qa/en/c/women/jeans/164d8c42',
  'https://shop.mango.com/qa/en/c/women/skirts/a1a0d939',
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeCategory(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(8000);
  // Scroll to load all products
  let last = 0;
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(600);
    const h = await page.evaluate(() => document.body.scrollHeight);
    if (h === last) break;
    last = h;
  }
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('[class*="ProductCard"]')).map(el => {
      const link = el.querySelector('a[href*="/qa/en/p/"]');
      const img = el.querySelector('img');
      const priceEl = el.querySelector('[itemprop="price"]');
      const href = link?.href ?? '';
      const parts = href.split('/');
      const nameIdx = parts.findIndex(p => /^\d{8,}$/.test(p));
      const slug = nameIdx > 0 ? parts[nameIdx - 1] : '';
      const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { name, price: parseFloat(priceEl?.getAttribute('content') ?? '0') || 0, currency: 'QAR', imageUrl: img?.src ?? '', productUrl: href };
    }).filter(p => p.name && p.productUrl && p.imageUrl);
  });
}

async function main() {
  const browser = await puppeteerCore.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let allProducts = [];
    for (const catUrl of CATEGORIES) {
      console.log('Scraping:', catUrl.split('/women/')[1]?.split('/')[0]);
      const prods = await scrapeCategory(page, catUrl);
      console.log(' ', prods.length, 'products');
      allProducts = allProducts.concat(prods);
    }

    console.log(`\nTotal: ${allProducts.length} products across all categories`);

    // Batch write — append to existing (don't delete)
    let saved = 0;
    while (saved < allProducts.length) {
      const batch = db.batch();
      const chunk = allProducts.slice(saved, saved + 499);
      chunk.forEach(p => {
        batch.set(db.collection('products').doc(), {
          store: 'mango',
          name: p.name,
          price: p.price,
          currency: p.currency,
          imageUrl: p.imageUrl,
          productUrl: p.productUrl,
          category: 'other',
          color: [], fabric: 'unknown', style: [], fit: 'unknown',
          occasion: ['everyday'],
          isOnline: true,
          inStoreLocation: 'Multiple malls',
          mapsUrl: '',
          scrapedAt: admin.firestore.Timestamp.now(),
        });
      });
      await batch.commit();
      saved += chunk.length;
      console.log(`Saved ${saved}/${allProducts.length}...`);
    }
    console.log('✅ Done!');
  } finally {
    await browser.close();
    process.exit(0);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
