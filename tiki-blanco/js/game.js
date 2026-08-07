// ============================================================================
//  TikiBlänco — Blood Moon Canyon
//  A tiny explorable 3D rendering of the TikiBlänco poster (Blanco, Texas).
//  Low-poly / N64-flavored: chunky pixels, fog, flat shading, vertex colors.
// ============================================================================
import * as THREE from './three.module.min.js';

// ---------------------------------------------------------------- utilities
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function M4(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz));
}
// merge simple geometries into one vertex-colored geometry (1 draw call)
function mergeGeoms(parts) {
  const pos = [], nor = [], col = [], C = new THREE.Color();
  for (const p of parts) {
    const g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
    if (p.m) g.applyMatrix4(p.m);
    const pa = g.attributes.position.array, na = g.attributes.normal.array;
    C.set(p.c);
    for (let i = 0; i < pa.length; i += 3) {
      pos.push(pa[i], pa[i + 1], pa[i + 2]);
      nor.push(na[i], na[i + 1], na[i + 2]);
      col.push(C.r, C.g, C.b);
    }
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------- basics
const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(clamp(640 / window.innerWidth, 0.35, 1)); // ~N64 internal res
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x5e1c07, 55, 235);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

scene.add(new THREE.HemisphereLight(0xa84424, 0x35200e, 1.75));
const moonLight = new THREE.DirectionalLight(0xff7a48, 2.3);
moonLight.position.set(30, 110, -160);
scene.add(moonLight);
const fillLight = new THREE.DirectionalLight(0xffd9a0, 0.65);
fillLight.position.set(-60, 80, 120);
scene.add(fillLight);

const matFlat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });

// ------------------------------------------------------------------ terrain
const WATER_Y = -1.0;
function riverX(z) { return 14 * Math.sin(z * 0.035) + 7 * Math.sin(z * 0.012 + 2.0); }
function baseH(x, z) {
  return 2.5
    + 1.5 * Math.sin(x * 0.055 + 1.3) * Math.cos(z * 0.047)
    + 0.9 * Math.sin(x * 0.11 + z * 0.09)
    + 0.45 * Math.sin(x * 0.23) * Math.sin(z * 0.19 + 1.0);
}
function mesaH(x, z) {
  let m = 0;
  const ex = Math.abs(x) - (84 + 7 * Math.sin(z * 0.09) + 3 * Math.sin(z * 0.23));
  const trail = x > 0 && z > 26 && z < 66; // walkable talus ramp up the east wall
  if (ex > 0 && !trail) m = Math.max(m, Math.min(38, ex * 1.5));
  const ez = -z - (82 + 6 * Math.sin(x * 0.11) + 3 * Math.sin(x * 0.27 + 1));
  if (ez > 0) m = Math.max(m, Math.min(38, ez * 1.5));
  const es = z - (92 + 5 * Math.sin(x * 0.13));
  if (es > 0) m = Math.max(m, Math.min(26, es * 1.4));
  if (m > 0) { const s = 3.5; m = Math.floor(m / s) * s + Math.min(m % s, 1.0) * 1.2; }
  if (trail && ex > 0) m = Math.max(m, Math.min(20, ex * 0.9)); // smooth, unstepped — climbable
  return m;
}
function terrainH(x, z) {
  let h = baseH(x, z);
  const d = Math.abs(x - riverX(z));
  if (d < 11) {
    const t = 1 - d / 11;
    h -= 6.0 * (t * t * (3 - 2 * t));
    if (d < 5.5) h = Math.min(h, -2.0); // river core always deep enough to swim
  }
  return h + mesaH(x, z);
}

{
  const seg = 150;
  const geo = new THREE.PlaneGeometry(244, 244, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) P.setY(i, terrainH(P.getX(i), P.getZ(i)));
  geo.computeVertexNormals();
  const colors = new Float32Array(P.count * 3);
  const c = new THREE.Color(), N = geo.attributes.normal;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const m = mesaH(x, z);
    if (y < WATER_Y - 0.1) c.setHex(0x6a5136);                 // pebbly riverbed
    else if (y < WATER_Y + 1.1) c.setHex(0x7d5f3b);            // sandy bank
    else if (m > 0.5) c.setHex((m % 3.5) < 1.3 ? 0x7a4423 : 0x55341d); // stepped mesa
    else c.setHex(((Math.sin(x * 0.7) * Math.cos(z * 0.8)) > 0.2) ? 0x503322 : 0x40281a);
    const slope = N.getY(i);                                   // darken cliffsides
    const shade = lerp(0.55, 1.0, clamp((slope - 0.3) / 0.7, 0, 1)) * rand(0.92, 1.06);
    colors[i * 3] = c.r * shade; colors[i * 3 + 1] = c.g * shade; colors[i * 3 + 2] = c.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(geo, matFlat));
}

// -------------------------------------------------------------------- water
const waterTex = canvasTex(128, (ctx, s) => {
  ctx.fillStyle = '#2b2138'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 46; i++) {
    const y = rand(0, s), len = rand(10, 46), a = rand(0.12, 0.75);
    ctx.strokeStyle = `rgba(238,214,160,${a})`;
    ctx.lineWidth = rand(1, 2.6);
    ctx.beginPath();
    const x0 = rand(-10, s);
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo(x0 + len / 2, y + rand(-3, 3), x0 + len, y);
    ctx.stroke();
  }
});
waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
waterTex.repeat.set(12, 12);
{
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(244, 244),
    new THREE.MeshBasicMaterial({ map: waterTex, color: 0xd8c49a }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  scene.add(water);
}

// ---------------------------------------------------------------------- sky
{
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP;
      void main(){
        float h = normalize(vP).y;
        vec3 top = vec3(0.030,0.012,0.008);
        vec3 mid = vec3(0.25,0.060,0.022);
        vec3 hor = vec3(0.50,0.135,0.032);
        vec3 c = h < 0.14 ? mix(hor, mid, clamp(h/0.14, 0.0, 1.0))
                          : mix(mid, top, clamp((h-0.14)/0.55, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(430, 32, 16), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);
}
// stars — two layers that twinkle in counterphase
const starMats = [];
for (let layer = 0; layer < 2; layer++) {
  const n = 400, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), e = Math.acos(rand(0.12, 0.995)), r = 405;
    p[i * 3] = r * Math.sin(e) * Math.cos(a);
    p[i * 3 + 1] = r * Math.cos(e);
    p[i * 3 + 2] = r * Math.sin(e) * Math.sin(a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfff2d8, size: layer ? 2.4 : 1.8, sizeAttenuation: false, fog: false,
    transparent: true, opacity: 0.9, depthWrite: false });
  starMats.push(mat);
  scene.add(new THREE.Points(g, mat));
}
// blood moon
const MOON_POS = V3(40, 150, -230);
let moonGlowSprite;
{
  const tex = canvasTex(128, (ctx, s) => {
    ctx.fillStyle = '#c33018'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(120,24,10,${rand(0.25, 0.6)})`;
      ctx.beginPath();
      ctx.arc(rand(0, s), rand(0, s), rand(4, 16), 0, 7);
      ctx.fill();
    }
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(19, 20, 14),
    new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  moon.position.copy(MOON_POS);
  scene.add(moon);
  const glowTex = canvasTex(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,80,30,0.55)');
    g.addColorStop(0.45, 'rgba(200,40,15,0.20)');
    g.addColorStop(1, 'rgba(120,20,8,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, fog: false, transparent: true, depthWrite: false }));
  glow.position.copy(MOON_POS);
  glow.scale.setScalar(120);
  scene.add(glow);
  moonGlowSprite = glow;
}
// Orion (top-left of the poster)
const ORION_POS = V3(-250, 190, -230);
let orionMat;
{
  const stars = [[-1.1, 1.5], [0, 2.15], [0.9, 1.4], [-0.35, 0.1], [0, 0], [0.35, -0.12], [0.8, -1.45], [-0.85, -1.5]];
  const links = [[0, 3], [2, 5], [3, 4], [4, 5], [3, 7], [5, 6], [0, 1], [1, 2], [6, 7]];
  const grp = new THREE.Group();
  const p = [];
  for (const s of stars) p.push(s[0] * 15, s[1] * 15, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  orionMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 3.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.95, depthWrite: false });
  grp.add(new THREE.Points(g, orionMat));
  const lp = [];
  for (const l of links) {
    lp.push(stars[l[0]][0] * 15, stars[l[0]][1] * 15, 0, stars[l[1]][0] * 15, stars[l[1]][1] * 15, 0);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
    color: 0xd8c8a8, fog: false, transparent: true, opacity: 0.4, depthWrite: false })));
  grp.position.copy(ORION_POS);
  grp.lookAt(0, 40, 0);
  scene.add(grp);
}
// spiral galaxy (top-right of the poster)
const GALAXY_POS = V3(250, 205, -170);
let galaxy;
{
  const n = 460, p = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const C = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 3.4 * Math.PI, arm = i % 2;
    const a = t * 0.58 + arm * Math.PI, r = 0.7 + t * 1.25;
    p[i * 3] = Math.cos(a) * r + rand(-0.7, 0.7);
    p[i * 3 + 1] = Math.sin(a) * r + rand(-0.7, 0.7);
    p[i * 3 + 2] = rand(-0.3, 0.3);
    C.setHSL(0.08, rand(0.1, 0.45), lerp(0.95, 0.35, t / (3.4 * Math.PI)));
    col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  galaxy = new THREE.Points(g, new THREE.PointsMaterial({
    vertexColors: true, size: 2.2, sizeAttenuation: false, fog: false,
    transparent: true, opacity: 0.85, depthWrite: false }));
  galaxy.scale.setScalar(3.4);
  galaxy.position.copy(GALAXY_POS);
  galaxy.lookAt(0, 40, 0);
  scene.add(galaxy);
}
// dark drifting clouds
const clouds = [];
{
  const mat = new THREE.MeshBasicMaterial({ color: 0x160a06, fog: false });
  for (let i = 0; i < 6; i++) {
    const grp = new THREE.Group();
    const blobs = randi(4, 7);
    for (let b = 0; b < blobs; b++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mat);
      s.position.set(rand(-6, 6), rand(-0.8, 0.8), rand(-2, 2));
      s.scale.set(rand(3, 6.5), rand(1, 1.8), rand(2, 3.4));
      s.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      grp.add(s);
    }
    grp.position.set(rand(-260, 260), rand(58, 105), rand(-260, -120));
    grp.userData.speed = rand(1.2, 3.2);
    clouds.push(grp);
    scene.add(grp);
  }
}
// bats
const bats = [];
{
  const mat = new THREE.MeshBasicMaterial({ color: 0x0d0705, side: THREE.DoubleSide, fog: false });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute(
    [0, 0, 0, 1.4, 0.25, -0.3, 1.2, -0.1, 0.45], 3));
  wingGeo.computeVertexNormals();
  for (let i = 0; i < 12; i++) {
    const bat = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 4), mat);
    body.rotation.x = Math.PI / 2;
    bat.add(body);
    const wl = new THREE.Mesh(wingGeo, mat);
    const wr = new THREE.Mesh(wingGeo, mat);
    wr.scale.x = -1;
    bat.add(wl); bat.add(wr);
    bat.userData = {
      wl, wr, ang: rand(0, Math.PI * 2), rad: rand(16, 42),
      h: rand(42, 62), speed: rand(0.25, 0.5) * (Math.random() < 0.5 ? 1 : -1),
      flap: rand(0, 9), cx: rand(-20, 30), cz: rand(-110, -60)
    };
    bats.push(bat);
    scene.add(bat);
  }
}
// shooting star
const shootingStar = { active: false, t: 0, max: 1.3, timer: rand(6, 12) };
{
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  shootingStar.line = new THREE.Line(g, new THREE.LineBasicMaterial({
    color: 0xfff4d8, fog: false, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending }));
  shootingStar.line.frustumCulled = false;
  scene.add(shootingStar.line);
}
function fireShootingStar() {
  shootingStar.active = true;
  shootingStar.t = 0;
  shootingStar.pos = V3(rand(-60, 200), rand(190, 250), rand(-280, -220));
  shootingStar.vel = V3(rand(-130, -80), rand(-60, -30), rand(-10, 10));
}
// distant black ridge cones to hide the world edge
{
  const mat = new THREE.MeshBasicMaterial({ color: 0x170b05, fog: false });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand(-0.1, 0.1);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(rand(30, 55), rand(26, 48), 5), mat);
    cone.position.set(Math.cos(a) * 240, 0, Math.sin(a) * 240);
    scene.add(cone);
  }
}

// ----------------------------------------------------------------- colliders
const colliders = [];   // {x, z, r}
const addCollider = (x, z, r) => colliders.push({ x, z, r });

// --------------------------------------------------------------- great tiki
const TIKI = { x: -30, z: -22 };
let tikiEyes, tikiEyeLight, tikiGlow = 0;
{
  const stone = 0x6e7157, stoneD = 0x565a44, dark = 0x2a2417, teeth = 0xd8cba6;
  const parts = [];
  const B = (c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) =>
    parts.push({ g: new THREE.BoxGeometry(1, 1, 1), m: M4(x, y, z, rx, ry, rz, sx, sy, sz), c });
  // pedestal + legs + body
  parts.push({ g: new THREE.CylinderGeometry(3.4, 4.2, 1.4, 9), m: M4(0, 0.7, 0), c: 0x4c3823 });
  B(stone, -0.85, 2.4, 0, 1.25, 2.4, 1.5); B(stone, 0.85, 2.4, 0, 1.25, 2.4, 1.5);
  B(stoneD, -0.85, 1.35, 0.35, 1.35, 0.5, 1.6); B(stoneD, 0.85, 1.35, 0.35, 1.35, 0.5, 1.6); // feet
  B(stone, 0, 5.3, 0, 3.4, 3.6, 2.5);                                    // torso
  B(stoneD, 0, 4.6, 1.05, 2.6, 0.45, 0.5); B(stoneD, 0, 5.6, 1.05, 2.6, 0.45, 0.5); // carved belly bands
  B(stoneD, 0, 6.6, 1.05, 2.9, 0.5, 0.5);
  // arms folded over belly
  B(stone, -1.95, 6.0, 0, 0.85, 2.6, 1.3); B(stone, 1.95, 6.0, 0, 0.85, 2.6, 1.3);
  B(stone, -0.9, 4.9, 1.15, 1.7, 0.7, 0.7, 0, 0, -0.15); B(stone, 0.9, 4.9, 1.15, 1.7, 0.7, 0.7, 0, 0, 0.15);
  // head
  B(stone, 0, 9.3, 0, 3.8, 4.2, 2.9);
  B(stoneD, 0, 10.9, 0.9, 3.9, 0.75, 1.4);                               // brow ledge
  B(stone, 0, 9.9, 1.35, 0.75, 1.9, 0.6);                                // nose
  B(dark, 0, 8.35, 1.28, 2.75, 1.35, 0.5);                               // mouth cavity
  for (let i = 0; i < 5; i++) {                                          // teeth
    B(teeth, -1.05 + i * 0.525, 8.85, 1.35, 0.34, 0.42, 0.42);
    B(teeth, -1.05 + i * 0.525, 7.9, 1.35, 0.34, 0.38, 0.42);
  }
  B(stoneD, -1.95, 9.6, 0, 0.5, 1.5, 1.2); B(stoneD, 1.95, 9.6, 0, 0.5, 1.5, 1.2); // ears
  // crown
  B(stoneD, 0, 11.65, 0, 3.2, 0.8, 2.3);
  B(stone, 0, 12.35, 0, 2.3, 0.7, 1.7);
  parts.push({ g: new THREE.ConeGeometry(0.9, 1.2, 4), m: M4(0, 13.3, 0, 0, Math.PI / 4, 0), c: stoneD });
  // carved necklace rings (like the poster's stacked collar)
  parts.push({ g: new THREE.TorusGeometry(1.95, 0.22, 5, 10), m: M4(0, 7.25, 0, Math.PI / 2, 0, 0), c: stoneD });
  parts.push({ g: new THREE.TorusGeometry(2.15, 0.18, 5, 10), m: M4(0, 6.9, 0, Math.PI / 2, 0, 0), c: stone });
  // arm bands + shoulder caps
  B(dark, -1.95, 5.1, 0, 0.95, 0.35, 1.4); B(dark, 1.95, 5.1, 0, 0.95, 0.35, 1.4);
  B(stoneD, -1.95, 7.35, 0, 1.0, 0.6, 1.45); B(stoneD, 1.95, 7.35, 0, 1.0, 0.6, 1.45);
  // vertical carved grooves on head sides
  B(dark, -1.92, 9.3, 0.6, 0.1, 2.6, 0.28); B(dark, 1.92, 9.3, 0.6, 0.1, 2.6, 0.28);
  B(dark, -1.92, 9.3, -0.6, 0.1, 2.6, 0.28); B(dark, 1.92, 9.3, -0.6, 0.1, 2.6, 0.28);
  // crown feather blades
  for (const s of [-1, 0, 1])
    parts.push({ g: new THREE.ConeGeometry(0.34, 1.7, 4), m: M4(s * 1.1, 12.9, 0, 0, 0, -s * 0.42), c: s ? stone : stoneD });
  const mesh = new THREE.Mesh(mergeGeoms(parts), matFlat);
  const grp = new THREE.Group();
  grp.add(mesh);
  // eyes (separate, can glow)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x201a12 });
  tikiEyes = eyeMat;
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 0.3), eyeMat);
    eye.position.set(s * 0.95, 10.35, 1.42);
    grp.add(eye);
  }
  tikiEyeLight = new THREE.PointLight(0xff3311, 0, 26);
  tikiEyeLight.position.set(0, 10.3, 2.5);
  grp.add(tikiEyeLight);
  grp.position.set(TIKI.x, terrainH(TIKI.x, TIKI.z) - 0.4, TIKI.z);
  grp.rotation.y = 0.55; // gazes across the river toward the traveler
  scene.add(grp);
  addCollider(TIKI.x, TIKI.z, 4.4);
}

// ------------------------------------------------------------ dead oak tree
const TREE = { x: 36, z: 16 };
let raven, ravenWings;
{
  const bone = 0xc9a468, boneD = 0xa3814c;
  const parts = [];
  const seg = (x1, y1, z1, x2, y2, z2, r1, r2, c) => {
    const a = V3(x1, y1, z1), b = V3(x2, y2, z2);
    const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
    parts.push({
      g: new THREE.CylinderGeometry(r2, r1, len, 5),
      m: new THREE.Matrix4().compose(mid, q, V3(1, 1, 1)), c
    });
  };
  seg(0, 0, 0, 0.3, 3.8, 0.2, 0.85, 0.55, bone);                       // trunk
  seg(0.3, 3.8, 0.2, -1.6, 7.5, -0.4, 0.5, 0.22, bone);                // main limbs
  seg(0.3, 3.8, 0.2, 2.6, 7.0, 0.8, 0.45, 0.18, boneD);
  seg(0.3, 3.6, 0.2, 1.5, 5.5, -1.6, 0.35, 0.12, bone);
  seg(-1.6, 7.5, -0.4, -3.4, 9.6, -0.2, 0.2, 0.06, boneD);             // twigs
  seg(-1.6, 7.5, -0.4, -0.8, 10.0, -1.0, 0.18, 0.05, bone);
  seg(2.6, 7.0, 0.8, 4.4, 8.9, 1.4, 0.16, 0.05, bone);
  seg(2.6, 7.0, 0.8, 2.9, 9.4, 0.2, 0.15, 0.05, boneD);
  seg(1.5, 5.5, -1.6, 2.6, 6.8, -2.6, 0.11, 0.04, boneD);
  seg(0, 0.4, 0, -1.8, 1.4, 1.2, 0.35, 0.08, boneD);                   // exposed root
  seg(0, 0.4, 0, 1.4, 1.0, -1.3, 0.3, 0.07, bone);
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(mergeGeoms(parts), matFlat));
  // raven perched on the west limb
  raven = new THREE.Group();
  const feather = new THREE.MeshStandardMaterial({ color: 0x15121a, flatShading: true, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 7, 5), feather);
  body.scale.set(0.9, 0.85, 1.35);
  raven.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 5), feather);
  head.position.set(0, 0.26, 0.3);
  raven.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 4),
    new THREE.MeshStandardMaterial({ color: 0x4a4438, flatShading: true }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.24, 0.52);
  raven.add(beak);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.5), feather);
  tail.position.set(0, 0.05, -0.5);
  tail.rotation.x = -0.3;
  raven.add(tail);
  ravenWings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.42), feather);
    w.geometry.translate(s * 0.25, 0, 0);
    w.position.set(s * 0.12, 0.12, 0);
    raven.add(w);
    ravenWings.push(w);
  }
  raven.position.set(-3.4, 9.7, -0.2);
  raven.rotation.y = -2.2;
  grp.add(raven);
  grp.position.set(TREE.x, terrainH(TREE.x, TREE.z) - 0.3, TREE.z);
  scene.add(grp);
  addCollider(TREE.x, TREE.z, 1.6);
}

// -------------------------------------------------------------- rattlesnake
const SNAKE = { x: 30, z: 44 };
let snakeHead, snakeRattle, snakeNear = 0, snakeTongue;
{
  const grp = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, a = t * Math.PI * 2 * 2.6, r = lerp(1.35, 0.3, t);
    pts.push(V3(Math.cos(a) * r, 0.16 + t * 0.5, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.17, 6),
    new THREE.MeshStandardMaterial({ color: 0x7c5a33, flatShading: true, roughness: 1 }));
  grp.add(tube);
  const skin = new THREE.MeshStandardMaterial({ color: 0x6b4c2a, flatShading: true, roughness: 1 });
  snakeHead = new THREE.Group();
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.5), skin);
  snakeHead.add(h);
  for (const s of [-1, 1]) {   // eyes
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xffcc44 }));
    e.position.set(s * 0.13, 0.1, 0.12);
    snakeHead.add(e);
  }
  snakeTongue = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.32),
    new THREE.MeshBasicMaterial({ color: 0xd8304a }));
  snakeTongue.position.set(0, 0, 0.4);
  snakeTongue.scale.z = 0.01;
  snakeHead.add(snakeTongue);
  const start = pts[0];
  snakeHead.position.set(start.x, start.y + 0.15, start.z);
  snakeHead.userData.baseY = snakeHead.position.y;
  grp.add(snakeHead);
  snakeRattle = new THREE.Group();
  const rc = new THREE.MeshStandardMaterial({ color: 0xb99b6a, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.1 - i * 0.02, 5, 4), rc);
    seg.position.y = 0.14 + i * 0.13;
    snakeRattle.add(seg);
  }
  const end = pts[40];
  snakeRattle.position.set(end.x, end.y, end.z);
  grp.add(snakeRattle);
  grp.position.set(SNAKE.x, terrainH(SNAKE.x, SNAKE.z), SNAKE.z);
  grp.rotation.y = rand(0, 6);
  scene.add(grp);
}

// ---------------------------------------------------------------- armadillo
let armadillo;
{
  const grp = new THREE.Group();
  const parts = [];
  const shellC = 0x8a6a48;
  parts.push({ g: new THREE.SphereGeometry(1, 9, 7), m: M4(0, 0.42, 0, 0, 0, 0, 0.42, 0.36, 0.62), c: shellC });
  for (let i = -1; i <= 1; i++)   // shell bands
    parts.push({ g: new THREE.TorusGeometry(0.395, 0.035, 5, 12), m: M4(0, 0.42, i * 0.16, 0, 0, Math.PI / 2, 1, 1, 1.06), c: 0x67492c });
  parts.push({ g: new THREE.SphereGeometry(0.16, 6, 5), m: M4(0, 0.32, 0.62, 0, 0, 0, 1, 0.9, 1.5), c: 0x9a7a54 }); // head
  parts.push({ g: new THREE.ConeGeometry(0.06, 0.3, 4), m: M4(0, 0.28, 0.9, Math.PI / 2, 0, 0) , c: 0xa8886a });   // snout
  for (const s of [-1, 1])
    parts.push({ g: new THREE.ConeGeometry(0.05, 0.16, 4), m: M4(s * 0.09, 0.48, 0.58), c: 0x9a7a54 });            // ears
  parts.push({ g: new THREE.ConeGeometry(0.07, 0.7, 5), m: M4(0, 0.28, -0.9, -Math.PI / 2.3, 0, 0), c: 0x9a7a54 }); // tail
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
    parts.push({ g: new THREE.BoxGeometry(0.1, 0.24, 0.1), m: M4(sx * 0.24, 0.12, sz * 0.3), c: 0x67492c });
  grp.add(new THREE.Mesh(mergeGeoms(parts), matFlat));
  grp.position.set(4, 0, 8);
  scene.add(grp);
  armadillo = { grp, target: V3(4, 0, 8), pause: 1, home: { x: 4, z: 8, r: 17 } };
}

// ------------------------------------------------------------------ opossum
const POSSUM = { x: -44, z: 18 };
let possum;
{
  const grp = new THREE.Group();
  const parts = [];
  parts.push({ g: new THREE.SphereGeometry(1, 8, 6), m: M4(0, 0.34, 0, 0, 0, 0, 0.32, 0.3, 0.45), c: 0x8d857c });
  parts.push({ g: new THREE.SphereGeometry(0.17, 7, 5), m: M4(0, 0.42, 0.42, 0, 0, 0, 1, 0.95, 1.3), c: 0xe6e0d3 });
  parts.push({ g: new THREE.ConeGeometry(0.05, 0.14, 4), m: M4(0, 0.38, 0.66, Math.PI / 2, 0, 0), c: 0xd88a97 });
  for (const s of [-1, 1]) {
    parts.push({ g: new THREE.SphereGeometry(0.07, 5, 4), m: M4(s * 0.11, 0.56, 0.36, 0, 0, 0, 1, 1.15, 0.5), c: 0x3a3238 });
    parts.push({ g: new THREE.SphereGeometry(0.035, 4, 3), m: M4(s * 0.07, 0.46, 0.55), c: 0x1c1418 });
    parts.push({ g: new THREE.BoxGeometry(0.09, 0.16, 0.09), m: M4(s * 0.15, 0.1, s * 0.1 + 0.1), c: 0x6e675e });
  }
  // curled pink tail
  const tpts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, a = t * Math.PI * 1.6;
    tpts.push(V3(Math.sin(a) * 0.22, 0.3 + t * 0.05, -0.4 - t * 0.35 + Math.cos(a) * 0.06));
  }
  parts.push({ g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tpts), 16, 0.035, 5), c: 0xd88a97 });
  grp.add(new THREE.Mesh(mergeGeoms(parts), matFlat));
  const py = terrainH(POSSUM.x, POSSUM.z);
  // fallen log to perch on
  const log = new THREE.Mesh(mergeGeoms([
    { g: new THREE.CylinderGeometry(0.34, 0.42, 3.0, 7), m: M4(0, 0.3, 0, 0, 0, Math.PI / 2), c: 0x4a3320 },
    { g: new THREE.CylinderGeometry(0.12, 0.05, 0.9, 5), m: M4(-0.8, 0.65, 0.2, 0.7, 0, 0.5), c: 0x3c2919 },
    { g: new THREE.CircleGeometry(0.34, 7), m: M4(1.51, 0.3, 0, 0, Math.PI / 2, 0), c: 0x7a5c38 },
  ]), matFlat);
  log.position.set(POSSUM.x, py, POSSUM.z);
  log.rotation.y = 0.9;
  scene.add(log);
  addCollider(POSSUM.x, POSSUM.z, 1.2);
  grp.position.set(POSSUM.x, py + 0.62, POSSUM.z);
  grp.rotation.y = 0.9;
  scene.add(grp);
  possum = grp;
}

// ----------------------------------------------------------- stargazer rock
const ROCK = { x: 10, z: 36 };
{
  const grp = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.7, 0.7, 9),
    new THREE.MeshStandardMaterial({ color: 0x5c452c, flatShading: true, roughness: 1 }));
  grp.add(slab);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.07, 5, 18),
    new THREE.MeshStandardMaterial({ color: 0x3c2c1a, flatShading: true }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.36;
  grp.add(ring);
  grp.position.set(ROCK.x, terrainH(ROCK.x, ROCK.z) + 0.1, ROCK.z);
  scene.add(grp);
}

// ------------------------------------------------- plants & rocks (instanced)
const CLEARINGS = [   // landmark spots scatter must keep clear: {x, z, r(optional)}
  TIKI, TREE, SNAKE, POSSUM, ROCK,
  { x: 0, z: 52 },                 // spawn
  { x: 4, z: 8 },                  // armadillo range
  { x: -16, z: 40 }, { x: -38, z: 46 },   // hero agave / prickly pear
  { x: -4, z: 47 },                // campfire
  { x: 23, z: 30 },                // river sign
  { x: -58, z: -42, r: 15 },       // grotto
  { x: -7, z: -52, r: 14 },        // river arch
  { x: 18, z: -20 }, { x: -20, z: 20 },   // raccoon / fox ranges
  { x: 12, z: -60, r: 8 },         // bigfoot's thicket
  { x: 58, z: 60, r: 8 },          // chupacabra corner
  { x: -60, z: 60, r: 10 },        // Bevo's meadow
  { x: 78, z: 8, r: 11 },          // Winnie's den
  { x: 34, z: 62, r: 7 },          // the Bronco's trailhead
  { x: -66, z: -6, r: 18 },        // the vineyard
  { x: 19, z: 26, r: 5 },          // canoe landing
  { x: -46, z: 72, r: 6 },         // the old windmill
];
function scatterOK(x, z, buffer = 5) {
  if (Math.abs(x - riverX(z)) < 13) return false;
  if (mesaH(x, z) > 6) return false;
  for (const p of CLEARINGS)
    if (Math.hypot(x - p.x, z - p.z) < (p.r || buffer)) return false;
  return true;
}
function instScatter(geo, count, opts) {
  const mesh = new THREE.InstancedMesh(geo, matFlat.clone(), count);
  const m = new THREE.Matrix4(), C = new THREE.Color();
  mesh.material.vertexColors = !!opts.vertexColors;
  let placed = 0, tries = 0;
  while (placed < count && tries++ < count * 30) {
    const x = rand(-100, 100), z = rand(-95, 105);
    if (!scatterOK(x, z, opts.buffer || 5)) continue;
    if (opts.nearRiver && Math.abs(x - riverX(z)) > opts.nearRiver) continue;
    const s = rand(opts.smin, opts.smax);
    m.compose(V3(x, terrainH(x, z) + (opts.sink || 0) * s, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand(0, 6.3), 0)),
      V3(s * rand(0.8, 1.2), s, s * rand(0.8, 1.2)));
    mesh.setMatrixAt(placed, m);
    if (opts.vertexColors) C.setScalar(rand(0.85, 1.1)); // brightness jitter only; hues come from the geometry
    else C.setHex(opts.colors[randi(0, opts.colors.length - 1)]).multiplyScalar(rand(0.85, 1.1));
    mesh.setColorAt(placed, C);
    if (opts.collide && s > (opts.collideMin || 0)) addCollider(x, z, s * opts.collide);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
}
instScatter(new THREE.IcosahedronGeometry(0.32, 0), 240,
  { smin: 0.4, smax: 1.6, sink: -0.1, colors: [0x5a4028, 0x6a4c30, 0x4a3520] });
instScatter(new THREE.DodecahedronGeometry(1, 0), 54,
  { smin: 0.7, smax: 2.2, sink: -0.25, colors: [0x54391f, 0x624530, 0x47301c], collide: 0.85, collideMin: 1.2 });
instScatter(new THREE.ConeGeometry(0.06, 0.85, 3), 320,
  { smin: 0.5, smax: 1.3, sink: 0.3, colors: [0x6a5a2f, 0x7a6438, 0x565025], buffer: 4 });
// riverbank pebbles
instScatter(new THREE.IcosahedronGeometry(0.24, 0), 150,
  { smin: 0.4, smax: 1.1, sink: -0.1, colors: [0x7a6448, 0x8a7454, 0x66513a], nearRiver: 18, buffer: 4 });

// agave (single merged geometry, instanced)
function agaveGeo() {
  const parts = [];
  const leaves = 12;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + rand(-0.2, 0.2);
    const tilt = rand(0.5, 1.1);
    // leaf pivots at its base: translate up, tilt outward, spin around the rosette
    const m = new THREE.Matrix4().makeRotationY(a)
      .multiply(new THREE.Matrix4().makeRotationX(tilt))
      .multiply(M4(0, 0.8, 0, 0, 0, 0, 1, 1, 0.4));
    parts.push({ g: new THREE.ConeGeometry(0.16, 1.7, 4), m, c: i % 3 === 0 ? 0x55744f : 0x47624a });
  }
  return mergeGeoms(parts);
}
instScatter(agaveGeo(), 16, { smin: 0.8, smax: 1.5, vertexColors: true, collide: 0.9, collideMin: 0 });
// prickly pear (merged pads, instanced)
function pearGeo() {
  const parts = [];
  const pad = (x, y, z, ry, s) =>
    parts.push({ g: new THREE.SphereGeometry(0.5, 7, 5), m: M4(x, y, z, 0, ry, 0, s, s * 1.25, s * 0.3), c: 0x4f6b3a });
  pad(0, 0.35, 0, 0.2, 0.9); pad(0.5, 0.5, 0.15, 0.7, 0.8); pad(-0.45, 0.55, -0.1, -0.4, 0.85);
  pad(0.15, 1.0, 0.05, 0.1, 0.7); pad(-0.3, 1.15, -0.05, -0.6, 0.6); pad(0.6, 1.05, 0.1, 0.9, 0.55);
  for (let i = 0; i < 5; i++)
    parts.push({ g: new THREE.SphereGeometry(0.09, 5, 4), m: M4(rand(-0.5, 0.7), rand(1.1, 1.55), rand(-0.1, 0.15)), c: 0x8a2a1a });
  return mergeGeoms(parts);
}
instScatter(pearGeo(), 12, { smin: 0.7, smax: 1.4, vertexColors: true, collide: 0.7, collideMin: 0 });
// hero plants at the two discovery spots
{
  const agave = new THREE.Mesh(agaveGeo(), matFlat);
  agave.position.set(-16, terrainH(-16, 40), 40);
  agave.scale.setScalar(2.1);
  scene.add(agave);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 6.5, 5),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3a, flatShading: true }));
  stalk.position.set(-16, terrainH(-16, 40) + 3.2, 40);
  scene.add(stalk);
  for (let i = 0; i < 5; i++) {   // bloom knobs on the century plant stalk
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.28, 5, 4),
      new THREE.MeshStandardMaterial({ color: 0xc9a83a, flatShading: true }));
    const a = i * 2.4;
    k.position.set(-16 + Math.cos(a) * 0.55, terrainH(-16, 40) + 4.2 + i * 0.5, 40 + Math.sin(a) * 0.55);
    scene.add(k);
  }
  addCollider(-16, 40, 1.6);
  const pear = new THREE.Mesh(pearGeo(), matFlat);
  pear.position.set(-38, terrainH(-38, 46), 46);
  pear.scale.setScalar(2.0);
  scene.add(pear);
  addCollider(-38, 46, 1.5);
}

// dark juniper/cedar treeline (the poster's midground conifers)
function juniperGeo() {
  return mergeGeoms([
    { g: new THREE.CylinderGeometry(0.09, 0.16, 1.0, 5), m: M4(0, 0.5, 0), c: 0x3a2a18 },
    { g: new THREE.ConeGeometry(0.95, 1.5, 6), m: M4(0, 1.4, 0), c: 0x1e2a1a },
    { g: new THREE.ConeGeometry(0.7, 1.3, 6), m: M4(0.08, 2.1, -0.06), c: 0x243420 },
    { g: new THREE.ConeGeometry(0.42, 1.0, 5), m: M4(0, 2.75, 0), c: 0x1e2a1a },
  ]);
}
instScatter(juniperGeo(), 30, { smin: 0.9, smax: 2.3, vertexColors: true, nearRiver: 30, buffer: 6, collide: 0.4, collideMin: 1.2 });
instScatter(juniperGeo(), 18, { smin: 0.8, smax: 1.8, vertexColors: true, buffer: 6, collide: 0.4, collideMin: 1.2 });
// a dense thicket for something large to hide in…
{
  const tg = juniperGeo();
  for (const [tx, tz, s] of [[7, -56, 1.9], [17, -57, 2.2], [9, -64, 1.6], [18, -63, 1.8], [5, -61, 1.4]]) {
    const t = new THREE.Mesh(tg, matFlat);
    t.position.set(tx, terrainH(tx, tz), tz);
    t.scale.setScalar(s);
    t.rotation.y = rand(0, 6);
    scene.add(t);
    addCollider(tx, tz, 0.55 * s);
  }
}
// ocotillo — spindly whips with dark-red flower tips
function ocotilloGeo() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand(-0.3, 0.3), tilt = rand(0.12, 0.42);
    const rot = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(tilt));
    parts.push({ g: new THREE.CylinderGeometry(0.02, 0.05, 2.8, 4), m: rot.clone().multiply(M4(0, 1.4, 0)), c: 0x4a3826 });
    parts.push({ g: new THREE.ConeGeometry(0.07, 0.32, 4), m: rot.clone().multiply(M4(0, 2.9, 0)), c: 0x9a2f1a });
  }
  return mergeGeoms(parts);
}
instScatter(ocotilloGeo(), 9, { smin: 0.8, smax: 1.4, vertexColors: true, buffer: 6, collide: 0.35, collideMin: 0 });
// stacked stone cairns (trail markers)
function cairnGeo() {
  const parts = [];
  let y = 0;
  [0.55, 0.45, 0.36, 0.27, 0.18].forEach((r, i) => {
    const h = r * 0.62;
    y += h * 0.8;
    parts.push({ g: new THREE.SphereGeometry(r, 7, 5), m: M4(rand(-0.05, 0.05), y, rand(-0.05, 0.05), 0, rand(0, 6), 0, 1, 0.55, 1), c: [0x6a4c30, 0x7a5a3a, 0x5a4028][i % 3] });
    y += h * 0.55;
  });
  return mergeGeoms(parts);
}
instScatter(cairnGeo(), 6, { smin: 0.9, smax: 1.5, vertexColors: true, buffer: 7, collide: 0.7, collideMin: 0 });

// natural rock arch spanning the river (poster, mid-left)
{
  const parts = [];
  const R = (x, y, z, s, c) => parts.push({ g: new THREE.DodecahedronGeometry(1, 0), m: M4(x, y, z, rand(0, 3), rand(0, 3), rand(0, 3), s, s * 0.85, s * 0.9), c });
  for (const px of [-9.5, 9.5]) {
    R(px, 1.5, 0, 3.1, 0x54331d); R(px * 0.98, 4.6, 0.3, 2.6, 0x60432b);
    R(px * 0.94, 7.4, -0.2, 2.2, 0x4a2f1a); R(px * 0.88, 9.8, 0.2, 1.9, 0x5a3a22);
  }
  R(-5.4, 11.4, 0, 2.0, 0x54331d); R(-1.8, 12.2, 0.2, 2.1, 0x60432b);
  R(1.8, 12.2, -0.2, 2.1, 0x4a2f1a); R(5.4, 11.4, 0, 2.0, 0x5a3a22);
  const arch = new THREE.Mesh(mergeGeoms(parts), matFlat);
  const ax = riverX(-52);
  arch.position.set(ax, WATER_Y - 0.5, -52);
  scene.add(arch);
  addCollider(ax - 9.5, -52, 3.4);
  addCollider(ax + 9.5, -52, 3.4);
}

// BLANCO RIVER sign
{
  const wood = new THREE.MeshStandardMaterial({ color: 0x5c4226, flatShading: true, roughness: 1 });
  const face = (w, h, lines, fs) => canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#6b4a26'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(40,22,8,0.5)'; ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(0, 14 + i * 36); ctx.lineTo(s, 18 + i * 36); ctx.stroke(); }
    ctx.fillStyle = '#f2e2b8'; ctx.textAlign = 'center';
    lines.forEach((L, i) => { ctx.font = (i < lines.length - 1 ? 'bold ' : 'italic ') + fs[i] + 'px Georgia, serif'; ctx.fillText(L, s / 2, L === lines[0] ? 100 : 100 + i * 62); });
  });
  const grp = new THREE.Group();
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.3, 0.18), wood);
    post.position.set(s * 1.5, 1.15, 0);
    grp.add(post);
  }
  const mkPlank = (w, h, y, tex, tilt) => {
    const m = new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 1 });
    const plank = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), [wood, wood, wood, wood, m, wood]);
    plank.position.y = y;
    plank.rotation.z = tilt;
    grp.add(plank);
  };
  mkPlank(3.7, 1.5, 1.85, face(3.7, 1.5, ['BLANCO', 'RIVER', 'est. long before you'], [54, 54, 22]), 0.02);
  mkPlank(2.6, 0.6, 0.85, canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#6b4a26'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#f2e2b8'; ctx.textAlign = 'center';
    ctx.font = 'italic bold 30px Georgia, serif';
    ctx.fillText("NO SWIMMIN'", s / 2, 105);
    ctx.fillText('PAST MIDNIGHT', s / 2, 150);
  }), -0.05);
  grp.position.set(23, terrainH(23, 30), 30);
  grp.rotation.y = Math.atan2(-23, 22); // faces the spawn trail
  scene.add(grp);
  addCollider(23, 30, 1.0);
}

// ---------------------------------------------------------------- campfire
const FIRE = { x: -4, z: 47 };
let flameInner, flameOuter, fireLight;
const smokes = [];
{
  const grp = new THREE.Group();
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    parts.push({ g: new THREE.IcosahedronGeometry(0.22, 0), m: M4(Math.cos(a) * 0.95, 0.12, Math.sin(a) * 0.95, rand(0, 3), rand(0, 3), 0, 1, 0.8, 1), c: [0x5a4028, 0x6a4c30][i % 2] });
  }
  parts.push({ g: new THREE.CylinderGeometry(0.09, 0.11, 1.1, 5), m: M4(0, 0.16, 0, 0, 0.5, Math.PI / 2), c: 0x3c2414 });
  parts.push({ g: new THREE.CylinderGeometry(0.09, 0.11, 1.1, 5), m: M4(0, 0.2, 0, 0, -0.6, Math.PI / 2.2), c: 0x4a2c18 });
  grp.add(new THREE.Mesh(mergeGeoms(parts), matFlat));
  const flameMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 6), flameMat(0xff7a22));
  flameOuter.position.y = 0.75;
  grp.add(flameOuter);
  flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.8, 6), flameMat(0xffdd66));
  flameInner.position.y = 0.6;
  grp.add(flameInner);
  fireLight = new THREE.PointLight(0xff8833, 26, 24);
  fireLight.position.y = 1.2;
  grp.add(fireLight);
  const smokeTex = canvasTex(64, (ctx, s) => {
    const g2 = ctx.createRadialGradient(s / 2, s / 2, 3, s / 2, s / 2, s / 2);
    g2.addColorStop(0, 'rgba(120,105,95,0.5)');
    g2.addColorStop(1, 'rgba(120,105,95,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, s, s);
  });
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false }));
    sp.userData.t = i / 5;
    smokes.push(sp);
    grp.add(sp);
  }
  grp.position.set(FIRE.x, terrainH(FIRE.x, FIRE.z), FIRE.z);
  scene.add(grp);
  addCollider(FIRE.x, FIRE.z, 1.2);
}

// -------------------------------------------- Trader Blanco's Grotto (tiki bar)
const GROTTO = { x: -58, z: -42 };
const torchFlames = [];
let grottoPuffer;
{
  const gy = terrainH(GROTTO.x, GROTTO.z);
  const grp = new THREE.Group();
  const rock = new THREE.MeshStandardMaterial({ color: 0x56402a, flatShading: true, roughness: 1, side: THREE.DoubleSide });
  // shell: open-arc wall (door gap faces +X, toward the river) + squashed dome roof
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(9, 10.5, 7, 14, 1, true, Math.PI * 0.62, Math.PI * 1.76), rock);
  wall.position.y = 3.5;
  grp.add(wall);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9.6, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), rock);
  dome.position.y = 6.6;
  dome.scale.y = 0.55;
  grp.add(dome);
  // interior furniture (bar along the back wall at -X)
  const woodD = new THREE.MeshStandardMaterial({ color: 0x4a3018, flatShading: true, roughness: 1 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.15, 5.6), woodD);
  bar.position.set(-4.2, 0.58, 0);
  grp.add(bar);
  for (let i = 0; i < 9; i++) {   // bamboo bar front
    const bam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 5),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xb99a5c : 0xa3813f, flatShading: true }));
    bam.position.set(-3.5, 0.55, -2.4 + i * 0.6);
    grp.add(bam);
  }
  for (const sy of [1.6, 2.5]) {  // back shelves
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 5.2), woodD);
    shelf.position.set(-6.6, sy, 0);
    grp.add(shelf);
  }
  // glowing tiki mugs (unlit materials read as glow in the dark)
  const mugColors = [0x7dff9a, 0xffb347, 0xff6a55, 0x5fd8ff, 0xd8ff5f, 0xff8ad8];
  for (let i = 0; i < 12; i++) {
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.32, 6),
      new THREE.MeshBasicMaterial({ color: mugColors[i % mugColors.length] }));
    mug.position.set(-6.6, (i < 6 ? 1.6 : 2.5) + 0.21, -2.1 + (i % 6) * 0.84);
    grp.add(mug);
  }
  for (const sz of [-1.6, 1.6]) { // stools
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.72, 7), woodD);
    stool.position.set(-2.2, 0.36, sz);
    grp.add(stool);
  }
  const barrel = new THREE.Mesh(mergeGeoms([
    { g: new THREE.CylinderGeometry(0.55, 0.55, 1.1, 9), m: M4(0, 0.55, 0), c: 0x5c4226 },
    { g: new THREE.TorusGeometry(0.56, 0.045, 5, 10), m: M4(0, 0.3, 0, Math.PI / 2, 0, 0), c: 0x2c2018 },
    { g: new THREE.TorusGeometry(0.56, 0.045, 5, 10), m: M4(0, 0.8, 0, Math.PI / 2, 0, 0), c: 0x2c2018 },
  ]), matFlat);
  barrel.position.set(-4.6, 0, 3.4);
  grp.add(barrel);
  // two carved tiki heads with glowing eyes, flanking the bar
  for (const sz of [-3.6, 3.6]) {
    const head = new THREE.Mesh(mergeGeoms([
      { g: new THREE.BoxGeometry(0.9, 1.5, 0.8), m: M4(0, 0.75, 0), c: 0x6e7157 },
      { g: new THREE.BoxGeometry(0.95, 0.28, 0.5), m: M4(0, 1.28, 0.25), c: 0x565a44 },
      { g: new THREE.BoxGeometry(0.6, 0.34, 0.2), m: M4(0, 0.45, 0.42), c: 0x2a2417 },
    ]), matFlat);
    head.position.set(-5.6, 0, sz);
    head.rotation.y = Math.PI / 2 + (sz > 0 ? -0.5 : 0.5);
    grp.add(head);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xff5522 }));
      eye.position.set(-5.6 + Math.sin(head.rotation.y) * 0.42 + s * 0.2, 1.05, sz + Math.cos(head.rotation.y) * 0.42);
      grp.add(eye);
    }
  }
  // blowfish lamp (the Trader Sam's staple)
  const puffer = new THREE.Group();
  const puffParts = [{ g: new THREE.SphereGeometry(0.42, 8, 6), m: M4(0, 0, 0), c: 0xffb347 }];
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2), e = rand(-1, 1);
    const dir = V3(Math.cos(a) * Math.sqrt(1 - e * e), e, Math.sin(a) * Math.sqrt(1 - e * e));
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir);
    puffParts.push({ g: new THREE.ConeGeometry(0.05, 0.26, 4), m: new THREE.Matrix4().compose(dir.multiplyScalar(0.45), q, V3(1, 1, 1)), c: 0xd88a3a });
  }
  const puffMesh = new THREE.Mesh(mergeGeoms(puffParts),
    new THREE.MeshBasicMaterial({ color: 0xffcf88, vertexColors: true }));
  puffer.add(puffMesh);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 4), woodD);
  cord.position.y = 1.15;
  puffer.add(cord);
  const puffLight = new THREE.PointLight(0xffaa55, 14, 16);
  puffer.add(puffLight);
  puffer.position.set(-3, 3.2, 0);
  grp.add(puffer);
  grottoPuffer = puffer;
  // entrance torches
  for (const sz of [-3.2, 3.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.2, 5), woodD);
    post.position.set(9.2, 1.1, sz);
    grp.add(post);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 5),
      new THREE.MeshBasicMaterial({ color: 0xff9933, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    fl.position.set(9.2, 2.5, sz);
    torchFlames.push(fl);
    grp.add(fl);
    const tl = new THREE.PointLight(0xff8833, 10, 12);
    tl.position.set(9.2, 2.6, sz);
    grp.add(tl);
  }
  grp.position.set(GROTTO.x, gy, GROTTO.z);
  scene.add(grp);
  // wall colliders (leave the +X doorway open)
  for (let a = 0.45; a < Math.PI * 2 - 0.44; a += 0.38)
    addCollider(GROTTO.x + Math.cos(a + Math.PI) * -9.6, GROTTO.z + Math.sin(a + Math.PI) * -9.6, 2.2);
  addCollider(GROTTO.x - 4.2, GROTTO.z, 3.0);      // bar
  addCollider(GROTTO.x - 4.6, GROTTO.z + 3.4, 0.8); // barrel
}

// ------- grotto interior detail, straight from the real Tiki Blanco photos
let stageSeen = false;
{
  const gy = terrainH(GROTTO.x, GROTTO.z);
  const gx = new THREE.Group();
  gx.position.set(GROTTO.x, gy, GROTTO.z);

  // wall of carved masks (every color in the collection)
  const maskParts = [];
  const maskCols = [[0xa8452a, 0xe8cf8a], [0x8a6534, 0x241505], [0x4a6448, 0xd8b98c],
    [0x9a3a4a, 0xe8e2d2], [0x6b4c24, 0xff8844], [0x54627a, 0xe8cf8a], [0xb5824e, 0x2a1608]];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.05 + i * 0.13);           // along the back wall arc
    const r = 8.2, mx = Math.cos(a) * r, mz = Math.sin(a) * r;
    const my = 2.6 + (i % 3) * 1.1;
    const ry = Math.atan2(-mx, -mz);
    const [base, accent] = maskCols[i];
    const M = (dx, dy, sx, sy, sz, c) =>
      maskParts.push({ g: new THREE.BoxGeometry(sx, sy, sz), m: new THREE.Matrix4().makeRotationY(ry).premultiply(new THREE.Matrix4().makeTranslation(mx, my + dy, mz)).multiply(M4(dx, 0, 0.1, 0, 0, 0)), c });
    M(0, 0, 0.55, 0.95, 0.14, base);                 // face
    M(0, 0.28, 0.6, 0.14, 0.18, accent);             // brow
    M(-0.13, 0.1, 0.14, 0.12, 0.16, 0x1c1208);       // eyes
    M(0.13, 0.1, 0.14, 0.12, 0.16, 0x1c1208);
    M(0, -0.24, 0.34, 0.18, 0.16, accent);           // mouth
  }
  gx.add(new THREE.Mesh(mergeGeoms(maskParts), matFlat));

  // skull shelf (the horror corner)
  const skullParts = [];
  skullParts.push({ g: new THREE.BoxGeometry(2.2, 0.08, 0.5), m: M4(-4.6, 2.1, 2.9), c: 0x4a3018 });
  for (let i = 0; i < 3; i++) {
    const sx2 = -5.3 + i * 0.75;
    skullParts.push({ g: new THREE.SphereGeometry(0.22, 7, 6), m: M4(sx2, 2.36, 2.9, 0, 0.6, 0, 1, 0.95, 1.05), c: 0xd8ccb0 });
    skullParts.push({ g: new THREE.BoxGeometry(0.2, 0.12, 0.16), m: M4(sx2, 2.16, 2.95), c: 0xc4b89c });
    skullParts.push({ g: new THREE.BoxGeometry(0.06, 0.07, 0.05), m: M4(sx2 - 0.06, 2.38, 3.08), c: 0x1c1208 });
    skullParts.push({ g: new THREE.BoxGeometry(0.06, 0.07, 0.05), m: M4(sx2 + 0.06, 2.38, 3.08), c: 0x1c1208 });
  }
  // ship's wheel on the wall above them
  skullParts.push({ g: new THREE.TorusGeometry(0.55, 0.06, 5, 12), m: M4(-6.2, 4.2, 3.4, 0, Math.PI / 3, 0), c: 0x5c3a1c });
  for (let i = 0; i < 4; i++)
    skullParts.push({ g: new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4), m: M4(-6.2, 4.2, 3.4, Math.PI / 2, 0, i * Math.PI / 4).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), c: 0x6b4a26 });
  gx.add(new THREE.Mesh(mergeGeoms(skullParts), matFlat));

  // pink rattan pendant lamps over the bar
  for (let i = 0; i < 3; i++) {
    const lz = -1.6 + i * 1.6;
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.5, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xd84a9a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
    shade.position.set(-3.4, 3.4, lz);
    gx.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xff9ad0 }));
    bulb.position.set(-3.4, 3.32, lz);
    gx.add(bulb);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 4),
      new THREE.MeshBasicMaterial({ color: 0x1c1208 }));
    cord.position.set(-3.4, 4.4, lz);
    gx.add(cord);
  }
  const magenta = new THREE.PointLight(0xff4fae, 7, 11);
  magenta.position.set(-3.4, 3.2, 0);
  gx.add(magenta);

  // neon TIKI BLÄNCO sign over the back bar
  const neonTex = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#180a10'; ctx.fillRect(0, 0, s, s);
    ctx.shadowColor = '#ff4fae'; ctx.shadowBlur = 22;
    ctx.fillStyle = '#ff9ad0'; ctx.textAlign = 'center';
    ctx.font = 'bold 46px Georgia, serif';
    ctx.fillText('TIKI', s / 2, 108);
    ctx.fillText('BLÄNCO', s / 2, 168);
  });
  const neon = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.08),
    [matFlat, matFlat, matFlat, matFlat, new THREE.MeshBasicMaterial({ map: neonTex }), matFlat]);
  neon.position.set(-7.6, 4.4, 0);
  neon.rotation.y = Math.PI / 2;
  gx.add(neon);

  // the stage — string lights, drum kit, amps, colored wash
  const stageParts = [];
  stageParts.push({ g: new THREE.BoxGeometry(4.6, 0.42, 2.6), m: M4(0.6, 0.21, -5.6), c: 0x3c2c1a });
  stageParts.push({ g: new THREE.CylinderGeometry(0.55, 0.55, 0.5, 9), m: M4(0.6, 0.95, -5.9, Math.PI / 2, 0, 0), c: 0xa85a2a }); // bass drum
  stageParts.push({ g: new THREE.CircleGeometry(0.55, 9), m: M4(0.6, 0.95, -5.62), c: 0xe8e2d2 });
  stageParts.push({ g: new THREE.CylinderGeometry(0.26, 0.26, 0.3, 8), m: M4(0.15, 1.45, -6.1, 0.3, 0, 0), c: 0xb56a3a });   // toms
  stageParts.push({ g: new THREE.CylinderGeometry(0.26, 0.26, 0.3, 8), m: M4(1.05, 1.45, -6.1, 0.3, 0, 0), c: 0xb56a3a });
  stageParts.push({ g: new THREE.CylinderGeometry(0.3, 0.3, 0.22, 8), m: M4(-0.5, 1.05, -5.4), c: 0xc4b89c });               // snare
  for (const cx of [-1.0, 2.1]) {                                                                                            // cymbals
    stageParts.push({ g: new THREE.CylinderGeometry(0.02, 0.03, 1.5, 4), m: M4(cx, 1.2, -6.2), c: 0x2a2a2a });
    stageParts.push({ g: new THREE.CylinderGeometry(0.42, 0.42, 0.03, 10), m: M4(cx, 1.95, -6.2, 0, 0, 0.08), c: 0xd8b34a });
  }
  for (const ax of [-1.6, 2.8]) {                                                                                            // amps
    stageParts.push({ g: new THREE.BoxGeometry(0.9, 1.1, 0.7), m: M4(ax, 0.97, -6.3), c: 0x1c1a18 });
    stageParts.push({ g: new THREE.BoxGeometry(0.74, 0.8, 0.05), m: M4(ax, 1.05, -5.94), c: 0x3a3632 });
  }
  stageParts.push({ g: new THREE.CylinderGeometry(0.025, 0.035, 1.6, 4), m: M4(0.6, 1.2, -4.6), c: 0x2a2a2a });               // mic stand
  stageParts.push({ g: new THREE.SphereGeometry(0.07, 5, 4), m: M4(0.6, 2.02, -4.6), c: 0x1c1a18 });
  gx.add(new THREE.Mesh(mergeGeoms(stageParts), matFlat));
  addCollider(GROTTO.x + 0.6, GROTTO.z - 5.6, 2.6);
  // stage wash: two emissive beam cones, red and blue (like show night)
  for (const [bx, bc] of [[-1.2, 0xff2233], [2.4, 0x3355ff]]) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.0, 3.4, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: bc, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(bx, 3.4, -5.6);
    gx.add(beam);
  }
  // string lights: two sagging strands across the ceiling
  const bulbCols = [0xffd9a0, 0xff5566, 0x66aaff, 0xffaa66];
  for (const [z1, z2, y0] of [[-6.5, 6.5, 5.0], [-5, 5, 5.6]]) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const px = lerp(-5, 5, t) * (z1 < -6 ? 0.7 : -0.6);
      const pz = lerp(z1, z2, t);
      const py = y0 - Math.sin(Math.PI * t) * 1.1;
      pts.push(V3(px, py, pz));
      if (i > 0 && i < 12) {
        const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0),
          new THREE.MeshBasicMaterial({ color: bulbCols[i % bulbCols.length] }));
        bulb.position.set(px, py - 0.09, pz);
        gx.add(bulb);
      }
    }
    const lg = new THREE.BufferGeometry().setFromPoints(pts);
    gx.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x1c1208 })));
  }

  // jungle wall with blue accents + glass fishing floats in the corner
  const jungleParts = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.28 + i * 0.055);
    const r = rand(7.2, 8.2);
    jungleParts.push({
      g: new THREE.IcosahedronGeometry(0.8, 0),
      m: M4(Math.cos(a) * r, rand(0.8, 3.6), Math.sin(a) * r, rand(0, 3), rand(0, 3), 0, 1, rand(0.7, 1.3), 0.7),
      c: [0x24421e, 0x2e5426, 0x1c3618][i % 3]
    });
  }
  gx.add(new THREE.Mesh(mergeGeoms(jungleParts), matFlat));
  const blueAccent = new THREE.PointLight(0x3355ff, 5, 9);
  blueAccent.position.set(1.5, 2.5, 5.5);
  gx.add(blueAccent);
  for (let i = 0; i < 3; i++) {   // glass floats
    const float = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6),
      new THREE.MeshStandardMaterial({ color: [0x3a7a9a, 0x4a9a6a, 0x2a5a8a][i], transparent: true, opacity: 0.55, roughness: 0.2 }));
    float.position.set(-1 + i * 1.1, 3.9 - (i % 2) * 0.4, 5.8);
    gx.add(float);
  }

  // glowing tiki fountain by the door
  const fountainParts = [];
  fountainParts.push({ g: new THREE.CylinderGeometry(0.75, 0.85, 0.45, 9), m: M4(3.6, 0.22, 3.6), c: 0x565a44 });
  fountainParts.push({ g: new THREE.CircleGeometry(0.62, 9), m: M4(3.6, 0.46, 3.6, -Math.PI / 2, 0, 0), c: 0x3a6a7a });
  fountainParts.push({ g: new THREE.BoxGeometry(0.5, 0.9, 0.4), m: M4(3.6, 0.9, 3.85, 0, Math.PI, 0), c: 0x6e7157 });
  fountainParts.push({ g: new THREE.BoxGeometry(0.4, 0.16, 0.12), m: M4(3.6, 1.0, 3.62), c: 0x2a2417 });
  gx.add(new THREE.Mesh(mergeGeoms(fountainParts), matFlat));
  const fountainGlow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffc966 }));
  fountainGlow.position.set(3.6, 0.62, 3.6);
  gx.add(fountainGlow);
  addCollider(GROTTO.x + 3.6, GROTTO.z + 3.6, 1.0);

  // peacock chair, throne of the grotto
  const chairParts = [];
  chairParts.push({ g: new THREE.CircleGeometry(1.05, 12, 0, Math.PI), m: M4(5.2, 1.6, -2.4, 0, -Math.PI / 3.2, 0), c: 0xb99a5c });
  chairParts.push({ g: new THREE.CylinderGeometry(0.42, 0.5, 0.5, 8), m: M4(5.2, 0.5, -2.4), c: 0xa3813f });
  chairParts.push({ g: new THREE.CylinderGeometry(0.36, 0.42, 0.12, 8), m: M4(5.2, 0.8, -2.4), c: 0x8a3520 });
  gx.add(new THREE.Mesh(mergeGeoms(chairParts), matFlat));
  addCollider(GROTTO.x + 5.2, GROTTO.z - 2.4, 0.8);

  scene.add(gx);
}

// ----------------------------------------------------- roaming critters
const wanderers = [];
function makeWanderer(grp, home, speed, opts = {}) {
  const w = { grp, home, speed, target: V3(grp.position.x, 0, grp.position.z),
    pause: rand(1, 3), freezeNear: opts.freezeNear || 0, sway: opts.sway || 0, extraY: opts.extraY || 0 };
  wanderers.push(w);
  return w;
}
function updateWanderer(w, dt) {
  const g = w.grp;
  const dp = Math.hypot(player.pos.x - g.position.x, player.pos.z - g.position.z);
  let moving = false;
  if (w.freezeNear && dp < w.freezeNear) {
    w.pause = Math.max(w.pause, 1.2);
  } else if (w.pause > 0) {
    w.pause -= dt;
  } else {
    const dx = w.target.x - g.position.x, dz = w.target.z - g.position.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.6) {
      w.pause = rand(1.2, 4);
      if (w.onArrive) w.onArrive(w);
      let tx, tz, tries = 0;
      do { tx = w.home.x + rand(-w.home.r, w.home.r); tz = w.home.z + rand(-w.home.r, w.home.r); }
      while (terrainH(tx, tz) < WATER_Y + 0.3 && tries++ < 10);
      w.target.set(tx, 0, tz);
    } else {
      moving = true;
      g.position.x += dx / len * w.speed * dt;
      g.position.z += dz / len * w.speed * dt;
      g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-6 * dt));
    }
  }
  g.position.y = Math.max(terrainH(g.position.x, g.position.z), WATER_Y - 0.15)
    + w.extraY + (moving ? Math.abs(Math.sin(nowT * 8)) * 0.05 : 0);
  if (w.sway && moving) g.rotation.z = Math.sin(nowT * 9) * w.sway;
  else if (w.sway) g.rotation.z = lerp(g.rotation.z, 0, 0.1);
  w.moving = moving;
  return moving;
}
// small helpers shared by the critter builders below
function critterMesh(build) {
  const parts = [];
  const S = (x, y, z, sx, sy, sz, c, curly) =>
    parts.push({ g: curly ? new THREE.IcosahedronGeometry(1, 1) : new THREE.SphereGeometry(1, 7, 5), m: M4(x, y, z, 0, 0, 0, sx, sy, sz), c });
  const B = (x, y, z, sx, sy, sz, c, rx = 0, ry = 0, rz = 0) =>
    parts.push({ g: new THREE.BoxGeometry(1, 1, 1), m: M4(x, y, z, rx, ry, rz, sx, sy, sz), c });
  const C = (x, y, z, r, h, c, rx = 0, ry = 0, rz = 0) =>
    parts.push({ g: new THREE.ConeGeometry(r, h, 5), m: M4(x, y, z, rx, ry, rz), c });
  build(S, B, C, parts);
  return new THREE.Mesh(mergeGeoms(parts), matFlat);
}

// raccoon — masked bandit of the riverbank
let raccoon;
{
  const grp = new THREE.Group();
  grp.add(critterMesh((S, B, C) => {
    S(0, 0.28, 0, 0.28, 0.24, 0.4, 0x6e6a64);
    S(0, 0.42, 0.38, 0.17, 0.15, 0.16, 0x8d8880);
    B(0, 0.44, 0.48, 0.3, 0.09, 0.09, 0x1c1a1a);            // mask
    S(0, 0.36, 0.5, 0.07, 0.06, 0.1, 0xd8d2c8);
    S(0, 0.37, 0.6, 0.03, 0.03, 0.03, 0x111111);
    C(-0.09, 0.57, 0.34, 0.05, 0.12, 0x55514c); C(0.09, 0.57, 0.34, 0.05, 0.12, 0x55514c);
    for (let i = 0; i < 5; i++)                              // ringed tail
      S(0, 0.3 + i * 0.045, -0.42 - i * 0.12, 0.1 - i * 0.012, 0.1 - i * 0.012, 0.09, i % 2 ? 0x28241f : 0x55514c);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
      B(sx * 0.15, 0.09, sz * 0.2, 0.09, 0.18, 0.09, 0x3a3632);
  }));
  grp.position.set(18, 0, -20);
  scene.add(grp);
  raccoon = makeWanderer(grp, { x: 18, z: -20, r: 12 }, 1.6, { freezeNear: 3 });
}

// gray fox — trots a wide patrol
let fox;
{
  const grp = new THREE.Group();
  grp.add(critterMesh((S, B, C) => {
    S(0, 0.32, 0, 0.24, 0.24, 0.46, 0xb5502a);
    S(0, 0.3, 0.28, 0.16, 0.18, 0.18, 0xe8ddc8);
    S(0, 0.5, 0.42, 0.15, 0.13, 0.16, 0xb5502a);
    C(0, 0.45, 0.6, 0.07, 0.22, 0xe8ddc8, Math.PI / 2);
    C(-0.08, 0.66, 0.38, 0.06, 0.16, 0xb5502a); C(0.08, 0.66, 0.38, 0.06, 0.16, 0xb5502a);
    C(0, 0.38, -0.52, 0.13, 0.52, 0xb5502a, -2.2);
    S(0, 0.52, -0.72, 0.08, 0.08, 0.08, 0xe8ddc8);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
      B(sx * 0.13, 0.1, sz * 0.22, 0.08, 0.22, 0.08, 0x2c1d12);
  }));
  grp.position.set(-20, 0, 20);
  scene.add(grp);
  fox = makeWanderer(grp, { x: -20, z: 20, r: 20 }, 2.7);
}

// Bevo — a burnt-orange longhorn, far from Austin
let bevo, bevoHead;
{
  const grp = new THREE.Group();
  grp.add(critterMesh((S, B, C) => {
    S(0, 0.85, 0, 0.55, 0.5, 0.95, 0xbf5700);
    C(0, 0.7, -1.0, 0.07, 0.6, 0x8a3f00, -2.6);
    S(0, 0.28, -1.18, 0.07, 0.12, 0.07, 0x3c2414);           // tail tuft
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
      B(sx * 0.32, 0.32, sz * 0.58, 0.17, 0.66, 0.17, 0x8a3f00);
  }));
  bevoHead = critterMesh((S, B, C, parts) => {
    S(0, 0.05, 0.14, 0.22, 0.24, 0.3, 0xbf5700);
    S(0, 0.02, 0.36, 0.13, 0.18, 0.14, 0xe8e2d2);            // white blaze
    S(0, -0.12, 0.42, 0.14, 0.11, 0.13, 0xd8c8b8);           // muzzle
    S(-0.2, 0.14, 0.1, 0.09, 0.05, 0.07, 0x8a3f00); S(0.2, 0.14, 0.1, 0.09, 0.05, 0.07, 0x8a3f00);
    // the horns
    for (const s of [-1, 1]) {
      parts.push({ g: new THREE.CylinderGeometry(0.035, 0.06, 0.95, 5), m: M4(s * 0.52, 0.22, 0.08, 0, 0, s * -1.35), c: 0xe8e2d2 });
      parts.push({ g: new THREE.CylinderGeometry(0.012, 0.035, 0.6, 5), m: M4(s * 1.0, 0.42, 0.08, 0, 0, s * -0.75), c: 0xf2ede2 });
    }
  });
  bevoHead.position.set(0, 1.18, 0.85);
  grp.add(bevoHead);
  grp.position.set(-60, 0, 60);
  scene.add(grp);
  bevo = makeWanderer(grp, { x: -60, z: 60, r: 12 }, 0.8);
}

// bigfoot — half-hidden in the cedar thicket
let bigfoot, bigfootArm, bigfootWave = 0;
{
  const grp = new THREE.Group();
  grp.add(critterMesh((S, B) => {
    B(-0.22, 0.55, 0, 0.34, 1.1, 0.4, 0x3f2d1e); B(0.22, 0.55, 0, 0.34, 1.1, 0.4, 0x3f2d1e);
    S(0, 1.55, 0, 0.55, 0.68, 0.42, 0x4a3524);
    S(-0.48, 1.98, 0, 0.22, 0.22, 0.22, 0x42301f); S(0.48, 1.98, 0, 0.22, 0.22, 0.22, 0x42301f);
    B(-0.62, 1.35, 0, 0.26, 1.15, 0.3, 0x3f2d1e);
    S(0, 2.35, 0.05, 0.24, 0.27, 0.24, 0x4a3524);
    B(0, 2.45, 0.22, 0.4, 0.1, 0.14, 0x2e2014);
    S(0, 2.28, 0.2, 0.13, 0.13, 0.09, 0x6e5138);
  }));
  const armGeo = new THREE.BoxGeometry(0.26, 1.15, 0.3);
  armGeo.translate(0, -0.55, 0);
  bigfootArm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: 0x3f2d1e, flatShading: true, roughness: 1 }));
  bigfootArm.position.set(0.62, 1.95, 0);
  grp.add(bigfootArm);
  grp.position.set(12, terrainH(12, -60), -60);
  grp.rotation.y = 2.6; // peers out of the thicket
  scene.add(grp);
  addCollider(12, -60, 1.0);
  bigfoot = grp;
  // a trail of very large footprints from the riverbank into the thicket
  const printParts = [];
  const fpGeo = new THREE.CircleGeometry(0.32, 7);
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const fx = lerp(riverX(-59) + 7, 11, t);
    const fz = lerp(-58, -60, t) + Math.sin(t * 6) * 0.6;
    const side = (i % 2 ? 1 : -1) * 0.45;
    printParts.push({
      g: fpGeo.clone(),
      m: M4(fx + side, terrainH(fx + side, fz) + 0.03, fz, -Math.PI / 2, rand(-0.2, 0.2), 0, 1, 1.55, 1),
      c: 0x2e1d10
    });
  }
  scene.add(new THREE.Mesh(mergeGeoms(printParts), new THREE.MeshBasicMaterial({ vertexColors: true })));
}

// chupacabra — glowing eyes in the dark southeast corner
let chupa, chupaEyes = [];
{
  const grp = new THREE.Group();
  grp.add(critterMesh((S, B, C) => {
    S(0, 0.42, 0, 0.2, 0.26, 0.42, 0x5a6152);
    S(0, 0.4, -0.28, 0.18, 0.22, 0.18, 0x525a4c);
    S(0, 0.62, 0.36, 0.12, 0.11, 0.16, 0x5a6152);
    C(0, 0.58, 0.52, 0.05, 0.18, 0x49523f, Math.PI / 2);
    for (let i = 0; i < 5; i++) C(0, 0.66 - i * 0.015, 0.15 - i * 0.13, 0.05, 0.17, 0x39413a);
    C(0, 0.4, -0.52, 0.05, 0.4, 0x49523f, -2.4);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
      B(sx * 0.11, 0.14, sz * 0.24, 0.06, 0.3, 0.06, 0x49523f);
  }));
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    eye.position.set(s * 0.05, 0.67, 0.47);
    chupaEyes.push(eye);
    grp.add(eye);
  }
  grp.position.set(58, 0, 60);
  scene.add(grp);
  chupa = makeWanderer(grp, { x: 58, z: 60, r: 8 }, 1.1);
  // ...and the evidence: picked-clean bones and a goat skull in its corner
  const evParts = [];
  for (const [bx, bz, ry] of [[54.5, 56.5, 0.8], [56, 55.5, 2.2]]) {
    evParts.push({ g: new THREE.CylinderGeometry(0.05, 0.05, 0.7, 5), m: M4(bx, terrainH(bx, bz) + 0.06, bz, 0, ry, Math.PI / 2), c: 0xd8ccb0 });
    evParts.push({ g: new THREE.SphereGeometry(0.08, 5, 4), m: M4(bx + Math.cos(ry) * 0.35, terrainH(bx, bz) + 0.06, bz - Math.sin(ry) * 0.35), c: 0xd8ccb0 });
  }
  const sy = terrainH(55, 57.5) + 0.14;
  evParts.push({ g: new THREE.SphereGeometry(0.16, 6, 5), m: M4(55, sy, 57.5, 0, 0.6, 0, 1, 0.85, 1.2), c: 0xd8ccb0 });
  for (const s of [-1, 1])
    evParts.push({ g: new THREE.ConeGeometry(0.035, 0.22, 4), m: M4(55 + s * 0.12, sy + 0.14, 57.4, 0, 0, s * 0.9), c: 0xc4b89c });
  scene.add(new THREE.Mesh(mergeGeoms(evParts), matFlat));
}

// The Watcher — a still figure on the east rim (was he there a moment ago?)
let watcher, watcherMat, watcherFade = -1;
const WATCHER = { x: 104, z: 46 };
{
  watcherMat = new THREE.MeshBasicMaterial({ color: 0x140b07, transparent: true });
  const grp = new THREE.Group();
  const add = (geo, x, y, z, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, watcherMat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    grp.add(m);
  };
  add(new THREE.ConeGeometry(0.5, 1.7, 6), 0, 0.85, 0);            // cloak
  add(new THREE.SphereGeometry(0.18, 6, 5), 0, 1.85, 0);           // head
  add(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 7), 0, 1.95, 0); // hat brim
  add(new THREE.CylinderGeometry(0.2, 0.26, 0.3, 6), 0, 2.1, 0);   // hat crown
  add(new THREE.CylinderGeometry(0.03, 0.04, 2.3, 5), 0.55, 1.15, 0, 0, -0.08); // staff
  grp.position.set(WATCHER.x, terrainH(WATCHER.x, WATCHER.z), WATCHER.z);
  grp.lookAt(0, grp.position.y, 0);
  scene.add(grp);
  watcher = grp;
}

// Wynonna — the goodest ranger in the Hill Country
let wyn, wynTail, wynState = 'wait', wynWag = 0, wynZoom = 0, wynRiding = false;
{
  const grp = new THREE.Group();
  grp.add(critterMesh((S, B, C, parts) => {
    S(0, 0.3, 0, 0.26, 0.22, 0.34, 0x6b4f38, true);          // curly chocolate body
    S(0, 0.26, 0.2, 0.17, 0.17, 0.15, 0xe8ddcf, true);       // cream chest
    S(0, 0.52, 0.3, 0.17, 0.16, 0.16, 0x6b4f38, true);       // head
    S(0, 0.64, 0.3, 0.11, 0.09, 0.11, 0x6b4f38, true);       // topknot poof
    S(0, 0.46, 0.44, 0.08, 0.07, 0.09, 0xe8ddcf, true);      // muzzle
    S(0, 0.48, 0.53, 0.035, 0.035, 0.035, 0x141210);         // nose
    S(-0.06, 0.55, 0.43, 0.03, 0.03, 0.02, 0x1c1410); S(0.06, 0.55, 0.43, 0.03, 0.03, 0.02, 0x1c1410);
    S(-0.16, 0.5, 0.27, 0.07, 0.13, 0.06, 0x5a3f2c, true);   // floppy ears
    S(0.16, 0.5, 0.27, 0.07, 0.13, 0.06, 0x5a3f2c, true);
    parts.push({ g: new THREE.TorusGeometry(0.27, 0.04, 5, 10), m: M4(0, 0.31, 0.09, 0, 0, 0, 1, 0.85, 1), c: 0xd87a6a }); // pink harness
    B(0, 0.44, 0.09, 0.12, 0.05, 0.3, 0xd87a6a);             // harness back strap
    S(0, 0.2, 0.33, 0.032, 0.04, 0.01, 0xd8b84a);            // gold tag
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
      B(sx * 0.12, 0.1, sz * 0.15, 0.09, 0.2, 0.09, 0xe8ddcf); // white legs
  }));
  const tailGeo = new THREE.ConeGeometry(0.06, 0.3, 5);
  tailGeo.translate(0, 0.15, 0);
  tailGeo.rotateX(-1.0);
  wynTail = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ color: 0x6b4f38, flatShading: true, roughness: 1 }));
  wynTail.position.set(0, 0.38, -0.32);
  grp.add(wynTail);
  grp.position.set(-2.2, terrainH(-2.2, 45.2), 45.2);
  grp.rotation.y = 2.4; // watching the fire
  scene.add(grp);
  wyn = grp;
}

// ------------------------------------- the old carving (petroglyph, hidden)
const TATTOO = { x: riverX(-84), z: -84 };
{
  const tex = canvasTex(512, (ctx, s) => {
    // weathered rock face
    ctx.fillStyle = '#4a3220'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${randi(30, 90)},${randi(20, 55)},${randi(10, 30)},${rand(0.05, 0.25)})`;
      ctx.fillRect(rand(0, s), rand(0, s), rand(1, 4), rand(1, 4));
    }
    const pale = 'rgba(226,204,158,0.92)', paleF = 'rgba(226,204,158,0.88)';
    ctx.strokeStyle = pale; ctx.fillStyle = paleF;
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // --- monstera leaves (top-left, top-right, right-mid), fenestrated
    const leaf = (cx, cy, rot, sc) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc);
      ctx.beginPath(); ctx.ellipse(0, 0, 34, 62, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 7;
      for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) {          // slits
        ctx.beginPath();
        ctx.moveTo(sd * 36, -48 + i * 28);
        ctx.lineTo(sd * 8, -38 + i * 28);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(0, 58); ctx.stroke(); // midrib
      ctx.restore();
      ctx.strokeStyle = pale; ctx.lineWidth = 4;
    };
    leaf(140, 120, -0.55, 1.05);
    leaf(372, 118, 0.55, 1.05);
    leaf(408, 300, 0.95, 0.85);
    // --- ivy sprigs (left)
    const ivy = (cx, cy, sc) => {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
      ctx.beginPath();
      ctx.moveTo(0, 14); ctx.quadraticCurveTo(-10, 2, -14, -4); ctx.quadraticCurveTo(-6, -4, -6, -10);
      ctx.quadraticCurveTo(0, -18, 6, -10); ctx.quadraticCurveTo(6, -4, 14, -4);
      ctx.quadraticCurveTo(10, 2, 0, 14);
      ctx.fill(); ctx.restore();
    };
    ivy(86, 250, 1.2); ivy(64, 320, 1.0); ivy(102, 390, 1.3); ivy(128, 440, 0.9);
    ctx.beginPath(); ctx.moveTo(90, 262); ctx.quadraticCurveTo(70, 300, 68, 312);
    ctx.moveTo(70, 332); ctx.quadraticCurveTo(84, 366, 100, 380);
    ctx.moveTo(108, 402); ctx.quadraticCurveTo(118, 424, 126, 432);
    ctx.stroke();
    // --- crossed bones (behind the jaw)
    const bone = (x1, y1, x2, y2) => {
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.save(); ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      for (const [bx, by, sgn] of [[x1, y1, -1], [x2, y2, 1]])
        for (const off of [-0.5, 0.5]) {
          ctx.beginPath();
          ctx.arc(bx + Math.cos(a + off * sgn * 1.8) * 10, by + Math.sin(a + off * sgn * 1.8) * 10, 11, 0, 7);
          ctx.fill();
        }
      ctx.restore();
    };
    bone(150, 356, 368, 452); bone(362, 356, 144, 452);
    // --- snake body coiling around the skull (drawn under the skull)
    ctx.lineWidth = 21;
    ctx.beginPath();
    ctx.moveTo(256, 132);
    ctx.bezierCurveTo(330, 128, 366, 190, 358, 250);   // right loop
    ctx.bezierCurveTo(352, 306, 320, 330, 296, 352);
    ctx.bezierCurveTo(260, 384, 210, 380, 178, 402);   // across under jaw
    ctx.bezierCurveTo(150, 420, 158, 452, 190, 462);   // low left curl
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(256, 132);
    ctx.bezierCurveTo(196, 130, 158, 176, 160, 236);   // left loop
    ctx.bezierCurveTo(162, 280, 186, 306, 208, 330);
    ctx.stroke();
    // rattle (bottom right of the low curl)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(206 + i * 16, 466 + i * 6, 9 - i * 1.5, 7 - i, 0.4, 0, 7);
      ctx.stroke();
    }
    // scale ticks along the coils
    ctx.lineWidth = 2.4;
    const ticks = [
      [300, 150, 348, 220, 6], [356, 240, 340, 300, 5], [316, 322, 280, 352, 5],
      [246, 372, 196, 396, 5], [172, 412, 180, 448, 4],
      [216, 138, 172, 190, 5], [162, 216, 172, 276, 5], [184, 296, 204, 324, 4],
    ];
    for (const [x1, y1, x2, y2, n] of ticks)
      for (let i = 0; i <= n; i++) {
        const t = i / n, px = lerp(x1, x2, t), py = lerp(y1, y2, t);
        ctx.beginPath(); ctx.arc(px, py, 6, 0.6, 2.5); ctx.stroke();
      }
    ctx.lineWidth = 4;
    // --- the skull
    ctx.fillStyle = paleF;
    ctx.beginPath();                                   // cranium + jaw silhouette
    ctx.moveTo(166, 232);
    ctx.bezierCurveTo(158, 130, 354, 130, 346, 232);
    ctx.bezierCurveTo(344, 268, 330, 284, 322, 300);
    ctx.lineTo(318, 348); ctx.lineTo(194, 348); ctx.lineTo(190, 300);
    ctx.bezierCurveTo(182, 284, 168, 268, 166, 232);
    ctx.fill();
    const rock = '#4a3220';
    ctx.fillStyle = rock;
    for (const s2 of [-1, 1]) {                        // eye sockets
      ctx.beginPath();
      ctx.ellipse(256 + s2 * 44, 236, 30, 24, s2 * 0.22, 0, 7);
      ctx.fill();
    }
    ctx.beginPath();                                   // nasal heart
    ctx.moveTo(256, 262); ctx.quadraticCurveTo(242, 288, 248, 298);
    ctx.quadraticCurveTo(252, 302, 256, 296); ctx.quadraticCurveTo(260, 302, 264, 298);
    ctx.quadraticCurveTo(270, 288, 256, 262);
    ctx.fill();
    // teeth rows with the little glyphs
    ctx.strokeStyle = rock; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(196, 324); ctx.lineTo(316, 324); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const tx = 199 + i * 15;
      ctx.beginPath(); ctx.moveTo(tx + 7.5, 306); ctx.lineTo(tx + 7.5, 344); ctx.stroke();
    }
    ctx.fillStyle = rock;
    ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center';
    ['G', 'N', '8', 'D'].forEach((ch, i) => ctx.fillText(ch, 229 + i * 15, 321));
    // cheek shading nicks
    ctx.strokeStyle = pale; ctx.lineWidth = 2;
    for (const s2 of [-1, 1]) for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(256 + s2 * (66 + i * 4), 286 + i * 8);
      ctx.lineTo(256 + s2 * (54 + i * 4), 296 + i * 8);
      ctx.stroke();
    }
    // --- snake head draped over the forehead (spade, pointing down)
    ctx.fillStyle = paleF;
    ctx.beginPath();
    ctx.moveTo(256, 218);                              // chin of the spade
    ctx.bezierCurveTo(228, 186, 224, 156, 240, 138);
    ctx.bezierCurveTo(248, 128, 264, 128, 272, 138);
    ctx.bezierCurveTo(288, 156, 284, 186, 256, 218);
    ctx.fill();
    ctx.fillStyle = rock;
    ctx.beginPath(); ctx.ellipse(243, 156, 5, 8, -0.3, 0, 7); ctx.fill();  // eyes
    ctx.beginPath(); ctx.ellipse(269, 156, 5, 8, 0.3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(256, 208); ctx.lineTo(256, 190); ctx.stroke(); // tongue line
    // dotwork stipple, like the tattoo's shading
    ctx.fillStyle = 'rgba(226,204,158,0.5)';
    for (let i = 0; i < 380; i++) {
      const a = rand(0, Math.PI * 2), r = rand(120, 205);
      const px = 256 + Math.cos(a) * r, py = 240 + Math.sin(a) * r * 0.9;
      if (px > 20 && px < s - 20 && py > 20 && py < s - 20) ctx.fillRect(px, py, 2, 2);
    }
  });
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(7, 7),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  slab.position.set(TATTOO.x, 3.4, TATTOO.z - 4.2);
  slab.rotation.x = -0.12; // leans back into the cliff
  scene.add(slab);
  // framing rocks + a thin shaft of moonlight so it reads once you're there
  for (const [rx, ry, rs] of [[-3.8, 1.2, 2.2], [3.8, 1.4, 2.4], [0, 6.9, 2.8]]) {
    const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0x3f2b18, flatShading: true, roughness: 1 }));
    rk.position.set(TATTOO.x + rx, ry, TATTOO.z - 4.4);
    rk.scale.set(rs, rs * 0.8, rs * 0.7);
    rk.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    scene.add(rk);
  }
  const beam = new THREE.PointLight(0xffcf88, 5, 10);
  beam.position.set(TATTOO.x, 4.5, TATTOO.z - 1.5);
  scene.add(beam);
}

// ------------------------------------------- Winnie's Den (the gentle giant)
const DEN = { x: 78, z: 8 };
let winnie, winnieTail, winnieWag = 0;
{
  const dy = terrainH(DEN.x, DEN.z);
  const grp = new THREE.Group();
  const rock = new THREE.MeshStandardMaterial({ color: 0x59432c, flatShading: true, roughness: 1, side: THREE.DoubleSide });
  // small shell, door gap facing -X (toward the valley)
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 4.2, 12, 1, true, Math.PI * 1.62, Math.PI * 1.76), rock);
  wall.position.y = 2.1;
  grp.add(wall);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5.3, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), rock);
  dome.position.y = 3.9;
  dome.scale.y = 0.5;
  grp.add(dome);
  // bed mat, bones from friends, a soft lantern
  const mat = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.0, 0.18, 9),
    new THREE.MeshStandardMaterial({ color: 0x6a2a22, flatShading: true, roughness: 1 }));
  mat.position.set(1.0, 0.09, 0);
  grp.add(mat);
  for (const [bx, bz, br] of [[-1.6, 1.8, 0.5], [-1.2, -2.0, 0.4]]) {
    const boneM = new THREE.Mesh(mergeGeoms([
      { g: new THREE.CylinderGeometry(0.07, 0.07, br * 1.6, 5), m: M4(0, 0.08, 0, 0, 0, Math.PI / 2), c: 0xd8ccb0 },
      { g: new THREE.SphereGeometry(0.11, 5, 4), m: M4(-br * 0.8, 0.08, 0.05), c: 0xd8ccb0 },
      { g: new THREE.SphereGeometry(0.11, 5, 4), m: M4(-br * 0.8, 0.08, -0.05), c: 0xd8ccb0 },
      { g: new THREE.SphereGeometry(0.11, 5, 4), m: M4(br * 0.8, 0.08, 0.05), c: 0xd8ccb0 },
      { g: new THREE.SphereGeometry(0.11, 5, 4), m: M4(br * 0.8, 0.08, -0.05), c: 0xd8ccb0 },
    ]), matFlat);
    boneM.position.set(bx, 0, bz);
    boneM.rotation.y = rand(0, 6);
    grp.add(boneM);
  }
  const lantern = new THREE.PointLight(0xffb366, 8, 12);
  lantern.position.set(0, 2.6, 0);
  grp.add(lantern);
  // Winnie — big shaggy tan doodle, lying down, chin up
  const wg = new THREE.Group();
  wg.add(critterMesh((S, B, C, parts) => {
    S(0, 0.42, 0, 0.55, 0.42, 0.78, 0xb99a6a, true);          // big curly body, lying
    S(0, 0.52, -0.1, 0.42, 0.3, 0.5, 0x8a6c48, true);         // grizzled saddle
    S(-0.34, 0.2, 0.62, 0.12, 0.14, 0.3, 0xb99a6a, true);     // front paws stretched out
    S(0.34, 0.2, 0.62, 0.12, 0.14, 0.3, 0xb99a6a, true);
    S(0, 0.88, 0.55, 0.3, 0.28, 0.3, 0xb99a6a, true);         // big head
    S(0, 1.04, 0.62, 0.22, 0.12, 0.2, 0x8a6c48, true);        // shaggy fringe
    S(0, 0.78, 0.8, 0.14, 0.12, 0.16, 0x8a6c48, true);        // bearded muzzle
    S(0, 0.82, 0.94, 0.05, 0.05, 0.05, 0x141210);             // nose
    S(-0.1, 0.92, 0.78, 0.035, 0.035, 0.02, 0x1c1410); S(0.1, 0.92, 0.78, 0.035, 0.035, 0.02, 0x1c1410);
    S(-0.28, 0.86, 0.5, 0.1, 0.2, 0.09, 0x8a6c48, true);      // floppy ears
    S(0.28, 0.86, 0.5, 0.1, 0.2, 0.09, 0x8a6c48, true);
    parts.push({ g: new THREE.TorusGeometry(0.42, 0.055, 5, 10), m: M4(0, 0.52, 0.32, 0.35, 0, 0, 1, 0.9, 1), c: 0xa8382a }); // red harness
    B(0, 0.74, 0.18, 0.16, 0.06, 0.5, 0xa8382a);
  }));
  const tailGeo = new THREE.ConeGeometry(0.1, 0.55, 5);
  tailGeo.translate(0, 0.27, 0);
  tailGeo.rotateX(-1.9);
  winnieTail = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ color: 0xb99a6a, flatShading: true, roughness: 1 }));
  winnieTail.position.set(0, 0.45, -0.72);
  wg.add(winnieTail);
  wg.position.set(1.0, 0.15, 0);
  wg.rotation.y = -Math.PI / 2 - 0.3; // chin toward the doorway
  grp.add(wg);
  winnie = wg;
  grp.position.set(DEN.x, dy, DEN.z);
  scene.add(grp);
  // shell colliders, doorway open at -X (angle PI)
  for (let a = Math.PI + 0.55; a < Math.PI * 3 - 0.54; a += 0.45)
    addCollider(DEN.x + Math.cos(a) * 5.4, DEN.z + Math.sin(a) * 5.4, 1.4);
}

// ------------------------------------------ the Green Bronco (drivable!)
const vehicle = { kind: 'bronco', speed: 0, yaw: -0.9, x: 34, z: 62 };
let activeV = null; // currently driven vehicle (vehicle | canoeState | null)
let broncoGrp, broncoWheels = [], broncoLights = [], broncoLightMeshes = [], broncoBeamCones = [];
const broncoCollider = { x: 34, z: 62, r: 1.8 };
{
  const green = 0x1e5c30, greenD = 0x17491f, blk = 0x161616, blkD = 0x0d0d0d;
  // retro tri-stripe side texture
  const stripeTex = canvasTex(128, (ctx, s) => {
    ctx.fillStyle = '#1e5c30'; ctx.fillRect(0, 0, s, s);
    const bands = [['#7a2015', 52], ['#d85a1a', 64], ['#e8a824', 76]];
    for (const [c, y] of bands) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, y + 14); ctx.lineTo(26, y + 14); ctx.lineTo(44, y); ctx.lineTo(128, y);
      ctx.lineTo(128, y + 10); ctx.lineTo(48, y + 10); ctx.lineTo(30, y + 24); ctx.lineTo(0, y + 24);
      ctx.closePath(); ctx.fill();
    }
  });
  const grp = new THREE.Group();
  const mat = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8 });
  const stripeMat = new THREE.MeshStandardMaterial({ map: stripeTex, flatShading: true, roughness: 0.8 });
  const box = (w, h, l, x, y, z, m, rx = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m);
    b.position.set(x, y, z);
    b.rotation.x = rx;
    grp.add(b);
    return b;
  };
  box(1.6, 0.5, 3.9, 0, 0.62, 0, mat(blk));                                   // chassis
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.8, 4.05),
    [stripeMat, stripeMat, mat(green).clone(), mat(blkD), mat(greenD), mat(greenD)]);
  body.position.set(0, 1.22, 0);
  grp.add(body);
  box(1.7, 0.1, 1.25, 0, 1.68, 1.35, mat(green));                             // hood
  box(1.66, 0.62, 2.25, 0, 1.95, -0.55, mat(blk));                            // black cab/roof
  box(1.6, 0.5, 0.1, 0, 1.85, 0.62, new THREE.MeshStandardMaterial({ color: 0x1a2126, roughness: 0.3 }), -0.32); // windshield
  box(1.7, 0.06, 2.1, 0, 2.3, -0.55, mat(blkD));                              // rack base
  for (const rz of [-1.4, -0.55, 0.3]) box(1.5, 0.09, 0.09, 0, 2.42, rz, mat(blkD)); // rack bars
  for (const s of [-1, 1]) {
    box(0.22, 0.26, 1.15, s * 0.94, 1.02, 1.35, mat(blkD));                   // fender flares
    box(0.22, 0.26, 1.15, s * 0.94, 1.02, -1.35, mat(blkD));
    box(0.16, 0.1, 1.6, s * 0.97, 0.55, 0, mat(blk));                         // step rails
    box(0.08, 0.18, 0.26, s * 0.98, 1.78, 0.45, mat(blkD));                   // mirrors
  }
  box(1.7, 0.42, 0.12, 0, 1.22, 2.06, mat(blk));                              // grille
  for (const s of [-1, 1]) {                                                  // headlights + tails
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x554d33 }));
    hl.position.set(s * 0.55, 1.32, 2.1);
    broncoLightMeshes.push(hl);
    grp.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x5a1410 }));
    tl.position.set(s * 0.68, 1.3, -2.06);
    grp.add(tl);
    const beam = new THREE.PointLight(0xffe0a0, 0, 24);
    beam.position.set(s * 0.55, 1.4, 3.6);
    broncoLights.push(beam);
    grp.add(beam);
    // visible light cone (only while driving)
    const beamGeo = new THREE.ConeGeometry(0.55, 3.6, 6, 1, true);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, 1.8);
    const cone = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: 0xffe8b0, transparent: true, opacity: 0.08,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.set(s * 0.55, 1.32, 2.12);
    cone.visible = false;
    broncoBeamCones.push(cone);
    grp.add(cone);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.36, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.38, 8);
  hubGeo.rotateZ(Math.PI / 2);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(wheelGeo, mat(0x141414)));
    wheel.add(new THREE.Mesh(hubGeo, mat(0x3a3a3a)));
    wheel.position.set(sx * 0.88, 0.5, sz * 1.35);
    broncoWheels.push(wheel);
    grp.add(wheel);
  }
  grp.position.set(vehicle.x, terrainH(vehicle.x, vehicle.z), vehicle.z);
  grp.rotation.y = vehicle.yaw;
  scene.add(grp);
  broncoGrp = grp;
  colliders.push(broncoCollider);
}

// ----------------------------------------------- the canoe (paddle the Blanco)
const canoeState = { kind: 'canoe', speed: 0, yaw: 2.4, x: 19, z: 26 };
let canoeGrp, canoePaddle;
const canoeCollider = { x: 19, z: 26, r: 1.4 };
{
  const grp = new THREE.Group();
  const hull = new THREE.Mesh(mergeGeoms([
    { g: new THREE.BoxGeometry(0.9, 0.4, 3.1), m: M4(0, 0.3, 0), c: 0x8a4a2a },
    { g: new THREE.BoxGeometry(0.62, 0.3, 2.7), m: M4(0, 0.44, 0), c: 0x2c1d12 },  // cockpit
    { g: new THREE.BoxGeometry(0.5, 0.35, 0.5), m: M4(0, 0.42, 1.62, 0.5, 0, 0), c: 0x9a5632 }, // bow
    { g: new THREE.BoxGeometry(0.5, 0.35, 0.5), m: M4(0, 0.42, -1.62, -0.5, 0, 0), c: 0x9a5632 },
    { g: new THREE.BoxGeometry(0.86, 0.08, 0.3), m: M4(0, 0.5, -0.4), c: 0xb5824e },  // seat
  ]), matFlat);
  grp.add(hull);
  canoePaddle = new THREE.Mesh(mergeGeoms([
    { g: new THREE.CylinderGeometry(0.035, 0.035, 1.5, 5), m: M4(0, 0, 0, 0, 0, Math.PI / 2), c: 0xb5824e },
    { g: new THREE.BoxGeometry(0.3, 0.02, 0.24), m: M4(0.75, 0, 0), c: 0x8a5a32 },
    { g: new THREE.BoxGeometry(0.3, 0.02, 0.24), m: M4(-0.75, 0, 0), c: 0x8a5a32 },
  ]), matFlat);
  canoePaddle.position.set(0, 0.75, -0.3);
  grp.add(canoePaddle);
  grp.position.set(canoeState.x, Math.max(terrainH(canoeState.x, canoeState.z), WATER_Y - 0.1), canoeState.z);
  grp.rotation.y = canoeState.yaw;
  scene.add(grp);
  canoeGrp = grp;
  colliders.push(canoeCollider);
}

// -------------------- the old ranch windmill (turns all night, creaks a little)
const WINDMILL = { x: -46, z: 72 };
let windmillRotor, windmillHead;
{
  const wy = terrainH(WINDMILL.x, WINDMILL.z);
  const grp = new THREE.Group();
  const parts = [];
  const steel = 0x5a5f66, steelD = 0x3e4248;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // splayed legs
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0),
      V3(-sx * 0.75, 7.4, -sz * 0.75).normalize());
    parts.push({ g: new THREE.BoxGeometry(0.09, 7.6, 0.09),
      m: new THREE.Matrix4().compose(V3(sx * 0.75 * 0.5, 3.7, sz * 0.75 * 0.5), q, V3(1, 1, 1)), c: steel });
  }
  for (const by of [1.8, 3.6, 5.4]) {                               // cross braces
    const w = lerp(1.35, 0.45, by / 7.4);
    parts.push({ g: new THREE.BoxGeometry(w * 2, 0.06, 0.06), m: M4(0, by, w), c: steelD });
    parts.push({ g: new THREE.BoxGeometry(w * 2, 0.06, 0.06), m: M4(0, by, -w), c: steelD });
    parts.push({ g: new THREE.BoxGeometry(0.06, 0.06, w * 2), m: M4(w, by, 0), c: steelD });
    parts.push({ g: new THREE.BoxGeometry(0.06, 0.06, w * 2), m: M4(-w, by, 0), c: steelD });
  }
  parts.push({ g: new THREE.BoxGeometry(0.9, 0.1, 0.9), m: M4(0, 7.5, 0), c: steelD }); // platform
  grp.add(new THREE.Mesh(mergeGeoms(parts), matFlat));
  // rotor head: 14-blade fan + tail vane, yaws gently with the wind
  windmillHead = new THREE.Group();
  windmillRotor = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(0.34, 1.15, 0.04);
  bladeGeo.translate(0, 0.85, 0);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, flatShading: true, roughness: 0.7 });
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Mesh(bladeGeo, bladeMat);
    b.rotation.z = (i / 14) * Math.PI * 2;
    b.rotation.y = 0.4; // blade pitch
    windmillRotor.add(b);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 8),
    new THREE.MeshStandardMaterial({ color: 0x3e4248, flatShading: true }));
  hub.rotation.x = Math.PI / 2;
  windmillRotor.add(hub);
  windmillRotor.position.z = 0.55;
  windmillHead.add(windmillRotor);
  const vane = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x7a4423, flatShading: true }));
  vane.position.set(0, 0.15, -1.3);
  windmillHead.add(vane);
  windmillHead.position.y = 7.9;
  grp.add(windmillHead);
  grp.position.set(WINDMILL.x, wy, WINDMILL.z);
  scene.add(grp);
  addCollider(WINDMILL.x, WINDMILL.z, 1.5);
}

// low river mist, drifting downstream
const mists = [];
{
  const mistTex = canvasTex(64, (ctx, s) => {
    const g2 = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
    g2.addColorStop(0, 'rgba(190,200,215,0.35)');
    g2.addColorStop(1, 'rgba(190,200,215,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, s, s);
  });
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: mistTex, transparent: true, depthWrite: false, opacity: 0.16 }));
    sp.userData.z = -60 + i * 38;
    sp.scale.set(rand(9, 13), rand(2.6, 3.6), 1);
    mists.push(sp);
    scene.add(sp);
  }
}
// dream Z's for a sleeping giant
const zzz = [];
{
  const zTex = canvasTex(32, (ctx) => {
    ctx.fillStyle = '#efe3c8';
    ctx.font = 'bold italic 24px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('z', 16, 24);
  });
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.userData.age = 9;
    scene.add(sp);
    zzz.push(sp);
  }
}

// shared soft radial glow for pickups
const softGlowTex = canvasTex(64, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});

// --------------------------------------------------- the Hill Country vineyard
const VINEYARD = { x: -66, z: -8 };
let wineGlass, wineGlow, wineRespawn = 0;
{
  const rows = [-73, -68.5, -64, -59.5];
  for (const rx of rows) {
    const parts = [];
    for (let z = -18; z <= 4; z += 5.5) {
      const h = terrainH(rx, z) - terrainH(rx, -7); // relative post height offset
      parts.push({ g: new THREE.CylinderGeometry(0.07, 0.09, 1.7, 5), m: M4(0, h + 0.85, z + 7), c: 0x4a3320 });
    }
    for (const wy of [0.75, 1.25]) // trellis wires
      parts.push({ g: new THREE.BoxGeometry(0.03, 0.03, 23), m: M4(0, wy, -0.5 + 7 - 7 + 4.5), c: 0x2c2018 });
    // leafy vine masses + grape clusters
    for (let z = -17; z <= 4; z += 1.9) {
      const h = terrainH(rx, z) - terrainH(rx, -7);
      parts.push({ g: new THREE.IcosahedronGeometry(0.55, 0), m: M4(rand(-0.15, 0.15), h + rand(0.9, 1.3), z + 7, rand(0, 3), rand(0, 3), 0, 1, rand(0.6, 0.9), 0.8), c: [0x2e4a26, 0x3a5a2e, 0x27401f][randi(0, 2)] });
      if (Math.random() < 0.6) {
        const gy = h + rand(0.55, 0.8);
        for (let g = 0; g < 3; g++)
          parts.push({ g: new THREE.SphereGeometry(0.07, 5, 4), m: M4(rand(-0.12, 0.12), gy - g * 0.07, z + 7 + rand(-0.1, 0.1)), c: 0x4a2050 });
      }
    }
    const row = new THREE.Mesh(mergeGeoms(parts), matFlat);
    row.position.set(rx, terrainH(rx, -7), -14); // rows run z -14..+9 in world
    scene.add(row);
    for (let z = -12; z <= 8; z += 4) addCollider(rx, z, 1.0);
  }
  // the winemaker's barrel, with something red on top…
  const barrel = new THREE.Mesh(mergeGeoms([
    { g: new THREE.CylinderGeometry(0.55, 0.55, 1.1, 9), m: M4(0, 0.55, 0), c: 0x5c4226 },
    { g: new THREE.TorusGeometry(0.56, 0.045, 5, 10), m: M4(0, 0.3, 0, Math.PI / 2, 0, 0), c: 0x2c2018 },
    { g: new THREE.TorusGeometry(0.56, 0.045, 5, 10), m: M4(0, 0.8, 0, Math.PI / 2, 0, 0), c: 0x2c2018 },
  ]), matFlat);
  barrel.position.set(-68, terrainH(-68, 10), 10);
  scene.add(barrel);
  addCollider(-68, 10, 0.8);
  wineGlass = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xc8c2b8, transparent: true, opacity: 0.45, roughness: 0.2 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, 0.16, 6), glassMat);
  stem.position.y = 0.08;
  wineGlass.add(stem);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.05, 0.18, 8), glassMat);
  bowl.position.y = 0.25;
  wineGlass.add(bowl);
  const wine = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.05, 0.12, 8),
    new THREE.MeshBasicMaterial({ color: 0x8a1030 }));
  wine.position.y = 0.22;
  wineGlass.add(wine);
  wineGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softGlowTex, color: 0xd83060, transparent: true, opacity: 0.5, depthWrite: false }));
  wineGlow.scale.setScalar(0.9);
  wineGlow.position.y = 0.3;
  wineGlass.add(wineGlow);
  wineGlass.position.set(-68, terrainH(-68, 10) + 1.12, 10);
  scene.add(wineGlass);
}

// --------------------------------- lost tiki mugs (return them to the grotto)
const mugSpots = [
  { x: riverX(-52) + 8, z: -50 },   // by the arch's east pillar
  { x: 98, z: 44 },                 // top of the mesa trail
  { x: 38, z: 18.5 },               // behind the dead oak
  { x: 6, z: -82 },                 // the carving alcove
  { x: -66, z: 54 },                // edge of Bevo's meadow
];
const mugs = [];
const mugColorsLost = [0x7dff9a, 0xffb347, 0xff6a55, 0x5fd8ff, 0xff8ad8];
const shelfMugs = [];
{
  for (let i = 0; i < mugSpots.length; i++) {
    const s = mugSpots[i];
    const grp = new THREE.Group();
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.34, 6),
      new THREE.MeshBasicMaterial({ color: mugColorsLost[i] }));
    mug.position.y = 0.2;
    grp.add(mug);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softGlowTex, color: mugColorsLost[i], transparent: true, opacity: 0.4, depthWrite: false }));
    glow.scale.setScalar(1.1);
    glow.position.y = 0.3;
    grp.add(glow);
    grp.position.set(s.x, terrainH(s.x, s.z), s.z);
    scene.add(grp);
    mugs.push({ grp, x: s.x, z: s.z, got: false });
    // its future home on the grotto's bar top (hidden until returned)
    const home = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.34, 6),
      new THREE.MeshBasicMaterial({ color: mugColorsLost[i] }));
    home.position.set(GROTTO.x - 3.9, terrainH(GROTTO.x, GROTTO.z) + 1.35, GROTTO.z - 2 + i);
    home.visible = false;
    scene.add(home);
    shelfMugs.push(home);
  }
}

// ------------------------------ Trader Blanco (appears when the canyon is done)
let trader, traderTalked = false;
{
  const grp = new THREE.Group();
  const aloha = canvasTex(32, (ctx, s) => {
    ctx.fillStyle = '#a83a2a'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#e8cf8a';
    for (let i = 0; i < 8; i++) {
      const x = rand(2, 28), y = rand(2, 28);
      for (let p = 0; p < 5; p++) ctx.fillRect(x + Math.cos(p * 1.26) * 2.5, y + Math.sin(p * 1.26) * 2.5, 2, 2);
    }
  });
  const shirtMat = new THREE.MeshStandardMaterial({ map: aloha, flatShading: true, roughness: 1 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6534, flatShading: true, roughness: 1 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.36), shirtMat);
  torso.position.y = 0.78;
  grp.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.4), woodMat);
  head.position.y = 1.32;
  grp.add(head);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x241505, flatShading: true }));
  brow.position.set(0, 1.44, 0.2);
  grp.add(brow);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xf2e2b8 }));
    eye.position.set(s * 0.12, 1.34, 0.21);
    grp.add(eye);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), shirtMat);
    arm.position.set(s * 0.38, 0.82, 0);
    grp.add(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x3c2c1a, flatShading: true }));
    leg.position.set(s * 0.14, 0.25, 0);
    grp.add(leg);
  }
  const shaker = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.24, 7),
    new THREE.MeshStandardMaterial({ color: 0xb8b0a0, flatShading: true, roughness: 0.4 }));
  shaker.position.set(0.38, 1.1, 0.12);
  grp.add(shaker);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x6b4c24, flatShading: true }));
  crown.position.y = 1.62;
  grp.add(crown);
  grp.position.set(GROTTO.x - 5.4, terrainH(GROTTO.x, GROTTO.z), GROTTO.z);
  grp.rotation.y = Math.PI / 2; // faces the doorway from behind the bar
  grp.visible = false;
  scene.add(grp);
  trader = grp;
}

// carved drink menu on the grotto wall
{
  const menuTex = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#5c4226'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(40,22,8,0.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, 8 + i * 32); ctx.lineTo(s, 10 + i * 32); ctx.stroke(); }
    ctx.fillStyle = '#f2e2b8'; ctx.textAlign = 'center';
    ctx.font = 'bold 24px Georgia, serif';
    ctx.fillText('BLOOD MOON MENU', s / 2, 36);
    ctx.font = 'italic 16px Georgia, serif';
    const items = ['Blood Moon Punch ... 9', 'Chupacabra Colada ... 11', 'Armadillo Mai Tai ... 10',
      "Watcher's Old Fashioned ... 13", 'Bigfoot Banana Batida ... 8', "Wynonna's Water Bowl ... free"];
    items.forEach((it, i) => ctx.fillText(it, s / 2, 78 + i * 30));
  });
  const plank = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.1),
    new THREE.MeshStandardMaterial({ map: menuTex, roughness: 1 }));
  plank.position.set(GROTTO.x - 6.2, terrainH(GROTTO.x, GROTTO.z) + 3.6, GROTTO.z - 4.6);
  plank.rotation.y = Math.PI / 3;
  scene.add(plank);
}

// -------------------------------------------------- atmosphere particles
// fireflies along the riverbanks
let fireflies;
{
  const n = 64, base = [], phase = [];
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x, z, tries = 0;
    do { z = rand(-75, 90); x = riverX(z) + (Math.random() < 0.5 ? -1 : 1) * rand(7, 20); }
    while (mesaH(x, z) > 4 && tries++ < 8);
    const y = Math.max(terrainH(x, z), WATER_Y) + rand(0.5, 2.4);
    base.push(x, y, z); phase.push(rand(0, 9));
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  fireflies = {
    pts: new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xd8e86a, size: 2.6, sizeAttenuation: false, transparent: true,
      opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })),
    base, phase
  };
  scene.add(fireflies.pts);
}
// wading ripples (pooled)
const ripples = [];
{
  const geo = new THREE.RingGeometry(0.85, 1, 14);
  geo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xe8d9a8, transparent: true, opacity: 0, depthWrite: false }));
    r.visible = false;
    r.userData.age = 9;
    scene.add(r);
    ripples.push(r);
  }
}
function spawnRipple(x, z) {
  const r = ripples.find(q => q.userData.age > 0.85) || ripples[0];
  r.userData.age = 0;
  r.visible = true;
  r.position.set(x, WATER_Y + 0.03, z);
}
// footstep dust (pooled)
const dusts = [];
{
  const dustTex = canvasTex(32, (ctx, s) => {
    const g2 = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    g2.addColorStop(0, 'rgba(150,120,90,0.5)');
    g2.addColorStop(1, 'rgba(150,120,90,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, s, s);
  });
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.userData.age = 9;
    scene.add(sp);
    dusts.push(sp);
  }
}
function spawnDust(x, y, z, color = 0xffffff) {
  const d = dusts.find(q => q.userData.age > 0.5) || dusts[0];
  d.userData.age = 0;
  d.material.color.setHex(color);
  d.position.set(x + rand(-0.2, 0.2), y + 0.15, z + rand(-0.2, 0.2));
}
// little floating hearts, for petting the dogs
const hearts = [];
{
  const heartTex = canvasTex(32, (ctx) => {
    ctx.fillStyle = '#ff6a9e';
    ctx.beginPath();
    ctx.moveTo(16, 27);
    ctx.bezierCurveTo(2, 16, 5, 4, 16, 11);
    ctx.bezierCurveTo(27, 4, 30, 16, 16, 27);
    ctx.fill();
  });
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.userData.age = 9;
    scene.add(sp);
    hearts.push(sp);
  }
}
function spawnHearts(x, y, z) {
  for (let i = 0; i < 4; i++) {
    const h = hearts.find(q => q.userData.age > 1.1) || hearts[i % hearts.length];
    h.userData.age = -i * 0.16;      // staggered launch
    h.userData.wob = rand(0, 6);
    h.position.set(x + rand(-0.3, 0.3), y, z + rand(-0.3, 0.3));
  }
}
// one cloud pinned high so it periodically crosses the blood moon
clouds[0].position.set(-140, 146, -218);
clouds[0].scale.setScalar(2.2);
clouds[0].userData.speed = 2.4;

// ------------------------------------------------------------------- player
const player = {
  pos: V3(0, 0, 52), vel: V3(), yaw: Math.PI, onGround: true,
  swim: false, moving: false, animT: 0
};
player.pos.y = terrainH(0, 52);
let pGroup, pLegL, pLegR, pArmL, pArmR, pShadow, pHead, pSquash = 0;
{
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6534, flatShading: true, roughness: 1 });
  const woodD = new THREE.MeshStandardMaterial({ color: 0x6b4c24, flatShading: true, roughness: 1 });
  pGroup = new THREE.Group();
  const mk = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    pGroup.add(m);
    return m;
  };
  // legs pivot at hip
  const legGeo = new THREE.BoxGeometry(0.16, 0.34, 0.16);
  legGeo.translate(0, -0.17, 0);
  pLegL = mk(legGeo, woodD, -0.12, 0.36, 0);
  pLegR = mk(legGeo.clone(), woodD, 0.12, 0.36, 0);
  // grass skirt
  mk(new THREE.ConeGeometry(0.34, 0.3, 8, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xb99a5c, flatShading: true, side: THREE.DoubleSide }), 0, 0.44, 0);
  // torso
  mk(new THREE.BoxGeometry(0.5, 0.4, 0.32), wood, 0, 0.62, 0);
  mk(new THREE.BoxGeometry(0.52, 0.07, 0.34), woodD, 0, 0.56, 0);
  mk(new THREE.BoxGeometry(0.52, 0.07, 0.34), woodD, 0, 0.7, 0);
  // arms pivot at shoulder
  const armGeo = new THREE.BoxGeometry(0.13, 0.36, 0.13);
  armGeo.translate(0, -0.18, 0);
  pArmL = mk(armGeo, wood, -0.32, 0.78, 0);
  pArmR = mk(armGeo.clone(), wood, 0.32, 0.78, 0);
  // tiki head with pixel-art face
  const faceTex = canvasTex(64, (ctx) => {
    ctx.fillStyle = '#8a6534'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#6b4c24';
    for (let y = 0; y < 64; y += 8) { ctx.fillRect(0, y, 64, 1); }
    ctx.fillStyle = '#241505'; ctx.fillRect(6, 10, 52, 8);          // brow
    ctx.fillStyle = '#f2e2b8'; ctx.fillRect(10, 20, 16, 12); ctx.fillRect(38, 20, 16, 12); // eyes
    ctx.fillStyle = '#241505'; ctx.fillRect(16, 23, 7, 7); ctx.fillRect(41, 23, 7, 7);     // pupils
    ctx.fillStyle = '#5a3a16'; ctx.fillRect(28, 22, 8, 16);         // nose
    ctx.fillStyle = '#241505'; ctx.fillRect(8, 42, 48, 14);         // mouth
    ctx.fillStyle = '#f2e2b8';
    for (let i = 0; i < 6; i++) { ctx.fillRect(10 + i * 8, 42, 5, 5); ctx.fillRect(10 + i * 8, 51, 5, 5); } // teeth
  });
  const woodSide = new THREE.MeshStandardMaterial({ color: 0x8a6534, flatShading: true, roughness: 1 });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, flatShading: true, roughness: 1 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.4),
    [woodSide, woodSide, woodSide, woodSide, faceMat, woodSide]);
  head.position.set(0, 1.08, 0);
  pGroup.add(head);
  pHead = head;
  mk(new THREE.BoxGeometry(0.56, 0.12, 0.44), woodD, 0, 1.36, 0);   // crown base
  mk(new THREE.BoxGeometry(0.4, 0.1, 0.3), wood, 0, 1.46, 0);
  for (let i = -1; i <= 1; i++) {                                    // leaf headdress
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 4),
      new THREE.MeshStandardMaterial({ color: 0x4a6448, flatShading: true }));
    leaf.position.set(i * 0.13, 1.62, 0);
    leaf.rotation.z = -i * 0.5;
    pGroup.add(leaf);
  }
  pShadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  pShadow.rotation.x = -Math.PI / 2;
  scene.add(pShadow);
  scene.add(pGroup);
}

// ---------------------------------------------------------------------- POIs
const pois = [
  { id: 'tiki', name: 'The Great Tiki', x: TIKI.x + 4, z: TIKI.z + 3, r: 7.5, my: 13,
    hint: 'Someone tall watches from the west bank.',
    text: 'Carved long before anyone kept count, the stone guardian of the Blanco. His gaze keeps the canyon… mostly friendly.' },
  { id: 'tree', name: 'The Dead Oak', x: TREE.x, z: TREE.z, r: 6, my: 13.5,
    hint: 'Bare branches east of the river.',
    text: 'A lightning-struck live oak, bleached bone-white by a hundred Texas summers. Still standing. Stubborn like that.' },
  { id: 'raven', name: 'The Raven', x: TREE.x - 2.6, z: TREE.z - 0.2, r: 3.2, my: 10.6, requires: 'tree',
    hint: 'Perched high in the dead oak.',
    text: 'He has watched everything that ever happened in this canyon. He is not telling.' },
  { id: 'armadillo', name: 'The Armadillo', dynamic: 'armadillo', r: 3.2, my: 1.6,
    hint: 'A little tank snuffles the flats east of the river.',
    text: 'The armored night-digger of the Hill Country. Approach slow — they startle straight up like a popped cork.' },
  { id: 'possum', name: 'The Opossum', x: POSSUM.x, z: POSSUM.z, r: 3.5, my: 2.2,
    hint: 'Curled on a log in the western brush.',
    text: 'Playing possum? No — just quietly judging you from the agarita brush.' },
  { id: 'snake', name: 'The Rattlesnake', x: SNAKE.x, z: SNAKE.z, r: 4.2, my: 2,
    hint: 'Follow the maraca sound southeast… carefully.',
    text: 'A western diamondback keeping the beat. When you hear the maracas, back away politely and wish it a good evening.' },
  { id: 'agave', name: 'The Century Plant', x: -16, z: 40, r: 3.8, my: 8,
    hint: 'A century of patience, southwest of the crossing.',
    text: 'Agave waits decades to bloom exactly once — then gives it absolutely everything. Respect.' },
  { id: 'pear', name: 'The Prickly Pear', x: -38, z: 46, r: 3.6, my: 3.5,
    hint: 'Party hats in the southwest scrub.',
    text: 'Tough, spiny, and secretly sweet — the official state plant of Texas, wearing little red fruit like party hats.' },
  { id: 'river', name: 'The Blanco River', water: true, x: riverX(20), z: 20, r: 0, my: 2,
    hint: 'Get your feet wet. Mind the sign.',
    text: 'Spring-fed and running silver under the blood moon. Cold enough to wake your ancestors. Go on, wade in.' },
  { id: 'sky', name: 'The Night Sky', x: ROCK.x, z: ROCK.z, r: 2.8, my: 3.4, cinematic: true,
    hint: 'Stand on the carved stone circle and look up.',
    text: 'A blood moon over Blanco, Orion the hunter on watch, a wandering galaxy — and a falling star streaking home.' },
  { id: 'hearth', name: 'The Hearth', x: FIRE.x, z: FIRE.z, r: 3.5, my: 3,
    hint: 'Follow the woodsmoke near where you woke.',
    text: 'Somebody keeps this fire fed. The coffee pot is missing, but the warmth is free. Sit a spell.' },
  { id: 'wynonna', name: 'Wynonna', x: -2.2, z: 45.2, r: 2.8, my: 1.6,
    hint: 'Someone small by the fire wants to come along.',
    text: 'The goodest ranger in the Hill Country. Curly, fearless, pink harness. She has decided she is coming with you, and that is that.' },
  { id: 'grotto', name: "Trader Blanco's Grotto", x: GROTTO.x + 7, z: GROTTO.z, r: 4.5, my: 8,
    hint: 'Torchlight flickers at a door in the western wall.',
    text: 'Glowing mugs, a blowfish lamp, a wall of carved masks, and a stage under string lights — a proper tiki temple carved into the canyon. Trader Blanco just stepped out. Leave a tip anyway.' },
  { id: 'winnie', name: "Winnie's Den", x: DEN.x - 4.5, z: DEN.z, r: 4, my: 5.5,
    hint: 'A gentle rumble of snoring from the east rocks.',
    text: 'Winnie, the gentle giant of the canyon. He guards nothing, greets everyone, and naps twenty-two hours a day. The bones are from friends.' },
  { id: 'raccoon', name: 'The Raccoon', dynamic: 'raccoon', r: 3, my: 1.6,
    hint: 'A masked bandit works the north bank.',
    text: 'The masked bandit of the bottomlands. He has washed his little hands and knows exactly where you keep the snacks.' },
  { id: 'fox', name: 'The Gray Fox', dynamic: 'fox', r: 3.2, my: 1.6,
    hint: 'A quick red shadow patrols west of the river.',
    text: 'Half cat, half dog, all business. Hill Country gray foxes climb trees, but tonight she is making her rounds.' },
  { id: 'bevo', name: 'Bevo', dynamic: 'bevo', r: 4.5, my: 3,
    hint: 'Something very large grazes the southwest meadow.',
    text: 'A burnt-orange longhorn a long way from Austin. Horns like a county road. He is aware of how handsome he is. Hook ’em.' },
  { id: 'bigfoot', name: 'Bigfoot?', x: 12, z: -60, r: 5.5, my: 4.5,
    hint: 'One cedar in the north thicket has eyes.',
    text: 'That cedar just moved. Hill Country hikers swear by him; he swears by avoiding y’all. He waves anyway. Polite fella.' },
  { id: 'chupacabra', name: 'The Chupacabra', dynamic: 'chupacabra', r: 4.5, my: 1.8,
    hint: 'Red eyes blink in the far southeast.',
    text: 'The goat-sucker of legend — spines, hide, and hunger. It took one look at you and decided dinner wasn’t worth the paperwork.' },
  { id: 'vineyard', name: 'The Vineyard', x: VINEYARD.x, z: VINEYARD.z, r: 6.5, my: 4,
    hint: 'Rows of something green grow northwest.',
    text: 'Tempranillo under a blood moon. Texas wine country runs deep out here — and somebody has been tending these rows by moonlight.' },
  { id: 'wine', name: 'The Winemaker’s Glass', x: -68, z: 10, r: 0, my: 2, secret: true,
    hint: 'Something red waits among the vines. Drink up.',
    text: 'A glass of Blood Moon Red, still cool. Notes of cherry, cedar smoke, and unwise confidence. Your legs feel faster already.' },
  { id: 'canoe', name: 'The Canoe', x: 19, z: 26, r: 3.5, my: 2.5,
    hint: 'Something wooden waits at the water’s edge.',
    text: 'A cedar-strip canoe, beached by the crossing. The river runs the whole canyon if you’ve got the arms for it.' },
  { id: 'bronco', name: 'The Green Bronco', x: 34, z: 62, r: 4.5, my: 3.8,
    hint: 'Parked at the trailhead. Keys in the visor.',
    text: 'Hill Country green, blackout steelies, and the good stripes. Keys are in the visor — Trader Blanco won’t mind. Mind the cacti.' },
  { id: 'watcher', name: 'The Watcher', x: WATCHER.x, z: WATCHER.z, r: 9, my: 3.5, secret: true,
    hint: 'A figure stands the east rim at trail’s end. Was he there a moment ago?',
    text: 'Some say he carved the Great Tiki. Some say he never left. He is never there when you look twice.' },
  { id: 'tattoo', name: 'The Old Carving', x: TATTOO.x, z: TATTOO.z, r: 5.5, my: 3, secret: true,
    hint: 'Swim past the arch to the canyon’s end. The wall remembers.',
    text: 'Skull, serpent, and monstera, etched deep in the rock by some ancient traveler with excellent taste. Wait — is that ink still wet?' },
];
const found = {};
let foundCount = 0;

// glittering markers over undiscovered POIs
const markerTex = canvasTex(64, (ctx, s) => {
  ctx.translate(s / 2, s / 2);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
  g.addColorStop(0, 'rgba(255,225,140,1)');
  g.addColorStop(0.35, 'rgba(255,190,80,0.7)');
  g.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -26); ctx.quadraticCurveTo(4, -4, 26, 0); ctx.quadraticCurveTo(4, 4, 0, 26);
  ctx.quadraticCurveTo(-4, 4, -26, 0); ctx.quadraticCurveTo(-4, -4, 0, -26);
  ctx.fill();
});
for (const poi of pois) {
  if (poi.secret) continue; // secrets get no sparkle — the field guide riddle is the only clue
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: markerTex, transparent: true, depthWrite: false, opacity: 0.95 }));
  sp.scale.setScalar(1.5);
  poi.marker = sp;
  scene.add(sp);
}
// map of dynamic (roaming) discovery targets
const dynTargets = () => ({
  armadillo: armadillo.grp, raccoon: raccoon.grp, fox: fox.grp,
  bevo: bevo.grp, chupacabra: chupa.grp });

// ----------------------------------------------------------------------- UI
const $ = id => document.getElementById(id);
const popupEl = $('popup'), popTitle = $('popTitle'), popText = $('popText');
let popupTimer = null;
const popupQueue = [];
function showPopup(title, text, kicker = 'Discovery', ms = 6000) {
  popupQueue.push({ title, text, kicker, ms });
  if (!popupEl.classList.contains('show')) nextPopup();
}
function nextPopup() {
  const item = popupQueue.shift();
  if (!item) return;
  $('popKicker').textContent = item.kicker;
  popTitle.textContent = item.title;
  popText.textContent = item.text;
  popupEl.classList.add('show');
  clearTimeout(popupTimer);
  // if discoveries are stacking up, flip through them faster
  popupTimer = setTimeout(dismissPopup, popupQueue.length > 0 ? 2600 : item.ms);
}
function dismissPopup() {
  popupEl.classList.remove('show');
  clearTimeout(popupTimer);
  if (popupQueue.length) popupTimer = setTimeout(nextPopup, 350);
}
popupEl.addEventListener('click', dismissPopup);

function refreshGuide() {
  const ul = $('guideList');
  ul.innerHTML = '';
  for (const poi of pois) {
    const li = document.createElement('li');
    const isFound = !!found[poi.id];
    li.className = isFound ? 'found' : 'unfound';
    const label = isFound ? poi.name : (poi.secret ? '★ ' : '') + (poi.hint || '? ? ?');
    li.innerHTML = `<span class="dot">${isFound ? '✓' : '○'}</span><span>${label}</span>`;
    ul.appendChild(li);
  }
  $('guideFoot').textContent =
    `Mugs returned: ${mugCount}/5 · Fish caught: ${fish.tally}` +
    (fish.legend ? ' (incl. the Legendary Bass)' : '') +
    ' · Best run: ' + (runBest ? fmtTime(runBest) : '—');
}
function saveGame() {
  try { localStorage.setItem('tikiblanco-save', JSON.stringify(Object.keys(found))); } catch (e) { /* private mode */ }
}
function saveExtras() {
  try {
    localStorage.setItem('tikiblanco-extras', JSON.stringify({
      mugs: mugs.map(m => m.got), fish: fish.tally, legend: fish.legend, best: runBest }));
  } catch (e) { /* private mode */ }
}
function loadExtras() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem('tikiblanco-extras') || 'null'); } catch (e) { d = null; }
  if (!d) return;
  if (Array.isArray(d.mugs)) d.mugs.forEach((got, i) => {
    if (got && mugs[i] && !mugs[i].got) {
      mugs[i].got = true;
      mugs[i].grp.visible = false;
      shelfMugs[i].visible = true;
      mugCount++;
    }
  });
  fish.tally = d.fish || 0;
  fish.legend = !!d.legend;
  runBest = d.best || null;
}
function loadSave() {
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem('tikiblanco-save') || '[]'); } catch (e) { ids = []; }
  for (const id of ids) {
    const poi = pois.find(p => p.id === id);
    if (!poi || found[id]) continue;
    found[id] = true;
    foundCount++;
    if (poi.marker) poi.marker.visible = false;
    if (id === 'wynonna') wynState = 'follow';
    if (id === 'watcher') watcher.visible = false;
  }
  $('count').textContent = foundCount;
  if (foundCount >= pois.length) { completeShown = true; tikiGlow = 1e9; }
  refreshGuide();
}
$('counter').addEventListener('click', () => { refreshGuide(); $('guide').classList.add('show'); });
$('guideClose').addEventListener('click', () => $('guide').classList.remove('show'));
$('guideReset').addEventListener('click', () => {
  try {
    localStorage.removeItem('tikiblanco-save');
    localStorage.removeItem('tikiblanco-extras');
  } catch (e) { /* ignore */ }
  location.reload();
});
$('complete').addEventListener('click', () => $('complete').classList.remove('show'));

// -------------------------------------------------------------------- audio
const AudioEngine = {
  ctx: null, master: null, muted: false, rattleGain: null,
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    // wind: looped noise -> lowpass, slowly breathing
    const noise = this.noiseSrc();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 380;
    const wg = ctx.createGain(); wg.gain.value = 0.035;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.02;
    lfo.connect(lfoG); lfoG.connect(wg.gain); lfo.start();
    noise.connect(lp); lp.connect(wg); wg.connect(this.master);
    // rattlesnake: noise -> bandpass, tremolo'd, proximity-scaled
    const rn = this.noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3400; bp.Q.value = 1.2;
    this.rattleGain = ctx.createGain(); this.rattleGain.gain.value = 0;
    const trem = ctx.createOscillator(); trem.type = 'square'; trem.frequency.value = 17;
    const tremG = ctx.createGain(); tremG.gain.value = 0.5;
    const tremBase = ctx.createGain(); tremBase.gain.value = 0.5;
    trem.connect(tremG); trem.start();
    rn.connect(bp);
    const rmix = ctx.createGain();
    bp.connect(rmix);
    tremG.connect(rmix.gain); // AM
    rmix.connect(this.rattleGain);
    this.rattleGain.connect(this.master);
    // river lapping: soft filtered noise, gain scaled by proximity each frame
    const ln = this.noiseSrc();
    const llp = ctx.createBiquadFilter();
    llp.type = 'lowpass'; llp.frequency.value = 560;
    this.lapGain = ctx.createGain(); this.lapGain.gain.value = 0;
    const lapLfo = ctx.createOscillator(); lapLfo.frequency.value = 0.5;
    const lapLfoG = ctx.createGain(); lapLfoG.gain.value = 0.35;
    lapLfo.connect(lapLfoG); lapLfoG.connect(this.lapGain.gain); lapLfo.start();
    ln.connect(llp); llp.connect(this.lapGain); this.lapGain.connect(this.master);
    // Winnie's snore: a slow warm swell, gain scaled by proximity to the den
    const so = ctx.createOscillator(); so.type = 'sine'; so.frequency.value = 58;
    const sLfo = ctx.createOscillator(); sLfo.frequency.value = 0.27;
    const sDepth = ctx.createGain(); sDepth.gain.value = 0.5;
    this.snoreGain = ctx.createGain(); this.snoreGain.gain.value = 0;
    const sMix = ctx.createGain(); sMix.gain.value = 0.5;
    sLfo.connect(sDepth); sDepth.connect(sMix.gain); sLfo.start();
    so.connect(sMix); sMix.connect(this.snoreGain); this.snoreGain.connect(this.master);
    so.start();
    this.scheduleCricket();
  },
  setSnore(v) {
    if (this.snoreGain) this.snoreGain.gain.value = this.muted ? 0 : v * 0.09;
  },
  creak() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (const [f1, f2, d] of [[520, 330, 0], [340, 260, 0.4]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f1, t0 + d);
      o.frequency.exponentialRampToValueAtTime(f2, t0 + d + 0.28);
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 950;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + d);
      g.gain.linearRampToValueAtTime(0.028, t0 + d + 0.05);
      g.gain.linearRampToValueAtTime(0, t0 + d + 0.32);
      o.connect(flt); flt.connect(g); g.connect(this.master);
      o.start(t0 + d); o.stop(t0 + d + 0.36);
    }
  },
  noiseSrc() {
    const ctx = this.ctx, len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.start();
    return src;
  },
  scheduleCricket() {
    if (!this.ctx) return;
    setTimeout(() => { this.cricket(); this.scheduleCricket(); }, rand(500, 2600));
  },
  cricket() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.value = rand(4100, 4700);
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(g); g.connect(this.master); o.start(t0);
    const chirps = randi(3, 6);
    for (let i = 0; i < chirps; i++) {
      const t = t0 + i * 0.075;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.022, t + 0.012);
      g.gain.linearRampToValueAtTime(0, t + 0.05);
    }
    o.stop(t0 + chirps * 0.075 + 0.1);
  },
  tone(freq, t0, dur, vol, type = 'sine') {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  chime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.tone(659, t, 0.5, 0.12);
    this.tone(880, t + 0.1, 0.7, 0.12);
    this.tone(1318, t + 0.1, 0.9, 0.05);
  },
  fanfare() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.14, 0.6, 0.11, i > 3 ? 'triangle' : 'sine'));
  },
  caw() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = t0 + i * 0.3;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(720, t);
      o.frequency.exponentialRampToValueAtTime(380, t + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.02);
      g.gain.linearRampToValueAtTime(0, t + 0.2);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.25);
    }
  },
  setRattle(v) {
    if (this.rattleGain) this.rattleGain.gain.value = this.muted ? 0 : v * 0.22;
  },
  setLap(v) {
    if (this.lapGain) this.lapGain.gain.value = this.muted ? 0 : v * 0.05;
  },
  // ascending "secret found" run — an original WebAudio homage to the classic
  zelda() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const run = [784, 740, 622, 440, 415, 659, 831, 1047];
    run.forEach((f, i) => {
      const t = t0 + i * 0.095, last = i === run.length - 1;
      this.tone(f, t, last ? 0.9 : 0.16, 0.085, 'square');
      this.tone(f * 2, t, last ? 0.7 : 0.12, 0.03, 'sine');
    });
  },
  yip() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = t0 + i * 0.18;
      const o = this.ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(880, t);
      o.frequency.exponentialRampToValueAtTime(1400, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(700, t + 0.09);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.01);
      g.gain.linearRampToValueAtTime(0, t + 0.1);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.12);
    }
  },
  woof() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(210, t0);
    o.frequency.exponentialRampToValueAtTime(105, t0 + 0.16);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.16, t0 + 0.02);
    g.gain.linearRampToValueAtTime(0, t0 + 0.2);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.25);
  },
  moo() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(150, t0);
    o.frequency.linearRampToValueAtTime(175, t0 + 0.25);
    o.frequency.exponentialRampToValueAtTime(92, t0 + 0.8);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.12, t0 + 0.1);
    g.gain.linearRampToValueAtTime(0.09, t0 + 0.55);
    g.gain.linearRampToValueAtTime(0, t0 + 0.85);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.9);
  },
  growl() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 62;
    const n = this.noiseSrc();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.14, t0 + 0.08);
    g.gain.linearRampToValueAtTime(0, t0 + 0.65);
    o.connect(f); n.connect(f); f.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.7);
    setTimeout(() => { try { n.stop(); } catch (e) { /* done */ } }, 800);
  },
  thumps() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.4;
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(75, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.3);
    }
  },
  boing() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(240, t0);
    o.frequency.exponentialRampToValueAtTime(680, t0 + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.1, t0 + 0.015);
    g.gain.linearRampToValueAtTime(0, t0 + 0.22);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.25);
  },
  flutter() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const n = this.noiseSrc();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 950; f.Q.value = 1.6;
    const g = ctx.createGain(); g.gain.value = 0;
    for (let i = 0; i < 8; i++) {
      const t = t0 + i * 0.07;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.02);
      g.gain.linearRampToValueAtTime(0, t + 0.06);
    }
    n.connect(f); f.connect(g); g.connect(this.master);
    setTimeout(() => { try { n.stop(); } catch (e) { /* done */ } }, 900);
  },
  crackle(vol) {
    if (!this.ctx || this.muted || vol <= 0.01) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const len = ctx.sampleRate * 0.04;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = rand(1400, 3600); f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = vol * rand(0.15, 0.4);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  },
  pluck(freq, vol = 0.06) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    this.tone(freq, t0, 0.7, vol, 'sine');
    this.tone(freq * 3, t0, 0.25, vol * 0.3, 'sine');
  },
  horn() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (const f of [392, 494]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.07, t0 + 0.02);
      g.gain.setValueAtTime(0.07, t0 + 0.28);
      g.gain.linearRampToValueAtTime(0, t0 + 0.38);
      o.connect(flt); flt.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + 0.42);
    }
  },
  engineStart() {
    if (!this.ctx || this.engOsc) return;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 58;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
    const g = this.ctx.createGain(); g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start();
    this.engOsc = o; this.engGain = g;
  },
  engineStop() {
    if (this.engOsc) {
      try { this.engOsc.stop(); } catch (e) { /* already stopped */ }
      this.engOsc = null;
    }
  },
  setEngine(sp) {
    if (!this.engOsc) return;
    this.engOsc.frequency.value = 55 + Math.abs(sp) * 6.5;
    this.engGain.gain.value = this.muted ? 0 : 0.026 + Math.abs(sp) * 0.0012;
  }
};
// ---------------------------------------------------------------- soundtrack
// two songs rotate; between them, a stretch of spooky canyon noises
const MusicPlayer = {
  tracks: ['audio/moontower.mp3', 'audio/roe-v-wade.mp3'],
  idx: randi(0, 1), audio: null, running: false, interludeTimer: null,
  start() {
    if (this.running) return;
    this.running = true;
    this.playTrack();
  },
  ensureGraph() {
    if (this.dry || !AudioEngine.ctx) return;
    const ctx = AudioEngine.ctx;
    this.dry = ctx.createGain(); this.dry.gain.value = 1;
    this.dry.connect(AudioEngine.master);
    this.bp = ctx.createBiquadFilter();
    this.bp.type = 'bandpass'; this.bp.frequency.value = 1450; this.bp.Q.value = 1.5;
    this.radioG = ctx.createGain(); this.radioG.gain.value = 0;
    this.bp.connect(this.radioG); this.radioG.connect(AudioEngine.master);
  },
  playTrack() {
    const a = this.audio = new Audio(this.tracks[this.idx]);
    a.volume = AudioEngine.muted ? 0 : 0.3;
    a.addEventListener('ended', () => this.interlude());
    a.addEventListener('error', () => this.interlude());
    this.ensureGraph();
    if (this.dry) {
      try { // route through the mixer so the Bronco's radio can color it
        const src = AudioEngine.ctx.createMediaElementSource(a);
        src.connect(this.dry);
        src.connect(this.bp);
        a.volume = 0.3; // mute handled by the master bus once routed
      } catch (e) { /* cross-origin or reused element: plain playback */ }
    }
    a.play().catch(() => { /* resumes on next user gesture via ctx */ });
  },
  // KTKI Blanco FM — squeezes the song through the dash speaker
  setRadio(on) {
    this.ensureGraph();
    if (!this.dry) return;
    const t = AudioEngine.ctx.currentTime;
    this.dry.gain.cancelScheduledValues(t);
    this.radioG.gain.cancelScheduledValues(t);
    this.dry.gain.linearRampToValueAtTime(on ? 0.12 : 1, t + 0.7);
    this.radioG.gain.linearRampToValueAtTime(on ? 2.4 : 0, t + 0.7);
    if (on && !AudioEngine.muted) { // station ident stinger
      AudioEngine.pluck(880, 0.07);
      setTimeout(() => AudioEngine.pluck(1108, 0.07), 150);
      setTimeout(() => AudioEngine.pluck(1318, 0.09), 300);
    }
  },
  interlude() {
    this.audio = null;
    this.idx = (this.idx + 1) % this.tracks.length;
    spookyInterlude();
    clearTimeout(this.interludeTimer);
    this.interludeTimer = setTimeout(() => this.playTrack(), rand(11000, 18000));
  },
  setMuted(m) { if (this.audio) this.audio.volume = m ? 0 : 0.3; }
};
// synthesized spooky beats for the gap between songs
function spookyInterlude() {
  const A = AudioEngine;
  if (!A.ctx) return;
  const ctx = A.ctx, t0 = ctx.currentTime;
  // low haunted drone, swelling and fading (two detuned saws through a dark filter)
  for (const f of [55, 56.7]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(A.muted ? 0 : 0.035, t0 + 3.5);
    g.gain.linearRampToValueAtTime(0, t0 + 9);
    o.connect(flt); flt.connect(g); g.connect(A.master);
    o.start(t0); o.stop(t0 + 9.5);
  }
  // distant coyote howl
  setTimeout(() => {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator();
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(880, t + 0.7);
    o.frequency.linearRampToValueAtTime(760, t + 1.4);
    o.frequency.exponentialRampToValueAtTime(420, t + 2.2);
    const v = A.ctx.createOscillator(); v.frequency.value = 5.5;
    const vg = A.ctx.createGain(); vg.gain.value = 14;
    v.connect(vg); vg.connect(o.frequency); v.start(t);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.5);
    g.gain.linearRampToValueAtTime(0, t + 2.3);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + 2.4); v.stop(t + 2.4);
  }, rand(2500, 4500));
  // a big wind gust
  setTimeout(() => {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime;
    const n = A.noiseSrc();
    const f = A.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.6;
    f.frequency.setValueAtTime(220, t);
    f.frequency.linearRampToValueAtTime(700, t + 2.2);
    f.frequency.linearRampToValueAtTime(180, t + 4.5);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 1.8);
    g.gain.linearRampToValueAtTime(0, t + 4.6);
    n.connect(f); f.connect(g); g.connect(A.master);
    setTimeout(() => { try { n.stop(); } catch (e) { /* done */ } }, 5000);
  }, rand(5000, 7500));
  // the raven answers, far away
  setTimeout(() => AudioEngine.caw(), rand(8000, 10000));
}

$('muteBtn').addEventListener('click', () => {
  AudioEngine.muted = !AudioEngine.muted;
  if (AudioEngine.master) AudioEngine.master.gain.value = AudioEngine.muted ? 0 : 0.9;
  MusicPlayer.setMuted(AudioEngine.muted);
  $('muteBtn').innerHTML = AudioEngine.muted ? '&#128263;' : '&#128266;';
});

// -------------------------------------------------------------------- input
const keys = {};
let jumpQueued = false;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
  if (e.code === 'KeyE') toggleDrive();
  if (e.code === 'KeyR') throwStick();
  if (e.code === 'KeyF') fishPress();
  if (e.code === 'KeyP') takePhoto();
  if (e.code === 'KeyT') petCritter();
});
addEventListener('keyup', e => keys[e.code] = false);

const cam = { yaw: 0, pitch: 0.26, dist: 6.8, lastDrag: -9 }; // camera south of spawn, facing the canyon
let dragging = false, lastMX = 0, lastMY = 0;
renderer.domElement.addEventListener('mousedown', e => { dragging = true; lastMX = e.clientX; lastMY = e.clientY; });
addEventListener('mousemove', e => {
  if (!dragging) return;
  cam.yaw -= (e.clientX - lastMX) * 0.0055;
  cam.pitch = clamp(cam.pitch + (e.clientY - lastMY) * 0.004, -0.1, 1.05);
  lastMX = e.clientX; lastMY = e.clientY;
  cam.lastDrag = nowT;
});
addEventListener('mouseup', () => dragging = false);

const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const camTouch = { id: null, lx: 0, ly: 0 };
const stickEl = $('stick'), knobEl = $('stickKnob');
addEventListener('touchstart', e => {
  document.body.classList.add('touch');
  for (const t of e.changedTouches) {
    if (t.target.closest && t.target.closest('#jumpBtn,#driveBtn,#fishBtn,#fetchBtn,#petBtn,#photoBtn,#counter,#muteBtn,#popup,#guide,#complete,#title')) continue;
    if (t.clientX < innerWidth * 0.45 && joy.id === null) {
      joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0;
      stickEl.style.display = 'block';
      stickEl.style.left = (joy.ox - 55) + 'px';
      stickEl.style.top = (joy.oy - 55) + 'px';
      knobEl.style.transform = 'translate(0px,0px)';
    } else if (camTouch.id === null) {
      camTouch.id = t.identifier; camTouch.lx = t.clientX; camTouch.ly = t.clientY;
    }
  }
}, { passive: false });
addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) {
      let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy;
      const len = Math.hypot(dx, dy);
      if (len > 48) { dx *= 48 / len; dy *= 48 / len; }
      joy.x = dx / 48; joy.y = dy / 48;
      knobEl.style.transform = `translate(${dx}px,${dy}px)`;
    } else if (t.identifier === camTouch.id) {
      cam.yaw -= (t.clientX - camTouch.lx) * 0.0075;
      cam.pitch = clamp(cam.pitch + (t.clientY - camTouch.ly) * 0.005, -0.1, 1.05);
      camTouch.lx = t.clientX; camTouch.ly = t.clientY;
      cam.lastDrag = nowT;
    }
  }
}, { passive: false });
addEventListener('touchend', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; stickEl.style.display = 'none'; }
    if (t.identifier === camTouch.id) camTouch.id = null;
  }
});
$('jumpBtn').addEventListener('touchstart', e => { e.preventDefault(); jumpQueued = true; }, { passive: false });

// climb in / hop out of the Bronco or the canoe
function toggleDrive() {
  if (!started || cine || intro) return;
  if (activeV) {
    const V = activeV;
    V.speed = 0;
    if (V.kind === 'bronco') {
      AudioEngine.engineStop();
      MusicPlayer.setRadio(false);
      for (const l of broncoLights) l.intensity = 0;
      for (const m of broncoLightMeshes) m.material.color.setHex(0x554d33);
      for (const c of broncoBeamCones) c.visible = false;
    }
    wynRiding = false;
    const sx = V.x + Math.cos(V.yaw) * 2.0, sz = V.z - Math.sin(V.yaw) * 2.0;
    player.pos.set(sx, Math.max(terrainH(sx, sz), WATER_Y - 0.55), sz);
    player.vel.y = 0;
    pGroup.visible = true;
    pShadow.visible = true;
    if (wynState === 'follow') {
      wyn.visible = true;
      wyn.position.set(sx + 1, player.pos.y, sz + 1);
    }
    activeV = null;
  } else {
    const dB = Math.hypot(player.pos.x - vehicle.x, player.pos.z - vehicle.z);
    const dC = Math.hypot(player.pos.x - canoeState.x, player.pos.z - canoeState.z);
    if (Math.min(dB, dC) > 4.5) return;
    activeV = dB <= dC ? vehicle : canoeState;
    if (activeV.kind === 'bronco') {
      AudioEngine.engineStart();
      MusicPlayer.setRadio(true);
      for (const l of broncoLights) l.intensity = 12;
      for (const m of broncoLightMeshes) m.material.color.setHex(0xffedb0);
      for (const c of broncoBeamCones) c.visible = true;
      if (wynState === 'follow') wyn.visible = false; // she rides shotgun
    } else if (wynState === 'follow') {
      wynRiding = true; // she perches in the canoe's bow
    }
    pGroup.visible = false;
    pShadow.visible = false;
  }
  $('driveBtn').textContent = activeV ? 'EXIT' : 'DRIVE';
}
$('driveBtn').addEventListener('click', toggleDrive);
$('driveBtn').addEventListener('touchstart', e => { e.preventDefault(); toggleDrive(); }, { passive: false });

// -------- the Bronco's horn (Space / JUMP button while driving)
let hornCooldown = 0;
function honk() {
  if (hornCooldown > 0) return;
  hornCooldown = 0.7;
  AudioEngine.horn();
  // the canyon reacts
  if (Math.hypot(vehicle.x - armadillo.grp.position.x, vehicle.z - armadillo.grp.position.z) < 18)
    armadillo.hopT = 0.55;
  if (Math.hypot(vehicle.x - bevo.grp.position.x, vehicle.z - bevo.grp.position.z) < 24)
    setTimeout(() => AudioEngine.moo(), 700);          // Bevo answers
  if (wynState === 'follow') setTimeout(() => AudioEngine.yip(), 300); // she loves the horn
}

// -------- pet the dogs
function petCritter() {
  if (!started || activeV || cine || intro) return;
  const dW = wyn.visible ? Math.hypot(player.pos.x - wyn.position.x, player.pos.z - wyn.position.z) : 99;
  const dWin = Math.hypot(player.pos.x - (DEN.x + 1), player.pos.z - DEN.z);
  if (dW < 2.2 && dW <= dWin) {
    wynWag = 3;
    AudioEngine.yip();
    spawnHearts(wyn.position.x, wyn.position.y + 0.8, wyn.position.z);
  } else if (dWin < 3.4) {
    winnieWag = 4;
    AudioEngine.woof();
    spawnHearts(DEN.x + 1, terrainH(DEN.x, DEN.z) + 1.3, DEN.z);
  }
}
$('petBtn').addEventListener('click', petCritter);
$('petBtn').addEventListener('touchstart', e => { e.preventDefault(); petCritter(); }, { passive: false });

// -------- fetch with Wynonna
function throwStick() {
  if (!started || activeV || cine || intro || wynState !== 'follow') return;
  if (stick && stick.state !== 'held') return;
  if (!stick) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.75, 5),
      new THREE.MeshStandardMaterial({ color: 0x6b4a26, flatShading: true, roughness: 1 }));
    scene.add(m);
    stick = { mesh: m, state: 'held', vel: V3() };
  }
  stick.state = 'flying';
  stick.mesh.visible = true;
  stick.mesh.position.set(player.pos.x, player.pos.y + 1.2, player.pos.z);
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  stick.vel.set(fx * 11, 5.5, fz * 11);
  AudioEngine.boing();
}
$('fetchBtn').addEventListener('click', throwStick);
$('fetchBtn').addEventListener('touchstart', e => { e.preventDefault(); throwStick(); }, { passive: false });

// -------- fishing the Blanco
function fishPress() {
  if (!started || activeV || cine || intro || player.swim) return;
  if (fish.state === 'idle') {
    const d = Math.abs(player.pos.x - riverX(player.pos.z));
    if (d > 14 || d < 4) return;
    fish.state = 'cast';
    fish.t = 0;
    fish.from.set(player.pos.x, player.pos.y + 1.1, player.pos.z);
    const side = player.pos.x > riverX(player.pos.z) ? 1 : -1;
    fish.to.set(riverX(player.pos.z) + side * rand(-1, 2.5), WATER_Y + 0.05, player.pos.z + rand(-2.5, 2.5));
    fish.anchor = V3(player.pos.x, 0, player.pos.z);
    fishBobber.visible = true;
    fishLine.visible = true;
  } else if (fish.state === 'bite') {
    const roll = Math.random();
    const name = roll < 0.08 ? 'the LEGENDARY Guadalupe Bass'
      : roll < 0.32 ? 'a Guadalupe Bass'
      : roll < 0.52 ? 'a Channel Catfish'
      : roll < 0.72 ? 'a Rio Grande Cichlid'
      : roll < 0.92 ? 'a Redbreast Sunfish' : 'a very old boot';
    fish.tally++;
    if (roll < 0.08) fish.legend = true;
    showPopup('Fish On!', `You caught ${name}. The river provides. (${fish.tally} caught)`, 'The Blanco Provides', 4500);
    if (roll < 0.08) AudioEngine.fanfare(); else AudioEngine.chime();
    if (wynState === 'follow') { wynWag = 2.5; AudioEngine.yip(); }
    saveExtras();
    endFishing();
  } else {
    endFishing(); // reel in
  }
}
function endFishing() {
  fish.state = 'idle';
  fishBobber.visible = false;
  fishLine.visible = false;
}
$('fishBtn').addEventListener('click', fishPress);
$('fishBtn').addEventListener('touchstart', e => { e.preventDefault(); fishPress(); }, { passive: false });

// -------- photo mode: framed like the poster, saved as a PNG
function takePhoto() {
  if (!started) return;
  dismissPopup();
  renderer.render(scene, camera);
  const src = renderer.domElement;
  const w = src.width, h = src.height;
  const b = Math.round(w * 0.05), foot = Math.round(w * 0.1);
  const c = document.createElement('canvas');
  c.width = w + b * 2;
  c.height = h + b + foot;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe3c8';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(120,80,40,${rand(0.02, 0.09)})`;
    ctx.fillRect(rand(0, c.width), rand(0, c.height), 2, 2);
  }
  ctx.drawImage(src, b, b, w, h);
  ctx.strokeStyle = '#6b3d16';
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.strokeRect(b - 2, b - 2, w + 4, h + 4);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#3a1c06';
  ctx.font = `bold ${Math.round(foot * 0.4)}px Georgia, serif`;
  ctx.fillText('TikiBlänco — Blood Moon Canyon', c.width / 2, h + b + foot * 0.48);
  ctx.fillStyle = '#a83a12';
  ctx.font = `italic ${Math.round(foot * 0.2)}px Georgia, serif`;
  ctx.fillText('B L A N C O ,   T E X A S', c.width / 2, h + b + foot * 0.8);
  const a = document.createElement('a');
  a.download = 'tikiblanco-canyon.png';
  a.href = c.toDataURL('image/png');
  a.click();
  AudioEngine.pluck(1568, 0.09);
}
$('photoBtn').addEventListener('click', takePhoto);

// ------------------------------------------------------------ discovery core
let cine = null;   // sky cinematic state
let intro = null;  // opening camera swoop
const lookTarget = V3();
let completeShown = false;
const embers = { pts: null, vel: [], life: [], active: false };
{
  const n = 130;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  embers.pts = new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xffa040, size: 3.2, sizeAttenuation: false, transparent: true,
    opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  embers.pts.visible = false;
  scene.add(embers.pts);
  for (let i = 0; i < n; i++) { embers.vel.push(V3()); embers.life.push(0); }
}
function burstEmbers(x, y, z) {
  const P = embers.pts.geometry.attributes.position;
  for (let i = 0; i < P.count; i++) {
    P.setXYZ(i, x + rand(-1, 1), y + rand(-1, 1), z + rand(-1, 1));
    embers.vel[i].set(rand(-2, 2), rand(2, 7), rand(-2, 2));
    embers.life[i] = rand(1.5, 3.5);
  }
  P.needsUpdate = true;
  embers.pts.visible = true;
  embers.active = true;
}

function discover(poi) {
  if (found[poi.id]) return;
  found[poi.id] = true;
  foundCount++;
  if (runStart === null && foundCount === 1) runStart = nowT; // the run clock starts
  $('count').textContent = foundCount;
  showPopup(poi.name, poi.text, poi.secret ? '★ Secret Discovery' : 'Discovery');
  AudioEngine.zelda();
  if (poi.marker) {
    poi.pop = 0.0001; // the sparkle pops instead of blinking out
    for (let i = 0; i < 4; i++)
      spawnDust(poi.marker.position.x + rand(-0.4, 0.4), poi.marker.position.y - 0.6, poi.marker.position.z + rand(-0.4, 0.4), 0xffd77a);
  }
  const cEl = $('counter');
  cEl.classList.remove('bump');
  void cEl.offsetWidth;
  cEl.classList.add('bump');
  switch (poi.id) {
    case 'tiki': tikiGlow = Math.max(tikiGlow, 3); break;
    case 'raven': AudioEngine.caw(); raven.userData.flapT = 1.2; break;
    case 'sky': startCinematic(); break;
    case 'armadillo': armadillo.hopT = 0.55; AudioEngine.boing(); break;
    case 'wynonna': wynState = 'follow'; wynWag = 3; AudioEngine.yip(); break;
    case 'winnie': winnieWag = 4; AudioEngine.woof(); break;
    case 'bevo': AudioEngine.moo(); break;
    case 'bigfoot': bigfootWave = 2.4; AudioEngine.thumps(); break;
    case 'chupacabra':
      AudioEngine.growl();
      chupa.speed = 6.5;
      chupa.pause = 0;
      chupa.target.set(16, 0, 88);
      chupa.home = { x: 16, z: 88, r: 8 };
      chupa.onArrive = w => { w.speed = 1.1; w.onArrive = null; };
      break;
    case 'watcher':
      watcherFade = 1.4;
      burstEmbers(watcher.position.x, watcher.position.y + 1.5, watcher.position.z);
      break;
  }
  if (wynState === 'follow' && poi.id !== 'wynonna') { wynWag = 2.5; AudioEngine.yip(); }
  saveGame();
  if (foundCount === pois.length && !completeShown) {
    completeShown = true;
    let timeLine = '';
    if (runStart !== null) {
      const el = nowT - runStart;
      const isBest = !runBest || el < runBest;
      if (isBest) runBest = el;
      saveExtras();
      timeLine = 'Canyon explored in ' + fmtTime(el) + (isBest ? ' — a new best!' : '');
    }
    setTimeout(() => {
      $('completeTime').textContent = timeLine;
      $('complete').classList.add('show');
      AudioEngine.fanfare();
      tikiGlow = 1e9; // eyes stay lit forever
      burstEmbers(TIKI.x, terrainH(TIKI.x, TIKI.z) + 11, TIKI.z);
    }, 1200);
    // fireworks roll across the canyon
    setTimeout(() => burstEmbers(riverX(20), 14, 20), 3000);
    setTimeout(() => burstEmbers(ROCK.x, 12, ROCK.z), 4600);
  }
}
function startCinematic() {
  cine = { t: 0 };
  lookTarget.copy(player.pos).add(V3(0, 4, -10));
}

// --------------------------------------------------------------------- loop
let nowT = 0, started = false;
let batsErupted = false;
const burstBats = [];
let owlT = 18, crackleT = 0.5, pluckT = 1;
let stick = null;                       // Wynonna's fetch stick
const fish = { state: 'idle', tally: 0, legend: false, t: 0, waitT: 0, biteT: 0, from: V3(), to: V3() };
let fishBobber, fishLine;
let mugCount = 0;
let bmNext = 150, bmT = 0;              // blood moon omen timer
let showerNext = rand(170, 290), showerT = 0; // meteor shower timer
let creakT = rand(5, 10), glintT = rand(14, 30), zT = 1.5;
let tongueT = rand(2, 4), blinkT = rand(2, 5), blinkHold = 0;
let foxPounceT = rand(8, 15), ravenHopT = rand(7, 13), winTwitchT = rand(6, 12), winTwitch = 0;
let possumFlop = 0, possumRecover = 0;
const bmBase = new THREE.Color(0x5e1c07), bmDeep = new THREE.Color(0x78100a);
let runStart = null, runBest = null;
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
{
  // fishing gear (hidden until cast)
  fishBobber = new THREE.Mesh(mergeGeoms([
    { g: new THREE.SphereGeometry(0.09, 6, 5), m: M4(0, 0.04, 0, 0, 0, 0, 1, 0.7, 1), c: 0xd8402a },
    { g: new THREE.SphereGeometry(0.07, 6, 4), m: M4(0, 0.11, 0), c: 0xe8e2d2 },
  ]), matFlat);
  fishBobber.visible = false;
  scene.add(fishBobber);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  fishLine = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xd8ccb0, transparent: true, opacity: 0.5 }));
  fishLine.visible = false;
  fishLine.frustumCulled = false;
  scene.add(fishLine);
}
const clock = new THREE.Clock();
const hintFadeAt = { t: Infinity };

$('enterBtn').addEventListener('click', () => {
  $('title').classList.add('hidden');
  $('hud').classList.add('on');
  AudioEngine.start();
  MusicPlayer.start();
  started = true;
  intro = { t: 0, dur: foundCount > 0 ? 2.2 : 4.2 }; // returning travelers get the short cut
  hintFadeAt.t = nowT + 14;
  const isTouch = 'ontouchstart' in window;
  $('ctrlHint').textContent = isTouch
    ? 'LEFT — walk (push far to run) · RIGHT — look · JUMP — hop'
    : 'WASD — walk · SHIFT — run · DRAG — look · SPACE — hop';
});

function moveInput() {
  let x = 0, y = 0;
  if (keys.KeyW || keys.ArrowUp) y += 1;
  if (keys.KeyS || keys.ArrowDown) y -= 1;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  x += joy.x; y += -joy.y;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}

function tryMove(nx, nz) {
  // colliders push-out
  for (const c of colliders) {
    const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz);
    if (d < c.r && d > 0.001) { nx = c.x + dx / d * c.r; nz = c.z + dz / d * c.r; }
  }
  nx = clamp(nx, -108, 108);
  nz = clamp(nz, -104, 112);
  // step-up limit (can't walk up cliffs, small ledges OK)
  const g = terrainH(nx, nz);
  if (player.onGround && !player.swim && g - player.pos.y > 1.15) {
    // try sliding along each axis
    const gx = terrainH(nx, player.pos.z), gz = terrainH(player.pos.x, nz);
    if (gx - player.pos.y <= 1.15) return { x: nx, z: player.pos.z };
    if (gz - player.pos.y <= 1.15) return { x: player.pos.x, z: nz };
    return { x: player.pos.x, z: player.pos.z };
  }
  return { x: nx, z: nz };
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  nowT += dt;

  // ---- driving / paddling physics
  if (started && !cine && !intro && activeV) {
    const V = activeV, isBoat = V.kind === 'canoe';
    const inp = moveInput();
    if (jumpQueued && !isBoat) honk(); // Space is the horn in the Bronco
    V.speed += inp.y * (isBoat ? 6 : 13) * dt;
    V.speed *= Math.exp(-(Math.abs(inp.y) > 0.05 ? (isBoat ? 0.25 : 0.35) : (isBoat ? 0.8 : 1.7)) * dt);
    if (Math.abs(V.speed) < 0.05 && Math.abs(inp.y) < 0.05) V.speed = 0;
    V.speed = clamp(V.speed, isBoat ? -3 : -6, isBoat ? 7.5 : 17);
    const sgn = V.speed >= 0 ? 1 : -1;
    V.yaw -= inp.x * dt * (isBoat ? 1.35 : 1.75) * clamp(Math.abs(V.speed) / (isBoat ? 3 : 7), 0, 1) * sgn;
    const fx = Math.sin(V.yaw), fz = Math.cos(V.yaw);
    let nx = V.x + fx * V.speed * dt;
    let nz = V.z + fz * V.speed * dt;
    const ng = terrainH(nx, nz), cg = terrainH(V.x, V.z);
    const blocked = isBoat
      ? ng > WATER_Y - 0.28                              // canoe runs aground
      : (ng < WATER_Y - 0.55 || ng - cg > 1.7);          // bronco: too deep / too steep
    if (blocked) {
      V.speed *= -0.25;
    } else {
      const selfC = isBoat ? canoeCollider : broncoCollider;
      for (const c of colliders) {
        if (c === selfC) continue;
        const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz);
        const rr = c.r + (isBoat ? 0.7 : 1.1);
        if (d < rr && d > 0.001) { nx = c.x + dx / d * rr; nz = c.z + dz / d * rr; V.speed *= 0.6; }
      }
      V.x = clamp(nx, -106, 106);
      V.z = clamp(nz, -102, 110);
    }
    let gy;
    if (isBoat) {
      canoeCollider.x = V.x; canoeCollider.z = V.z;
      gy = WATER_Y - 0.1;
      canoeGrp.position.set(V.x, gy + Math.sin(nowT * 2.2) * 0.05, V.z);
      canoeGrp.rotation.set(Math.sin(nowT * 2.6) * 0.02, V.yaw, Math.sin(nowT * 1.9) * 0.03);
      const stroking = Math.abs(V.speed) > 0.6;
      canoePaddle.rotation.z = stroking ? Math.sin(nowT * 6) * 0.7 : 0.25;
      canoePaddle.position.x = stroking ? Math.sign(Math.sin(nowT * 3)) * 0.32 : 0.32;
      V.fxT = (V.fxT || 0) - dt;
      if (stroking && V.fxT <= 0) { V.fxT = 0.32; spawnRipple(V.x, V.z); AudioEngine.crackle(0.14); }
      if (wynRiding) { // first mate, up in the bow, nose to the wind
        wyn.visible = true;
        wyn.position.set(V.x + fx * 0.95, gy + 0.42 + Math.sin(nowT * 2.2) * 0.05, V.z + fz * 0.95);
        wyn.rotation.y = V.yaw;
        wyn.rotation.z = 0;
        wyn.scale.y = 1;
        wynTail.rotation.z = Math.sin(nowT * 7) * 0.4;
      }
    } else {
      broncoCollider.x = V.x; broncoCollider.z = V.z;
      gy = Math.max(terrainH(V.x, V.z), WATER_Y - 0.5);
      const hF = terrainH(V.x + fx * 1.4, V.z + fz * 1.4);
      const hB = terrainH(V.x - fx * 1.4, V.z - fz * 1.4);
      const hL = terrainH(V.x + fz * 0.9, V.z - fx * 0.9);
      const hR = terrainH(V.x - fz * 0.9, V.z + fx * 0.9);
      broncoGrp.position.set(V.x, gy, V.z);
      broncoGrp.rotation.order = 'YXZ';
      broncoGrp.rotation.set(-Math.atan2(hF - hB, 2.8), V.yaw, Math.atan2(hL - hR, 1.8));
      const spin = V.speed * dt / 0.5;
      for (const w of broncoWheels) w.rotation.x += spin;
      V.fxT = (V.fxT || 0) - dt;
      if (Math.abs(V.speed) > 5 && V.fxT <= 0) {
        V.fxT = 0.09;
        if (gy < WATER_Y + 0.15) spawnRipple(V.x, V.z);
        else spawnDust(V.x - fx * 1.7, gy + 0.2, V.z - fz * 1.7);
      }
      AudioEngine.setEngine(V.speed);
      if (Math.random() < dt * 0.5) AudioEngine.crackle(0.12); // a little radio static
    }
    player.pos.set(V.x, gy + 0.8, V.z);
    player.moving = Math.abs(V.speed) > 0.5;
    player.sprint = false;
    player.swim = false;
    if (nowT - cam.lastDrag > 1.2 && Math.abs(V.speed) > 1)
      cam.yaw = lerpAngle(cam.yaw, V.yaw + Math.PI, 1 - Math.exp(-1.7 * dt));
  }

  // ---- player physics (on foot)
  if (started && !cine && !intro && !activeV) {
    const inp = moveInput();
    const mag = Math.hypot(inp.x, inp.y);
    player.moving = mag > 0.05;
    player.idleT = player.moving ? 0 : (player.idleT || 0) + dt;
    player.sprint = !player.swim && player.moving &&
      (keys.ShiftLeft || keys.ShiftRight || (joy.id !== null && mag > 0.92));
    if (player.moving) {
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
      const rx = -fz, rz = fx;
      let mx = fx * inp.y + rx * inp.x, mz = fz * inp.y + rz * inp.x;
      const ml = Math.hypot(mx, mz);
      mx /= ml; mz /= ml;
      const boost = player.boostT > 0 ? 1.42 : 1; // the winemaker's gift
      const speed = (player.swim ? 3.2 : player.sprint ? 10.6 : 7.0) * boost * Math.min(mag, 1);
      const np = tryMove(player.pos.x + mx * speed * dt, player.pos.z + mz * speed * dt);
      player.pos.x = np.x; player.pos.z = np.z;
      player.yaw = lerpAngle(player.yaw, Math.atan2(mx, mz), 1 - Math.exp(-12 * dt));
      // camera drifts around behind the player while walking
      if (nowT - cam.lastDrag > 1.6) {
        cam.yaw = lerpAngle(cam.yaw, Math.atan2(-mx, -mz), 1 - Math.exp(-1.1 * dt));
      }
      if (nowT > hintFadeAt.t) $('ctrlHint').classList.add('fade');
    }
    const ground = terrainH(player.pos.x, player.pos.z);
    player.swim = ground < WATER_Y - 0.5;
    if (jumpQueued && player.onGround) {
      player.vel.y = player.swim ? 6.5 : 8.2;
      player.onGround = false;
    }
    jumpQueued = false;
    player.vel.y -= 23 * dt;
    player.pos.y += player.vel.y * dt;
    const floor = player.swim ? WATER_Y - 0.55 : ground;
    if (!player.onGround) player.airT = (player.airT || 0) + dt;
    if (player.pos.y <= floor) {
      if (!player.onGround && player.airT > 0.28) { // stuck the landing
        pSquash = 1;
        if (player.swim) {
          spawnRipple(player.pos.x, player.pos.z);
          spawnDust(player.pos.x, WATER_Y + 0.3, player.pos.z, 0xd8ecf5);
          spawnDust(player.pos.x, WATER_Y + 0.4, player.pos.z, 0xd8ecf5);
        } else {
          spawnDust(player.pos.x - 0.2, floor, player.pos.z, 0xffffff);
          spawnDust(player.pos.x + 0.2, floor, player.pos.z, 0xffffff);
        }
      }
      player.airT = 0;
      player.pos.y = floor;
      player.vel.y = 0;
      player.onGround = true;
    }
  }
  jumpQueued = false;

  // ---- player animation
  pGroup.position.copy(player.pos);
  if (player.swim) pGroup.position.y += Math.sin(nowT * 3) * 0.06;
  pGroup.rotation.y = player.yaw;
  player.animT += dt * (player.moving ? (player.sprint ? 14 : 10.5) : 2);
  // footstep dust & wading ripples
  player.fxT = (player.fxT || 0) - dt;
  if (player.moving && player.fxT <= 0 && started && !activeV) {
    if (player.swim) { spawnRipple(player.pos.x, player.pos.z); player.fxT = 0.4; }
    else if (player.onGround) {
      spawnDust(player.pos.x, player.pos.y, player.pos.z, player.boostT > 0 ? 0xc46ae8 : 0xffffff);
      player.fxT = player.sprint || player.boostT > 0 ? 0.14 : 0.24;
    }
  }
  if (player.swim && !player.wasSwim) spawnRipple(player.pos.x, player.pos.z);
  player.wasSwim = player.swim;
  // sprint widens the lens a touch
  const fovT = player.sprint && player.moving ? 67 : 62;
  if (Math.abs(camera.fov - fovT) > 0.05) {
    camera.fov = lerp(camera.fov, fovT, 1 - Math.exp(-6 * dt));
    camera.updateProjectionMatrix();
  }
  const swing = player.moving ? 0.65 : 0.06;
  pLegL.rotation.x = Math.sin(player.animT) * swing;
  pLegR.rotation.x = -Math.sin(player.animT) * swing;
  pArmL.rotation.x = -Math.sin(player.animT) * swing * 0.8;
  pArmR.rotation.x = Math.sin(player.animT) * swing * 0.8;
  pArmL.rotation.z = 0.12; pArmR.rotation.z = -0.12;
  if (!player.onGround) { pLegL.rotation.x = 0.5; pLegR.rotation.x = -0.35; }
  // squash on landing, stretch in the air, breathe at rest
  pSquash = Math.max(0, pSquash - dt * 4.5);
  const stretch = !player.onGround && Math.abs(player.vel.y) > 4 ? 0.06 : 0;
  const breathe = (player.idleT || 0) > 1 ? Math.sin(nowT * 2.1) * 0.012 : 0;
  pGroup.scale.set(1 + pSquash * 0.1, 1 - pSquash * 0.18 + stretch + breathe, 1 + pSquash * 0.1);
  // after a while standing still, he has a look around
  const lookT = (player.idleT || 0) > 6 ? Math.sin(nowT * 0.55) * 0.45 : 0;
  pHead.rotation.y = lerpAngle(pHead.rotation.y, lookT, 1 - Math.exp(-4 * dt));
  const shG = terrainH(player.pos.x, player.pos.z);
  pShadow.position.set(player.pos.x, Math.max(shG, WATER_Y) + 0.04, player.pos.z);
  pShadow.material.opacity = player.swim ? 0.12 : 0.35;

  // ---- camera
  const target = V3(player.pos.x, player.pos.y + 1.35, player.pos.z);
  if (intro) {
    // opening swoop: from the Great Tiki's gaze down to the traveler (any input skips it)
    const skipInp = moveInput();
    if (Math.hypot(skipInp.x, skipInp.y) > 0.1 || jumpQueued || dragging) intro.t = intro.dur;
    intro.t += dt;
    const k = Math.min(intro.t / intro.dur, 1);
    const s = k * k * (3 - 2 * k);
    const p0 = V3(TIKI.x + 9, 15, TIKI.z + 13);
    const l0 = V3(TIKI.x, 11.5, TIKI.z);
    const co = V3(
      Math.sin(cam.yaw) * Math.cos(cam.pitch),
      Math.sin(cam.pitch),
      Math.cos(cam.yaw) * Math.cos(cam.pitch)).multiplyScalar(cam.dist);
    const cp = target.clone().add(co);
    cp.y = Math.max(cp.y, terrainH(cp.x, cp.z) + 0.55, WATER_Y + 0.4);
    camera.position.lerpVectors(p0, cp, s);
    camera.lookAt(l0.lerp(target, s));
    if (k >= 1) intro = null;
  } else if (cine) {
    cine.t += dt;
    let aim;
    if (cine.t < 3.0) aim = MOON_POS;
    else if (cine.t < 5.6) aim = ORION_POS;
    else if (cine.t < 8.2) aim = GALAXY_POS;
    else aim = null;
    if (cine.t > 0.9 && !cine.starFired) { cine.starFired = true; fireShootingStar(); }
    if (aim) {
      lookTarget.lerp(aim, 1 - Math.exp(-1.8 * dt));
      const back = V3(Math.sin(cam.yaw), 0, Math.cos(cam.yaw)).multiplyScalar(2.2);
      const cp = target.clone().add(back).add(V3(0, 0.4, 0));
      cp.y = Math.max(cp.y, terrainH(cp.x, cp.z) + 0.5);
      camera.position.lerp(cp, 1 - Math.exp(-6 * dt));
      camera.lookAt(lookTarget);
    } else {
      cine = null;
    }
  }
  if (!cine && !intro) {
    let distT = activeV ? (activeV.kind === 'canoe' ? 9 : 11.5) : 6.8;
    if (Math.hypot(player.pos.x - GROTTO.x, player.pos.z - GROTTO.z) < 11) distT = 3.4;
    else if (Math.hypot(player.pos.x - DEN.x, player.pos.z - DEN.z) < 7.5) distT = 3.0;
    cam.dist = lerp(cam.dist, distT, 1 - Math.exp(-3 * dt));
    const co = V3(
      Math.sin(cam.yaw) * Math.cos(cam.pitch),
      Math.sin(cam.pitch),
      Math.cos(cam.yaw) * Math.cos(cam.pitch)).multiplyScalar(cam.dist);
    const cp = target.clone().add(co);
    cp.y = Math.max(cp.y, terrainH(cp.x, cp.z) + 0.55, WATER_Y + 0.4);
    camera.position.lerp(cp, 1 - Math.exp(-9 * dt));
    camera.lookAt(target);
    if (player.boostT > 0) camera.rotateZ(Math.sin(nowT * 1.6) * 0.013); // wine legs
  }

  // ---- POI proximity + discovery tracker
  if (started) {
    const dyn = dynTargets();
    let nearest = null, nearestD = 1e9, nearestX = 0, nearestZ = 0;
    for (const poi of pois) {
      let px = poi.x, pz = poi.z;
      if (poi.dynamic && dyn[poi.dynamic]) {
        px = dyn[poi.dynamic].position.x;
        pz = dyn[poi.dynamic].position.z;
      }
      if (poi.marker) {
        const popping = poi.pop > 0 && poi.pop < 1;
        poi.marker.visible = (!found[poi.id] || popping) && (!poi.requires || !!found[poi.requires]);
        const my = poi.water ? WATER_Y + poi.my : terrainH(px, pz) + poi.my;
        poi.marker.position.set(px, my + Math.sin(nowT * 2.4 + px) * 0.35, pz);
        if (popping) {
          poi.pop += dt * 2.2;
          poi.marker.scale.setScalar(1.5 * (1 + poi.pop * 1.7));
          poi.marker.material.opacity = Math.max(0, 1 - poi.pop);
          if (poi.pop >= 1) {
            poi.pop = 0;
            poi.marker.visible = false;
            poi.marker.scale.setScalar(1.5);
          }
        } else {
          poi.marker.material.opacity = 0.55 + 0.4 * Math.sin(nowT * 3 + pz);
        }
      }
      if (found[poi.id]) continue;
      const d = Math.hypot(player.pos.x - px, player.pos.z - pz);
      if (!poi.secret && d < nearestD) { nearestD = d; nearest = poi; nearestX = px; nearestZ = pz; }
      if (poi.water) {
        if (player.swim) discover(poi);
      } else if (d < poi.r) {
        discover(poi);
      }
    }
    // compass tracker points at the nearest undiscovered (non-secret) find
    const trackEl = $('tracker');
    if (nearest && !cine && !intro) {
      trackEl.style.display = 'flex';
      const bearing = Math.atan2(nearestX - player.pos.x, nearestZ - player.pos.z);
      const rel = bearing - (cam.yaw + Math.PI);
      const warm = nearestD < 18; // getting warmer…
      const pulse = warm ? 1 + Math.sin(nowT * 5) * 0.18 : 1;
      $('trackArrow').style.transform = `rotate(${-rel}rad) scale(${pulse})`;
      $('trackArrow').style.color = warm ? '#ffd77a' : '';
      const di = Math.round(nearestD);
      if (di !== player.lastTrackD) {
        player.lastTrackD = di;
        $('trackDist').textContent = di + ' paces';
      }
    } else {
      trackEl.style.display = 'none';
    }
    // DRIVE / PADDLE / EXIT button
    const dB = Math.hypot(player.pos.x - vehicle.x, player.pos.z - vehicle.z);
    const dC = Math.hypot(player.pos.x - canoeState.x, player.pos.z - canoeState.z);
    const nearV = Math.min(dB, dC) < 4.5;
    $('driveBtn').style.display = (activeV || nearV) && !cine && !intro ? 'block' : 'none';
    if (!activeV && nearV) $('driveBtn').textContent = dB <= dC ? 'DRIVE' : 'PADDLE';
  }

  // ---- critters
  // armadillo wander
  {
    const a = armadillo, g = a.grp;
    const distToPlayer = Math.hypot(player.pos.x - g.position.x, player.pos.z - g.position.z);
    if (distToPlayer < 3.5) {
      a.pause = 1.5; // freeze when the tiki man gets close
    } else if (a.pause > 0) {
      a.pause -= dt;
    } else {
      const d = V3(a.target.x - g.position.x, 0, a.target.z - g.position.z);
      const len = d.length();
      if (len < 0.5) {
        a.pause = rand(1.5, 4);
        let tx, tz, tries = 0;
        do {
          tx = a.home.x + rand(-a.home.r, a.home.r);
          tz = a.home.z + rand(-a.home.r, a.home.r);
        } while (terrainH(tx, tz) < WATER_Y + 0.3 && tries++ < 10);
        a.target.set(tx, 0, tz);
      } else {
        d.normalize();
        g.position.x += d.x * 1.25 * dt;
        g.position.z += d.z * 1.25 * dt;
        g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(d.x, d.z), 1 - Math.exp(-6 * dt));
      }
    }
    g.position.y = Math.max(terrainH(g.position.x, g.position.z), WATER_Y - 0.15)
      + Math.abs(Math.sin(nowT * 8)) * (a.pause > 0 ? 0 : 0.05);
    if (a.hopT > 0) { // the startle pop — straight up like a champagne cork
      a.hopT -= dt;
      g.position.y += Math.sin(Math.PI * (1 - a.hopT / 0.55)) * 1.15;
    }
  }
  // possum: gentle sway — until you get close, at which point it is DECEASED
  {
    const dP = Math.hypot(player.pos.x - POSSUM.x, player.pos.z - POSSUM.z);
    if (dP < 2.6) { possumFlop = 1; possumRecover = 2.5; }
    else if (dP > 4.5) {
      possumRecover -= dt;
      if (possumRecover <= 0) possumFlop = 0; // ...and it's back. Miraculous.
    }
    const targetZ = possumFlop ? 1.42 : Math.sin(nowT * 1.3) * 0.04;
    possum.rotation.z = lerp(possum.rotation.z, targetZ, 1 - Math.exp(-6 * dt));
  }
  // raven occasional flap
  {
    const u = raven.userData;
    if (u.flapT === undefined) { u.flapT = 0; u.next = rand(6, 14); }
    u.next -= dt;
    if (u.next <= 0) {
      u.flapT = 0.9;
      u.next = rand(8, 16);
      const d = Math.hypot(player.pos.x - TREE.x, player.pos.z - TREE.z);
      if (d < 30) AudioEngine.caw();
    }
    if (u.flapT > 0) {
      u.flapT -= dt;
      const f = Math.sin(nowT * 26) * 0.9;
      ravenWings[0].rotation.z = -Math.abs(f) - 0.1;
      ravenWings[1].rotation.z = Math.abs(f) + 0.1;
    } else {
      ravenWings[0].rotation.z = lerp(ravenWings[0].rotation.z, 0, 0.1);
      ravenWings[1].rotation.z = lerp(ravenWings[1].rotation.z, 0, 0.1);
    }
  }
  // rattlesnake proximity
  {
    const d = Math.hypot(player.pos.x - SNAKE.x, player.pos.z - SNAKE.z);
    snakeNear = lerp(snakeNear, clamp(1 - d / 10, 0, 1), 1 - Math.exp(-4 * dt));
    snakeHead.position.y = snakeHead.userData.baseY + snakeNear * 0.55;
    snakeHead.rotation.z = Math.sin(nowT * 5) * 0.1 * snakeNear;
    snakeRattle.rotation.x = Math.sin(nowT * 55) * 0.35 * snakeNear;
    snakeRattle.rotation.z = Math.cos(nowT * 47) * 0.3 * snakeNear;
    AudioEngine.setRattle(snakeNear * snakeNear);
  }
  // bats
  for (const bat of bats) {
    const u = bat.userData;
    u.ang += u.speed * dt;
    bat.position.set(u.cx + Math.cos(u.ang) * u.rad, u.h + Math.sin(nowT * 1.7 + u.flap) * 2.5, u.cz + Math.sin(u.ang) * u.rad);
    bat.rotation.y = -u.ang + (u.speed > 0 ? 0 : Math.PI);
    const f = Math.sin(nowT * 11 + u.flap) * 0.8;
    u.wl.rotation.z = f; u.wr.rotation.z = -f;
  }
  // clouds
  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 300) c.position.x = -300;
  }
  // galaxy slow spin
  galaxy.rotateZ(dt * 0.03);
  // shooting star
  if (shootingStar.active) {
    shootingStar.t += dt;
    const s = shootingStar;
    s.pos.addScaledVector(s.vel, dt);
    const tail = s.pos.clone().addScaledVector(s.vel, -0.16);
    const P = s.line.geometry.attributes.position;
    P.setXYZ(0, s.pos.x, s.pos.y, s.pos.z);
    P.setXYZ(1, tail.x, tail.y, tail.z);
    P.needsUpdate = true;
    s.line.material.opacity = Math.sin(Math.PI * clamp(s.t / s.max, 0, 1));
    if (s.t >= s.max) { s.active = false; s.line.material.opacity = 0; s.timer = rand(9, 18); }
  } else {
    shootingStar.timer -= dt;
    if (shootingStar.timer <= 0) fireShootingStar();
  }
  // water shimmer
  waterTex.offset.y += dt * 0.018;
  waterTex.offset.x = Math.sin(nowT * 0.12) * 0.03;
  // tiki eye glow
  if (tikiGlow > 0) {
    tikiGlow -= dt;
    const pulse = 0.7 + 0.3 * Math.sin(nowT * 5);
    tikiEyes.color.setRGB(1 * pulse, 0.15 * pulse, 0.04 * pulse);
    tikiEyeLight.intensity = 40 * pulse;
    if (tikiGlow <= 0) { tikiEyes.color.setHex(0x201a12); tikiEyeLight.intensity = 0; }
  }
  // embers
  if (embers.active) {
    const P = embers.pts.geometry.attributes.position;
    let alive = 0;
    for (let i = 0; i < P.count; i++) {
      if (embers.life[i] <= 0) continue;
      embers.life[i] -= dt;
      embers.vel[i].y -= 2.5 * dt;
      P.setXYZ(i,
        P.getX(i) + embers.vel[i].x * dt,
        P.getY(i) + embers.vel[i].y * dt,
        P.getZ(i) + embers.vel[i].z * dt);
      alive++;
    }
    P.needsUpdate = true;
    if (!alive) { embers.active = false; embers.pts.visible = false; }
  }

  // ---- roaming critters
  for (const w of wanderers) updateWanderer(w, dt);
  bevoHead.rotation.x = lerp(bevoHead.rotation.x,
    (bevo.pause > 0 ? 0.55 : 0.05) + Math.sin(nowT * 0.8) * 0.04, 1 - Math.exp(-3 * dt));
  bigfoot.rotation.z = Math.sin(nowT * 0.9) * 0.025;
  if (bigfootWave > 0) {
    bigfootWave -= dt;
    bigfootArm.rotation.z = 2.4 + Math.sin(nowT * 9) * 0.35;
  } else {
    bigfootArm.rotation.z = lerp(bigfootArm.rotation.z, 0, 1 - Math.exp(-4 * dt));
  }
  const eyePulse = 0.8 + 0.4 * Math.sin(nowT * 3.2);
  for (const e of chupaEyes) e.scale.set(eyePulse, blinkHold > 0 ? 0.06 : eyePulse, eyePulse);
  if (watcherFade > 0) {
    watcherFade -= dt;
    watcherMat.opacity = Math.max(0, watcherFade / 1.4);
    if (watcherFade <= 0) watcher.visible = false;
  }

  // ---- Wynonna (expedition dog, fetch champion, occasional zoomies)
  if (!wynRiding) {
    wynWag = Math.max(0, wynWag - dt);
    let wmoving = false;
    let curled = false;
    if (wynState === 'follow' && wyn.visible) {
      if (wynZoom > 0) {
        // ZOOMIES: victory laps around you after a good fetch
        wynZoom -= dt;
        wmoving = true;
        const a = nowT * 5;
        wyn.position.x = player.pos.x + Math.cos(a) * 2.3;
        wyn.position.z = player.pos.z + Math.sin(a) * 2.3;
        wyn.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
        wynWag = Math.max(wynWag, 0.2);
      } else {
        // pick her target: a thrown stick outranks everything
        let tx = player.pos.x, tz = player.pos.z, arriveR = 2.3, chase = false;
        if (stick && (stick.state === 'flying' || stick.state === 'ground')) {
          tx = stick.mesh.position.x; tz = stick.mesh.position.z; arriveR = 0.7; chase = true;
        } else if (stick && stick.state === 'returning') {
          arriveR = 1.7; chase = true;
        }
        const dx = tx - wyn.position.x, dz = tz - wyn.position.z;
        const d = Math.hypot(dx, dz);
        if (d > arriveR) {
          wmoving = true;
          const sp = chase ? 9.5 : (d > 15 ? 10 : Math.min(8, 2.5 + d * 0.9));
          let nx = wyn.position.x + dx / d * sp * dt, nz = wyn.position.z + dz / d * sp * dt;
          for (const c of colliders) {
            const cdx = nx - c.x, cdz = nz - c.z, cd = Math.hypot(cdx, cdz);
            if (cd < c.r && cd > 0.001) { nx = c.x + cdx / cd * c.r; nz = c.z + cdz / cd * c.r; }
          }
          wyn.position.x = nx; wyn.position.z = nz;
          wyn.rotation.y = lerpAngle(wyn.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
        } else if (stick && stick.state === 'ground') {
          stick.state = 'returning';   // got it!
          AudioEngine.yip();
        } else if (stick && stick.state === 'returning') {
          stick.state = 'held';        // drops it at your feet
          stick.mesh.visible = false;
          wynWag = 2.5;
          AudioEngine.yip();
          if (Math.random() < 0.35) wynZoom = 2.4;
        } else if ((player.idleT || 0) > 4 &&
            Math.hypot(wyn.position.x - FIRE.x, wyn.position.z - FIRE.z) < 7) {
          curled = true; // you're resting by the fire, so she curls up too
        }
        // carry the stick in her mouth on the way back
        if (stick && stick.state === 'returning') {
          stick.mesh.position.set(
            wyn.position.x + Math.sin(wyn.rotation.y) * 0.5,
            wyn.position.y + 0.45,
            wyn.position.z + Math.cos(wyn.rotation.y) * 0.5);
          stick.mesh.rotation.set(0, wyn.rotation.y + Math.PI / 2, 0);
        }
      }
    }
    wyn.scale.y = lerp(wyn.scale.y, curled ? 0.72 : 1, 1 - Math.exp(-4 * dt));
    const wg = terrainH(wyn.position.x, wyn.position.z);
    wyn.position.y = wg < WATER_Y - 0.5
      ? WATER_Y - 0.3 + Math.sin(nowT * 3.2) * 0.04
      : wg + (wmoving ? Math.abs(Math.sin(nowT * 11)) * 0.09 : 0);
    const nearMe = Math.hypot(player.pos.x - wyn.position.x, player.pos.z - wyn.position.z) < 3.5;
    wynTail.rotation.z = Math.sin(nowT * (wynWag > 0 ? 19 : curled ? 1.4 : nearMe ? 9 : 2.4)) *
      (wynWag > 0 ? 0.7 : curled ? 0.15 : 0.3);
  }
  // Winnie: slow breathing, tail thumps for visitors
  winnieWag = Math.max(0, winnieWag - dt);
  winnie.scale.y = 1 + Math.sin(nowT * 1.15) * 0.02;
  const nearWinnie = Math.hypot(player.pos.x - DEN.x, player.pos.z - DEN.z) < 7;
  winnieTail.rotation.z = Math.sin(nowT * (winnieWag > 0 ? 15 : nearWinnie ? 8 : 1.2)) * (winnieWag > 0 ? 0.6 : 0.22);

  // ---- fire, torches, smoke
  flameOuter.scale.set(1 + Math.sin(nowT * 11) * 0.12, 0.9 + Math.abs(Math.sin(nowT * 13.7)) * 0.35, 1 + Math.cos(nowT * 9) * 0.12);
  flameInner.scale.set(1 + Math.cos(nowT * 15) * 0.15, 0.9 + Math.abs(Math.sin(nowT * 17.3 + 1)) * 0.3, 1);
  flameOuter.rotation.y += dt * 1.8;
  flameInner.rotation.y -= dt * 2.4;
  fireLight.intensity = 24 + Math.sin(nowT * 12.3) * 5 + Math.sin(nowT * 29.7) * 3;
  for (const sp of smokes) {
    sp.userData.t += dt * 0.22;
    if (sp.userData.t > 1) sp.userData.t -= 1;
    const t = sp.userData.t;
    sp.position.set(Math.sin(t * 5 + nowT * 0.4) * 0.4, 1.1 + t * 4.6, Math.cos(t * 4) * 0.3);
    sp.scale.setScalar(0.7 + t * 2.2);
    sp.material.opacity = 0.4 * (1 - t) * Math.min(1, t * 6);
  }
  for (let i = 0; i < torchFlames.length; i++) {
    torchFlames[i].scale.y = 0.85 + Math.abs(Math.sin(nowT * 12 + i * 2.1)) * 0.4;
    torchFlames[i].rotation.y += dt * 2;
  }

  // ---- fireflies, ripples, dust, twinkle
  {
    const P = fireflies.pts.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const b = i * 3, ph = fireflies.phase[i];
      P.setXYZ(i,
        fireflies.base[b] + Math.sin(nowT * 0.5 + ph) * 1.4,
        fireflies.base[b + 1] + Math.sin(nowT * 0.9 + ph * 2) * 0.5,
        fireflies.base[b + 2] + Math.cos(nowT * 0.4 + ph) * 1.4);
    }
    P.needsUpdate = true;
    fireflies.pts.material.opacity = 0.55 + 0.35 * Math.sin(nowT * 2.1);
  }
  for (const r of ripples) {
    if (r.userData.age > 0.85) { r.visible = false; continue; }
    r.userData.age += dt;
    const t = r.userData.age;
    r.scale.setScalar(0.6 + t * 3.2);
    r.material.opacity = 0.5 * Math.max(0, 1 - t / 0.85);
  }
  for (const d of dusts) {
    if (d.userData.age > 0.5) { d.material.opacity = 0; continue; }
    d.userData.age += dt;
    const t = d.userData.age;
    d.position.y += 0.7 * dt;
    d.scale.setScalar(0.4 + t * 1.7);
    d.material.opacity = 0.35 * (1 - t / 0.5);
  }
  starMats[0].opacity = 0.7 + 0.25 * Math.sin(nowT * 1.7);
  starMats[1].opacity = 0.7 + 0.25 * Math.sin(nowT * 1.7 + Math.PI);

  // ---- bat eruption from the dead oak
  if (!batsErupted && started &&
      Math.hypot(player.pos.x - TREE.x, player.pos.z - TREE.z) < 13) {
    batsErupted = true;
    AudioEngine.flutter();
    const ty = terrainH(TREE.x, TREE.z) + 9;
    for (let i = 0; i < 10; i++) {
      const b = bats[0].clone();
      b.position.set(TREE.x, ty, TREE.z);
      const v = V3(rand(-1, 1), rand(0.7, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(6, 11));
      burstBats.push({ grp: b, vel: v, t: 0, wl: b.children[1], wr: b.children[2] });
      scene.add(b);
    }
  }
  for (let i = burstBats.length - 1; i >= 0; i--) {
    const b = burstBats[i];
    b.t += dt;
    b.vel.y = lerp(b.vel.y, 2.2, 1 - Math.exp(-0.8 * dt));
    b.grp.position.addScaledVector(b.vel, dt);
    b.grp.rotation.y = Math.atan2(b.vel.x, b.vel.z);
    const f = Math.sin(nowT * 16 + i) * 0.9;
    b.wl.rotation.z = f; b.wr.rotation.z = -f;
    if (b.t > 7) { scene.remove(b.grp); burstBats.splice(i, 1); }
  }

  // ---- positional ambience
  if (started) {
    AudioEngine.setLap(clamp(1 - Math.abs(player.pos.x - riverX(player.pos.z)) / 15, 0, 1));
    crackleT -= dt;
    if (crackleT <= 0) {
      crackleT = rand(0.07, 0.35);
      const prox = clamp(1 - Math.hypot(player.pos.x - FIRE.x, player.pos.z - FIRE.z) / 16, 0, 1);
      AudioEngine.crackle(prox);
      if (prox > 0.45 && Math.random() < 0.3) // a spark pops with the sound
        spawnDust(FIRE.x + rand(-0.3, 0.3), terrainH(FIRE.x, FIRE.z) + 1.0, FIRE.z + rand(-0.3, 0.3), 0xffc966);
    }
    owlT -= dt;
    if (owlT <= 0) {
      owlT = rand(24, 45);
      if (AudioEngine.ctx && !AudioEngine.muted) {
        const t0 = AudioEngine.ctx.currentTime;
        AudioEngine.tone(392, t0, 0.35, 0.045);
        AudioEngine.tone(494, t0 + 0.4, 0.3, 0.04);
        AudioEngine.tone(330, t0 + 0.75, 0.8, 0.05);
      }
    }
    pluckT -= dt;
    if (pluckT <= 0) {
      const inGrotto = Math.hypot(player.pos.x - GROTTO.x, player.pos.z - GROTTO.z) < 10;
      if (inGrotto) {
        AudioEngine.pluck([523, 587, 659, 784, 880, 1047][randi(0, 5)]);
        pluckT = rand(0.35, 1.1);
      } else {
        pluckT = 0.8;
      }
    }
  }

  // ---- the stick, mid-flight
  if (stick && stick.state === 'flying') {
    stick.vel.y -= 18 * dt;
    stick.mesh.position.addScaledVector(stick.vel, dt);
    stick.mesh.rotation.x += dt * 9;
    stick.mesh.rotation.z += dt * 7;
    const sg = Math.max(terrainH(stick.mesh.position.x, stick.mesh.position.z), WATER_Y - 0.15);
    if (stick.mesh.position.y <= sg + 0.08) {
      stick.mesh.position.y = sg + 0.08;
      stick.state = 'ground';
      if (sg < WATER_Y) spawnRipple(stick.mesh.position.x, stick.mesh.position.z);
    }
  }

  // ---- fishing
  if (fish.state !== 'idle') {
    if (Math.hypot(player.pos.x - fish.anchor.x, player.pos.z - fish.anchor.z) > 3) endFishing();
    if (fish.state === 'cast') {
      fish.t += dt / 0.6;
      const t = Math.min(fish.t, 1);
      fishBobber.position.lerpVectors(fish.from, fish.to, t);
      fishBobber.position.y += Math.sin(Math.PI * t) * 2;
      if (t >= 1) {
        fish.state = 'wait';
        fish.waitT = rand(2.5, 7);
        spawnRipple(fishBobber.position.x, fishBobber.position.z);
      }
    } else if (fish.state === 'wait') {
      fishBobber.position.y = WATER_Y + 0.05 + Math.sin(nowT * 2.2) * 0.04;
      fish.waitT -= dt;
      if (fish.waitT <= 0) {
        fish.state = 'bite';
        fish.biteT = 0.95;
        spawnRipple(fishBobber.position.x, fishBobber.position.z);
        if (AudioEngine.ctx && !AudioEngine.muted) AudioEngine.tone(180, AudioEngine.ctx.currentTime, 0.12, 0.14);
      }
    } else if (fish.state === 'bite') {
      fishBobber.position.y = WATER_Y - 0.12 + Math.sin(nowT * 22) * 0.03;
      fish.biteT -= dt;
      if (fish.biteT <= 0) { fish.state = 'wait'; fish.waitT = rand(2, 6); } // it let go
    }
    const LP = fishLine.geometry.attributes.position;
    LP.setXYZ(0, player.pos.x, player.pos.y + 1.15, player.pos.z);
    LP.setXYZ(1, fishBobber.position.x, fishBobber.position.y, fishBobber.position.z);
    LP.needsUpdate = true;
  }

  // ---- the winemaker's glass + speed boost
  if (started) {
    if (wineGlass.visible) {
      wineGlow.material.opacity = 0.35 + 0.25 * Math.sin(nowT * 3);
      if (!activeV && Math.hypot(player.pos.x + 68, player.pos.z - 10) < 1.9) {
        wineGlass.visible = false;
        wineRespawn = 120;
        player.boostT = 30;
        if (!found.wine) {
          discover(pois.find(p => p.id === 'wine'));
        } else {
          showPopup('Blood Moon Red', 'Another glass, already poured. The winemaker is generous, whoever they are. Legs: fast.', 'Cheers', 4000);
          AudioEngine.chime();
        }
      }
    } else if (wineRespawn > 0) {
      wineRespawn -= dt;
      if (wineRespawn <= 0) wineGlass.visible = true;
    }
    if (player.boostT > 0) {
      player.boostT -= dt;
      $('boostChip').style.display = 'block';
      $('boostChip').textContent = '🍷 ' + Math.ceil(Math.max(0, player.boostT)) + 's';
      if (player.boostT <= 0) $('boostChip').style.display = 'none';
    }
  }

  // ---- lost mugs
  for (let i = 0; i < mugs.length; i++) {
    const m = mugs[i];
    if (m.got) continue;
    m.grp.children[1].material.opacity = 0.28 + 0.2 * Math.sin(nowT * 3 + m.x);
    if (started && !activeV && Math.hypot(player.pos.x - m.x, player.pos.z - m.z) < 1.9) {
      m.got = true;
      m.grp.visible = false;
      mugCount++;
      shelfMugs[i].visible = true;
      AudioEngine.pluck(659, 0.1);
      AudioEngine.pluck(988, 0.07);
      showPopup('Lost Tiki Mug', `It flies home to Trader Blanco's bar top on its own. Don't think about it too hard. (${mugCount}/5)`, `Mug ${mugCount}/5`, 4200);
      if (wynState === 'follow') wynWag = 2;
      if (mugCount === 5) {
        setTimeout(() => {
          showPopup("The Regular's Pour", 'Every lost mug home safe. Somewhere in the grotto, a barstool now has your name burned into it. First round is forever on the house.', '★ Reward', 8000);
          AudioEngine.fanfare();
        }, 1600);
      }
      saveExtras();
    }
  }

  // ---- the grotto stage (one-time flavor moment)
  if (started && !stageSeen &&
      Math.hypot(player.pos.x - (GROTTO.x + 0.6), player.pos.z - (GROTTO.z - 5.6)) < 3.4) {
    stageSeen = true;
    showPopup('The Stage', 'String lights, a drum kit, and two amps still warm — the house band just stepped out back. Tip jar runs on the honor system.', 'Live at the Grotto', 6000);
    AudioEngine.pluck(392, 0.08);
    AudioEngine.pluck(494, 0.08);
    setTimeout(() => AudioEngine.pluck(587, 0.1), 180);
  }

  // ---- Trader Blanco (appears once the canyon is fully explored)
  trader.visible = foundCount >= pois.length;
  if (trader.visible) {
    trader.rotation.z = Math.sin(nowT * 1.1) * 0.03;
    if (!traderTalked && Math.hypot(player.pos.x - (GROTTO.x - 5.4), player.pos.z - GROTTO.z) < 3.2) {
      traderTalked = true;
      const mugLine = mugCount >= 5 ? ' And thank you kindly for the mugs — the regulars were getting antsy.' : ' If you happen across my lost mugs out there, I keep a shelf warm for them.';
      showPopup('Trader Blanco', 'Well now. You found every corner of my canyon, friend. First pour is on the house.' + mugLine + ' Aloha, y’all.', 'Howdy', 9000);
      AudioEngine.pluck(523, 0.09);
      AudioEngine.pluck(659, 0.09);
      setTimeout(() => AudioEngine.pluck(784, 0.1), 200);
    }
  }

  // ---- blood moon omens
  if (started) {
    if (bmT > 0) {
      bmT -= dt;
      const k = clamp(Math.min(bmT, 24 - bmT) / 3, 0, 1);
      scene.fog.color.copy(bmBase).lerp(bmDeep, k * 0.85);
      moonGlowSprite.scale.setScalar(120 + k * (42 + Math.sin(nowT * 6) * 14));
      tikiGlow = Math.max(tikiGlow, 0.15);
      if (bmT <= 0) {
        bmT = 0;
        bmNext = rand(170, 280);
        scene.fog.color.copy(bmBase);
        moonGlowSprite.scale.setScalar(120);
        if (!found.chupacabra) chupa.speed = 1.1;
      }
    } else {
      bmNext -= dt;
      if (bmNext <= 0) {
        bmT = 24;
        showPopup('Blood Moon Rising', 'The moon swells and the canyon holds its breath. Strange things move faster in this light…', 'Omen', 5000);
        AudioEngine.growl();
        AudioEngine.thumps();
        if (!found.chupacabra) chupa.speed = 2.6;
      }
    }
  }

  // ---- little lives: the canyon never fully sleeps
  windmillRotor.rotation.z += dt * 0.75;                 // always turning
  windmillHead.rotation.y = Math.sin(nowT * 0.09) * 0.25;
  grottoPuffer.rotation.z = Math.sin(nowT * 0.9) * 0.08;
  grottoPuffer.rotation.x = Math.cos(nowT * 0.7) * 0.05;
  // snake tastes the air
  tongueT -= dt;
  if (tongueT <= 0) tongueT = rand(2, 4.5);
  snakeTongue.scale.z = tongueT < 0.35 ? Math.sin(Math.PI * (1 - tongueT / 0.35)) : 0.01;
  // chupacabra blinks (which is somehow worse)
  blinkT -= dt;
  if (blinkT <= 0) { blinkT = rand(2.5, 6); blinkHold = 0.13; }
  blinkHold = Math.max(0, blinkHold - dt);
  // fox hears something under the grass
  foxPounceT -= dt;
  if (foxPounceT <= 0) { foxPounceT = rand(9, 16); fox.pounce = 0.55; }
  if (fox.pounce > 0) {
    fox.pounce -= dt;
    fox.extraY = Math.sin(Math.PI * (1 - fox.pounce / 0.55)) * 0.55;
    if (fox.pounce <= 0) fox.extraY = 0;
  }
  // raven sidles along his branch
  ravenHopT -= dt;
  if (ravenHopT <= 0 && raven.userData.flapT <= 0) {
    ravenHopT = rand(7, 14);
    raven.userData.hop = { t: 0, from: raven.position.x, to: clamp(raven.position.x + rand(-0.35, 0.35), -3.75, -3.0) };
  }
  if (raven.userData.hop) {
    const hp = raven.userData.hop;
    hp.t += dt * 4;
    raven.position.x = lerp(hp.from, hp.to, Math.min(hp.t, 1));
    raven.position.y = 9.7 + Math.sin(Math.PI * Math.min(hp.t, 1)) * 0.18;
    if (hp.t >= 1) raven.userData.hop = null;
  }
  // Winnie dreams: leg twitches and drifting Z's
  winTwitchT -= dt;
  if (winTwitchT <= 0) { winTwitchT = rand(6, 13); winTwitch = 0.5; }
  winTwitch = Math.max(0, winTwitch - dt);
  if (winTwitch > 0 && winnieWag <= 0) winnie.rotation.y += Math.sin(nowT * 40) * 0.006;
  zT -= dt;
  if (zT <= 0) {
    zT = 2.4;
    if (started && winnieWag <= 0 && Math.hypot(player.pos.x - DEN.x, player.pos.z - DEN.z) < 13) {
      const zs = zzz.find(q => q.userData.age > 2.2) || zzz[0];
      zs.userData.age = 0;
      zs.position.set(DEN.x + 1, terrainH(DEN.x, DEN.z) + 1.6, DEN.z);
    }
  }
  for (const zs of zzz) {
    if (zs.userData.age > 2.2) { zs.material.opacity = 0; continue; }
    zs.userData.age += dt;
    const a = zs.userData.age;
    zs.position.y += 0.45 * dt;
    zs.position.x += Math.sin(nowT * 2 + a * 4) * 0.1 * dt;
    zs.scale.setScalar(0.35 + a * 0.22);
    zs.material.opacity = 0.75 * Math.max(0, 1 - a / 2.2);
  }
  // river mist rolls downstream
  for (const m of mists) {
    m.userData.z += dt * 0.55;
    if (m.userData.z > 95) m.userData.z = -75;
    m.position.set(riverX(m.userData.z), WATER_Y + 0.9, m.userData.z);
    m.material.opacity = 0.1 + 0.06 * Math.sin(nowT * 0.5 + m.userData.z);
  }
  // every so often, the Great Tiki's eyes catch the moonlight. Probably the moonlight.
  glintT -= dt;
  if (glintT <= 0) {
    glintT = rand(20, 45);
    if (tikiGlow <= 0) tikiGlow = 0.35;
  }
  // the windmill complains about the wind, quietly
  creakT -= dt;
  if (creakT <= 0) {
    creakT = rand(6, 12);
    if (started && Math.hypot(player.pos.x - WINDMILL.x, player.pos.z - WINDMILL.z) < 16)
      AudioEngine.creak();
  }
  if (started) AudioEngine.setSnore(clamp(1 - Math.hypot(player.pos.x - DEN.x, player.pos.z - DEN.z) / 11, 0, 1));

  // ---- meteor showers, twinkles, hearts, cooldowns
  hornCooldown = Math.max(0, hornCooldown - dt);
  orionMat.opacity = 0.75 + 0.25 * Math.sin(nowT * 2.3);
  for (const h of hearts) {
    if (h.userData.age > 1.1) { h.material.opacity = 0; continue; }
    h.userData.age += dt;
    const a = h.userData.age;
    if (a < 0) continue; // staggered launch delay
    h.position.y += 0.85 * dt;
    h.position.x += Math.sin(nowT * 4 + h.userData.wob) * 0.15 * dt;
    h.scale.setScalar(0.28 + a * 0.32);
    h.material.opacity = 0.9 * Math.max(0, 1 - a / 1.1);
  }
  if (started) {
    showerNext -= dt;
    if (showerNext <= 0) { showerT = 10; showerNext = rand(240, 380); }
    if (showerT > 0) {
      showerT -= dt;
      if (!shootingStar.active) shootingStar.timer = Math.min(shootingStar.timer, rand(0.15, 0.8));
    }
  }

  // ---- contextual button visibility
  if (started) {
    $('fetchBtn').style.display =
      wynState === 'follow' && !activeV && !cine && !intro && (!stick || stick.state === 'held') ? 'block' : 'none';
    const dRiver = Math.abs(player.pos.x - riverX(player.pos.z));
    $('fishBtn').style.display =
      !activeV && !cine && !intro && !player.swim && ((dRiver <= 14 && dRiver >= 4) || fish.state !== 'idle') ? 'block' : 'none';
    $('fishBtn').textContent = fish.state === 'bite' ? 'HOOK!' : fish.state === 'idle' ? 'FISH' : 'REEL';
    const dW = wyn.visible && !wynRiding ? Math.hypot(player.pos.x - wyn.position.x, player.pos.z - wyn.position.z) : 99;
    const dWin = Math.hypot(player.pos.x - (DEN.x + 1), player.pos.z - DEN.z);
    $('petBtn').style.display =
      !activeV && !cine && !intro && (dW < 2.2 || dWin < 3.4) ? 'block' : 'none';
    $('jumpBtn').textContent = activeV && activeV.kind === 'bronco' ? 'HONK' : 'JUMP';
  }

  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(clamp(640 / innerWidth, 0.35, 1));
  renderer.setSize(innerWidth, innerHeight);
});

loadExtras();
loadSave();
tick();

// tiny debug handle (harmless in production, used by automated smoke tests)
window.__tb = { player, cam, pois, found, vehicle, canoeState, toggleDrive, fishPress, throwStick, fish, mugs,
  get activeV() { return activeV; }, get intro() { return intro; } };
