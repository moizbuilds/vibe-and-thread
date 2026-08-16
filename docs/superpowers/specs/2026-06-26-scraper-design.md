# Vibe & Thread — Product Scraper Design
**Date:** 2026-06-26  
**Scope:** Daily scraper to populate Firestore with real product data from 28 Qatar stores

## Decision: Build vs Apify
Apify has pre-built actors for Zara, H&M, Namshi, ASOS, Shein, Next (~$6-18/month for weekly runs). We are **building our own hybrid scraper** for the learning experience — understanding fetch parsing, Puppeteer headless browsers, user agent rotation, and anti-bot measures firsthand.

---

## 1. Architecture

Two new Firebase Cloud Functions added alongside existing `searchClothing`:

### `scrapeAllStores` (Scheduled)
- Runs daily at 2am Qatar time (23:00 UTC)
- Loops through all 28 stores sequentially
- Light scraper (fetch + cheerio) first; Puppeteer fallback for Inditex/COS stores
- Writes results to Firestore `products` collection
- Writes run summary to `scrape_logs` collection

### `scrapeStore` (HTTP Callable)
- Manually trigger a single store re-scrape from the app or terminal
- Useful for testing and on-demand refresh

### Firestore Index
- Composite index on `category` field in `products` collection
- Reduces search reads by 80%+ (queries filter by category before scanning)

---

## 2. Store List (28 stores)

### Puppeteer (Inditex platform + COS)
| Store | Qatar URL | Type |
|---|---|---|
| Zara Qatar | zara.com/qa | Clothes |
| Massimo Dutti | massimodutti.com/qa | Clothes |
| Pull&Bear | pullandbear.com/qa | Clothes |
| Bershka | bershka.com/qa | Clothes |
| Stradivarius | stradivarius.com/qa | Clothes |
| Lefties Qatar | lefties.com/qa | Clothes |
| COS Qatar | cosstores.com | Clothes |

### Fetch + Cheerio
| Store | Qatar URL | Type |
|---|---|---|
| H&M Qatar | hm.com/en_qa | Clothes |
| Mango Qatar | shop.mango.com/qa | Clothes |
| Marks & Spencer | marksandspencerme.com/en-qa | Clothes + Acc |
| Namshi | namshi.com/qatar-en | Clothes + Acc |
| Noon | noon.com/qatar-en | Clothes + Acc |
| 6th Street | en-qa.6thstreet.com | Clothes + Acc |
| ASOS Qatar | asos.com | Clothes + Acc |
| Shein Qatar | shein.com/qa | Clothes + Acc |
| Centrepoint Qatar | centrepoint.com/qa | Clothes + Acc |
| Charles & Keith | charleskeith.com/qa | Accessories |
| Aldo Qatar | aldoshoes.com/qa | Accessories |
| Max Fashion | maxfashion.com/qa | Clothes |
| Splash Qatar | splashfashions.com/qa | Clothes |
| LC Waikiki | lcwaikiki.com/en-QA | Clothes |
| VogaCloset | vogacloset.com/qatar | Clothes |
| American Eagle | ae.com | Clothes |
| New Yorker Qatar | newyorker.de | Clothes |
| Riva Fashion | rivafashion.com | Clothes + Acc |
| Koton Qatar | koton.com/qa | Clothes |
| Next Qatar | next.com/qa | Clothes + Acc |
| Urban Outfitters | urbanoutfitters.com | Clothes + Acc |

---

## 3. Data Flow

```
Scheduled trigger (2am Qatar)
  → For each store:
      1. Try fetch + cheerio scraper
         → If JS-heavy store: use Puppeteer instead
      2. Extract up to 500 products:
         - name, price, imageUrl, productUrl, color (from title)
      3. AI-tag each product via Groq extractAttributes()
         - Adds: category, fabric, style, fit, occasion
      4. Delete old products for this store in Firestore
      5. Write new products in batches (max 500 writes/batch)
      6. Write scrape_log document
  → Done
```

---

## 4. Product Schema

Same as existing schema, with one addition (`scrapedAt`):

```typescript
{
  id: string,           // auto-generated
  store: string,        // store id e.g. 'zara'
  name: string,
  price: number,
  currency: 'QAR',
  imageUrl: string,     // real product image from store
  productUrl: string,   // direct link to product page
  category: string,     // AI-tagged
  color: string[],      // extracted from product title
  fabric: string,       // AI-tagged
  style: string[],      // AI-tagged
  fit: string,          // AI-tagged
  occasion: string[],   // AI-tagged
  isOnline: boolean,
  inStoreLocation: string | null,
  mapsUrl: string | null,
  scrapedAt: Timestamp, // when this product was last scraped
}
```

---

## 5. Scrape Log Schema

```typescript
{
  storeId: string,
  storeName: string,
  productsFound: number,
  success: boolean,
  error: string | null,
  scraper: 'fetch' | 'puppeteer',
  durationMs: number,
  timestamp: Timestamp,
}
```

---

## 6. Error Handling

| Scenario | Behaviour |
|---|---|
| Store fetch fails | Retry once after 5 min, then log failure |
| Store blocked (403/429) | Log failure, keep old data, try next store |
| Puppeteer timeout (>30s) | Abort store, log failure |
| AI tagging fails for a product | Skip that product, continue |
| Firestore write fails | Retry 3x, then log failure |

**Rate limiting:** 2s base delay between page fetches, randomised 1-3s to appear human.  
**User agent rotation:** Cycle through 5 realistic browser user agents.

---

## 7. Infrastructure

- **Fetch scraper:** runs inside existing Cloud Functions (Node 20, 256MB)
- **Puppeteer scraper:** runs on Cloud Run (1GB memory, 120s timeout)
- **Estimated cost:** ~$3-5/month total (storage + reads + Cloud Run)

---

## 8. Files to Create

```
functions/src/scraper/
  index.ts          — scrapeAllStores + scrapeStore Cloud Functions
  fetchScraper.ts   — fetch + cheerio implementation
  puppeteerScraper.ts — Puppeteer implementation
  stores.ts         — store config (URLs, scraper type, selectors)
  tagger.ts         — Groq AI tagging wrapper
```

---

## 9. Out of Scope (v1)

- Real-time price tracking / price history
- Stock availability checking
- Image similarity search
- Scraping accessories categories separately from clothing
