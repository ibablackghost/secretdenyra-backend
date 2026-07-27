import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';

const WEBHOOK_PATHS = new Set(['/api/webhooks/sycapay', '/webhooks/sycapay']);

const isSycapayWebhook = (ctx: any) =>
  ctx.method === 'POST' && WEBHOOK_PATHS.has(String(ctx.path ?? ''));

const replayRequest = (req: IncomingMessage, body: Buffer): IncomingMessage => {
  const stream = Readable.from([body]) as IncomingMessage;
  stream.headers = req.headers;
  stream.method = req.method;
  stream.url = req.url;
  stream.httpVersion = req.httpVersion;
  stream.socket = req.socket;
  return stream;
};

/**
 * Capture le body brut AVANT strapi::body (requis pour HMAC Sycapay).
 * Doit être enregistré dans config/middlewares.ts juste avant strapi::body.
 */
export default () => {
  return async (ctx: any, next: () => Promise<void>) => {
    if (!isSycapayWebhook(ctx)) {
      await next();
      return;
    }

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      ctx.req.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      ctx.req.on('end', () => resolve());
      ctx.req.on('error', reject);
    });

    const rawBody = Buffer.concat(chunks);
    ctx.state.sycapayRawBody = rawBody;
    ctx.request.rawBody = rawBody;
    ctx.req = replayRequest(ctx.req, rawBody);

    await next();
  };
};
