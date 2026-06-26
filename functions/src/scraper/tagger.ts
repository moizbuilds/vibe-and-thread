import { extractAttributes } from '../gemini';
import { ScrapedProduct } from './types';

export async function tagProduct(product: ScrapedProduct): Promise<ScrapedProduct> {
  try {
    const description = `${product.name} from ${product.store}`;
    const attrs = await extractAttributes(description);
    return {
      ...product,
      category: attrs.category,
      fabric: attrs.fabric,
      style: attrs.style,
      fit: attrs.fit,
      occasion: attrs.occasion,
      // merge AI colors with any colors extracted from title
      color: product.color.length > 0 ? product.color : attrs.color,
    };
  } catch {
    // if tagging fails, return product with defaults so it still gets saved
    return {
      ...product,
      category: product.category || 'other',
      fabric: product.fabric || 'unknown',
      style: product.style.length > 0 ? product.style : [],
      fit: product.fit || 'unknown',
      occasion: product.occasion.length > 0 ? product.occasion : ['everyday'],
    };
  }
}
