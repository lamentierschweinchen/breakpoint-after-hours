export const gramsPerOunce = 28.349523125;
export const conferenceCaps = { leads: 8, deals: 47, value: 10, sideEvents: 5 };
export const conferenceCountLimits = { leads: 24, deals: 12, sideEvents: 15 };
const seriousBusinessCaps = { pints: 20, cigs: 14, favors: 15, sleep: 16, blackouts: 6 };
const maximumRawPoints = Object.values({ ...conferenceCaps, ...seriousBusinessCaps })
  .reduce((sum, cap) => sum + cap, 0);
const compressionStart = 80;

function diminishingPoints(amount, curveMaximum, midpoint, cap = curveMaximum) {
  return Math.min(cap, curveMaximum / (1 + midpoint / amount));
}

function conferenceCountPoints(amount, stat, firstCount, firstPoints) {
  const limit = conferenceCountLimits[stat];
  const firstShare = Math.min(amount, firstCount) / firstCount;
  const lastShare = Math.max(0, Math.min(amount, limit) - firstCount) / (limit - firstCount);
  return firstShare * firstPoints + lastShare * (conferenceCaps[stat] - firstPoints);
}

export function calculateScoreBreakdown({ leads, deals, value, sideEvents, pints, cigs, favors, sleep, blackouts = 0 }) {
  const terms = {
    leads: conferenceCountPoints(leads, 'leads', 8, 6),
    deals: Math.min(deals * 4, conferenceCaps.deals),
    value: Math.min(value / 5000, conferenceCaps.value),
    sideEvents: conferenceCountPoints(sideEvents, 'sideEvents', 5, 3),
    pints: diminishingPoints(pints, 24, 3.4, seriousBusinessCaps.pints),
    cigs: diminishingPoints(cigs, 17, 5, seriousBusinessCaps.cigs),
    favors: diminishingPoints(favors, 19, 1, seriousBusinessCaps.favors),
    sleep: sleep === null ? 0 : seriousBusinessCaps.sleep * (1 - sleep / 24) ** 2,
    blackouts: diminishingPoints(blackouts, seriousBusinessCaps.blackouts, 1)
  };
  let total = Object.values(terms).reduce((sum, points) => sum + points, 0);
  if (total > compressionStart) {
    const remainingShare = (total - compressionStart) / (maximumRawPoints - compressionStart);
    const adjusted = compressionStart + remainingShare * (100 - compressionStart);
    const scale = adjusted / total;
    for (const key of Object.keys(terms)) terms[key] *= scale;
    total = adjusted;
  }
  return { terms, score: Math.round(total * 10) / 10 };
}

export function calculateScore(stats) {
  return calculateScoreBreakdown(stats).score;
}
