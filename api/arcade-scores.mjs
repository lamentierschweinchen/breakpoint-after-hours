import { createHmac } from 'node:crypto';
import pg from 'pg';
import {
  authenticate, badgeKeyResolver, BADGE_RULESETS, COHORTS, GAMES, MAX_BODY,
  readBody, readName, readScore, ScoreError, valid,
} from '../lib/badge-score-protocol.mjs';

const badgeUrl = 'https://breakpoint.beer/badge/runs';
const webOrigin = 'https://breakpoint.beer';
const webRulesets = { 'break-pint': 'pint-v1', 'meet-mario': 'rooms-v1', 'pint-pyramid': 'stack-v1' };
const browserId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function rulesetFor(game, cohort) {
  valid(GAMES.includes(game) && COHORTS.includes(cohort), 400, 'invalid game or device');
  return cohort === 'badge' ? BADGE_RULESETS[game] : webRulesets[game];
}

function browserDevice(headers) {
  const ua = headers['user-agent'] ?? '';
  return headers['sec-ch-ua-mobile'] === '?1' || /Android|Mobile|iPad|iPhone|iPod/i.test(ua)
    ? 'mobile' : 'desktop';
}

async function bytes(request) {
  if (Number(request.headers['content-length']) > MAX_BODY) throw new ScoreError(413, 'payload too large');
  let size = 0;
  const chunks = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    valid(size <= MAX_BODY, 413, 'payload too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function scoreHandler(pool, secret, getBadgeKey = badgeKeyResolver()) {
  if (!/^[0-9a-f]{64}$/i.test(secret ?? '')) throw new Error('Arcade score secret is missing');
  const hmac = (...parts) => createHmac('sha256', Buffer.from(secret, 'hex')).update(JSON.stringify(parts)).digest('hex');
  return async (request, response) => {
    const respond = (status, result) => {
      response.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
      response.end(JSON.stringify(result));
    };
    try {
      if (request.method === 'GET') {
        const params = new URL(request.url, webOrigin).searchParams;
        const game = params.get('game');
        const cohort = params.get('cohort') ?? 'badge';
        const limit = Number(params.get('limit') ?? '5');
        const ruleset = rulesetFor(game, cohort);
        valid(Number.isInteger(limit) && limit >= 1 && limit <= 10, 400, 'invalid limit');
        const { rows } = await pool.query(`
          SELECT name, board, score FROM score_records JOIN score_players ON score_players.id=player
          WHERE game=$1 AND cohort=$2 AND ruleset=$3
          ORDER BY board DESC, CASE WHEN game='meet-mario' THEN score ELSE -score END,
            updated, player LIMIT $4
        `, [game, cohort, ruleset, limit]);
        return respond(200, { game, cohort, ruleset, rows });
      }
      if (request.method !== 'POST') return respond(405, { error: 'method not allowed' });

      const body = await bytes(request);
      const message = readBody(body);
      const badge = request.headers['x-badge-app'] !== undefined;
      const now = Date.now();
      const device = badge ? await authenticate({ headers: request.headers, body, url: badgeUrl, now, getBadgeKey }) : null;
      if (!badge) {
        valid(request.headers.origin === webOrigin || request.headers['sec-fetch-site'] === 'same-origin'
          && request.headers.origin === `https://${request.headers.host}`, 403, 'invalid origin');
        valid(typeof message.player === 'string' && browserId.test(message.player), 400, 'invalid player');
      }
      const game = badge ? device.game : message.game;
      const cohort = badge ? 'badge' : browserDevice(request.headers);
      const ruleset = rulesetFor(game, cohort);
      const realm = badge ? 'badge' : 'web';
      const player = hmac('player', realm, badge ? device.user : message.player);
      const profile = badge && message.op === 'profile' && Object.keys(message).length === 1;
      let name, claim;
      if (!profile) {
        valid(message.op === 'share' && Object.keys(message).length === (badge ? 6 : 8), 400, 'invalid score submission');
        valid(message.ruleset === ruleset, 409, 'ruleset is not active');
        name = readName(message.name);
        claim = readScore(game, { runId: message.runId, board: message.board, score: message.score });
        valid(game !== 'break-pint' || (badge ? claim.score >= 69 : claim.board === 1), 422, 'round must be cleared');
      }
      const client = await pool.connect();
      let result;
      try {
        await client.query('BEGIN');
        if (badge) {
          await client.query('DELETE FROM score_requests WHERE expires < $1', [now]);
          const { rowCount } = await client.query(
            'INSERT INTO score_requests (id,expires) VALUES ($1,$2) ON CONFLICT DO NOTHING', [device.nonce, device.expires]);
          valid(rowCount === 1, 409, 'replayed badge request');
        }
        if (!profile) await client.query(
          'INSERT INTO score_players (id,realm,name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [player, realm, name]);
        const { rows } = await client.query('SELECT name FROM score_players WHERE id=$1', [player]);
        const saved = rows[0]?.name ?? null;
        result = { name: saved, cohort };
        if (!profile) {
          valid(saved, 409, 'username is taken');
          const id = hmac('score', player, game, cohort, ruleset, claim.runId, claim.board, claim.score);
          await client.query(`
            INSERT INTO score_records (player,game,cohort,ruleset,board,score,receipt)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (player,game,cohort,ruleset) DO UPDATE
              SET board=excluded.board, score=excluded.score, receipt=excluded.receipt, updated=now()
            WHERE excluded.board > score_records.board OR (
              excluded.board = score_records.board AND CASE WHEN excluded.game='meet-mario'
                THEN excluded.score < score_records.score ELSE excluded.score > score_records.score END)
          `, [player, game, cohort, ruleset, claim.board, claim.score, id]);
          result.id = id;
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      return respond(200, result);
    } catch (error) {
      if (error instanceof ScoreError) return respond(error.status, { error: error.message });
      console.error('Arcade score relay error', error.code ?? error.name);
      return respond(503, { error: 'leaderboard temporarily unavailable' });
    }
  };
}

let handler;
export default function scores(request, response) {
  if (!handler) {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('sslmode', 'verify-full');
    const pool = new pg.Pool({ connectionString: url.href, connectionTimeoutMillis: 4000, idleTimeoutMillis: 5000, max: 4 });
    pool.on('error', error => console.error('Arcade database connection error', error.code ?? error.name));
    handler = scoreHandler(pool, process.env.BP26_SCORES_SECRET);
  }
  return handler(request, response);
}
