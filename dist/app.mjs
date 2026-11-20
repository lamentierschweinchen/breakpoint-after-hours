import { gramsPerOunce } from './score.mjs';
import { buildReceipt, fieldError, liveNotes } from './audit.mjs';
import { renderReceipt } from './receipt.mjs';
import { createScoreImage } from './share-image.mjs';
import { createSocialShare } from './social.mjs';
import { readArcadeDraft, saveArcadeDraft } from './arcade-draft.mjs';

const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobileForm = matchMedia('(max-width: 47.999rem)');
const visualViewport = window.visualViewport;
const form = document.querySelector('#audit-form');
const inputs = [...form.querySelectorAll('input[type="number"]')];
const fields = inputs.map((input, index) => {
  const field = input.closest('.field');
  const error = document.createElement('p');
  error.id = input.id + '-error';
  error.className = 'field-error';
  error.setAttribute('role', 'status');
  error.hidden = true;
  field.append(error);
  const description = input.getAttribute('aria-describedby');
  input.setAttribute('aria-describedby', [description, error.id].filter(Boolean).join(' '));
  input.enterKeyHint = index === inputs.length - 1 ? 'done' : 'next';
  return { input, field, error };
});
const favorsInput = form.elements.favors;
const sleepInput = form.elements.sleep;
const sleepRange = document.querySelector('#sleep-range');
const tallies = [...form.querySelectorAll('[data-tally]')].map(button => ({
  button,
  input: form.elements[button.dataset.tally],
  step: Number(button.dataset.step)
}));
const unitButtons = [...document.querySelectorAll('[data-unit]')];
const favorsUnit = document.querySelector('#favors-unit');
const receipt = document.querySelector('#score-receipt');
const scoreDock = document.querySelector('#score-dock');
const dockScore = document.querySelector('#dock-score');
const dockJump = document.querySelector('#dock-jump');
const dockShare = document.querySelector('#dock-share');
const noteSlot = document.querySelector('#live-note');
const getReceipt = document.querySelector('#get-receipt');
const shareButton = document.querySelector('#share-score');
const sendScore = document.querySelector('#send-score');
const shareDialog = document.querySelector('#share-dialog');
const shareFormats = [...shareDialog.querySelectorAll('input[name="share-format"]')];
const shareCopies = [...shareDialog.querySelectorAll('input[name="share-copy"]')];
const preview = document.querySelector('#share-preview');
const shareStatus = document.querySelector('#share-status');
const downloadImage = document.querySelector('#download-image');
const shareOnX = document.querySelector('#share-on-x');
const nativeShare = document.querySelector('#native-share');
const copyImage = document.querySelector('#copy-image');
const copyChallenge = document.querySelector('#copy-challenge');
const challengeInput = document.querySelector('#challenge-url');
const arcadeLinks = document.querySelectorAll('a[href="./arcade/"]');
const receiptArcade = document.querySelector('#receipt-arcade');

const example = { leads: 10, deals: 3, value: 24000, sideEvents: 3, pints: 5, cigs: 6, favors: 1, sleep: 4 };
const pulseTimers = new WeakMap();
let activeUnit = 'g';
let enteredFavors = { amount: 0, unit: 'g' };
let currentReceipt = null;
let statsSignature;
let changedAt;
let previousNotes = new Map();
let shownNote;
let noteTimer;
let scrollFrame = 0;
let dockFrame = 0;
let focusFitTimer;
let formInView = false;
let formEngaged = false;
let receiptRequested = false;
let reveal;
let revealFrame;
let imageUrl;
let shareFile;
let shareSnapshot = null;
let shareOpener;
let shareRequest = 0;

const targetParam = new URLSearchParams(location.search).get('beat');
const target = targetParam && /^(?:100|\d{1,2}(?:\.\d)?)$/.test(targetParam) ? Number(targetParam) : null;
if (target !== null) {
  document.querySelector('#challenge-score').textContent = String(target);
  document.querySelector('#challenge').hidden = false;
}

function recordFavors() {
  enteredFavors = { amount: favorsInput.valueAsNumber || 0, unit: activeUnit };
}

function stashArcadeDraft(event) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const values = Object.fromEntries(inputs.filter(input => input.value !== '').map(input => [input.name, input.value]));
  if (!Object.keys(values).length && target === null) return;
  saveArcadeDraft({ values, unit: activeUnit, enteredFavors, benchmark: target, fromReceipt: event.currentTarget === receiptArcade });
}

for (const link of arcadeLinks) link.addEventListener('click', stashArcadeDraft);

window.addEventListener('pageshow', event => {
  if (event.persisted) readArcadeDraft({ consume: true });
});

function setUnit(unit) {
  if (unit === activeUnit) return;
  activeUnit = unit;
  favorsUnit.textContent = unit === 'g' ? 'Grams' : 'Ounces';
  for (const button of unitButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.unit === unit));
  }
  if (favorsInput.value !== '' && favorsInput.validity.valid) {
    const { amount, unit: enteredUnit } = enteredFavors;
    if (unit === enteredUnit) {
      favorsInput.value = String(amount);
      return;
    }
    const converted = unit === 'g' ? amount * gramsPerOunce : amount / gramsPerOunce;
    const displayAmount = Math.min(Number.MAX_VALUE, Math.max(amount > 0 ? Number.MIN_VALUE : 0, converted));
    favorsInput.value = String(Number(displayAmount.toPrecision(8)));
  }
}

function pulse(element, className) {
  if (reducedMotion.matches) return;
  const previous = pulseTimers.get(element);
  if (previous) {
    clearTimeout(previous.timer);
    if (previous.className !== className) element.classList.remove(previous.className);
  }
  element.classList.add(className);
  const timer = setTimeout(() => {
    element.classList.remove(className);
    pulseTimers.delete(element);
  }, 620);
  pulseTimers.set(element, { timer, className });
}

function updateDock() {
  const active = document.activeElement;
  const editingInput = form.contains(active) && active.matches('input');
  const visible = !shareDialog.open && !receiptRequested &&
    (editingInput || (formEngaged && formInView));
  if (scoreDock.dataset.visible === String(visible)) return;
  scoreDock.dataset.visible = String(visible);
  scoreDock.inert = !visible;
  root.style.setProperty('--form-scroll-inset', visible ? (scoreDock.offsetHeight + 12) + 'px' : '1rem');
}

function syncDockPosition() {
  if (dockFrame) return;
  dockFrame = requestAnimationFrame(() => {
    dockFrame = 0;
    const lift = visualViewport && mobileForm.matches
      ? Math.max(0, root.clientHeight - visualViewport.height - visualViewport.offsetTop)
      : 0;
    root.style.setProperty('--dock-lift', Math.round(lift) + 'px');
  });
}

function scheduleFocusFit() {
  syncDockPosition();
  clearTimeout(focusFitTimer);
  const input = document.activeElement;
  if (!mobileForm.matches || !inputs.includes(input)) return;
  // Let the browser finish the native focus scroll and keyboard resize first.
  focusFitTimer = setTimeout(() => {
    if (input !== document.activeElement || scoreDock.inert || (visualViewport?.scale ?? 1) > 1.01) return;
    const field = input.getBoundingClientRect();
    const top = (visualViewport?.offsetTop ?? 0) + 8;
    const bottom = scoreDock.getBoundingClientRect().top - 8;
    if (bottom - top < field.height) return;
    const correction = field.bottom > bottom
      ? field.bottom - bottom
      : Math.min(0, field.top - top);
    if (Math.abs(correction) > 1) window.scrollBy({ top: correction, behavior: 'instant' });
  }, 130);
}

function settleNotes(stats, unit, initial) {
  const candidates = liveNotes(stats, unit);
  const winner = initial ? undefined : candidates.find(entry => previousNotes.get(entry.id) !== entry.text);
  if (winner) shownNote = winner;
  else if (!candidates.some(entry => entry.id === shownNote?.id)) shownNote = undefined;
  previousNotes = new Map(candidates.map(entry => [entry.id, entry.text]));
  const text = shownNote?.text ?? '';
  if (noteSlot.textContent !== text) noteSlot.textContent = text;
}

function renderAudit({ initial = false } = {}) {
  const entries = {};
  const stats = {};
  for (const { input, field, error } of fields) {
    const { name, valueAsNumber: value } = input;
    const message = fieldError(name, value, input.validity.badInput);
    const entered = !message && Number.isFinite(value);
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    if (error.textContent !== message) error.textContent = message;
    error.hidden = !message;
    field.classList.toggle('has-value', entered);
    if (entered) entries[name] = value;
    stats[name] = entered ? value : name === 'sleep' ? null : 0;
  }

  for (const { button, input, step } of tallies) {
    button.disabled = step < 0 && !(input.valueAsNumber > 0);
  }
  sleepRange.value = entries.sleep ?? sleepRange.defaultValue;
  if (Object.hasOwn(entries, 'favors')) {
    stats.favors = enteredFavors.unit === 'oz' ? enteredFavors.amount * gramsPerOunce : enteredFavors.amount;
  }
  const signature = inputs.map(({ name }) => Object.hasOwn(entries, name) ? stats[name] : '').join('|');
  if (statsSignature !== signature) {
    statsSignature = signature;
    changedAt = new Date();
  }

  currentReceipt = Object.keys(entries).length ? buildReceipt(stats, entries, activeUnit, changedAt, target) : null;
  renderReceipt(currentReceipt);
  const score = currentReceipt?.score ?? null;
  dockScore.textContent = score === null ? '—' : String(score);
  shareButton.disabled = score === null;
  receiptArcade.hidden = score === null;
  root.style.setProperty('--score-progress', (score ?? 0) / 100);

  clearTimeout(noteTimer);
  if (initial) settleNotes(stats, activeUnit, true);
  else {
    formEngaged = true;
    receiptRequested = false;
    const unit = activeUnit;
    noteTimer = setTimeout(() => settleNotes(stats, unit, false), 400);
  }
  updateDock();
}

function syncScrollProgress() {
  if (scrollFrame || reducedMotion.matches) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    const maxScroll = root.scrollHeight - innerHeight;
    const progress = maxScroll > 0 ? Math.max(0, Math.min(1, scrollY / maxScroll)) : 0;
    root.style.setProperty('--scroll-progress', progress.toFixed(3));
  });
}

if ('IntersectionObserver' in window) {
  const reveals = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.05 });
  for (const target of document.querySelectorAll('[data-reveal]')) reveals.observe(target);

  const formObserver = new IntersectionObserver(([entry]) => {
    formInView = entry.isIntersecting;
    updateDock();
  });
  formObserver.observe(form);
}

window.addEventListener('scroll', syncScrollProgress, { passive: true });
window.addEventListener('resize', () => {
  syncScrollProgress();
  scheduleFocusFit();
});
visualViewport?.addEventListener('resize', scheduleFocusFit);
visualViewport?.addEventListener('scroll', syncDockPosition, { passive: true });
reducedMotion.addEventListener('change', syncScrollProgress);
form.addEventListener('focusin', event => {
  if (!event.target.matches('input')) return;
  formEngaged = true;
  receiptRequested = false;
  updateDock();
  scheduleFocusFit();
});
form.addEventListener('focusout', () => {
  clearTimeout(focusFitTimer);
  requestAnimationFrame(updateDock);
});

function showReceipt(event) {
  event.preventDefault();
  receiptRequested = true;
  receipt.focus({ preventScroll: true });
  updateDock();
  reveal?.cancel();
  cancelAnimationFrame(revealFrame);
  receipt.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  if (reducedMotion.matches) return;

  const deadline = performance.now() + 900;
  function revealWhenInView(now) {
    if (reducedMotion.matches || !receiptRequested) return;
    const top = receipt.getBoundingClientRect().top;
    const visibleHeight = window.visualViewport?.height ?? innerHeight;
    if ((top < -20 || top > visibleHeight * 0.28) && now < deadline) {
      revealFrame = requestAnimationFrame(revealWhenInView);
      return;
    }
    reveal = receipt.animate(
      [{ clipPath: 'inset(0 0 85% 0)', opacity: 0.55 }, { clipPath: 'inset(0 0 -1rem 0)', opacity: 1 }],
      { duration: 550, easing: 'cubic-bezier(.22, .85, .31, 1)' }
    );
  }
  revealFrame = requestAnimationFrame(revealWhenInView);
}

getReceipt.addEventListener('click', showReceipt);
dockJump.addEventListener('click', showReceipt);
dockShare.addEventListener('click', showReceipt);

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('keydown', event => {
  if (!mobileForm.matches || event.key !== 'Enter' || event.isComposing) return;
  const index = inputs.indexOf(event.target);
  if (index === -1) return;
  event.preventDefault();
  const next = inputs[index + 1];
  if (next) next.focus({ preventScroll: true });
  else event.target.blur();
});
form.addEventListener('input', event => {
  if (event.target === sleepRange) sleepInput.value = sleepRange.value;
  if (event.target === favorsInput) recordFavors();
  if (event.target.validity.valid && event.target.value !== '') {
    pulse(event.target.closest('.field'), 'input-hit');
  }
  renderAudit();
});

sleepRange.addEventListener('pointerup', () => {
  if (sleepInput.value === '') sleepRange.dispatchEvent(new Event('input', { bubbles: true }));
});

for (const { button, input, step } of tallies) {
  button.addEventListener('click', () => {
    const current = Math.max(0, input.valueAsNumber || 0);
    const next = Math.max(0, current + step);
    input.value = String(Math.min(Number.MAX_VALUE, Number(next.toPrecision(15))));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

for (const button of unitButtons) {
  button.addEventListener('click', () => {
    if (button.dataset.unit === activeUnit) return;
    setUnit(button.dataset.unit);
    renderAudit();
  });
}

document.querySelector('#example').addEventListener('click', () => {
  form.reset();
  setUnit('g');
  for (const [name, value] of Object.entries(example)) {
    form.elements[name].value = String(value);
  }
  recordFavors();
  renderAudit();
});

document.querySelector('#clear').addEventListener('click', () => {
  form.reset();
  setUnit('g');
  recordFavors();
  renderAudit();
});

document.querySelector('#method').addEventListener('toggle', syncScrollProgress);

function clearShareImage() {
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = undefined;
  shareFile = undefined;
  preview.hidden = true;
  preview.removeAttribute('src');
  downloadImage.hidden = true;
  downloadImage.removeAttribute('href');
  shareOnX.hidden = true;
  shareOnX.removeAttribute('href');
  nativeShare.hidden = true;
  copyImage.hidden = true;
}

async function renderShareImage() {
  if (!shareSnapshot) return;
  const copy = shareCopies.find(option => option.checked)?.value ?? 'public';
  const isCustomer = copy === 'customer';
  const snapshot = shareSnapshot;
  const format = shareFormats.find(option => option.checked)?.value ?? 'landscape';
  const request = ++shareRequest;
  clearShareImage();
  shareDialog.dataset.format = format;
  shareDialog.dataset.copy = copy;
  copyChallenge.hidden = isCustomer;
  if (!isCustomer) {
    shareOnX.href = receiptShare(snapshot).xUrl;
    shareOnX.hidden = false;
  }
  challengeInput.hidden = true;
  shareStatus.textContent = 'Printing…';

  try {
    const image = await createScoreImage(snapshot, format, { customer: isCustomer });
    if (!shareDialog.open || request !== shareRequest) return;

    imageUrl = URL.createObjectURL(image);
    const suffix = [isCustomer ? '-customer-copy' : '', format === 'story' ? '-story' : ''].join('');
    const name = `breakpoint-after-hours-${snapshot.score}${suffix}.png`;
    if (!isCustomer) shareFile = new File([image], name, { type: 'image/png' });
    preview.src = imageUrl;
    preview.alt = `Receipt showing a Breakpoint efficiency score of ${snapshot.score} out of 100. ${snapshot.opinion.stamp}.`;
    preview.hidden = false;
    downloadImage.href = imageUrl;
    downloadImage.download = name;
    downloadImage.hidden = false;
    const canShareFiles = !isCustomer && navigator.share && navigator.canShare?.(systemShare(snapshot));
    nativeShare.hidden = !canShareFiles;
    copyImage.hidden = isCustomer || canShareFiles || !(navigator.clipboard?.write && typeof ClipboardItem === 'function');
    shareStatus.textContent = '';
  } catch {
    if (shareDialog.open && request === shareRequest) {
      shareStatus.textContent = 'Couldn’t create the receipt image. Close this window and try again.';
    }
  }
}

function openShare(event) {
  if (!currentReceipt) return;
  const { score, opinion: { stamp, finding } } = currentReceipt;
  shareSnapshot = { score, opinion: { stamp, finding } };
  shareCopies[0].checked = true;
  shareOpener = event.currentTarget;
  challengeInput.hidden = true;
  shareDialog.showModal();
  updateDock();
  renderShareImage();
}

shareButton.addEventListener('click', openShare);
sendScore.addEventListener('click', openShare);

for (const option of [...shareFormats, ...shareCopies]) option.addEventListener('change', renderShareImage);

function challengeLink(score) {
  const link = new URL('/', 'https://breakpoint.beer');
  link.searchParams.set('beat', String(score));
  return link.href;
}

function receiptShare({ score, opinion }) {
  return createSocialShare(`Breakpoint After Hours audit: ${score} / 100. ${opinion.stamp}. Your turn.`, challengeLink(score));
}

function systemShare(snapshot) {
  const { text, url } = receiptShare(snapshot);
  return { files: [shareFile], text, url };
}

nativeShare.addEventListener('click', async () => {
  if (!shareFile || !shareSnapshot) return;
  const request = shareRequest;
  try {
    await navigator.share(systemShare(shareSnapshot));
  } catch (error) {
    if (error.name !== 'AbortError' && shareDialog.open && request === shareRequest) {
      shareStatus.textContent = 'Sharing couldn’t open. Download the PNG to post it.';
    }
  }
});

copyImage.addEventListener('click', async () => {
  if (!shareFile) return;
  const request = shareRequest;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': shareFile })]);
    if (shareDialog.open && request === shareRequest) shareStatus.textContent = 'Image copied.';
  } catch {
    if (shareDialog.open && request === shareRequest) {
      shareStatus.textContent = 'Couldn’t copy the image. Download the PNG to post it.';
    }
  }
});

copyChallenge.addEventListener('click', async () => {
  const snapshot = shareSnapshot;
  if (!snapshot || copyChallenge.hidden) return;
  const request = shareRequest;
  const link = challengeLink(snapshot.score);
  try {
    await navigator.clipboard.writeText(link);
    if (shareDialog.open && request === shareRequest) shareStatus.textContent = 'Challenge link copied.';
  } catch {
    if (!shareDialog.open || request !== shareRequest) return;
    challengeInput.value = link;
    challengeInput.hidden = false;
    challengeInput.select();
  }
});

shareDialog.addEventListener('close', () => {
  if (shareDialog.open) return;
  shareSnapshot = null;
  clearShareImage();
  updateDock();
  shareOpener?.focus({ preventScroll: true });
});

const arcadeDraft = readArcadeDraft({ consume: true });
if (arcadeDraft) {
  setUnit(arcadeDraft.unit);
  for (const input of inputs) input.value = arcadeDraft.values[input.name] ?? '';
  enteredFavors = arcadeDraft.enteredFavors;
} else {
  recordFavors();
}
renderAudit({ initial: true });
if (arcadeDraft?.fromReceipt && currentReceipt) {
  receipt.focus({ preventScroll: true });
  receipt.scrollIntoView({ block: 'start', behavior: 'instant' });
}
syncDockPosition();
syncScrollProgress();
