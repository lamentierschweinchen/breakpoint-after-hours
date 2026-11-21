const cohorts = [['badge', 'Solana Badge'], ['mobile', 'Mobile'], ['desktop', 'Desktop']];
const names = { 'break-pint': 'Break Pint', 'meet-mario': 'Meet Mario', 'pint-pyramid': 'Pint Pyramid' };
const rulesets = { 'break-pint': 'pint-v1', 'meet-mario': 'rooms-v1', 'pint-pyramid': 'stack-v1' };
const identityKey = 'breakpoint:arcade-player';
const nameKey = 'breakpoint:arcade-name';

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function save(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Play still works without storage. */ }
}

function format(game, cohort, board, score) {
  if (game === 'pint-pyramid') return `${score.toLocaleString('en-US')} pts`;
  if (game === 'meet-mario') return `Room ${board} · ${score} stumbles`;
  return cohort === 'badge' ? `Round ${board} · ${score}%` : `${score}% delivered`;
}

function button(text, type = 'button') {
  const element = document.createElement('button');
  element.type = type;
  element.className = 'leaderboard-button';
  element.textContent = text;
  return element;
}

export function mountLeaderboard(game, openerParent, resultParent) {
  const open = button('Leaderboard');
  const post = button('Post score');
  post.hidden = true;
  openerParent.append(open);
  resultParent.append(post);

  const dialog = document.createElement('dialog');
  dialog.className = 'arcade-leaderboard';
  dialog.setAttribute('aria-labelledby', 'leaderboard-title');
  dialog.innerHTML = `
    <div class="leaderboard-heading">
      <h2 id="leaderboard-title"></h2>
      <form method="dialog"><button class="leaderboard-button" aria-label="Close leaderboard">×</button></form>
    </div>
    <div class="leaderboard-cohorts" role="group" aria-label="Device"></div>
    <p class="leaderboard-state" role="status"></p>
    <ol class="leaderboard-rows"></ol>
    <form class="leaderboard-share" hidden>
      <p class="leaderboard-run"></p>
      <label>Public username <input name="username" autocomplete="nickname" spellcheck="false" required maxlength="16"
        pattern="[A-Za-z0-9][A-Za-z0-9 _\\-]{0,15}"></label>
      <button class="leaderboard-button" type="submit">Post score</button>
      <p class="leaderboard-feedback" role="status"></p>
    </form>`;
  document.body.append(dialog);
  dialog.querySelector('h2').textContent = names[game] + ' leaderboard';
  const group = dialog.querySelector('.leaderboard-cohorts');
  const state = dialog.querySelector('.leaderboard-state');
  const rows = dialog.querySelector('.leaderboard-rows');
  const form = dialog.querySelector('.leaderboard-share');
  const run = dialog.querySelector('.leaderboard-run');
  const feedback = dialog.querySelector('.leaderboard-feedback');
  const username = form.elements.username;
  const submit = form.querySelector('button');
  let player = read(identityKey);
  let scoreToPost;
  let shownRun;
  let activeRequest;
  const browser = /Android|Mobile|iPad|iPhone|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

  async function show(cohort) {
    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    for (const tab of group.children) tab.setAttribute('aria-pressed', String(tab.value === cohort));
    rows.replaceChildren();
    state.textContent = 'Loading scores…';
    try {
      const response = await fetch(`/board?game=${game}&cohort=${cohort}`, { signal: request.signal });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (request.signal.aborted) return;
      state.textContent = result.rows.length ? '' : 'No scores posted yet.';
      for (const { name, board, score } of result.rows) {
        const row = document.createElement('li');
        const playerName = document.createElement('span');
        const resultText = document.createElement('strong');
        playerName.textContent = name;
        resultText.textContent = format(game, cohort, board, score);
        row.append(playerName, resultText);
        rows.append(row);
      }
    } catch {
      if (request.signal.aborted) return;
      state.textContent = 'Scores are unavailable. Select a device to retry.';
    }
  }

  for (const [cohort, label] of cohorts) {
    const tab = button(label);
    tab.value = cohort;
    tab.addEventListener('click', () => show(cohort));
    group.append(tab);
  }

  function leaderboard(withScore) {
    shownRun = withScore ? scoreToPost : null;
    form.hidden = !shownRun;
    if (shownRun) {
      username.value = read(nameKey) ?? '';
      feedback.textContent = '';
      run.textContent = format(game, browser, shownRun.board, shownRun.score);
    }
    dialog.showModal();
    void show(browser);
  }
  open.addEventListener('click', () => leaderboard(false));
  post.addEventListener('click', () => leaderboard(true));
  dialog.addEventListener('close', () => activeRequest?.abort());
  dialog.addEventListener('keydown', event => event.stopPropagation());

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!shownRun || submit.disabled) return;
    submit.disabled = true;
    feedback.textContent = 'Posting…';
    try {
      player ||= crypto.randomUUID();
      save(identityKey, player);
      const response = await fetch('/api/arcade-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op:'share', player, game, ruleset: rulesets[game], name: username.value.trim(), ...shownRun }),
      });
      const result = await response.json();
      if (!response.ok) {
        feedback.textContent = response.status === 409 ? 'That username is unavailable.' : 'Score could not be posted. Try again.';
        return;
      }
      username.value = result.name;
      save(nameKey, result.name);
      feedback.textContent = 'Score posted.';
      if (dialog.open) await show(result.cohort);
    } catch {
      feedback.textContent = 'Score could not be posted. Try again.';
    } finally {
      submit.disabled = false;
    }
  });

  return (board, score, eligible = true) => {
    scoreToPost = eligible ? { board, score, runId: crypto.randomUUID() } : null;
    post.hidden = !scoreToPost;
  };
}
