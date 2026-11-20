const TICK = 1 / 120;
const CONTACT_MARGIN = 0.35;
const POSITION_SLOP = 0.4;
const SOLVER_ITERATIONS = 20;
const FRICTION = 0.59;

export const PINT_TYPES = Object.freeze([
  Object.freeze({ id: "shaker", name: "Shaker", w: 74, base: 56, h: 58, capacity: 473, weight: 0.34, color: "#e89a36" }),
  Object.freeze({ id: "nonic", name: "Nonic", w: 58, base: 43, h: 62, capacity: 568, weight: 0.33, shoulder: 68, shoulderY: 0.21, color: "#ba6336" }),
  Object.freeze({ id: "tulip", name: "Tulip", w: 49, base: 34, h: 62, capacity: 473, weight: 0.25, shoulder: 57, shoulderY: 0.38, color: "#d9ab54" }),
  Object.freeze({ id: "stein", name: "Stein", w: 51, base: 62, h: 58, capacity: 568, weight: 0.48, color: "#dd8a4e" }),
  Object.freeze({ id: "stubby", name: "Stubby", w: 48, base: 45, h: 31, capacity: 210, weight: 0.19 }),
  Object.freeze({ id: "yard", name: "Yard", w: 33, base: 21, h: 112, capacity: 480, weight: 0.24 }),
  Object.freeze({ id: "bucket", name: "Bucket", w: 92, base: 29, h: 47, capacity: 650, weight: 0.38 }),
  Object.freeze({ id: "bell", name: "Bell", w: 32, base: 78, h: 45, capacity: 530, weight: 0.48 }),
  Object.freeze({ id: "balloon", name: "Balloon", w: 43, base: 26, h: 73, capacity: 500, weight: 0.23, shoulder: 77, shoulderY: 0.49 }),
  Object.freeze({ id: "tower", name: "Tower", w: 28, base: 40, h: 94, capacity: 425, weight: 0.28 }),
]);

const geometry = new WeakMap();
const liquidCache = new WeakMap();
const point = (x, y) => ({ x, y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function pintGeometry(type) {
  const known = geometry.get(type);
  if (known) return known;
  const top = -type.h / 2;
  const bottom = -top;
  const rim = type.w / 2;
  const base = type.base / 2;
  const right = [point(rim, top)];
  if (type.shoulder) right.push(point(type.shoulder / 2, top + type.h * type.shoulderY));
  right.push(point(base + 1.8, bottom - 2), point(base, bottom));
  const hull = [...right, ...right.slice().reverse().map(({ x, y }) => point(-x, y))];

  const lipY = top + 1;
  const innerFloor = bottom - 3.6;
  const insideRight = [point(rim - 2.7, lipY)];
  if (type.shoulder) insideRight.push(point(type.shoulder / 2 - 2.6, top + type.h * type.shoulderY));
  insideRight.push(point(base - 1.2, innerFloor));
  const interior = [...insideRight, ...insideRight.slice().reverse().map(({ x, y }) => point(-x, y))];
  const data = { hull, interior, interiorArea: polygonArea(interior), lipY };
  geometry.set(type, data);
  return data;
}

export function createPint(type, fill, x, y, options = {}) {
  if (typeof type === "string") type = PINT_TYPES.find((entry) => entry.id === type);
  if (!type) throw new RangeError("Unknown pint type");
  const initialFill = clamp(fill, 0, 1);
  const supports = [];
  const body = {
    id: 0,
    type,
    x,
    y,
    vx: options.vx ?? 0,
    vy: options.vy ?? 0,
    angle: options.angle ?? 0,
    omega: options.omega ?? 0,
    fill: initialFill,
    initialFill,
    spillMl: 0,
    lastSpill: 0,
    slosh: 0,
    sloshRate: 0,
    surge: 0,
    supported: false,
    touching: false,
    onFloor: false,
    hasLanded: false,
    lost: false,
    supports,
  };
  updateMass(body);
  return body;
}

function updateMass(body) {
  const { type, fill } = body;
  const mass = (type.weight ?? 0.32) + type.capacity * fill * 0.001;
  body.mass = mass;
  body.inverseMass = 1 / mass;
  body.inverseInertia = 12 / (mass * (type.w * type.w + type.h * type.h));
}

export function hullPoints(body) {
  return pintGeometry(body.type).hull;
}

function toWorld(body, local) {
  const cosine = Math.cos(body.angle);
  const sine = Math.sin(body.angle);
  return point(body.x + local.x * cosine - local.y * sine, body.y + local.x * sine + local.y * cosine);
}

function polygonArea(polygon) {
  let doubledArea = 0;
  for (let i = 0; i < polygon.length; i++) {
    doubledArea += cross(polygon[i], polygon[(i + 1) % polygon.length]);
  }
  return Math.abs(doubledArea) / 2;
}

// Keep the part of the interior below the given liquid surface.
function cutInterior(polygon, normal, height) {
  const clipped = [];
  for (let i = 0; i < polygon.length; i++) {
    const from = polygon[i];
    const to = polygon[(i + 1) % polygon.length];
    const fromDepth = dot(from, normal) - height;
    const toDepth = dot(to, normal) - height;
    if (fromDepth >= 0) clipped.push(from);
    if ((fromDepth < 0) !== (toDepth < 0)) {
      const fraction = fromDepth / (fromDepth - toDepth);
      clipped.push(point(from.x + (to.x - from.x) * fraction, from.y + (to.y - from.y) * fraction));
    }
  }
  return clipped;
}

function liquidNormal(body) {
  const tilt = body.slosh - body.angle;
  return point(-Math.sin(tilt), Math.cos(tilt));
}

function liquidShape(body) {
  const cached = liquidCache.get(body);
  if (cached?.fill === body.fill && cached.angle === body.angle && cached.slosh === body.slosh) return cached;
  const shape = { polygon: [], surface: [], fill: body.fill, angle: body.angle, slosh: body.slosh };
  liquidCache.set(body, shape);
  if (body.fill <= 0) return shape;

  const { interior, interiorArea } = pintGeometry(body.type);
  if (body.fill >= 1) {
    shape.polygon = interior;
    shape.surface = [interior[interior.length - 1], interior[0]];
    return shape;
  }
  const normal = liquidNormal(body);
  let low = Infinity;
  let high = -Infinity;
  for (const vertex of interior) {
    const depth = dot(vertex, normal);
    low = Math.min(low, depth);
    high = Math.max(high, depth);
  }
  const desiredArea = interiorArea * body.fill;
  let height;
  for (let i = 0; i < 12; i++) {
    height = (low + high) / 2;
    shape.polygon = cutInterior(interior, normal, height);
    if (polygonArea(shape.polygon) > desiredArea) low = height;
    else high = height;
  }
  shape.surface = shape.polygon.filter((vertex) => Math.abs(dot(vertex, normal) - height) < 1e-6);
  shape.surface.sort((a, b) => a.x - b.x);
  return shape;
}

export function liquidPolygon(body) {
  return liquidShape(body).polygon;
}

export function liquidSurface(body) {
  return liquidShape(body).surface;
}

function liquidStep(body, startVx, startVy, startOmega) {
  const horizontalImpact = body.vx - startVx;
  const upwardImpact = startVy - body.vy;
  body.sloshRate += clamp(horizontalImpact * 0.04 + (body.omega - startOmega) * 0.47, -7, 7);
  body.sloshRate += (-72 * body.slosh - 6.4 * body.sloshRate) * TICK;
  body.slosh = clamp(body.slosh + body.sloshRate * TICK, -0.8, 0.8);
  body.surge = Math.min(13, body.surge + Math.max(0, upwardImpact - 64) * 0.021) * 0.934;
  if (body.fill <= 0) return;

  const { interior, interiorArea, lipY } = pintGeometry(body.type);
  const normal = liquidNormal(body);
  const lipX = interior[0].x * (normal.x >= 0 ? 1 : -1);
  const lowestLip = point(lipX, lipY);
  const surface = dot(lowestLip, normal) + body.surge;
  const safeFill = polygonArea(cutInterior(interior, normal, surface)) / interiorArea;
  const excess = Math.max(0, body.fill - safeFill);
  const spill = excess * Math.min(1, TICK * (6.2 + 14 * excess));
  if (spill > 0) spillLiquid(body, spill, toWorld(body, lowestLip));
}

function spillLiquid(body, amount, at) {
  body.fill = Math.max(0, body.fill - amount);
  const ml = amount * body.type.capacity;
  body.spillMl += ml;
  body.lastSpill += ml;
  body.spillAt = at;
  updateMass(body);
}

function fixture(body, hull) {
  const vertices = hull.map((local) => toWorld(body, local));
  const faces = [];
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const from = vertices[i];
    const to = vertices[(i + 1) % vertices.length];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    faces.push({ from, to, normal: point(dy / length, -dx / length) });
    left = Math.min(left, from.x);
    right = Math.max(right, from.x);
    top = Math.min(top, from.y);
    bottom = Math.max(bottom, from.y);
  }
  return { body, vertices, faces, left, right, top, bottom };
}

function separated(a, b) {
  return a.right + CONTACT_MARGIN < b.left || b.right + CONTACT_MARGIN < a.left
    || a.bottom + CONTACT_MARGIN < b.top || b.bottom + CONTACT_MARGIN < a.top;
}

function shallowestFace(a, b) {
  let bestFace;
  let bestSeparation = -Infinity;
  for (const face of a.faces) {
    const plane = dot(face.normal, face.from);
    let separation = Infinity;
    for (const vertex of b.vertices) {
      separation = Math.min(separation, dot(face.normal, vertex) - plane);
    }
    if (separation > bestSeparation) {
      bestFace = face;
      bestSeparation = separation;
    }
  }
  return { face: bestFace, separation: bestSeparation };
}

function incidentFace(faces, normal) {
  let best = faces[0];
  for (const face of faces) {
    if (dot(face.normal, normal) < dot(best.normal, normal)) best = face;
  }
  return best;
}

// Clip a segment to either end of the face so a flat landing can share load
// across two points, even when the bottom covers only part of a rim.
function clipSegment(segment, axis, limit) {
  if (segment.length < 2) return segment.filter((vertex) => dot(vertex, axis) <= limit);
  const [a, b] = segment;
  const deltaA = dot(a, axis) - limit;
  const deltaB = dot(b, axis) - limit;
  const clipped = [];
  if (deltaA <= 0) clipped.push(a);
  if (deltaB <= 0) clipped.push(b);
  if ((deltaA < 0 && deltaB > 0) || (deltaA > 0 && deltaB < 0)) {
    const fraction = deltaA / (deltaA - deltaB);
    clipped.push(point(a.x + (b.x - a.x) * fraction, a.y + (b.y - a.y) * fraction));
  }
  return clipped;
}

function contactPoints(a, b) {
  const faceA = shallowestFace(a, b);
  if (faceA.separation > CONTACT_MARGIN) return null;
  const faceB = shallowestFace(b, a);
  if (faceB.separation > CONTACT_MARGIN) return null;

  const flipped = faceB.separation > faceA.separation + 0.12;
  const face = flipped ? faceB.face : faceA.face;
  const incident = incidentFace(flipped ? a.faces : b.faces, face.normal);
  const tangent = point(-face.normal.y, face.normal.x);
  const reverse = point(-tangent.x, -tangent.y);
  const firstCut = clipSegment([incident.from, incident.to], reverse, dot(face.from, reverse));
  const secondCut = clipSegment(firstCut, tangent, dot(face.to, tangent));
  const plane = dot(face.normal, face.from);
  const contacts = [];
  for (const vertex of secondCut) {
    const separation = dot(face.normal, vertex) - plane;
    if (separation > CONTACT_MARGIN) continue;
    contacts.push({
      at: point(vertex.x - face.normal.x * separation / 2, vertex.y - face.normal.y * separation / 2),
      separation,
    });
  }
  if (!contacts.length) return null;
  const normal = flipped ? point(-face.normal.x, -face.normal.y) : face.normal;
  return { normal, tangent: point(-normal.y, normal.x), contacts };
}

function relativeSpeed(contact, axis) {
  const { a, b, offsetA, offsetB } = contact;
  return (b.vx - a.vx) * axis.x + (b.vy - a.vy) * axis.y
    + b.omega * cross(offsetB, axis) - a.omega * cross(offsetA, axis);
}

function effectiveMass(contact, axis) {
  const { a, b, offsetA, offsetB } = contact;
  return 1 / (a.inverseMass + b.inverseMass + a.inverseInertia * cross(offsetA, axis) ** 2
    + b.inverseInertia * cross(offsetB, axis) ** 2);
}

function impulse(contact, axis, magnitude) {
  const { a, b, offsetA, offsetB } = contact;
  a.vx -= axis.x * magnitude * a.inverseMass;
  a.vy -= axis.y * magnitude * a.inverseMass;
  a.omega -= cross(offsetA, axis) * magnitude * a.inverseInertia;
  b.vx += axis.x * magnitude * b.inverseMass;
  b.vy += axis.y * magnitude * b.inverseMass;
  b.omega += cross(offsetB, axis) * magnitude * b.inverseInertia;
}

function prepareContact(entry, a, b, manifold) {
  const contact = {
    ...entry,
    a,
    b,
    normal: manifold.normal,
    tangent: manifold.tangent,
    offsetA: point(entry.at.x - a.x, entry.at.y - a.y),
    offsetB: point(entry.at.x - b.x, entry.at.y - b.y),
    normalImpulse: 0,
    tangentImpulse: 0,
  };
  contact.normalMass = effectiveMass(contact, contact.normal);
  contact.tangentMass = effectiveMass(contact, contact.tangent);
  contact.impact = Math.max(0, -relativeSpeed(contact, contact.normal));
  const penetration = -contact.separation - POSITION_SLOP;
  const separationSpeed = Math.min(45, Math.max(0, penetration) * 0.17 / TICK);
  const restitutionSpeed = Math.max(0, contact.impact - 115) * 0.055;
  contact.targetSpeed = Math.max(separationSpeed, restitutionSpeed);
  return contact;
}

function warmStart(contact, previousContacts) {
  if (contact.impact > 60 || !previousContacts) return;
  let match;
  let shortestDistance = 8 ** 2;
  for (const previous of previousContacts) {
    if (previous.matched || dot(previous.normal, contact.normal) < 0.97) continue;
    const distance = (contact.at.x - previous.at.x) ** 2 + (contact.at.y - previous.at.y) ** 2;
    if (distance >= shortestDistance) continue;
    shortestDistance = distance;
    match = previous;
  }
  if (!match) return;
  match.matched = true;
  contact.normalImpulse = match.normalImpulse;
  contact.tangentImpulse = match.tangentImpulse;
  impulse(contact, contact.normal, contact.normalImpulse);
  impulse(contact, contact.tangent, contact.tangentImpulse);
}

function solveContact(contact) {
  const normalSpeed = relativeSpeed(contact, contact.normal);
  const initialNormal = contact.normalImpulse;
  const newNormal = (contact.targetSpeed - normalSpeed) * contact.normalMass;
  contact.normalImpulse = Math.max(0, initialNormal + newNormal);
  impulse(contact, contact.normal, contact.normalImpulse - initialNormal);

  const frictionLimit = FRICTION * contact.normalImpulse;
  const initialTangent = contact.tangentImpulse;
  const newTangent = -relativeSpeed(contact, contact.tangent) * contact.tangentMass;
  contact.tangentImpulse = clamp(initialTangent + newTangent, -frictionLimit, frictionLimit);
  impulse(contact, contact.tangent, contact.tangentImpulse - initialTangent);
}

function collectContacts(fixtures, previousContacts) {
  const nextContacts = new Map();
  const contacts = [];
  for (let i = 0; i < fixtures.length; i++) {
    const a = fixtures[i];
    for (let j = i + 1; j < fixtures.length; j++) {
      const b = fixtures[j];
      if (separated(a, b)) continue;
      const manifold = contactPoints(a, b);
      if (!manifold) continue;
      const key = b.body.id * (b.body.id - 1) / 2 + a.body.id;
      const old = previousContacts.get(key);
      const current = manifold.contacts.map((entry) => prepareContact(entry, a.body, b.body, manifold));
      for (const contact of current) warmStart(contact, old);
      contacts.push(...current);
      nextContacts.set(key, current);
    }
  }
  return { contacts, nextContacts };
}

export function createWorld({ floor = 488, width = 420, left = 0, right = width, gravity = 620 } = {}) {
  const bodies = [];
  const events = [];
  const counter = {
    id: 0, x: 0, y: 0, angle: 0, vx: 0, vy: 0, omega: 0, inverseMass: 0, inverseInertia: 0,
  };
  const counterBottom = floor + 35;
  const counterFixture = fixture(counter, [
    point(left, floor), point(right, floor), point(right, counterBottom), point(left, counterBottom),
  ]);
  let remainder = 0;
  let previousContacts = new Map();
  let nextId = 1;
  const world = { bodies, events, floor, width, left, right, gravity, spillMl: 0, add, drain, step };
  return world;

  function add(body) {
    body.id = nextId++;
    bodies.push(body);
    return body;
  }

  function remove(body, index) {
    if (body.fill > 0) spillLiquid(body, body.fill, point(body.x, body.y));
    body.lost = true;
    bodies.splice(index, 1);
  }

  function accountSpill(body) {
    if (body.lastSpill <= 0) return null;
    const { x, y } = body.spillAt;
    world.spillMl += body.lastSpill;
    return { type: "spill", body, ml: body.lastSpill, x, y };
  }

  function drain(body) {
    const index = bodies.indexOf(body);
    if (index < 0) return null;
    body.lastSpill = 0;
    remove(body, index);
    return accountSpill(body);
  }

  function step(dt) {
    events.length = 0;
    remainder += clamp(dt, 0, 0.1);
    const touched = bodies.slice();
    for (const body of touched) body.lastSpill = 0;
    while (remainder >= TICK - 1e-8) {
      substep();
      remainder -= TICK;
    }
    for (const body of touched) {
      const spill = accountSpill(body);
      if (spill) events.push(spill);
    }
    return events;
  }

  function substep() {
    const fixtures = [counterFixture];
    for (const body of bodies) {
      body.vx *= 0.999;
      body.vy += world.gravity * TICK;
      body.omega *= 0.997;
      const entry = fixture(body, hullPoints(body));
      entry.startVx = body.vx;
      entry.startVy = body.vy;
      entry.startOmega = body.omega;
      body.supported = false;
      body.touching = false;
      body.onFloor = false;
      body.supports.length = 0;
      fixtures.push(entry);
    }

    const { contacts, nextContacts } = collectContacts(fixtures, previousContacts);
    previousContacts = nextContacts;
    for (let i = 0; i < SOLVER_ITERATIONS; i++) {
      for (const contact of contacts) solveContact(contact);
    }
    for (const contact of contacts) {
      if (contact.normalImpulse <= 0) continue;
      const { a, b, normal } = contact;
      if (a !== counter) a.touching = true;
      if (b !== counter) b.touching = true;
      if (normal.y > 0.24 && a !== counter) markSupport(a, b, contact);
      if (normal.y < -0.24 && b !== counter) markSupport(b, a, contact);
    }

    for (let i = fixtures.length - 1; i >= 1; i--) {
      const { body, top, startVx, startVy, startOmega } = fixtures[i];
      body.x += body.vx * TICK;
      body.y += body.vy * TICK;
      body.angle += body.omega * TICK;
      liquidStep(body, startVx, startVy, startOmega);
      if (top <= floor + 20 && body.y <= floor + 100) continue;
      remove(body, i - 1);
      events.push({ type: "lost", body });
    }
  }

  function markSupport(body, support, contact) {
    body.supported = true;
    if (support === counter) body.onFloor = true;
    else if (!body.supports.includes(support)) body.supports.push(support);
    if (body.hasLanded) return;
    body.hasLanded = true;
    events.push({
      type: "land", body, support: support === counter ? null : support,
      impact: contact.impact, x: contact.at.x, y: contact.at.y,
    });
  }
}
