export const gramsPerOunce = 28.349523125;
export const conferenceCaps = { leads: 8, deals: 12, value: 10, sideEvents: 5 };
export const conferenceCountLimits = { leads: 24, sideEvents: 15 };
const seriousBusinessCap = 65;

function diminishingPoints(amount, maximum, midpoint) {
  return maximum / (1 + midpoint / amount);
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
    pints: diminishingPoints(pints, 20, 3.5),
    cigs: diminishingPoints(cigs, 14, 5),
    favors: diminishingPoints(favors, 15, 1),
    sleep: sleep === null ? 0 : 16 * (1 - sleep / 24) ** 2
  };
  const conferencePoints = terms.leads + terms.deals + terms.value + terms.sideEvents;
  const seriousBusinessPoints = terms.pints + terms.cigs + terms.favors + terms.sleep;
  terms.blackouts = Math.min(diminishingPoints(blackouts, 6, 1), Math.max(0, seriousBusinessCap - seriousBusinessPoints));
  return { terms, score: Math.round((conferencePoints + (seriousBusinessPoints + terms.blackouts)) * 10) / 10 };
}

export function calculateScore(stats) {
  return calculateScoreBreakdown(stats).score;
}
