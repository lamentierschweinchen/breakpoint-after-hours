import { createSocialShare } from '../social.mjs';
import { createPint, createWorld } from './physics.mjs';
import { fallSpeed, newScore, OPENING_SPEED, PINT_ML, pourAt, recordLanding, SPILL_LIMIT } from './arcade.mjs';
import { beerColor, drawContact, drawCounter, drawGrip, drawPint, drawRag } from './illustration.mjs';
import { observeContacts, rankStack, topEdge } from './stack.mjs';

const WIDTH = 420;
const HEIGHT = 540;
const FLOOR = 488;
const LEFT = 48;
const RIGHT = 372;
const STEP = 1 / 120;
const HUD_HEIGHT = 130;
const SPILL_EPSILON = 1e-8;
const RECORD_KEY = 'breakpoint:pint-pyramid:spill-budget-best';
const get = (id) => document.getElementById(id);
const canvas = get('board');
const ctx = canvas.getContext('2d');
const order = get('order');
const challenge = get('challenge');
const status = get('status');
const receipt = get('receipt');
const startPanel = get('start-panel');
const controls = get('game-controls');
const steerPad = get('steer-pad');
const dropButton = get('drop');
const spillMeter = get('spill-meter');
const restartButton = get('restart');
const soundButton = get('sound');
const number = new Intl.NumberFormat('en-US');
const pintNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const moveKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']);
let state;
let audio;
let sound = false;
let best = readBest();
let lastFrame = 0;
let accumulator = 0;
let scale = 1;

function readBest() {
  try {
    const raw = localStorage.getItem(RECORD_KEY);
    return raw !== null && Number.isFinite(+raw) ? +raw : null;
  } catch { return null; }
}

function reset(play = false, pointer = false) {
  cancelGrip();
  state = {
    phase: 'ready', time: 0, zoom: 1, world: createWorld({ width: WIDTH, floor: FLOOR, left: LEFT, right: RIGHT, gravity: 650 }),
    run: newScore(), active: null, poured: 0, spawnAt: 0, targetX: WIDTH / 2, fast: false,
    touchUsed: false, grip: null, pull: 0, keys: new Set(),
    pending: new Map(), placed: new Set(), contacts: new WeakMap(), sideways: new Map(),
    particles: [], toasts: [], impacts: [], swept: [], spillBatch: 0, spillTick: 0, spillX: 0, spillY: 0,
    shownScore: null, shownSpill: null, lastCallSpill: null, collapseAt: 0, cleanAt: -Infinity, statusUntil: 0,
  };
  const first = pourAt(0);
  state.displayPint = createPint(first.type, first.fill, WIDTH / 2, FLOOR - 161);
  receipt.hidden = true;
  order.hidden = false;
  challenge.hidden = false;
  status.hidden = true;
  controls.hidden = true;
  startPanel.hidden = false;
  restartButton.disabled = true;
  get('share-on-x').removeAttribute('href');
  get('share-feedback').textContent = '';
  get('best').textContent = best === null ? '—' : number.format(best);
  showPour(0);
  showProgress();
  showScore();
  lastFrame = 0;
  accumulator = 0;
  if (play) start(pointer);
}

function focusBoard(pointer = false) {
  canvas.toggleAttribute('data-pointer-focus', pointer);
  canvas.focus({ preventScroll: true });
}

function start(pointer = false) {
  if (state.phase !== 'ready') return;
  state.phase = 'playing';
  startPanel.hidden = true;
  controls.hidden = false;
  restartButton.disabled = false;
  focusBoard(pointer);
  spawnPint();
  const touchControls = getComputedStyle(controls).display !== 'none';
  notice(touchControls ? 'Drag the pad to steer. Drop speeds the fall.' : 'Drag to steer. Tap to drop.', 4);
}

function notice(message, seconds, levelUp = false) {
  status.textContent = message;
  status.hidden = false;
  status.toggleAttribute('data-level-up', levelUp);
  state.statusUntil = state.time + seconds;
}

function showPour(index) {
  const current = pourAt(index);
  const next = pourAt(index + 1);
  get('current-glass').textContent = current.type.name;
  get('current-fill').textContent = ` · ${Math.round(current.fill * 100)}%`;
  get('next-glass').textContent = next.type.name;
  get('next-fill').textContent = ` · ${Math.round(next.fill * 100)}%`;
  const preview = get('next-pint');
  const painter = preview.getContext('2d');
  const fit = Math.min(34 / (Math.max(next.type.w, next.type.base, next.type.shoulder ?? 0) + 12), 27 / (next.type.h + 11));
  painter.resetTransform();
  painter.clearRect(0, 0, 34, 27);
  painter.translate(17, 13);
  painter.scale(fit, fit);
  drawPint(painter, createPint(next.type, next.fill, 0, 0), 0);
}

function showProgress() {
  const { level, landed } = state.run;
  get('goal').textContent = `Level ${level}`;
  get('progress').textContent = `${landed} / ${level + 2} landed`;
}

function showScore() {
  const totalSpill = state.lastCallSpill ?? state.world.spillMl;
  const spill = Math.floor(totalSpill + SPILL_EPSILON);
  const points = state.run.points;
  if (points !== state.shownScore) get('score').textContent = number.format(points);
  if (spill !== state.shownSpill) {
    const remaining = Math.max(0, SPILL_LIMIT - spill);
    const ratio = remaining / SPILL_LIMIT;
    const pints = remaining === 0 ? 3 : Math.min(2.99, Math.round(totalSpill * 100 / PINT_ML) / 100);
    get('spilled').textContent = pintNumber.format(pints);
    spillMeter.style.setProperty('--pint-remaining', `${ratio * 100}%`);
    spillMeter.toggleAttribute('data-low', remaining <= PINT_ML);
    spillMeter.setAttribute('aria-valuenow', remaining);
    spillMeter.setAttribute('aria-valuetext', `${number.format(remaining)} mL of spill allowance remaining`);
  }
  if (state.active) {
    const fill = ` · ${Math.round(state.active.fill * 100)}%`;
    const currentFill = get('current-fill');
    if (currentFill.textContent !== fill) currentFill.textContent = fill;
  }
  state.shownScore = points;
  state.shownSpill = spill;
}

function feedSpeed() {
  return fallSpeed(state.run.total);
}

function spawnPint() {
  const index = state.poured;
  const { type, fill } = pourAt(index);
  const roof = state.world.bodies.reduce((top, body) => Math.min(top, topEdge(body)), FLOOR);
  const entry = Math.min(FLOOR - 205, roof - type.h / 2 - 133);
  const offset = index < 7 ? 0 : [0, -34, 27, -22, 37][index % 5];
  const body = createPint(type, fill, WIDTH / 2 + offset, entry, { vy: feedSpeed() });
  state.active = state.world.add(body);
  state.pending.set(body, { elapsed: 0, supported: 0, spillAtEntry: state.world.spillMl });
  state.targetX = body.x;
  state.poured += 1;
  state.fast = false;
  state.pull = 0;
  dropButton.disabled = false;
  showPour(index);
}

function steer() {
  const body = state.active;
  if (!body) return;
  const direction = Number(keyHeld('ArrowRight', 'KeyD')) - Number(keyHeld('ArrowLeft', 'KeyA'));
  state.targetX = clamp(state.targetX + direction * 300 * STEP, LEFT + 13, RIGHT - 13);
  const velocity = clamp((state.targetX - body.x) * 14, -490, 490);
  const acceleration = body.vx * velocity < 0 ? 4500 : 2500;
  const deltaVx = clamp(velocity - body.vx, -acceleration * STEP, acceleration * STEP);
  body.vx += deltaVx;
  const shake = Math.min(.016, .008 + state.run.total * .0009);
  body.sloshRate = clamp(body.sloshRate + deltaVx * shake, -6, 6);
  if (state.fast) return;
  state.pull *= .968;
  const down = keyHeld('ArrowDown', 'KeyS') ? 112 : 0;
  const up = keyHeld('ArrowUp', 'KeyW') ? 49 : 0;
  const speed = clamp(feedSpeed() + state.pull + down - up, 38, 325);
  body.vy = Math.min(speed - state.world.gravity * STEP, body.vy);
}

function keyHeld(arrow, letter) {
  return state.keys.has(arrow) || state.keys.has(letter);
}

function hardDrop() {
  if (state.phase !== 'playing' || !state.active || state.fast) return;
  state.fast = true;
  state.active.vy = Math.max(state.active.vy, 155 + (feedSpeed() - OPENING_SPEED) * .55);
  dropButton.disabled = true;
  noteCue('drop');
}

function land(event) {
  const strength = clamp(event.impact / 410, .2, 1);
  state.impacts.push({ x: event.x, y: event.y, age: 0, strength });
  noteCue('land', .42 + strength * .58);
  if (state.touchUsed && !motion.matches) navigator.vibrate?.(strength > .66 ? 22 : 8);
}

function releaseControl(body) {
  if (body !== state.active) return;
  state.active = null;
  state.spawnAt = state.time + .18;
  dropButton.disabled = true;
}

function clearGlass(body) {
  releaseControl(body);
  state.pending.delete(body);
  state.placed.delete(body);
  state.sideways.delete(body);
  state.run.chain = 0;
  state.cleanAt = state.time;
}

function tally(body, entry) {
  state.pending.delete(body);
  state.placed.add(body);
  const rank = rankStack(state.world, state.contacts, state.placed).get(body);
  const bridge = Boolean(rank?.rims.length);
  const clean = state.world.spillMl - entry.spillAtEntry < .5;
  const { points, multiplier, leveledUp } = recordLanding(state.run, { tier: rank?.tier ?? 1, bridge, clean });
  let label = clean ? 'CLEAN' : 'LANDED';
  if (bridge) {
    label = multiplier > 1 ? `BRIDGE ×${multiplier}` : 'BRIDGE';
    for (const rim of rank.rims) state.impacts.push({ x: rim.x, y: topEdge(rim), age: 0, strength: .42 });
    noteCue('bridge');
    if (state.touchUsed && !motion.matches) navigator.vibrate?.([12, 30, 12]);
  }
  state.toasts.push({ x: clamp(body.x, 69, WIDTH - 69), y: topEdge(body) - 10, text: `${label} +${points}`, age: 0, color: clean || bridge ? '#ddf8af' : '#fff1ce' });
  if (leveledUp) {
    notice(`Pints? Level ${state.run.level}`, 1.8, true);
    noteCue('level');
  }
  showProgress();
}

function spill(event) {
  const { body, x, y, ml } = event;
  state.spillBatch += ml;
  state.spillX = x;
  state.spillY = y;
  if (motion.matches || ml <= .15) return;
  const color = beerColor(body);
  const side = x >= body.x ? 1 : -1;
  const burst = Math.min(13, Math.ceil(ml * .39));
  for (let index = 0; index < burst && state.particles.length < 180; index += 1) {
    const scatter = index * 47 % 19 - 9;
    state.particles.push({ x, y, vx: body.vx * .32 + side * (41 + scatter * 7), vy: -72 + scatter * 10,
      age: 0, life: .32 + (index * 11 % 9) * .036, color });
  }
}

function showSpillToast() {
  const x = clamp(state.spillX, 71, WIDTH - 71);
  let toast = state.toasts.find((entry) => entry.volume && entry.age < .76 && Math.abs(entry.x - x) < 65);
  if (!toast) {
    toast = { x, y: state.spillY - 9, age: 0, color: '#ffc496', volume: 0 };
    state.toasts.push(toast);
  }
  toast.volume += state.spillBatch;
  toast.age = Math.min(toast.age, .34);
  toast.text = `${Math.round(toast.volume)} mL spilled`;
  if (state.spillBatch > 8) noteCue('spill');
  state.spillBatch = 0;
  state.spillTick = state.time + .28;
}

function lastOrders() {
  if (state.phase !== 'playing') return;
  state.phase = 'falling';
  state.collapseAt = state.time;
  state.lastCallSpill = state.world.spillMl;
  cancelGrip();
  state.active = null;
  state.keys.clear();
  controls.hidden = true;
  order.hidden = true;
  notice('The bar rag is clocking in…', 2);
  noteCue('collapse');
}

function resultStats() {
  const { total, bestTier, bestChain } = state.run;
  const stats = [`${total} ${total === 1 ? 'pint' : 'pints'}`, `${bestTier} ${bestTier === 1 ? 'tier' : 'tiers'}`, `${number.format(state.shownSpill)} mL spilled`];
  if (bestChain > 1) stats.push(`${bestChain} clean bridges in a row`);
  return stats.join(' · ');
}

function resultShare() {
  const message = `Pint Pyramid. ${number.format(state.shownScore)} points at Level ${state.run.level}. ${resultStats()}.`;
  return createSocialShare(message, 'https://breakpoint.beer/pint-pyramid/');
}

function finish() {
  state.phase = 'over';
  status.hidden = true;
  challenge.hidden = true;
  showScore();
  const record = state.shownScore > (best ?? 0);
  if (record) {
    best = state.shownScore;
    get('best').textContent = number.format(best);
    try { localStorage.setItem(RECORD_KEY, String(best)); } catch { /* Storage can be disabled. */ }
  }
  get('result-caption').textContent = `Level ${state.run.level} · Last call`;
  get('result-title').textContent = 'Last orders!';
  get('result-reason').textContent = 'Three pints spilled.';
  get('result-score').textContent = `${number.format(state.shownScore)} points${record ? ' · New best' : ''}`;
  get('result-detail').textContent = resultStats();
  get('share-on-x').href = resultShare().xUrl;
  receipt.hidden = false;
  get('result-title').focus({ preventScroll: true });
}

function simulate() {
  state.time += STEP;
  const { world } = state;
  if (state.phase === 'playing' || state.phase === 'falling') {
    if (state.phase === 'playing') steer();
    world.step(STEP);
    for (const event of world.events) {
      if (event.type === 'spill' && state.phase === 'playing') spill(event);
      if (event.type === 'land' && state.phase === 'playing') land(event);
      if (event.type === 'lost') clearGlass(event.body);
    }
    if (state.phase === 'playing') {
      // Let collision response take over on side contacts as well as landings.
      if (state.active?.touching) releaseControl(state.active);
      for (const body of [...world.bodies]) {
        if (Math.abs(body.angle) < 1.27) {
          state.sideways.delete(body);
          continue;
        }
        const duration = (state.sideways.get(body) ?? 0) + STEP;
        if (duration < .38 || (!body.touching && body.y < FLOOR - 24)) {
          state.sideways.set(body, duration);
          continue;
        }
        const drained = world.drain(body);
        if (drained) spill(drained);
        clearGlass(body);
        if (!motion.matches) state.swept.push({ body, at: state.time });
      }
      if (world.spillMl + SPILL_EPSILON >= SPILL_LIMIT) lastOrders();
      else {
        observeContacts(world, state.contacts, STEP);
        for (const [body, entry] of state.pending) {
          if (!body.hasLanded) continue;
          entry.elapsed += STEP;
          const settled = Math.abs(body.vy) < 28 && Math.abs(body.vx) < 38 && Math.abs(body.omega) < 1.0;
          if (body.supported && Math.abs(body.angle) < .58 && (settled || entry.elapsed > 1.7)) entry.supported += STEP;
          else entry.supported = 0;
          if (entry.supported > .22) tally(body, entry);
        }
        if (!state.active && state.time >= state.spawnAt) spawnPint();
      }
    }
    if (state.spillBatch >= 1 && state.time >= state.spillTick) showSpillToast();
    showScore();
    if (state.phase === 'falling' && state.time - state.collapseAt > 1.5) finish();
  }
  if (!status.hidden && state.time > state.statusUntil) status.hidden = true;
  for (const p of state.particles) {
    p.x += p.vx * STEP;
    p.y += p.vy * STEP;
    p.vy += 345 * STEP;
    p.age += STEP;
  }
  for (const toast of state.toasts) toast.age += STEP;
  for (const impact of state.impacts) impact.age += STEP;
  state.particles = state.particles.filter((p) => p.age < p.life);
  state.toasts = state.toasts.filter((p) => p.age < .97);
  state.impacts = state.impacts.filter((p) => p.age < .32);
  state.swept = state.swept.filter(({ at }) => state.time - at < .32);
}

function draw() {
  const { world, time } = state;
  const top = world.bodies.reduce((roof, body) => Math.min(roof, topEdge(body)), FLOOR);
  const reserve = receipt.hidden ? HUD_HEIGHT : (receipt.offsetTop + receipt.offsetHeight + 18) / canvas.clientHeight * HEIGHT;
  const needed = Math.min(1, Math.max(42, HEIGHT - reserve) / (HEIGHT - top + 6));
  if (needed < state.zoom || motion.matches) state.zoom = needed;
  else if (!state.grip) state.zoom += (needed - state.zoom) * .055;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT);
  ctx.scale(state.zoom, state.zoom);
  ctx.translate(-WIDTH / 2, -HEIGHT);
  drawCounter(ctx, FLOOR, LEFT, RIGHT, world.spillMl);
  for (const body of world.bodies) {
    if (body === state.active && state.grip) drawGrip(ctx, body, motion.matches);
    drawPint(ctx, body, time, body === state.active);
  }
  for (const { body, at } of state.swept) {
    const age = time - at;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - age / .32);
    ctx.translate(0, age * 95);
    drawPint(ctx, body, time);
    ctx.restore();
  }
  if (state.phase === 'ready') drawPint(ctx, state.displayPint, time, true);
  for (const impact of state.impacts) drawContact(ctx, impact);
  for (const p of state.particles) {
    ctx.globalAlpha = 1 - p.age / p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 2, 3.8, -.23, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const toast of state.toasts) {
    ctx.globalAlpha = Math.min(1, (.97 - toast.age) * 4.4);
    ctx.textAlign = 'center';
    ctx.font = '900 15px "DM Sans", sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#321b3d';
    ctx.fillStyle = toast.color;
    const y = toast.y - (motion.matches ? 0 : toast.age * 31);
    ctx.strokeText(toast.text, toast.x, y);
    ctx.fillText(toast.text, toast.x, y);
  }
  ctx.globalAlpha = 1;
  if (state.phase === 'falling' || state.phase === 'over') drawRag(ctx, time - state.collapseAt, FLOOR, motion.matches);
  else if (time - state.cleanAt < 1.5) drawRag(ctx, time - state.cleanAt, FLOOR, motion.matches);
  ctx.restore();
}

function frame(now) {
  if (lastFrame && !document.hidden) accumulator += Math.min(.08, (now - lastFrame) / 1000);
  lastFrame = now;
  while (accumulator >= STEP) {
    simulate();
    accumulator -= STEP;
  }
  draw();
  requestAnimationFrame(frame);
}

function beginGrip(event) {
  if (event.button !== 0 || !event.isPrimary || state.grip || state.phase !== 'playing') return;
  const surface = event.currentTarget;
  const pad = surface === steerPad;
  const box = canvas.getBoundingClientRect();
  state.grip = { id: event.pointerId, surface, pad, x: event.clientX, y: event.clientY, travel: 0, time: event.timeStamp,
    dx: WIDTH / box.width / state.zoom * (pad ? 1.25 : 1), dy: HEIGHT / box.height / state.zoom };
  state.touchUsed ||= event.pointerType === 'touch';
  surface.setPointerCapture(event.pointerId);
  if (pad) steerPad.setAttribute('data-gripped', '');
  focusBoard(true);
}

function moveGrip(event) {
  const grip = state.grip;
  if (grip?.id !== event.pointerId || grip.surface !== event.currentTarget) return;
  const dx = (event.clientX - grip.x) * grip.dx;
  const dy = (event.clientY - grip.y) * grip.dy;
  state.targetX = clamp(state.targetX + dx, LEFT + 13, RIGHT - 13);
  if (!grip.pad) state.pull = clamp(state.pull * .4 + dy * 14, -78, 220);
  grip.travel += Math.abs(dx) + Math.abs(dy);
  grip.x = event.clientX;
  grip.y = event.clientY;
}

function endGrip(event) {
  const grip = state.grip;
  if (grip?.id !== event.pointerId || grip.surface !== event.currentTarget) return;
  if (event.type === 'pointerup' && !grip.pad && grip.travel < 9 && event.timeStamp - grip.time < 370) hardDrop();
  cancelGrip();
}

function cancelGrip() {
  if (state) state.grip = null;
  steerPad.removeAttribute('data-gripped');
}

for (const surface of [canvas, steerPad]) {
  surface.addEventListener('pointerdown', beginGrip);
  surface.addEventListener('pointermove', moveGrip);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(event, endGrip);
}
window.addEventListener('blur', () => { state.keys.clear(); cancelGrip(); });
window.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'Tab' || moveKeys.has(event.code) || event.code === 'Space') canvas.removeAttribute('data-pointer-focus');
  if (event.key.toLowerCase() === 'r' && !event.repeat) {
    event.preventDefault();
    reset(state.phase !== 'ready');
    return;
  }
  if ((event.code === 'Space' || event.key === 'Enter') && !event.target.closest?.('button, a, summary')) {
    if (state.phase === 'over' || state.phase === 'falling') return;
    event.preventDefault();
    if (!event.repeat) state.phase === 'ready' ? start() : hardDrop();
  }
  if (state.phase !== 'playing') return;
  if (moveKeys.has(event.code)) {
    event.preventDefault();
    const nudge = { ArrowLeft: -13, KeyA: -13, ArrowRight: 13, KeyD: 13 }[event.code] ?? 0;
    if (!event.repeat) state.targetX = clamp(state.targetX + nudge, LEFT + 13, RIGHT - 13);
    state.keys.add(event.code);
  }
});
window.addEventListener('keyup', (event) => state.keys.delete(event.code));

function resize() {
  scale = Math.min(2.5, canvas.clientWidth * (devicePixelRatio || 1) / WIDTH);
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
}
new ResizeObserver(resize).observe(canvas);

const sounds = {
  drop: [[343, 210, .13, .031, 'sine']],
  land: [[141, 69, .115, .068, 'triangle'], [740, 466, .065, .025, 'sine']],
  bridge: [[440, 531, .10, .04, 'sine'], [660, 785, .16, .04, 'sine']],
  level: [[392, 392, .19, .042, 'triangle'], [523, 523, .19, .036, 'sine'], [659, 784, .29, .044, 'sine']],
  spill: [[245, 70, .18, .035, 'triangle']],
  collapse: [[184, 44, .42, .06, 'triangle'], [107, 56, .31, .061, 'sine']],
};
function noteCue(cue, strength = 1) {
  if (!audio || !sound || audio.state !== 'running') return;
  sounds[cue].forEach(([from, to, duration, volume, type], index) => {
    const now = audio.currentTime + index * .052;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.exponentialRampToValueAtTime(volume * strength, now + .015);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + .02);
  });
}

soundButton.addEventListener('click', async () => {
  if (sound) sound = false;
  else {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return;
    try {
      audio ||= new AudioEngine();
      await audio.resume();
      sound = true;
    } catch { return; }
  }
  soundButton.textContent = sound ? 'Sound on' : 'Sound off';
  soundButton.setAttribute('aria-pressed', String(sound));
  if (sound) noteCue('bridge');
});
get('start').addEventListener('click', (event) => start(event.detail > 0));
controls.addEventListener('pointerdown', (event) => { state.touchUsed ||= event.pointerType === 'touch'; });
dropButton.addEventListener('click', (event) => { hardDrop(); focusBoard(event.detail > 0); });
restartButton.addEventListener('click', (event) => reset(true, event.detail > 0));
get('retry').addEventListener('click', (event) => reset(true, event.detail > 0));
get('share').addEventListener('click', async () => {
  const { text, url } = resultShare();
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    get('share-feedback').textContent = 'Copied to clipboard.';
  } catch { get('share-feedback').textContent = 'Clipboard unavailable. Select the score to copy it.'; }
});

reset();
resize();
requestAnimationFrame(frame);
