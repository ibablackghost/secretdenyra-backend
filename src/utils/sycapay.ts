import { createHmac, timingSafeEqual } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import https from 'https';
import { isAbsolute, resolve } from 'path';
import { URL } from 'url';

export const SYCAPAY_PM_SERVICES = [
  'SN_PM_WAVE',
  'SN_PM_OM',
  'SN_PM_YAS',
  'SN_PM_WIZALL',
] as const;

export type SycapayPmService = (typeof SYCAPAY_PM_SERVICES)[number];

export type SycapayConfig = {
  baseUrl: string;
  loginApi: string;
  mdpApi: string;
  ca: Buffer;
  cert: Buffer;
  key: Buffer;
  successUrl: string;
  failedUrl: string;
  webhookAuth: 'NONE' | 'BASIC' | 'BEARER' | 'HMAC';
  webhookSecret: string;
};

export type SycapayInitInput = {
  montant: number;
  codeService: SycapayPmService;
  numeroBeneficiaire: string;
  idPartenaire: string;
  nomMarchand?: string;
};

export type SycapayInitResult =
  | {
      ok: true;
      tokenTX: string;
      redirectUrl: string | null;
      deeplink: string | null;
      deepLinks: Record<string, string> | null;
      qrCode: string | null;
      otpRequired: boolean;
      raw: Record<string, unknown>;
    }
  | {
      ok: false;
      reason: 'missing_config' | 'http_error' | 'invalid_response' | 'sycapay_rejected';
      status?: number;
      message?: string;
      code?: string;
    };

const resolveCertPath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return isAbsolute(trimmed) ? trimmed : resolve(process.cwd(), trimmed);
};

const readCertFile = (envKey: string): Buffer | null => {
  const path = resolveCertPath(String(process.env[envKey] ?? ''));
  if (!path || !existsSync(path)) return null;
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
};

/** Railway : coller le PEM encodé base64 (une seule ligne). Local : fichiers via *_PATH. */
const readCertMaterial = (b64EnvKey: string, pathEnvKey: string): Buffer | null => {
  const b64 = String(process.env[b64EnvKey] ?? '').trim().replace(/\s+/g, '');
  if (b64) {
    try {
      const buf = Buffer.from(b64, 'base64');
      if (buf.length > 0) return buf;
    } catch {
      return null;
    }
  }
  return readCertFile(pathEnvKey);
};

export const getSycapayConfig = (): SycapayConfig | null => {
  const loginApi = String(process.env.SYCAPAY_LOGIN_API ?? '').trim();
  const mdpApi = String(process.env.SYCAPAY_MDP_API ?? '').trim();
  const ca = readCertMaterial('SYCAPAY_CA_CERT_B64', 'SYCAPAY_CA_CERT_PATH');
  const cert = readCertMaterial('SYCAPAY_CLIENT_CERT_B64', 'SYCAPAY_CLIENT_CERT_PATH');
  const key = readCertMaterial('SYCAPAY_CLIENT_KEY_B64', 'SYCAPAY_CLIENT_KEY_PATH');

  if (!loginApi || !mdpApi || !ca || !cert || !key) return null;

  const authRaw = String(process.env.SYCAPAY_WEBHOOK_AUTH ?? 'HMAC').trim().toUpperCase();
  const webhookAuth =
    authRaw === 'NONE' || authRaw === 'BASIC' || authRaw === 'BEARER' || authRaw === 'HMAC'
      ? authRaw
      : 'HMAC';

  return {
    baseUrl: String(process.env.SYCAPAY_BASE_URL ?? 'https://ops.sycapay.com/coresystem/part/api').replace(
      /\/$/,
      '',
    ),
    loginApi,
    mdpApi,
    ca,
    cert,
    key,
    successUrl: String(process.env.SYCAPAY_SUCCESS_URL ?? '').trim(),
    failedUrl: String(process.env.SYCAPAY_FAILED_URL ?? '').trim(),
    webhookAuth,
    webhookSecret: String(process.env.SYCAPAY_WEBHOOK_SECRET ?? '').trim(),
  };
};

export const buildIdPartenaire = (checkoutId: string) => {
  const suffix = checkoutId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
  return `NYRA-${Date.now()}-${suffix}`;
};

export const normalizePhone = (value: unknown) => String(value ?? '').replace(/\D/g, '');

export const isSycapayPmService = (value: unknown): value is SycapayPmService =>
  SYCAPAY_PM_SERVICES.includes(String(value ?? '').trim().toUpperCase() as SycapayPmService);

const normalizeService = (value: string): SycapayPmService =>
  value.trim().toUpperCase() as SycapayPmService;

const httpsJson = async <T = Record<string, unknown>>(params: {
  config: SycapayConfig;
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}): Promise<{ status: number; payload: T; rawText: string }> => {
  const { config, method, path, body, headers = {} } = params;
  const url = new URL(path.startsWith('http') ? path : `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

  const payloadText = body ? JSON.stringify(body) : undefined;

  return new Promise((resolvePromise, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method,
        ca: config.ca,
        cert: config.cert,
        key: config.key,
        rejectUnauthorized: true,
        headers: {
          Accept: 'application/json',
          ...(payloadText
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadText),
              }
            : {}),
          ...headers,
        },
        timeout: 30_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const rawText = Buffer.concat(chunks).toString('utf8');
          let payload = {} as T;
          if (rawText) {
            try {
              payload = JSON.parse(rawText) as T;
            } catch {
              payload = {} as T;
            }
          }
          resolvePromise({ status: res.statusCode ?? 0, payload, rawText });
        });
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout Sycapay'));
    });

    if (payloadText) req.write(payloadText);
    req.end();
  });
};

export const initiateSycapayPayment = async (input: SycapayInitInput): Promise<SycapayInitResult> => {
  const config = getSycapayConfig();
  if (!config) {
    return {
      ok: false,
      reason: 'missing_config',
      message: 'Configuration Sycapay incomplète (login, mdp ou certificats).',
    };
  }

  const transaction: Record<string, unknown> = {
    montant: input.montant,
    codeService: normalizeService(input.codeService),
    numeroBeneficiaire: normalizePhone(input.numeroBeneficiaire),
    idPartenaire: input.idPartenaire,
  };

  if (config.successUrl) transaction.url_success = config.successUrl;
  if (config.failedUrl) transaction.url_failed = config.failedUrl;
  if (input.nomMarchand) transaction.nomMarchand = input.nomMarchand;

  try {
    const { status, payload } = await httpsJson<Record<string, unknown>>({
      config,
      method: 'POST',
      path: '/initiationTransactionV1',
      body: {
        loginApi: config.loginApi,
        mdpApi: config.mdpApi,
        transaction,
      },
    });

    const code = String(payload.code ?? payload.errorCode ?? status);
    const message = String(payload.message ?? payload.errorMessage ?? '').trim();
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const txResponse = (payload.transaction ?? data.transaction ?? {}) as Record<string, unknown>;

    const rawDeepLinks = (payload.deepLinks ?? data.deepLinks ?? txResponse.deepLinks ?? null) as
      | Record<string, unknown>
      | null;
    const deepLinks = rawDeepLinks
      ? Object.fromEntries(
          Object.entries(rawDeepLinks)
            .map(([key, value]) => [key, String(value ?? '').trim()])
            .filter(([, value]) => Boolean(value)),
        )
      : null;
    const omDeepLink =
      (deepLinks?.OM ? String(deepLinks.OM) : '') ||
      (deepLinks?.MAXIT ? String(deepLinks.MAXIT) : '') ||
      '';

    let redirectUrl =
      String(
        payload.urlRedirection ??
          payload.redirectUrl ??
          data.urlRedirection ??
          data.redirectUrl ??
          txResponse.urlRedirection ??
          txResponse.redirectUrl ??
          '',
      ).trim() || null;

    const tokenTX = String(
      txResponse.tokenTX ?? data.tokenTX ?? payload.tokenTX ?? '',
    ).trim();

    let deeplink =
      String(data.deeplink ?? payload.deeplink ?? txResponse.deeplink ?? '').trim() || null;
    const qrCode = String(data.qrCode ?? payload.qrCode ?? txResponse.qrCode ?? '').trim() || null;
    const otpRequired = Boolean(data.otpRequired ?? payload.otpRequired ?? txResponse.otpRequired);

    // Orange Money : Sycapay renvoie deepLinks.OM / MAXIT (pas deeplink / redirectUrl)
    if (omDeepLink) {
      if (!redirectUrl) redirectUrl = omDeepLink;
      if (!deeplink) deeplink = omDeepLink;
    }

    // 200 = créé ; 201 = paiement déjà en cours → rediriger vers urlRedirection / deepLinks (doc Sycapay)
    const numericCode = Number(code);
    const isAcceptedCode =
      !code ||
      code === '200' ||
      code === '201' ||
      numericCode === 200 ||
      numericCode === 201;
    const hasPaymentHandle = Boolean(redirectUrl || deeplink || tokenTX || otpRequired || qrCode);

    if (status >= 400 || (!isAcceptedCode && !hasPaymentHandle)) {
      return {
        ok: false,
        reason: status >= 500 ? 'http_error' : 'sycapay_rejected',
        status,
        code,
        message: message || `Sycapay a refusé la demande (HTTP ${status}).`,
      };
    }

    if (!tokenTX && !otpRequired && !redirectUrl && !deeplink && !qrCode) {
      return {
        ok: false,
        reason: 'invalid_response',
        status,
        message: 'Réponse Sycapay incomplète (tokenTX / urlRedirection / deepLinks manquant).',
      };
    }

    return {
      ok: true,
      tokenTX,
      redirectUrl,
      deeplink,
      deepLinks: deepLinks && Object.keys(deepLinks).length > 0 ? deepLinks : null,
      qrCode,
      otpRequired,
      raw: payload,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'http_error',
      message: error instanceof Error ? error.message : 'Erreur réseau vers Sycapay.',
    };
  }
};

export const confirmSycapayOtp = async (tokenTX: string, otp: string) => {
  const config = getSycapayConfig();
  if (!config) {
    return { ok: false as const, reason: 'missing_config' as const, message: 'Configuration Sycapay incomplète.' };
  }

  try {
    const { status, payload } = await httpsJson<Record<string, unknown>>({
      config,
      method: 'POST',
      path: '/confirmationTransactionV1',
      body: {
        loginApi: config.loginApi,
        tokenTX,
        otp: String(otp).trim(),
      },
    });

    const code = String(payload.code ?? status);
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const statut = String(data.statut ?? payload.statut ?? '').toUpperCase();

    if (status >= 400 || (code && code !== '200' && Number(code) !== 200)) {
      return {
        ok: false as const,
        reason: 'sycapay_rejected' as const,
        status,
        message: String(payload.message ?? 'Confirmation OTP refusée.'),
      };
    }

    return {
      ok: true as const,
      status: statut === 'SUCCESS' || statut === 'FINISHED' ? ('SUCCESS' as const) : ('PENDING' as const),
      raw: payload,
    };
  } catch (error) {
    return {
      ok: false as const,
      reason: 'http_error' as const,
      message: error instanceof Error ? error.message : 'Erreur réseau vers Sycapay.',
    };
  }
};

export const fetchSycapayPaymentStatus = async (idPartenaire: string) => {
  const config = getSycapayConfig();
  if (!config || !idPartenaire) return null;

  try {
    const { status, payload } = await httpsJson<Record<string, unknown>>({
      config,
      method: 'GET',
      path: `/status/${encodeURIComponent(idPartenaire)}`,
    });

    if (status === 404) return { missing: true };
    if (status === 304) return { unchanged: true };
    if (status >= 400) return null;
    return payload;
  } catch {
    return null;
  }
};

export const mapSycapayRemoteStatus = (remote: Record<string, unknown> | null) => {
  if (!remote || remote.missing || remote.unchanged) return 'PENDING';

  const tag = String(remote.tag ?? '').toUpperCase();
  const statut = String(remote.statut ?? remote.status ?? '').toUpperCase();

  if (tag === 'SUCCESS' || statut === 'SUCCESS') return 'SUCCESS';
  if (tag === 'FAILED' || statut === 'FAILED' || statut === 'ERROR') return 'FAILED';
  if (statut === 'CANCELED' || statut === 'CANCELLED' || tag === 'CANCELED') return 'CANCELED';
  if (statut === 'FINISHED' && tag === 'SUCCESS') return 'SUCCESS';
  if (statut === 'FINISHED' && tag === 'FAILED') return 'FAILED';

  return 'PENDING';
};

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

export type SycapayWebhookPayload = {
  idPartenaire?: string;
  idPartenaireService?: string;
  tag?: string;
  codeService?: string;
  reasonForFailure?: string;
};

export const verifySycapayWebhook = (params: {
  rawBody: Buffer | string;
  headers: Record<string, string | string[] | undefined>;
}): boolean => {
  const config = getSycapayConfig();
  if (!config) return false;

  const header = (name: string) => {
    const value = params.headers[name] ?? params.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  if (config.webhookAuth === 'NONE') return true;

  if (config.webhookAuth === 'BEARER') {
    const auth = String(header('authorization') ?? '');
    if (!config.webhookSecret) return false;
    return safeEqual(auth, `Bearer ${config.webhookSecret}`);
  }

  if (config.webhookAuth === 'BASIC') {
    const auth = String(header('authorization') ?? '');
    if (!config.webhookSecret) return false;
    const expected = `Basic ${Buffer.from(config.webhookSecret).toString('base64')}`;
    // secret format login:password stored as-is in env, or already "login:password"
    if (auth.startsWith('Basic ') && config.webhookSecret.includes(':')) {
      return safeEqual(auth, `Basic ${Buffer.from(config.webhookSecret).toString('base64')}`);
    }
    return safeEqual(auth, expected) || safeEqual(auth, `Basic ${config.webhookSecret}`);
  }

  // HMAC
  if (!config.webhookSecret) return false;
  const signatureHeader = String(header('x-sycapay-signature') ?? header('X-Sycapay-Signature') ?? '');
  if (!signatureHeader) return false;

  const body = Buffer.isBuffer(params.rawBody) ? params.rawBody : Buffer.from(params.rawBody);
  const [algoRaw, sent] = signatureHeader.includes('=')
    ? signatureHeader.split('=', 2)
    : ['sha256', signatureHeader];
  const algo = algoRaw.toLowerCase().includes('512') ? 'sha512' : 'sha256';
  const digest = createHmac(algo, config.webhookSecret).update(body).digest('hex');
  return safeEqual(digest, String(sent).trim());
};
