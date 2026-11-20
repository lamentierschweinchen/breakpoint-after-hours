import { receiptCopy } from './audit.mjs';

const formats = {
  landscape: { width: 1200, height: 630, frame: [465, 0, 735, 630], receipt: [64, 43, 1.08, -0.023] },
  story: { width: 1080, height: 1920, frame: [0, 0, 1080, 1290], receipt: [72, 958, 1.32, -0.023] }
};

const ink = '#241628';
const mint = '#c6fa83';
const paperWidth = 710;
const paperHeight = 518;
const rip = 460;
const contentLeft = 44;
const contentRight = paperWidth - contentLeft;
const contentWidth = contentRight - contentLeft;
let photoPromise;
let markPromise;

async function loadGraphic(file) {
  const image = new Image();
  image.src = new URL('./assets/' + file, import.meta.url).href;
  try {
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

async function loadPhoto() {
  for (const file of ['after-hours-hero.webp', 'after-hours.webp']) {
    const image = new Image();
    image.src = new URL('./assets/' + file, import.meta.url).href;
    try {
      await image.decode();
      return image;
    } catch {
      // The previous local photo can still supply the artwork while the hero is loading.
    }
  }
  return null;
}

function drawBackdrop(context, photo, { width, height, frame }, isStory) {
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#241335');
  background.addColorStop(1, '#100c15');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const [x, y, photoWidth, photoHeight] = frame;
  if (photo) {
    const fit = Math.max(photoWidth / photo.naturalWidth, photoHeight / photo.naturalHeight);
    const cropWidth = photoWidth / fit;
    const cropHeight = photoHeight / fit;
    const cropX = (photo.naturalWidth - cropWidth) * (isStory ? 0.73 : 0.66);
    const cropY = (photo.naturalHeight - cropHeight) * 0.52;
    context.drawImage(photo, cropX, cropY, cropWidth, cropHeight, x, y, photoWidth, photoHeight);

    const edge = isStory
      ? context.createLinearGradient(0, 520, 0, photoHeight)
      : context.createLinearGradient(x, 0, x + 400, 0);
    edge.addColorStop(0, isStory ? 'rgba(21, 12, 29, 0)' : '#1e102a');
    edge.addColorStop(1, isStory ? '#150f1c' : 'rgba(21, 12, 29, 0)');
    context.fillStyle = edge;
    context.fillRect(x, y, photoWidth, photoHeight);
  } else {
    context.strokeStyle = '#603487';
    context.lineWidth = 2;
    for (let radius = 90; radius < 510; radius += 36) {
      context.beginPath();
      context.arc(x + photoWidth * 0.66, isStory ? 545 : 300, radius, 0, Math.PI * 2);
      context.stroke();
    }
  }

  context.strokeStyle = 'rgba(222, 200, 245, 0.34)';
  context.lineWidth = 2;
  context.strokeRect(25, 25, width - 50, height - 50);
  context.fillStyle = mint;
  context.fillRect(width - 148, 25, 123, 3);
}

function traceReceipt(context) {
  const step = paperWidth / 30;
  context.beginPath();
  context.moveTo(0, 0);
  for (let tooth = 1; tooth <= 30; tooth++) {
    context.lineTo(tooth * step, tooth % 2 ? 6 : 0);
  }
  context.lineTo(paperWidth, rip - 11);
  context.arc(paperWidth, rip, 11, -Math.PI / 2, Math.PI / 2, true);
  context.lineTo(paperWidth, paperHeight);
  for (let tooth = 29; tooth >= 0; tooth--) {
    context.lineTo(tooth * step, paperHeight - (tooth % 2 ? 6 : 0));
  }
  context.lineTo(0, rip + 11);
  context.arc(0, rip, 11, Math.PI / 2, -Math.PI / 2, true);
  context.closePath();
}

function drawTicketMark(context, mark) {
  if (!mark) return;
  context.save();
  context.translate(contentRight - 35, 83);
  context.rotate(-0.17);
  context.fillStyle = '#d9eac5';
  context.beginPath();
  context.roundRect(-28, -17, 56, 34, 4);
  context.fill();
  context.drawImage(mark, -18, -7, 36, 14);
  context.restore();
}

function drawFinding(context, finding) {
  const lines = [];
  let line = '';
  for (const word of finding.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (line && context.measureText(next).width > contentWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  lines.forEach((text, i) => context.fillText(text, contentLeft, 413 + i * 30));
}

function drawOpinionStamp(context, stamp, customer) {
  context.save();
  context.translate(43, 377);
  context.rotate(-0.023);
  context.font = '28px "Archivo Black", "Arial Black", sans-serif';
  const text = stamp.toUpperCase();
  const width = context.measureText(text).width + 22;
  context.fillStyle = customer ? '#efe4f0' : '#d9eac5';
  context.fillRect(0, -25, width, 36);
  context.strokeStyle = '#785579';
  context.lineWidth = 1.6;
  context.setLineDash([5, 3]);
  context.strokeRect(0, -25, width, 36);
  context.fillStyle = '#44294b';
  context.fillText(text, 11, 1);
  context.restore();
}

function drawReceipt(context, transform, { score, opinion }, customer, mark) {
  const [x, y, scale, angle] = transform;
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.scale(scale, scale);

  const stock = context.createLinearGradient(0, 0, paperWidth, paperHeight);
  stock.addColorStop(0, '#fbf6e5');
  stock.addColorStop(1, customer ? '#efdbed' : '#e2e7d1');
  context.fillStyle = stock;
  context.shadowColor = 'rgba(8, 5, 12, 0.68)';
  context.shadowBlur = 36;
  context.shadowOffsetY = 12;
  traceReceipt(context);
  context.fill();
  context.shadowColor = 'transparent';
  context.clip();

  // A consistent fleck pattern gives the paper texture at full size without hurting thumbnail type.
  context.fillStyle = 'rgba(61, 27, 69, 0.08)';
  for (let dot = 0; dot < 5000; dot++) {
    const dotX = (dot * 311.37) % paperWidth;
    const dotY = (dot * 127.31 + Math.floor(dot / 39) * 11) % paperHeight;
    context.fillRect(dotX, dotY, dot % 13 ? 1 : 1.8, 1);
  }

  context.fillStyle = ink;
  context.font = '46px "Archivo Black", "Arial Black", sans-serif';
  const [firstWord, ...rest] = receiptCopy.title.toUpperCase().split(' ');
  context.fillText(firstWord, 42, 76);
  context.fillText(rest.join(' '), 42, 120);
  drawTicketMark(context, mark);
  context.font = '850 19px "DM Sans", system-ui, sans-serif';
  context.fillText(receiptCopy.subtitle.toUpperCase(), 44, 153);

  context.strokeStyle = 'rgba(36, 22, 40, 0.28)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(42, 168);
  context.lineTo(contentRight, 168);
  context.stroke();

  context.fillStyle = ink;
  context.font = '850 21px "DM Sans", system-ui, sans-serif';
  context.letterSpacing = '2px';
  context.fillText(receiptCopy.score.toUpperCase(), 44, 199);
  context.letterSpacing = '0px';

  const total = String(score);
  const denominator = '/ 100';
  const numberFont = '"Archivo Black", "Arial Black", sans-serif';
  const denominatorFont = '850 46px "DM Sans", system-ui, sans-serif';
  context.font = denominatorFont;
  const denominatorWidth = context.measureText(denominator).width;
  const scoreWidth = contentWidth - denominatorWidth - 14;
  context.font = '169px ' + numberFont;
  const fontSize = Math.min(169, 169 * scoreWidth / context.measureText(total).width);
  context.font = fontSize + 'px ' + numberFont;
  context.letterSpacing = '-10px';
  context.fillText(total, 37, 320);
  const totalWidth = context.measureText(total).width;
  context.letterSpacing = '0px';
  context.font = denominatorFont;
  context.fillText(denominator, 49 + totalWidth, 316);

  context.font = '850 18px "DM Sans", system-ui, sans-serif';
  context.fillText(receiptCopy.opinion.toUpperCase(), 44, 345);
  drawOpinionStamp(context, opinion.stamp, customer);
  context.font = '650 28px "DM Sans", system-ui, sans-serif';
  drawFinding(context, opinion.finding);

  context.strokeStyle = 'rgba(36, 22, 40, 0.35)';
  context.setLineDash([8, 7]);
  context.beginPath();
  context.moveTo(21, rip);
  context.lineTo(paperWidth - 21, rip);
  context.stroke();
  context.setLineDash([]);

  context.font = '800 25px "DM Sans", system-ui, sans-serif';
  if (customer) {
    context.fillText('Customer copy.', 44, 494);
    context.textAlign = 'right';
    context.font = '800 18px "DM Sans", system-ui, sans-serif';
    context.fillText(receiptCopy.hostname, contentRight, 494);
  } else context.fillText(receiptCopy.hostname, 44, 494);
  context.restore();
}

export async function createScoreImage(receipt, format = 'landscape', { customer = false } = {}) {
  const isStory = format === 'story';
  const layout = isStory ? formats.story : formats.landscape;
  const [photo, mark] = await Promise.all([
    photoPromise ??= loadPhoto(),
    markPromise ??= loadGraphic('moustache-mark.png'),
    Promise.allSettled([
      document.fonts?.load('169px "Archivo Black"'),
      document.fonts?.load('850 46px "DM Sans"')
    ])
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');

  drawBackdrop(context, photo, layout, isStory);
  drawReceipt(context, layout.receipt, receipt, customer, mark);

  return new Promise((resolve, reject) => {
    canvas.toBlob(image => {
      if (image) resolve(image);
      else reject(new Error('The score image could not be encoded.'));
    }, 'image/png');
  });
}

