import Groq from 'groq-sdk';

export interface SearchAttributes {
  category: string;
  color: string[];
  fabric: string;
  style: string[];
  fit: string;
  occasion: string[];
}

export async function extractAttributes(description: string): Promise<SearchAttributes> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'user',
        content: `You are a fashion assistant. Extract clothing attributes from this description as JSON only. No explanation, just JSON.

Description: "${description}"

Return exactly this JSON structure:
{
  "category": "one of: dress, top, blouse, shirt, pants, jeans, skirt, jacket, coat, abaya, jumpsuit, other",
  "color": ["array of colors mentioned, empty array if none"],
  "fabric": "one of: linen, cotton, silk, chiffon, denim, polyester, wool, unknown",
  "style": ["array of styles, e.g: flowy, modest, casual, formal, fitted, loose, elegant, sporty"],
  "fit": "one of: loose, fitted, oversized, slim, regular, unknown",
  "occasion": ["array of: casual, work, formal, evening, beach, sport, everyday"]
}`,
      },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const text = completion.choices[0]?.message?.content ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Groq did not return valid JSON');
  return JSON.parse(jsonMatch[0]) as SearchAttributes;
}
