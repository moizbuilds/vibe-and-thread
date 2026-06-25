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
