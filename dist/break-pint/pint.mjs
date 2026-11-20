import * as T from "./vendor/three.module.js";

const SECTORS = 64;
const INNER_BOTTOM = 0.106;
const INNER_HEIGHT = 1.22;
const RIM = INNER_BOTTOM + INNER_HEIGHT;
const bases = [
  [0, 0.295], [.12, .312], [.46, .365], [.72, .416], [.86, .436], [1, .452],
];
const outerProfile = [
  [.014, .335], [.049, .34], [.086, .34], [.16, .337], [.31, .357], [.48, .379], [.66, .406],
  [.87, .434], [1.09, .46], [1.328, .478], [1.355, .477],
];
const TAU = 2 * Math.PI;
const cosine = Array.from({ length: SECTORS }, (_, i) => Math.cos(i / SECTORS * TAU));
const sine = Array.from({ length: SECTORS }, (_, i) => Math.sin(i / SECTORS * TAU));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function random(seed) {
  let state = seed;
  return () => (state = Math.imul(1664525, state) + 1013904223 >>> 0) / 4294967296;
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

let pintBadge;

export async function loadPintBadge() {
  const logo = new Image();
  logo.src = new URL("../assets/break-pint-moustache.png", import.meta.url).href;
  try {
    await logo.decode();
  } catch {
    return;
  }

  pintBadge = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 122, 0, TAU);
    ctx.save();
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(logo, -7, -7, w + 14, h + 14);
    ctx.restore();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#f9df9d";
    ctx.stroke();
  });
}

function material(color, roughness = .5, metalness = 0, rest = {}) {
  return new T.MeshStandardMaterial({ color, roughness, metalness, ...rest });
}

function cylinder(group, bottomRadius, topRadius, height, y, paint) {
  const mesh = new T.Mesh(new T.CylinderGeometry(topRadius, bottomRadius, height, SECTORS), paint);
  mesh.position.y = y;
  group.add(mesh);
  return mesh;
}

function ring(group, radius, tube, y, paint) {
  const mesh = new T.Mesh(new T.TorusGeometry(radius, tube, 10, SECTORS), paint);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  group.add(mesh);
  return mesh;
}

function wall(parent, profile, paint) {
  const geometry = new T.LatheGeometry(profile.map(([x, y]) => new T.Vector2(x, y)), SECTORS);
  const mesh = new T.Mesh(geometry, paint);
  parent.add(mesh);
  return mesh;
}

function exteriorRadius(y) {
  for (let i = 1; i < outerProfile.length; i++) {
    const [top, far] = outerProfile[i];
    const [bottom, near] = outerProfile[i - 1];
    if (y <= top) return near + (far - near) * clamp((y - bottom) / (top - bottom), 0, 1);
  }
  return outerProfile.at(-1)[1];
}

function glassDecal(texture, { from, to, low, high, twist = 0, opacity }) {
  const positions = [];
  const uvs = [];
  const faces = [];
  for (let row = 0; row <= 16; row++) {
    const v = row / 16;
    const y = low + (high - low) * v;
    const radius = exteriorRadius(y) + .002;
    for (let col = 0; col <= 16; col++) {
      const u = col / 16;
      const phi = from + (to - from) * u + twist * v;
      positions.push(Math.sin(phi) * radius, y, Math.cos(phi) * radius);
      uvs.push(u, v);
      const i = row * 17 + col;
      if (row > 0 && col > 0) faces.push(i - 18, i - 17, i - 1, i - 17, i, i - 1);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(faces);
  const paint = new T.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false, side: T.DoubleSide });
  return new T.Mesh(geometry, paint);
}

function outerGlass(glass) {
  const rimMaterial = new T.MeshPhysicalMaterial({
    color: 0xbcffe9, metalness: .37, roughness: .14,
    transparent: true, opacity: .64, envMapIntensity: 1.45,
  });
  const glaze = new T.MeshPhysicalMaterial({
    color: 0xb1e2ec, metalness: .18, roughness: .11, transparent: true, opacity: .17,
    clearcoat: 1, clearcoatRoughness: .09, envMapIntensity: 1.8, depthWrite: false, side: T.DoubleSide,
  });
  const points = [[0, .014], ...outerProfile.map(([y, x]) => [x, y]), [.458, 1.363], [.455, 1.341]];
  wall(glass, points, glaze).renderOrder = 3;
  wall(glass, [[.331, .027], [.343, .052], [.338, .1], [.319, .115]], rimMaterial).renderOrder = 3;
  const lip = ring(glass, .465, .011, 1.352, rimMaterial);
  lip.renderOrder = 4;
  const warning = ring(glass, .466, .012, 1.352, new T.MeshBasicMaterial({
    color: 0xffd168, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  }));
  warning.renderOrder = 6;

  if (pintBadge) {
    const decal = glassDecal(pintBadge, { from: -.85, to: .85, low: .32, high: .98, opacity: 1 });
    decal.material.toneMapped = false;
    decal.renderOrder = 5;
    glass.add(decal);
  }

  const highlight = canvasTexture(96, 256, (ctx, w, h) => {
    const spread = ctx.createLinearGradient(0, 0, w, 0);
    spread.addColorStop(0, "#cbffe200");
    spread.addColorStop(.46, "#c5ffe798");
    spread.addColorStop(.61, "#e8fffabf");
    spread.addColorStop(1, "#d6edff00");
    ctx.fillStyle = spread;
    ctx.beginPath();
    ctx.moveTo(w * .55, 4);
    ctx.bezierCurveTo(w * .85, h * .18, w * .78, h * .80, w * .57, h - 3);
    ctx.bezierCurveTo(w * .26, h * .79, w * .02, h * .21, w * .55, 4);
    ctx.fill();
  });
  const bright = glassDecal(highlight, { from: -.96, to: -.47, low: .09, high: 1.342, twist: .07, opacity: .72 });
  const edge = glassDecal(highlight, { from: .78, to: 1.15, low: .17, high: 1.34, twist: -.07, opacity: .49 });
  bright.renderOrder = edge.renderOrder = 4;
  glass.add(bright, edge);
  return warning;
}

function makeTray(group) {
  const edge = material(0x8d94aa, .28, .72, { envMapIntensity: 1.4 });
  const carbide = material(0x191225, .44, .48);
  const paint = material(0x286855, .3, .27, { emissive: 0x14f195, emissiveIntensity: .18 });
  const surface = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#241a30";
    ctx.fillRect(0, 0, w, h);
    const roll = random(7849);
    for (let y = 0; y < h; y += 8) {
      for (let x = 0; x < w; x += 8) {
        ctx.fillStyle = `rgba(198,180,219,${.035 + roll() * .065})`;
        ctx.fillRect(x + (y % 16 ? 4 : 0), y, 3, 2);
      }
    }
    ctx.strokeStyle = "#79627f";
    ctx.lineWidth = 1.5;
    for (const r of [140, 201, 221]) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, TAU);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(i / 8 * TAU);
      ctx.fillStyle = "#ac849e";
      ctx.fillRect(-8, 196, 16, 3);
      ctx.restore();
    }
  });
  const inserts = material(0xe1d4e8, .66, .2, { map: surface });
  cylinder(group, .68, .82, .10, -.048, carbide);
  cylinder(group, .82, .818, .056, .009, edge);
  cylinder(group, .792, .794, .023, .044, inserts);
  ring(group, .817, .022, .044, edge);
  ring(group, .796, .006, .048, paint);
}

function beerSurface(glass) {
  const sideGeometry = new T.BufferGeometry();
  const capGeometry = new T.BufferGeometry();
  const capPositions = new Float32Array((SECTORS + 1) * 3);
  const capUVs = new Float32Array((SECTORS + 1) * 2);
  const levels = [0, .125, .33, .62, .85, .97, .985, 1];
  const sidePositions = new Float32Array(SECTORS * levels.length * 3);
  const sideColors = new Float32Array(sidePositions.length);
  const body = [0x9a3107, 0xb14b08, 0xc9570b, 0xe36b10, 0xef8a15, 0xf0a329, 0xffdc9a, 0xffe7bc]
    .map((color) => new T.Color(color));
  for (let row = 0; row < levels.length; row++) {
    for (let i = 0; i < SECTORS; i++) body[row].toArray(sideColors, (row * SECTORS + i) * 3);
  }
  const capIndices = [];
  const sideIndices = [];
  capUVs[0] = .5;
  capUVs[1] = .5;
  for (let i = 0; i < SECTORS; i++) {
    const next = (i + 1) % SECTORS;
    capIndices.push(0, next + 1, i + 1);
    capUVs[2 * (i + 1)] = .5 + cosine[i] * .49;
    capUVs[2 * (i + 1) + 1] = .5 + sine[i] * .49;
    for (let row = 0; row < levels.length - 1; row++) {
      const a = row * SECTORS + i;
      const b = row * SECTORS + next;
      sideIndices.push(a, a + SECTORS, b, b, a + SECTORS, b + SECTORS);
    }
  }
  capGeometry.setIndex(capIndices);
  capGeometry.setAttribute("uv", new T.BufferAttribute(capUVs, 2));
  capGeometry.setAttribute("position", new T.BufferAttribute(capPositions, 3).setUsage(T.DynamicDrawUsage));
  sideGeometry.setIndex(sideIndices);
  sideGeometry.setAttribute("color", new T.BufferAttribute(sideColors, 3));
  sideGeometry.setAttribute("position", new T.BufferAttribute(sidePositions, 3).setUsage(T.DynamicDrawUsage));

  const foamTexture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#ffdda4";
    ctx.fillRect(0, 0, w, h);
    const roll = random(1904);
    for (let i = 0; i < 2650; i++) {
      const r = .4 + (roll() ** 5) * 4;
      const x = roll() * w;
      const y = roll() * h;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = roll() > .12 ? "#fff0d0" : "#dda05e";
      ctx.globalAlpha = .15 + roll() * .5;
      ctx.fill();
      if (r > 1.3) {
        ctx.strokeStyle = "#ffe4b6";
        ctx.lineWidth = .8;
        ctx.stroke();
      }
    }
  });
  const beer = new T.Mesh(sideGeometry, new T.MeshPhysicalMaterial({
    vertexColors: true, color: 0xffebd2, emissive: 0x8a3909, emissiveIntensity: .18, roughness: .24,
    metalness: .15, clearcoat: .75, clearcoatRoughness: .11, envMapIntensity: 1.29,
  }));
  const foam = new T.Mesh(capGeometry, material(0xffefd2, .73, .04, { map: foamTexture, emissive: 0x654720, emissiveIntensity: .14 }));
  bothVisible(beer, foam, false);
  beer.frustumCulled = false;
  foam.frustumCulled = false;
  glass.add(beer, foam);

  function radius(height) {
    const normalized = (height - INNER_BOTTOM) / INNER_HEIGHT;
    for (let i = 1; i < bases.length; i++) {
      const [y, x] = bases[i];
      const [lowY, lowX] = bases[i - 1];
      if (normalized <= y) return lowX + (x - lowX) * clamp((normalized - lowY) / (y - lowY), 0, 1);
    }
    return bases.at(-1)[1];
  }

  return (fill, slopeX, slopeZ, time, reducedMotion) => {
    bothVisible(beer, foam, fill > .002);
    if (!beer.visible) return;
    const level = INNER_BOTTOM + fill * INNER_HEIGHT;
    const waveStrength = Math.min(.032, Math.hypot(slopeX, slopeZ) * .026);
    capPositions[1] = clamp(level, INNER_BOTTOM + .001, RIM);
    for (let i = 0; i < SECTORS; i++) {
      const cx = cosine[i];
      const sz = sine[i];
      const lapping = reducedMotion ? 0 : waveStrength * Math.sin(i / SECTORS * TAU * 4 + time * 9);
      const gradient = slopeX * cx + slopeZ * sz;
      let height = clamp(level + gradient * radius(level) + lapping, INNER_BOTTOM + .001, RIM);
      height = clamp(level + gradient * radius(height) + lapping, INNER_BOTTOM + .001, RIM);
      const cp = (i + 1) * 3;
      const capRadius = radius(height);
      capPositions[cp] = cx * capRadius;
      capPositions[cp + 1] = height + .001;
      capPositions[cp + 2] = sz * capRadius;
      for (let row = 0; row < levels.length; row++) {
        const vertical = INNER_BOTTOM + (height - INNER_BOTTOM) * levels[row];
        const r = radius(vertical);
        const sid = (row * SECTORS + i) * 3;
        sidePositions[sid] = cx * r;
        sidePositions[sid + 1] = vertical;
        sidePositions[sid + 2] = sz * r;
      }
    }
    capGeometry.attributes.position.needsUpdate = true;
    capGeometry.computeVertexNormals();
    sideGeometry.attributes.position.needsUpdate = true;
    sideGeometry.computeVertexNormals();
  };
}

function bothVisible(first, second, visible) {
  first.visible = visible;
  second.visible = visible;
}

export function makePint(scene) {
  const tray = new T.Group();
  const glass = new T.Group();
  glass.position.y = .067;
  tray.add(glass);
  scene.add(tray);
  makeTray(tray);
  const rim = outerGlass(glass);
  const surface = beerSurface(glass);
  return {
    tray,
    glass,
    fill(fill, slopeX, slopeZ, time, reducedMotion) {
      surface(fill, slopeX, slopeZ, time, reducedMotion);
      const crest = fill + Math.hypot(slopeX, slopeZ) * .37;
      rim.material.opacity = clamp((crest - .97) * 8, 0, .75);
      rim.visible = rim.material.opacity > .002;
    },
  };
}

export function makeSpills(scene, reducedMotion) {
  const limit = reducedMotion ? 80 : 220;
  const particles = [];
  const decals = [];
  const drops = new T.InstancedMesh(
    new T.IcosahedronGeometry(.062, 0),
    material(0xffad3f, .23, .23, { emissive: 0x9e3c16, emissiveIntensity: .35 }),
    limit,
  );
  const puddles = new T.InstancedMesh(
    new T.CircleGeometry(.10, 12).rotateX(-Math.PI / 2),
    material(0xa94d15, .28, .25, { transparent: true, opacity: .7, depthWrite: false }),
    150,
  );
  const object = new T.Object3D();
  const rng = random(81);
  drops.frustumCulled = false;
  puddles.frustumCulled = false;
  drops.count = 0;
  puddles.count = 0;
  scene.add(drops, puddles);

  function add(event, origin, velocity) {
    const count = Math.min(reducedMotion ? 8 : 30, Math.ceil(event.amount * 130));
    for (let i = 0; i < count && particles.length < limit; i++) {
      const size = .42 + rng() * .85;
      particles.push({
        x: event.x + event.dx * .38,
        y: origin + 1.22,
        z: -event.s + event.dz * .38,
        vx: event.dx * (.65 + rng() * 3.1) + velocity.x * .32 + rng() - .5,
        vy: .85 + rng() * 2.9,
        vz: -velocity.speed * .55 + event.dz * (1.0 + rng() * 2.7) + rng() - .5,
        size,
      });
    }
  }

  function step(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 11 * dt;
      if (p.y <= .034) {
        if (decals.length === 150) decals.shift();
        decals.push(p);
        particles.splice(i, 1);
      }
    }
    drops.count = particles.length;
    particles.forEach((p, i) => {
      object.position.set(p.x, p.y, p.z);
      object.scale.set(p.size, p.size * 1.42, p.size);
      object.rotation.set(.21, 0, -p.vx * .14);
      object.updateMatrix();
      drops.setMatrixAt(i, object.matrix);
    });
    puddles.count = decals.length;
    decals.forEach((p, i) => {
      object.position.set(p.x, .031 + i * .00001, p.z);
      object.scale.set(p.size * 1.10, 1, p.size * 1.7);
      object.rotation.set(0, Math.sin(i) * Math.PI, 0);
      object.updateMatrix();
      puddles.setMatrixAt(i, object.matrix);
    });
    drops.instanceMatrix.needsUpdate = true;
    puddles.instanceMatrix.needsUpdate = true;
  }

  return {
    add, step,
    clear() {
      particles.length = 0;
      decals.length = 0;
      drops.count = 0;
      puddles.count = 0;
    },
  };
}
