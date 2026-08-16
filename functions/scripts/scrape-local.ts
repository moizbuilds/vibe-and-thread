/**
 * Local scraper runner — runs from your laptop so stores don't block Cloud Function IPs.
 * Usage: npm run scrape
 * Usage (single store): npm run scrape -- --store hm
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { STORES, StoreConfig } from '../src/scraper/stores';
import * as puppeteerCore from 'puppeteer-core';
import { fetchScrape } from '../src/scraper/fetchScraper';
import { tagProduct } from '../src/scraper/tagger';
import { saveProducts, saveScrapeLog } from '../src/scraper/firestore';
import { ScrapedProduct } from '../src/scraper/types';

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT_PATH),
});

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_PRODUCTS = 500;
const TAG_DELAY_MS = 1000;
const STORE_DELAY_MS = 3000;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function localPuppeteerScrape(store: StoreConfig, maxProducts: number): Promise<ScrapedProduct[]> {
  const browser = await puppeteerCore.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(store.productListUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Wait for JS to render products
    await sleep(8000);

    // Scroll slowly to trigger lazy loading
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 150));
      }
    });
    await sleep(3000);

    const baseUrl = store.baseUrl;
    const products = await page.evaluate((bUrl: string) => {
      // Inditex stores use data-productid on li elements
      const byProductId = Array.from(document.querySelectorAll('li[data-productid]'));
      if (byProductId.length > 0) {
        return byProductId.slice(0, 500).map(el => {
          const productId = el.getAttribute('data-productid') ?? '';
          const img = el.querySelector('img');
          const name = img?.getAttribute('alt')?.replace(/ by Zara| by ZARA/gi, '').trim()
            ?? el.querySelector('[class*="name"], p')?.textContent?.trim() ?? '';
          const imageUrl = img?.getAttribute('src')?.includes('transparent') ? '' : (img?.getAttribute('src') ?? '');
          const priceEl = el.querySelector('[class*="price"]');
          const priceText = priceEl?.textContent?.replace(/[^0-9.]/g, '') ?? '0';
          return { name, priceText, imageUrl, productUrl: `${bUrl}/qa/en/product/p${productId}.html` };
        }).filter(p => p.name && !p.name.includes('Close-up') && !p.name.includes('model wearing'));
      }
      // Massimo Dutti / other Inditex: li.grid-product
      const byGridProduct = Array.from(document.querySelectorAll('li.grid-product'));
      if (byGridProduct.length > 0) {
        return byGridProduct.slice(0, 500).map(el => {
          const nameEl = el.querySelector('[class*="name"], [class*="Name"], h2, h3, p');
          const priceEl = el.querySelector('[class*="price"], [class*="Price"]');
          const imgEl = el.querySelector('img');
          const linkEl = el.querySelector('a');
          const priceText = priceEl?.textContent?.replace(/[^0-9.]/g, '') ?? '0';
          const href = linkEl?.getAttribute('href') ?? '';
          return { name: nameEl?.textContent?.trim() ?? '', priceText, imageUrl: imgEl?.src ?? imgEl?.getAttribute('data-src') ?? '', productUrl: href.startsWith('http') ? href : `${bUrl}${href}` };
        }).filter(p => p.name && p.productUrl);
      }
      // Bershka / Stradivarius: li.grid-item with name from URL slug
      const byGridItem = Array.from(document.querySelectorAll('li.grid-item'));
      if (byGridItem.length > 0) {
        return byGridItem.slice(0, 500).map(el => {
          const link = el.querySelector('a.grid-card-link');
          const imgEl = el.querySelector('img');
          const href = link?.getAttribute('href') ?? '';
          const slug = href.split('/').pop()?.split('-c0p')[0]?.split('-c1p')[0]?.replace(/-/g, ' ') ?? '';
          const name = slug.charAt(0).toUpperCase() + slug.slice(1);
          const productUrl = href.startsWith('http') ? href : `${bUrl}${href}`;
          return { name, priceText: '0', imageUrl: imgEl?.src ?? '', productUrl };
        }).filter(p => p.name && p.productUrl && p.imageUrl);
      }
      // Generic fallback
      const SELECTORS = 'li.product-grid-product, div.product-grid-product, article[class*="product"]';
      const items = Array.from(document.querySelectorAll(SELECTORS));
      return items.slice(0, 500).map(el => {
        const nameEl = el.querySelector('[class*="name"], h2, h3, p');
        const priceEl = el.querySelector('[class*="price"], [data-price]');
        const imgEl = el.querySelector('img');
        const linkEl = el.querySelector('a');
        const name = nameEl?.textContent?.trim() ?? '';
        const priceText = priceEl?.textContent?.replace(/[^0-9.]/g, '') ?? '0';
        const imageUrl = imgEl?.getAttribute('src') ?? imgEl?.getAttribute('data-src') ?? '';
        const href = linkEl?.getAttribute('href') ?? '';
        const productUrl = href.startsWith('http') ? href : `${bUrl}${href}`;
        return { name, priceText, imageUrl, productUrl };
      }).filter(p => p.name && p.productUrl);
    }, baseUrl);

    return products.map(p => ({
      store: store.id,
      name: p.name,
      price: parseFloat(p.priceText) || 0,
      currency: 'QAR',
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      category: 'other',
      color: [],
      fabric: 'unknown',
      style: [],
      fit: 'unknown',
      occasion: ['everyday'],
      isOnline: store.isOnline,
      inStoreLocation: store.mallLocation,
      mapsUrl: store.mapsUrl,
      scrapedAt: admin.firestore.Timestamp.now(),
    } as ScrapedProduct)).slice(0, maxProducts);
  } finally {
    await browser.close();
  }
}

async function scrapeOne(store: StoreConfig): Promise<void> {
  const start = Date.now();
  console.log(`\n[${store.id}] Starting ${store.name} (${store.scraperType})`);

  try {
    const rawProducts: ScrapedProduct[] =
      store.scraperType === 'puppeteer'
        ? await localPuppeteerScrape(store, MAX_PRODUCTS)
        : await fetchScrape(store, MAX_PRODUCTS);

    if (rawProducts.length === 0) {
      console.log(`[${store.id}] ⚠️  0 products found — skipping`);
      await saveScrapeLog({
        storeId: store.id,
        storeName: store.name,
        productsFound: 0,
        success: false,
        error: 'No products found',
        scraper: store.scraperType,
        durationMs: Date.now() - start,
        timestamp: admin.firestore.Timestamp.now(),
      });
      return;
    }

    console.log(`[${store.id}] Found ${rawProducts.length} raw products — tagging with Groq...`);

    const tagged: ScrapedProduct[] = [];
    for (let i = 0; i < rawProducts.length; i++) {
      const product = await tagProduct(rawProducts[i]);
      tagged.push(product);
      if ((i + 1) % 10 === 0) {
        console.log(`[${store.id}]   tagged ${i + 1}/${rawProducts.length}`);
      }
      if (i < rawProducts.length - 1) await sleep(TAG_DELAY_MS);
    }

    await saveProducts(store.id, tagged);

    const duration = Date.now() - start;
    console.log(`[${store.id}] ✅ Saved ${tagged.length} products (${Math.round(duration / 1000)}s)`);

    await saveScrapeLog({
      storeId: store.id,
      storeName: store.name,
      productsFound: tagged.length,
      success: true,
      error: null,
      scraper: store.scraperType,
      durationMs: duration,
      timestamp: admin.firestore.Timestamp.now(),
    });
  } catch (e: any) {
    const duration = Date.now() - start;
    console.error(`[${store.id}] ❌ Error: ${e.message}`);
    await saveScrapeLog({
      storeId: store.id,
      storeName: store.name,
      productsFound: 0,
      success: false,
      error: e.message,
      scraper: store.scraperType,
      durationMs: duration,
      timestamp: admin.firestore.Timestamp.now(),
    });
  }
}

async function main() {
  const storeArg = process.argv.find(a => a.startsWith('--store='))?.split('=')[1]
    ?? process.argv[process.argv.indexOf('--store') + 1];

  const stores = storeArg
    ? STORES.filter(s => s.id === storeArg)
    : STORES;

  if (stores.length === 0) {
    console.error(`Store "${storeArg}" not found. Available: ${STORES.map(s => s.id).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n🚀 Scraping ${stores.length} store(s)...\n`);

  for (let i = 0; i < stores.length; i++) {
    await scrapeOne(stores[i]);
    if (i < stores.length - 1) await sleep(STORE_DELAY_MS);
  }

  console.log('\n✅ All done!');
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
