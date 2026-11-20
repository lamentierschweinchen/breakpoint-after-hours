import { calculateScoreBreakdown, conferenceCaps, conferenceCountLimits } from './score.mjs';

export const receiptCopy = {
  title: 'Breakpoint After Hours',
  subtitle: 'Efficiency audit · London 2026',
  score: 'Efficiency score',
  opinion: 'Opinion',
  hostname: 'breakpoint.beer'
};

const opinions = [
  { max: 10, stamp: 'Dormant account', finding: 'Badge collected. No material activity since.' },
  { max: 25, stamp: 'Fully compliant', finding: 'Seen at the hotel breakfast.' },
  { max: 40, stamp: 'Requires improvement', finding: 'Left while the drinks were still free.' },
  { max: 55, stamp: 'Meets expectations', finding: 'A solid showing.' },
  { max: 70, stamp: 'Exceeds expectations', finding: 'Last seen negotiating with a kebab shop.' },
  { max: 85, stamp: 'Outstanding', finding: 'Made the most of the week.' },
  { max: 100, stamp: 'Exceptional', finding: 'Set the standard for next year.' }
];
const perfectOpinion = { stamp: 'Perfect score', finding: 'Approved in full.' };
const voidOpinion = { stamp: 'Void', finding: 'Totals consistent with a mid-sized venue.' };

function note(id, text, when, { live = false, receipt = false } = {}) {
  return { id, text, when, live, receipt };
}

const notes = [
  note('implausible', 'Recorded as stated. Not verified.', s => s.implausible, { live: true }),
  note('sober-closer', 'Deals closed before the bar opened.', s => s.deals >= 1 && s.pints === 0 && s.cigs === 0 && s.favors === 0, { receipt: true }),
  note('smoking-area', 'Smoking area logged as a side event.', s => s.cigs >= 5 && s.leads >= 5, { receipt: true }),
  note('supplier', 'Supplier performance under review.', s => s.favors >= 1 && s.sleep !== null && s.sleep >= 8, { receipt: true }),
  note('catering', 'Attendance attributed to the catering.', s => s.sideEvents >= 3 && s.leads === 0 && s.deals === 0, { receipt: true }),
  note('pipeline', 'No deal closed. Value moved to pipeline.', s => s.value > 0 && s.deals === 0, { receipt: true }),
  note('napkins', 'Napkins are not accepted as contracts.', s => s.value >= 1000000 && s.deals >= 1, { live: true, receipt: true }),
  note('leads-cap', 'Only the first 24 leads are believed.', s => s.leads > conferenceCountLimits.leads, { live: true, receipt: true }),
  note('deals-cap', 'Only the first 12 deals are scored.', s => s.deals > conferenceCountLimits.deals, { live: true, receipt: true }),
  note('value-cap', 'Only the first $50,000 is scored.', s => s.value > 50000 && s.value < 1000000, { live: true }),
  note('events-cap', 'After the fifteenth, only the sponsor changes.', s => s.sideEvents > conferenceCountLimits.sideEvents, { live: true, receipt: true }),
  note('sleep-full', 'Voluntary disclosure accepted.', s => s.sleep !== null && s.sleep >= 8 && s.sleep < 12, { live: true }),
  note('sleep-long', 'Do Not Disturb sign noted.', s => s.sleep !== null && s.sleep >= 12 && s.sleep < 24, { live: true, receipt: true }),
  note('sleep-all', 'Did not attend.', s => s.sleep === 24, { live: true, receipt: true }),
  note('talks', 'Recorded for completeness.', s => s.talks >= 1, { live: true })
];

const wholeLabels = {
  cigs: 'Cigs', blackouts: 'Blackouts', leads: 'Leads', deals: 'Deals', sideEvents: 'Side events', talks: 'Talks'
};
const seriousItems = [
  ['pints', 'Pints'], ['cigs', 'Cigs'], ['favors', 'Party favors'], ['blackouts', 'Blackouts'], ['sleep', 'Sleep']
];
const conferenceItems = [
  ['leads', 'Real leads'], ['deals', 'Deals closed'], ['value', 'Deal value'],
  ['sideEvents', 'Side events'], ['talks', 'Talks attended']
];
const numberWords = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const wholeDollars = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const amountFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false });

function isImplausible(s) {
  return s.pints >= 200 || s.cigs >= 500 || s.favors >= 100 || s.leads >= 500 ||
    s.deals >= 100 || s.value >= 1000000000 || s.sideEvents >= 100;
}

function opinionFor(score, implausible) {
  if (implausible) return voidOpinion;
  if (score === 69) return perfectOpinion;
  return opinions.find(band => score < band.max) ?? opinions.at(-1);
}

export function fieldError(name, value, badInput) {
  if (badInput) return 'Enter a number.';
  if (value < 0) return 'No refunds. Enter zero or more.';
  if (name === 'sleep' && value > 24) return 'A day has 24 hours. Enter 0 to 24.';
  if (wholeLabels[name] && Number.isFinite(value) && !Number.isInteger(value)) {
    return `${wholeLabels[name]} are counted whole. Enter ${Math.floor(value)} or ${Math.ceil(value)}.`;
  }
  return '';
}

function conversions({ pints, cigs, favors }, unit) {
  const active = [];
  if (pints >= 8 && pints <= 80 && pints % 8 === 0) {
    active.push({ id: 'gallons', text: pints === 8 ? 'That is one gallon.' : `That is ${numberWords[pints / 8]} gallons.` });
  }
  if (pints >= 88 && pints < 200) active.push({ id: 'keg', text: 'That is a keg.' });
  if (cigs >= 20 && cigs <= 180 && cigs % 20 === 0) {
    active.push({ id: 'packs', text: cigs === 20 ? 'That is one pack.' : `That is ${numberWords[cigs / 20]} packs.` });
  }
  if (cigs >= 200 && cigs < 500) active.push({ id: 'carton', text: 'That is a carton.' });
  if (unit === 'g' && favors >= 28.35 && favors < 100) active.push({ id: 'one-ounce', text: 'That is one ounce.' });
  if (unit === 'oz') active.push({ id: 'ounces', text: 'Ounces are a wholesale unit.' });
  return active;
}

export function liveNotes(stats, unit) {
  const status = { ...stats, implausible: isImplausible(stats) };
  const [implausible, ...remaining] = notes;
  return [
    ...(implausible.when(status) ? [implausible] : []),
    ...conversions(stats, unit),
    ...remaining.filter(entry => entry.live && entry.when(status))
  ];
}

function dollars(value, divisor = 1) {
  const amount = value / divisor;
  if (amount >= 1000000000) {
    const billions = Number.isFinite(amount) ? amount / 1000000000 : (value / 1000000000) / divisor;
    return `$${billions.toFixed(1)}B`;
  }
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  return `$${wholeDollars.format(amount)}`;
}

function quantity(name, value, unit) {
  if (name === 'favors') return `${amountFormat.format(value)} ${unit}`;
  if (name === 'sleep') return `${value} h a night`;
  if (name === 'value') return dollars(value);
  return `× ${value}`;
}

function lineItems(items, entries, terms, unit) {
  return items.filter(([key]) => Object.hasOwn(entries, key)).flatMap(([key, label]) => {
    const points = terms[key] ?? 0;
    const cap = points === conferenceCaps[key] ? ' max' : '';
    const line = { label, quantity: quantity(key, entries[key], unit), points: points.toFixed(1) + cap };
    if (key === 'leads' && entries.leads > 0) {
      return [line, { label: 'Follow-ups', quantity: 'carried forward', nested: true }];
    }
    return [line];
  });
}

function economics({ value, pints, leads, cigs, deals, sleep }) {
  const rows = [];
  if (pints > 0 || value > 0) {
    const revenue = pints === 0 ? 'n/a' : value === 0 ? 'pre-revenue' : dollars(value, pints);
    rows.push(['Revenue per pint', revenue]);
  }
  if (leads > 0) rows.push(['Cost per lead', `${(pints / leads).toFixed(1)} pints`]);
  if (cigs > 0 && deals > 0) rows.push(['Burn rate', `${(cigs / deals).toFixed(1)} cigs per deal`]);
  if (sleep !== null) rows.push(['Uptime', `${((24 - sleep) / 24 * 100).toFixed(1)}%`]);
  return rows;
}

function benchmarkResult(score, target) {
  if (target === null) return '';
  const difference = Math.abs(score - target).toFixed(1);
  if (score > target) return `Outperformed the benchmark by ${difference}.`;
  if (score < target) return `Underperformed the benchmark by ${difference}.`;
  return 'In line with the benchmark to one decimal place.';
}

export function buildReceipt(stats, entries, unit, changedAt, target) {
  const { terms, score } = calculateScoreBreakdown(stats);
  const status = { ...stats, implausible: isImplausible(stats) };
  const opinion = opinionFor(score, status.implausible);
  const sections = [
    { label: 'Serious Business', rows: lineItems(seriousItems, entries, terms, unit) },
    { label: 'Conference', rows: lineItems(conferenceItems, entries, terms, unit) }
  ].filter(section => section.rows.length);
  const displayedTenths = sections.flatMap(section => section.rows).reduce((sum, row) =>
    sum + (row.points ? Math.round(parseFloat(row.points) * 10) : 0), 0);
  const difference = Math.round(score * 10) - displayedTenths;
  return {
    score,
    opinion,
    sections,
    printed: `Printed ${dayFormat.format(changedAt)}, ${timeFormat.format(changedAt)}`,
    rounding: difference ? (difference > 0 ? '+' : '−') + (Math.abs(difference) / 10).toFixed(1) : '',
    economics: economics(stats),
    notes: notes.filter(entry => entry.receipt && entry.when(status)).slice(0, 2).map(entry => entry.text),
    benchmark: benchmarkResult(score, target)
  };
}
