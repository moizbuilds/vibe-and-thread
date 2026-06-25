import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { SearchResult } from '../types';

// Re-use the already-initialised Firebase app
import { db } from './firebase';

export async function searchClothing(description: string): Promise<SearchResult> {
  const functions = getFunctions(getApp(), 'us-central1');
  const fn = httpsCallable<{ description: string }, SearchResult>(functions, 'searchClothing');
  const result = await fn({ description });
  return result.data;
}
