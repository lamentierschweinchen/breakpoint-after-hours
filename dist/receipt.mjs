const printed = document.querySelector('#receipt-printed');
const empty = document.querySelector('#receipt-empty');
const details = document.querySelector('#receipt-details');
const itemList = document.querySelector('#receipt-lines');
const scoreValue = document.querySelector('#score-value');
const spokenScore = document.querySelector('#spoken-score');
const benchmark = document.querySelector('#benchmark');
const benchmarkOutcome = document.querySelector('#benchmark-outcome');
const opinionStamp = document.querySelector('#opinion-stamp');
const opinionFinding = document.querySelector('#opinion-finding');
const economicsBlock = document.querySelector('#receipt-economics');
const economicsList = document.querySelector('#economics-list');
const notesBlock = document.querySelector('#receipt-notes');
const notesList = document.querySelector('#receipt-notes-list');

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderSection(section, index) {
  const group = element('section', undefined, 'receipt-items');
  const heading = element('div', undefined, 'receipt-items-heading');
  heading.append(element('h3', section.label));
  if (index === 0) heading.append(element('span', 'pts'));
  const lines = element('dl', undefined, 'receipt-lines');

  for (const row of section.rows) {
    const line = element('div', undefined, row.nested ? 'receipt-row receipt-row-nested' : 'receipt-row');
    line.append(element('dt', row.label), element('dd', row.quantity, 'receipt-quantity'));
    if (row.points) line.append(element('dd', row.points, 'receipt-points'));
    lines.append(line);
  }

  group.append(heading, lines);
  return group;
}

function renderEconomics(rows) {
  economicsBlock.hidden = !rows.length;
  economicsList.replaceChildren(...rows.map(([label, value]) => {
    const row = element('div', undefined, 'receipt-economic');
    row.append(element('dt', label), element('dd', value));
    return row;
  }));
}

export function renderReceipt(model) {
  const hasStats = model !== null;
  empty.hidden = hasStats;
  details.hidden = !hasStats;
  printed.hidden = !hasStats;
  if (!hasStats) {
    spokenScore.textContent = '';
    return;
  }

  const { sections, rounding, score, opinion } = model;
  printed.textContent = model.printed;
  const sectionsAndRounding = sections.map(renderSection);
  if (rounding) {
    const row = element('div', undefined, 'receipt-rounding');
    row.append(element('span', 'Rounding'), element('span', rounding));
    sectionsAndRounding.push(row);
  }
  itemList.replaceChildren(...sectionsAndRounding);

  scoreValue.textContent = `${score} / 100`;
  benchmark.hidden = !model.benchmark;
  benchmarkOutcome.textContent = model.benchmark;
  opinionStamp.textContent = opinion.stamp;
  opinionFinding.textContent = opinion.finding;
  const spoken = `Breakpoint efficiency score: ${score} out of 100. ${opinion.stamp}. ${opinion.finding}`;
  if (spokenScore.textContent !== spoken) spokenScore.textContent = spoken;

  renderEconomics(model.economics);
  notesBlock.hidden = !model.notes.length;
  notesList.replaceChildren(...model.notes.map(text => element('p', text)));
}
