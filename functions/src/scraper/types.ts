import { Timestamp } from 'firebase-admin/firestore';

export interface ScrapedProduct {
  store: string;
  name: string;
  price: number;
  currency: string;
  imageUrl: string;
  productUrl: string;
  color: string[];
  // AI-tagged fields — populated by tagger.ts
  category: string;
  fabric: string;
  style: string[];
  fit: string;
  occasion: string[];
  isOnline: boolean;
  inStoreLocation: string | null;
  mapsUrl: string | null;
  scrapedAt: Timestamp;
}

export interface ScrapeLog {
  storeId: string;
  storeName: string;
  productsFound: number;
  success: boolean;
  error: string | null;
  scraper: 'fetch' | 'puppeteer';
  durationMs: number;
  timestamp: Timestamp;
}
