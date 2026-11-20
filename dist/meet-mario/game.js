import { bindScorecard } from "./scorecard.mjs";

const layouts = [
  {
    name: "The Front Room", palette: "plum", grace: 10,
    items: ["snow", "smile", "plant"],
    rows: [
      "#############",
      "#...........#",
      "#..=====....#",
      "#.o....2o...#",
      "#...........#",
      "#1..........#",
      "#.....=====.#",
      "#..o........#",
      "#...3o...o..#",
      "#S..........#",
      "#############",
    ],
  },
  {
    name: "Coat Check", palette: "violet", grace: 8,
    items: ["snow", "plant", "stamp", "smile"],
    rows: [
      "#############",
      "#...#...3...#",
      "#.2o#.......#",
      "#...#.o..o..#",
      "#...#....##.#",
      "#...#...=...#",
      "#..o..4.=...#",
      "#.....o.=.o.#",
      "#..o....=...#",
      "#S...1..=...#",
      "#############",
    ],
  },
  {
    name: "The Side Bar", palette: "teal", grace: 4,
    items: ["snow", "plant", "smile", "cap"],
    rules: [
      { order: ["snow", "smile"], line: "Snow first. Your photo looks better with a little weather." },
    ],
    rows: [
      "#############",
      "#...........#",
      "#..o..o..=..#",
      "#.2.....1=..#",
      "#=====...=.o#",
      "#...........#",
      "#.#...======#",
      "#.#....o.4..#",
      "#.#o....o...#",
      "#S.3........#",
      "#############",
    ],
  },
  {
    name: "High Tops", palette: "rose", grace: 3,
    items: ["plant", "snow", "horse", "cap", "stamp"],
    rules: [
      { order: ["cap", "horse"], consecutive: true, line: "Hat, then horse. It’s a two-piece outfit." },
      { order: ["plant", "stamp"], line: "The plant mailed itself an invitation." },
    ],
    rows: [
      "#############",
      "#.........4.#",
      "#....#.oo...#",
      "#..oo#..o...#",
      "#.oo1...o...#",
      "#.2.#####...#",
      "#.........oo#",
      "#.oo5.oo..o.#",
      "#.....o...3.#",
      "#S..........#",
      "#############",
    ],
  },
  {
    name: "The Back Hall", palette: "violet", grace: 3,
    items: ["snow", "plant", "horse", "cap", "rock"],
    rules: [
      { order: ["snow", "horse"], consecutive: true, line: "The horse expects to step straight onto a white carpet." },
      { order: ["plant", "rock"], line: "The plant insists on authenticating the moon rock." },
    ],
    rows: [
      "#############",
      "#..=2....=..#",
      "#..=.....=..#",
      "#..=...o.=..#",
      "#.o=..#.5=..#",
      "#..=..#..=.o#",
      "#..=.o#..=4.#",
      "#..3..#o..o.#",
      "#.....#.o...#",
      "#S....#....1#",
      "#############",
    ],
  },
  {
    name: "The Green Room", palette: "teal", grace: 3,
    items: ["plant", "cap", "smile", "stamp", "mirror", "eye"],
    rules: [
      { order: ["smile", "mirror", "stamp"], consecutive: true, line: "Smile, take the picture, mail it. The post office is closing." },
      { order: ["plant", "eye"], line: "The eye refuses to open until there’s greenery." },
    ],
    rows: [
      "#############",
      "#........5..#",
      "#..o..6...o.#",
      "#...======..#",
      "#.o.#...1#.2#",
      "#...#.oo.#.o#",
      "#.o.#....#..#",
      "#...==..==..#",
      "#......o..4.#",
      "#S....3.....#",
      "#############",
    ],
  },
  {
    name: "Split Tab", palette: "plum", grace: 2,
    items: ["horse", "snow", "smile", "cap", "rock", "stamp"],
    rules: [
      { order: ["horse", "rock"], consecutive: true, line: "The horse’s +1 is a rock. Keep them together." },
      { order: ["cap", "smile"], consecutive: true, line: "Hat, then smile. One photo and you’re out." },
      { order: ["snow", "stamp"], line: "The stamp is waiting for a snow day." },
    ],
    rows: [
      "#############",
      "#.....#.....#",
      "#...o.#4.oo.#",
      "#.....#.o...#",
      "#.===......1#",
      "#...6.#.....#",
      "#53...#.====#",
      "#.oo..#.....#",
      "#...o.#...o.#",
      "#S....#....2#",
      "#############",
    ],
  },
  {
    name: "The Long Bar", palette: "rose", grace: 2,
    items: ["plant", "cap", "mirror", "smile", "eye", "horse", "stamp"],
    rules: [
      { order: ["plant", "horse", "stamp"], consecutive: true, line: "Plant rides sidesaddle. The horse is apparently a mail carrier." },
      { order: ["mirror", "eye"], consecutive: true, line: "Mirror ball first. The eye is very particular about lighting." },
    ],
    rows: [
      "#############",
      "#..2..5..=..#",
      "#.o....o7=1.#",
      "#.....o..=..#",
      "#...........#",
      "#.=========.#",
      "#..........3#",
      "#.o.#6..o..o#",
      "#...#.o..4o.#",
      "#S..#.......#",
      "#############",
    ],
  },
  {
    name: "Afterparty Annex", palette: "teal", grace: 2,
    items: ["snow", "horse", "plant", "cap", "rock", "mirror", "smile"],
    rules: [
      { order: ["plant", "horse"], consecutive: true, line: "The horse has a strict garnish rider." },
      { order: ["cap", "mirror", "smile"], consecutive: true, line: "Hat, mirror, smile. It looks better on the badge that way." },
      { order: ["snow", "cap"], line: "Indoor weather comes before indoor hats." },
    ],
    rows: [
      "#############",
      "#...#.7.....#",
      "#...#.===...#",
      "#5..#.......#",
      "#...#====.o.#",
      "#.o...o.#..1#",
      "#......6#.o.#",
      "#.o..####...#",
      "#...#..4.o..#",
      "#S.3.....2..#",
      "#############",
    ],
  },
  {
    name: "Last Call", palette: "violet", grace: 2,
    items: ["snow", "horse", "plant", "cap", "smile", "stamp", "eye"],
    rules: [
      { order: ["snow", "horse"], consecutive: true, line: "Straight from the forecast to the horse." },
      { order: ["stamp", "eye"], consecutive: true, line: "Mail first. It likes to watch you open it." },
      { order: ["plant", "cap", "smile"], line: "Water the plant. Tip your hat. Smile like you meant it." },
    ],
    rows: [
      "#############",
      "#....#4.2.6.#",
      "#.o3.#..o...#",
      "#.=========.#",
      "#.....#.....#",
      "#..o.1#..o..#",
      "#.5......o..#",
      "#.=========.#",
      "#.......#...#",
      "#So....7#...#",
      "#############",
    ],
  },
];

const directions = {
  up: [0, -1],
  left: [-1, 0],
  down: [0, 1],
  right: [1, 0],
};
const keyDirections = new Map([
  ["arrowup", "up"], ["w", "up"],
  ["arrowleft", "left"], ["a", "left"],
  ["arrowdown", "down"], ["s", "down"],
  ["arrowright", "right"], ["d", "right"],
]);
const menu = [
  {
    id: "snow", name: "Snow", color: "#a6e6ff", shade: "#6796df",
    blurb: "Forecast says indoors.",
    scene: "For a second, the snow is falling up.",
  },
  {
    id: "horse", name: "Horse", color: "#ffcc8b", shade: "#c47663",
    blurb: "Mario says it’s a miniature.",
    scene: "The floorboards are doing a little trot.",
  },
  {
    id: "plant", name: "House Plant", color: "#76f5ad", shade: "#53a361",
    blurb: "It hasn’t asked for water once.",
    scene: "The plant turns to look at you.",
  },
  {
    id: "cap", name: "Wild Cap", color: "#ff8d9e", shade: "#b84369",
    blurb: "Mario found it under a high top.",
    scene: "All the tables look a foot taller.",
  },
  {
    id: "rock", name: "Moon Rock", color: "#ffdc78", shade: "#be835a",
    blurb: "Locally sourced, according to the moon.",
    scene: "Your shoes aren’t making much contact.",
  },
  {
    id: "mirror", name: "Mirror Ball", color: "#d8adff", shade: "#8977db",
    blurb: "The DJ swears no one will miss it.",
    scene: "For a moment, there are two dance floors.",
  },
  {
    id: "eye", name: "Red Eye", color: "#ff9cb5", shade: "#c44768",
    blurb: "It blinks first.",
    scene: "The room closes one eye.",
  },
  {
    id: "smile", name: "Happy Face", color: "#ffe377", shade: "#d68c49",
    blurb: "It’s smiling through the wrapper.",
    scene: "Everybody starts to look familiar.",
  },
  {
    id: "stamp", name: "Postage Stamp", color: "#b8c0ff", shade: "#7658be",
    blurb: "The return address just says “here.”",
    scene: "The wallpaper starts to look like a map.",
  },
];
const solid = new Set(["#", "=", "o"]);
const storageKey = "meet-mario-relay-v2";

function walkable(rows, x, y) {
  const tile = rows[y]?.[x];
  return tile !== undefined && !solid.has(tile);
}

function requiredNext(level, collected) {
  for (const chain of level.relays) {
    if (!(collected & chain[0].bit)) continue;
    const next = chain.find((item) => !(collected & item.bit));
    if (next) return next;
  }
  return null;
}

function canCollect(item, collected, next) {
  return (!next || next === item) && (collected & item.requires) === item.requires;
}

function findPar(level) {
  const { rows, start, pickups, fullMenu } = level;
  const queue = [{ ...start, collected: 0, moves: 0 }];
  const visited = new Set([`${start.x},${start.y},0`]);

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (current.collected === fullMenu) return current.moves;
    const next = requiredNext(level, current.collected);

    for (const [dx, dy] of Object.values(directions)) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (!walkable(rows, x, y)) continue;
      const item = pickups.get(rows[y][x]);
      const collected = item && canCollect(item, current.collected, next)
        ? current.collected | item.bit
        : current.collected;
      const key = `${x},${y},${collected}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ x, y, collected, moves: current.moves + 1 });
    }
  }
  throw new Error(`No route through ${level.name}`);
}

const menuById = new Map(menu.map((item) => [item.id, item]));
const levels = layouts.map(({ name, rows, palette, items, rules = [], grace }) => {
  const positions = new Map();
  rows.forEach((row, y) => {
    [...row].forEach((tile, x) => {
      if (tile === "S" || (tile >= "1" && tile <= "7")) positions.set(tile, { x, y });
    });
  });
  const pickups = new Map(items.map((id, index) => [
    String(index + 1), { ...menuById.get(id), ...positions.get(String(index + 1)), bit: 1 << index, requires: 0 },
  ]));
  const itemById = new Map([...pickups.values()].map((item) => [item.id, item]));
  const relays = [];
  for (const rule of rules) {
    const chain = rule.order.map((id) => itemById.get(id));
    for (let index = 1; index < chain.length; index++) {
      chain[index].requires |= chain[index - 1].bit;
    }
    if (rule.consecutive) relays.push(chain);
  }
  const level = { name, rows, palette, rules, relays, start: positions.get("S"), pickups, fullMenu: (1 << pickups.size) - 1 };
  const par = findPar(level);
  return { ...level, par, limit: par + grace };
});

function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved?.best)) {
      const best = [];
      for (const level of levels) {
        const score = saved.best[best.length];
        if (!Number.isSafeInteger(score) || score < level.par || score > level.limit) break;
        best.push(score);
      }
      const unlocked = Math.min(best.length, levels.length - 1);
      const active = Number.isSafeInteger(saved.active)
        ? Math.min(Math.max(saved.active, 0), unlocked)
        : unlocked;
      return { best, active };
    }
  } catch {
    // The campaign remains playable when storage is unavailable.
  }
  return { best: [], active: 0 };
}

const progress = readProgress();
const $ = (selector) => document.querySelector(selector);
const game = $(".game");
const venueSignal = $(".venue-signal");
const signalStrands = [...venueSignal.querySelectorAll("path")];
const board = $("#board");
const context = board.getContext("2d");
const background = document.createElement("canvas");
const base = background.getContext("2d");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const floor = $(".floor");
const objective = $("#objective");
const moveCount = $(".move-count");
const movesLabel = $("#moves");
const limitLabel = $("#limit");
const parLabel = $("#par");
const houseOrder = $("#house-order");
const orderLines = $("#order-lines");
const relayNext = $("#relay-next");
const menuNotes = $("#menu-notes");
const menuCount = $("#menu-count");
const pickupCount = $("#pickup-count");
const sceneSpeaker = $("#scene-speaker");
const statusLabel = $("#message");
const narration = $("#narration");
const tabStatus = $("#tab-state");
const resetButton = $("#reset");
const finish = $("#finish");
const finishTitle = $("#finish-title");
const finishKicker = $(".finish-kicker");
const finishScore = $("#finish-score");
const finishNote = $("#finish-note");
const finishShare = $("#finish-share");
const roomsShare = $("#rooms-share");
const scorecardDialog = $("#scorecard-dialog");
const nextButton = $("#next");
const replayButton = $("#again");
const moveButtons = [...document.querySelectorAll("[data-move]")];
const menuList = $(".items");
const levelCount = $(".level-count");
const roomName = $(".room-name");
const levelGrid = $(".level-buttons");
const levelButtons = levels.map((_, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = String(index + 1).padStart(2, "0");
  button.addEventListener("click", () => startLevel(index, true));
  levelGrid.append(button);
  return button;
});
nextButton.addEventListener("click", () => startLevel(progress.active + 1, true));

let run;
let animationFrame = 0;
let lastRepeat = -Infinity;

// Canvas artwork uses a 24-pixel tile grid and integer coordinates.
const tileSize = 24;
const ink = "#160f22";
const blackoutDuration = 1430;
const blackoutInk = "#070510";
const palettes = {
  plum: { floor: ["#392841", "#413049"], wall: "#69517e", rail: "#a67dad", timber: "#92565a", trim: "#d08669" },
  violet: { floor: ["#302942", "#38304b"], wall: "#554986", rail: "#947be4", timber: "#725181", trim: "#b47ac8" },
  teal: { floor: ["#26373e", "#2b3e46"], wall: "#3e6a73", rail: "#7ca8a3", timber: "#555b78", trim: "#9b86b5" },
  rose: { floor: ["#3c293d", "#453044"], wall: "#814d72", rail: "#b8759b", timber: "#82505d", trim: "#d38d73" },
};

function rect(pen, color, x, y, width, height) {
  pen.fillStyle = color;
  pen.fillRect(x, y, width, height);
}

function sprite(pen, art, colors, left, top) {
  for (let y = 0; y < art.length; y++) {
    const row = art[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== ".") rect(pen, colors[row[x]], left + x, top + y, 1, 1);
    }
  }
}

const coat = [
  ".....dddddd.....",
  "....dvvvvvvd....",
  "...dvvlllkvkd...",
  "...dvvvkksskd...",
  "....dkkssdsd....",
  "....dksssssd....",
  ".....dssssd.....",
  "...ddmddddmdd...",
  "..dmttmhhmttmd..",
  "..dmttmhhmmtmd..",
  "..dmttmtmmtmmd..",
  "..dsdtmmmttdsd..",
  "...ddtmmmmdd....",
  "....dddddwd.....",
  "....dwwdwwd.....",
  "....dwwdwwd.....",
  "...ddwkdkwwd....",
  "...dddd.dddd...",
];
const coatColors = {
  d: "#1a1023", v: "#bf61ad", l: "#f7a0d4", k: "#713f79", s: "#edaa78",
  m: "#3cba8b", t: "#a5fbd1", h: "#f6edc9", w: "#4f3a72",
};
const icons = {
  snow: [
    "......cc......",
    "...h..ch..c...",
    "....h.ch.c....",
    "..h..hchc..c..",
    "...h..hc..c...",
    ".c..hchccc..a.",
    "hhhhhhcchccccc",
    "cchccccchcaaaa",
    "..c..achca..a.",
    "...c..ch..a...",
    "..c..cccaa..a.",
    "....c.ac.a....",
    "...c..ac..a...",
    "......ac......",
  ],
  horse: [
    "......k...k...",
    ".....kck.kck..",
    ".....kcckcck..",
    "...kakccccck..",
    "..kakcckhck...",
    "..kakcccack...",
    ".kakcccccck...",
    ".kakccccccck..",
    "kakkcccccakck.",
    "kakccccaaccck.",
    "kakkcccakack..",
    "kkkkcac..kk...",
    "...kaak.......",
    "...kkk........",
  ],
  plant: [
    ".......hka....",
    "...ck.hcaa.kc.",
    "..kcckhcackck.",
    ".kccchccaccck.",
    "..kccacchcck..",
    "...kccchcck...",
    ".kcccccccccak.",
    "..kkcchccakk..",
    "......ca......",
    "...kaaaaaak...",
    "..khhaaaaaak..",
    "...khkkkkak...",
    "...kaaaaak....",
    "....kkkkk.....",
  ],
  cap: [
    ".....kkkk.....",
    "...kkccchkk...",
    "..kcccchhcck..",
    ".kchccccccck..",
    ".khhccchccck..",
    "kcccchcccaack.",
    "kccchccaaaaack",
    ".kkkkkkkkkkkk.",
    "....khaaak....",
    "....khhhak....",
    "....khhhak....",
    ".....khak.....",
    "......kk......",
  ],
  rock: [
    "..........h...",
    ".........hah..",
    "..........h...",
    ".....kkk......",
    "...kkcack.....",
    "..kccahcckk...",
    ".khhacccackk..",
    ".kccacchaakc..",
    "kaccccaaaack..",
    "kacaacccccak..",
    ".kaaaacaakk...",
    "..kkkkkkk.....",
    "...k..........",
  ],
  mirror: [
    "......kk......",
    "......ck......",
    "...kkkkkkk....",
    "..khchcachk...",
    ".kchccaccack..",
    "kccachcachaak.",
    "khcccaccaacak.",
    "kccaccachacck.",
    "kachaccaccack.",
    "kccacccaccack.",
    ".kaachacccck..",
    "..kaacccakk...",
    "...kkkkkkk....",
  ],
  eye: [
    "..............",
    "......a.......",
    "......a..a....",
    ".....kkk......",
    "...kkhhckk....",
    "..khhaccchkk..",
    ".khhackachhhk.",
    "khhhhkkachhhhk",
    ".kchhacaahhck.",
    "..kchahahhkk..",
    "...kkhchkk....",
    ".....kkk......",
    "..............",
  ],
  smile: [
    "....kkkkkk....",
    "..kkhccaaakk..",
    ".khhhcccccaak.",
    ".khccccccccak.",
    "khccccccccccak",
    "khcckkcckkccak",
    "khcckkcckkccak",
    "kcccccccccccak",
    "kcckccccckcaak",
    ".kcckkkkkcaak.",
    ".kccccccccakk.",
    "..kkaaaaakkk..",
    "....kkkkkk....",
  ],
  stamp: [
    ".k.k.k.k.k.k..",
    "khkhkhkhkhkhk.",
    ".hhhhhhhhhhhk.",
    "khacaaaaaaahk.",
    ".haaahhacaahk.",
    "khachchhaachk.",
    ".haahcchaaahk.",
    "khacahhhccahk.",
    ".haccccaacahk.",
    "khaaaacaacahk.",
    ".hhhhhhhhhhhk.",
    "khkhkhkhkhkhk.",
    ".k.k.k.k.k.k..",
  ],
};

function drawMenuIcon(pen, item, left, top) {
  sprite(pen, icons[item.id], { k: ink, c: item.color, a: item.shade, h: "#fff4d9" }, left, top);
}

const marquee = [
  "x...x.xxx.x..x.x..x",
  "xx.xx.x...xx.x.x..x",
  "x.x.x.xx..x.xx.x..x",
  "x...x.x...x..x.x..x",
  "x...x.xxx.x..x.xxxx",
];

function paintRoom(level, palette) {
  const { rows } = level;
  board.width = background.width = rows[0].length * tileSize;
  board.height = background.height = rows.length * tileSize;
  const { floor: planks, wall, rail, timber, trim } = palette;
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const left = x * tileSize;
      const top = y * tileSize;
      const tile = rows[y][x];
      const grain = (x * 17 + y * 23) % 11;

      rect(base, "#2a1e34", left, top, 24, 24);
      rect(base, planks[(x + y) % 2], left, top, 23, 23);
      rect(base, "#ffffff0a", left + 1, top + 4, 21, 1);
      rect(base, "#00000022", left + 1, top + 15, 21, 1);
      rect(base, "#ffffff13", left + 5 + grain, top + 19, 4, 1);
      rect(base, "#ffffff12", left + 2, top + 2, 1, 1);

      if (tile === "#") {
        rect(base, ink, left, top, 24, 24);
        rect(base, wall, left, top, 24, 19);
        rect(base, rail, left, top + 1, 24, 2);
        rect(base, "#1a0b294a", left, top + 8, 24, 10);
        rect(base, "#1a0b294a", left, top + 7, 24, 1);
        rect(base, "#1a0b294a", left + grain, top + 4, 1, 3);
        rect(base, "#1a0b294a", left + 11, top + 8, 1, 10);
        rect(base, rail, left, top + 18, 24, 1);
        if (y === 0 && x > 0 && x < rows[y].length - 1 && x % 3 === 1) {
          rect(base, "#ffad6f22", left + 5, top + 4, 14, 14);
          rect(base, "#331f3c", left + 8, top + 7, 8, 8);
          rect(base, "#ffaf80", left + 10, top + 9, 4, 4);
          rect(base, "#fff5aa", left + 11, top + 10, 2, 2);
        }
      }

      if (tile === "=") {
        const horizontal = rows[y][x - 1] === "=" || rows[y][x + 1] === "=";
        const insetLeft = horizontal && rows[y][x - 1] === "=" ? 0 : 2;
        const insetRight = horizontal && rows[y][x + 1] === "=" ? 0 : 2;
        const insetTop = !horizontal && rows[y - 1]?.[x] === "=" ? 0 : 2;
        const insetBottom = !horizontal && rows[y + 1]?.[x] === "=" ? 0 : 3;
        const span = 24 - insetLeft - insetRight;
        const height = 24 - insetTop - insetBottom;
        rect(base, "#170e25b8", left + insetLeft, top + insetTop + 2, span, height);
        rect(base, "#543049", left + insetLeft, top + insetTop, span, height);
        rect(base, timber, left + insetLeft, top + insetTop, span, height - 5);
        rect(base, trim, left + insetLeft, top + insetTop, span, 2);
        rect(base, trim, left + 6, top + 9, 12, 1);
        rect(base, "#381c39", left + insetLeft, top + 15, span, 2);
        if ((x + 2 * y) % 3 !== 0) drawBottles(left, top, grain);
      }

      if (tile === "o") {
        rect(base, "#1d122a95", left + 2, top + 8, 20, 13);
        rect(base, ink, left + 3, top + 7, 18, 12);
        rect(base, ink, left + 5, top + 5, 14, 16);
        rect(base, timber, left + 5, top + 7, 14, 10);
        rect(base, timber, left + 7, top + 5, 10, 14);
        rect(base, trim, left + 7, top + 6, 10, 2);
        rect(base, "#53314b", left + 7, top + 16, 10, 2);
        rect(base, "#ecc389", left + 13, top + 9, 3, 4);
        rect(base, "#fff2bb", left + 13, top + 9, 3, 1);
      }
    }
  }

  const signX = Math.floor(board.width / 2) - 22;
  rect(base, "#1d122a", signX, 3, 44, 13);
  rect(base, rail, signX + 1, 4, 42, 1);
  rect(base, "#ec748b", signX + 6, 9, 2, 2);
  rect(base, "#ec748b", signX + 36, 9, 2, 2);
  sprite(base, marquee, { x: "#ffb1b6" }, signX + 12, 7);
}

function drawBottles(left, top, grain) {
  const x = left + 5 + grain;
  rect(base, "#452439", x, top + 11, 8, 3);
  rect(base, "#6dc8a5", x, top + 7, 3, 5);
  rect(base, "#a7e1b1", x + 1, top + 5, 1, 3);
  rect(base, "#e9a383", x + 5, top + 8, 2, 4);
  rect(base, "#ffd89e", x + 5, top + 8, 2, 1);
}

function drawMario(start, phase) {
  const left = (start.x - 1) * tileSize;
  const top = start.y * tileSize;
  rect(context, "#df8aff24", left + 1, top, 24, 23);
  rect(context, ink, left + 4, top + 4, 16, 15);
  rect(context, "#a968bf", left + 5, top + 5, 14, 13);
  rect(context, "#f6b0ec", left + 5, top + 5, 14, 1);
  rect(context, "#fff0da", left + 8, top + 7, 8, 8);
  rect(context, "#32233e", left + 9, top + 8, 1, 3);
  rect(context, "#32233e", left + 13, top + 8, 1, 3);
  rect(context, "#32233e", left + 11, top + 12, 2, 1);
  rect(context, "#ed7297", left + 7, top + 16, 10, 1);
  if (phase) drawSparkle(left + 19, top + 2, "#e8ade4");
}

function drawSparkle(x, y, color) {
  rect(context, color, x - 2, y, 5, 1);
  rect(context, color, x, y - 2, 1, 5);
}

function drawPickup(item, frame) {
  const left = item.x * tileSize;
  const top = item.y * tileSize;
  const drift = [0, 1, 2, 1][(frame + item.x) % 4];
  const ready = canCollect(item, run.collected, run.nextPickup);
  context.save();
  if (!ready) context.globalAlpha = 0.58;
  rect(context, `${item.color}19`, left + 1, top + 1, 22, 22);
  rect(context, "#1a122d", left + 3, top + 13, 18, 8);
  rect(context, `${item.color}9b`, left + 4, top + 16, 16, 2);
  rect(context, item.shade, left + 6, top + 19, 12, 1);
  drawMenuIcon(context, item, left + 5, top + 2 - (ready ? drift : 0));
  context.restore();
  if (ready && drift) drawSparkle(left + 19, top + 5, item.color);
  if (!ready) {
    rect(context, ink, left + 14, top + 12, 9, 10);
    rect(context, "#e9bfaa", left + 16, top + 13, 5, 4);
    rect(context, ink, left + 17, top + 14, 3, 3);
    rect(context, "#ffe0ab", left + 15, top + 16, 7, 5);
    rect(context, ink, left + 18, top + 17, 1, 2);
  }
}

function drawRoomEcho(time) {
  if (run.count === 0 || reducedMotion.matches || run.result) return;
  const strength = Math.min(3, run.count);
  const offset = Math.round(Math.sin(time / 590) * strength);
  context.globalAlpha = 0.1 + strength * 0.033;
  const width = board.width - 2 * tileSize;
  context.drawImage(background, tileSize, 0, width, tileSize, tileSize + offset, 0, width, tileSize);
  const bottom = board.height - tileSize;
  context.drawImage(background, tileSize, bottom, width, tileSize, tileSize - offset, bottom, width, tileSize);
  context.globalAlpha = 1;
}

function traceIris(x, y, radiusX, radiusY) {
  const height = Math.max(1, Math.ceil(radiusY));
  context.beginPath();
  for (let row = -height; row < height; row += 3) {
    const edge = Math.min(1, Math.abs(row + 1.5) / height);
    const span = Math.max(1, Math.round(radiusX * Math.sqrt(1 - edge ** 2)));
    context.rect(x - span, y + row, span * 2, 3);
  }
}

function drawBlackout(elapsed) {
  const x = run.x * tileSize + tileSize / 2;
  const y = run.y * tileSize + tileSize / 2;
  const phase = Math.max(0, Math.min(1, (elapsed - 130) / 960));
  const remaining = 1 - phase * phase * (3 - 2 * phase);
  rect(context, blackoutInk, 0, 0, board.width, board.height);

  if (phase === 1) {
    const signal = Math.max(0, 1 - (elapsed - 1090) / 160);
    if (signal > 0) {
      const width = Math.max(2, Math.floor(54 * signal ** 2));
      rect(context, "#895acf80", x - width - 3, y - 2, 2 * width + 6, 5);
      rect(context, "#9efbd8", x - width, y, 2 * width, 1);
      rect(context, "#faebff", x - 1, y - 1, 3, 3);
    }
    return;
  }

  const radiusX = Math.max(x, board.width - x) * 1.48 * remaining;
  const radiusY = Math.max(y, board.height - y) * 1.48 * remaining ** 1.42;
  const roll = Math.sin(phase * Math.PI) * 0.16;
  traceIris(x - 6, y + 2, radiusX + 6, radiusY + 6);
  context.fillStyle = "#b260de";
  context.fill();
  traceIris(x + 5, y - 1, radiusX + 4, radiusY + 3);
  context.fillStyle = "#50baaf";
  context.fill();
  traceIris(x, y, radiusX, radiusY);
  context.save();
  context.clip();
  context.translate(x, y);
  context.rotate(roll);
  context.scale(1 + 0.19 * phase, 1 + 0.12 * phase);
  context.translate(-x, -y);
  context.drawImage(background, 0, 0);
  rect(context, "#38174a60", 0, 0, board.width, board.height);
  sprite(context, coat, coatColors, x - 8, y - 10);

  // The menu spins out of the player's last tile as the CRT aperture closes.
  const time = Math.min(1, elapsed / 1050);
  const orbit = (10 + 76 * Math.sin(time * Math.PI)) * remaining;
  context.globalAlpha = Math.min(0.92, elapsed / 170) * remaining ** 0.38;
  let index = 0;
  for (const item of run.level.pickups.values()) {
    const angle = index++ * 2 * Math.PI / run.level.pickups.size - Math.PI / 2 + 2.2 * time;
    const left = Math.round(x + Math.cos(angle) * orbit) - 7;
    const top = Math.round(y + Math.sin(angle) * orbit * 0.68) - 7;
    drawSparkle(left + 17, top + 4, item.color);
    drawMenuIcon(context, item, left, top);
  }
  context.restore();
}

function render(time) {
  if (run.blackoutAt !== undefined) {
    const elapsed = Math.max(0, time - run.blackoutAt);
    if (!reducedMotion.matches && elapsed < blackoutDuration) {
      drawBlackout(elapsed);
      animationFrame = requestAnimationFrame(render);
    } else {
      rect(context, blackoutInk, 0, 0, board.width, board.height);
      if (finish.hidden) revealResult();
    }
    return;
  }

  const now = reducedMotion.matches ? 0 : time;
  const frame = Math.floor(now / 210);
  context.drawImage(background, 0, 0);
  drawRoomEcho(now);
  drawMario(run.level.start, frame % 2);
  for (const item of run.level.pickups.values()) {
    if (!(run.collected & item.bit)) drawPickup(item, frame);
  }

  const { x, y, from, stepAt, pickup } = run;
  const sliding = from && !run.result && !reducedMotion.matches;
  const step = sliding ? Math.max(0, Math.min(1, (time - stepAt) / 80)) : 1;
  const left = Math.round((from ? from.x + (x - from.x) * step : x) * tileSize);
  const top = Math.round((from ? from.y + (y - from.y) * step : y) * tileSize);
  rect(context, "#180e26a3", left + 4, top + 18, 16, 3);
  sprite(context, coat, coatColors, left + 4, top + (step < 0.7 ? 1 : 2));

  if (pickup && !reducedMotion.matches && time - pickup.at < 390) {
    const lift = Math.floor((time - pickup.at) / 40);
    drawSparkle(pickup.x * tileSize + 18, pickup.y * tileSize + 10 - lift, pickup.color);
  }

  animationFrame = reducedMotion.matches || run.result ? 0 : requestAnimationFrame(render);
}

function redraw() {
  cancelAnimationFrame(animationFrame);
  render(performance.now());
}

function saveProgress() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // No persistence is required to play or advance.
  }
}

function updateLevelButtons() {
  roomsShare.hidden = progress.best.length === 0;
  levelButtons.forEach((button, index) => {
    const best = progress.best[index];
    button.disabled = index > progress.best.length;
    button.classList.toggle("cleared", best !== undefined);
    button.classList.toggle("on-par", best === levels[index].par);
    if (index === progress.active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");

    const label = [`Level ${index + 1}`, levels[index].name];
    if (button.disabled) label.push("locked");
    if (best !== undefined) label.push(`best ${best} stumbles, par ${levels[index].par}`);
    button.setAttribute("aria-label", label.join(", "));
    button.title = label.join(" · ");
  });
}

function printMenu(items) {
  const entries = new Map();
  menuList.replaceChildren();
  for (const item of items.values()) {
    const row = document.createElement("li");
    row.innerHTML = '<span class="item-badge" aria-hidden="true"><canvas class="item-icon" width="16" height="16"></canvas></span><span class="item-copy"><strong></strong><small></small><span class="visually-hidden item-state">, on the table</span></span>';
    row.querySelector("strong").textContent = item.name;
    row.querySelector("small").textContent = item.blurb;
    drawMenuIcon(row.querySelector(".item-icon").getContext("2d"), item, 1, 1);
    menuList.append(row);
    entries.set(item.id, row);
  }
  return entries;
}

function printHouseOrder(rules) {
  orderLines.replaceChildren();
  menuNotes.replaceChildren();
  for (const rule of rules) {
    const chain = document.createElement("li");
    if (rule.consecutive) chain.className = "relay-order";
    chain.textContent = rule.order.map((id) => menuById.get(id).name).join(" → ");
    const kind = document.createElement("span");
    kind.className = "order-kind";
    kind.textContent = rule.consecutive ? "Back to back" : "In this order";
    chain.append(" ", kind);
    orderLines.append(chain);
    const note = document.createElement("li");
    note.textContent = rule.line;
    menuNotes.append(note);
  }
  houseOrder.hidden = menuNotes.hidden = rules.length === 0;
}

function waitingFor(item) {
  if (run.nextPickup && item !== run.nextPickup) return run.nextPickup.name;
  return [...run.level.pickups.values()]
    .filter((earlier) => item.requires & earlier.bit & ~run.collected)
    .map((earlier) => earlier.name).join(" and ");
}

function updateInventory() {
  const total = run.level.pickups.size;
  menuCount.textContent = `${run.count} / ${total}`;
  pickupCount.textContent = `${run.count}/${total} picked up`;
  game.dataset.fuzz = Math.min(run.count, 3);
  tabStatus.textContent = { cleared: "Nothing to declare", cutoff: "Cut off" }[run.result] ?? "On the house";
  relayNext.hidden = !run.nextPickup || Boolean(run.result);
  relayNext.textContent = run.nextPickup ? `Next pickup: ${run.nextPickup.name}` : "";

  for (const item of run.level.pickups.values()) {
    const row = run.menuRows.get(item.id);
    const collected = Boolean(run.collected & item.bit);
    const held = !collected && !canCollect(item, run.collected, run.nextPickup);
    row.classList.toggle("picked-up", collected);
    row.classList.toggle("held", held);
    row.querySelector(".item-state").textContent = collected ? ", collected"
      : held ? `, waiting for ${waitingFor(item)}` : ", on the table";
  }
}

function tuneVenueSign(roomIndex) {
  const bend = roomIndex;
  venueSignal.style.setProperty("--signal-tilt", `${-5 - bend * 1.6}deg`);
  signalStrands[0].setAttribute("d", `M ${10 - bend * 0.2} 14 Q 17 ${8 - bend} 25 12 T ${44 + bend * 0.5} ${11 + bend * 0.55}`);
  signalStrands[1].setAttribute("d", `M ${15 + bend * 0.35} ${25 + bend * 0.5} Q 23 ${20 - bend * 0.55} 33 25 T ${47 - bend * 0.45} ${24 + bend * 0.45}`);
  signalStrands[2].setAttribute("d", `M ${8 - bend * 0.5} ${36 - bend * 0.35} Q 15 ${30 + bend} 22 35 T ${40 + bend * 0.3} ${35 - bend * 0.8}`);
}

function announce(message) {
  narration.textContent = message;
}

function startLevel(index, focus = false) {
  const level = levels[index];
  if (!level || index > progress.best.length) return;

  progress.active = index;
  run = { level, ...level.start, moves: 0, collected: 0, count: 0, nextPickup: null, result: null };
  run.menuRows = printMenu(level.pickups);
  printHouseOrder(level.rules);
  objective.textContent = level.relays.length
    ? "Clear the menu within the stumble limit. Finish any back-to-back chain you start."
    : level.rules.length
      ? "Clear the menu within the stumble limit. Pick up the marked items in order."
      : "Pick up everything on Mario’s menu before you run out of stumbles.";
  game.dataset.phase = "playing";
  lastRepeat = -Infinity;
  const levelLabel = `Level ${index + 1} of ${levels.length}`;
  floor.setAttribute("aria-label", `${levelLabel}. ${level.name}`);
  levelCount.textContent = `${String(index + 1).padStart(2, "0")} / ${levels.length}`;
  roomName.textContent = level.name;
  const total = level.pickups.size;
  board.setAttribute("aria-label", `${level.name}. You’re in the mint coat beside Mario’s socket in the lower left. Collect all ${total} lit items.`);
  movesLabel.textContent = "0";
  limitLabel.textContent = level.limit;
  moveCount.classList.remove("low");
  parLabel.textContent = level.par;
  tuneVenueSign(index);
  finish.hidden = true;
  moveButtons.forEach((button) => { button.disabled = false; });
  resetButton.disabled = false;
  game.style.removeProperty("--pickup-ink");
  sceneSpeaker.textContent = "Mario";
  const newRound = index > 0 && total > levels[index - 1].pickups.size;
  statusLabel.textContent = newRound
    ? `Still standing? I put ${total} out this time.`
    : `I put ${total} out for you. Look for the lit tables.`;
  paintRoom(level, palettes[level.palette]);
  updateInventory();
  updateLevelButtons();
  saveProgress();
  redraw();

  if (focus) {
    floor.focus({ preventScroll: true });
    floor.scrollIntoView({ block: "nearest" });
    announce(`${levelLabel}. ${level.name}. ${total} items. Par ${level.par}. Stumble limit ${level.limit}.`);
  }
}

function revealResult() {
  game.dataset.phase = "receipt";
  sceneSpeaker.textContent = "Mario";
  statusLabel.textContent = run.result === "cutoff" ? "Bar’s closed."
    : progress.active === levels.length - 1 ? "The sun’s already up." : "I’ll be next door.";
  finish.hidden = false;
  updateLevelButtons();
  finishTitle.focus({ preventScroll: true });
  finishTitle.scrollIntoView({ block: "nearest" });
  announce(`${finishTitle.textContent} ${finishScore.textContent}`);
}

function finishRun(item) {
  const index = progress.active;
  const last = index === levels.length - 1;
  run.result = item ? "cleared" : "cutoff";
  finishShare.hidden = !item;
  nextButton.hidden = !item || last;
  moveButtons.forEach((button) => { button.disabled = true; });
  resetButton.disabled = true;

  if (item) {
    progress.best[index] = Math.min(progress.best[index] ?? Infinity, run.moves);
    saveProgress();
    const delta = run.moves - run.level.par;
    const result = delta === 0 ? "On par." : `${delta} over par.`;
    finishKicker.textContent = last ? `Blackout receipt · All ${levels.length} rooms` : `Blackout receipt · Room ${index + 1}`;
    finishTitle.textContent = "Goodnight.";
    finishNote.textContent = item.scene;
    finishScore.textContent = `${run.moves} stumbles · Par ${run.level.par}. ${result}`;
    run.blackoutAt = performance.now();
    game.dataset.phase = "blacking-out";
  } else {
    finishKicker.textContent = "House limit";
    finishTitle.textContent = "Cut off.";
    finishNote.textContent = "Mario took your coat ticket.";
    finishScore.textContent = `${run.count}/${run.level.pickups.size} picked up in ${run.moves} stumbles · Par ${run.level.par}`;
  }

  updateInventory();
  redraw();
  if (!item) revealResult();
}

function move(direction) {
  if (run.result) return;
  const [dx, dy] = directions[direction];
  const next = { x: run.x + dx, y: run.y + dy };
  if (!walkable(run.level.rows, next.x, next.y)) {
    announce("That way is blocked.");
    return;
  }

  const stepAt = performance.now();
  Object.assign(run, { from: { x: run.x, y: run.y }, ...next, stepAt });
  movesLabel.textContent = ++run.moves;
  moveCount.classList.toggle("low", run.level.limit - run.moves <= 5);
  const item = run.level.pickups.get(run.level.rows[run.y][run.x]);
  if (item && !(run.collected & item.bit)) {
    if (canCollect(item, run.collected, run.nextPickup)) {
      run.collected |= item.bit;
      run.count++;
      run.nextPickup = requiredNext(run.level, run.collected);
      run.pickup = { ...item, at: stepAt };
      game.style.setProperty("--pickup-ink", item.color);
      sceneSpeaker.textContent = item.name;
      if (run.collected === run.level.fullMenu) {
        finishRun(item);
        return;
      }
      updateInventory();
      statusLabel.textContent = item.scene;
      const next = run.nextPickup ? ` Next pickup: ${run.nextPickup.name}.` : "";
      announce(`${item.name} picked up. ${item.scene} ${run.level.pickups.size - run.count} left.${next}`);
    } else {
      sceneSpeaker.textContent = item.name;
      statusLabel.textContent = `Mario says: ${waitingFor(item)} first.`;
      announce(`${item.name} is held. ${statusLabel.textContent}`);
    }
  }

  if (run.moves === run.level.limit) {
    finishRun();
    return;
  }
  if (reducedMotion.matches) redraw();
}

document.addEventListener("keydown", (event) => {
  if (scorecardDialog.open || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  const direction = keyDirections.get(event.key.toLowerCase());
  if (!direction) return;
  if (run.result) {
    if (game.dataset.phase === "blacking-out") event.preventDefault();
    return;
  }
  const now = performance.now();
  event.preventDefault();
  if (event.repeat && now - lastRepeat < 95) return;
  lastRepeat = now;
  move(direction);
});
moveButtons.forEach((button) => {
  button.addEventListener("click", () => move(button.dataset.move));
});
resetButton.addEventListener("click", () => startLevel(progress.active, true));
replayButton.addEventListener("click", () => startLevel(progress.active, true));
reducedMotion.addEventListener("change", redraw);
bindScorecard(scorecardDialog, () => {
  const cleared = levels.slice(0, progress.best.length);
  const collected = new Set(cleared.flatMap(level => [...level.pickups.values()].map(item => item.id)));
  return {
    rooms: levels.map((level, index) => ({ par: level.par, moves: progress.best[index] })),
    items: menu.map(item => ({ ...item, collected: collected.has(item.id) }))
  };
}, drawMenuIcon);
startLevel(progress.active);
