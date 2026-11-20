import { readFileSync } from 'node:fs';

const origin = 'https://breakpoint-after-hours.vercel.app';
const homepage = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const scorePattern = /^(?:100|(?:0|[1-9][0-9]?)(?:\.[0-9])?)$/;

export default function challengePage(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    response.statusCode = 405;
    response.end();
    return;
  }

  const score = request.query?.beat;
  let html = homepage;
  if (typeof score === 'string' && scorePattern.test(score)) {
    const title = `Benchmark to beat: ${score} / 100`;
    const canonical = `${origin}/?beat=${score}`;
    html = homepage
      .replace('property="og:title" content="Breakpoint After Hours"', `property="og:title" content="${title}"`)
      .replace('name="twitter:title" content="Breakpoint After Hours"', `name="twitter:title" content="${title}"`)
      .replace(`property="og:url" content="${origin}/"`, `property="og:url" content="${canonical}"`);
  }

  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600');
  response.end(request.method === 'HEAD' ? undefined : html);
}
