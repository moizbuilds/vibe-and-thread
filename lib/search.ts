import { SearchResult } from '../types';

const FUNCTION_URL = 'https://us-central1-vibethread-ad718.cloudfunctions.net/searchClothing';

export async function searchClothing(description: string): Promise<SearchResult> {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { description } }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const json = await response.json();
  return json.result as SearchResult;
}
