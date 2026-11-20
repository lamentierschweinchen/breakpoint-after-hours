export const STEP_SECONDS = 1 / 120;
export const TRACK_EDGE = 2.65;
export const COURSE_LENGTH = 98;
export const FULL_FILL_HEIGHT = 0.89;
export const GLASS_ASPECT = 0.38;

const GRAVITY = 9.81;
const METRES_PER_UNIT = 0.54;
const WAVE_FREQUENCY = 12;
const WAVE_DAMPING = 13;
const START_SPEED = 4.1;
const END_SPEED = 5.05;
const TRAY_RADIUS = 0.31;
const MAX_LATERAL_SPEED = 4.3;
const MAX_LATERAL_ACCEL = 12.5;

const GUEST = "guest";
const STOOL = "stool";
const LAPTOP = "laptop";

// Crossing guests are centered on their listed positions as a clean run approaches.
// Pairs leave an escape lane, and only the last section demands quick changes of lane.
const COURSE = [
  [12.2, -0.15, GUEST, 0.35, 1.4],
  [19.2, 1.65, STOOL],
  [21.2, -1.54, STOOL],
  [27.8, 0.57, GUEST, 0.45, 1.6],
  [29.0, -1.98, GUEST, -0.30, 1.3],
  [35.4, -0.15, STOOL],
  [36.1, 1.52, GUEST, -0.43, 1.4],
  [43.3, -1.48, GUEST, -0.48, 1.5],
  [43.6, 0.13, GUEST, 0.39, 1.5],
  [49.6, 1.72, STOOL],
  [51.0, 0.08, GUEST, 0.51, 1.65],
  [57.6, -0.35, GUEST, -0.76, 1.55],
  [64.0, 0.0, LAPTOP],
  [64.3, -2.58, STOOL],
  [64.8, 2.6, STOOL],
  [71.3, 1.78, GUEST, 0.42, 1.75],
  [72.3, -0.64, STOOL],
  [79.3, -1.96, GUEST, 0.34, 1.45],
  [79.8, -0.05, GUEST, -0.47, 1.7],
  [87.1, 0.32, GUEST, 0.5, 1.7],
  [87.3, 1.92, GUEST, -0.42, 1.7],
  [93.0, -1.02, GUEST, -0.53, 1.75],
  [93.5, 2.02, STOOL],
];

const RADII = { [GUEST]: 0.61, [STOOL]: 0.48, [LAPTOP]: 0.75 };
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const slopeLength = (run) => Math.hypot(run.sloshX, run.sloshZ);

function cleanArrival(s) {
  const gradient = (END_SPEED - START_SPEED) / COURSE_LENGTH;
  return Math.log1p(s * gradient / START_SPEED) / gradient;
}

function makeCourse(seed) {
  const mirrored = seed % 2 === 1 ? -1 : 1;
  return COURSE.map(([s, x, kind, sweep = 0, frequency = 0], id) => ({
    id,
    kind,
    s,
    x: x * mirrored,
    radius: RADII[kind],
    sweep: sweep * mirrored,
    frequency,
    phase: -cleanArrival(s) * frequency + (seed === 0 ? 0 : 0.35 * Math.sin(seed * 13 + id)),
    hit: false,
  }));
}

export function hazardX(hazard, elapsed) {
  return hazard.x + hazard.sweep * Math.sin(elapsed * hazard.frequency + hazard.phase);
}

export function createRun(seed = 0) {
  return {
    time: 0,
    s: 0,
    x: 0,
    vx: 0,
    speed: START_SPEED,
    fill: 1,
    sloshX: 0,
    sloshZ: 0,
    waveVX: 0,
    waveVZ: 0,
    lean: 0,
    bumps: 0,
    laptop: false,
    done: null,
    hazards: makeCourse(seed),
    events: [],
  };
}

function spill(run, amount, dx, dz, kind) {
  const actual = Math.min(run.fill, amount);
  if (actual <= 0) return;
  run.fill -= actual;
  run.events.push({ type: "spill", amount: actual, x: run.x, s: run.s, dx, dz, kind });
}

function bump(run, hazard, offset) {
  const direction = Math.sign(offset) || Math.sign(run.vx) || (hazard.id % 2 === 0 ? -1 : 1);
  const force = clamp(1 - Math.abs(offset) / (hazard.radius + TRAY_RADIUS), 0, 1);
  const speedLoss = 0.58 + force * 1.38;
  hazard.hit = true;
  run.bumps += 1;
  run.vx = clamp(run.vx * 0.45 + direction * (1.08 + force * 1.16), -MAX_LATERAL_SPEED, MAX_LATERAL_SPEED);
  run.speed = Math.max(1.25, run.speed - speedLoss);

  // A hard contact can eject drops before the slower wave gets to the rim.
  const event = { type: "bump", kind: hazard.kind, x: run.x, s: run.s, dx: -direction, dz: -0.65, id: hazard.id, force };
  run.events.push(event);
  if (hazard.kind === LAPTOP) {
    run.laptop = true;
    run.events.push({ ...event, type: "laptop" });
  }
  spill(run, (0.025 + force * 0.107) * Math.sqrt(run.fill), event.dx, event.dz, hazard.kind);
}

function checkHazards(run) {
  for (const hazard of run.hazards) {
    if (hazard.s - run.s > 1.25) break;
    if (hazard.hit || run.s - hazard.s > 1.25) continue;
    const offsetX = run.x - hazardX(hazard, run.time);
    const distance = Math.hypot(
      offsetX / (hazard.radius + TRAY_RADIUS),
      (run.s - hazard.s) / (0.9 * hazard.radius + 0.32),
    );
    if (distance < 1) bump(run, hazard, offsetX);
  }
}

function advanceWave(run, accelerationX, accelerationZ, dt) {
  // In the tray frame the steady surface slopes away from its acceleration.
  // The first slosh mode follows that equilibrium like a damped spring.
  const force = WAVE_FREQUENCY ** 2;
  const equilibriumX = -accelerationX * METRES_PER_UNIT / GRAVITY - Math.tan(run.lean);
  const equilibriumZ = -accelerationZ * METRES_PER_UNIT / GRAVITY;
  run.waveVX += (force * (equilibriumX - run.sloshX) - WAVE_DAMPING * run.waveVX) * dt;
  run.waveVZ += (force * (equilibriumZ - run.sloshZ) - WAVE_DAMPING * run.waveVZ) * dt;
  run.sloshX += run.waveVX * dt;
  run.sloshZ += run.waveVZ * dt;
  const slope = slopeLength(run);
  const rimHeight = FULL_FILL_HEIGHT * run.fill + GLASS_ASPECT * slope;
  const overflow = Math.max(0, rimHeight - 1);
  if (overflow > 0) {
    // Overflow rate grows with the head over the rim. Falling fill raises the
    // threshold for the next spill, so the same turn gets safer over time.
    spill(run, 4.9 * overflow ** 1.5 * dt, run.sloshX / slope, run.sloshZ / slope);
  }
}

function advance(run, dt, target) {
  run.time += dt;
  const prevVX = run.vx;
  const prevSpeed = run.speed;
  const desiredVX = clamp((target - run.x) * 5.6, -MAX_LATERAL_SPEED, MAX_LATERAL_SPEED);
  const acceleration = clamp((desiredVX - run.vx) * 10, -MAX_LATERAL_ACCEL, MAX_LATERAL_ACCEL);
  run.vx += acceleration * dt;
  run.x += run.vx * dt;
  if (Math.abs(run.x) > TRACK_EDGE) {
    run.x = clamp(run.x, -TRACK_EDGE, TRACK_EDGE);
    run.vx = 0;
  }

  const desiredSpeed = START_SPEED + (END_SPEED - START_SPEED) * (run.s / COURSE_LENGTH);
  run.speed += (desiredSpeed - run.speed) * 2.9 * dt;
  run.s = Math.min(COURSE_LENGTH, run.s + run.speed * dt);
  checkHazards(run);
  const leanTarget = -0.035 * run.vx;
  run.lean += (leanTarget - run.lean) * Math.min(1, dt * 12);
  advanceWave(run, (run.vx - prevVX) / dt, (prevSpeed - run.speed) / dt, dt);

  if (run.fill < 0.013) {
    spill(run, run.fill, Math.sign(run.sloshX), Math.sign(run.sloshZ));
    run.done = "empty";
  } else if (run.s >= COURSE_LENGTH) {
    run.done = "delivered";
  }
}

export function stepRun(run, elapsed, steer) {
  run.events.length = 0;
  const target = Number.isFinite(steer) ? clamp(steer, -TRACK_EDGE, TRACK_EDGE) : run.x;
  let remaining = Math.max(0, Math.min(elapsed, 0.1));
  while (!run.done && remaining > 0.000001) {
    const dt = Math.min(remaining, STEP_SECONDS);
    advance(run, dt, target);
    remaining -= dt;
  }
  return run;
}
