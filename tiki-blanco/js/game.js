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
  if (ex > 0) m = Math.max(m, Math.min(38, ex * 1.5));
  const ez = -z - (82 + 6 * Math.sin(x * 0.11) + 3 * Math.sin(x * 0.27 + 1));
  if (ez > 0) m = Math.max(m, Math.min(38, ez * 1.5));
  const es = z - (92 + 5 * Math.sin(x * 0.13));
  if (es > 0) m = Math.max(m, Math.min(26, es * 1.4));
  if (m > 0) { const s = 3.5; m = Math.floor(m / s) * s + Math.min(m % s, 1.0) * 1.2; }
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
// stars
{
  const n = 750, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), e = Math.acos(rand(0.12, 0.995)), r = 405;
    p[i * 3] = r * Math.sin(e) * Math.cos(a);
    p[i * 3 + 1] = r * Math.cos(e);
    p[i * 3 + 2] = r * Math.sin(e) * Math.sin(a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xfff2d8, size: 2.0, sizeAttenuation: false, fog: false,
    transparent: true, opacity: 0.9, depthWrite: false })));
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
  grp.position.set(POSSUM.x, terrainH(POSSUM.x, POSSUM.z), POSSUM.z);
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
function scatterOK(x, z, buffer = 5) {
  if (Math.abs(x - riverX(z)) < 13) return false;
  if (mesaH(x, z) > 6) return false;
  for (const p of [TIKI, TREE, SNAKE, POSSUM, ROCK, { x: 0, z: 52 }, { x: 4, z: 8 }, { x: -16, z: 40 }, { x: -38, z: 46 }])
    if (Math.hypot(x - p.x, z - p.z) < buffer) return false;
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
    text: 'Carved long before anyone kept count, the stone guardian of the Blanco. His gaze keeps the canyon… mostly friendly.' },
  { id: 'tree', name: 'The Dead Oak', x: TREE.x, z: TREE.z, r: 6, my: 13.5,
    text: 'A lightning-struck live oak, bleached bone-white by a hundred Texas summers. Still standing. Stubborn like that.' },
  { id: 'raven', name: 'The Raven', x: TREE.x - 2.6, z: TREE.z - 0.2, r: 3.2, my: 10.6,
    text: 'He has watched everything that ever happened in this canyon. He is not telling.' },
  { id: 'armadillo', name: 'The Armadillo', dynamic: 'armadillo', r: 3.2, my: 1.6,
    text: 'The armored night-digger of the Hill Country. Approach slow — they startle straight up like a popped cork.' },
  { id: 'possum', name: 'The Opossum', x: POSSUM.x, z: POSSUM.z, r: 3.5, my: 1.6,
    text: 'Playing possum? No — just quietly judging you from the agarita brush.' },
  { id: 'snake', name: 'The Rattlesnake', x: SNAKE.x, z: SNAKE.z, r: 4.2, my: 2,
    text: 'A western diamondback keeping the beat. When you hear the maracas, back away politely and wish it a good evening.' },
  { id: 'agave', name: 'The Century Plant', x: -16, z: 40, r: 3.8, my: 8,
    text: 'Agave waits decades to bloom exactly once — then gives it absolutely everything. Respect.' },
  { id: 'pear', name: 'The Prickly Pear', x: -38, z: 46, r: 3.6, my: 3.5,
    text: 'Tough, spiny, and secretly sweet — the official state plant of Texas, wearing little red fruit like party hats.' },
  { id: 'river', name: 'The Blanco River', water: true, x: riverX(20), z: 20, r: 0, my: 2,
    text: 'Spring-fed and running silver under the blood moon. Cold enough to wake your ancestors. Go on, wade in.' },
  { id: 'sky', name: 'The Night Sky', x: ROCK.x, z: ROCK.z, r: 2.8, my: 3.4, cinematic: true,
    text: 'A blood moon over Blanco, Orion the hunter on watch, a wandering galaxy — and a falling star streaking home.' },
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
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: markerTex, transparent: true, depthWrite: false, opacity: 0.95 }));
  sp.scale.setScalar(1.5);
  poi.marker = sp;
  scene.add(sp);
}

// ----------------------------------------------------------------------- UI
const $ = id => document.getElementById(id);
const popupEl = $('popup'), popTitle = $('popTitle'), popText = $('popText');
let popupTimer = null;
function showPopup(title, text, ms = 6500) {
  popTitle.textContent = title;
  popText.textContent = text;
  popupEl.classList.add('show');
  clearTimeout(popupTimer);
  popupTimer = setTimeout(() => popupEl.classList.remove('show'), ms);
}
popupEl.addEventListener('click', () => popupEl.classList.remove('show'));

function refreshGuide() {
  const ul = $('guideList');
  ul.innerHTML = '';
  for (const poi of pois) {
    const li = document.createElement('li');
    const isFound = !!found[poi.id];
    li.className = isFound ? 'found' : 'unfound';
    li.innerHTML = `<span class="dot">${isFound ? '✓' : '○'}</span><span>${isFound ? poi.name : '? ? ?'}</span>`;
    ul.appendChild(li);
  }
}
$('counter').addEventListener('click', () => { refreshGuide(); $('guide').classList.add('show'); });
$('guideClose').addEventListener('click', () => $('guide').classList.remove('show'));
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
  }
};
$('muteBtn').addEventListener('click', () => {
  AudioEngine.muted = !AudioEngine.muted;
  if (AudioEngine.master) AudioEngine.master.gain.value = AudioEngine.muted ? 0 : 0.9;
  $('muteBtn').innerHTML = AudioEngine.muted ? '&#128263;' : '&#128266;';
});

// -------------------------------------------------------------------- input
const keys = {};
let jumpQueued = false;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
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
    if (t.target.closest && t.target.closest('#jumpBtn,#counter,#muteBtn,#popup,#guide,#complete,#title')) continue;
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

// ------------------------------------------------------------ discovery core
let cine = null;   // sky cinematic state
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
  showPopup(poi.name, poi.text);
  AudioEngine.chime();
  if (poi.marker) poi.marker.visible = false;
  if (poi.id === 'tiki') { tikiGlow = Math.max(tikiGlow, 3); }
  if (poi.id === 'raven') { AudioEngine.caw(); raven.userData.flapT = 1.2; }
  if (poi.id === 'sky') startCinematic();
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
const clock = new THREE.Clock();
const hintFadeAt = { t: Infinity };

$('enterBtn').addEventListener('click', () => {
  $('title').classList.add('hidden');
  $('hud').classList.add('on');
  AudioEngine.start();
  started = true;
  hintFadeAt.t = nowT + 9;
  const isTouch = 'ontouchstart' in window;
  $('ctrlHint').textContent = isTouch
    ? 'LEFT SIDE — walk · RIGHT SIDE — look · JUMP — hop'
    : 'WASD / ARROWS — walk · DRAG — look · SPACE — hop';
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

  // ---- player physics
  if (started && !cine) {
    const inp = moveInput();
    const mag = Math.hypot(inp.x, inp.y);
    player.moving = mag > 0.05;
    if (player.moving) {
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
      const rx = -fz, rz = fx;
      let mx = fx * inp.y + rx * inp.x, mz = fz * inp.y + rz * inp.x;
      const ml = Math.hypot(mx, mz);
      mx /= ml; mz /= ml;
      const speed = (player.swim ? 3.2 : 7.0) * Math.min(mag, 1);
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
  player.animT += dt * (player.moving ? 10.5 : 2);
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
  if (cine) {
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
  if (!cine) {
    const co = V3(
      Math.sin(cam.yaw) * Math.cos(cam.pitch),
      Math.sin(cam.pitch),
      Math.cos(cam.yaw) * Math.cos(cam.pitch)).multiplyScalar(cam.dist);
    const cp = target.clone().add(co);
    cp.y = Math.max(cp.y, terrainH(cp.x, cp.z) + 0.55, WATER_Y + 0.4);
    camera.position.lerp(cp, 1 - Math.exp(-9 * dt));
    camera.lookAt(target);
  }

  // ---- POI proximity
  if (started) {
    for (const poi of pois) {
      let px = poi.x, pz = poi.z;
      if (poi.dynamic === 'armadillo') { px = armadillo.grp.position.x; pz = armadillo.grp.position.z; }
      if (poi.marker) {
        const my = poi.water ? WATER_Y + poi.my : terrainH(px, pz) + poi.my;
        poi.marker.position.set(px, my + Math.sin(nowT * 2.4 + px) * 0.35, pz);
        poi.marker.material.opacity = 0.55 + 0.4 * Math.sin(nowT * 3 + pz);
      }
      if (found[poi.id]) continue;
      if (poi.water) {
        if (player.swim) discover(poi);
      } else if (Math.hypot(player.pos.x - px, player.pos.z - pz) < poi.r) {
        discover(poi);
      }
    }
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

  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(clamp(640 / innerWidth, 0.35, 1));
  renderer.setSize(innerWidth, innerHeight);
});

refreshGuide();
tick();

// tiny debug handle (harmless in production, used by automated smoke tests)
window.__tb = { player, cam, pois, found };
