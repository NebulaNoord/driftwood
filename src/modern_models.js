/* ---------- Modern era buildings ----------
   Same footprints and doors as the medieval ones (front is +z, 1 unit is one cell); brick, siding, concrete and glass instead of timber and thatch. */
const MSIDE = ['#e8e3d7', '#d3dce1', '#e2d3b3', '#c3ceb7', '#ece6dc', '#d8c5be', '#cfd6c9'];
const MBRICK = ['#a65a43', '#8f4f3b', '#b3664c', '#9b5f48'];
const MCONC = ['#cbc6bc', '#bab5ab', '#d6d1c7'];
const MROOF = ['#56595f', '#6b4a3e', '#4b5662', '#6c6f73', '#7b5a48'];
const MDOOR = ['#3f5f7a', '#7a3b33', '#2f4a3a', '#5a4a3f', '#c99a3d'];
const CARS = ['#b8412f', '#2f5f8a', '#e8e4dc', '#3a3d42', '#6f8f5a', '#c9a23c', '#8a8f96'];
const GLASS = '#7d97a8';
function mAt(B, x, z, ry) { B.at(x, 0, z, ry || 0); }
function mReset(B) { B.at(0, 0, 0, 0); }
// windows on every side of a box centred on the origin
function mGrid(W, w, d, y0, floors, fh, ww, wh, sides) {
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * fh + (fh - wh) * 0.55;
    const nx = Math.max(1, Math.floor(w / 0.2)), nz = Math.max(1, Math.floor(d / 0.2));
    for (let k = 0; k < nx; k++) { const x = -w / 2 + (k + 0.5) * w / nx; W.box(x, y, d / 2 + 0.004, ww, wh, 0.012, WIN); if (sides !== 'front') W.box(x, y, -d / 2 - 0.004, ww, wh, 0.012, WIN); }
    if (sides === 'all') for (let k = 0; k < nz; k++) { const z = -d / 2 + (k + 0.5) * d / nz; W.box(w / 2 + 0.004, y, z, 0.012, wh, ww, WIN); W.box(-w / 2 - 0.004, y, z, 0.012, wh, ww, WIN); }
  }
}
// a flat roof with a low parapet and a couple of rooftop units
function mFlat(B, w, d, y, col, units, seed) {
  B.box(0, y, 0, w, 0.02, d, col || '#6b6e70');
  const p = 0.03, c = '#9a958c';
  B.box(0, y, d / 2 - p / 2, w, 0.05, p, c); B.box(0, y, -d / 2 + p / 2, w, 0.05, p, c); B.box(w / 2 - p / 2, y, 0, p, 0.05, d, c); B.box(-w / 2 + p / 2, y, 0, p, 0.05, d, c);
  for (let k = 0; k < (units || 0); k++) { const r = hash((seed || 1) * 7 + k); B.box((r - 0.5) * w * 0.6, y + 0.02, (hash((seed || 1) * 11 + k) - 0.5) * d * 0.6, 0.12, 0.07, 0.1, '#c9cbcc'); }
}
function mCar(B, x, z, ry, col) {
  mAt(B, x, z, ry);
  B.box(0, 0.025, 0, 0.13, 0.055, 0.25, col); B.box(0, 0.08, -0.01, 0.115, 0.05, 0.13, '#a9bccb'); B.box(0, 0.128, -0.01, 0.118, 0.008, 0.13, col);
  for (const [a, b] of [[-0.065, 0.08], [0.065, 0.08], [-0.065, -0.08], [0.065, -0.08]]) B.box(a, 0, b, 0.02, 0.045, 0.05, '#2a2b2e');
  mReset(B);
}
function mTree(B, x, z, s) { B.cyl(x, 0, z, 0.02 * s, 0.018 * s, 0.18 * s, 5, '#6b4a33'); smoothBlob(B, x, 0.24 * s, z, 0.11 * s, 0.11 * s, 0.11 * s, '#5f9a4b', 0); }
function mDoor(B, x, z, col) { B.box(x, 0.02, z, 0.1, 0.17, 0.014, col || '#3f5f7a'); B.box(x, 0.19, z + 0.01, 0.13, 0.015, 0.03, '#d8d3c9'); }
function mLot(B, w, d, z) { B.box(0, 0, z, w, 0.012, d, '#5a5d61'); for (let k = -2; k <= 2; k++) B.box(k * w / 5, 0.013, z, 0.012, 0.004, d * 0.7, '#e8e4dc'); }
function mAwning(B, x, y, z, w, col) { B.at(x, y, z, 0); B.box(0, 0, 0.06, w, 0.012, 0.13, col); B.box(0, -0.035, 0.125, w, 0.035, 0.008, col); mReset(B); }
// a flat round face looking along +z (clocks, signs, wheels, targets)
function mDisc(B, x, y, z, r, col, seg) { const c = hex(col), n = seg || 14; for (let k = 0; k < n; k++) { const a = k / n * 6.283, b = (k + 1) / n * 6.283; B.tri([x, y, z], [x + Math.cos(a) * r, y + Math.sin(a) * r, z], [x + Math.cos(b) * r, y + Math.sin(b) * r, z], c, [x, y, z - 1]); } }
function mFlag(B, x, z, h) { B.box(x, 0, z, 0.018, h, 0.018, '#d0d3d6'); B.box(x + 0.07, h - 0.1, z, 0.12, 0.08, 0.006, '#3d6b8c'); }

function modernModel(type, level, variant) {
  const B = new Builder(), W = new Builder();
  const v = variant | 0, r = k => hash(v * 31 + k * 7 + level), side = MSIDE[v % MSIDE.length], brick = MBRICK[v % MBRICK.length], roof = MROOF[(v >> 2) % MROOF.length];
  const pl = s => B.box(0, -0.04, 0, s, 0.06, s, '#a39c90');
  switch (type) {
    case 'hall': { // civic building with columns, steps, a clock and a flag
      pl(1.94); B.box(0, 0.02, -0.1, 1.5, 0.62, 1.1, '#e3dccd'); mFlat(B, 1.5, 1.1, 0.64, '#8a8f93', 2, 3);
      for (let k = 0; k < 6; k++) B.cyl(-0.55 + k * 0.22, 0.06, 0.55, 0.035, 0.035, 0.5, 8, '#f2ede3');
      B.box(0, 0.56, 0.55, 1.3, 0.08, 0.12, '#f2ede3'); B.gable(0, 0.64, 0.5, 1.3, 0.22, 0.2, '#e3dccd');
      B.box(0, 0.02, 0.72, 1.1, 0.04, 0.2, '#d6d1c7'); B.box(0, 0.06, 0.66, 1.0, 0.04, 0.12, '#d6d1c7');
      B.box(0, 0.66, -0.15, 0.36, 0.4, 0.36, '#e3dccd'); B.cyl(0, 1.06, -0.15, 0.2, 0.04, 0.24, 10, '#5d7f74');
      mDisc(B, 0, 0.85, 0.035, 0.09, '#fbf7ee');
      mDoor(B, 0, 0.4, '#5a3f2e'); mGrid(W, 1.5, 1.1, 0.06, 2, 0.28, 0.07, 0.16, 'all');
      break;
    }
    case 'house': {
      const sh = v % 3, col = side, door = MDOOR[v % MDOOR.length];
      if (level === 0) { // bungalow with a driveway
        pl(0.86); B.box(-0.05, 0.02, -0.06, 0.56, 0.34, 0.48, col); B.gable(-0.05, 0.36, -0.06, 0.64, 0.22, 0.56, roof, col);
        mDoor(B, -0.05, 0.181, door); frontWins(W, 0.181, [0.17], [-0.24, 0.14], 0.12, 0.1);
        B.box(0.32, 0.012, 0.12, 0.16, 0.01, 0.6, '#b9b4ab'); if (r(1) < 0.6) mCar(B, 0.32, 0.12, 0, CARS[v % CARS.length]);
        B.box(-0.38, 0.02, 0.36, 0.03, 0.12, 0.03, '#6b4a33'); B.box(-0.38, 0.13, 0.36, 0.05, 0.04, 0.08, '#3a5a7a');
      } else if (level === 1) { // two storeys and a garage
        pl(0.9); B.box(-0.08, 0.02, -0.06, 0.52, 0.66, 0.5, col); B.gable(-0.08, 0.68, -0.06, 0.6, 0.24, 0.58, roof, col);
        B.box(0.3, 0.02, 0.0, 0.26, 0.3, 0.42, col); B.box(0.3, 0.32, 0.0, 0.3, 0.03, 0.46, roof); B.box(0.3, 0.03, 0.211, 0.2, 0.22, 0.012, '#e5e1d8');
        for (let k = 0; k < 3; k++) B.box(0.3, 0.08 + k * 0.06, 0.218, 0.2, 0.006, 0.006, '#c9c4bb');
        mDoor(B, -0.08, 0.191, door); frontWins(W, 0.191, [0.2, 0.47], [-0.25, 0.08], 0.11, 0.11);
        if (sh === 1) { B.box(-0.08, 0.02, 0.27, 0.44, 0.02, 0.14, '#b9a688'); B.box(-0.08, 0.28, 0.27, 0.48, 0.02, 0.16, roof); for (const x of [-0.27, 0.11]) B.box(x, 0.04, 0.33, 0.02, 0.24, 0.02, '#f2ede3'); }
      } else { // big detached home with porch and a tree
        pl(0.96); B.box(-0.12, 0.02, -0.08, 0.6, 0.68, 0.56, col); B.gable(-0.12, 0.7, -0.08, 0.68, 0.26, 0.64, roof, col);
        B.box(0.28, 0.02, -0.1, 0.32, 0.5, 0.48, col); B.gable(0.28, 0.52, -0.1, 0.36, 0.18, 0.52, roof, col);
        B.box(-0.12, 0.02, 0.27, 0.6, 0.03, 0.16, '#b9a688'); B.box(-0.12, 0.3, 0.27, 0.64, 0.025, 0.18, roof);
        for (const x of [-0.38, -0.12, 0.14]) B.box(x, 0.05, 0.34, 0.025, 0.25, 0.025, '#f2ede3');
        mDoor(B, -0.12, 0.201, door); frontWins(W, 0.201, [0.2, 0.48], [-0.33, 0.09], 0.11, 0.12); frontWins(W, 0.141, [0.2], [0.28], 0.14, 0.12);
        mTree(B, 0.36, 0.34, 0.9);
      }
      break;
    }
    case 'fishhut': {
      for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) B.box(x, -0.2, z, 0.04, 0.32, 0.04, '#6b5a4a');
      B.box(0, 0.1, 0, 0.56, 0.04, 0.5, '#a08a70'); B.box(0, 0.14, -0.04, 0.46, 0.3, 0.4, ['#8fb6c9', '#e8c9a0', '#c9d9b4'][v % 3]);
      B.box(0, 0.44, -0.04, 0.54, 0.03, 0.48, '#c4c8cc'); mDoor(B, 0.1, 0.161, '#e8e3d7'); frontWins(W, 0.161, [0.27], [-0.12], 0.1, 0.09);
      break;
    }
    case 'rowhouse': { // three brick townhouses with stoops and their own doors
      pl(1.94);
      for (let k = 0; k < 3; k++) {
        const x = -0.6 + k * 0.6, h = 0.92 + r(k) * 0.18, col = MBRICK[(v + k) % MBRICK.length];
        B.box(x, 0.02, -0.12, 0.58, h, 1.1, col); mFlat(B, 0.58, 1.1, h + 0.02, '#5d6064', 1, v + k);
        B.box(x, 0.02, 0.48, 0.24, 0.08, 0.12, '#cbc6bc'); mDoor(B, x + 0.08, 0.432, MDOOR[(v + k) % MDOOR.length]);
        for (let f = 0; f < 3; f++) { W.box(x - 0.13, 0.12 + f * 0.27, 0.434, 0.12, 0.16, 0.012, WIN); if (f) W.box(x + 0.1, 0.12 + f * 0.27, 0.434, 0.12, 0.16, 0.012, WIN); }
        B.box(x, h - 0.06, 0.43, 0.58, 0.05, 0.02, '#e3ddd1');
      }
      break;
    }
    case 'villa': { // mansion: portico, hip roof, a pool at the back
      pl(1.94); B.box(0, 0.02, -0.15, 1.3, 0.72, 0.9, '#f1ece2'); B.cyl(0, 0.74, -0.15, 0.95, 0.5, 0.3, 4, roof, null, Math.PI / 4);
      for (let k = 0; k < 4; k++) B.cyl(-0.3 + k * 0.2, 0.04, 0.4, 0.03, 0.03, 0.66, 8, '#ffffff');
      B.box(0, 0.7, 0.38, 0.75, 0.06, 0.2, '#ffffff'); B.box(0, 0.02, 0.42, 0.8, 0.03, 0.26, '#d6d1c7');
      mDoor(B, 0, 0.301, '#2f3a45'); mGrid(W, 1.3, 0.9, 0.08, 2, 0.32, 0.1, 0.18, 'all');
      B.box(-0.3, -0.005, -0.8, 0.9, 0.03, 0.3, '#4fa3c7'); B.box(-0.3, -0.01, -0.8, 1.0, 0.025, 0.38, '#e3ddd1');
      for (const x of [-0.85, 0.85]) mTree(B, x, 0.6, 1.1);
      break;
    }
    case 'apartment': { // five floors with balconies and a water tank on the roof
      pl(1.94); const h = 1.9;
      B.box(0, 0.02, -0.05, 1.5, h, 1.3, MCONC[v % 3]); mFlat(B, 1.5, 1.3, h + 0.02, '#5d6064', 3, v);
      mGrid(W, 1.5, 1.3, 0.1, 5, 0.36, 0.12, 0.2, 'all');
      for (let f = 1; f < 5; f++) for (let k = 0; k < 3; k++) B.box(-0.5 + k * 0.5, 0.06 + f * 0.36, 0.66, 0.36, 0.025, 0.16, '#a9a49b');
      B.cyl(0.4, h + 0.05, -0.3, 0.14, 0.14, 0.22, 10, '#8a6a4f'); B.cyl(0.4, h + 0.27, -0.3, 0.16, 0, 0.1, 10, '#6b4a33');
      B.box(0, 0.02, 0.66, 0.4, 0.26, 0.04, '#7d97a8'); B.box(0, 0.3, 0.7, 0.5, 0.03, 0.12, '#3f4652');
      break;
    }
    case 'lumber': { // shed, stacked logs and a forklift
      pl(0.94); B.box(-0.18, 0.02, -0.18, 0.5, 0.36, 0.44, '#8f6e52'); B.box(-0.18, 0.38, -0.18, 0.56, 0.03, 0.5, '#7d8287');
      for (let k = 0; k < 3; k++) logX(B, 0.22, 0.05 + k * 0.08, 0.1 + (k % 2) * 0.04, 0.42, 0.04, '#8a5a3a');
      B.box(0.2, 0.02, -0.28, 0.14, 0.12, 0.22, '#e3b23c'); B.box(0.2, 0.14, -0.33, 0.1, 0.1, 0.08, '#2f3a45'); B.box(0.2, 0.02, -0.14, 0.12, 0.2, 0.02, '#3a3d42');
      break;
    }
    case 'farm': { // barn, silo and tractor in the corner, fields everywhere else
      B.box(-1.05, 0.02, 1.0, 0.7, 0.5, 0.6, '#a63d32'); B.gable(-1.05, 0.52, 1.0, 0.76, 0.3, 0.66, '#5c5f63', '#a63d32');
      B.box(-1.05, 0.04, 1.31, 0.28, 0.32, 0.012, '#f2ede3');
      B.cyl(-1.18, 0.02, 0.45, 0.16, 0.16, 0.95, 12, '#c9cbcc'); smoothBlob(B, -1.18, 0.97, 0.45, 0.16, 0.12, 0.16, '#b0b3b6', 0);
      mAt(B, -0.55, 1.2, 0.6); B.box(0, 0.06, 0, 0.14, 0.1, 0.2, '#3f7d4e'); B.box(0, 0.16, -0.04, 0.1, 0.1, 0.09, '#a9bccb');
      B.box(-0.08, 0.01, 0.06, 0.03, 0.14, 0.14, '#2a2b2e'); B.box(0.08, 0.01, 0.06, 0.03, 0.14, 0.14, '#2a2b2e'); mReset(B);
      break;
    }
    case 'orchard': {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const x = -0.6 + i * 0.6, z = -0.6 + j * 0.55; B.cyl(x, 0, z, 0.03, 0.025, 0.2, 5, '#6b4a33'); smoothBlob(B, x, 0.3, z, 0.17, 0.15, 0.17, '#5c9a48', 0); for (let k = 0; k < 3; k++) B.box(x + (hash(i * 9 + j * 3 + k) - 0.5) * 0.24, 0.26 + hash(k + i) * 0.1, z + 0.15, 0.04, 0.04, 0.04, '#d9452f'); }
      B.box(0.7, 0.02, 0.75, 0.3, 0.24, 0.26, '#d9cdb4'); B.box(0.7, 0.26, 0.75, 0.34, 0.03, 0.3, '#7d8287');
      for (let k = 0; k < 3; k++) B.box(0.38 + k * 0.1, 0.02, 0.85, 0.08, 0.07, 0.1, '#b07b4f');
      break;
    }
    case 'dock': { // concrete fishing pier with a hut and nets
      B.box(0, -0.25, 0.1, 0.46, 0.33, 0.9, '#bdb8af'); B.box(0, 0.08, 0.1, 0.48, 0.02, 0.92, '#d0cbc2');
      B.box(-0.1, 0.1, -0.22, 0.24, 0.24, 0.22, '#5b7d93'); B.box(-0.1, 0.34, -0.22, 0.28, 0.025, 0.26, '#7d8287');
      for (const z of [0.2, 0.5]) B.cyl(0.18, 0.1, z, 0.025, 0.03, 0.08, 6, '#3a3d42');
      B.box(0.12, 0.1, -0.12, 0.12, 0.05, 0.12, '#e3b23c');
      break;
    }
    case 'bakery': {
      pl(0.94); B.box(0, 0.02, -0.04, 0.68, 0.5, 0.56, '#efe2c8'); mFlat(B, 0.68, 0.56, 0.52, '#6b6e70', 1, v);
      B.box(0, 0.4, 0.245, 0.68, 0.1, 0.02, '#8a3b2f'); mAwning(B, 0, 0.36, 0.245, 0.6, '#c9573f');
      W.box(-0.17, 0.08, 0.25, 0.26, 0.22, 0.012, WIN); mDoor(B, 0.18, 0.241, '#5a3f2e');
      break;
    }
    case 'sawmill': { // timber mill: sawtooth roof, stacks of boards
      pl(1.94); B.box(0, 0.02, -0.15, 1.4, 0.5, 1.2, '#8a8d91');
      for (let k = 0; k < 4; k++) { B.at(-0.525 + k * 0.35, 0.52, -0.15, 0); B.quad([-0.175, 0, -0.6], [-0.175, 0, 0.6], [0.175, 0.2, 0.6], [0.175, 0.2, -0.6], hex('#6d7176'), [0, -1, 0]); B.box(0.17, 0, 0, 0.012, 0.2, 1.2, '#a9bccb'); mReset(B); }
      for (let k = 0; k < 3; k++) B.box(-0.4 + k * 0.4, 0.02, 0.65, 0.3, 0.1 + k * 0.03, 0.22, '#d8b98a');
      B.box(0, 0.02, 0.455, 0.4, 0.32, 0.012, '#c9c4bb'); mGrid(W, 1.4, 1.2, 0.08, 1, 0.3, 0.12, 0.12, 'front');
      break;
    }
    case 'quarry': { // excavator and gravel heaps
      for (let k = 0; k < 3; k++) smoothBlob(B, -0.5 + k * 0.45, 0.04, -0.4 + (k % 2) * 0.3, 0.3, 0.18 + k * 0.04, 0.26, ['#b3ac9e', '#a39c90', '#c2bbad'][k], 0);
      mAt(B, 0.4, 0.45, -0.6); B.box(0, 0.02, 0, 0.26, 0.08, 0.34, '#2f3236'); B.box(0, 0.1, 0, 0.24, 0.14, 0.24, '#e3b23c'); B.box(0.05, 0.24, 0.02, 0.1, 0.1, 0.1, '#a9bccb');
      B.beam([-0.05, 0.2, 0.1], [-0.05, 0.42, 0.42], 0.05, 0.05, '#e3b23c'); B.beam([-0.05, 0.42, 0.42], [-0.05, 0.12, 0.62], 0.04, 0.04, '#e3b23c'); B.box(-0.05, 0.04, 0.62, 0.12, 0.08, 0.1, '#5a5d61'); mReset(B);
      B.box(-0.5, 0.02, 0.7, 0.4, 0.22, 0.26, '#cbc6bc'); B.box(-0.5, 0.24, 0.7, 0.44, 0.02, 0.3, '#7d8287');
      break;
    }
    case 'mine': { // headframe tower over the shaft
      pl(1.94); B.box(-0.35, 0.02, 0.3, 0.7, 0.4, 0.6, '#a65a43'); mFlat(B, 0.7, 0.6, 0.42, '#5d6064', 1, v);
      for (const [x, z] of [[0.25, -0.55], [0.75, -0.55], [0.25, -0.05], [0.75, -0.05]]) B.beam([x, 0, z], [0.5, 1.4, -0.3], 0.04, 0.04, '#6d7176');
      mDisc(B, 0.5, 1.35, -0.28, 0.16, '#3a3d42'); mDisc(B, 0.5, 1.35, -0.32, 0.16, '#3a3d42'); mGrid(W, 0.7, 0.6, 0.08, 1, 0.3, 0.1, 0.12, 'front');
      break;
    }
    case 'blacksmith': { // auto garage: roll-up doors, a car on the forecourt, tyres
      pl(0.94); B.box(0, 0.02, -0.08, 0.72, 0.42, 0.56, '#d6d1c7'); mFlat(B, 0.72, 0.56, 0.44, '#6b6e70', 0, v);
      B.box(0, 0.34, 0.205, 0.72, 0.07, 0.02, '#c9573f');
      for (const x of [-0.18, 0.18]) { B.box(x, 0.02, 0.205, 0.28, 0.28, 0.012, '#b9bcbf'); for (let k = 0; k < 4; k++) B.box(x, 0.06 + k * 0.06, 0.212, 0.28, 0.006, 0.006, '#9a9da0'); }
      mCar(B, 0.2, 0.36, 0.2, CARS[(v + 3) % CARS.length]); for (let k = 0; k < 3; k++) B.cyl(-0.33, 0.02 + k * 0.04, 0.33, 0.05, 0.05, 0.035, 10, '#2a2b2e');
      break;
    }
    case 'office': { // glass office block with a canopy
      pl(1.94); const h = 2.3;
      B.box(0, 0.02, -0.05, 1.3, h, 1.2, '#8fa6b4'); mFlat(B, 1.3, 1.2, h + 0.02, '#5d6064', 3, v + 2);
      for (let f = 0; f < 7; f++) B.box(0, 0.3 + f * 0.31, -0.05, 1.32, 0.03, 1.22, '#d6d9db');
      mGrid(W, 1.3, 1.2, 0.08, 7, 0.31, 0.16, 0.22, 'all');
      B.box(0, 0.32, 0.65, 0.7, 0.03, 0.22, '#d6d9db'); B.box(0, 0.02, 0.556, 0.36, 0.28, 0.012, '#a9bccb');
      for (const x of [-0.75, 0.75]) mTree(B, x, 0.75, 0.9);
      break;
    }
    case 'factory': { // sawtooth hall, two chimneys, a loading dock and a truck
      pl(1.94); B.box(-0.1, 0.02, -0.1, 1.5, 0.6, 1.3, '#b8b3aa');
      for (let k = 0; k < 4; k++) { B.at(-0.6 + k * 0.38, 0.62, -0.1, 0); B.quad([-0.19, 0, -0.65], [-0.19, 0, 0.65], [0.19, 0.22, 0.65], [0.19, 0.22, -0.65], hex('#7b7f84'), [0, -1, 0]); B.box(0.185, 0, 0, 0.012, 0.22, 1.3, '#9fb6c4'); mReset(B); }
      B.cyl(0.75, 0.02, -0.6, 0.1, 0.08, 1.7, 10, '#a65a43'); B.cyl(0.75, 1.62, -0.6, 0.11, 0.11, 0.06, 10, '#3a3d42');
      B.cyl(0.45, 0.02, -0.75, 0.08, 0.065, 1.35, 10, '#a65a43');
      B.box(-0.3, 0.02, 0.58, 0.6, 0.14, 0.12, '#9a958c'); for (const x of [-0.45, -0.15]) B.box(x, 0.16, 0.556, 0.24, 0.3, 0.012, '#8a8d91');
      mAt(B, 0.45, 0.8, 0); B.box(0, 0.03, 0.1, 0.2, 0.2, 0.42, '#e8e4dc'); B.box(0, 0.03, -0.2, 0.18, 0.16, 0.16, '#2f5f8a'); mReset(B);
      mGrid(W, 1.5, 1.3, 0.1, 1, 0.4, 0.14, 0.14, 'front');
      break;
    }
    case 'store': { // corner shop with an awning
      pl(0.94); B.box(0, 0.02, -0.05, 0.64, 0.42, 0.54, MSIDE[(v + 2) % 7]); mFlat(B, 0.64, 0.54, 0.44, '#6b6e70', 1, v);
      B.box(0, 0.34, 0.225, 0.64, 0.08, 0.02, ['#2f7c78', '#b5523b', '#d9a441'][v % 3]); mAwning(B, 0, 0.3, 0.225, 0.56, ['#2f7c78', '#b5523b', '#d9a441'][v % 3]);
      W.box(-0.14, 0.06, 0.232, 0.28, 0.2, 0.012, WIN); mDoor(B, 0.18, 0.221, '#a9bccb');
      B.box(-0.3, 0.02, 0.33, 0.1, 0.16, 0.06, '#d6d1c7');
      break;
    }
    case 'stable': { // trucking depot
      pl(1.94); B.box(-0.2, 0.02, -0.4, 1.4, 0.6, 0.9, '#9fa6ad'); mFlat(B, 1.4, 0.9, 0.62, '#5d6064', 2, v);
      for (let k = 0; k < 3; k++) B.box(-0.65 + k * 0.45, 0.02, 0.055, 0.34, 0.42, 0.012, '#c9cbcc');
      for (let k = 0; k < 2; k++) { mAt(B, -0.3 + k * 0.6, 0.55, 0); B.box(0, 0.03, -0.05, 0.22, 0.24, 0.5, ['#e8e4dc', '#b8412f'][k]); B.box(0, 0.03, 0.27, 0.2, 0.18, 0.16, '#2f5f8a'); B.box(0, 0.13, 0.355, 0.18, 0.06, 0.006, '#a9bccb'); mReset(B); }
      break;
    }
    case 'shipyard': { // dry dock with a gantry crane
      B.box(0, -0.2, 0, 1.8, 0.24, 1.8, '#bdb8af'); B.box(0, -0.15, 0.1, 0.9, 0.2, 1.5, '#7d97a8');
      B.at(0, 0, 0.1, 0); B.box(0, 0.0, 0, 0.5, 0.25, 1.1, '#5d6064'); B.box(0, 0.25, 0.1, 0.3, 0.16, 0.4, '#e8e4dc'); mReset(B);
      for (const x of [-0.6, 0.6]) B.box(x, 0, -0.3, 0.06, 1.3, 0.06, '#e3b23c'); B.box(0, 1.3, -0.3, 1.3, 0.08, 0.1, '#e3b23c'); B.box(0.2, 1.2, -0.3, 0.12, 0.12, 0.14, '#3a3d42');
      break;
    }
    case 'market': { // strip mall: a row of shops and a car park
      pl(1.94); B.box(0, 0.02, -0.45, 1.8, 0.48, 0.9, '#e3ddd1'); mFlat(B, 1.8, 0.9, 0.5, '#6b6e70', 3, v);
      const C = ['#b5523b', '#2f7c78', '#d9a441', '#4f6d8a'];
      for (let k = 0; k < 4; k++) { const x = -0.675 + k * 0.45; B.box(x, 0.38, 0.005, 0.42, 0.09, 0.02, C[k]); W.box(x - 0.06, 0.06, 0.012, 0.24, 0.24, 0.012, WIN); B.box(x + 0.13, 0.02, 0.012, 0.09, 0.26, 0.012, '#a9bccb'); }
      B.box(0, 0.33, 0.07, 1.8, 0.02, 0.14, '#d6d1c7');
      mLot(B, 1.8, 0.75, 0.55); for (let k = 0; k < 4; k++) if (r(k) < 0.7) mCar(B, -0.72 + k * 0.48, 0.55, 0, CARS[(v + k) % CARS.length]);
      break;
    }
    case 'well': { // water tower
      for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) B.beam([x, 0, z], [x * 0.6, 0.9, z * 0.6], 0.03, 0.03, '#8a8f96');
      B.cyl(0, 0.9, 0, 0.26, 0.26, 0.34, 14, '#cfd6d9'); B.cyl(0, 1.24, 0, 0.28, 0.02, 0.14, 14, '#a9b1b6'); B.cyl(0, 1.0, 0, 0.265, 0.265, 0.05, 14, '#3f6f8a');
      break;
    }
    case 'garden': { // park
      B.box(0, -0.005, 0, 0.92, 0.02, 0.92, '#7fae5a'); B.box(0, 0.006, 0, 0.12, 0.005, 0.92, '#d6cdb8'); B.box(0, 0.006, 0, 0.92, 0.005, 0.12, '#d6cdb8');
      for (const [x, z] of [[-0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]) mTree(B, x, z, 1.1);
      B.cyl(0.28, 0.01, -0.28, 0.12, 0.12, 0.06, 12, '#cbc6bc'); B.cyl(0.28, 0.05, -0.28, 0.1, 0.1, 0.012, 12, '#6fb3d2');
      bench(B, 0.12, 0.3, 0);
      break;
    }
    case 'plaza': { // town square
      B.box(0, -0.005, 0, 1.9, 0.025, 1.9, '#d6d1c7');
      for (let i = -3; i <= 3; i++) { B.box(i * 0.27, 0.021, 0, 0.008, 0.003, 1.9, '#bdb8af'); B.box(0, 0.021, i * 0.27, 1.9, 0.003, 0.008, '#bdb8af'); }
      B.cyl(0, 0.02, 0, 0.36, 0.38, 0.1, 16, '#cbc6bc'); B.cyl(0, 0.1, 0, 0.32, 0.32, 0.01, 16, '#6fb3d2'); B.cyl(0, 0.1, 0, 0.05, 0.04, 0.42, 8, '#cbc6bc'); B.cyl(0, 0.52, 0, 0.14, 0.05, 0.06, 10, '#cbc6bc');
      for (const [x, z] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) mTree(B, x, z, 1.2);
      for (const a of [0, 1, 2, 3]) lantern(B, W, Math.cos(a * 1.571 + 0.785) * 0.62, 0.02, Math.sin(a * 1.571 + 0.785) * 0.62, 0.5);
      break;
    }
    case 'clinic': { // hospital with a red cross and an ambulance bay
      pl(0.94); B.box(0, 0.02, -0.1, 0.78, 0.9, 0.6, '#f2f0ea'); mFlat(B, 0.78, 0.6, 0.92, '#6b6e70', 1, v);
      B.box(0, 0.62, 0.205, 0.22, 0.07, 0.012, '#c8372d'); B.box(0, 0.555, 0.205, 0.07, 0.2, 0.012, '#c8372d');
      mGrid(W, 0.78, 0.6, 0.06, 3, 0.28, 0.09, 0.14, 'all');
      B.box(0, 0.24, 0.27, 0.5, 0.025, 0.16, '#d6d9db'); mAt(B, 0.28, 0.38, 1.571); B.box(0, 0.03, 0, 0.13, 0.12, 0.26, '#f4f2ec'); B.box(0, 0.09, 0.0, 0.135, 0.02, 0.27, '#c8372d'); mReset(B);
      break;
    }
    case 'tavern': { // fast food: low building, a tall sign, a drive-through and outside tables
      pl(1.94); B.box(-0.2, 0.02, -0.25, 1.2, 0.46, 1.0, '#ece6dc'); B.box(-0.2, 0.46, -0.25, 1.24, 0.1, 1.04, '#c8372d'); mFlat(B, 1.2, 1.0, 0.56, '#6b6e70', 2, v);
      W.box(-0.2, 0.08, 0.256, 0.9, 0.26, 0.012, WIN); mDoor(B, 0.25, 0.252, '#a9bccb');
      B.box(0.78, 0, 0.62, 0.05, 1.3, 0.05, '#8a8f96'); mDisc(B, 0.78, 1.42, 0.65, 0.2, '#e7b52b', 16); mDisc(B, 0.78, 1.42, 0.655, 0.12, '#c8372d', 16);
      B.box(0.75, 0.005, -0.2, 0.3, 0.01, 1.4, '#5a5d61');
      for (const x of [-0.6, -0.2]) { B.cyl(x, 0.02, 0.65, 0.12, 0.12, 0.012, 10, '#d6d1c7'); B.cyl(x, 0.02, 0.65, 0.015, 0.015, 0.16, 6, '#8a8f96'); B.cyl(x, 0.18, 0.65, 0.13, 0.13, 0.012, 10, '#e8e4dc'); B.cyl(x, 0.19, 0.65, 0.01, 0.01, 0.3, 4, '#8a8f96'); B.cyl(x, 0.48, 0.65, 0.18, 0, 0.08, 8, ['#c8372d', '#e7b52b'][x < -0.4 ? 0 : 1]); }
      if (r(2) < 0.7) mCar(B, 0.75, 0.0, 0, CARS[(v + 1) % CARS.length]);
      break;
    }
    case 'chapel': { // church with a steeple
      pl(1.94); B.box(0, 0.02, -0.2, 1.0, 0.7, 1.3, '#f1ece2'); B.gable(0, 0.72, -0.2, 1.1, 0.45, 1.4, '#55585e', '#f1ece2');
      B.box(0, 0.02, 0.6, 0.38, 1.25, 0.38, '#f1ece2'); B.cyl(0, 1.27, 0.6, 0.27, 0, 0.75, 4, '#55585e', null, Math.PI / 4);
      B.box(0, 2.0, 0.6, 0.025, 0.2, 0.025, '#d9b45a'); B.box(0, 2.1, 0.6, 0.12, 0.025, 0.025, '#d9b45a');
      mDoor(B, 0, 0.792, '#7a3b33');
      for (let k = 0; k < 4; k++) { W.box(0.505, 0.2, -0.75 + k * 0.36, 0.012, 0.32, 0.1, '#e8d38a'); W.box(-0.505, 0.2, -0.75 + k * 0.36, 0.012, 0.32, 0.1, '#e8d38a'); }
      break;
    }
    case 'school': { // brick school, flagpole, yellow bus, playground
      pl(1.94); B.box(-0.1, 0.02, -0.3, 1.5, 0.75, 0.9, '#b3664c'); mFlat(B, 1.5, 0.9, 0.77, '#5d6064', 2, v);
      B.box(-0.1, 0.62, 0.155, 1.5, 0.04, 0.02, '#e3ddd1'); mGrid(W, 1.5, 0.9, 0.06, 2, 0.34, 0.16, 0.2, 'all');
      B.box(-0.1, 0.02, 0.16, 0.3, 0.32, 0.03, '#e3ddd1'); mDoor(B, -0.1, 0.18, '#3f5f7a');
      mFlag(B, -0.85, 0.5, 1.0);
      mAt(B, 0.55, 0.62, 1.571); B.box(0, 0.03, 0, 0.18, 0.16, 0.6, '#e7b52b'); B.box(0, 0.13, 0, 0.185, 0.05, 0.56, '#a9bccb'); B.box(0, 0.03, 0.31, 0.16, 0.08, 0.02, '#3a3d42'); mReset(B);
      B.box(-0.35, 0.02, 0.68, 0.06, 0.32, 0.06, '#c8372d'); B.beam([-0.35, 0.3, 0.68], [-0.05, 0.02, 0.68], 0.06, 0.03, '#d9a441');
      break;
    }
    case 'library': { // stone library with columns
      pl(1.94); B.box(0, 0.02, -0.1, 1.5, 0.7, 1.2, '#d9d2c3'); mFlat(B, 1.5, 1.2, 0.72, '#7d8287', 1, v);
      for (let k = 0; k < 5; k++) B.cyl(-0.5 + k * 0.25, 0.05, 0.6, 0.04, 0.04, 0.58, 8, '#f1ece2');
      B.box(0, 0.62, 0.6, 1.2, 0.08, 0.14, '#f1ece2'); B.box(0, 0.02, 0.7, 1.2, 0.04, 0.14, '#cbc6bc');
      mDoor(B, 0, 0.502, '#5a3f2e'); mGrid(W, 1.5, 1.2, 0.1, 2, 0.28, 0.08, 0.18, 'all');
      break;
    }
    case 'academy': { // university with a clock tower
      pl(1.94); B.box(0, 0.02, -0.2, 1.7, 0.9, 1.1, '#b3664c'); mFlat(B, 1.7, 1.1, 0.92, '#5d6064', 2, v);
      B.box(0, 0.02, 0.5, 0.4, 1.7, 0.4, '#b3664c'); B.cyl(0, 1.72, 0.5, 0.3, 0, 0.4, 4, '#4f6e66', null, Math.PI / 4);
      mDisc(B, 0, 1.4, 0.705, 0.1, '#fbf7ee');
      mGrid(W, 1.7, 1.1, 0.08, 3, 0.28, 0.1, 0.16, 'all'); mDoor(B, 0, 0.702, '#3f4652');
      break;
    }
    case 'port': { // ferry port: glass terminal, gangway and a crane
      pl(1.94); B.box(-0.35, 0.02, -0.4, 1.1, 0.55, 0.9, '#cfd6d9'); B.box(-0.35, 0.57, -0.4, 1.2, 0.04, 1.0, '#5d6064');
      mGrid(W, 1.1, 0.9, 0.08, 1, 0.45, 0.2, 0.32, 'all');
      B.box(0.4, 0.2, 0.6, 0.22, 0.04, 0.8, '#8a8f96'); for (const x of [0.3, 0.5]) B.box(x, 0.24, 0.6, 0.012, 0.1, 0.8, '#c9cbcc');
      B.box(0.65, 0, -0.6, 0.06, 1.4, 0.06, '#e3b23c');
      break;
    }
    case 'pier': { // ferry landing: concrete jetty and a ticket booth
      B.box(0, -0.3, 0.1, 0.5, 0.42, 1.0, '#bdb8af'); B.box(0, 0.11, 0.1, 0.52, 0.02, 1.02, '#d0cbc2');
      B.box(0, 0.13, -0.25, 0.22, 0.24, 0.2, '#e8e4dc'); B.box(0, 0.37, -0.25, 0.26, 0.025, 0.24, '#2f7c78'); W.box(0, 0.22, -0.145, 0.12, 0.08, 0.012, WIN);
      for (const z of [0.2, 0.5]) { B.cyl(0.22, 0.12, z, 0.025, 0.03, 0.08, 6, '#3a3d42'); B.cyl(-0.22, 0.12, z, 0.025, 0.03, 0.08, 6, '#3a3d42'); }
      break;
    }
    case 'watchtower': { // guard tower: steel legs, a cabin and a searchlight
      for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) B.beam([x, 0, z], [x * 0.7, 1.2, z * 0.7], 0.035, 0.035, '#6d7176');
      B.box(0, 1.2, 0, 0.42, 0.04, 0.42, '#5d6064'); B.box(0, 1.24, 0, 0.36, 0.28, 0.36, '#8a9a84'); B.box(0, 1.52, 0, 0.44, 0.03, 0.44, '#5d6064');
      W.box(0, 1.34, 0.185, 0.28, 0.1, 0.012, WIN); B.cyl(0.18, 1.55, 0.18, 0.05, 0.06, 0.08, 8, '#e8e4dc');
      break;
    }
    case 'guardhouse': { // police station: blue band and two patrol cars
      pl(0.94); B.box(0, 0.02, -0.1, 0.76, 0.5, 0.5, '#e3ddd1'); mFlat(B, 0.76, 0.5, 0.52, '#5d6064', 1, v);
      B.box(0, 0.36, 0.155, 0.76, 0.09, 0.02, '#2f4f8a'); mDoor(B, 0, 0.152, '#2f4f8a'); frontWins(W, 0.152, [0.18], [-0.24, 0.24], 0.13, 0.1);
      for (const x of [-0.2, 0.2]) { mCar(B, x, 0.33, 1.571, '#f4f2ec'); B.box(x, 0.138, 0.33, 0.1, 0.02, 0.03, '#c8372d'); }
      break;
    }
    case 'barracks': { // army barracks: concrete blocks, sandbags, a jeep, the flag
      pl(1.94); B.box(-0.3, 0.02, -0.35, 1.2, 0.45, 0.8, '#9aa088'); B.box(-0.3, 0.47, -0.35, 1.26, 0.04, 0.86, '#5d6458');
      mGrid(W, 1.2, 0.8, 0.08, 1, 0.35, 0.12, 0.12, 'front'); mDoor(B, -0.3, 0.052, '#4d5a44');
      for (let k = 0; k < 6; k++) smoothBlob(B, 0.3 + (k % 3) * 0.14, 0.04 + Math.floor(k / 3) * 0.06, 0.6, 0.08, 0.04, 0.05, '#b7a77d', 0);
      mAt(B, 0.65, -0.3, 0.3); B.box(0, 0.03, 0, 0.18, 0.1, 0.3, '#5d6b4a'); B.box(0, 0.13, 0.02, 0.17, 0.004, 0.14, '#5d6b4a'); for (const [a, c] of [[-0.09, 0.1], [0.09, 0.1], [-0.09, -0.1], [0.09, -0.1]]) B.box(a, 0, c, 0.03, 0.06, 0.06, '#2a2b2e'); mReset(B);
      mFlag(B, -0.9, 0.6, 1.1);
      break;
    }
    case 'archery': { // firing range: a long shed and targets down the range
      B.box(0, -0.005, 0, 1.9, 0.02, 1.9, '#b9a77d');
      B.box(0, 0.02, -0.75, 1.6, 0.36, 0.3, '#8a8f80'); B.box(0, 0.38, -0.7, 1.7, 0.03, 0.44, '#5d6458');
      for (let k = 0; k < 4; k++) { const x = -0.6 + k * 0.4; B.box(x, 0, 0.75, 0.03, 0.3, 0.03, '#6b4a33'); mDisc(B, x, 0.3, 0.77, 0.1, '#f2ede3'); mDisc(B, x, 0.3, 0.775, 0.05, '#c8372d'); }
      for (let k = 0; k < 8; k++) smoothBlob(B, -0.85 + k * 0.24, 0.05, 0.92, 0.1, 0.06, 0.06, '#b7a77d', 0);
      break;
    }
    case 'cavyard': { // motor pool: garages and an armoured car
      pl(1.94); B.box(-0.1, 0.02, -0.45, 1.6, 0.5, 0.8, '#8a9080'); mFlat(B, 1.6, 0.8, 0.52, '#5d6458', 1, v);
      for (let k = 0; k < 3; k++) B.box(-0.6 + k * 0.5, 0.02, -0.045, 0.38, 0.36, 0.012, '#6d7266');
      mAt(B, 0.2, 0.45, 0.2); B.box(0, 0.05, 0, 0.24, 0.16, 0.42, '#5d6b4a'); B.box(0, 0.21, -0.02, 0.2, 0.06, 0.24, '#55603f'); B.box(0, 0.25, 0.06, 0.03, 0.03, 0.2, '#3a3d42');
      for (const [a, c] of [[-0.12, 0.13], [0.12, 0.13], [-0.12, -0.13], [0.12, -0.13]]) B.box(a, 0, c, 0.04, 0.09, 0.09, '#2a2b2e'); mReset(B);
      break;
    }
    case 'foundry': { // tank factory
      pl(1.94); B.box(0, 0.02, -0.3, 1.7, 0.8, 1.1, '#9a9d94'); mFlat(B, 1.7, 1.1, 0.82, '#5d6458', 3, v);
      B.box(0, 0.02, 0.255, 0.7, 0.55, 0.012, '#6d7266'); B.cyl(0.65, 0.82, -0.6, 0.08, 0.07, 0.6, 10, '#7a7d76');
      mGrid(W, 1.7, 1.1, 0.1, 1, 0.5, 0.12, 0.2, 'all');
      break;
    }
    case 'warschool': { // military academy: brick, columns, flag, parade ground
      pl(1.94); B.box(0, 0.02, -0.35, 1.6, 0.8, 0.9, '#8f4f3b'); mFlat(B, 1.6, 0.9, 0.82, '#5d6064', 2, v);
      for (let k = 0; k < 4; k++) B.cyl(-0.36 + k * 0.24, 0.04, 0.16, 0.035, 0.035, 0.68, 8, '#e3ddd1'); B.box(0, 0.72, 0.16, 0.9, 0.06, 0.1, '#e3ddd1');
      mGrid(W, 1.6, 0.9, 0.08, 2, 0.34, 0.12, 0.18, 'all'); mDoor(B, 0, 0.102, '#3f4652');
      B.box(0, 0, 0.62, 1.6, 0.012, 0.6, '#cbc6bc'); mFlag(B, 0, 0.62, 1.2);
      break;
    }
    default: return null;
  }
  return { B, W };
}

/* ---------- Modern vehicles, boats and kit ---------- */
// a car, tinted per instance (so the body is white here); front is +z
function carModel() {
  const B = new Builder();
  B.box(0, 0.03, 0, 0.16, 0.065, 0.32, '#ffffff'); B.box(0, 0.095, -0.015, 0.14, 0.06, 0.17, '#c9d6de'); B.box(0, 0.155, -0.015, 0.142, 0.01, 0.17, '#ffffff');
  for (const [a, b] of [[-0.08, 0.1], [0.08, 0.1], [-0.08, -0.1], [0.08, -0.1]]) B.box(a, 0, b, 0.025, 0.055, 0.06, '#2a2b2e');
  B.box(-0.05, 0.05, 0.161, 0.03, 0.02, 0.004, '#fff3c4'); B.box(0.05, 0.05, 0.161, 0.03, 0.02, 0.004, '#fff3c4');
  return B;
}
function truckModel() {
  const B = new Builder();
  B.box(0, 0.04, -0.08, 0.2, 0.22, 0.4, '#e8e4dc'); B.box(0, 0.04, 0.2, 0.19, 0.17, 0.15, '#ffffff'); B.box(0, 0.13, 0.276, 0.17, 0.06, 0.004, '#a9bccb');
  for (const [a, b] of [[-0.1, 0.2], [0.1, 0.2], [-0.1, -0.05], [0.1, -0.05], [-0.1, -0.2], [0.1, -0.2]]) B.box(a, 0, b, 0.03, 0.07, 0.07, '#2a2b2e');
  return B;
}
function armouredCarModel() {
  const B = new Builder();
  B.box(0, 0.05, 0, 0.24, 0.14, 0.38, '#ffffff'); B.box(0, 0.19, -0.03, 0.2, 0.05, 0.22, '#e6e6e6'); B.cyl(0, 0.24, -0.02, 0.06, 0.06, 0.05, 8, '#d9d9d9'); B.box(0, 0.27, 0.08, 0.025, 0.025, 0.18, '#3a3d42');
  for (const [a, b] of [[-0.125, 0.12], [0.125, 0.12], [-0.125, -0.12], [0.125, -0.12]]) B.box(a, 0, b, 0.04, 0.09, 0.09, '#2a2b2e');
  return B;
}
function tankModel() {
  const B = new Builder();
  for (const s of [-1, 1]) { B.box(s * 0.12, 0, 0, 0.08, 0.09, 0.42, '#3a3d42'); for (let k = 0; k < 4; k++) B.box(s * 0.165, 0.02, -0.15 + k * 0.1, 0.008, 0.05, 0.05, '#2a2b2e'); }
  B.box(0, 0.07, 0, 0.26, 0.09, 0.4, '#5d6b4a'); B.box(0, 0.16, -0.03, 0.18, 0.08, 0.2, '#55603f'); B.box(0, 0.18, 0.22, 0.035, 0.035, 0.32, '#4a5338');
  return B;
}
function ferryModel() {
  const B = new Builder();
  B.box(0, -0.18, 0, 0.62, 0.34, 2.0, '#f2f0ea'); B.at(0, -0.18, 1.0, 0); B.gable(0, 0, 0.1, 0.62, 0.34, 0.2, '#f2f0ea'); mReset(B);
  B.box(0, 0.0, 0, 0.64, 0.04, 2.0, '#2f5f8a'); B.box(0, 0.16, -0.1, 0.52, 0.22, 1.3, '#f2f0ea'); B.box(0, 0.38, -0.2, 0.42, 0.16, 0.8, '#f2f0ea');
  for (let k = 0; k < 7; k++) { B.box(0.262, 0.24, -0.7 + k * 0.2, 0.004, 0.06, 0.12, '#5d7f93'); B.box(-0.262, 0.24, -0.7 + k * 0.2, 0.004, 0.06, 0.12, '#5d7f93'); }
  B.cyl(0, 0.54, -0.45, 0.07, 0.07, 0.24, 10, '#c8372d'); B.box(0, 0.54, 0.25, 0.3, 0.08, 0.16, '#a9bccb');
  return B;
}
function trawlerModel() {
  const B = new Builder();
  B.box(0, -0.08, 0, 0.32, 0.18, 0.8, '#2f5f8a'); B.at(0, -0.08, 0.42, 0); B.gable(0, 0, 0, 0.32, 0.18, 0.12, '#2f5f8a'); mReset(B);
  B.box(0, 0.1, 0.12, 0.24, 0.18, 0.22, '#f2f0ea'); B.box(0, 0.18, 0.235, 0.2, 0.06, 0.004, '#a9bccb');
  B.box(0, 0.1, -0.28, 0.02, 0.4, 0.02, '#e3b23c'); B.beam([0, 0.48, -0.28], [0, 0.2, -0.4], 0.015, 0.015, '#e3b23c');
  return B;
}
function cargoShipModel() {
  const B = new Builder();
  B.box(0, -0.2, 0, 0.7, 0.36, 2.2, '#a63d32'); B.at(0, -0.2, 1.1, 0); B.gable(0, 0, 0.1, 0.7, 0.36, 0.22, '#a63d32'); mReset(B);
  B.box(0, 0.16, 0, 0.72, 0.03, 2.2, '#3a3d42');
  const C = ['#2f5f8a', '#c9a23c', '#6f8f5a', '#b8412f', '#e8e4dc'];
  for (let k = 0; k < 5; k++) for (let l = 0; l < 2; l++) B.box(-0.15 + l * 0.3, 0.19 + (k % 2) * 0.13, 0.55 - k * 0.24, 0.28, 0.13, 0.22, C[(k + l * 2) % 5]);
  B.box(0, 0.19, -0.85, 0.5, 0.36, 0.3, '#f2f0ea'); B.box(0, 0.45, -0.85, 0.42, 0.04, 0.34, '#3a3d42');
  return B;
}
// raid ships by boat level: landing craft, patrol boat, frigate, destroyer
function warshipModel(level) {
  const B = new Builder(), grey = '#7d858d', dark = '#5d646c', big = [1, 0.75, 0.95, 1.1, 1.25][level] || 1;
  B.at(0, 0, 0, 0, big);
  if (level <= 1) {
    B.box(0, -0.2, 0, 0.9, 0.42, 2.2, '#6b7a5a'); B.box(0, 0.22, 1.08, 0.86, 0.3, 0.06, '#5d6b4a'); B.box(0, 0.22, -0.9, 0.5, 0.36, 0.3, '#5d6b4a');
  } else {
    B.box(0, -0.25, 0, 0.9, 0.5, 2.8, grey); B.at(0, -0.25, 1.4, 0, big); B.gable(0, 0, 0.12, 0.9, 0.5, 0.36, grey); B.at(0, 0, 0, 0, big);
    B.box(0, 0.25, 0, 0.92, 0.03, 2.8, dark);
    B.box(0, 0.28, -0.3, 0.6, 0.4, 0.8, '#9aa1a8'); B.box(0, 0.68, -0.25, 0.44, 0.24, 0.5, '#9aa1a8'); B.box(0, 0.83, -0.0, 0.4, 0.06, 0.004, '#a9bccb');
    B.box(0, 0.92, -0.3, 0.03, 0.6, 0.03, dark); B.box(0, 1.35, -0.3, 0.3, 0.02, 0.02, dark);
    for (const z of level >= 3 ? [0.75, -1.05] : [0.75]) { B.cyl(0, 0.28, z, 0.15, 0.15, 0.12, 10, dark); B.box(0, 0.36, z + 0.25, 0.04, 0.04, 0.4, '#3a3d42'); }
  }
  B.at(0, 0, 0, 0, 1);
  return B;
}
function rifleModel() { const B = new Builder(), y = -0.108; B.box(0, y - 0.01, 0.08, 0.018, 0.03, 0.2, '#3a3530'); B.box(0, y - 0.005, 0.24, 0.012, 0.012, 0.16, '#2a2b2e'); B.box(0, y - 0.035, 0.1, 0.012, 0.03, 0.03, '#2a2b2e'); return B; }
function modernHelmModel(kind) {
  const B = new Builder();
  if (kind === 'horn') { smoothBlob(B, 0, 0.3, 0, 0.082, 0.06, 0.088, '#5d6b4a', 0); B.cyl(0, 0.278, 0, 0.1, 0.1, 0.01, 10, '#55603f'); }
  else { B.cyl(0, 0.29, 0, 0.085, 0.08, 0.06, 10, '#22324a'); B.box(0, 0.29, 0.07, 0.12, 0.012, 0.07, '#1a2533'); B.box(0, 0.33, 0.075, 0.03, 0.025, 0.006, '#d9b45a'); }
  return B;
}
