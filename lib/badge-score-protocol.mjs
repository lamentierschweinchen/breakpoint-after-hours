import { createHash, createPublicKey, verify } from 'node:crypto';

const BADGE_KEYS = 'https://badge-api.solana.com/api/http/key';
const BADGE_SPKI = Buffer.from('302a300506032b6570032100', 'hex');
const MARIO_PAR = [18, 29, 40, 47, 52, 58, 63, 68, 73, 78];
const MARIO_LIMIT = [28, 37, 44, 50, 55, 61, 65, 70, 75, 80];
export const MAX_BODY = 2048;
export const GAMES = ['break-pint', 'meet-mario', 'pint-pyramid'];
export const COHORTS = ['badge', 'mobile', 'desktop'];
export const BADGE_RULESETS = { 'break-pint': 'steer69-v1', 'meet-mario': 'rooms-v1', 'pint-pyramid': 'stack-v1' };

export class ScoreError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function valid(condition, status, message) {
  if (!condition) throw new ScoreError(status, message);
}

export function readBody(body) {
  let value;
  try { value = JSON.parse(body.toString('utf8')); }
  catch { throw new ScoreError(400, 'invalid JSON'); }
  valid(value !== null && typeof value === 'object' && !Array.isArray(value), 400, 'invalid request');
  return value;
}

export function readScore(game, claim) {
  const { runId, board, score } = claim ?? {};
  valid(claim && Object.keys(claim).length === 3
      && typeof runId === 'string' && /^[a-z0-9_-]{1,48}$/.test(runId)
      && Number.isSafeInteger(board) && Number.isSafeInteger(score),
  400, 'only runId, board, and score are accepted');

  validateScore(game, board, score);
  return { runId, board, score };
}

export function readName(value) {
  const name = typeof value === 'string' && value.trim();
  valid(name && /^[a-z0-9][a-z0-9 _-]{0,15}$/i.test(name)
    && !['guest', 'prior best'].includes(name.toLowerCase()), 400, 'choose a public username');
  return name;
}

function validateScore(game, board, score) {
  const ranged = game === 'pint-pyramid' ? board === 0 && score >= 0 && score <= 2 ** 31 - 1
    : game === 'break-pint' ? board >= 1 && board <= 5 && score >= 0 && score <= 100
      : game === 'meet-mario' && board >= 1 && board <= 10
        && score >= MARIO_PAR[board - 1] && score <= MARIO_LIMIT[board - 1];
  valid(Number.isSafeInteger(board) && Number.isSafeInteger(score) && ranged, 400, 'invalid game, board, or score');
}

export function parseBadgeKey({ alg, id, key }) {
  const bytes = Buffer.from(key ?? '', 'base64');
  valid(alg === 'Ed25519' && /^[0-9a-f]{16}$/.test(id)
    && bytes.length === 32 && bytes.toString('base64') === key, 502, 'invalid badge signing key');
  return createPublicKey({ key: Buffer.concat([BADGE_SPKI, bytes]), format: 'der', type: 'spki' });
}

export function badgeKeyResolver(request = fetch) {
  let known, pending;
  let refreshed = -Infinity;
  return async id => {
    if (known?.id === id && Date.now() - known.fetched < 600_000) return known.key;
    if (!pending && Date.now() - refreshed >= 15_000) {
      refreshed = Date.now();
      pending = (async () => {
        const response = await request(BADGE_KEYS, { signal: AbortSignal.timeout(5_000) });
        valid(response.ok, 502, 'badge signing key unavailable');
        const record = await response.json();
        known = { id: record.id, key: parseBadgeKey(record), fetched: Date.now() };
      })().finally(() => { pending = null; });
    }
    await pending;
    return known?.id === id && Date.now() - known.fetched < 600_000 ? known.key : null;
  };
}

// getBadgeKey returns a trusted key for id, fetched from badge-api.solana.com.
// The URL must be the exact configured public path used by the badge.
export async function authenticate({ headers, body, url, now, getBadgeKey }) {
  const { 'x-badge-app': game, 'x-badge-id': badge, 'x-badge-user': user,
    'x-badge-time': time, 'x-badge-request': nonce, 'x-badge-key': keyId,
    'x-badge-signature': signature } = headers;
  valid(Buffer.isBuffer(body) && body.length <= MAX_BODY, 413, 'payload too large');
  valid([game, badge, user, time, nonce, keyId, signature].every(value => typeof value === 'string')
    && /^[a-z0-9-]{1,32}$/.test(game) && /^[a-zA-Z0-9_-]{1,32}$/.test(badge)
    && /^[a-zA-Z0-9_-]{1,64}$/.test(user) && /^[0-9]{13}$/.test(time)
    && /^[a-f0-9]{16}$/.test(nonce) && /^[a-f0-9]{16}$/.test(keyId)
    && Math.abs(now - Number(time)) <= 60_000, 401, 'invalid or stale badge headers');
  const sig = Buffer.from(signature, 'base64');
  const message = Buffer.from(['badge-http-v1', 'POST', url,
    createHash('sha256').update(body).digest('hex'), game, badge, user, time, nonce].join('\n'));
  const key = await getBadgeKey(keyId);
  valid(key && sig.length === 64 && sig.toString('base64') === signature
    && verify(null, message, key, sig), 401, 'invalid badge signature');
  return { game, badge, user, nonce: keyId + ':' + nonce, expires: Number(time) + 60_000 };
}
