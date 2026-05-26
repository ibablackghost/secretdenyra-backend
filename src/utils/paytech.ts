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

export type PaytechRequestPaymentResult =
  | { ok: true; token: string; redirectUrl: string }
  | {
      ok: false;
      reason: 'missing_config' | 'http_error' | 'invalid_response' | 'paytech_rejected';
      status?: number;
      message?: string;
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

const buildPaymentBody = (config: PaytechConfig, input: PaytechRequestPaymentInput) => {
  const params = new URLSearchParams();
  params.set('item_name', input.itemName);
  params.set('item_price', String(input.itemPrice));
  params.set('ref_command', input.refCommand);
  params.set('command_name', input.commandName);
  params.set('currency', input.currency ?? 'XOF');
  params.set('env', config.env);

  if (config.ipnUrl) params.set('ipn_url', config.ipnUrl);
  if (config.successUrl) params.set('success_url', config.successUrl);
  if (config.cancelUrl) params.set('cancel_url', config.cancelUrl);
  if (input.customField) params.set('custom_field', JSON.stringify(input.customField));

  return params;
};

const parsePaymentResponse = (payload: Record<string, unknown>): PaytechRequestPaymentResult => {
  const success = payload.success;
  if (success === 0 || success === -1 || success === '0' || success === '-1') {
    return {
      ok: false,
      reason: 'paytech_rejected',
      message: String(payload.message ?? payload.error ?? 'PayTech a refusé la demande.'),
    };
  }

  const token = String(payload.token ?? '').trim();
  const redirectUrl = String(payload.redirect_url ?? payload.redirectUrl ?? '').trim();

  if (!token || !redirectUrl) {
    return {
      ok: false,
      reason: 'invalid_response',
      message: 'Réponse PayTech incomplète (token ou redirect_url manquant).',
    };
  }

  return { ok: true, token, redirectUrl };
};

export const requestPaytechPayment = async (
  input: PaytechRequestPaymentInput,
): Promise<PaytechRequestPaymentResult> => {
  const config = getPaytechConfig();
  if (!config) {
    return { ok: false, reason: 'missing_config', message: 'PAYTECH_API_KEY ou PAYTECH_API_SECRET manquant.' };
  }

  const url = `${config.baseUrl}/payment/request-payment`;
  const formBody = buildPaymentBody(config, input);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        API_KEY: config.apiKey,
        API_SECRET: config.apiSecret,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody.toString(),
      signal: AbortSignal.timeout(30_000),
    });

    const rawText = await response.text();
    let payload: Record<string, unknown> = {};

    try {
      payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    } catch {
      return {
        ok: false,
        reason: 'invalid_response',
        status: response.status,
        message: `Réponse PayTech non JSON (HTTP ${response.status}).`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: 'http_error',
        status: response.status,
        message: String(payload.message ?? payload.error ?? `HTTP ${response.status}`),
      };
    }

    return parsePaymentResponse(payload);
  } catch (error) {
    return {
      ok: false,
      reason: 'http_error',
      message: error instanceof Error ? error.message : 'Erreur réseau vers PayTech.',
    };
  }
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
