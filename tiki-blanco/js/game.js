// ============================================================================
//  TikiBlãnco — Blood Moon Canyon
//  A tiny explorable 3D rendering of the TikiBlãnco poster (Blanco, Texas).
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
}
// Orion (top-left of the poster)
const ORION_POS = V3(-250, 190, -230);
{
  const stars = [[-1.1, 1.5], [0, 2.15], [0.9, 1.4], [-0.35, 0.1], [0, 0], [0.35, -0.12], [0.8, -1.45], [-0.85, -1.5]];
  const links = [[0, 3], [2, 5], [3, 4], [4, 5], [3, 7], [5, 6], [0, 1], [1, 2], [6, 7]];
  const grp = new THREE.Group();
  const p = [];
  for (const s of stars) p.push(s[0] * 15, s[1] * 15, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  grp.add(new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xffffff, size: 3.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.95, depthWrite: false })));
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
let snakeHead, snakeRattle, snakeNear = 0;
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
let wyn, wynTail, wynState = 'wait', wynWag = 0;
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
const vehicle = { on: false, speed: 0, yaw: -0.9, x: 34, z: 62 };
let broncoGrp, broncoWheels = [], broncoLights = [], broncoLightMeshes = [];
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
function spawnDust(x, y, z) {
  const d = dusts.find(q => q.userData.age > 0.5) || dusts[0];
  d.userData.age = 0;
  d.position.set(x + rand(-0.2, 0.2), y + 0.15, z + rand(-0.2, 0.2));
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
let pGroup, pLegL, pLegR, pArmL, pArmR, pShadow;
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
    text: 'Rum barrels, glowing mugs, a blowfish lamp — a proper tiki temple carved into the canyon. Trader Blanco just stepped out. Leave a tip anyway.' },
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
}
function saveGame() {
  try { localStorage.setItem('tikiblanco-save', JSON.stringify(Object.keys(found))); } catch (e) { /* private mode */ }
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
  try { localStorage.removeItem('tikiblanco-save'); } catch (e) { /* ignore */ }
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
    this.scheduleCricket();
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
  playTrack() {
    const a = this.audio = new Audio(this.tracks[this.idx]);
    a.volume = AudioEngine.muted ? 0 : 0.3;
    a.addEventListener('ended', () => this.interlude());
    a.addEventListener('error', () => this.interlude());
    a.play().catch(() => { /* resumes on next user gesture via ctx */ });
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
    if (t.target.closest && t.target.closest('#jumpBtn,#driveBtn,#counter,#muteBtn,#popup,#guide,#complete,#title')) continue;
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

// climb in / hop out of the Bronco
function toggleDrive() {
  if (!started || cine || intro) return;
  if (vehicle.on) {
    vehicle.on = false;
    vehicle.speed = 0;
    AudioEngine.engineStop();
    for (const l of broncoLights) l.intensity = 0;
    for (const m of broncoLightMeshes) m.material.color.setHex(0x554d33);
    const sx = vehicle.x + Math.cos(vehicle.yaw) * 2.0, sz = vehicle.z - Math.sin(vehicle.yaw) * 2.0;
    player.pos.set(sx, Math.max(terrainH(sx, sz), WATER_Y - 0.55), sz);
    player.vel.y = 0;
    pGroup.visible = true;
    pShadow.visible = true;
    if (wynState === 'follow') {
      wyn.visible = true;
      wyn.position.set(sx + 1, player.pos.y, sz + 1);
    }
  } else {
    if (Math.hypot(player.pos.x - vehicle.x, player.pos.z - vehicle.z) > 4.5) return;
    vehicle.on = true;
    AudioEngine.engineStart();
    for (const l of broncoLights) l.intensity = 12;
    for (const m of broncoLightMeshes) m.material.color.setHex(0xffedb0);
    pGroup.visible = false;
    pShadow.visible = false;
    if (wynState === 'follow') wyn.visible = false; // she rides shotgun
  }
  $('driveBtn').textContent = vehicle.on ? 'EXIT' : 'DRIVE';
}
$('driveBtn').addEventListener('click', toggleDrive);
$('driveBtn').addEventListener('touchstart', e => { e.preventDefault(); toggleDrive(); }, { passive: false });

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
  $('count').textContent = foundCount;
  showPopup(poi.name, poi.text, poi.secret ? '★ Secret Discovery' : 'Discovery');
  AudioEngine.zelda();
  if (poi.marker) poi.marker.visible = false;
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
    setTimeout(() => {
      $('complete').classList.add('show');
      AudioEngine.fanfare();
      tikiGlow = 1e9; // eyes stay lit forever
      burstEmbers(TIKI.x, terrainH(TIKI.x, TIKI.z) + 11, TIKI.z);
    }, 1200);
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
const clock = new THREE.Clock();
const hintFadeAt = { t: Infinity };

$('enterBtn').addEventListener('click', () => {
  $('title').classList.add('hidden');
  $('hud').classList.add('on');
  AudioEngine.start();
  MusicPlayer.start();
  started = true;
  intro = { t: 0, dur: 4.2 };
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

  // ---- driving physics
  if (started && !cine && !intro && vehicle.on) {
    const inp = moveInput();
    vehicle.speed += inp.y * 13 * dt;
    vehicle.speed *= Math.exp(-(Math.abs(inp.y) > 0.05 ? 0.35 : 1.7) * dt);
    if (Math.abs(vehicle.speed) < 0.05 && Math.abs(inp.y) < 0.05) vehicle.speed = 0;
    vehicle.speed = clamp(vehicle.speed, -6, 17);
    const sgn = vehicle.speed >= 0 ? 1 : -1;
    vehicle.yaw -= inp.x * dt * 1.75 * clamp(Math.abs(vehicle.speed) / 7, 0, 1) * sgn;
    const fx = Math.sin(vehicle.yaw), fz = Math.cos(vehicle.yaw);
    let nx = vehicle.x + fx * vehicle.speed * dt;
    let nz = vehicle.z + fz * vehicle.speed * dt;
    const ng = terrainH(nx, nz), cg = terrainH(vehicle.x, vehicle.z);
    if (ng < WATER_Y - 0.55 || ng - cg > 1.7) {
      vehicle.speed *= -0.25; // too deep / too steep — bounce off
    } else {
      for (const c of colliders) {
        if (c === broncoCollider) continue;
        const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz);
        const rr = c.r + 1.1;
        if (d < rr && d > 0.001) { nx = c.x + dx / d * rr; nz = c.z + dz / d * rr; vehicle.speed *= 0.6; }
      }
      vehicle.x = clamp(nx, -106, 106);
      vehicle.z = clamp(nz, -102, 110);
    }
    broncoCollider.x = vehicle.x;
    broncoCollider.z = vehicle.z;
    const gy = Math.max(terrainH(vehicle.x, vehicle.z), WATER_Y - 0.5);
    const hF = terrainH(vehicle.x + fx * 1.4, vehicle.z + fz * 1.4);
    const hB = terrainH(vehicle.x - fx * 1.4, vehicle.z - fz * 1.4);
    const hL = terrainH(vehicle.x + fz * 0.9, vehicle.z - fx * 0.9);
    const hR = terrainH(vehicle.x - fz * 0.9, vehicle.z + fx * 0.9);
    broncoGrp.position.set(vehicle.x, gy, vehicle.z);
    broncoGrp.rotation.order = 'YXZ';
    broncoGrp.rotation.set(-Math.atan2(hF - hB, 2.8), vehicle.yaw, Math.atan2(hL - hR, 1.8));
    const spin = vehicle.speed * dt / 0.5;
    for (const w of broncoWheels) w.rotation.x += spin;
    vehicle.fxT = (vehicle.fxT || 0) - dt;
    if (Math.abs(vehicle.speed) > 5 && vehicle.fxT <= 0) {
      vehicle.fxT = 0.09;
      if (gy < WATER_Y + 0.15) spawnRipple(vehicle.x, vehicle.z);
      else spawnDust(vehicle.x - fx * 1.7, gy + 0.2, vehicle.z - fz * 1.7);
    }
    AudioEngine.setEngine(vehicle.speed);
    player.pos.set(vehicle.x, gy + 0.8, vehicle.z);
    player.moving = Math.abs(vehicle.speed) > 0.5;
    player.sprint = false;
    player.swim = false;
    if (nowT - cam.lastDrag > 1.2 && Math.abs(vehicle.speed) > 1)
      cam.yaw = lerpAngle(cam.yaw, vehicle.yaw + Math.PI, 1 - Math.exp(-1.7 * dt));
  }

  // ---- player physics (on foot)
  if (started && !cine && !intro && !vehicle.on) {
    const inp = moveInput();
    const mag = Math.hypot(inp.x, inp.y);
    player.moving = mag > 0.05;
    player.sprint = !player.swim && player.moving &&
      (keys.ShiftLeft || keys.ShiftRight || (joy.id !== null && mag > 0.92));
    if (player.moving) {
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
      const rx = -fz, rz = fx;
      let mx = fx * inp.y + rx * inp.x, mz = fz * inp.y + rz * inp.x;
      const ml = Math.hypot(mx, mz);
      mx /= ml; mz /= ml;
      const speed = (player.swim ? 3.2 : player.sprint ? 10.6 : 7.0) * Math.min(mag, 1);
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
    if (player.pos.y <= floor) {
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
  if (player.moving && player.fxT <= 0 && started) {
    if (player.swim) { spawnRipple(player.pos.x, player.pos.z); player.fxT = 0.4; }
    else if (player.onGround) { spawnDust(player.pos.x, player.pos.y, player.pos.z); player.fxT = player.sprint ? 0.14 : 0.24; }
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
  const shG = terrainH(player.pos.x, player.pos.z);
  pShadow.position.set(player.pos.x, Math.max(shG, WATER_Y) + 0.04, player.pos.z);
  pShadow.material.opacity = player.swim ? 0.12 : 0.35;

  // ---- camera
  const target = V3(player.pos.x, player.pos.y + 1.35, player.pos.z);
  if (intro) {
    // opening swoop: from the Great Tiki's gaze down to the traveler
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
    let distT = vehicle.on ? 11.5 : 6.8;
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
        poi.marker.visible = !found[poi.id] && (!poi.requires || !!found[poi.requires]);
        const my = poi.water ? WATER_Y + poi.my : terrainH(px, pz) + poi.my;
        poi.marker.position.set(px, my + Math.sin(nowT * 2.4 + px) * 0.35, pz);
        poi.marker.material.opacity = 0.55 + 0.4 * Math.sin(nowT * 3 + pz);
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
      trackEl.style.display = '';
      const bearing = Math.atan2(nearestX - player.pos.x, nearestZ - player.pos.z);
      const rel = bearing - (cam.yaw + Math.PI);
      $('trackArrow').style.transform = `rotate(${-rel}rad)`;
      const di = Math.round(nearestD);
      if (di !== player.lastTrackD) {
        player.lastTrackD = di;
        $('trackDist').textContent = di + ' paces';
      }
    } else {
      trackEl.style.display = 'none';
    }
    // DRIVE / EXIT button
    const nearBronco = Math.hypot(player.pos.x - vehicle.x, player.pos.z - vehicle.z) < 4.5;
    $('driveBtn').style.display = (vehicle.on || nearBronco) && !cine && !intro ? '' : 'none';
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
  // possum sway
  possum.rotation.z = Math.sin(nowT * 1.3) * 0.04;
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
  for (const e of chupaEyes) e.scale.setScalar(eyePulse);
  if (watcherFade > 0) {
    watcherFade -= dt;
    watcherMat.opacity = Math.max(0, watcherFade / 1.4);
    if (watcherFade <= 0) watcher.visible = false;
  }

  // ---- Wynonna (expedition dog)
  {
    wynWag = Math.max(0, wynWag - dt);
    let wmoving = false;
    if (wynState === 'follow') {
      const dx = player.pos.x - wyn.position.x, dz = player.pos.z - wyn.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.3) {
        wmoving = true;
        const sp = d > 15 ? 10 : Math.min(8, 2.5 + d * 0.9);
        let nx = wyn.position.x + dx / d * sp * dt, nz = wyn.position.z + dz / d * sp * dt;
        for (const c of colliders) {
          const cdx = nx - c.x, cdz = nz - c.z, cd = Math.hypot(cdx, cdz);
          if (cd < c.r && cd > 0.001) { nx = c.x + cdx / cd * c.r; nz = c.z + cdz / cd * c.r; }
        }
        wyn.position.x = nx; wyn.position.z = nz;
        wyn.rotation.y = lerpAngle(wyn.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
      }
    }
    const wg = terrainH(wyn.position.x, wyn.position.z);
    wyn.position.y = wg < WATER_Y - 0.5
      ? WATER_Y - 0.3 + Math.sin(nowT * 3.2) * 0.04
      : wg + (wmoving ? Math.abs(Math.sin(nowT * 11)) * 0.09 : 0);
    const nearMe = Math.hypot(player.pos.x - wyn.position.x, player.pos.z - wyn.position.z) < 3.5;
    wynTail.rotation.z = Math.sin(nowT * (wynWag > 0 ? 19 : nearMe ? 9 : 2.4)) * (wynWag > 0 ? 0.7 : 0.3);
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

  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(clamp(640 / innerWidth, 0.35, 1));
  renderer.setSize(innerWidth, innerHeight);
});

loadSave();
tick();

// tiny debug handle (harmless in production, used by automated smoke tests)
window.__tb = { player, cam, pois, found, vehicle, toggleDrive };
