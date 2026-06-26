// functions/src/scraper/puppeteerScraper.ts
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { Timestamp } from 'firebase-admin/firestore';
import { StoreConfig } from './stores';
import { ScrapedProduct } from './types';
import { getRandomUserAgent } from './userAgents';

const TIMEOUT_MS = 30000;

function extractPrice(text: string): number {
  const match = text.replace(/,/g, '').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function extractColors(name: string): string[] {
  const colorWords = ['black', 'white', 'red', 'blue', 'green', 'pink', 'beige',
    'brown', 'grey', 'gray', 'navy', 'cream', 'ivory', 'camel', 'khaki',
    'olive', 'purple', 'yellow', 'orange', 'floral', 'stripe', 'print'];
  const lower = name.toLowerCase();
  return colorWords.filter(c => lower.includes(c));
}

export async function puppeteerScrape(
  store: StoreConfig,
  maxProducts = 500
): Promise<ScrapedProduct[]> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless === 'shell' ? true : chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent(getRandomUserAgent());
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    await page.goto(store.productListUrl, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT_MS,
    });

    // scroll to trigger lazy loading
    await page.evaluate(async () => {
      await new Promise<void>(resolve => {
        let total = 0;
        const timer = setInterval(() => {
          window.scrollBy(0, 300);
          total += 300;
          if (total >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    await new Promise(r => setTimeout(r, 2000));

    const now = Timestamp.now();
    const rawProducts: Array<{
      store: string;
      name: string;
      priceText: string;
      imageUrl: string;
      productUrl: string;
      isOnline: boolean;
      mallLocation: string | null;
      mapsUrl: string | null;
    }> = await page.evaluate(
      (storeId: string, baseUrl: string, isOnline: boolean, mallLocation: string | null, mapsUrl: string | null) => {
        const results: Array<{
          store: string;
          name: string;
          priceText: string;
          imageUrl: string;
          productUrl: string;
          isOnline: boolean;
          mallLocation: string | null;
          mapsUrl: string | null;
        }> = [];
        // Inditex shared product grid selector
        const cards = document.querySelectorAll(
          'li.product-grid-product, div.product-grid-product, article[class*="product"]'
        );
        cards.forEach(card => {
          const nameEl = card.querySelector('span[class*="product-grid-product-info__name"], h2, .product-name');
          const priceEl = card.querySelector('span[class*="price__amount"], .price, [class*="price"]');
          const imgEl = card.querySelector('img[src*="http"], img[data-src]') as HTMLImageElement | null;
          const linkEl = card.querySelector('a') as HTMLAnchorElement | null;

          const name = nameEl?.textContent?.trim() ?? '';
          const priceText = priceEl?.textContent?.trim() ?? '0';
          const imageUrl = imgEl?.src ?? (imgEl as HTMLImageElement & { dataset: DOMStringMap })?.dataset?.src ?? '';
          const href = linkEl?.href ?? '';
          const productUrl = href || baseUrl;

          if (!name || !productUrl) return;
          results.push({ store: storeId, name, priceText, imageUrl, productUrl, isOnline, mallLocation, mapsUrl });
        });
        return results;
      },
      store.id,
      store.baseUrl,
      store.isOnline,
      store.mallLocation,
      store.mapsUrl
    );

    return rawProducts.slice(0, maxProducts).map(p => ({
      store: p.store,
      name: p.name,
      price: extractPrice(p.priceText),
      currency: 'QAR',
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      color: extractColors(p.name),
      category: 'other',
      fabric: 'unknown',
      style: [],
      fit: 'unknown',
      occasion: [],
      isOnline: p.isOnline,
      inStoreLocation: p.mallLocation,
      mapsUrl: p.mapsUrl,
      scrapedAt: now,
    }));
  } catch (e) {
    console.error(`Puppeteer scrape failed for ${store.id}:`, e);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}
