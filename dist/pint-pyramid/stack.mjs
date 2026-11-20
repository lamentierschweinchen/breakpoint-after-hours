import { hullPoints } from './physics.mjs';

export function worldHull(body) {
  const c = Math.cos(body.angle);
  const s = Math.sin(body.angle);
  return hullPoints(body).map(({ x, y }) => ({ x: body.x + x * c - y * s, y: body.y + x * s + y * c }));
}

export function topEdge(body) {
  return Math.min(...worldHull(body).map(({ y }) => y));
}

function contactEdge(body, width, y) {
  const xSpan = Math.cos(body.angle) * width / 2;
  const ySpan = Math.sin(body.angle) * width / 2;
  const x = body.x - Math.sin(body.angle) * y;
  const midY = body.y + Math.cos(body.angle) * y;
  return { left: x - xSpan, right: x + xSpan, y: midY - ySpan, slope: ySpan / xSpan };
}

function rimUnderFoot(foot, lower) {
  const rim = contactEdge(lower, lower.type.w, -lower.type.h / 2);
  const left = Math.max(foot.left, rim.left);
  const right = Math.min(foot.right, rim.right);
  if (right - left < 2) return false;
  const gaps = [left, right].map((x) => rim.y + (x - rim.left) * rim.slope - foot.y - (x - foot.left) * foot.slope);
  // Glass outlines nearly touch at this distance even when contact impulses alternate.
  return Math.min(...gaps) < 5 && Math.max(...gaps) > -.8;
}

export function observeContacts(world, contacts, step) {
  for (const body of world.bodies) {
    let recent = contacts.get(body);
    if (!recent) {
      recent = new Map();
      contacts.set(body, recent);
    }
    const supports = new Set(body.supports.filter((lower) => lower.y - body.y > (body.type.h + lower.type.h) * .21));
    if (body.onFloor) supports.add(null);
    if (supports.size === 1 && !body.onFloor && Math.abs(body.angle) < .3 && Math.abs(body.vy) < 24) {
      const [bearing] = supports;
      const foot = contactEdge(body, body.type.base, body.type.h / 2);
      for (const neighbor of world.bodies) {
        if ((bearing.x - body.x) * (neighbor.x - body.x) >= 0 || Math.abs(neighbor.angle) >= .33) continue;
        if (neighbor.y - body.y < (body.type.h + neighbor.type.h) * .32) continue;
        if (rimUnderFoot(foot, neighbor)) supports.add(neighbor);
      }
    }
    for (const [support, entry] of recent) {
      entry.age += step;
      if (entry.age > .19) recent.delete(support);
    }
    for (const support of supports) {
      const entry = recent.get(support);
      recent.set(support, { age: 0, duration: (entry?.duration ?? 0) + step });
    }
  }
}

export function rankStack(world, contacts, placed) {
  const ranks = new Map();
  const bodies = world.bodies.filter((body) => placed.has(body) && Math.abs(body.angle) < .60);
  for (const body of bodies.sort((a, b) => b.y - a.y)) {
    const supports = [...(contacts.get(body) ?? [])]
      .filter(([, contact]) => contact.duration >= .032)
      .map(([lower]) => lower)
      .filter((lower) => lower && ranks.has(lower));
    const floor = body.onFloor || contacts.get(body)?.has(null);
    const tier = supports.length ? Math.max(...supports.map((lower) => ranks.get(lower).tier)) + 1 : Number(floor);
    if (!tier) continue;
    const left = supports.find((lower) => lower.x < body.x - 3.5);
    const right = supports.find((lower) => lower.x > body.x + 3.5 &&
      left && Math.abs(ranks.get(lower).tier - ranks.get(left).tier) <= 1);
    ranks.set(body, { tier, rims: left && right ? [left, right] : [] });
  }
  return ranks;
}
