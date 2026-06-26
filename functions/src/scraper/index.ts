import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { STORES, StoreConfig } from './stores';
import { fetchScrape } from './fetchScraper';
import { puppeteerScrape } from './puppeteerScraper';
import { tagProduct } from './tagger';
import { saveProducts, saveScrapeLog } from './firestore';
import { ScrapeLog } from './types';

const MAX_PRODUCTS = 500;

async function scrapeOneStore(store: StoreConfig): Promise<ScrapeLog> {
  const start = Date.now();
  console.log(`[scraper] Starting ${store.name} (${store.scraperType})`);

  try {
    const rawProducts = store.scraperType === 'puppeteer'
      ? await puppeteerScrape(store, MAX_PRODUCTS)
      : await fetchScrape(store, MAX_PRODUCTS);

    if (rawProducts.length === 0) {
      return {
        storeId: store.id,
        storeName: store.name,
        productsFound: 0,
        success: false,
        error: 'No products found — store may have changed selectors or blocked request',
        scraper: store.scraperType,
        durationMs: Date.now() - start,
        timestamp: Timestamp.now(),
      };
    }

    // AI-tag each product (rate limit: 1 per second to avoid Groq limits)
    const tagged = [];
    for (const product of rawProducts) {
      const t = await tagProduct(product);
      tagged.push(t);
      await new Promise(r => setTimeout(r, 1000));
    }

    // only save if we got products (never delete old data on failure)
    await saveProducts(store.id, tagged);

    const log: ScrapeLog = {
      storeId: store.id,
      storeName: store.name,
      productsFound: tagged.length,
      success: true,
      error: null,
      scraper: store.scraperType,
      durationMs: Date.now() - start,
      timestamp: Timestamp.now(),
    };
    console.log(`[scraper] ${store.name}: ${tagged.length} products saved`);
    return log;
  } catch (e: any) {
    console.error(`[scraper] ${store.name} failed:`, e);
    return {
      storeId: store.id,
      storeName: store.name,
      productsFound: 0,
      success: false,
      error: e?.message ?? 'Unknown error',
      scraper: store.scraperType,
      durationMs: Date.now() - start,
      timestamp: Timestamp.now(),
    };
  }
}

// Runs daily at 23:00 UTC (2am Qatar time)
export const scrapeAllStores = onSchedule(
  { schedule: '0 23 * * *', region: 'us-central1', timeoutSeconds: 3600, memory: '1GiB' },
  async () => {
    console.log('[scraper] Daily scrape started');
    for (const store of STORES) {
      const log = await scrapeOneStore(store);
      await saveScrapeLog(log);
      // delay between stores to avoid hammering
      await new Promise(r => setTimeout(r, 3000));
    }
    console.log('[scraper] Daily scrape complete');
  }
);

// Callable — trigger a single store scrape manually
export const scrapeStore = onCall(
  { region: 'us-central1', invoker: 'public', memory: '1GiB', timeoutSeconds: 300 },
  async (request) => {
    const storeId = request.data?.storeId as string;
    if (!storeId) throw new HttpsError('invalid-argument', 'storeId is required');

    const store = STORES.find(s => s.id === storeId);
    if (!store) throw new HttpsError('not-found', `Store "${storeId}" not found`);

    const log = await scrapeOneStore(store);
    await saveScrapeLog(log);
    return log;
  }
);
