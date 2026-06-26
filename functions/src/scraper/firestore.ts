import { getFirestore } from 'firebase-admin/firestore';
import { ScrapedProduct, ScrapeLog } from './types';

const BATCH_SIZE = 499; // Firestore max is 500 ops per batch

export async function saveProducts(storeId: string, products: ScrapedProduct[]): Promise<void> {
  const db = getFirestore();

  // delete old products for this store first
  const existing = await db.collection('products').where('store', '==', storeId).get();
  for (let i = 0; i < existing.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    existing.docs.slice(i, i + BATCH_SIZE).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  // write new products in batches
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = db.batch();
    products.slice(i, i + BATCH_SIZE).forEach(product => {
      const ref = db.collection('products').doc();
      batch.set(ref, product);
    });
    await batch.commit();
  }
}

export async function saveScrapeLog(log: ScrapeLog): Promise<void> {
  const db = getFirestore();
  await db.collection('scrape_logs').add(log);
}
