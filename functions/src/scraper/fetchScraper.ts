// functions/src/scraper/fetchScraper.ts
import * as cheerio from 'cheerio';
import { Timestamp } from 'firebase-admin/firestore';
import { StoreConfig } from './stores';
import { ScrapedProduct } from './types';
import { getRandomUserAgent, randomDelay } from './userAgents';

const MAX_PAGES = 10;

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

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`fetchPage ${url} returned ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`fetchPage ${url} failed:`, e);
    return null;
  }
}

function parseProducts(html: string, store: StoreConfig): ScrapedProduct[] {
  if (!store.selectors) return [];
  const $ = cheerio.load(html);
  const products: ScrapedProduct[] = [];
  const now = Timestamp.now();

  $(store.selectors.productContainer).each((_, el) => {
    const name = $(el).find(store.selectors!.name).text().trim();
    const priceText = $(el).find(store.selectors!.price).text().trim();
    const price = extractPrice(priceText);
    const imageEl = $(el).find(store.selectors!.image);
    const imageUrl = imageEl.attr('src') || imageEl.attr('data-src') || imageEl.attr('data-lazy') || '';
    const linkEl = $(el).find(store.selectors!.link);
    const href = linkEl.attr('href') || '';
    const productUrl = href.startsWith('http') ? href : `${store.baseUrl}${href}`;

    if (!name || !productUrl || productUrl === store.baseUrl) return;

    products.push({
      store: store.id,
      name,
      price,
      currency: 'QAR',
      imageUrl,
      productUrl,
      color: extractColors(name),
      category: 'other',   // filled in by tagger
      fabric: 'unknown',   // filled in by tagger
      style: [],           // filled in by tagger
      fit: 'unknown',      // filled in by tagger
      occasion: [],        // filled in by tagger
      isOnline: store.isOnline,
      inStoreLocation: store.mallLocation,
      mapsUrl: store.mapsUrl,
      scrapedAt: now,
    });
  });

  return products;
}

export async function fetchScrape(
  store: StoreConfig,
  maxProducts = 500
): Promise<ScrapedProduct[]> {
  const allProducts: ScrapedProduct[] = [];
  let url = store.productListUrl;

  for (let page = 0; page < MAX_PAGES && allProducts.length < maxProducts; page++) {
    if (page > 0) await randomDelay(2000);

    const html = await fetchPage(url);
    if (!html) break;

    const pageProducts = parseProducts(html, store);
    if (pageProducts.length === 0) break;

    allProducts.push(...pageProducts);

    // try to find next page link
    if (store.selectors?.nextPage) {
      const $ = cheerio.load(html);
      const nextHref = $(store.selectors.nextPage).attr('href');
      if (!nextHref) break;
      url = nextHref.startsWith('http') ? nextHref : `${store.baseUrl}${nextHref}`;
    } else {
      break; // single page stores
    }
  }

  return allProducts.slice(0, maxProducts);
}
