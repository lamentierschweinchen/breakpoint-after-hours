import * as T from './vendor/three.module.js';

const ink = '#141021';
const violet = '#9945ff';
const mint = '#14f195';
const brass = '#bd8652';
const walnut = '#4b2740';
const cream = '#fff0ce';
const laneWidth = 6.94;
const sideWall = 5.42;
const fixtures = {
  box: new T.BoxGeometry(1, 1, 1),
  cylinder: new T.CylinderGeometry(1, 1, 1, 14),
  cone: new T.CylinderGeometry(0.65, 1, 1, 14),
  ball: new T.SphereGeometry(1, 14, 9),
  orb: new T.SphereGeometry(1, 10, 6),
  rail: new T.TorusGeometry(1, 0.065, 7, 28),
  leg: new T.CapsuleGeometry(0.23, 0.54, 3, 8),
};
const solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
const alloy = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.31, metalness: 0.31 });
const hot = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const materialCache = new Map();
const plateTextures = new Map();
let contactTexture;
let floorTexture;
let barSurface;

function uniform(color, roughness = 0.74, metalness = 0) {
  const key = [color, roughness, metalness].join();
  if (!materialCache.has(key)) {
    materialCache.set(key, new T.MeshStandardMaterial({ color, roughness, metalness }));
  }
  return materialCache.get(key);
}

function object(parent, shape, tint, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const mesh = new T.Mesh(fixtures[shape], typeof tint === 'string' ? uniform(tint) : tint);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  parent.add(mesh);
  return mesh;
}

function geometryBatch() {
  const batches = new Map();
  const point = new T.Vector3();
  const normal = new T.Vector3();
  const transformNormal = new T.Matrix3();

  function add(geometry, material, color, transform) {
    if (!batches.has(material)) batches.set(material, { xyz: [], normals: [], rgb: [], index: [] });
    const b = batches.get(material);
    const vertices = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const indices = geometry.index;
    const first = b.xyz.length / 3;
    transformNormal.getNormalMatrix(transform);

    for (let i = 0; i < vertices.count; i += 1) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(transform);
      normal.fromBufferAttribute(normals, i).applyNormalMatrix(transformNormal);
      b.xyz.push(point.x, point.y, point.z);
      b.normals.push(normal.x, normal.y, normal.z);
      b.rgb.push(color.r, color.g, color.b);
    }
    for (let i = 0; i < indices.count; i += 1) b.index.push(first + indices.getX(i));
  }

  function finish(parent) {
    for (const [material, b] of batches) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(b.xyz, 3));
      geometry.setAttribute('normal', new T.Float32BufferAttribute(b.normals, 3));
      geometry.setAttribute('color', new T.Float32BufferAttribute(b.rgb, 3));
      geometry.setIndex(b.index);
      geometry.computeBoundingSphere();
      parent.add(new T.Mesh(geometry, material));
    }
  }

  return { add, finish };
}

// Bake static prop geometry into three draws per bay. The route scrolls, so each bay
// keeps its own culling bounds instead of loading the whole pub into every frame.
function bay(parent) {
  const batch = geometryBatch();
  const color = new T.Color();
  const dummy = new T.Object3D();
  function part(shape, tint, x, y, s, sx, sy, sz, rx = 0, ry = 0, rz = 0, material = solid) {
    dummy.position.set(x, y, -s);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    batch.add(fixtures[shape], material, color.set(tint), dummy.matrix);
  }
  return { part, finish: () => batch.finish(parent) };
}

// Keep each moving limb separate, while baking the face, clothes, and other fixed
// details into the body draw.
function bakeModel(parent) {
  const batch = geometryBatch();
  for (const child of [...parent.children]) {
    if (child.isGroup) bakeModel(child);
    if (!child.isMesh || !child.material.isMeshStandardMaterial) continue;
    child.updateMatrix();
    batch.add(child.geometry, child.material.metalness ? alloy : solid, child.material.color, child.matrix);
    parent.remove(child);
  }
  batch.finish(parent);
}

function surface(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeFloor() {
  if (floorTexture) return floorTexture;
  floorTexture = surface(1024, 1024, (ctx, w, h) => {
    const size = 128;
    const colors = ['#252038', '#393247', '#242035', '#373048'];
    ctx.fillStyle = '#1c1827';
    ctx.fillRect(0, 0, w, h);

    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const x = col * size + 2;
        const y = row * size + 2;
        const index = (row + col) % 2 + (col * 7 % 3 === 0 ? 2 : 0);
        ctx.fillStyle = colors[index];
        ctx.fillRect(x, y, size - 4, size - 4);
        ctx.strokeStyle = index % 2 ? '#50445a' : '#393047';
        ctx.strokeRect(x + 1.5, y + 1.5, size - 7, size - 7);

        for (let i = 0; i < 56; i += 1) {
          const px = (i * 83 + row * 13 + col * 21) % 112;
          const py = (i * 59 + row * 31 + col * 39) % 112;
          ctx.fillStyle = i % 2 ? '#ffeab713' : '#10102030';
          ctx.fillRect(x + 6 + px, y + 6 + py, i % 5 === 0 ? 3 : 1, 1);
        }
      }
    }

    const glow = ctx.createLinearGradient(0, 0, w, 0);
    glow.addColorStop(0, '#9945ff59');
    glow.addColorStop(0.20, '#542a8500');
    glow.addColorStop(0.80, '#14f19500');
    glow.addColorStop(1, '#14f19545');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  });
  floorTexture.wrapS = T.RepeatWrapping;
  floorTexture.wrapT = T.RepeatWrapping;
  return floorTexture;
}

function blob() {
  if (!contactTexture) {
    contactTexture = surface(64, 64, (ctx) => {
      const soft = ctx.createRadialGradient(32, 32, 6, 32, 32, 31);
      soft.addColorStop(0, '#ffffff');
      soft.addColorStop(0.6, '#ffffffa8');
      soft.addColorStop(1, '#ffffff00');
      ctx.fillStyle = soft;
      ctx.fillRect(0, 0, 64, 64);
    });
  }
  return contactTexture;
}

function decal(parent, texture, tint, opacity, x, y, z, width, depth, additive = false) {
  const mesh = new T.Mesh(new T.PlaneGeometry(width, depth), new T.MeshBasicMaterial({
    color: tint,
    map: texture,
    opacity,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    blending: additive ? T.AdditiveBlending : T.NormalBlending,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function frameSign(parent, x, y, z, main, sub, accent, width, height, rotation = 0) {
  const key = [main, sub, accent].join();
  if (!plateTextures.has(key)) {
    plateTextures.set(key, surface(512, 216, (ctx, w, h) => {
      ctx.fillStyle = '#17101e';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.strokeStyle = '#a188a0';
      ctx.strokeRect(16, 16, w - 32, h - 32);
      for (const screwX of [29, w - 29]) {
        for (const screwY of [29, h - 29]) {
          ctx.fillStyle = '#d5b88b';
          ctx.beginPath();
          ctx.arc(screwX, screwY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.font = '700 26px monospace';
      ctx.fillStyle = accent;
      ctx.fillText(sub, w / 2, 65, w - 90);
      ctx.font = '900 67px Georgia, serif';
      ctx.fillStyle = cream;
      ctx.fillText(main, w / 2, 130, w - 74);
      ctx.fillStyle = accent;
      ctx.fillRect(w / 2 - 32, 176, 64, 2);
    }));
  }
  const sign = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({
    map: plateTextures.get(key),
    toneMapped: false,
    side: T.DoubleSide,
  }));
  sign.position.set(x, y, z);
  sign.rotation.y = rotation;
  parent.add(sign);
  return sign;
}

function wall(part, side, begin, depth) {
  const end = begin + depth;
  const mid = (begin + end) / 2;
  const x = side * sideWall;
  part('box', '#332145', x, 1.44, mid, 0.35, 2.88, depth);
  part('box', '#211822', x - side * 0.20, 0.49, mid, 0.13, 0.96, depth);
  part('box', walnut, x - side * 0.24, 0.97, mid, 0.20, 0.10, depth);
  part('box', '#1c1527', x - side * 0.16, 2.82, mid, 0.24, 0.16, depth);
  part('box', '#1d1723', side * 4.54, 0.037, mid, 2.20, 0.074, depth);
  part('box', '#4b3854', side * 3.51, 0.043, mid, 0.13, 0.09, depth);
  part('box', side > 0 ? '#267761' : '#77479d', side * 3.57, 0.062, mid, 0.033, 0.017, depth, 0, 0, 0, hot);
  part('box', side > 0 ? '#41f2b2' : '#ae71fb', x - side * 0.29, 2.78, mid, 0.031, 0.021, depth, 0, 0, 0, hot);

  for (let s = begin + 0.5; s < end - 0.3; s += 1.18) {
    part('box', '#21182a', x - side * 0.198, 1.86, s, 0.065, 1.56, 0.063);
    part('box', '#524265', x - side * 0.215, 1.87, s + 0.54, 0.055, 1.38, 0.048);
    part('box', '#7e586d', x - side * 0.28, 0.38, s, 0.051, 0.57, 0.035);
  }
}

function bottle(part, x, y, s, tint, scale) {
  part('cylinder', tint, x, y + 0.15 * scale, s, 0.072 * scale, 0.30 * scale, 0.072 * scale);
  part('cone', tint, x, y + 0.326 * scale, s, 0.072 * scale, 0.06 * scale, 0.072 * scale);
  part('cylinder', tint, x, y + 0.39 * scale, s, 0.033 * scale, 0.11 * scale, 0.033 * scale);
  part('cylinder', '#d3a36b', x, y + 0.443 * scale, s, 0.037 * scale, 0.04 * scale, 0.037 * scale);
  part('cylinder', '#c4b09b', x, y + 0.13 * scale, s, 0.075 * scale, 0.09 * scale, 0.075 * scale);
}

function grain() {
  if (!barSurface) {
    const map = surface(256, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#aa7b80';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 128; i += 1) {
        const x = (i * 59) % w;
        const sway = (i % 4) + 1;
        ctx.strokeStyle = ['#351e3823', '#efc29322', '#4123350d', '#d5ae8b36'][i % 4];
        ctx.lineWidth = i % 7 === 0 ? 1.8 : 0.65;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 16; y < h; y += 16) {
          ctx.lineTo(x + Math.sin(y * 0.023 + i) * sway + 3 * Math.sin(y * 0.006 + i / 3), y);
        }
        ctx.stroke();
      }
      for (let i = 1; i <= 3; i += 1) {
        ctx.fillStyle = '#43253a45';
        ctx.fillRect(w * i / 4, 0, 2, h);
        ctx.fillStyle = '#dfab9355';
        ctx.fillRect(w * i / 4 + 2, 0, 1, h);
      }
    });
    barSurface = new T.MeshStandardMaterial({ map, roughness: 0.37 });
  }
  return barSurface;
}

function timberBar(parent, part, begin, depth, palette) {
  const middle = begin + depth / 2;
  part('box', '#44263d', 4.28, 0.53, middle, 1.12, 1.03, depth);
  part('box', '#744656', 4.29, 1.07, middle, 1.34, 0.16, depth + 0.10);
  part('box', '#a27462', 4.29, 1.157, middle, 1.32, 0.024, depth + 0.12);
  const top = new T.Mesh(new T.PlaneGeometry(1.30, depth + 0.04), grain());
  top.position.set(4.29, 1.170, -middle);
  top.rotation.x = -Math.PI / 2;
  parent.add(top);
  part('box', '#2c1730', 3.72, 0.48, middle, 0.048, 0.83, depth - 0.12);
  part('box', brass, 3.67, 0.82, middle, 0.040, 0.045, depth - 0.05, 0, 0, 0, alloy);
  part('box', '#b77552', 3.61, 0.19, middle, 0.06, 0.06, depth + 0.06, 0, 0, 0, alloy);

  for (let s = begin + 0.12; s < begin + depth; s += 0.19) {
    part('box', ['#704555', '#60394c', '#825463'][Math.floor(s * 17 % 3 + 3) % 3], 3.69, 0.51, s, 0.064, 0.55, 0.10);
  }

  for (const y of [1.31, 1.83, 2.30]) {
    part('box', '#5b3947', 5.09, y, middle, 0.48, 0.055, depth);
    part('box', palette, 5.04, y - 0.011, middle, 0.034, 0.025, depth - 0.08, 0, 0, 0, hot);
    for (let i = 0; i * 0.32 < depth - 0.40; i += 1) {
      const tint = ['#387766', '#6f395c', '#a1623c', '#4a506a', '#a75c65'][i % 5];
      if ((i + Math.floor(y * 10)) % 6 !== 0) {
        bottle(part, 5.10 - (i % 2) * 0.13, y + 0.035, begin + 0.20 + i * 0.32, tint, 0.75 + (i % 3) * 0.11);
      }
    }
  }

  for (const s of [begin + 0.85, begin + depth - 0.72]) {
    part('cylinder', brass, 4.07, 1.35, s, 0.078, 0.44, 0.075, 0, 0, 0, alloy);
    part('box', brass, 4, 1.53, s, 0.23, 0.09, 0.10, 0, 0, 0, alloy);
    part('box', '#352449', 3.94, 1.64, s, 0.061, 0.22, 0.075, 0, 0, 0.26);
    part('cylinder', '#e4dbc5', 3.91, 1.16, s + 0.34, 0.19, 0.020, 0.19);
  }
}

function alcove(part, side, s, upholstery, bulb) {
  const x = side * 4.56;
  part('box', '#4a2d41', x, 0.23, s, 1.31, 0.42, 2.32);
  part('box', upholstery, x - side * 0.055, 0.49, s, 1.26, 0.18, 2.18);
  part('box', upholstery, x + side * 0.56, 0.91, s, 0.18, 1.02, 2.20, 0, 0, -side * 0.10);
  for (let i = -4; i <= 4; i += 1) {
    part('cylinder', upholstery, x + side * 0.43, 0.94, s + i * 0.235, 0.093, 0.74, 0.092, 0, 0, -side * 0.10);
  }

  const tableX = side * 3.97;
  part('cylinder', '#986a5c', tableX, 0.82, s + 0.13, 0.45, 0.083, 0.45);
  part('cylinder', '#251a28', tableX, 0.40, s + 0.13, 0.07, 0.75, 0.07);
  part('cylinder', '#392437', tableX, 0.056, s + 0.13, 0.27, 0.055, 0.27);
  part('cylinder', '#e2c896', tableX - side * 0.16, 0.87, s + 0.16, 0.115, 0.011, 0.115);
  part('cone', '#bd7540', tableX - side * 0.16, 1.005, s + 0.16, 0.081, 0.24, 0.081, 0, 0, Math.PI);
  part('cylinder', '#fae4ba', tableX - side * 0.16, 1.13, s + 0.16, 0.083, 0.027, 0.083);
  part('box', '#3e2744', tableX + side * 0.11, 0.875, s + 0.01, 0.14, 0.02, 0.21, 0, 0.4);

  part('box', '#291d30', side * 4.75, 2.74, s, 1.15, 0.065, 0.12);
  part('cylinder', brass, side * 4.34, 2.48, s, 0.017, 0.52, 0.017, 0, 0, 0, alloy);
  part('ball', bulb, side * 4.34, 2.18, s, 0.18, 0.18, 0.18, 0, 0, 0, hot);
  part('cone', '#84514a', side * 4.34, 2.30, s, 0.24, 0.18, 0.24, 0, 0, 0, alloy);
}

function jukebox(parent, part, side, s) {
  const x = side * 4.46;
  const face = s - 0.22;
  part('box', '#442a46', x, 0.71, s, 0.84, 1.37, 0.48);
  part('ball', '#442a46', x, 1.35, s, 0.42, 0.36, 0.24);
  part('box', '#b14a80', x, 0.71, face - 0.022, 0.71, 1.24, 0.07);
  part('ball', '#b14a80', x, 1.30, face, 0.35, 0.31, 0.09);
  part('box', '#2d1c32', x, 0.72, face - 0.065, 0.55, 1.11, 0.04);
  part('cylinder', '#fff1b2', x, 1.24, face - 0.085, 0.229, 0.024, 0.229, Math.PI / 2, 0, 0, hot);
  part('cylinder', '#7252b1', x, 1.24, face - 0.106, 0.188, 0.009, 0.188, Math.PI / 2);
  part('cylinder', '#2c2136', x, 1.24, face - 0.111, 0.11, 0.007, 0.11, Math.PI / 2);
  part('cylinder', '#ffb272', x, 1.24, face - 0.116, 0.041, 0.005, 0.041, Math.PI / 2, 0, 0, hot);
  for (const dx of [-0.31, 0.31]) {
    part('box', '#ffba83', x + dx, 0.714, face - 0.067, 0.022, 1.12, 0.033, 0, 0, 0, hot);
  }
  for (let i = -3; i <= 3; i += 1) {
    part('box', '#755067', x + i * 0.063, 0.565, face - 0.088, 0.023, 0.51, 0.025);
  }
  frameSign(parent, x, 0.936, -face + 0.097, '33⅓', 'JUKEBOX', '#fbb780', 0.43, 0.20);
  decal(parent, blob(), '#ff5ca5', 0.22, x + 0.38, 0.082, -s + 0.58, 2.1, 1.6, true);
}

function speaker(part, side, s, accent) {
  const x = side * 4.15;
  part('box', '#292237', x, 0.63, s, 0.73, 1.24, 0.59);
  part('box', '#100e1b', x, 0.64, s - 0.30, 0.59, 1.10, 0.046);
  for (const y of [0.42, 0.91]) {
    part('cylinder', '#684b72', x, y, s - 0.339, 0.23, 0.042, 0.23, Math.PI / 2);
    part('cylinder', '#211b2e', x, y, s - 0.367, 0.192, 0.030, 0.192, Math.PI / 2);
    part('cylinder', '#655276', x, y, s - 0.39, 0.07, 0.027, 0.07, Math.PI / 2);
  }
  part('box', accent, x - side * 0.23, 0.20, s - 0.34, 0.056, 0.034, 0.019, 0, 0, 0, hot);
}

function coaster(parent, part, s) {
  const texture = surface(512, 512, (ctx, w, h) => {
    ctx.translate(w / 2, h / 2);
    ctx.beginPath();
    ctx.arc(0, 0, 231, 0, Math.PI * 2);
    ctx.fillStyle = '#142426';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = mint;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 215, 0, Math.PI * 2);
    ctx.strokeStyle = '#b5ffde';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '800 37px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b5ffde';
    ctx.fillText('SET PINT', 0, -105);
    ctx.fillText('HERE', 0, 131);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#ffd3a2';
    ctx.beginPath();
    ctx.moveTo(-55, -64);
    ctx.lineTo(55, -64);
    ctx.lineTo(37, 72);
    ctx.lineTo(-37, 72);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-46, -33);
    ctx.bezierCurveTo(-20, -50, 5, -7, 48, -34);
    ctx.stroke();
  });
  decal(parent, blob(), '#27ffa4', 0.47, 0, 0.013, -s, 5.4, 4.8);
  decal(parent, texture, '#ffffff', 1, 0, 0.021, -s, 3.16, 3.16);
  for (const side of [-1, 1]) {
    part('box', '#134840', side * 3.09, 1.15, s + 0.45, 0.14, 2.28, 0.18);
    part('box', '#92ffd4', side * 3.09, 1.15, s + 0.331, 0.041, 2.27, 0.04, 0, 0, 0, hot);
  }
  part('box', '#4b1f68', 0, 2.55, s + 0.45, 6.28, 0.53, 0.18);
  part('box', mint, 0, 2.27, s + 0.42, 6.29, 0.036, 0.13, 0, 0, 0, hot);
  frameSign(parent, 0, 2.58, -s - 0.34, 'Last Orders', 'PINT DROP', mint, 3.25, 0.48);
}

function backWall(part, s) {
  part('box', '#332344', 0, 1.39, s, 11.03, 2.78, 0.22);
  part('box', '#25192b', 0, 0.39, s - 0.136, 11.08, 0.78, 0.07);
  part('box', walnut, 0, 0.826, s - 0.144, 11.08, 0.086, 0.09);
  part('box', '#25162f', 0, 1.16, s - 0.167, 3.15, 2.32, 0.14);
  for (let i = 0; i < 17; i += 1) {
    part('box', i % 2 ? '#4e3166' : '#432c58', 0, 0.10 + i * 0.121, s - 0.27, 2.77, 0.048, 0.050);
  }
  for (const side of [-1, 1]) {
    part('box', brass, side * 1.55, 1.158, s - 0.235, 0.07, 2.32, 0.043, 0, 0, 0, alloy);
    part('box', '#815696', side * 2.17, 1.52, s - 0.195, 0.035, 1.52, 0.035);
    part('box', '#33836b', side * 3.09, 1.79, s - 0.196, 0.71, 0.028, 0.075, 0, 0, 0, hot);
    part('box', '#74528b', side * 3.87, 1.79, s - 0.196, 0.72, 0.028, 0.075, 0, 0, 0, hot);
  }
}

export function buildPub(scene, { length }) {
  const pub = new T.Group();
  pub.name = 'The No Return pub';
  scene.add(pub);
  const start = -12;
  const finish = length + 9;
  const bayDepth = 8;
  const floorMap = makeFloor();
  const floorMaterial = new T.MeshStandardMaterial({ map: floorMap, roughness: 0.78 });
  const floorGeometry = new T.PlaneGeometry(laneWidth, bayDepth);
  const tileCoordinates = floorGeometry.getAttribute('uv');
  for (let i = 0; i < tileCoordinates.count; i += 1) {
    tileCoordinates.setY(i, tileCoordinates.getY(i) * (bayDepth / 6.4));
  }

  for (let begin = start; begin < finish; begin += bayDepth) {
    const sector = new T.Group();
    sector.position.z = -begin;
    pub.add(sector);
    const tile = new T.Mesh(floorGeometry, floorMaterial);
    tile.rotation.x = -Math.PI / 2;
    tile.position.z = -bayDepth / 2;
    sector.add(tile);

    const { part, finish: bake } = bay(sector);
    const fraction = begin / length;
    const openingBar = fraction < 0.23;
    const demoRoom = fraction >= 0.60 && fraction < 0.86;
    const sideAccent = demoRoom ? '#ac62ff' : '#40d8a6';

    for (const side of [-1, 1]) {
      wall(part, side, 0, bayDepth);
      for (const s of [0.14, 4.1]) {
        part('box', '#221929', side * 5.07, 1.41, s, 0.32, 2.82, 0.15);
        part('box', brass, side * 5.07, 2.63, s, 0.36, 0.105, 0.20, 0, 0, 0, alloy);
        part('box', '#1a1727', side * 3.54, 0.105, s, 0.35, 0.10, 0.78);
        part('box', side > 0 ? '#60ffc5' : '#b579ff', side * 3.52, 0.164, s, 0.055, 0.03, 0.58, 0, 0, 0, hot);
      }
      decal(sector, blob(), side > 0 ? '#12dc8f' : '#a155ff', 0.18, side * 3.34, 0.015, -5, 2.07, 6.7, true);
    }

    if (openingBar || fraction > 0.86) timberBar(sector, part, 0.30, 7.43, sideAccent);
    if (demoRoom) {
      speaker(part, 1, 2.4, violet);
      speaker(part, -1, 4.1, violet);
      alcove(part, 1, 6.15, '#43456a', '#ebb1ff');
    } else {
      alcove(part, -1, 2.1, openingBar ? '#68466e' : '#614861', '#ffca97');
      if (begin === -4 || (begin >= length * 0.38 && begin - bayDepth < length * 0.38)) {
        jukebox(sector, part, -1, 5.95);
      } else {
        alcove(part, -1, 5.95, '#554065', '#eac0fa');
      }
      if (!openingBar && fraction < 0.86) alcove(part, 1, 4.35, '#335a54', '#caffec');
    }

    if (begin === -4) frameSign(sector, 4.12, 2.66, -6.4, 'The No Return', 'BAR SERVICE', mint, 2.23, 0.68, -0.13);
    if (begin >= length * 0.28 && begin - bayDepth < length * 0.28) {
      frameSign(sector, -4.25, 2.56, -4, 'The Lounge', 'MIND THE ELBOWS', '#ce9dff', 2.3, 0.67, 0.20);
    }
    if (demoRoom && (begin - bayDepth) / length < 0.60) {
      frameSign(sector, 4.19, 2.41, -4.9, 'Demo Row', 'NO OPEN DRINKS', '#d2a6ff', 2.36, 0.68, -0.16);
    }
    if (length >= begin && length < begin + bayDepth) coaster(sector, part, length - begin);
    const endWall = length + 6.6;
    if (endWall >= begin && endWall < begin + bayDepth) backWall(part, endWall - begin);
    bake();
  }

  return pub;
}

function hazardMark(mesh, radius) {
  decal(mesh, blob(), '#090611', 0.83, 0, 0.023, 0.068, radius * 2.7, radius * 2.3);
  const ring = new T.Mesh(
    new T.RingGeometry(radius * 0.98, radius * 1.08, 48),
    new T.MeshBasicMaterial({ color: '#f9ad68', opacity: 0.52, transparent: true, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.033;
  mesh.add(ring);
  mesh.userData.ring = ring;
}

function stool(group) {
  const steel = uniform('#9e8799', 0.35, 0.53);
  const leather = uniform('#b169a9', 0.86);
  object(group, 'cylinder', '#3c263a', 0, 0.654, 0, 0.39, 0.09, 0.39);
  object(group, 'cone', leather, 0, 0.735, 0, 0.39, 0.11, 0.39);
  object(group, 'cylinder', '#a363a0', 0, 0.795, 0, 0.256, 0.015, 0.256);
  object(group, 'rail', steel, 0, 0.288, 0, 0.29, 0.29, 0.29, -Math.PI / 2);
  for (let i = 0; i < 4; i += 1) {
    const a = i * Math.PI / 2 + 0.68;
    object(group, 'cylinder', steel, Math.cos(a) * 0.27, 0.35, Math.sin(a) * 0.27, 0.028, 0.655, 0.028, -Math.sin(a) * 0.16, 0, Math.cos(a) * 0.16);
    object(group, 'cylinder', ink, Math.cos(a) * 0.325, 0.045, Math.sin(a) * 0.325, 0.064, 0.076, 0.064);
  }
}

function screen(status) {
  const key = 'demo ' + status;
  if (plateTextures.has(key)) return plateTextures.get(key);
  const texture = surface(256, 168, (ctx, w, h) => {
    const wet = status === 'wet';
    const mintInk = wet ? '#ffab88' : '#7cfcbe';
    ctx.fillStyle = wet ? '#361d28' : '#1a1933';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = mintInk;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.textAlign = 'center';
    ctx.font = 'bold 25px monospace';
    ctx.fillStyle = mintInk;
    ctx.fillText(wet ? 'SYSTEM ERROR' : 'LIVE DEMO', w / 2, 48);
    ctx.font = 'bold 17px monospace';
    ctx.fillText(wet ? 'LIQUID COOLED' : 'DEPLOYING…', w / 2, 78);
    ctx.fillRect(26, 106, w - 52, 18);
    ctx.fillStyle = wet ? '#6f3046' : violet;
    ctx.fillRect(27, 107, wet ? w - 54 : 172, 16);
    if (wet) {
      for (let i = 0; i < 15; i += 1) {
        const x = (i * 63) % w;
        const y = (i * 53) % h;
        ctx.fillRect(x, y, 22 + i * 3, 2);
      }
      for (const [x, y, r] of [[29, 29, 11], [45, 15, 5], [20, 53, 6], [221, 119, 21], [205, 129, 10], [235, 94, 7]]) {
        ctx.fillStyle = '#ed954c66';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  plateTextures.set(key, texture);
  return texture;
}

function warningPlate() {
  const key = 'demo warning';
  if (!plateTextures.has(key)) {
    plateTextures.set(key, surface(512, 136, (ctx, w, h) => {
      ctx.fillStyle = '#301337';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f884ca';
      ctx.lineWidth = 9;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff1eb';
      ctx.font = '900 55px monospace';
      ctx.fillText('LIQUID COOLED', w / 2, 84);
      ctx.fillStyle = '#fcaecb';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('•  SYSTEM ERROR  •', w / 2, 34);
    }));
  }
  return plateTextures.get(key);
}

function laptop(group) {
  const chrome = uniform('#a9a1c1', 0.34, 0.29);
  object(group, 'box', '#3e3151', 0, 0.48, 0, 0.82, 0.91, 0.65);
  object(group, 'box', '#514763', 0, 0.93, 0, 0.99, 0.10, 0.81);
  for (const x of [-0.40, 0.40]) {
    object(group, 'box', chrome, x, 0.47, 0.336, 0.064, 0.93, 0.046);
    object(group, 'box', chrome, x, 0.12, 0.355, 0.148, 0.14, 0.062);
    object(group, 'box', chrome, x, 0.77, 0.355, 0.136, 0.12, 0.05);
  }
  object(group, 'box', chrome, 0, 1.005, 0.035, 0.81, 0.048, 0.54);
  object(group, 'box', '#29243c', 0, 1.036, -0.039, 0.69, 0.014, 0.235);
  object(group, 'box', '#706787', 0, 1.035, 0.195, 0.25, 0.009, 0.11);
  const lid = new T.Group();
  lid.position.set(0, 1.01, -0.239);
  lid.rotation.x = -0.28;
  group.add(lid);
  object(lid, 'box', chrome, 0, 0.272, 0, 0.81, 0.555, 0.05);
  const display = new T.Mesh(new T.PlaneGeometry(0.746, 0.492), new T.MeshBasicMaterial({
    map: screen('live'),
    toneMapped: false,
  }));
  display.position.set(0, 0.288, 0.029);
  lid.add(display);
  group.userData.display = display;
  group.userData.lid = lid;

  const warning = new T.Group();
  warning.visible = false;
  warning.rotation.x = -0.16;
  warning.rotation.y = 0.10;
  warning.position.z = -0.30;
  group.add(warning);
  object(warning, 'box', '#65335c', 0, 0, 0, 2.40, 0.63, 0.06);
  const label = new T.Mesh(new T.PlaneGeometry(2.38, 0.62), new T.MeshBasicMaterial({
    map: warningPlate(),
    toneMapped: false,
  }));
  label.position.z = 0.034;
  warning.add(label);

  const stand = new T.Group();
  stand.visible = false;
  stand.position.set(0, 1.0, -0.31);
  group.add(stand);
  for (const x of [-0.27, 0.27]) object(stand, 'cylinder', chrome, x, 0.5, 0, 0.022, 1, 0.022);
  group.userData.warning = warning;
  group.userData.stand = stand;
}

function guest(group, hazard) {
  const n = String(hazard.id).split('').reduce((acc, c) => (acc * 17 + c.charCodeAt(0)) >>> 0, 0);
  const look = n % 5;
  const palettes = [
    ['#644bd2', '#bc7d5a', '#27203f', '#6d345b'],
    ['#d5837b', '#e5a87c', '#4f2547', '#352743'],
    ['#219e85', '#7e4335', '#202544', '#183551'],
    ['#a98adf', '#f0b889', '#553143', '#632e65'],
    ['#c58a5c', '#a25e46', '#32344e', '#222330'],
  ];
  const [shirt, skin, trousers, hair] = palettes[look];
  const body = new T.Group();
  group.add(body);
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(side * 0.124, 0.63, 0);
    object(leg, 'leg', trousers, 0, -0.30, 0, 0.41, 0.59, 0.42);
    object(leg, 'ball', '#29233d', 0, -0.546, 0.075, 0.126, 0.079, 0.19);
    object(leg, 'ball', '#ddd6d9', 0, -0.589, 0.091, 0.117, 0.014, 0.171);
    body.add(leg);
    legs.push(leg);
  }
  object(body, 'leg', shirt, 0, 0.91, 0, 1.24, 0.77, 0.87);
  object(body, 'cylinder', skin, 0, 1.27, 0.012, 0.10, 0.19, 0.11);
  object(body, 'ball', skin, 0, 1.46, 0.022, 0.216, 0.243, 0.188);
  object(body, 'ball', skin, 0, 1.446, 0.202, 0.055, 0.044, 0.055);
  for (const side of [-1, 1]) {
    object(body, 'ball', skin, side * 0.207, 1.43, 0.036, 0.044, 0.059, 0.047);
    object(body, 'ball', ink, side * 0.075, 1.508, 0.185, 0.023, 0.031, 0.014);
    object(body, 'ball', '#fff6dd', side * 0.072, 1.518, 0.197, 0.006, 0.008, 0.004);
    object(body, 'box', '#b7ffc4', side * 0.075, 1.13, 0.18, 0.023, 0.267, 0.022, 0, 0, -side * 0.42);
  }
  object(body, 'box', cream, 0, 0.967, 0.202, 0.136, 0.125, 0.023, 0, 0, 0.05);
  object(body, 'box', '#374443', 0, 0.968, 0.217, 0.086, 0.02, 0.013);
  object(body, 'ball', '#763b47', 0.024, 1.381, 0.188, 0.058, 0.024, 0.025, 0, 0, -0.12);
  object(body, 'ball', hair, 0, 1.6, 0.008, 0.227, 0.149, 0.195);

  if (look === 0 || look === 2) {
    object(body, 'ball', hair, 0, 1.584, 0.14, 0.203, 0.033, 0.248, -0.18);
    object(body, 'box', cream, 0, 1.647, 0.192, 0.081, 0.037, 0.012);
  } else if (look === 1 || look === 3) {
    for (let i = 0; i < 5; i += 1) {
      object(body, 'ball', hair, (i - 2) * 0.089, 1.66 + (i % 2) * 0.033, 0.082, 0.089, 0.11, 0.112);
    }
  } else {
    object(body, 'ball', hair, 0, 1.722, -0.054, 0.074, 0.074, 0.074);
    object(body, 'cylinder', '#a381af', 0, 1.584, 0.035, 0.207, 0.032, 0.185);
  }

  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new T.Group();
    arm.position.set(side * 0.249, 1.093, 0);
    arm.rotation.z = side * 0.21;
    object(arm, 'leg', shirt, side * 0.038, -0.175, 0, 0.39, 0.43, 0.40, 0, 0, side * 0.19);
    object(arm, 'ball', skin, side * 0.066, -0.37, 0.011, 0.072, 0.093, 0.082);
    body.add(arm);
    arms.push(arm);
  }
  if (look % 2 === 0) {
    object(arms[1], 'box', '#30263d', 0.116, -0.388, 0.061, 0.081, 0.136, 0.027, 0, -0.12, 0.24);
    object(arms[1], 'box', '#a5ffe9', 0.117, -0.388, 0.076, 0.055, 0.10, 0.007, 0, -0.12, 0.24);
  }
  group.userData.legs = legs;
  group.userData.arms = arms;
  group.userData.phase = (n % 61) / 9;
}

export function createHazard(hazard) {
  const mesh = new T.Group();
  mesh.name = hazard.kind;
  const model = new T.Group();
  mesh.add(model);
  mesh.userData.model = model;
  hazardMark(mesh, hazard.radius);
  const scale = Math.max(0.79, Math.min(1.10, hazard.radius / 0.49));
  model.scale.set(scale, 1, scale);
  if (hazard.kind === 'guest') guest(model, hazard);
  else if (hazard.kind === 'laptop') laptop(model);
  else stool(model);
  bakeModel(model);
  return mesh;
}

export function updateHazard(mesh, hazard, t, { hit = false, reducedMotion = false } = {}) {
  const { model, ring } = mesh.userData;
  if (mesh.userData.wasHit !== Boolean(hit)) {
    ring.material.color.set(hit ? '#ff866a' : '#f9ad68');
    mesh.userData.wasHit = Boolean(hit);
    model.userData.hitAt = hit ? t : undefined;
  }
  const pulse = typeof hit === 'number' ? Math.max(0, Math.min(1, hit)) : hit ? 0.75 : 0;

  if (hazard.kind === 'guest') {
    const { legs, arms, phase } = model.userData;
    const sway = reducedMotion ? 0 : Math.sin(t * 3.3 + phase);
    const stride = reducedMotion ? 0 : Math.sin(t * 9.1 + phase);
    const traverse = hazard.sweep ? hazard.sweep * hazard.frequency * Math.cos(t * hazard.frequency + hazard.phase) : 0;
    model.rotation.y = 0.26 * sway + 0.54 * Math.tanh(traverse * 1.5);
    model.rotation.z = 0.049 * sway + pulse * 0.19;
    model.position.y = Math.abs(stride) * 0.035;
    legs[0].rotation.x = stride * 0.36;
    legs[1].rotation.x = -stride * 0.36;
    arms[0].rotation.x = -stride * 0.29;
    arms[1].rotation.x = stride * 0.24 - 0.18 - pulse * 0.58;
  } else if (hazard.kind === 'laptop') {
    const { display, lid, warning, stand, hitAt } = model.userData;
    const image = screen(hit ? 'wet' : 'live');
    if (display.material.map !== image) display.material.map = image;
    const elapsed = hit ? Math.max(0, t - hitAt) : 0;
    const opening = hit ? (reducedMotion ? 1 : 0.56 + 0.44 * T.MathUtils.smoothstep(elapsed, 0, 0.17)) : 0;
    const recoil = hit && !reducedMotion ? Math.cos(elapsed * 39) * Math.exp(-elapsed * 6.4) * 0.22 : 0;
    lid.rotation.x = -0.28 - pulse * 0.17 - recoil;
    warning.visible = Boolean(hit);
    stand.visible = Boolean(hit);
    warning.position.y = 1.80 + opening * 1.41;
    warning.rotation.z = -recoil * 0.39;
    stand.scale.y = warning.position.y - 1.24;
  } else {
    model.rotation.z = pulse * -0.23;
  }
}
