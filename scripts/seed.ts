import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { stores, products } from '../functions/src/seed/seedData';

initializeApp();
const db = getFirestore();

async function seed() {
  console.log('Seeding stores...');
  for (const store of stores) {
    await db.collection('stores').doc(store.id).set(store);
    console.log(`  ✔ ${store.name}`);
  }

  console.log('Seeding products...');
  for (const product of products) {
    await db.collection('products').add(product);
    process.stdout.write('.');
  }
  console.log(`\n  ✔ ${products.length} products seeded`);
  console.log('Done!');
}

seed().catch(console.error);
