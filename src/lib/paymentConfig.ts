import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { initFedapayConfig } from './fedapay';
import { initKkiapayConfig } from './kkiapay';
import { initFeexpayConfig } from './feexpay';

export interface PaymentConfig {
  provider: 'kkiapay' | 'fedapay' | 'feexpay';
  kkiapayPublicKey?: string;
  kkiapayPrivateKey?: string;
  kkiapaySecretKey?: string;
  kkiapayEnv?: 'sandbox' | 'live';
  fedapayPublicKey?: string;
  fedapaySecretKey?: string;
  fedapayWebhookSecret?: string;
  fedapayEnv?: 'sandbox' | 'live';
  feexpayShopId?: string;
  feexpayApiKey?: string;
  feexpaySecretKey?: string;
  feexpayWebhookSecret?: string;
  feexpayEnv?: 'sandbox' | 'live';
}

export async function loadPaymentConfig(): Promise<PaymentConfig> {
  const rows = await db.select().from(systemSettings);
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(r.key, r.value);
  }
  const provider = (map.get('payment_provider') as 'kkiapay' | 'fedapay' | 'feexpay') || 'kkiapay';

  const config: PaymentConfig = {
    provider,
    kkiapayPublicKey: map.get('kkiapay_public_key') || '',
    kkiapayPrivateKey: map.get('kkiapay_private_key') || '',
    kkiapaySecretKey: map.get('kkiapay_secret_key') || '',
    kkiapayEnv: (map.get('kkiapay_env') as 'sandbox' | 'live') || 'sandbox',
    fedapayPublicKey: map.get('fedapay_public_key') || '',
    fedapaySecretKey: map.get('fedapay_secret_key') || '',
    fedapayWebhookSecret: map.get('fedapay_webhook_secret') || '',
    fedapayEnv: (map.get('fedapay_env') as 'sandbox' | 'live') || 'sandbox',
    feexpayShopId: map.get('feexpay_shop_id') || '',
    feexpayApiKey: map.get('feexpay_api_key') || '',
    feexpaySecretKey: map.get('feexpay_secret_key') || '',
    feexpayWebhookSecret: map.get('feexpay_webhook_secret') || '',
    feexpayEnv: (map.get('feexpay_env') as 'sandbox' | 'live') || 'sandbox',
  };

  // Init fedapay et kkiapay avec la config DB
  initFedapayConfig({
    publicKey: config.fedapayPublicKey,
    secretKey: config.fedapaySecretKey,
    webhookSecret: config.fedapayWebhookSecret,
    env: config.fedapayEnv,
  });
  initKkiapayConfig({
    publicKey: config.kkiapayPublicKey,
    privateKey: config.kkiapayPrivateKey,
    secretKey: config.kkiapaySecretKey,
    env: config.kkiapayEnv,
  });
  initFeexpayConfig({
    shopId: config.feexpayShopId,
    apiKey: config.feexpayApiKey,
    secretKey: config.feexpaySecretKey,
    webhookSecret: config.feexpayWebhookSecret,
    env: config.feexpayEnv,
  });

  return config;
}

export async function getPaymentProvider(): Promise<'kkiapay' | 'fedapay' | 'feexpay'> {
  const [row] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, 'payment_provider')).limit(1);
  return (row?.value as 'kkiapay' | 'fedapay' | 'feexpay') || 'kkiapay';
}
