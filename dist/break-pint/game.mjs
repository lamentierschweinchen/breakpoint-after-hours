import * as T from "./vendor/three.module.js";
import { COURSE_LENGTH, FULL_FILL_HEIGHT, STEP_SECONDS, TRACK_EDGE, createRun, hazardX, stepRun } from "./physics.mjs";
import { buildPub, createHazard, updateHazard } from "./pub.mjs";
import { loadPintBadge, makePint, makeSpills } from "./pint.mjs";
import { renderScorecard } from "./scorecard.mjs";
import { createSocialShare } from "../social.mjs";

const $ = (id) => document.getElementById(id);
const cabinet = $("cabinet");
const gameUrl = "https://breakpoint.beer/break-pint/";
const canvas = $("world");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const blend = (a, b, t) => a + (b - a) * t;
const ease = (t) => T.MathUtils.smoothstep(t, 0, 1);
const pintPercent = (fill) => fill === 1 ? 100 : Math.min(99, Math.round(fill * 100));

function localRead(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function localSave(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Storage may be disabled. */ }
}

function reflections() {
  const atlas = document.createElement("canvas");
  atlas.width = 512;
  atlas.height = 256;
  const pen = atlas.getContext("2d");
  pen.fillStyle = "#22182c";
  pen.fillRect(0, 0, 512, 256);
  for (const [x, y, w, h, color] of [
    [19, 57, 95, 14, "#e1bbff"], [177, 56, 7, 90, "#fff0d0"],
    [285, 73, 90, 8, "#4dffbc"], [430, 73, 19, 82, "#ce92ff"], [81, 114, 35, 20, "#ffb076"],
  ]) {
    pen.shadowColor = color;
    pen.shadowBlur = 14;
    pen.fillStyle = color;
    pen.fillRect(x, y, w, h);
  }
  const reflection = new T.CanvasTexture(atlas);
  reflection.mapping = T.EquirectangularReflectionMapping;
  reflection.colorSpace = T.SRGBColorSpace;
  return reflection;
}

function initialize() {
  const renderer = new T.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: "high-performance",
  });
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.20;

  const scene = new T.Scene();
  scene.background = new T.Color(0x130d1c);
  scene.fog = new T.FogExp2(0x160d22, .041);
  scene.environment = reflections();
  scene.environmentIntensity = .82;

  const ambient = new T.HemisphereLight(0xd9d1ff, 0x48304a, 1.85);
  const key = new T.DirectionalLight(0xffe4bc, 2.55);
  const edge = new T.DirectionalLight(0xbb92ff, 1.63);
  const practical = new T.PointLight(0x2bffa6, 15, 8, 2);
  key.position.set(-3.2, 6.2, 4.9);
  edge.position.set(3.9, 3.3, -4.0);
  practical.position.set(2.1, 2.8, -2.3);
  scene.add(ambient, key, edge, practical);
  buildPub(scene, { length: COURSE_LENGTH, reducedMotion: reduced });

  const camera = new T.PerspectiveCamera(39, 1, .12, 66);
  const { tray, glass, fill: drawPint } = makePint(scene);
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  const pen = shadowCanvas.getContext("2d");
  const opacity = pen.createRadialGradient(32, 32, 6, 32, 32, 32);
  opacity.addColorStop(0, "#000b");
  opacity.addColorStop(.65, "#0006");
  opacity.addColorStop(1, "#0000");
  pen.fillStyle = opacity;
  pen.fillRect(0, 0, 64, 64);
  const shadow = new T.Mesh(
    new T.PlaneGeometry(2.35, 2.35),
    new T.MeshBasicMaterial({ map: new T.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const contact = new T.Mesh(
    new T.RingGeometry(.86, 1, 48).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({
      color: 0xffc781, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
    }),
  );
  contact.visible = false;
  scene.add(contact);

  const spills = makeSpills(scene, reduced);
  let width = 1;
  let height = 1;
  let portrait = false;
  let mode = "title";
  let run = createRun();
  const props = run.hazards.map((hazard) => {
    const prop = createHazard(hazard);
    scene.add(prop);
    return prop;
  });
  let target = 0;
  let drag = null;
  const keys = new Set();
  let previousTime = 0;
  let accum = 0;
  let incidentTime = 0;
  let spillClock = 0;
  let spillAmount = 0;
  let particlesPending = 0;
  let bumpMark = null;
  let endClock = 0;
  let scorecard = null;
  let scoreShare = null;
  let frameRequest;
  let lastDraw = 0;
  let resolution = 1;
  let slowFrames = 0;
  let redraw = true;
  let hasSteered = false;
  let audioContext;
  let soundOn = localRead("pint-no-return-sound") === "on";
  showSound();

  const keysLeft = ["ArrowLeft", "KeyA"];
  const keysRight = ["ArrowRight", "KeyD"];

  function resize() {
    width = cabinet.clientWidth;
    height = cabinet.clientHeight;
    portrait = width <= 700 && height >= width;
    const pixelBudget = Math.sqrt(1_580_000 / (width * height));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, portrait ? 1.45 : 1.65, pixelBudget) * resolution);
    renderer.setSize(width, height, false);
    redraw = true;
  }

  function view(next) {
    mode = next;
    cabinet.dataset.view = next;
    $("title-screen").hidden = next !== "title";
    $("hud").hidden = next !== "run";
    $("pause").hidden = next !== "run";
    $("result").hidden = next !== "result";
  }

  function warmAudio() {
    if (!soundOn) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ??= new AudioContextClass();
    void audioContext.resume().catch(() => {});
  }

  function note(hz, finish, time, volume, shape = "sine", delay = 0) {
    if (!soundOn || audioContext?.state !== "running") return;
    const at = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(hz, at);
    oscillator.frequency.exponentialRampToValueAtTime(finish, at + time * .88);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + .019);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + time);
    oscillator.connect(envelope);
    envelope.connect(audioContext.destination);
    oscillator.start(at);
    oscillator.stop(at + time + .01);
  }

  function showSound() {
    $("sound").setAttribute("aria-pressed", String(soundOn));
    $("sound").textContent = soundOn ? "Sound on" : "Sound off";
  }

  function start() {
    warmAudio();
    note(380, 420, .23, .055, "triangle");
    note(570, 640, .4, .04, "sine", .07);
    if ($("break").open) $("break").close();
    run = createRun();
    accum = target = incidentTime = spillClock = spillAmount = particlesPending = endClock = 0;
    keys.clear();
    drag = null;
    hasSteered = false;
    bumpMark = null;
    scorecard = null;
    scoreShare = null;
    $("share-on-x").removeAttribute("href");
    spills.clear();
    $("share-status").textContent = "";
    $("incident").textContent = "";
    $("play-help").hidden = false;
    $("fill-tick").textContent = "";
    view("run");
    updateHud();
    canvas.focus({ preventScroll: true });
  }

  function pause() {
    if (mode !== "run" || run.done || $("break").open) return;
    keys.clear();
    drag = null;
    target = run.x;
    $("break").showModal();
  }

  function notice(text, duration) {
    $("incident").textContent = text;
    incidentTime = duration;
  }

  function updateHud() {
    const percent = pintPercent(run.fill);
    $("fill-text").textContent = `${percent}%`;
    $("fill-bar").style.transform = `scaleX(${run.fill})`;
    $("distance-text").textContent = `${Math.max(0, Math.ceil((COURSE_LENGTH - run.s) * .54))} m`;
    $("progress-bar").style.transform = `scaleX(${run.s / COURSE_LENGTH})`;
    if (spillClock > 0 && Math.round(spillAmount * 100) > 0) {
      $("fill-tick").textContent = `−${Math.round(spillAmount * 100)}%`;
    } else {
      $("fill-tick").textContent = "";
    }
  }

  function reportEvent(event) {
    if (event.type === "bump") {
      bumpMark = { hazard: run.hazards[event.id], start: run.time, side: event.dx, force: event.force };
      note(125 + event.force * 55, 42, .23, .12, "triangle");
      note(640, 422, .11, .036, "sine");
      if (event.kind === "guest") notice("Mind the elbow!", .75);
      if (event.kind === "stool") notice("That stool was there a second ago.", .85);
      return;
    }
    if (event.type === "laptop") {
      note(285, 68, .32, .08, "sawtooth");
      note(99, 47, .23, .04, "triangle", .15);
      notice("DEMO LAPTOP · LIQUID COOLED", 2.6);
      return;
    }
    if (spillClock <= .28) spillAmount = 0;
    if (spillClock <= .28 && !event.kind && event.amount > .0016) note(460, 185, .18, .04, "sine");
    spillClock = .94;
    spillAmount += event.amount;
    particlesPending += event.amount;
    if (particlesPending >= .0035 || event.kind) {
      spills.add({ ...event, amount: particlesPending }, tray.position.y, { x: run.vx, speed: run.speed });
      particlesPending = 0;
    }
  }

  function drawFrame(time) {
    const aspect = width / height;
    const gameplay = mode === "run" && !run.done;
    let showcase = 1;
    if (mode === "run" && !run.done) showcase = reduced ? 0 : 1 - ease(run.time / .49);
    if (mode === "run" && run.done) showcase = reduced ? 0 : ease(endClock / .85);
    const s = run.s;
    const landing = run.done === "delivered" ? ease(endClock / .82) : 0;
    const x = blend(run.x, 0, landing);
    const titleIdle = mode === "title" && !reduced ? Math.sin(time * .91) : 0;
    const bob = gameplay && !reduced ? Math.sin(s * 2.5) * .025 : titleIdle * .025;
    const trayHeight = blend(1.16, .09, landing);
    tray.position.set(x, trayHeight + bob, -s);
    const sinceBump = bumpMark ? run.time - bumpMark.start : Infinity;
    const contactLife = Math.max(0, 1 - sinceBump / .36);
    contact.visible = gameplay && contactLife > 0;
    if (contact.visible) {
      const { hazard } = bumpMark;
      contact.position.set(hazardX(hazard, run.time), .043, -hazard.s);
      contact.scale.setScalar(hazard.radius + .29 + (reduced ? 0 : (1 - contactLife) * .16));
      contact.material.opacity = contactLife * .94;
    }
    const jolt = !reduced && contactLife > 0 ? bumpMark.side * bumpMark.force * contactLife * Math.sin(sinceBump * 23) * .065 : 0;
    tray.rotation.z = (run.lean + jolt) * (1 - landing);
    glass.rotation.y = titleIdle * .12;
    const slopeFade = run.done ? 1 - ease(endClock / .75) : 1;
    drawPint(run.fill * FULL_FILL_HEIGHT, run.sloshX * slopeFade, run.sloshZ * slopeFade, time, reduced);
    shadow.position.set(x, .018, -s + .12);
    shadow.scale.setScalar(1 - landing * .24);

    props.forEach((prop, index) => {
      const hazard = run.hazards[index];
      prop.visible = hazard.s - s < 48 && hazard.s - s > -11;
      if (!prop.visible) return;
      prop.position.set(hazardX(hazard, run.time), 0, -hazard.s);
      updateHazard(prop, hazard, run.time, { hit: hazard.hit, reducedMotion: reduced });
    });

    const runFov = T.MathUtils.radToDeg(2 * Math.atan(Math.max(.351, (portrait ? .354 : .385) / aspect)));
    const stillFov = portrait ? 43 : 35;
    camera.fov = blend(runFov, stillFov, showcase);
    camera.aspect = aspect;
    const stillX = x + (portrait ? 1.09 : 1.67) + titleIdle * .19;
    const stillY = trayHeight + (portrait ? 2.55 : 2.33);
    const stillZ = (portrait ? 4.32 : 4.25) - s;
    camera.position.set(
      blend(x * .12, stillX, showcase),
      blend(portrait ? 8.7 : 7.25, stillY, showcase),
      blend((portrait ? 8.8 : 8.9) - s, stillZ, showcase),
    );
    camera.lookAt(
      blend(x * .11, x, showcase),
      blend(.12, trayHeight + (portrait ? 1.06 : .65), showcase),
      blend((portrait ? -7.3 : -7.05) - s, -s, showcase),
    );
    const offset = portrait ? 0 : -width * .214 * showcase;
    if (offset) camera.setViewOffset(width, height, offset, 0, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    practical.position.z = -s - 2.65;
    renderer.render(scene, camera);
  }

  function finish() {
    const delivered = run.done === "delivered";
    const percent = pintPercent(run.fill);
    const seconds = run.time.toFixed(1);
    const gag = run.laptop ? "One laptop liquid-cooled."
      : !delivered ? "The floor sends its compliments."
      : percent === 100 ? "The barman checks it with a spirit level."
      : percent >= 85 ? "A pint, give or take a sip."
      : percent >= 50 ? "Pint for one. Half for the carpet."
      : "Served with a generous side of tray.";
    const saved = Number(localRead("pint-no-return-best"));
    const previous = Number.isFinite(saved) ? clamp(saved, 0, 100) : 0;
    const best = Math.max(percent, previous);
    localSave("pint-no-return-best", String(best));
    $("result-title").textContent = delivered ? "Pint delivered" : "Pint lost";
    $("result-score").textContent = percent;
    $("result-caption").textContent = delivered ? "of a pint delivered" : "of a pint left";
    $("result-gag").textContent = gag;
    $("result-best").textContent = `${seconds}s · Personal best ${best}%`;
    $("play-help").hidden = true;
    $("incident").textContent = "";
    const result = delivered ? `${percent}% of a pint delivered in ${seconds}s.` : `${percent}% of a pint left. ${gag}`;
    scoreShare = createSocialShare(`Break Pint. ${result}`, gameUrl);
    $("share-on-x").href = scoreShare.xUrl;
    view("result");
    drawFrame(0);
    scorecard = renderScorecard(canvas, { percent, seconds, gag, delivered }).catch(() => null);
    if (delivered) {
      note(493.88, 493, .31, .085, "triangle");
      note(659.25, 659, .41, .069, "sine", .085);
      note(783.99, 784, .56, .050, "sine", .16);
    } else {
      note(193, 69, .57, .10, "triangle");
    }
    $("result-title").focus({ preventScroll: true });
  }

  function tick(now) {
    frameRequest = requestAnimationFrame(tick);
    const elapsed = Math.max(0, (now - (previousTime || now)) / 1000);
    previousTime = now;
    if (document.hidden) return;
    if ($("break").open) {
      if (redraw) drawFrame(now / 1000);
      redraw = false;
      return;
    }
    const dt = Math.min(.083, elapsed);
    if (mode === "run") {
      if (elapsed > .033) slowFrames++;
      else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames > 10 && resolution > .64) {
        slowFrames = 0;
        resolution *= .82;
        resize();
      }
      if (!run.done) {
        const left = keysLeft.some((key) => keys.has(key));
        const right = keysRight.some((key) => keys.has(key));
        accum += dt;
        while (accum >= STEP_SECONDS) {
          target = clamp(target + (Number(right) - Number(left)) * 2.8 * STEP_SECONDS, -TRACK_EDGE, TRACK_EDGE);
          stepRun(run, STEP_SECONDS, target);
          run.events.forEach(reportEvent);
          accum -= STEP_SECONDS;
        }
        spillClock -= dt;
        if (incidentTime > 0 && (incidentTime -= dt) <= 0) $("incident").textContent = "";
        if (hasSteered || run.time > 5.5) $("play-help").hidden = true;
        updateHud();
      } else {
        endClock += dt;
        if (endClock >= (reduced ? .3 : .98)) {
          finish();
          redraw = false;
          return;
        }
      }
      spills.step(dt);
    }
    const idleAnimation = mode === "title" && !reduced && now - lastDraw > 32;
    if (mode === "run" || redraw || idleAnimation) {
      drawFrame(now / 1000);
      lastDraw = now;
      redraw = false;
    }
  }

  const steerPerPixel = () => 1 / clamp(width * .19, 62, 118);
  canvas.addEventListener("pointerdown", (event) => {
    if (mode !== "run" || run.done || drag || event.button !== 0) return;
    drag = { id: event.pointerId, from: event.clientX, start: target };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== drag?.id) return;
    const delta = event.clientX - drag.from;
    target = clamp(drag.start + delta * steerPerPixel(), -TRACK_EDGE, TRACK_EDGE);
    if (Math.abs(delta) > 9) hasSteered = true;
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(type, (event) => {
      if (event.pointerId === drag?.id) drag = null;
    });
  }
  window.addEventListener("keydown", (event) => {
    if (mode !== "run" || $("break").open || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === "Escape") {
      event.preventDefault();
      pause();
    } else if (keysLeft.includes(event.code) || keysRight.includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
      hasSteered = true;
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", pause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  $("start").addEventListener("click", start);
  $("again").addEventListener("click", start);
  $("restart").addEventListener("click", start);
  $("pause").addEventListener("click", pause);
  $("resume").addEventListener("click", () => $("break").close());
  $("break").addEventListener("close", () => {
    previousTime = 0;
    canvas.focus({ preventScroll: true });
  });
  $("sound").addEventListener("click", () => {
    soundOn = !soundOn;
    localSave("pint-no-return-sound", soundOn ? "on" : "off");
    showSound();
    warmAudio();
  });
  $("share").addEventListener("click", async () => {
    const social = scoreShare;
    const image = await scorecard;
    if (!social || social !== scoreShare) return;
    if (!image) {
      $("share-status").textContent = "The score image couldn’t be created.";
      return;
    }
    const file = new File([image], "break-pint.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Break Pint", text: social.text, url: social.url });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    const href = URL.createObjectURL(file);
    const download = Object.assign(document.createElement("a"), { href, download: file.name });
    document.body.append(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
    $("share-status").textContent = "Score image saved.";
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    cancelAnimationFrame(frameRequest);
    if ($("break").open) $("break").close();
    view("title");
    unavailable("The 3D renderer stopped. Reload the page to try again.");
  });
  window.addEventListener("resize", resize);
  resize();
  drawFrame(0);
  $("start").disabled = false;
  frameRequest = requestAnimationFrame(tick);
}

function unavailable(text) {
  $("start").hidden = true;
  $("load-error").textContent = text;
  $("load-error").hidden = false;
}

try {
  await loadPintBadge();
  initialize();
} catch (error) {
  console.error(error);
  unavailable("This game needs WebGL 2. Try a browser with hardware acceleration.");
}
