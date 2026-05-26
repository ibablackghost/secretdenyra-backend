import { createHmac, createHash, timingSafeEqual } from 'crypto';

export type PaytechConfig = {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  env: 'test' | 'prod';
  ipnUrl: string;
  successUrl: string;
  cancelUrl: string;
};

export type PaytechRequestPaymentInput = {
  itemName: string;
  itemPrice: number;
  refCommand: string;
  commandName: string;
  currency?: string;
  customField?: Record<string, unknown>;
};

export type PaytechRequestPaymentResult = {
  token: string;
  redirectUrl: string;
};

export type PaytechIpnPayload = {
  type_event?: string;
  ref_command?: string;
  item_price?: number | string;
  final_item_price?: number | string;
  token?: string;
  hmac_compute?: string;
  api_key_sha256?: string;
  api_secret_sha256?: string;
  custom_field?: string;
  payment_method?: string;
  client_phone?: string;
};

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

export const getPaytechConfig = (): PaytechConfig | null => {
  const apiKey = String(process.env.PAYTECH_API_KEY ?? '').trim();
  const apiSecret = String(process.env.PAYTECH_API_SECRET ?? '').trim();
  if (!apiKey || !apiSecret) return null;

  const envRaw = String(process.env.PAYTECH_ENV ?? 'prod').trim().toLowerCase();

  return {
    apiKey,
    apiSecret,
    baseUrl: String(process.env.PAYTECH_BASE_URL ?? 'https://paytech.sn/api').replace(/\/$/, ''),
    env: envRaw === 'test' ? 'test' : 'prod',
    ipnUrl: String(process.env.PAYTECH_IPN_URL ?? '').trim(),
    successUrl: String(process.env.PAYTECH_SUCCESS_URL ?? '').trim(),
    cancelUrl: String(process.env.PAYTECH_CANCEL_URL ?? '').trim(),
  };
};

export const buildRefCommand = (checkoutId: string) => {
  const suffix = checkoutId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
  return `NYRA-${Date.now()}-${suffix}`;
};

export const requestPaytechPayment = async (
  input: PaytechRequestPaymentInput,
): Promise<PaytechRequestPaymentResult | null> => {
  const config = getPaytechConfig();
  if (!config) return null;

  const body = {
    item_name: input.itemName,
    item_price: input.itemPrice,
    ref_command: input.refCommand,
    command_name: input.commandName,
    currency: input.currency ?? 'XOF',
    env: config.env,
    ...(config.ipnUrl ? { ipn_url: config.ipnUrl } : {}),
    ...(config.successUrl ? { success_url: config.successUrl } : {}),
    ...(config.cancelUrl ? { cancel_url: config.cancelUrl } : {}),
    ...(input.customField ? { custom_field: JSON.stringify(input.customField) } : {}),
  };

  const response = await fetch(`${config.baseUrl}/payment/request-payment`, {
    method: 'POST',
    headers: {
      API_KEY: config.apiKey,
      API_SECRET: config.apiSecret,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as Record<string, unknown>;
  const token = String(payload.token ?? '').trim();
  const redirectUrl = String(payload.redirect_url ?? payload.redirectUrl ?? '').trim();

  if (!token || !redirectUrl) return null;

  return { token, redirectUrl };
};

export const fetchPaytechPaymentStatus = async (token: string) => {
  const config = getPaytechConfig();
  if (!config || !token) return null;

  const url = new URL(`${config.baseUrl}/payment/get-status`);
  url.searchParams.set('token_payment', token);

  const response = await fetch(url, {
    headers: {
      API_KEY: config.apiKey,
      API_SECRET: config.apiSecret,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) return null;
  return (await response.json()) as Record<string, unknown>;
};

export const verifyPaytechIpn = (payload: PaytechIpnPayload): boolean => {
  const config = getPaytechConfig();
  if (!config) return false;

  const refCommand = String(payload.ref_command ?? '');
  const itemPrice = payload.final_item_price ?? payload.item_price;
  const priceValue = String(itemPrice ?? '');

  if (payload.hmac_compute) {
    const message = `${priceValue}|${refCommand}|${config.apiKey}`;
    const expected = createHmac('sha256', config.apiSecret).update(message).digest('hex');
    return safeEqual(expected, String(payload.hmac_compute));
  }

  if (payload.api_key_sha256 && payload.api_secret_sha256) {
    const expectedKey = createHash('sha256').update(config.apiKey).digest('hex');
    const expectedSecret = createHash('sha256').update(config.apiSecret).digest('hex');
    return (
      safeEqual(expectedKey, String(payload.api_key_sha256)) &&
      safeEqual(expectedSecret, String(payload.api_secret_sha256))
    );
  }

  return false;
};

export const mapPaytechRemoteStatus = (remote: Record<string, unknown> | null) => {
  const raw = String(remote?.payment_status ?? remote?.status ?? remote?.state ?? '').toLowerCase();
  if (['success', 'succeeded', 'completed', 'complete', 'paid'].includes(raw)) return 'SUCCESS';
  if (['canceled', 'cancelled', 'cancel'].includes(raw)) return 'CANCELED';
  if (['failed', 'error', 'declined'].includes(raw)) return 'FAILED';
  return 'PENDING';
};
