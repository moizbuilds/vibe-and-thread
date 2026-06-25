import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import { SearchResult } from '../types';

export async function searchClothing(description: string): Promise<SearchResult> {
  const functions = getFunctions(app, 'us-central1');
  const fn = httpsCallable<{ description: string }, SearchResult>(functions, 'searchClothing');
  const result = await fn({ description });
  return result.data;
}
