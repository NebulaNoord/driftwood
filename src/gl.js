/* Driftwood — small WebGL2 engine: math, shaders, meshes, instanced batches */
(function (root) {
'use strict';

/* ---------- mat4 (column-major) ---------- */
const M4 = {
  ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b, o) {
    o = o || new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f);
    return m;
  },
  ortho(l, r, b, t, n, f) {
    const m = new Float32Array(16);
    m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
    m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); m[15] = 1;
    return m;
  },
  lookAt(e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    const m = new Float32Array(16);
    m[0] = xx; m[1] = yx; m[2] = zx; m[4] = xy; m[5] = yy; m[6] = zy; m[8] = xz; m[9] = yz; m[10] = zz;
    m[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); m[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); m[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); m[15] = 1;
    return m;
  },
  invert(m) {
    const inv = new Float32Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    det = det ? 1 / det : 0;
    for (let i = 0; i < 16; i++) inv[i] *= det;
    return inv;
  },
};
// Writes T * Ry * Rx/Rz(tilt) * S into out at offset (16 floats). Fast path used for every instance.
function trs(out, o, x, y, z, ry, sx, sy, sz, tiltX, tiltZ) {
  const c = Math.cos(ry), s = Math.sin(ry);
  if (!tiltX && !tiltZ) {
    out[o] = c * sx; out[o + 1] = 0; out[o + 2] = -s * sx; out[o + 3] = 0;
    out[o + 4] = 0; out[o + 5] = sy; out[o + 6] = 0; out[o + 7] = 0;
    out[o + 8] = s * sz; out[o + 9] = 0; out[o + 10] = c * sz; out[o + 11] = 0;
    out[o + 12] = x; out[o + 13] = y; out[o + 14] = z; out[o + 15] = 1;
    return;
  }
  // R = Ry * Rx(tiltX) * Rz(tiltZ)
  const cx = Math.cos(tiltX || 0), sxx = Math.sin(tiltX || 0), cz = Math.cos(tiltZ || 0), szz = Math.sin(tiltZ || 0);
  // Rx*Rz
  const a00 = cz, a01 = -szz, a02 = 0;
  const a10 = cx * szz, a11 = cx * cz, a12 = -sxx;
  const a20 = sxx * szz, a21 = sxx * cz, a22 = cx;
  // Ry * A
  const r00 = c * a00 + s * a20, r01 = c * a01 + s * a21, r02 = c * a02 + s * a22;
  const r10 = a10, r11 = a11, r12 = a12;
  const r20 = -s * a00 + c * a20, r21 = -s * a01 + c * a21, r22 = -s * a02 + c * a22;
  out[o] = r00 * sx; out[o + 1] = r10 * sx; out[o + 2] = r20 * sx; out[o + 3] = 0;
  out[o + 4] = r01 * sy; out[o + 5] = r11 * sy; out[o + 6] = r21 * sy; out[o + 7] = 0;
  out[o + 8] = r02 * sz; out[o + 9] = r12 * sz; out[o + 10] = r22 * sz; out[o + 11] = 0;
  out[o + 12] = x; out[o + 13] = y; out[o + 14] = z; out[o + 15] = 1;
}

function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

/* ---------- Geometry builder (flat-shaded, vertex colors) ---------- */
class Builder {
  constructor() { this.p = []; this.n = []; this.c = []; this.T = { x: 0, y: 0, z: 0, ry: 0, s: 1 }; }
  at(x, y, z, ry, s) { this.T = { x, y, z, ry: ry || 0, s: s || 1 }; return this; }
  _tx(p) {
    const T = this.T, c = Math.cos(T.ry), s = Math.sin(T.ry);
    const x = p[0] * T.s, y = p[1] * T.s, z = p[2] * T.s;
    return [x * c + z * s + T.x, y + T.y, -x * s + z * c + T.z];
  }
  tri(a, b, c, col, hint) {
    a = this._tx(a); b = this._tx(b); c = this._tx(c);
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (hint) {
      const h = this._tx(hint), mx = (a[0] + b[0] + c[0]) / 3 - h[0], my = (a[1] + b[1] + c[1]) / 3 - h[1], mz = (a[2] + b[2] + c[2]) / 3 - h[2];
      if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; const t = b; b = c; c = t; }
    }
    this.p.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) { this.n.push(nx, ny, nz); this.c.push(col[0], col[1], col[2]); }
    return this;
  }
  quad(a, b, c, d, col, hint) { this.tri(a, b, c, col, hint); this.tri(a, c, d, col, hint); return this; }
  // Box centred at (x, y0 + h/2, z), base on y0
  box(x, y0, z, w, h, d, col, topCol) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y0 + h, cen = [x, y0 + h / 2, z];
    col = Array.isArray(col) ? col : hex(col); const tc = topCol ? (Array.isArray(topCol) ? topCol : hex(topCol)) : col;
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], tc, cen);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col, cen);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, cen);
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], col, cen);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], col, cen);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, cen);
    return this;
  }
  // Gable roof: ridge along x. base at y0, width w (x), depth d (z), height h
  gable(x, y0, z, w, h, d, col, endCol) {
    col = Array.isArray(col) ? col : hex(col); const ec = endCol ? hex(endCol) : col;
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, yt = y0 + h, cen = [x, y0 + h * 0.3, z];
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, yt, z], [x0, yt, z], col, cen);
    this.quad([x0, y0, z1], [x0, yt, z], [x1, yt, z], [x1, y0, z1], col, cen);
    this.tri([x0, y0, z0], [x0, yt, z], [x0, y0, z1], ec, cen);
    this.tri([x1, y0, z0], [x1, y0, z1], [x1, yt, z], ec, cen);
    this.quad([x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], ec, cen);
    // ridge cap and barge boards
    const rc = [col[0] * 0.72, col[1] * 0.72, col[2] * 0.72];
    this.box(x, yt - 0.012, z, w + 0.02, 0.03, Math.max(0.035, d * 0.06), rc);
    const sl = Math.hypot(d / 2, h), bt = 0.018;
    for (const xe of [x0 - 0.004, x1 + 0.004]) {
      this.quad([xe, y0 - bt, z0 - 0.01], [xe, y0, z0 - 0.01], [xe, yt + 0.004, z], [xe, yt - bt, z], rc, [x, yt, z]);
      this.quad([xe, y0 - bt, z1 + 0.01], [xe, yt - bt, z], [xe, yt + 0.004, z], [xe, y0, z1 + 0.01], rc, [x, yt, z]);
    }
    return this;
  }
  // Rectangular beam from point a to point b (cross-section w x d)
  beam(a, b, w, d, col) {
    col = Array.isArray(col) ? col : hex(col);
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
    const f = [dx / L, dy / L, dz / L];
    let up = Math.abs(f[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let u = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
    const ul = Math.hypot(...u); u = u.map(x => x / ul);
    const v = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
    const P = (p, su, sv) => [p[0] + u[0] * su * w / 2 + v[0] * sv * d / 2, p[1] + u[1] * su * w / 2 + v[1] * sv * d / 2, p[2] + u[2] * su * w / 2 + v[2] * sv * d / 2];
    const cen = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const A = [P(a, -1, -1), P(a, 1, -1), P(a, 1, 1), P(a, -1, 1)], Bq = [P(b, -1, -1), P(b, 1, -1), P(b, 1, 1), P(b, -1, 1)];
    for (let k = 0; k < 4; k++) { const n = (k + 1) % 4; this.quad(A[k], A[n], Bq[n], Bq[k], col, cen); }
    this.quad(A[0], A[1], A[2], A[3], col, cen); this.quad(Bq[0], Bq[1], Bq[2], Bq[3], col, cen);
    return this;
  }
  // Cylinder / cone frustum
  cyl(x, y0, z, r0, r1, h, seg, col, capCol, rot) {
    col = Array.isArray(col) ? col : hex(col); const cc = capCol ? hex(capCol) : col;
    const cen = [x, y0 + h / 2, z], y1 = y0 + h, a0 = rot || 0;
    for (let k = 0; k < seg; k++) {
      const a = a0 + k / seg * Math.PI * 2, b = a0 + (k + 1) / seg * Math.PI * 2;
      const p0 = [x + Math.cos(a) * r0, y0, z + Math.sin(a) * r0], p1 = [x + Math.cos(b) * r0, y0, z + Math.sin(b) * r0];
      const q0 = [x + Math.cos(a) * r1, y1, z + Math.sin(a) * r1], q1 = [x + Math.cos(b) * r1, y1, z + Math.sin(b) * r1];
      if (r1 > 1e-4) this.quad(p0, p1, q1, q0, col, cen); else this.tri(p0, p1, [x, y1, z], col, cen);
      this.tri([x, y0, z], p1, p0, cc, cen);
      if (r1 > 1e-4) this.tri([x, y1, z], q0, q1, cc, cen);
    }
    return this;
  }
  // Low-poly blob (octahedron subdivided once, jittered)
  blob(x, y, z, rx, ry, rz, col, jitter, seed) {
    col = Array.isArray(col) ? col : hex(col);
    const t = (1 + Math.sqrt(5)) / 2;
    let vs = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    const fs = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    let sd = seed || 1;
    const rn = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    vs = vs.map(v => { const l = Math.hypot(...v), j = 1 + (rn() - 0.5) * (jitter || 0); return [x + v[0] / l * rx * j, y + v[1] / l * ry * j, z + v[2] / l * rz * j]; });
    for (const f of fs) {
      const sh = 0.92 + rn() * 0.16;
      this.tri(vs[f[0]], vs[f[1]], vs[f[2]], [col[0] * sh, col[1] * sh, col[2] * sh], [x, y, z]);
    }
    return this;
  }
}

/* ---------- Shaders ---------- */
const VS_MAIN = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec3 aCol;
layout(location=3) in vec4 iM0; layout(location=4) in vec4 iM1; layout(location=5) in vec4 iM2; layout(location=6) in vec4 iM3;
layout(location=7) in vec4 iCol;
uniform mat4 uVP; uniform mat4 uLightVP; uniform float uTime; uniform float uSway; uniform float uSwayY; uniform float uWind;
out vec3 vCol; out vec3 vNor; out vec3 vWorld; out vec4 vLight; out float vEmis;
void main() {
  mat4 M = mat4(iM0, iM1, iM2, iM3);
  vec4 w = M * vec4(aPos, 1.0);
  if (uSway > 0.0) {
    // rolling gusts sweep across the island; everything bends the same way, a little out of step
    float s = max(aPos.y - uSwayY, 0.0);
    float gust = 0.55 + 0.45 * sin(uTime * 0.45 - M[3].x * 0.09 + M[3].z * 0.05) * (0.7 + 0.3 * sin(uTime * 1.7 + M[3].z * 0.3));
    float k = s * uSway * (1.0 + uWind) * gust;
    w.x += (sin(uTime * 1.6 + M[3].z * 0.7 + M[3].x * 0.3) * 0.03 + 0.025) * k;
    w.z += cos(uTime * 1.3 + M[3].x * 0.6) * 0.025 * k;
  }
  vWorld = w.xyz;
  vNor = normalize(mat3(M) * aNor);
  vCol = aCol * iCol.rgb; vEmis = iCol.a;
  vLight = uLightVP * w;
  gl_Position = uVP * w;
}`;
const FS_MAIN = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vCol; in vec3 vNor; in vec3 vWorld; in vec4 vLight; in float vEmis;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uFog; uniform vec2 uFogR;
uniform vec3 uEye; uniform sampler2DShadow uShadow; uniform float uAlpha; uniform float uShadowOn; uniform float uTexel; uniform vec3 uFlat;
out vec4 o;
float shadow() {
  vec3 p = vLight.xyz / vLight.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float s = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) s += texture(uShadow, vec3(p.xy + vec2(x, y) * uTexel, p.z - 0.0012));
  return s / 9.0;
}
void main() {
  vec3 n = normalize(vNor);
  float ndl = max(dot(n, uSunDir), 0.0);
  float sh = ndl > 0.0 ? mix(1.0, shadow(), uShadowOn) : 0.0;
  vec3 hemi = mix(uGround, uSky, n.y * 0.5 + 0.5);
  vec3 c = vCol * (hemi + uSunCol * ndl * sh);
  c += vCol * vEmis + uFlat * step(0.5, vEmis);
  float f = smoothstep(uFogR.x, uFogR.y, length(vWorld - uEye));
  o = vec4(mix(c, uFog, f), uAlpha);
}`;
const FS_DEPTH = `#version 300 es
precision mediump float; void main() {}`;

const VS_WATER = `#version 300 es
precision highp float;
layout(location=0) in vec2 aXZ;
uniform mat4 uVP; uniform float uTime; uniform float uHalf;
out vec3 vWorld; out vec2 vUV;
void main() {
  vec3 p = vec3(aXZ.x, 0.0, aXZ.y);
  float off = smoothstep(34.0, 70.0, length(p.xz));
  p.y = sin(p.x * 0.35 + uTime * 1.1) * 0.04 + sin(p.z * 0.42 - uTime * 0.9) * 0.04 + sin((p.x + p.z) * 0.9 + uTime * 1.7) * 0.015 - 0.02
      + off * (sin(p.x * 0.11 + p.z * 0.07 + uTime * 0.7) * 0.22 + sin(p.z * 0.16 - p.x * 0.05 + uTime * 0.9) * 0.12);
  vWorld = p; vUV = (aXZ + uHalf) / (uHalf * 2.0);
  gl_Position = uVP * vec4(p, 1.0);
}`;
const FS_WATER = `#version 300 es
precision highp float;
in vec3 vWorld; in vec2 vUV;
uniform sampler2D uH; uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uFog; uniform vec2 uFogR; uniform vec3 uEye;
uniform vec3 uShallow; uniform vec3 uDeep; uniform float uNight;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float ground = -4.0;
  if (vUV.x > 0.0 && vUV.x < 1.0 && vUV.y > 0.0 && vUV.y < 1.0) ground = texture(uH, vUV).r;
  float depth = vWorld.y - ground;
  vec3 nrm = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (nrm.y < 0.0) nrm = -nrm;
  float n1 = noise(vWorld.xz * 1.6 + vec2(uTime * 0.25, uTime * 0.18));
  float n2 = noise(vWorld.xz * 3.1 - vec2(uTime * 0.2, -uTime * 0.31));
  nrm = normalize(nrm + vec3(n1 - 0.5, 0.0, n2 - 0.5) * 0.12);
  vec3 col = mix(uShallow, uDeep, smoothstep(0.05, 2.6, depth));
  float diff = max(dot(nrm, uSunDir), 0.0);
  col *= (0.55 + 0.45 * diff) * (uSky * 0.6 + uSunCol * 0.5 + 0.15);
  vec3 v = normalize(uEye - vWorld);
  float spec = pow(max(dot(reflect(-uSunDir, nrm), v), 0.0), 60.0);
  col += uSunCol * spec * 0.6;
  float fres = pow(1.0 - max(dot(v, vec3(0, 1, 0)), 0.0), 3.0);
  col = mix(col, uSky * 1.05, fres * 0.35);
  float band = 0.13 + 0.05 * sin(uTime * 1.6 - depth * 14.0);
  float foam = smoothstep(band, band - 0.05, depth) * smoothstep(0.55, 0.85, n1 + n2 * 0.4) * 0.8;
  foam += smoothstep(0.045, 0.0, depth);
  // lines of surf rolling in toward the beach
  float phase = depth * 2.4 + uTime * 0.45;
  foam += smoothstep(0.86, 1.0, 0.5 + 0.5 * sin(phase * 6.283)) * smoothstep(1.3, 0.15, depth) * (0.35 + 0.65 * n1) * 0.75;
  float glint = smoothstep(0.93, 1.0, noise(vWorld.xz * 7.0 + vec2(uTime * 0.9, uTime * 0.4))) * smoothstep(0.93, 1.0, noise(vWorld.xz * 11.0 - vec2(uTime * 0.6, -uTime * 0.7)));
  col += vec3(1.0, 0.97, 0.88) * glint * (1.0 - uNight) * 1.4;
  col = mix(col, vec3(0.97, 0.98, 1.0) * (0.35 + 0.65 * (1.0 - uNight * 0.7)), clamp(foam, 0.0, 1.0) * 0.85);
  float a = mix(0.62, 0.93, smoothstep(0.0, 1.6, depth));
  a = max(a, clamp(foam, 0.0, 1.0));
  if (depth < -0.02) discard;
  float f = smoothstep(uFogR.x, uFogR.y, length(vWorld - uEye));
  o = vec4(mix(col, uFog, f), mix(a, 1.0, f));
}`;
const VS_SKY = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 vP;
void main() { vP = P[gl_VertexID]; gl_Position = vec4(vP, 0.999, 1.0); }`;
const FS_SKY = `#version 300 es
precision highp float;
in vec2 vP; uniform mat4 uInvVP; uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uNight; uniform float uTime;
out vec4 o;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec4 a = uInvVP * vec4(vP, -1.0, 1.0), b = uInvVP * vec4(vP, 1.0, 1.0);
  vec3 d = normalize(b.xyz / b.w - a.xyz / a.w);
  float t = clamp(d.y, -0.2, 1.0);
  vec3 c = mix(uHorizon, uTop, smoothstep(-0.05, 0.6, t));
  float s = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(s, 600.0) * 2.0 + pow(s, 8.0) * 0.25) * (1.0 - uNight);
  if (uNight > 0.0 && d.y > 0.02) {
    vec3 q = floor(d * 220.0);
    float st = step(0.9965, hash(q));
    c += vec3(st) * uNight * (0.6 + 0.4 * sin(uTime * 2.0 + hash(q + 3.0) * 30.0)) * smoothstep(0.02, 0.25, d.y);
  }
  o = vec4(c, 1.0);
}`;

function compile(gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').slice(0, 3).join(' '));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

/* ---------- Renderer ---------- */
class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl; this.canvas = canvas;
    this.main = compile(gl, VS_MAIN, FS_MAIN);
    this.depth = compile(gl, VS_MAIN, FS_DEPTH);
    this.water = compile(gl, VS_WATER, FS_WATER);
    this.sky = compile(gl, VS_SKY, FS_SKY);
    this.skyVao = gl.createVertexArray();
    this.SH = 2048;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.SH, this.SH);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadowFb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.hTex = gl.createTexture();
    this.identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0]);
  }
  mesh(b, dynamic) {
    const gl = this.gl, n = b.p.length / 3;
    const data = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      data[i * 9] = b.p[i * 3]; data[i * 9 + 1] = b.p[i * 3 + 1]; data[i * 9 + 2] = b.p[i * 3 + 2];
      data[i * 9 + 3] = b.n[i * 3]; data[i * 9 + 4] = b.n[i * 3 + 1]; data[i * 9 + 5] = b.n[i * 3 + 2];
      data[i * 9 + 6] = b.c[i * 3]; data[i * 9 + 7] = b.c[i * 3 + 1]; data[i * 9 + 8] = b.c[i * 3 + 2];
    }
    return this.meshFromData(data, dynamic);
  }
  meshFromData(data, dynamic, m) {
    const gl = this.gl;
    if (!m) {
      m = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), ibo: gl.createBuffer(), count: 0, inst: new Float32Array(20 * 16), n: 0, cap: 16 };
      gl.bindVertexArray(m.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.ibo);
      gl.bufferData(gl.ARRAY_BUFFER, m.inst.byteLength, gl.DYNAMIC_DRAW);
      for (let k = 0; k < 5; k++) {
        gl.enableVertexAttribArray(3 + k);
        gl.vertexAttribPointer(3 + k, 4, gl.FLOAT, false, 80, k * 16);
        gl.vertexAttribDivisor(3 + k, 1);
      }
      gl.bindVertexArray(null);
      m.vcap = data.length;
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
      if (data.length > m.vcap) { gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); m.vcap = data.length; }
      else gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }
    m.count = data.length / 9;
    return m;
  }
  // instance helpers
  begin(m) { m.n = 0; }
  push(m, x, y, z, ry, sx, sy, sz, r, g, b, e, tx, tz) {
    if (m.n >= m.cap) { const nc = m.cap * 2, ni = new Float32Array(nc * 20); ni.set(m.inst); m.inst = ni; m.cap = nc; m.grown = true; }
    const o = m.n * 20;
    trs(m.inst, o, x, y, z, ry, sx, sy, sz, tx, tz);
    m.inst[o + 16] = r === undefined ? 1 : r; m.inst[o + 17] = g === undefined ? 1 : g; m.inst[o + 18] = b === undefined ? 1 : b; m.inst[o + 19] = e || 0;
    m.n++;
  }
  pushMat(m, mat, r, g, b, e) {
    if (m.n >= m.cap) { const nc = m.cap * 2, ni = new Float32Array(nc * 20); ni.set(m.inst); m.inst = ni; m.cap = nc; m.grown = true; }
    const o = m.n * 20; m.inst.set(mat, o);
    m.inst[o + 16] = r; m.inst[o + 17] = g; m.inst[o + 18] = b; m.inst[o + 19] = e || 0; m.n++;
  }
  upload(m) {
    if (!m.n) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, m.ibo);
    if (m.grown || m.n * 80 > m.iboSize) { gl.bufferData(gl.ARRAY_BUFFER, m.inst.byteLength, gl.DYNAMIC_DRAW); m.iboSize = m.inst.byteLength; m.grown = false; }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, m.inst, 0, m.n * 20);
  }
  draw(m) { if (!m.n || !m.count) return; const gl = this.gl; gl.bindVertexArray(m.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, m.n); }
  setHeights(h, V) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.hTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, V, V, 0, gl.RED, gl.FLOAT, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  waterMesh(half, seg) {
    const gl = this.gl, pts = [];
    const st = half * 2 / seg;
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
      const x0 = -half + i * st, z0 = -half + j * st, x1 = x0 + st, z1 = z0 + st;
      pts.push(x0, z0, x0, z1, x1, z1, x0, z0, x1, z1, x1, z0);
    }
    // far ring so the sea reaches the horizon
    const F = 900, H = half;
    const ring = [[-F, -F, F, -H], [-F, H, F, F], [-F, -H, -H, H], [H, -H, F, H]];
    for (const [ax, az, bx, bz] of ring) pts.push(ax, az, ax, bz, bx, bz, ax, az, bx, bz, bx, az);
    const vao = gl.createVertexArray(), vbo = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    return { vao, count: pts.length / 2 };
  }
  resize(dprCap) {
    const c = this.canvas, d = Math.min(window.devicePixelRatio || 1, dprCap || 2);
    const w = Math.max(1, Math.round(c.clientWidth * d)), h = Math.max(1, Math.round(c.clientHeight * d));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return [w, h];
  }
}

root.GL = { M4, trs, hex, Builder, Renderer };
})(typeof window !== 'undefined' ? window : globalThis);
