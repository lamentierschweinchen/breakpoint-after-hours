import { PINT_TYPES } from './physics.mjs';

const openings = [
  [['shaker', .43], ['stein', .49], ['stubby', .51]],
  [['nonic', .62], ['shaker', .60], ['yard', .57], ['tulip', .70]],
  [['bucket', .86], ['bell', .95], ['stein', .91], ['yard', .92], ['balloon', .79]],
  [['tower', .91], ['stubby', .96], ['balloon', .88], ['bucket', .94], ['bell', .82], ['yard', .97]],
];
const lateGlasses = ['bucket', 'stubby', 'tower', 'balloon', 'yard', 'bell', 'tulip', 'nonic', 'bucket', 'stein', 'yard'];
const types = new Map(PINT_TYPES.map((type) => [type.id, type]));

export function pourAt(index) {
  let level = 1;
  let position = index;
  while (position >= level + 2) {
    position -= level + 2;
    level += 1;
  }
  const [id, fill] = openings[level - 1]?.[position] ?? [
    lateGlasses[(position * 3 + level * 5) % lateGlasses.length],
    .76 + ((index * 17 + level * 7) % 22) / 100,
  ];
  return { type: types.get(id), fill };
}

export function newScore() {
  return { level: 1, landed: 0, total: 0, points: 0, bestTier: 0, chain: 0, bestChain: 0 };
}

export const OPENING_SPEED = 61;
export const PINT_ML = 473;
export const SPILL_LIMIT = 3 * PINT_ML;

export function fallSpeed(landed) {
  return OPENING_SPEED + 126 * (1 - Math.exp(-landed / 39));
}

export function recordLanding(run, { tier, bridge, clean }) {
  const level = run.level;
  const newTiers = Math.max(0, tier - Math.max(1, run.bestTier));
  run.bestTier = Math.max(run.bestTier, tier);
  run.chain = bridge && clean ? run.chain + 1 : 0;
  run.bestChain = Math.max(run.bestChain, run.chain);
  const multiplier = Math.max(1, Math.min(3, run.chain));
  const bonus = bridge ? 150 * multiplier : 0;
  const points = 100 + (clean ? 50 : 0) + 80 * newTiers + bonus;
  run.points += points;
  run.landed += 1;
  run.total += 1;
  if (run.landed === run.level + 2) {
    run.level += 1;
    run.landed = 0;
  }
  return { points, bonus, multiplier, leveledUp: level !== run.level };
}
