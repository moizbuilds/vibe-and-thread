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
