export type CurrencyCode = 'USD' | 'INR' | 'AED' | 'GBP' | 'AUD' | 'EUR' | 'CAD' | 'SGD'

export const CURRENCY_CONFIG: Record<CurrencyCode, { symbol: string; name: string; locale: string }> = {
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  INR: { symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  AED: { symbol: 'AED', name: 'UAE Dirham', locale: 'ar-AE' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE' },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
}

export function formatCurrency(amount: number, currency: CurrencyCode = 'USD'): string {
  const config = CURRENCY_CONFIG[currency]
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
