import { createSocialShare } from "../social.mjs";

const gameUrl = "https://breakpoint.beer/meet-mario/";
const cream = "#fff0d4";
const mint = "#abffd2";
const violet = "#d9bbff";
const pink = "#ffa9c5";
const ink = "#1b1129";
const display = '"Archivo Black", "Arial Black", sans-serif';
const mono = 'ui-monospace, "SFMono-Regular", Consolas, monospace';
const ticketNumber = value => String(value).padStart(2, "0");

function print(pen, text, x, y, { size = 26, color = cream, face = mono, width, align = "left" } = {}) {
  pen.fillStyle = color;
  pen.font = `bold ${size}px ${face}`;
  pen.textAlign = align;
  pen.fillText(String(text), x, y, width ?? 1080);
}

function pixelIcon(pen, drawIcon, item, x, y, size) {
  pen.save();
  pen.translate(x, y);
  pen.scale(size / 16, size / 16);
  drawIcon(pen, item, 1, 1);
  pen.restore();
}

function summarize({ rooms, items }) {
  const cleared = rooms.filter(room => room.moves !== undefined);
  const moves = cleared.reduce((total, room) => total + room.moves, 0);
  const overPar = cleared.reduce((total, room) => total + room.moves - room.par, 0);
  return { count: cleared.length, moves, overPar, collected: items.filter(item => item.collected).length };
}

function drawProgress(pen, { rooms, items }, drawIcon) {
  const summary = summarize({ rooms, items });
  const glow = pen.createRadialGradient(824, 295, 45, 824, 295, 920);
  glow.addColorStop(0, "#483063");
  glow.addColorStop(1, "#130c20");
  pen.fillStyle = glow;
  pen.fillRect(0, 0, 1080, 1080);

  pen.fillStyle = "#130c2044";
  for (let y = 28; y < 1050; y += 8) pen.fillRect(28, y, 1024, 1);
  pen.strokeStyle = "#8667a4";
  pen.lineWidth = 2;
  pen.strokeRect(28, 28, 1024, 1024);
  pen.fillStyle = mint;
  pen.fillRect(806, 27, 246, 4);
  print(pen, "BREAKPOINT AFTER HOURS", 72, 105, { size: 26, color: mint });
  print(pen, "LONDON 2026", 1008, 105, { size: 23, color: violet, align: "right" });
  print(pen, "MEET MARIO.", 64, 235, { size: 132, face: display, width: 944 });

  pen.fillStyle = "#130d1d";
  pen.fillRect(72, 282, 936, 672);
  pen.strokeStyle = "#805e9e";
  pen.strokeRect(72, 282, 936, 672);
  pen.fillStyle = pink;
  pen.fillRect(72, 282, 936, 6);

  print(pen, "BLACKOUT SCORECARD", 107, 348, { size: 29, face: display, color: pink });
  print(pen, ticketNumber(summary.count) + "/" + ticketNumber(rooms.length), 96, 498,
    { size: 107, face: display, color: mint, width: 450 });
  print(pen, "ROOMS CLEARED", 108, 541, { size: 26, color: violet });
  print(pen, summary.moves + " STUMBLES", 965, 436, { size: 53, face: display, align: "right", width: 405 });
  print(pen, summary.overPar === 0 ? "ON PAR" : `+${summary.overPar} VS PAR`, 962, 498,
    { size: 31, color: mint, align: "right" });

  rooms.forEach((room, index) => {
    const x = 108 + index * 87;
    const done = room.moves !== undefined;
    const color = room.moves === room.par ? mint : violet;
    pen.fillStyle = done ? color : "#231731";
    pen.fillRect(x, 585, 77, 66);
    if (!done) {
      pen.strokeStyle = "#503b65";
      pen.strokeRect(x, 585, 77, 66);
    }
    print(pen, ticketNumber(index + 1), x + 38, 625, { size: 24, color: done ? ink : violet, align: "center" });
  });

  pen.strokeStyle = "#8667a4";
  pen.setLineDash([6, 7]);
  pen.beginPath();
  pen.moveTo(108, 696);
  pen.lineTo(973, 696);
  pen.stroke();
  pen.setLineDash([]);
  print(pen, "MENU COLLECTED", 108, 750, { size: 26, color: violet });
  print(pen, `${summary.collected} / ${items.length}`, 972, 750, { size: 26, color: mint, align: "right" });
  const step = Math.floor(866 / items.length);
  items.forEach((item, index) => {
    const x = 108 + index * step;
    pen.fillStyle = item.collected ? item.color : "#2d203b";
    pen.fillRect(x, 785, step - 10, 89);
    if (item.collected) pixelIcon(pen, drawIcon, item, x + (step - 74) / 2, 797, 64);
    else print(pen, "·", x + (step - 10) / 2, 841, { size: 35, color: "#ab91c7", align: "center" });
  });

  print(pen, "breakpoint.beer/meet-mario", 72, 1015, { size: 23, color: violet });
}

function drawSticker(pen, item, drawIcon) {
  pen.save();
  pen.beginPath();
  pen.moveTo(107, 25);
  pen.lineTo(661, 25);
  pen.lineTo(661, 48);
  pen.lineTo(714, 48);
  pen.lineTo(714, 96);
  pen.lineTo(743, 96);
  pen.lineTo(743, 672);
  pen.lineTo(714, 672);
  pen.lineTo(714, 720);
  pen.lineTo(661, 720);
  pen.lineTo(661, 743);
  pen.lineTo(107, 743);
  pen.lineTo(107, 720);
  pen.lineTo(54, 720);
  pen.lineTo(54, 672);
  pen.lineTo(25, 672);
  pen.lineTo(25, 96);
  pen.lineTo(54, 96);
  pen.lineTo(54, 48);
  pen.lineTo(107, 48);
  pen.closePath();
  pen.fillStyle = ink;
  pen.fill();
  pen.strokeStyle = item.color;
  pen.lineWidth = 12;
  pen.stroke();
  pen.clip();
  pen.fillStyle = "#322045";
  for (let y = 35; y < 743; y += 9) pen.fillRect(25, y, 718, 1);

  print(pen, "MARIO’S MENU", 384, 116, { size: 31, color: item.color, align: "center" });
  pen.fillStyle = item.color;
  pen.fillRect(201, 161, 366, 337);
  pen.fillStyle = item.shade;
  pen.fillRect(201, 486, 366, 12);
  pixelIcon(pen, drawIcon, item, 239, 185, 290);
  print(pen, item.name.toUpperCase(), 384, 589, { size: 60, face: display, width: 610, align: "center" });
  print(pen, item.blurb, 384, 641, { size: 24, color: violet, width: 610, align: "center" });
  print(pen, "BREAKPOINT AFTER HOURS", 384, 697, { size: 22, color: item.color, align: "center" });
  pen.restore();
}

async function renderImage(snapshot, item, drawIcon) {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = item ? 768 : 1080;
  const pen = canvas.getContext("2d");
  if (!pen) throw new Error("Canvas is unavailable.");
  if (item) drawSticker(pen, item, drawIcon);
  else drawProgress(pen, snapshot, drawIcon);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image unavailable.")), "image/png");
  });
}

export function bindScorecard(dialog, getSnapshot, drawIcon) {
  const find = selector => dialog.querySelector(selector);
  const picker = find("#sticker-item");
  const stickerField = find("#sticker-field");
  const proof = find("#scorecard-image");
  const status = find("#scorecard-status");
  const download = find("#download-game-image");
  const share = find("#share-game-image");
  const shareOnX = find("#share-on-x");
  const copy = find("#copy-game-image");
  const linkFallback = find("#game-link-fallback");
  const scorecardMode = find('[value="scorecard"]');
  const stickerMode = find('[value="sticker"]');
  let snapshot;
  let opener;
  let file;
  let imageUrl;
  let social;
  let generation = 0;

  function clearImage() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = undefined;
    file = undefined;
    proof.hidden = true;
    proof.removeAttribute("src");
    download.hidden = true;
    download.removeAttribute("href");
    shareOnX.hidden = true;
    shareOnX.removeAttribute("href");
    share.hidden = true;
    copy.hidden = true;
  }

  async function refresh() {
    const generationAtStart = ++generation;
    const item = stickerMode.checked ? snapshot.items.find(entry => entry.collected && entry.id === picker.value) : null;
    stickerField.hidden = !stickerMode.checked;
    dialog.dataset.kind = item ? "sticker" : "scorecard";
    status.textContent = "Printing…";
    clearImage();
    const { count, moves, overPar } = summarize(snapshot);
    const report = `${count}/${snapshot.rooms.length} rooms cleared in ${moves} stumbles${overPar ? `, ${overPar} over par` : ", on par"}.`;
    social = createSocialShare(item ? `${item.name} from Mario’s menu.` : `Meet Mario. ${report}`, gameUrl);
    shareOnX.href = social.xUrl;
    shareOnX.hidden = false;

    try {
      const blob = await renderImage(snapshot, item, drawIcon);
      if (!dialog.open || generation !== generationAtStart) return;
      const name = item ? `meet-mario-${item.id}.png` : "meet-mario-scorecard.png";
      file = new File([blob], name, { type: "image/png" });
      imageUrl = URL.createObjectURL(blob);
      proof.src = imageUrl;
      proof.alt = item ? `Menu sticker: ${item.name}. ${item.blurb}` : `Meet Mario scorecard. ${report}`;
      proof.hidden = false;
      download.href = imageUrl;
      download.download = name;
      download.hidden = false;
      share.hidden = !(navigator.share && navigator.canShare?.({ files: [file] }));
      copy.hidden = !(navigator.clipboard?.write && typeof ClipboardItem === "function");
      status.textContent = "";
    } catch {
      if (dialog.open && generation === generationAtStart) status.textContent = "Couldn’t print this image. Close the scorecard and try again.";
    }
  }

  for (const trigger of document.querySelectorAll("[data-open-scorecard]")) {
    trigger.addEventListener("click", () => {
      snapshot = getSnapshot();
      if (!snapshot.items.some(item => item.collected)) return;
      picker.replaceChildren(...snapshot.items.filter(item => item.collected).map(item => new Option(item.name, item.id)));
      scorecardMode.checked = true;
      linkFallback.hidden = true;
      opener = trigger;
      dialog.showModal();
      refresh();
    });
  }

  for (const input of [scorecardMode, stickerMode, picker]) input.addEventListener("change", refresh);

  share.addEventListener("click", async () => {
    if (!file) return;
    const current = generation;
    try {
      await navigator.share({ files: [file], text: social.text, url: social.url });
    } catch (error) {
      if (dialog.open && current === generation && error.name !== "AbortError") status.textContent = "Download the PNG to post it.";
    }
  });

  copy.addEventListener("click", async () => {
    if (!file) return;
    const current = generation;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": file })]);
      if (dialog.open && current === generation) status.textContent = "Image copied.";
    } catch {
      if (dialog.open && current === generation) status.textContent = "Download the PNG to post it.";
    }
  });

  find("#copy-game-link").addEventListener("click", async () => {
    const current = generation;
    try {
      await navigator.clipboard.writeText(gameUrl);
      if (dialog.open && current === generation) status.textContent = "Game link copied.";
    } catch {
      if (!dialog.open || current !== generation) return;
      linkFallback.value = gameUrl;
      linkFallback.hidden = false;
      linkFallback.select();
    }
  });

  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    generation++;
    clearImage();
    opener?.focus({ preventScroll: true });
  });
}
