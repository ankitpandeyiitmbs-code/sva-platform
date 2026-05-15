export type SalesChannel =
  | 'AMAZON_US'
  | 'AMAZON_IN'
  | 'AMAZON_UK'
  | 'AMAZON_AE'
  | 'AMAZON_AU'
  | 'WALMART'
  | 'TIKTOK_SHOP'
  | 'SHOPIFY'
  | 'MYNTRA'
  | 'FLIPKART'
  | 'MANUAL'
  | 'OTHER'

export type ChannelStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING'

export interface ChannelConfig {
  id: string
  orgId: string
  channel: SalesChannel
  status: ChannelStatus
  displayName: string
  credentials: Record<string, string>
  lastSyncAt?: string
  syncEnabled: boolean
  createdAt: string
}

export const CHANNEL_LABELS: Record<SalesChannel, string> = {
  AMAZON_US: 'Amazon US',
  AMAZON_IN: 'Amazon India',
  AMAZON_UK: 'Amazon UK',
  AMAZON_AE: 'Amazon UAE',
  AMAZON_AU: 'Amazon Australia',
  WALMART: 'Walmart',
  TIKTOK_SHOP: 'TikTok Shop',
  SHOPIFY: 'Shopify',
  MYNTRA: 'Myntra',
  FLIPKART: 'Flipkart',
  MANUAL: 'Manual Entry',
  OTHER: 'Other',
}
