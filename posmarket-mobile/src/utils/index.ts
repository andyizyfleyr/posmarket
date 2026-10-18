/**
 * Utilities — copy from web project (src/utils.ts + src/utils/slug.ts).
 */

export const formatNumber = (num: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1_000_000_000) {
    const value = num / 1_000_000_000;
    return value % 1 === 0 ? `${value}B` : `${value.toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (num >= 1_000_000) {
    const value = num / 1_000_000;
    return value % 1 === 0 ? `${value}M` : `${value.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1_000) {
    const value = num / 1_000;
    return value % 1 === 0 ? `${value}K` : `${value.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return num.toString();
};

export const formatCurrency = (amount: number): string => {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 FCFA';
  return Math.floor(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
};

export const maskName = (name?: string | null): string => {
  if (!name || !name.trim()) return 'Client vérifié';
  const parts = name.trim().split(/\s+/);
  return parts
    .map((part) => {
      if (part.length <= 1) return part + '***';
      return part[0] + '*'.repeat(Math.min(part.length - 1, 5));
    })
    .join(' ');
};

export const generateSlug = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

export function generateProductSlug(product: { id?: string; name?: string }): string {
  if (!product || !product.id) return '';
  if (!product.name) return product.id;
  const cleanName = product.name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const shortId = product.id.split('-')[0];
  if (!cleanName) return product.id;
  return `${cleanName}-${shortId}`;
}
