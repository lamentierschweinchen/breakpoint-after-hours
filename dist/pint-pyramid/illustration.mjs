import { hullPoints, liquidPolygon, liquidSurface } from './physics.mjs';

const INK = '#2b1736';
const PAPER = '#ffebbf';
const MINT = '#d6f4a8';
const beers = {
  shaker: { body: '#eb9e3d', shade: '#bc532d', sparkle: '#ffdc6b', foam: '#fff0b4', glass: '#5d4246', line: '#ffd795' },
  nonic: { body: '#6c4239', shade: '#472435', sparkle: '#d38a53', foam: '#f1cb93', glass: '#655051', line: '#eed6bc' },
  tulip: { body: '#d45b92', shade: '#963365', sparkle: '#ffacad', foam: '#ffd3c9', glass: '#65375f', line: '#f5badd' },
  stein: { body: '#d6ba57', shade: '#9e833c', sparkle: '#fcf192', foam: '#fff5cc', glass: '#485b49', line: '#e2edb1' },
  stubby: { body: '#edac61', shade: '#ab6339', sparkle: '#ffd181', foam: '#ffecc1', glass: '#67443e', line: '#ffcd93' },
  yard: { body: '#b78bcc', shade: '#785ba7', sparkle: '#efc6fc', foam: '#ffe2f6', glass: '#574771', line: '#dfbef2' },
  bucket: { body: '#eb7856', shade: '#ac3f49', sparkle: '#ffb17b', foam: '#ffe1b0', glass: '#71474c', line: '#ffcba5' },
  bell: { body: '#90b36a', shade: '#557c56', sparkle: '#d4e999', foam: '#f5f1bf', glass: '#3e5959', line: '#d3e4ac' },
  balloon: { body: '#d55783', shade: '#8b3b66', sparkle: '#ffa3b1', foam: '#ffd3e5', glass: '#584075', line: '#f9bbd4' },
  tower: { body: '#d9ae56', shade: '#99633d', sparkle: '#ffe192', foam: '#fff0c5', glass: '#555161', line: '#f9d59c' },
};

function outline(ctx, points) {
  ctx.beginPath();
  for (const [index, { x, y }] of points.entries()) {
    if (index) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function stroke(ctx, points, color, width = 1) {
  ctx.beginPath();
  for (const [index, [x, y]] of points.entries()) {
    if (index) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function beerColor(body) {
  return (beers[body.type.id] || beers.shaker).sparkle;
}

export function drawPint(ctx, body, time, active = false) {
  const { w, base, h, id } = body.type;
  const palette = beers[id] || beers.shaker;
  const top = -h / 2;
  const bottom = h / 2;
  const hull = hullPoints(body);
  const breadth = Math.max(...hull.map(({ x }) => x)) * 2;
  const liquid = liquidPolygon(body);
  ctx.save();
  ctx.translate(body.x, body.y);
  ctx.rotate(body.angle);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.save();
  ctx.translate(2.8, 3);
  outline(ctx, hull);
  ctx.fillStyle = '#170d24';
  ctx.fill();
  ctx.restore();
  outline(ctx, hull);
  ctx.fillStyle = palette.glass;
  ctx.fill();

  ctx.save();
  outline(ctx, hull);
  ctx.clip();
  if (liquid.length > 2) {
    ctx.save();
    outline(ctx, liquid);
    ctx.fillStyle = palette.body;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = palette.shade;
    ctx.fillRect(breadth * .28, top, breadth * .23, h);
    ctx.fillRect(-breadth / 2, bottom - 7, breadth, 7);
    ctx.globalAlpha = .39;
    for (let dot = 0; dot < 44; dot += 1) {
      const x = ((dot * 47) % 97 / 97 - .5) * breadth;
      const y = ((dot * 29) % 89 / 89 - .5) * h;
      ellipse(ctx, x, y, dot % 4 ? .65 : 1.2, .64, dot % 3 ? palette.shade : PAPER);
    }
    ctx.globalAlpha = .78;
    for (let bubble = 0; bubble < 9; bubble += 1) {
      const x = ((bubble * 13) % 31 / 31 - .5) * breadth * .75;
      const y = bottom - ((bubble * 7 + time * (4 + bubble % 3)) % h);
      const radius = bubble % 3 ? .8 : 1.5;
      ellipse(ctx, x, y, radius, radius, palette.sparkle);
    }
    ctx.restore();
    const surface = liquidSurface(body);
    if (surface?.length >= 2) {
      const [a, b] = [...surface].sort((first, second) => first.x - second.x);
      const span = b.x - a.x;
      if (span > 3) {
        const foamDepth = id === 'nonic' ? 3.6 : 2;
        stroke(ctx, [[a.x, a.y + foamDepth], [b.x, b.y + foamDepth]], palette.foam, foamDepth * 2);
        for (let index = 1; index <= 6; index += 1) {
          const ratio = index / 7;
          ellipse(ctx, a.x + span * ratio, a.y + (b.y - a.y) * ratio + foamDepth, 1 + index % 3, 1.9 + index % 2, palette.foam);
        }
      }
    }
  }
  drawGlassMarks(ctx, id, hull, w, base, top, bottom, palette.line);
  ctx.restore();

  outline(ctx, hull);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.5;
  ctx.stroke();
  ctx.strokeStyle = active ? MINT : palette.line;
  ctx.lineWidth = active ? 1.85 : 1.25;
  ctx.stroke();
  stroke(ctx, [[-w * .47, top + 1], [w * .47, top + 1]], palette.line, 2.5);
  stroke(ctx, [[-base * .42, bottom - 3], [base * .40, bottom - 3]], palette.line, 1.2);
  ctx.restore();
}

function drawGlassMarks(ctx, id, hull, rim, base, top, bottom, color) {
  ctx.globalAlpha = .64;
  stroke(ctx, [[-rim * .28, top + 9], [-base * .28, bottom - 11]], color, 1.7);
  stroke(ctx, [[-rim * .2, top + 10], [-rim * .17, top + 20]], color);
  ctx.globalAlpha = .32;
  stroke(ctx, [[rim * .35, top + 8], [base * .36, bottom - 7]], INK, 2);
  if (id === 'nonic' || id === 'tulip' || id === 'balloon') {
    const shoulder = hull.reduce((widest, vertex) => vertex.x > widest.x ? vertex : widest);
    const { x, y } = shoulder;
    stroke(ctx, [[-x + 5, y - 2], [-x * .37, y + 1], [x * .28, y + 1], [x - 5, y - 2]], color, 2);
  }
  if (id === 'stein' || id === 'bell') {
    const y = bottom - 9;
    stroke(ctx, [[-base * .41, y], [base * .4, y]], color, 2.7);
    for (const position of [-.16, 0, .16]) {
      const x = base * position;
      stroke(ctx, [[x, y - 13], [x, y - 3]], color, 1.5);
    }
  }
}

export function drawCounter(ctx, floor, left, right, puddle) {
  ctx.save();
  ctx.lineJoin = 'round';
  outline(ctx, [{ x: 0, y: floor + 28 }, { x: left - 13, y: floor + 2 }, { x: left, y: floor }, { x: right, y: floor }, { x: right + 13, y: floor + 2 }, { x: 420, y: floor + 28 }, { x: 420, y: floor + 64 }, { x: 0, y: floor + 64 }]);
  ctx.fillStyle = '#b07949';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.clip();
  for (let index = 0; index < 28; index += 1) {
    const x = (index * 59) % 429;
    const y = floor + 4 + (index * 19) % 28;
    stroke(ctx, [[x, y], [x + 23 + index % 9, y - .8], [x + 40 + index % 11, y]], index % 2 ? '#75424a' : '#e8ad61', index % 4 ? .8 : 1.5);
  }
  ctx.fillStyle = '#50364c';
  ctx.fillRect(0, floor + 33, 420, 40);
  stroke(ctx, [[0, floor + 32], [420, floor + 32]], '#f2be70', 3);
  stroke(ctx, [[0, floor + 36], [420, floor + 36]], INK, 2);
  for (let x = -23; x < 420; x += 34) {
    stroke(ctx, [[x, floor + 51], [x + 17, floor + 43], [x + 34, floor + 51], [x + 17, floor + 60], [x, floor + 51]], '#95677a', 1);
  }
  if (puddle > 0) {
    const size = Math.min(134, 11 + Math.sqrt(puddle) * 4.2);
    ellipse(ctx, 232, floor + 11, size, 4.5, '#f3a050b3');
    ellipse(ctx, 217, floor + 10, size * .72, 2.1, '#f6bf6bb0');
  }
  ctx.restore();
}

export function drawGrip(ctx, glass, reduced) {
  const halfWidth = Math.max(...hullPoints(glass).map(({ x }) => x));
  const top = -glass.type.h * .24;
  const flare = reduced ? 0 : Math.min(3, Math.abs(glass.slosh) * 10);
  ctx.save();
  ctx.translate(glass.x, glass.y);
  ctx.rotate(glass.angle);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    const inner = side * (halfWidth + 5 + flare);
    const outer = inner + side * 6;
    const bracket = [[inner, top - 5], [outer, top], [outer, top + 12], [inner, top + 17]];
    stroke(ctx, bracket, INK, 4.4);
    stroke(ctx, bracket, MINT, 1.8);
  }
  ctx.restore();
}

export function drawContact(ctx, { x, y, age, strength }) {
  const life = age / .32;
  if (life >= 1) return;
  const reach = 2 + strength * 5 + life * 9;
  const length = (5 + strength * 7) * (1 - life * .55);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= (1 - life) * (.52 + strength * .48);
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const rake = [[side * reach, -2 - life * 3], [side * (reach + length), -6 - life * 6]];
    stroke(ctx, rake, INK, 3.6);
    stroke(ctx, rake, PAPER, 1.8);
    if (strength > .33) {
      stroke(ctx, [[side * (reach + 4), 1], [side * (reach + length + 4), 1.4]], MINT, 1.3);
    }
  }
  ctx.restore();
}

export function drawRag(ctx, age, floor, reducedMotion) {
  const phase = reducedMotion ? 1 : Math.min(1, age * .94);
  const x = 443 - 117 * Math.sin(phase * Math.PI / 2);
  const y = Math.min(floor, 488) + 5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-.20 + Math.sin(phase * 13) * .09);
  ctx.lineJoin = 'round';
  outline(ctx, [{ x: -40, y: 1 }, { x: -30, y: -28 }, { x: -8, y: -29 }, { x: 6, y: -47 }, { x: 29, y: -40 }, { x: 51, y: -17 }, { x: 44, y: 3 }, { x: 21, y: -4 }, { x: 5, y: 3 }, { x: -17, y: -3 }]);
  ctx.fillStyle = '#d7eda6';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  stroke(ctx, [[-29, -23], [-12, -18], [1, -24], [10, -38]], '#7d8168', 2);
  stroke(ctx, [[23, -34], [23, -24], [43, -13]], '#7d8168', 2);
  ellipse(ctx, 0, -12, 2.7, 3.2, INK);
  ellipse(ctx, 15, -14, 2.7, 3.2, INK);
  stroke(ctx, [[4, -4], [8, -7], [12, -5]], INK, 1.4);
  stroke(ctx, [[-5, -19], [3, -17]], INK, 1.4);
  stroke(ctx, [[11, -18], [18, -21]], INK, 1.4);
  for (let index = 0; index < 7; index += 1) {
    ellipse(ctx, -24 + index * 9.5, -1 + index % 2 * 1.7, 1.9, .6, '#71645d');
  }
  ctx.restore();
  if (phase > .38) {
    ctx.save();
    ctx.translate(x - 72, y - 41);
    ctx.rotate(-.13);
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-34, -19, 69, 25, 6);
    ctx.stroke();
    ctx.fill();
    ctx.font = '900 12px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.fillText('MY SHIFT.', 0, -2);
    ctx.restore();
  }
}
