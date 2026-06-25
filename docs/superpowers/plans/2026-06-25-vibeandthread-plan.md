# Vibe&Thread Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React Native (Expo Go) app where Qatar users describe clothing in natural language and get matched results from 20 Qatar stores — online products and physical store directions.

**Architecture:** User types a description → Firebase Cloud Function calls Gemini to extract structured attributes (category, color, fabric, style, fit, occasion) → Firestore is queried and results ranked by attribute match count → app displays Online and In-Store tabs.

**Tech Stack:** React Native, Expo SDK 51+, Expo Router v3, Firebase (Firestore + Cloud Functions v2), Google Gemini API (gemini-1.5-flash), Google Places API, AsyncStorage for recent searches.

## Global Constraints

- Language: English only
- Currency: QAR throughout
- Distribution: Expo Go only (no build/EAS needed in v1)
- No user auth in v1
- All API keys kept server-side in Firebase Cloud Functions (never in the app bundle)
- Node.js 20+ for Firebase Functions
- React Native new architecture OFF (Expo Go compatibility)

---

## File Structure

```
vibe-and-thread/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout + fonts
│   ├── index.tsx                 # Screen 1: Search (Home)
│   └── results.tsx               # Screen 2: Results (tabs)
├── components/
│   ├── ProductCard.tsx           # Online results card
│   ├── StoreCard.tsx             # In-Store results card
│   └── RecentSearches.tsx        # Recent searches list
├── lib/
│   ├── firebase.ts               # Firebase client init
│   ├── search.ts                 # Call search Cloud Function
│   └── recentSearches.ts         # AsyncStorage read/write
├── types/
│   └── index.ts                  # Shared TypeScript types
├── functions/                    # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts              # Function entry point
│   │   ├── gemini.ts             # Gemini attribute extraction
│   │   ├── firestoreSearch.ts    # Firestore query + ranking
│   │   └── seed/
│   │       └── seedData.ts       # Seed script for Firestore
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   └── seed.ts                   # Run locally to seed Firestore
├── app.json
├── package.json
└── tsconfig.json
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `app.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `app/_layout.tsx`
- Create: `types/index.ts`

**Interfaces:**
- Produces:
  - `Product` type used by all later tasks
  - `Store` type used by all later tasks
  - `SearchResult` type used by search.ts and results screen
  - `SearchAttributes` type used by Cloud Function

- [ ] **Step 1: Initialise Expo project**

```bash
cd "/Users/moizrana/30 in 30 apps"
npx create-expo-app vibe-and-thread --template blank-typescript
cd vibe-and-thread
```

- [ ] **Step 2: Install dependencies**

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npx expo install @react-native-async-storage/async-storage
npm install firebase
npm install --save-dev typescript @types/react @types/react-native
```

- [ ] **Step 3: Update app.json for Expo Router**

Replace the contents of `app.json` with:

```json
{
  "expo": {
    "name": "Vibe&Thread",
    "slug": "vibe-and-thread",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "vibeandthread",
    "userInterfaceStyle": "light",
    "assetBundlePatterns": ["**/*"],
    "ios": { "supportsTablet": false },
    "android": { "adaptiveIcon": { "backgroundColor": "#ffffff" } },
    "web": { "bundler": "metro" },
    "plugins": ["expo-router"]
  }
}
```

- [ ] **Step 4: Update package.json main entry**

In `package.json`, ensure the `main` field is:
```json
"main": "expo-router/entry"
```

- [ ] **Step 5: Write shared types**

Create `types/index.ts`:

```typescript
export interface SearchAttributes {
  category: string;
  color: string[];
  fabric: string;
  style: string[];
  fit: string;
  occasion: string[];
}

export interface Product {
  id: string;
  store: string;
  name: string;
  price: number;
  currency: 'QAR';
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
  matchScore?: number;
}

export interface Store {
  id: string;
  name: string;
  logoUrl: string;
  website: string;
  mallLocation: string | null;
  mapsUrl: string | null;
  isOnline: boolean;
  isPhysical: boolean;
  matchReason?: string;
}

export interface SearchResult {
  products: Product[];
  stores: Store[];
  suggestedTweaks: string[];
}
```

- [ ] **Step 6: Write root layout**

Create `app/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 7: Verify Expo Go loads**

```bash
npx expo start
```

Scan QR code in Expo Go. Expected: blank white screen with no errors in terminal.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Expo Router project with shared types"
```

---

### Task 2: Firebase Setup + Firestore Client

**Files:**
- Create: `lib/firebase.ts`
- Create: `.env` (gitignored)
- Create: `.gitignore`

**Interfaces:**
- Produces: `db` — Firestore instance used by `lib/search.ts`

- [ ] **Step 1: Create Firebase project**

1. Go to console.firebase.google.com
2. Click "Add project" → name it `vibe-and-thread`
3. Disable Google Analytics → Create project
4. Click "Web" icon (`</>`) → register app as `vibe-and-thread`
5. Copy the `firebaseConfig` object shown

- [ ] **Step 2: Enable Firestore**

In Firebase Console:
1. Left sidebar → Build → Firestore Database
2. Click "Create database" → Start in **test mode** → choose `eur3` or `us-central1` region → Enable

- [ ] **Step 3: Write firebase client**

Create `lib/firebase.ts`:

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
```

- [ ] **Step 4: Create .env file**

Create `.env` in project root (fill in your values from Step 1):

```
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

- [ ] **Step 5: Create .gitignore**

Create `.gitignore`:

```
node_modules/
.expo/
dist/
.env
*.orig.*
web-build/
functions/node_modules/
functions/lib/
```

- [ ] **Step 6: Verify Firebase connects**

In `app/index.tsx` temporarily add:

```typescript
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useEffect } from 'react';
import { View, Text } from 'react-native';

export default function HomeScreen() {
  useEffect(() => {
    getDocs(collection(db, 'products')).then(snap => {
      console.log('Firestore connected, docs:', snap.size);
    });
  }, []);
  return <View><Text>Vibe&Thread</Text></View>;
}
```

Run `npx expo start`, open in Expo Go. Expected terminal log: `Firestore connected, docs: 0`

- [ ] **Step 7: Commit**

```bash
git add lib/firebase.ts .gitignore app/index.tsx
git commit -m "feat: add Firebase Firestore client"
```

---

### Task 3: Firebase Cloud Functions Setup + Gemini Integration

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/src/gemini.ts`
- Create: `functions/src/index.ts`

**Interfaces:**
- Consumes: `SearchAttributes` from `types/index.ts` (copy type inline in functions — functions is a separate Node project)
- Produces: `searchClothing` HTTPS callable function, callable as `functions.httpsCallable('searchClothing')`

- [ ] **Step 1: Install Firebase CLI and init functions**

```bash
npm install -g firebase-tools
firebase login
firebase init functions
```

When prompted:
- Use existing project → select `vibe-and-thread`
- Language: **TypeScript**
- Use ESLint: **No**
- Install dependencies: **Yes**

- [ ] **Step 2: Install Gemini SDK in functions**

```bash
cd functions
npm install @google/generative-ai
cd ..
```

- [ ] **Step 3: Write Gemini attribute extractor**

Create `functions/src/gemini.ts`:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SearchAttributes {
  category: string;
  color: string[];
  fabric: string;
  style: string[];
  fit: string;
  occasion: string[];
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function extractAttributes(description: string): Promise<SearchAttributes> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are a fashion assistant. Extract clothing attributes from this description as JSON only. No explanation, just JSON.

Description: "${description}"

Return exactly this JSON structure:
{
  "category": "one of: dress, top, blouse, shirt, pants, jeans, skirt, jacket, coat, abaya, jumpsuit, other",
  "color": ["array of colors mentioned, empty array if none"],
  "fabric": "one of: linen, cotton, silk, chiffon, denim, polyester, wool, unknown",
  "style": ["array of styles, e.g: flowy, modest, casual, formal, fitted, loose, elegant, sporty"],
  "fit": "one of: loose, fitted, oversized, slim, regular, unknown",
  "occasion": ["array of: casual, work, formal, evening, beach, sport, everyday"]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini did not return valid JSON');
  return JSON.parse(jsonMatch[0]) as SearchAttributes;
}
```

- [ ] **Step 4: Write the Cloud Function entry point**

Create `functions/src/index.ts`:

```typescript
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
  { secrets: ['GEMINI_API_KEY'], region: 'us-central1' },
  async (request) => {
    const description = request.data?.description as string;
    if (!description || description.trim().length < 3) {
      throw new HttpsError('invalid-argument', 'Description is required');
    }

    let attrs: SearchAttributes;
    try {
      attrs = await extractAttributes(description);
    } catch {
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
```

- [ ] **Step 5: Set Gemini API key as Firebase secret**

Get your Gemini API key from aistudio.google.com, then:

```bash
firebase functions:secrets:set GEMINI_API_KEY
# Paste your key when prompted
```

- [ ] **Step 6: Deploy the function**

```bash
firebase deploy --only functions
```

Expected output: `✔ functions[searchClothing(us-central1)]: Successful create operation.`

- [ ] **Step 7: Commit**

```bash
git add functions/
git commit -m "feat: add Cloud Function with Gemini attribute extraction"
```

---

### Task 4: Search Client + Recent Searches

**Files:**
- Create: `lib/search.ts`
- Create: `lib/recentSearches.ts`

**Interfaces:**
- Consumes: `db` from `lib/firebase.ts`, `SearchResult` from `types/index.ts`
- Produces:
  - `searchClothing(description: string): Promise<SearchResult>` — used by results screen
  - `saveRecentSearch(query: string): Promise<void>` — used by home screen
  - `getRecentSearches(): Promise<string[]>` — used by home screen

- [ ] **Step 1: Write search client**

Create `lib/search.ts`:

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeApp, getApps } from 'firebase/app';
import { SearchResult } from '../types';

// Re-use the already-initialised Firebase app
import { db } from './firebase';
import { getApp } from 'firebase/app';

export async function searchClothing(description: string): Promise<SearchResult> {
  const functions = getFunctions(getApp(), 'us-central1');
  const fn = httpsCallable<{ description: string }, SearchResult>(functions, 'searchClothing');
  const result = await fn({ description });
  return result.data;
}
```

- [ ] **Step 2: Install Firebase Functions client SDK**

```bash
npm install firebase
# already installed — firebase package includes functions client
```

Verify `firebase/functions` is importable by checking `node_modules/firebase/functions` exists.

- [ ] **Step 3: Write recent searches helper**

Create `lib/recentSearches.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'recent_searches';
const MAX = 5;

export async function saveRecentSearch(query: string): Promise<void> {
  const existing = await getRecentSearches();
  const updated = [query, ...existing.filter(q => q !== query)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
}

export async function getRecentSearches(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/search.ts lib/recentSearches.ts
git commit -m "feat: add search client and recent searches helper"
```

---

### Task 5: Firestore Seed Data

**Files:**
- Create: `functions/src/seed/seedData.ts`
- Create: `scripts/seed.ts`

**Interfaces:**
- Produces: populated Firestore `products` and `stores` collections consumed by the Cloud Function

- [ ] **Step 1: Write seed data**

Create `functions/src/seed/seedData.ts`:

```typescript
export const stores = [
  { id: 'namshi', name: 'Namshi', logoUrl: 'https://www.namshi.com/favicon.ico', website: 'https://www.namshi.com/qatar-en/', mallLocation: null, mapsUrl: null, isOnline: true, isPhysical: false },
  { id: 'noon', name: 'Noon Fashion', logoUrl: 'https://www.noon.com/favicon.ico', website: 'https://www.noon.com/qatar-en/fashion-women/', mallLocation: null, mapsUrl: null, isOnline: true, isPhysical: false },
  { id: 'ounass', name: 'Ounass', logoUrl: 'https://www.ounass.com/favicon.ico', website: 'https://www.ounass.com', mallLocation: null, mapsUrl: null, isOnline: true, isPhysical: false },
  { id: '6thstreet', name: '6th Street', logoUrl: 'https://en-qa.6thstreet.com/favicon.ico', website: 'https://en-qa.6thstreet.com', mallLocation: null, mapsUrl: null, isOnline: true, isPhysical: false },
  { id: 'vogacloset', name: 'VogaCloset', logoUrl: 'https://vogacloset.com/favicon.ico', website: 'https://vogacloset.com/qatar/', mallLocation: null, mapsUrl: null, isOnline: true, isPhysical: false },
  { id: 'bfab', name: 'bfab', logoUrl: 'https://bfab.com/favicon.ico', website: 'https://bfab.com/qa_en', mallLocation: null, mapsUrl: null, isOnline: true, isPhysical: false },
  { id: 'zara', name: 'Zara Qatar', logoUrl: 'https://www.zara.com/favicon.ico', website: 'https://www.zara.com/qa/', mallLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=Zara+Doha+Festival+City', isOnline: true, isPhysical: true },
  { id: 'massimodutti', name: 'Massimo Dutti Qatar', logoUrl: 'https://www.massimodutti.com/favicon.ico', website: 'https://www.massimodutti.com/qa/', mallLocation: 'Villaggio Mall', mapsUrl: 'https://maps.google.com/?q=Massimo+Dutti+Villaggio+Mall+Doha', isOnline: true, isPhysical: true },
  { id: 'hm', name: 'H&M Qatar', logoUrl: 'https://www2.hm.com/favicon.ico', website: 'https://www2.hm.com/en_qa/', mallLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=HM+Doha+Festival+City', isOnline: true, isPhysical: true },
  { id: 'mango', name: 'Mango Qatar', logoUrl: 'https://shop.mango.com/favicon.ico', website: 'https://shop.mango.com/qa', mallLocation: 'Mall of Qatar', mapsUrl: 'https://maps.google.com/?q=Mango+Mall+of+Qatar', isOnline: true, isPhysical: true },
  { id: 'mandS', name: 'Marks & Spencer Qatar', logoUrl: 'https://www.marksandspencerme.com/favicon.ico', website: 'https://www.marksandspencerme.com/en-qa', mallLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=Marks+Spencer+Doha+Festival+City', isOnline: true, isPhysical: true },
  { id: 'pullandbear', name: 'Pull&Bear Qatar', logoUrl: 'https://www.pullandbear.com/favicon.ico', website: 'https://www.pullandbear.com/qa/', mallLocation: 'Mall of Qatar', mapsUrl: 'https://maps.google.com/?q=Pull+Bear+Mall+of+Qatar', isOnline: true, isPhysical: true },
  { id: 'bershka', name: 'Bershka Qatar', logoUrl: 'https://www.bershka.com/favicon.ico', website: 'https://www.bershka.com/qa/', mallLocation: 'Mall of Qatar', mapsUrl: 'https://maps.google.com/?q=Bershka+Mall+of+Qatar', isOnline: true, isPhysical: true },
  { id: 'stradivarius', name: 'Stradivarius Qatar', logoUrl: 'https://www.stradivarius.com/favicon.ico', website: 'https://www.stradivarius.com/qa/', mallLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=Stradivarius+Doha+Festival+City', isOnline: true, isPhysical: true },
  { id: 'galerieslafayette', name: 'Galeries Lafayette Doha', logoUrl: 'https://www.galerieslafayette.qa/favicon.ico', website: 'https://www.galerieslafayette.qa', mallLocation: 'Katara Cultural Village', mapsUrl: 'https://maps.google.com/?q=Galeries+Lafayette+Doha', isOnline: true, isPhysical: true },
  { id: 'maxfashion', name: 'Max Fashion Qatar', logoUrl: 'https://www.maxfashion.com/favicon.ico', website: 'https://www.maxfashion.com/qa/', mallLocation: 'City Center Doha', mapsUrl: 'https://maps.google.com/?q=Max+Fashion+City+Center+Doha', isOnline: true, isPhysical: true },
  { id: 'splash', name: 'Splash Qatar', logoUrl: 'https://www.splashfashions.com/favicon.ico', website: 'https://www.splashfashions.com/qa/', mallLocation: 'City Center Doha', mapsUrl: 'https://maps.google.com/?q=Splash+City+Center+Doha', isOnline: true, isPhysical: true },
  { id: 'lcwaikiki', name: 'LC Waikiki Qatar', logoUrl: 'https://www.lcwaikiki.com/favicon.ico', website: 'https://www.lcwaikiki.com/en-QA/', mallLocation: 'Mall of Qatar', mapsUrl: 'https://maps.google.com/?q=LC+Waikiki+Mall+of+Qatar', isOnline: true, isPhysical: true },
  { id: 'wadha', name: 'Wadha', logoUrl: '', website: 'https://www.instagram.com/wadha.official/', mallLocation: 'Doha', mapsUrl: 'https://maps.google.com/?q=Wadha+Doha', isOnline: false, isPhysical: true },
  { id: 'elisabietta', name: 'Elisabietta', logoUrl: '', website: 'https://www.instagram.com/elisabietta/', mallLocation: 'Doha', mapsUrl: 'https://maps.google.com/?q=Elisabietta+Doha', isOnline: false, isPhysical: true },
];

export const products = [
  // Zara Qatar
  { store: 'zara', name: 'Linen Blend Midi Dress', price: 299, currency: 'QAR', imageUrl: 'https://static.zara.net/assets/public/placeholder.jpg', productUrl: 'https://www.zara.com/qa/en/woman-dresses-l1066.html', category: 'dress', color: ['beige', 'white'], fabric: 'linen', style: ['flowy', 'casual'], fit: 'loose', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=Zara+Doha+Festival+City' },
  { store: 'zara', name: 'Floral Print Wrap Dress', price: 349, currency: 'QAR', imageUrl: 'https://static.zara.net/assets/public/placeholder.jpg', productUrl: 'https://www.zara.com/qa/en/woman-dresses-l1066.html', category: 'dress', color: ['floral', 'pink'], fabric: 'chiffon', style: ['elegant', 'flowy'], fit: 'fitted', occasion: ['casual', 'evening'], isOnline: true, inStoreLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=Zara+Doha+Festival+City' },
  { store: 'zara', name: 'Oversized Cotton Shirt', price: 189, currency: 'QAR', imageUrl: 'https://static.zara.net/assets/public/placeholder.jpg', productUrl: 'https://www.zara.com/qa/en/woman-shirts-l1217.html', category: 'shirt', color: ['white'], fabric: 'cotton', style: ['casual', 'loose'], fit: 'oversized', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=Zara+Doha+Festival+City' },

  // H&M Qatar
  { store: 'hm', name: 'Long Linen Blend Skirt', price: 149, currency: 'QAR', imageUrl: 'https://lp2.hm.com/hmgoepprod/placeholder.jpg', productUrl: 'https://www2.hm.com/en_qa/women/skirts.html', category: 'skirt', color: ['beige', 'sand'], fabric: 'linen', style: ['modest', 'casual'], fit: 'loose', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=HM+Doha+Festival+City' },
  { store: 'hm', name: 'Relaxed Fit Cotton Trousers', price: 129, currency: 'QAR', imageUrl: 'https://lp2.hm.com/hmgoepprod/placeholder.jpg', productUrl: 'https://www2.hm.com/en_qa/women/trousers.html', category: 'pants', color: ['black', 'navy'], fabric: 'cotton', style: ['casual', 'loose'], fit: 'loose', occasion: ['casual', 'work'], isOnline: true, inStoreLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=HM+Doha+Festival+City' },
  { store: 'hm', name: 'Chiffon Midi Dress', price: 199, currency: 'QAR', imageUrl: 'https://lp2.hm.com/hmgoepprod/placeholder.jpg', productUrl: 'https://www2.hm.com/en_qa/women/dresses.html', category: 'dress', color: ['dusty pink'], fabric: 'chiffon', style: ['elegant', 'flowy'], fit: 'loose', occasion: ['evening', 'casual'], isOnline: true, inStoreLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=HM+Doha+Festival+City' },

  // Mango Qatar
  { store: 'mango', name: 'Satin Effect Midi Dress', price: 399, currency: 'QAR', imageUrl: 'https://st.mngbcn.com/rcs/pics/static/placeholder.jpg', productUrl: 'https://shop.mango.com/qa/women/dresses', category: 'dress', color: ['black'], fabric: 'silk', style: ['elegant', 'fitted'], fit: 'fitted', occasion: ['evening', 'formal'], isOnline: true, inStoreLocation: 'Mall of Qatar', mapsUrl: 'https://maps.google.com/?q=Mango+Mall+of+Qatar' },
  { store: 'mango', name: 'Linen Wide-Leg Trousers', price: 279, currency: 'QAR', imageUrl: 'https://st.mngbcn.com/rcs/pics/static/placeholder.jpg', productUrl: 'https://shop.mango.com/qa/women/trousers', category: 'pants', color: ['beige', 'ecru'], fabric: 'linen', style: ['casual', 'loose'], fit: 'loose', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: 'Mall of Qatar', mapsUrl: 'https://maps.google.com/?q=Mango+Mall+of+Qatar' },

  // Namshi
  { store: 'namshi', name: 'Modest Maxi Abaya Dress', price: 249, currency: 'QAR', imageUrl: 'https://f.nooncdn.com/p/placeholder.jpg', productUrl: 'https://www.namshi.com/qatar-en/women-clothing-dresses/', category: 'abaya', color: ['black'], fabric: 'polyester', style: ['modest', 'elegant'], fit: 'loose', occasion: ['everyday', 'formal'], isOnline: true, inStoreLocation: null, mapsUrl: null },
  { store: 'namshi', name: 'Floral Chiffon Blouse', price: 99, currency: 'QAR', imageUrl: 'https://f.nooncdn.com/p/placeholder.jpg', productUrl: 'https://www.namshi.com/qatar-en/women-clothing/', category: 'blouse', color: ['floral', 'blue'], fabric: 'chiffon', style: ['casual', 'flowy'], fit: 'loose', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: null, mapsUrl: null },
  { store: 'namshi', name: 'Denim Straight Jeans', price: 179, currency: 'QAR', imageUrl: 'https://f.nooncdn.com/p/placeholder.jpg', productUrl: 'https://www.namshi.com/qatar-en/women-clothing/', category: 'jeans', color: ['blue', 'dark blue'], fabric: 'denim', style: ['casual'], fit: 'slim', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: null, mapsUrl: null },

  // Noon
  { store: 'noon', name: 'Tommy Hilfiger Polo Dress', price: 499, currency: 'QAR', imageUrl: 'https://f.nooncdn.com/p/placeholder.jpg', productUrl: 'https://www.noon.com/qatar-en/fashion-women/', category: 'dress', color: ['navy', 'white'], fabric: 'cotton', style: ['casual', 'sporty'], fit: 'fitted', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: null, mapsUrl: null },
  { store: 'noon', name: 'Calvin Klein Slim Trousers', price: 389, currency: 'QAR', imageUrl: 'https://f.nooncdn.com/p/placeholder.jpg', productUrl: 'https://www.noon.com/qatar-en/fashion-women/', category: 'pants', color: ['black'], fabric: 'polyester', style: ['formal', 'fitted'], fit: 'slim', occasion: ['work', 'formal'], isOnline: true, inStoreLocation: null, mapsUrl: null },

  // Massimo Dutti
  { store: 'massimodutti', name: 'Wool Blend Blazer', price: 799, currency: 'QAR', imageUrl: 'https://static.massimodutti.net/3/static/placeholder.jpg', productUrl: 'https://www.massimodutti.com/qa/en/woman-coats-blazers-l540.html', category: 'jacket', color: ['camel', 'beige'], fabric: 'wool', style: ['elegant', 'formal'], fit: 'fitted', occasion: ['work', 'formal'], isOnline: true, inStoreLocation: 'Villaggio Mall', mapsUrl: 'https://maps.google.com/?q=Massimo+Dutti+Villaggio+Mall+Doha' },
  { store: 'massimodutti', name: 'Silk Blend Midi Skirt', price: 549, currency: 'QAR', imageUrl: 'https://static.massimodutti.net/3/static/placeholder.jpg', productUrl: 'https://www.massimodutti.com/qa/en/woman-skirts-l1228.html', category: 'skirt', color: ['ivory', 'white'], fabric: 'silk', style: ['elegant', 'flowy'], fit: 'loose', occasion: ['evening', 'formal'], isOnline: true, inStoreLocation: 'Villaggio Mall', mapsUrl: 'https://maps.google.com/?q=Massimo+Dutti+Villaggio+Mall+Doha' },

  // Marks & Spencer
  { store: 'mandS', name: 'Pure Cotton Midi Shirt Dress', price: 229, currency: 'QAR', imageUrl: 'https://asset1.cxnmarksandspencer.com/is/image/placeholder.jpg', productUrl: 'https://www.marksandspencerme.com/en-qa/women/dresses', category: 'dress', color: ['white', 'blue stripe'], fabric: 'cotton', style: ['casual', 'modest'], fit: 'loose', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=Marks+Spencer+Doha+Festival+City' },
  { store: 'mandS', name: 'Linen Blend Wide Leg Trousers', price: 199, currency: 'QAR', imageUrl: 'https://asset1.cxnmarksandspencer.com/is/image/placeholder.jpg', productUrl: 'https://www.marksandspencerme.com/en-qa/women/trousers', category: 'pants', color: ['navy', 'white'], fabric: 'linen', style: ['casual', 'loose'], fit: 'loose', occasion: ['casual', 'work'], isOnline: true, inStoreLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=Marks+Spencer+Doha+Festival+City' },

  // Bershka
  { store: 'bershka', name: 'Satin Mini Skirt', price: 129, currency: 'QAR', imageUrl: 'https://static.bershka.net/assets/public/placeholder.jpg', productUrl: 'https://www.bershka.com/qa/woman/skirts', category: 'skirt', color: ['black', 'silver'], fabric: 'polyester', style: ['casual', 'fitted'], fit: 'fitted', occasion: ['evening', 'casual'], isOnline: true, inStoreLocation: 'Mall of Qatar', mapsUrl: 'https://maps.google.com/?q=Bershka+Mall+of+Qatar' },
  { store: 'bershka', name: 'Oversized Printed T-Shirt', price: 79, currency: 'QAR', imageUrl: 'https://static.bershka.net/assets/public/placeholder.jpg', productUrl: 'https://www.bershka.com/qa/woman/tops', category: 'top', color: ['white', 'grey'], fabric: 'cotton', style: ['casual', 'loose'], fit: 'oversized', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: 'Mall of Qatar', mapsUrl: 'https://maps.google.com/?q=Bershka+Mall+of+Qatar' },

  // Stradivarius
  { store: 'stradivarius', name: 'Flowy Maxi Dress', price: 219, currency: 'QAR', imageUrl: 'https://cdn.stradivarius.net/assets/public/placeholder.jpg', productUrl: 'https://www.stradivarius.com/qa/woman/dresses', category: 'dress', color: ['olive', 'green'], fabric: 'polyester', style: ['flowy', 'casual', 'modest'], fit: 'loose', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: 'Doha Festival City', mapsUrl: 'https://maps.google.com/?q=Stradivarius+Doha+Festival+City' },

  // Pull&Bear
  { store: 'pullandbear', name: 'Denim Mom Jeans', price: 159, currency: 'QAR', imageUrl: 'https://static.pullandbear.net/assets/public/placeholder.jpg', productUrl: 'https://www.pullandbear.com/qa/woman/jeans', category: 'jeans', color: ['light blue', 'blue'], fabric: 'denim', style: ['casual', 'loose'], fit: 'loose', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: 'Mall of Qatar', mapsUrl: 'https://maps.google.com/?q=Pull+Bear+Mall+of+Qatar' },

  // Ounass
  { store: 'ounass', name: 'Zimmermann Linen Midi Dress', price: 1899, currency: 'QAR', imageUrl: 'https://www.ounass.com/assets/placeholder.jpg', productUrl: 'https://www.ounass.com/women/clothing/dresses', category: 'dress', color: ['white', 'ivory'], fabric: 'linen', style: ['elegant', 'flowy', 'modest'], fit: 'loose', occasion: ['casual', 'evening'], isOnline: true, inStoreLocation: null, mapsUrl: null },
  { store: 'ounass', name: 'Self-Portrait Lace Top', price: 1299, currency: 'QAR', imageUrl: 'https://www.ounass.com/assets/placeholder.jpg', productUrl: 'https://www.ounass.com/women/clothing/tops', category: 'top', color: ['white'], fabric: 'cotton', style: ['elegant', 'fitted'], fit: 'fitted', occasion: ['evening', 'formal'], isOnline: true, inStoreLocation: null, mapsUrl: null },

  // 6th Street
  { store: '6thstreet', name: 'Floral Wrap Midi Dress', price: 289, currency: 'QAR', imageUrl: 'https://en-qa.6thstreet.com/placeholder.jpg', productUrl: 'https://en-qa.6thstreet.com/women/clothing/dresses', category: 'dress', color: ['floral', 'pink', 'blue'], fabric: 'chiffon', style: ['flowy', 'casual'], fit: 'loose', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: null, mapsUrl: null },

  // VogaCloset
  { store: 'vogacloset', name: 'Boohoo Satin Slip Dress', price: 149, currency: 'QAR', imageUrl: 'https://vogacloset.com/placeholder.jpg', productUrl: 'https://vogacloset.com/qatar/en/women/clothing', category: 'dress', color: ['champagne', 'gold'], fabric: 'polyester', style: ['elegant', 'fitted'], fit: 'fitted', occasion: ['evening'], isOnline: true, inStoreLocation: null, mapsUrl: null },

  // Max Fashion
  { store: 'maxfashion', name: 'Solid Abaya with Belt', price: 119, currency: 'QAR', imageUrl: 'https://www.maxfashion.com/placeholder.jpg', productUrl: 'https://www.maxfashion.com/qa/en/department/women', category: 'abaya', color: ['black', 'navy'], fabric: 'polyester', style: ['modest', 'casual'], fit: 'loose', occasion: ['everyday', 'formal'], isOnline: true, inStoreLocation: 'City Center Doha', mapsUrl: 'https://maps.google.com/?q=Max+Fashion+City+Center+Doha' },

  // Splash
  { store: 'splash', name: 'Printed Chiffon Kurta', price: 99, currency: 'QAR', imageUrl: 'https://www.splashfashions.com/placeholder.jpg', productUrl: 'https://www.splashfashions.com/qa/women', category: 'top', color: ['floral', 'red'], fabric: 'chiffon', style: ['modest', 'casual', 'flowy'], fit: 'loose', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: 'City Center Doha', mapsUrl: 'https://maps.google.com/?q=Splash+City+Center+Doha' },

  // LC Waikiki
  { store: 'lcwaikiki', name: 'Long Modest Dress with Pockets', price: 89, currency: 'QAR', imageUrl: 'https://img.lcwaikiki.com/placeholder.jpg', productUrl: 'https://www.lcwaikiki.com/en-QA/women/dresses', category: 'dress', color: ['olive', 'khaki'], fabric: 'cotton', style: ['modest', 'casual', 'loose'], fit: 'loose', occasion: ['casual', 'everyday'], isOnline: true, inStoreLocation: 'Mall of Qatar', mapsUrl: 'https://maps.google.com/?q=LC+Waikiki+Mall+of+Qatar' },

  // bfab
  { store: 'bfab', name: 'Premium Linen Co-ord Set', price: 449, currency: 'QAR', imageUrl: 'https://bfab.com/placeholder.jpg', productUrl: 'https://bfab.com/qa_en/women', category: 'top', color: ['beige', 'camel'], fabric: 'linen', style: ['elegant', 'casual'], fit: 'loose', occasion: ['casual', 'work'], isOnline: true, inStoreLocation: null, mapsUrl: null },

  // Galeries Lafayette
  { store: 'galerieslafayette', name: 'Valentino Silk Blouse', price: 2499, currency: 'QAR', imageUrl: 'https://www.galerieslafayette.qa/placeholder.jpg', productUrl: 'https://www.galerieslafayette.qa/women/clothing.html', category: 'blouse', color: ['ivory', 'white'], fabric: 'silk', style: ['elegant', 'formal'], fit: 'fitted', occasion: ['formal', 'evening'], isOnline: true, inStoreLocation: 'Katara Cultural Village', mapsUrl: 'https://maps.google.com/?q=Galeries+Lafayette+Doha' },
];
```

- [ ] **Step 2: Write seed script**

Create `scripts/seed.ts`:

```typescript
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
```

- [ ] **Step 3: Install ts-node for running the seed script**

```bash
npm install --save-dev ts-node @types/node
```

- [ ] **Step 4: Run the seed script**

```bash
GOOGLE_APPLICATION_CREDENTIALS="path/to/your/serviceAccountKey.json" npx ts-node scripts/seed.ts
```

To get `serviceAccountKey.json`: Firebase Console → Project Settings → Service accounts → Generate new private key → download JSON file.

Expected output:
```
Seeding stores...
  ✔ Namshi
  ✔ Noon Fashion
  ... (all 20 stores)
Seeding products...
..........................
  ✔ 30 products seeded
Done!
```

- [ ] **Step 5: Verify in Firebase Console**

Open Firebase Console → Firestore → Data tab. You should see `products` and `stores` collections with documents.

- [ ] **Step 6: Commit**

```bash
git add functions/src/seed/ scripts/
git commit -m "feat: add Firestore seed data for 20 Qatar stores"
```

---

### Task 6: Search Screen (Home)

**Files:**
- Create: `app/index.tsx`
- Create: `components/RecentSearches.tsx`

**Interfaces:**
- Consumes: `saveRecentSearch`, `getRecentSearches` from `lib/recentSearches.ts`
- Produces: navigation to `results` screen with `query` param

- [ ] **Step 1: Write RecentSearches component**

Create `components/RecentSearches.tsx`:

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  searches: string[];
  onSelect: (query: string) => void;
}

export function RecentSearches({ searches, onSelect }: Props) {
  if (searches.length === 0) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Recent searches</Text>
      {searches.map((s, i) => (
        <TouchableOpacity key={i} onPress={() => onSelect(s)} style={styles.item}>
          <Text style={styles.itemText}>🕐 {s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24 },
  label: { fontSize: 13, color: '#999', marginBottom: 8, fontWeight: '600', textTransform: 'uppercase' },
  item: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemText: { fontSize: 15, color: '#333' },
});
```

- [ ] **Step 2: Write Search screen**

Replace `app/index.tsx` with:

```typescript
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveRecentSearch, getRecentSearches } from '../lib/recentSearches';
import { RecentSearches } from '../components/RecentSearches';

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    getRecentSearches().then(setRecentSearches);
  }, []);

  async function handleSearch() {
    const trimmed = query.trim();
    if (trimmed.length < 3) return;
    await saveRecentSearch(trimmed);
    router.push({ pathname: '/results', params: { query: trimmed } });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <Text style={styles.title}>Vibe&Thread</Text>
        <Text style={styles.subtitle}>Find clothing in Qatar</Text>

        <TextInput
          style={styles.input}
          placeholder="Describe what you're looking for..."
          placeholderTextColor="#aaa"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.button, query.trim().length < 3 && styles.buttonDisabled]}
          onPress={handleSearch}
          disabled={query.trim().length < 3}
        >
          <Text style={styles.buttonText}>Search</Text>
        </TouchableOpacity>

        <RecentSearches
          searches={recentSearches}
          onSelect={(q) => {
            setQuery(q);
            router.push({ pathname: '/results', params: { query: q } });
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 24 },
  title: { fontSize: 32, fontWeight: '700', color: '#1a1a1a', marginTop: 24 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32, marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, padding: 16, fontSize: 16, color: '#1a1a1a', minHeight: 80, textAlignVertical: 'top', backgroundColor: '#fafafa' },
  button: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 3: Test in Expo Go**

Run `npx expo start`. Expected:
- "Vibe&Thread" title shown
- Text input visible
- Search button disabled when input is empty
- Button activates when 3+ characters typed
- Recent searches appear after first search

- [ ] **Step 4: Commit**

```bash
git add app/index.tsx components/RecentSearches.tsx
git commit -m "feat: add search home screen with recent searches"
```

---

### Task 7: Product & Store Result Cards

**Files:**
- Create: `components/ProductCard.tsx`
- Create: `components/StoreCard.tsx`

**Interfaces:**
- Consumes: `Product` and `Store` types from `types/index.ts`
- Produces: `ProductCard` and `StoreCard` components used by results screen

- [ ] **Step 1: Write ProductCard**

Create `components/ProductCard.tsx`:

```typescript
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Product } from '../types';

interface Props { product: Product; }

export function ProductCard({ product }: Props) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: product.imageUrl }} style={styles.image} defaultSource={require('../assets/placeholder.png')} />
      <View style={styles.info}>
        <Text style={styles.store}>{product.store.toUpperCase()}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.price}>QAR {product.price}</Text>
        {product.inStoreLocation && (
          <Text style={styles.location}>📍 {product.inStoreLocation}</Text>
        )}
      </View>
      <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(product.productUrl)}>
        <Text style={styles.buttonText}>View</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', padding: 12, borderRadius: 12, backgroundColor: '#fff', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  image: { width: 80, height: 100, borderRadius: 8, backgroundColor: '#f0f0f0' },
  info: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  store: { fontSize: 10, color: '#999', fontWeight: '700', letterSpacing: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginTop: 4 },
  price: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginTop: 4 },
  location: { fontSize: 11, color: '#888', marginTop: 2 },
  button: { backgroundColor: '#1a1a1a', borderRadius: 8, padding: 8, alignSelf: 'center', marginLeft: 8 },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
```

- [ ] **Step 2: Add placeholder image asset**

Create `assets/placeholder.png` — download any 100x100 grey placeholder PNG and save it there. You can use:
```bash
curl -o assets/placeholder.png "https://via.placeholder.com/100x100.png?text=No+Image"
```

- [ ] **Step 3: Write StoreCard**

Create `components/StoreCard.tsx`:

```typescript
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Store } from '../types';

interface Props { store: Store; }

export function StoreCard({ store }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.logoContainer}>
        {store.logoUrl ? (
          <Image source={{ uri: store.logoUrl }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Text style={styles.logoFallbackText}>{store.name[0]}</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{store.name}</Text>
        {store.mallLocation && <Text style={styles.location}>📍 {store.mallLocation}</Text>}
        {store.matchReason && <Text style={styles.reason}>{store.matchReason}</Text>}
      </View>
      {store.mapsUrl && (
        <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(store.mapsUrl!)}>
          <Text style={styles.buttonText}>Directions</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', padding: 12, borderRadius: 12, backgroundColor: '#fff', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, alignItems: 'center' },
  logoContainer: { marginRight: 12 },
  logo: { width: 48, height: 48, borderRadius: 8 },
  logoFallback: { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  logoFallbackText: { fontSize: 20, fontWeight: '700', color: '#666' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  location: { fontSize: 12, color: '#888', marginTop: 2 },
  reason: { fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },
  button: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginLeft: 8 },
  buttonText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
```

- [ ] **Step 4: Commit**

```bash
git add components/ProductCard.tsx components/StoreCard.tsx assets/placeholder.png
git commit -m "feat: add ProductCard and StoreCard components"
```

---

### Task 8: Results Screen

**Files:**
- Create: `app/results.tsx`

**Interfaces:**
- Consumes: `searchClothing` from `lib/search.ts`, `ProductCard` from `components/ProductCard.tsx`, `StoreCard` from `components/StoreCard.tsx`, `SearchResult` from `types/index.ts`
- Produces: full results screen with Online/In-Store tabs and No Results state

- [ ] **Step 1: Write Results screen**

Create `app/results.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchClothing } from '../lib/search';
import { ProductCard } from '../components/ProductCard';
import { StoreCard } from '../components/StoreCard';
import { SearchResult } from '../types';

type Tab = 'online' | 'instore';

export default function ResultsScreen() {
  const { query } = useLocalSearchParams<{ query: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('online');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError(null);
    searchClothing(query)
      .then(setResult)
      .catch(() => setError('Something went wrong. Please try again.'))
      .finally(() => setLoading(false));
  }, [query]);

  const noResults = result && result.products.length === 0 && result.stores.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.queryText} numberOfLines={1}>{query}</Text>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a1a1a" />
          <Text style={styles.loadingText}>Finding your style...</Text>
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {noResults && !loading && (
        <View style={styles.center}>
          <Text style={styles.noResultsTitle}>No exact matches found</Text>
          <Text style={styles.noResultsSubtitle}>We couldn't find an exact match — try describing it differently</Text>
          {result.suggestedTweaks.map((tweak, i) => (
            <Text key={i} style={styles.tweak}>💡 {tweak}</Text>
          ))}
          <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryText}>Search again</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && !noResults && !loading && (
        <>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'online' && styles.tabActive]}
              onPress={() => setActiveTab('online')}
            >
              <Text style={[styles.tabText, activeTab === 'online' && styles.tabTextActive]}>
                Online ({result.products.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'instore' && styles.tabActive]}
              onPress={() => setActiveTab('instore')}
            >
              <Text style={[styles.tabText, activeTab === 'instore' && styles.tabTextActive]}>
                In-Store ({result.stores.length})
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'online' && (
            <FlatList
              data={result.products}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ProductCard product={item} />}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}

          {activeTab === 'instore' && (
            <FlatList
              data={result.stores}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <StoreCard store={item} />}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  back: { marginRight: 12 },
  backText: { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },
  queryText: { flex: 1, fontSize: 14, color: '#666', fontStyle: 'italic' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#1a1a1a' },
  tabText: { fontSize: 14, color: '#999', fontWeight: '600' },
  tabTextActive: { color: '#1a1a1a' },
  list: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  errorText: { fontSize: 16, color: '#e00', textAlign: 'center' },
  noResultsTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  noResultsSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 16 },
  tweak: { fontSize: 14, color: '#555', marginBottom: 8 },
  retryButton: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginTop: 16, paddingHorizontal: 32 },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Test full flow in Expo Go**

1. Run `npx expo start`
2. Open in Expo Go
3. Type "flowy beige linen dress" → tap Search
4. Expected: loading spinner → results with Online and In-Store tabs
5. Tap a product "View" button → store website opens in browser
6. Switch to In-Store tab → stores shown with "Directions" button
7. Tap "Directions" → Google Maps opens

- [ ] **Step 3: Commit**

```bash
git add app/results.tsx
git commit -m "feat: add results screen with online and in-store tabs"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Search screen with text input → Task 6
- ✅ AI-powered matching via Gemini → Task 3
- ✅ Firebase product database (20 stores, manually seeded) → Tasks 2, 4, 5
- ✅ Online results tab → Task 8
- ✅ In-Store results tab → Task 8
- ✅ Google Maps link for physical stores → Tasks 5, 7
- ✅ No-results screen with suggestions → Task 8
- ✅ Expo Go delivery → Task 1
- ✅ Recent searches → Tasks 4, 6
- ✅ All 20 stores → Task 5

**Placeholder scan:** None found — all steps contain full code.

**Type consistency:**
- `Product`, `Store`, `SearchResult`, `SearchAttributes` defined in Task 1 and used consistently
- `searchClothing` defined in Task 4 and consumed in Task 8
- `scoreProduct` uses same field names as Firestore schema defined in Task 5
