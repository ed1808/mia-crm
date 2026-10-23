// apps/api/src/middleware/security.ts
import type { Context, Next } from 'hono';

export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next();

  // 1. Strict-Transport-Security (HSTS)
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 2. Prevenir sniffing de MIME types
  c.header('X-Content-Type-Options', 'nosniff');

  // 3. Prevenir Clickjacking
  c.header('X-Frame-Options', 'DENY');

  // 4. Política de Referrer estricta
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 5. Restricción de permisos del navegador (Micrófono, cámara, geolocalización)
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // 6. Content Security Policy (CSP) segura
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none';",
  );
}

/**
 * Validador criptográfico de firma HMAC-SHA256 para webhooks de ERP (Decisión D-42: Endurecimiento de contrato)
 */
export function verifyWebhookHmac(
  rawBody: string,
  secretKey: string,
  signatureHeader?: string | null,
  timestampHeader?: string | null,
  maxClockSkewSeconds: number = 300,
): { valid: boolean; reason?: string } {
  if (!signatureHeader) {
    return { valid: false, reason: 'Firma HMAC (X-Signature-256) ausente' };
  }

  // 1. Verificación anti-replay por ventana de tiempo (5 minutos por defecto)
  if (timestampHeader) {
    const requestTime = Number.parseInt(timestampHeader, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (Number.isNaN(requestTime) || Math.abs(currentTime - requestTime) > maxClockSkewSeconds) {
      return {
        valid: false,
        reason: `Marca de tiempo fuera de la ventana tolerada (${maxClockSkewSeconds}s)`,
      };
    }
  }

  // 2. Calcular HMAC-SHA256 con la clave compartida
  const payloadToSign = timestampHeader ? `${timestampHeader}.${rawBody}` : rawBody;
  const hasher = new Bun.CryptoHasher('sha256', secretKey);
  hasher.update(payloadToSign);
  const expectedHash = hasher.digest('hex');

  // Normalizar encabezado si viene con prefijo sha256=
  const cleanSignature = signatureHeader.replace(/^sha256=/i, '').trim();

  // Comparación en tiempo constante para mitigar timing attacks
  if (cleanSignature.length !== expectedHash.length) {
    return { valid: false, reason: 'Longitud de firma inválida' };
  }

  let diff = 0;
  for (let i = 0; i < cleanSignature.length; i++) {
    diff |= cleanSignature.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }

  if (diff !== 0) {
    return { valid: false, reason: 'Firma criptográfica inválida' };
  }

  return { valid: true };
}

/**
 * Limitador de tasa (Rate Limiter) deslizante en memoria con fallback
 */
class RateLimiter {
  private ipRequests: Map<string, number[]> = new Map();

  public isRateLimited(key: string, maxRequests: number, windowSeconds: number): boolean {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    let timestamps = this.ipRequests.get(key) || [];
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= maxRequests) {
      return true;
    }

    timestamps.push(now);
    this.ipRequests.set(key, timestamps);
    return false;
  }
}

const rateLimiter = new RateLimiter();

export function rateLimitMiddleware(options: { maxRequests: number; windowSeconds: number }) {
  return async (c: Context, next: Next) => {
    const clientIp =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('cf-connecting-ip') ||
      '127.0.0.1';

    const key = `${c.req.path}:${clientIp}`;
    if (rateLimiter.isRateLimited(key, options.maxRequests, options.windowSeconds)) {
      c.header('Retry-After', String(options.windowSeconds));
      return c.json(
        {
          error: 'TOO_MANY_REQUESTS',
          message: 'Límite de peticiones excedido. Intente nuevamente en unos momentos.',
        },
        429,
      );
    }

    await next();
  };
}
