#!/usr/bin/env node
/**
 * Save products JSON to Firestore.
 * Usage: node save-products.js <store-id> <json-file>
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const storeId = process.argv[2];
const jsonFile = process.argv[3];

if (!storeId || !jsonFile) {
  console.error('Usage: node save-products.js <store-id> <json-file>');
  process.exit(1);
}

const serviceAccount = require('/Users/moizrana/30 in 30 apps/vibe-and-thread/functions/service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const rawProducts = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

// Store configs for metadata
const STORE_META = {
  mango:        { name: 'Mango Qatar', isOnline: true, inStoreLocation: 'Multiple malls', mapsUrl: '' },
  bershka:      { name: 'Bershka Qatar', isOnline: true, inStoreLocation: 'Doha Festival City', mapsUrl: '' },
  massimodutti: { name: 'Massimo Dutti Qatar', isOnline: true, inStoreLocation: 'Villaggio Mall', mapsUrl: '' },
  cos:          { name: 'COS Qatar', isOnline: true, inStoreLocation: 'Place Vendôme', mapsUrl: '' },
  namshi:       { name: 'Namshi', isOnline: true, inStoreLocation: null, mapsUrl: null },
};

const meta = STORE_META[storeId] || { name: storeId, isOnline: true, inStoreLocation: null, mapsUrl: null };

async function main() {
  // Delete existing products for this store
  const existing = await db.collection('products').where('store', '==', storeId).get();
  if (existing.docs.length > 0) {
    const delBatch = db.batch();
    existing.docs.forEach(d => delBatch.delete(d.ref));
    await delBatch.commit();
    console.log(`Deleted ${existing.docs.length} existing ${storeId} products`);
  }

  // Write in batches of 499
  const products = rawProducts.map(p => ({
    store: storeId,
    name: p.name,
    price: p.price || 0,
    currency: p.currency || 'QAR',
    imageUrl: p.imageUrl || '',
    productUrl: p.productUrl || '',
    category: 'other',
    color: [],
    fabric: 'unknown',
    style: [],
    fit: 'unknown',
    occasion: ['everyday'],
    isOnline: meta.isOnline,
    inStoreLocation: meta.inStoreLocation,
    mapsUrl: meta.mapsUrl,
    scrapedAt: admin.firestore.Timestamp.now(),
  }));

  let saved = 0;
  while (saved < products.length) {
    const batch = db.batch();
    const chunk = products.slice(saved, saved + 499);
    chunk.forEach(p => batch.set(db.collection('products').doc(), p));
    await batch.commit();
    saved += chunk.length;
    console.log(`Saved ${saved}/${products.length}...`);
  }

  console.log(`✅ Done: ${saved} ${storeId} products saved to Firestore`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
