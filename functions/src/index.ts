import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { extractAttributes, SearchAttributes } from './gemini';

initializeApp();
const db = getFirestore();

interface Product {
  id: string;
  store: string;
  name: string;
  price: number;
  currency: string;
  imageUrl: string;
  productUrl: string;
  category: string;
  color: string[];
  fabric: string;
  style: string[];
  fit: string;
  occasion: string[];
  isOnline: boolean;
  inStoreLocation: string | null;
  mapsUrl: string | null;
  matchScore: number;
}

interface Store {
  id: string;
  name: string;
  logoUrl: string;
  website: string;
  mallLocation: string | null;
  mapsUrl: string | null;
  isOnline: boolean;
  isPhysical: boolean;
  matchReason: string;
}

function scoreProduct(product: FirebaseFirestore.DocumentData, attrs: SearchAttributes): number {
  let score = 0;
  if (product.category === attrs.category) score += 3;
  if (attrs.color.some((c: string) => product.color?.includes(c))) score += 2;
  if (product.fabric === attrs.fabric && attrs.fabric !== 'unknown') score += 2;
  if (attrs.style.some((s: string) => product.style?.includes(s))) score += 2;
  if (product.fit === attrs.fit && attrs.fit !== 'unknown') score += 1;
  if (attrs.occasion.some((o: string) => product.occasion?.includes(o))) score += 1;
  return score;
}

function generateMatchReason(attrs: SearchAttributes): string {
  const parts: string[] = [];
  if (attrs.style.length > 0) parts.push(`${attrs.style[0]} styles`);
  if (attrs.category !== 'other') parts.push(attrs.category);
  if (attrs.occasion.length > 0) parts.push(`${attrs.occasion[0]} wear`);
  return parts.length > 0 ? `Carries ${parts.join(', ')}` : 'May carry what you need';
}

export const searchClothing = onCall(
  { region: 'us-central1', invoker: 'public' },
  async (request) => {
    const description = request.data?.description as string;
    if (!description || description.trim().length < 3) {
      throw new HttpsError('invalid-argument', 'Description is required');
    }

    let attrs: SearchAttributes;
    try {
      attrs = await extractAttributes(description);
    } catch (e) {
      console.error('Gemini error:', e);
      throw new HttpsError('internal', 'Failed to analyse description');
    }

    // Fetch all products (v1: full scan, acceptable for small dataset)
    const productsSnap = await db.collection('products').get();
    const storesSnap = await db.collection('stores').get();

    const products: Product[] = productsSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data(), matchScore: scoreProduct(doc.data(), attrs) } as Product))
      .filter(p => p.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 20);

    const stores: Store[] = storesSnap.docs
      .filter(doc => doc.data().isPhysical)
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        matchReason: generateMatchReason(attrs),
      } as Store));

    const suggestedTweaks: string[] = [];
    if (products.length === 0) {
      suggestedTweaks.push(`Try: "${attrs.category}" instead of a full description`);
      suggestedTweaks.push('Remove fabric or colour to broaden results');
    }

    return { products, stores, suggestedTweaks };
  }
);

export { scrapeAllStores, scrapeStore } from './scraper/index';
