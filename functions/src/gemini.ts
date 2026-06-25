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
