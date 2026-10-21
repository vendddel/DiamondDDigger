"use strict";
const cv = document.getElementById("game"), ctx = cv.getContext("2d");
const VW = cv.width, VH = cv.height;
const dk = document.createElement("canvas"); dk.width = VW; dk.height = VH;
const dctx = dk.getContext("2d");
const T = 24, W = 120, H = 80, SURF = 10;
const AIR = 0, DIRT = 1, STONE = 2, DIAM = 3, LADDER = 4, GRASS = 5, BED = 6, WALL = 7;
const HARD = [0, 0.4, 0.9, 1.4, 0, 0.4, 1e9];
const MINE_SPEED = 3.2;
const SOLID = t => t !== AIR && t !== LADDER;
const LEVELS = [24, 38, 52, 66];

const ORDER = ["pick", "pistol", "shotgun", "smg", "rifle", "dynamite"];
const WEAP = {
  pick: { name: "Pickaxe" },
  pistol: { name: "Pistol", dmg: 18, cd: 0.28, spd: 760, n: 1, spr: 0.03, pack: 12, price: 2 },
  shotgun: { name: "Shotgun", dmg: 9, cd: 0.8, spd: 650, n: 6, spr: 0.24, life: 0.4, pack: 8, price: 5 },
  smg: { name: "SMG", dmg: 7, cd: 0.085, spd: 720, n: 1, spr: 0.1, pack: 30, price: 8 },
  rifle: { name: "Rifle", dmg: 42, cd: 0.65, spd: 1250, n: 1, spr: 0, pack: 8, price: 12 },
  dynamite: { name: "Dynamite", cd: 0.6, pack: 3, price: 12 }
};
const GUNS = ["pistol", "shotgun", "smg", "rifle", "dynamite"];
const START_AMMO = 12, SUPPLY_PRICE = 2, MED_HEAL = 35, DASH_CD = 5, DASH_TIME = 0.16, DASH_SPEED = 620;
const TYPES = {
  rifle: { name: "Rifleman", hp: 50, spd: 70, range: 480, pref: 200, rest: [1, 1.8], burst: 1, bcd: 0, w: 18, h: 40, col: "#3d5a2e", pants: "#2c3b22", hat: "#2a3d20", gun: "rifle" },
  shotgun: { name: "Shotgunner", hp: 85, spd: 90, range: 280, pref: 90, rest: [1.4, 2], burst: 1, bcd: 0, w: 20, h: 40, col: "#7a3a28", pants: "#3b2a22", hat: "#4a2418", gun: "shotgun" },
  smg: { name: "Gunner", hp: 45, spd: 95, range: 380, pref: 160, rest: [1.4, 2.2], burst: 5, bcd: 0.09, w: 18, h: 40, col: "#2f4a6b", pants: "#202f45", hat: "#1f3148", gun: "smg" },
  sniper: { name: "Sniper", hp: 35, spd: 45, range: 720, pref: 350, rest: [2.6, 3.4], burst: 1, bcd: 0, laser: 0.9, w: 18, h: 40, col: "#5a5a44", pants: "#33332a", hat: "#2e2e22", gun: "sniper" },
  heavy: { name: "Heavy", hp: 220, spd: 38, range: 420, pref: 200, rest: [1.8, 2.6], burst: 14, bcd: 0.1, w: 26, h: 46, col: "#4b4b52", pants: "#2c2c32", hat: "#222228", gun: "heavy" }
};

let map, deco, torches, chests, trees, player, soldiers, bullets, items, dyn, keys = {}, mouse = { x: 0, y: 0, left: false, right: false };
let boss = null, bombs = [];
let state = "menu", mining = { x: -1, y: -1, p: 0 }, parts = [], time = 0, shake = 0, toastT = 0, toastTxt = "", TEX = [];
const cam = { x: 0, y: 0 };
const rnd = (a, b) => a + Math.random() * (b - a);
const tile = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? BED : map[y][x];

/* ---------- textúrák ---------- */
function rngMake(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function mk(fn) { const c = document.createElement("canvas"); c.width = c.height = T; fn(c.getContext("2d")); return c; }
function speck(g, r, n, cols, s) { for (let i = 0; i < n; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect((r() * T) | 0, (r() * T) | 0, s, s); } }
function bevel(g) {
  g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(0, 0, T, 1); g.fillRect(0, 0, 1, T);
  g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(0, T - 1, T, 1); g.fillRect(T - 1, 0, 1, T);
}
function gem(g, cx, cy, s) {
  g.fillStyle = "#35c6f2"; g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * .7, cy); g.lineTo(cx, cy + s); g.lineTo(cx - s * .7, cy); g.closePath(); g.fill();
  g.fillStyle = "#a5f1ff"; g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx, cy + s); g.lineTo(cx - s * .7, cy); g.closePath(); g.fill();
  g.strokeStyle = "#0f7fa0"; g.lineWidth = 1; g.stroke();
  g.fillStyle = "#fff"; g.fillRect(cx - 1, cy - s + 2, 2, 2);
}
function stoneBase(g, r) {
  g.fillStyle = "#6d6d76"; g.fillRect(0, 0, T, T);
  speck(g, r, 40, ["#7d7d87", "#5e5e66", "#85858f", "#55555d"], 2);
}
function buildTextures() {
  for (let t = 0; t <= 7; t++) TEX[t] = [];
  for (let v = 0; v < 4; v++) {
    const r = rngMake(v * 977 + 13);
    TEX[DIRT].push(mk(g => { g.fillStyle = "#7a5230"; g.fillRect(0, 0, T, T); speck(g, r, 45, ["#8a6038", "#6a4426", "#5c3a20", "#946a42"], 2); speck(g, r, 5, ["#9a9a9a", "#777"], 3); bevel(g); }));
    TEX[STONE].push(mk(g => {
      stoneBase(g, r); g.strokeStyle = "rgba(0,0,0,.25)"; g.beginPath();
      let x = r() * T, y = r() * T; g.moveTo(x, y);
      for (let i = 0; i < 3; i++) { x += (r() - .5) * 12; y += (r() - .5) * 12; g.lineTo(x, y); }
      g.stroke(); bevel(g);
    }));
    TEX[DIAM].push(mk(g => { stoneBase(g, r); gem(g, 8 + r() * 3, 8 + r() * 3, 6); gem(g, 16 + r() * 3, 15 + r() * 3, 5); gem(g, 7 + r() * 4, 18, 3); bevel(g); }));
    TEX[GRASS].push(mk(g => {
      g.fillStyle = "#7a5230"; g.fillRect(0, 0, T, T); speck(g, r, 35, ["#8a6038", "#6a4426", "#5c3a20"], 2);
      g.fillStyle = "#3f9b3a"; g.fillRect(0, 0, T, 6);
      for (let x = 0; x < T; x += 2) { g.fillStyle = r() < .5 ? "#56b84c" : "#2e7d2b"; g.fillRect(x, 0, 2, 5 + ((r() * 4) | 0)); }
      bevel(g);
    }));
    TEX[BED].push(mk(g => { g.fillStyle = "#1c1c20"; g.fillRect(0, 0, T, T); speck(g, r, 30, ["#2b2b32", "#111"], 3); }));
    TEX[WALL].push(mk(g => { g.fillStyle = "#241b15"; g.fillRect(0, 0, T, T); speck(g, r, 22, ["#2d2219", "#1b140f", "#33271d"], 3); }));
  }
}
buildTextures();

/* ---------- pálya ---------- */
function generate() {
  map = []; deco = []; torches = []; chests = []; trees = [];
  for (let y = 0; y < H; y++) {
    const row = [], dr = [];
    for (let x = 0; x < W; x++) {
      let t = AIR;
      if (y === SURF) t = GRASS;
      else if (y > SURF) t = y < SURF + 12 ? DIRT : STONE;
      if (y > SURF + 3 && t !== AIR && Math.random() < 0.07 + y / 1200) t = DIAM;
      if (x === 0 || x === W - 1 || y === H - 1) t = BED;
      row.push(t); dr.push(0);
    }
    map.push(row); deco.push(dr);
  }
  for (let i = 0; i < 70; i++) {
    let x = rnd(5, W - 5) | 0, y = rnd(SURF + 5, H - 4) | 0;
    for (let s = 0; s < 40; s++) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const nx = x + dx, ny = y + dy;
        if (nx > 0 && nx < W - 1 && ny > SURF + 3 && ny < H - 1) map[ny][nx] = AIR;
      }
      x += (Math.random() * 3 | 0) - 1; y += (Math.random() * 3 | 0) - 1;
      x = Math.max(2, Math.min(W - 3, x)); y = Math.max(SURF + 4, Math.min(H - 3, y));
    }
  }
  for (const r of LEVELS) {
    for (let x = 2; x < W - 2; x++) {
      for (let y = r; y < r + 3; y++) map[y][x] = AIR;
      map[r + 3][x] = STONE;
      if (x % 8 === 0) { for (let y = r; y < r + 3; y++) deco[y][x] = 1; deco[r][x] = 2; }
      if (x % 8 === 4) torches.push({ x: x * T + T / 2, y: (r + 1) * T + 6, ph: Math.random() * 6 });
    }
  }
  const shaft = (x, y0, y1) => { for (let y = y0; y <= y1; y++) { map[y][x] = LADDER; map[y][x + 1] = AIR; } };
  shaft(W - 8, SURF, LEVELS[0] + 2);
  for (let i = 0; i < 3; i++) shaft(i % 2 === 0 ? 14 : W - 16, LEVELS[i], LEVELS[i + 1] + 2);
  for (let x = W - 9; x <= W - 7; x++) map[SURF][x] = AIR;

  chests.push({ tx: 12, ty: LEVELS[3] + 2, open: false });
  for (const r of LEVELS) for (let k = 0; k < 2; k++) {
    const tx = (rnd(6, W - 6) | 0); if (tile(tx, r + 2) === AIR) chests.push({ tx, ty: r + 2, open: false });
  }
  for (let tries = 0, n = 0; tries < 800 && n < 22; tries++) {
    const tx = (rnd(3, W - 3)) | 0, ty = (rnd(SURF + 6, H - 3)) | 0;
    if (tile(tx, ty) === AIR && SOLID(tile(tx, ty + 1)) && !chests.some(c => c.tx === tx && c.ty === ty)) { chests.push({ tx, ty, open: false }); n++; }
  }
  for (let x = 3; x < W - 3; x += 5 + (Math.random() * 6 | 0)) if (x < W - 14) trees.push({ x: x * T, h: rnd(60, 100) });
}

function pickType(i) {
  const tables = [
    [["heavy", .25], ["sniper", .25], ["shotgun", .2], ["smg", .15], ["rifle", .15]],
    [["shotgun", .3], ["smg", .25], ["sniper", .2], ["rifle", .15], ["heavy", .1]],
    [["rifle", .4], ["shotgun", .3], ["smg", .3]],
    [["rifle", .7], ["smg", .3]]
  ];
  let r = Math.random();
  for (const [t, p] of tables[i]) { if ((r -= p) <= 0) return t; }
  return "rifle";
}
function spawnSoldiers() {
  soldiers = [];
  const per = [7, 6, 5, 4];
  LEVELS.forEach((r, i) => {
    for (let k = 0; k < per[i]; k++) {
      const type = pickType(i), D = TYPES[type];
      const x = rnd(i === 3 ? 30 : 20, W - 6);
      soldiers.push({ type, x: x * T, y: (r + 2) * T - D.h, w: D.w, h: D.h, vx: 0, vy: 0, dir: Math.random() < .5 ? -1 : 1, hp: D.hp, maxhp: D.hp, cd: rnd(0.5, 1.5), flash: 0, kb: 0, ph: 0, aim: 0, shots: 0, aimT: null, mz: 0, ground: false });
    }
  });
}

function reset() {
  generate(); spawnSoldiers();
  player = { x: 6 * T, y: (LEVELS[3] + 2) * T - 38, w: 16, h: 38, vx: 0, vy: 0, hp: 100, dia: 0, stone: 0, dir: 1, ground: false, swing: 0, hurt: 0, onLadder: false, ph: 0,   own: { pick: true }, ammo: { pistol: 0, shotgun: 0, smg: 0, rifle: 0, dynamite: 0 }, meds: 0, dashCd: 0, dashT: 0, dashDir: 1, sel: "pick", fireCd: 0, muzzle: 0, aim: 0 };
    boss = makeBoss(); bombs = []; runTime = 0; lastHud = ""; closeShop();
  bullets = []; items = []; dyn = []; parts = []; keys = {}; mining = { x: -1, y: -1, p: 0 }; time = 0; shake = 0;
  state = "play";
  toast("Mine diamonds, then press E to open the shop!");
}
function toast(t) { toastTxt = t; toastT = 2.5; }

/* ---------- fizika ---------- */
function blockedBox(e, x, y) {
  const x0 = Math.floor(x / T), x1 = Math.floor((x + e.w - 1) / T), y0 = Math.floor(y / T), y1 = Math.floor((y + e.h - 1) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (SOLID(tile(tx, ty))) return true;
  return false;
}
function moveEntity(e, dt) {
  e.ground = false;
  const nx = e.x + e.vx * dt;
  if (blockedBox(e, nx, e.y)) { e.hitWall = true; e.vx = 0; } else { e.x = nx; e.hitWall = false; }
  const ny = e.y + e.vy * dt;
  if (blockedBox(e, e.x, ny)) { if (e.vy > 0) e.ground = true; e.vy = 0; } else e.y = ny;
}
function hasLOS(ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
  for (let i = 1; i < n; i++) if (SOLID(tile(Math.floor((ax + (bx - ax) * i / n) / T), Math.floor((ay + (by - ay) * i / n) / T)))) return false;
  return true;
}
function burst(x, y, c, n) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-120, 120), vy: rnd(-180, 20), life: rnd(.3, .7), c }); }

/* ---------- játékos ---------- */
function selectWeapon(name) { if (player.own[name]) player.sel = name; }
const randomGun = () => GUNS[(Math.random() * GUNS.length) | 0];
function giveAmmo(gun, mult) {
  const amt = Math.ceil(WEAP[gun].pack * (mult || 1));
  player.ammo[gun] += amt;
  return amt;
}

function openNearChest() {
  const p = player;
  for (const c of chests) {
    if (c.open) continue;
    if (Math.hypot(c.tx * T + T / 2 - (p.x + p.w / 2), c.ty * T + T / 2 - (p.y + p.h / 2)) < 48) {
      c.open = true;
      if (Math.random() < .25) { p.meds++; toast("Found: Medkit (press H to use)"); }
      else { GUNS.forEach(g => giveAmmo(g, 2.5)); toast("Found: lots of ammo for ALL guns!"); }
      burst(c.tx * T + T / 2, c.ty * T + 8, "#ffd34d", 14);
      return true;
    }
  }
  return false;
}

function useMedkit() {
  const p = player;
  if (state !== "play") return;
  if (p.meds <= 0) { toast("No medkits!"); return; }
  if (p.hp >= 100) { toast("Health is already full"); return; }
  p.meds--; p.hp = Math.min(100, p.hp + MED_HEAL);
  toast("+" + MED_HEAL + " HP");
  burst(p.x + p.w / 2, p.y + 10, "#ff5a6a", 12);
}

function dash() {
  const p = player;
  if (state !== "play" || p.dashCd > 0) return;
  p.dashCd = DASH_CD; p.dashT = DASH_TIME; p.dashDir = p.dir;
  shake = Math.max(shake, 2);
}

/* ---------- shop ---------- */
const shopEl = document.getElementById("shop");
let shopNote = "", ICON = {};
const DIA_SVG = '<svg class="ic" viewBox="0 0 24 24"><path d="M12 2l8 7-8 13L4 9z" fill="#35c6f2" stroke="#0f7fa0" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 2L4 9h16z" fill="#a5f1ff"/></svg>';
function buildIcons() {
  for (const n of ORDER) {
    const c = document.createElement("canvas"); c.width = 56; c.height = 34;
    const g = c.getContext("2d"); g.translate(9, 17); g.scale(1.3, 1.3);
    drawWeapon(n, g); ICON[n] = c.toDataURL();
  }
}
function openShop() {
  if (state !== "play") return;
  state = "shop"; shopNote = ""; mouse.left = mouse.right = false;
  renderShop(); shopEl.classList.remove("hidden");
}
function closeShop() {
  if (state === "shop") state = "play";
  shopEl.classList.add("hidden");
}
function renderShop() {
  const p = player, d = p.dia;
  const btn = (act, id, label, cost, ok) => '<button data-act="' + act + '" data-id="' + id + '"' + (ok && d >= cost ? "" : " disabled") + ">" + label + (cost ? " · " + cost + " " + DIA_SVG : "") + "</button>";
  let h = '<div class="head"><h2>Shop</h2><div class="bal">' + DIA_SVG + " <b>" + d + "</b></div></div>";
  h += '<div class="cols"><div><h3>Weapons</h3>';
  for (const n of GUNS) {
    const own = p.own[n];
    h += '<div class="row"><img src="' + ICON[n] + '"><span class="nm">' + WEAP[n].name + "</span>" + (own ? '<span class="owned">Owned</span>' : btn("buy", n, "Buy (+" + START_AMMO + " ammo)", WEAP[n].price, true)) + "</div>";
  }
  h += '</div><div><h3>Ammo</h3>';
  for (const n of GUNS) {
    h += '<div class="row"><img src="' + ICON[n] + '"><span class="nm">' + WEAP[n].name + ' <i>' + p.ammo[n] + "</i></span>" + btn("ammo", n, "+" + WEAP[n].pack, SUPPLY_PRICE, p.own[n]) + "</div>";
  }
  h += '</div></div><h3>Supplies</h3><div class="row"><span class="medic">+</span><span class="nm">Medkit (+' + MED_HEAL + " HP) <i>" + p.meds + "</i></span>" + btn("med", "", "Buy", SUPPLY_PRICE, true) + "</div>";
  h += '<div class="note">' + (shopNote || "Ammo can only be bought for weapons you own. Use medkits with H.") + '</div><div class="foot"><button data-act="close">Close (E)</button></div>';
  shopEl.innerHTML = '<div class="panel">' + h + "</div>";
}
function buy(act, id) {
  const p = player;
  if (act === "close") { closeShop(); return; }
  const price = act === "buy" ? WEAP[id].price : SUPPLY_PRICE;
  if (p.dia < price) { shopNote = "Not enough diamonds!"; renderShop(); return; }
  if (act === "buy") {
    if (p.own[id]) return;
    p.dia -= price; p.own[id] = true; p.ammo[id] += START_AMMO;
    if (p.sel === "pick") p.sel = id;
    shopNote = "Bought " + WEAP[id].name + " (+" + START_AMMO + " ammo)";
  } else if (act === "ammo") {
    if (!p.own[id]) return;
    p.dia -= price; p.ammo[id] += WEAP[id].pack;
    shopNote = "+" + WEAP[id].pack + " " + WEAP[id].name + " ammo";
  } else if (act === "med") {
    p.dia -= price; p.meds++;
    shopNote = "Bought a medkit";
  }
  renderShop();
}
shopEl.addEventListener("click", e => {
  const b = e.target.closest("button[data-act]");
  if (b && !b.disabled) buy(b.dataset.act, b.dataset.id);
});

function shoot() {
  const p = player, w = WEAP[p.sel];
  if (p.sel === "pick" || p.fireCd > 0) return;
  if ((p.ammo[p.sel] || 0) <= 0) { toast("Out of ammo!"); p.fireCd = .5; return; }
  p.ammo[p.sel]--; p.fireCd = w.cd;
  const ox = p.x + p.w / 2, oy = p.y + 18, a = Math.atan2(mouse.y + cam.y - oy, mouse.x + cam.x - ox);
  if (p.sel === "dynamite") { dyn.push({ x: ox, y: oy, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480 - 140, fuse: 1.8 }); return; }
  for (let i = 0; i < w.n; i++) {
    const aa = a + rnd(-w.spr, w.spr);
    bullets.push({ x: ox + Math.cos(a) * 20, y: oy + Math.sin(a) * 20, vx: Math.cos(aa) * w.spd, vy: Math.sin(aa) * w.spd, life: w.life || 1.2, dmg: w.dmg, fr: true });
  }
  p.muzzle = .06; shake = Math.max(shake, p.sel === "shotgun" ? 4 : p.sel === "rifle" ? 3 : 1);
  parts.push({ x: ox, y: oy, vx: -Math.cos(a) * 40 + rnd(-30, 30), vy: -90, life: .6, c: "#d9a93c" });
}

function updatePlayer(dt) {
  const p = player;
  const cx = Math.floor((p.x + p.w / 2) / T), cy = Math.floor((p.y + p.h / 2) / T);
  p.onLadder = tile(cx, cy) === LADDER;
  p.dashCd = Math.max(0, p.dashCd - dt);
  const dirIn = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  p.vx = dirIn * 170;
  if (p.onLadder && (keys.w || keys.s)) p.vy = ((keys.s ? 1 : 0) - (keys.w ? 1 : 0)) * 140;
  else if (p.onLadder) p.vy = 0;
  else p.vy = Math.min(p.vy + 1500 * dt, 800);
  if ((keys.w || keys[" "]) && p.ground && !p.onLadder) p.vy = -480;
  if (p.dashT > 0) {
    p.dashT -= dt; p.vx = p.dashDir * DASH_SPEED; p.vy = 0;
    parts.push({ x: p.x + p.w / 2 - p.dashDir * 8, y: p.y + rnd(4, p.h - 4), vx: -p.dashDir * 40, vy: rnd(-20, 20), life: .3, c: Math.random() < .5 ? "#9fe8ff" : "#ffffff" });
  }
  moveEntity(p, dt);
  p.ph += Math.abs(p.vx) * dt * .06;
  p.swing = Math.max(0, p.swing - dt); p.hurt = Math.max(0, p.hurt - dt);
  p.fireCd = Math.max(0, p.fireCd - dt); p.muzzle = Math.max(0, p.muzzle - dt);

  const wx = mouse.x + cam.x, wy = mouse.y + cam.y;
  p.dir = wx >= p.x + p.w / 2 ? 1 : -1;
  p.aim = Math.atan2(wy - (p.y + 18), wx - (p.x + p.w / 2));

  const mx = Math.floor(wx / T), my = Math.floor(wy / T);
  const dist = Math.hypot(mx * T + T / 2 - (p.x + p.w / 2), my * T + T / 2 - (p.y + p.h / 2));
  const t = tile(mx, my);
  if (mouse.left && p.sel !== "pick") shoot();
  if (mouse.left && p.sel === "pick" && dist < T * 5 && SOLID(t) && t !== BED) {
    if (mining.x !== mx || mining.y !== my) mining = { x: mx, y: my, p: 0 };
    mining.p += dt * MINE_SPEED / HARD[t];
    p.mining = true;
    if (Math.random() < .4) burst(mx * T + T / 2, my * T + T / 2, t === DIRT || t === GRASS ? "#7a5230" : t === DIAM ? "#5ad8ff" : "#8a8a92", 1);
    if (mining.p >= 1) {
      map[my][mx] = AIR; burst(mx * T + T / 2, my * T + T / 2, t === DIRT ? "#7a5230" : t === DIAM ? "#5ad8ff" : "#8a8a92", 8);
      if (t === DIAM) { p.dia++; toast("+1 diamond 💎"); } else if (t === STONE || t === DIRT) p.stone++;
      mining.p = 0;
    }
  } else { mining.p = 0; p.mining = false; }
  if (mouse.right && dist < T * 5 && t === AIR && p.stone > 0) {
    const ov = !(mx * T >= p.x + p.w || mx * T + T <= p.x || my * T >= p.y + p.h || my * T + T <= p.y);
    if (!ov) { map[my][mx] = STONE; p.stone--; }
  }
  if (p.y < (SURF - 1) * T && !boss.active) startBoss();
  if (p.hp <= 0 && state === "play") { state = "dead"; showMsg("You died!", "The soldiers got you. Diamonds: " + p.dia, "Retry"); }
}

function hurtSoldier(s, dmg, kx) {
  if (s.hp <= 0) return;
  s.hp -= dmg; s.flash = .12; s.kb = .15; s.vx = kx; s.vy = Math.min(s.vy, -120);
  burst(s.x + s.w / 2, s.y + 15, "#b11", 6);
  if (s.hp <= 0) {
    const r = Math.random();
    if (r < .35) items.push({ x: s.x, y: s.y + s.h - 12, vy: 0, kind: "bread" });
    else if (r < .7) items.push({ x: s.x, y: s.y + s.h - 12, vy: 0, kind: "ammo", gun: randomGun() });
    burst(s.x + s.w / 2, s.y + 20, "#b11", 14);
  }
}

function attack() {
  const p = player;
  if (state !== "play" || p.swing > 0) return;
  p.swing = 0.3;
  const hx = p.dir > 0 ? p.x + p.w : p.x - 44;
  if (hx < boss.x + boss.w && hx + 44 > boss.x && p.y < boss.y + boss.h && p.y + p.h > boss.y) hurtBoss(28);
  for (const s of soldiers) {
    if (s.hp > 0 && hx < s.x + s.w && hx + 44 > s.x && p.y < s.y + s.h && p.y + p.h > s.y) hurtSoldier(s, 28, p.dir * 220);
  }
}

/* ---------- katonák ---------- */
function enemyFire(s, a) {
  const D = TYPES[s.type], ax = s.x + s.w / 2 + Math.cos(a) * 18, ay = s.y + 20 + Math.sin(a) * 18;
  const add = (ang, spd, dmg, life) => bullets.push({ x: ax, y: ay, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: life || 1.5, dmg, fr: false });
  switch (D.gun) {
    case "rifle": add(a + rnd(-.06, .06), 520, 10); break;
    case "shotgun": for (let i = 0; i < 5; i++) add(a + rnd(-.22, .22), 480, 5, .55); break;
    case "smg": add(a + rnd(-.1, .1), 560, 5); break;
    case "sniper": add(a, 1150, 30, 1.2); break;
    case "heavy": add(a + rnd(-.14, .14), 540, 4); break;
  }
  s.mz = .06;
}

function updateSoldiers(dt) {
  const p = player;
  soldiers = soldiers.filter(s => s.hp > 0);
  for (const s of soldiers) {
    const D = TYPES[s.type];
    s.flash = Math.max(0, s.flash - dt); s.cd -= dt; s.mz = Math.max(0, s.mz - dt);
    const px = p.x + p.w / 2, py = p.y + p.h / 2;
    const dx = px - (s.x + s.w / 2), d = Math.hypot(dx, py - (s.y + 20));
    const sees = d < D.range && Math.abs(dx) <= 12 * T && Math.abs(py - (s.y + 20)) <= 6 * T && hasLOS(s.x + s.w / 2, s.y + 14, px, py);
    if (s.kb > 0) s.kb -= dt;
    else if (sees) {
      s.dir = dx > 0 ? 1 : -1;
      if (s.aimT !== null) s.vx = 0;
      else s.vx = d > D.pref + 40 ? s.dir * D.spd : (d < D.pref - 40 ? -s.dir * D.spd * .7 : 0);
    } else {
      s.vx = s.dir * 50;
      if (s.hitWall) s.dir *= -1;
      const ahead = Math.floor((s.x + (s.dir > 0 ? s.w + 4 : -4)) / T), fy = Math.floor((s.y + s.h + 4) / T);
      if (!SOLID(tile(ahead, fy)) && s.ground) s.dir *= -1;
    }
    s.vy = Math.min(s.vy + 1500 * dt, 800);
    if (s.hitWall && s.ground && sees && s.kb <= 0) s.vy = -420;
    moveEntity(s, dt);
    s.ph += Math.abs(s.vx) * dt * .06;
    s.aim = sees ? Math.atan2(py - (s.y + 20), px - (s.x + s.w / 2)) : (s.dir > 0 ? 0.2 : Math.PI - 0.2);

    if (!sees) { s.aimT = null; continue; }
    if (D.laser) {
      if (s.aimT !== null) {
        s.aimT -= dt;
        if (s.aimT <= 0) { enemyFire(s, s.aim); s.aimT = null; s.cd = rnd(...D.rest); }
      } else if (s.cd <= 0) s.aimT = D.laser;
    } else if (s.cd <= 0) {
      enemyFire(s, s.aim);
      if (++s.shots >= D.burst) { s.shots = 0; s.cd = rnd(...D.rest); } else s.cd = D.bcd;
    }
  }
}

/* ---------- főellenség ---------- */
const ARENA_L = W - 48, ARENA_R = W - 3;
function makeBoss() {
  return { x: (W - 24) * T, y: SURF * T - 88, w: 44, h: 88, vx: 0, vy: 0, hp: 900, maxhp: 900, active: false, dead: false, flash: 0, cd: 2, bursting: 0, bcd: 0, aim: Math.PI, ph: 0, dir: -1, phase: 1, jumpT: 5, jumping: false, airT: 0, deadT: 0, crateT: 3, mz: 0, ground: false, summoned: [false, false] };
}
function startBoss() {
  boss.active = true;
  for (let y = Math.max(1, SURF - 12); y < SURF; y++) map[y][ARENA_L - 1] = STONE;
  for (let x = W - 9; x <= W - 7; x++) map[SURF][x] = GRASS;
  shake = 10; toast("THE MINE LORD! Defeat him to be free!");
}
function hurtBoss(dmg) {
  const b = boss;
  if (!b.active || b.dead) return;
  b.hp -= dmg; b.flash = .06;
  burst(b.x + b.w / 2, b.y + 30, "#ffb347", 3);
  if (b.hp <= 0) { b.hp = 0; b.dead = true; bullets = []; bombs = []; toast("You defeated the Mine Lord!"); }
}
function spawnReinforcements() {
  const types = ["rifle", "smg"];
  types.forEach((type, k) => {
    const D = TYPES[type];
    soldiers.push({ type, x: boss.x + (k - 1) * 90, y: SURF * T - D.h - 2, w: D.w, h: D.h, vx: 0, vy: 0, dir: -1, hp: D.hp, maxhp: D.hp, cd: 1, flash: 0, kb: 0, ph: 0, aim: 0, shots: 0, aimT: null, mz: 0, ground: false });
  });
  toast("Reinforcements incoming!");
}
function updateBoss(dt) {
  const b = boss, p = player;
  if (!b.active) return;
  if (b.dead) {
    b.deadT += dt; shake = 5;
    if (Math.random() < .6) parts.push({ x: b.x + rnd(0, b.w), y: b.y + rnd(0, b.h), vx: rnd(-200, 200), vy: rnd(-300, 0), life: .8, c: ["#ff9d1c", "#ffd34d", "#555"][(Math.random() * 3) | 0] });
    if (b.deadT > 2.5) win();
    return;
  }
  b.flash = Math.max(0, b.flash - dt); b.mz = Math.max(0, b.mz - dt);
  const px = p.x + p.w / 2, py = p.y + p.h / 2, bx = b.x + b.w / 2, by = b.y + 26;
  b.phase = b.hp > b.maxhp * .66 ? 1 : b.hp > b.maxhp * .33 ? 2 : 3;
  if (!b.summoned[0] && b.hp <= b.maxhp * .66) { b.summoned[0] = true; spawnReinforcements(); }
  if (!b.summoned[1] && b.hp <= b.maxhp * .33) { b.summoned[1] = true; spawnReinforcements(); }
  const dx = px - bx; b.dir = dx > 0 ? 1 : -1; b.aim = Math.atan2(py - by, dx);
  const spd = [0, 40, 60, 80][b.phase], dist = Math.abs(dx);
  if (b.jumping && !b.ground) b.vx = b.dir * 230;
  else b.vx = dist > 260 ? b.dir * spd : dist < 140 ? -b.dir * spd * .6 : 0;
  b.vy = Math.min(b.vy + 1500 * dt, 900);
  b.jumpT -= dt;
  if (b.hitWall && b.ground) b.vy = -620;
  if (b.phase >= 2 && b.jumpT <= 0 && b.ground) { b.vy = -720; b.jumping = true; b.airT = 0; b.jumpT = rnd(7, 10); }
  moveEntity(b, dt);
  b.x = Math.max(ARENA_L * T, Math.min(ARENA_R * T - b.w, b.x));
  b.ph += Math.abs(b.vx) * dt * .04;
  if (b.jumping) {
    b.airT += dt;
    if (b.ground && b.airT > .15) {
      b.jumping = false; shake = 12;
      for (const s of [-1, 1]) bullets.push({ x: bx, y: b.y + b.h - 8, vx: s * 380, vy: 0, life: 1.6, dmg: 8, fr: false });
      burst(bx, b.y + b.h, "#7a5230", 16);
    }
  }
  const fire = (ang, spd2, dmg) => bullets.push({ x: bx + Math.cos(b.aim) * 40, y: by + Math.sin(b.aim) * 40, vx: Math.cos(ang) * spd2, vy: Math.sin(ang) * spd2, life: 2, dmg, fr: false });
  b.cd -= dt;
  if (b.bursting > 0) {
    b.bcd -= dt;
    if (b.bcd <= 0) { fire(b.aim + rnd(-.15, .15), 480, 3); b.mz = .06; b.bursting--; b.bcd = .08; }
  } else if (b.cd <= 0) {
    const opts = b.phase === 1 ? ["fan", "burst"] : ["fan", "burst", "bomb"];
    const a = opts[(Math.random() * opts.length) | 0];
    if (a === "fan") { for (let i = -1; i <= 1; i++) fire(b.aim + i * .22, 400, 6); b.mz = .1; shake = 3; }
    else if (a === "burst") { b.bursting = 7; b.bcd = 0; }
    else bombs.push({ x: bx, y: by, vx: Math.max(-520, Math.min(520, dx * .9)), vy: -450, fuse: 1.4 });
    b.cd = [0, 2.6, 2.1, 1.7][b.phase] * rnd(.9, 1.4);
  }
  b.crateT -= dt;
  if (b.crateT <= 0) {
    b.crateT = 4.5;
    if (items.filter(i => i.drop).length < 4) items.push({ x: rnd(W - 46, W - 5) * T, y: (SURF - 14) * T, vy: 0, kind: (p.hp < 60 || Math.random() < .5) ? "med" : "ammo", gun: randomGun(), big: true, drop: true });
  }
}
function explodeBomb(x, y) {
  for (let i = 0; i < 30; i++) parts.push({ x, y, vx: rnd(-260, 260), vy: rnd(-300, 80), life: rnd(.3, .7), c: ["#ff9d1c", "#ffd34d", "#ff5a1c"][(Math.random() * 3) | 0] });
  shake = Math.max(shake, 7);
  const p = player, d = Math.hypot(p.x + p.w / 2 - x, p.y + p.h / 2 - y);
  if (d < T * 3) { p.hp -= Math.round(25 * (1 - d / (T * 3.5))); p.hurt = .3; }
}
function drawBoss() {
  const b = boss; if (!b) return;
  const cxs = b.x + b.w / 2 - cam.x, bot = b.y + b.h - cam.y;
  if (cxs < -100 || cxs > VW + 100) return;
  const e = { x: cam.x - 9, y: cam.y - 40, w: 18, h: 40, vx: b.vx };
  ctx.save(); ctx.translate(cxs, bot); ctx.scale(2.2, 2.2);
  const rage = b.phase >= 3;
  drawPerson(e, { body: rage ? "#7a1818" : "#5a2a2a", pants: "#241010", hat: "#111", skin: "#8a6a5a", belt: "#c9a227", aim: b.dead ? 1.2 : b.aim, weapon: "heavy", flash: b.flash > 0, ph: b.ph, muzzle: b.mz > 0 });
  ctx.fillStyle = "#c9a227"; ctx.fillRect(-6, -43, 12, 4); ctx.fillRect(-6, -46, 2, 3); ctx.fillRect(-1, -47, 2, 4); ctx.fillRect(4, -46, 2, 3);
  ctx.fillStyle = "#ff2a2a"; ctx.fillRect(b.dir > 0 ? 0 : -6, -36, 6, 2);
  ctx.fillStyle = "#777"; ctx.fillRect(-12, -28, 6, 5); ctx.fillRect(6, -28, 6, 5);
  ctx.restore();
}

/* ---------- lövedékek, tárgyak, robbanás ---------- */
function explode(x, y) {
  const R = 3.2;
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    if (Math.hypot(dx, dy) <= R) {
      const X = tx + dx, Y = ty + dy;
      if (X > 0 && X < W - 1 && Y > 0 && Y < H - 1 && map[Y][X] !== BED) {
        if (map[Y][X] === DIAM) player.dia++;
        map[Y][X] = AIR;
      }
    }
  }
  for (let i = 0; i < 40; i++) parts.push({ x, y, vx: rnd(-300, 300), vy: rnd(-350, 100), life: rnd(.4, .9), c: ["#ff9d1c", "#ffd34d", "#555", "#ff5a1c"][(Math.random() * 4) | 0] });
  shake = 12;
  for (const s of soldiers) {
    const d = Math.hypot(s.x + s.w / 2 - x, s.y + s.h / 2 - y);
    if (d < T * 4.5) hurtSoldier(s, 140 * (1 - d / (T * 5)), (s.x > x ? 1 : -1) * 250);
  }
  const bd = Math.hypot(boss.x + boss.w / 2 - x, boss.y + boss.h / 2 - y);
  if (bd < T * 5) hurtBoss(140 * (1 - bd / (T * 5.5)));
  const p = player, d = Math.hypot(p.x + p.w / 2 - x, p.y + p.h / 2 - y);
  if (d < T * 4.5) { p.hp -= Math.round(45 * (1 - d / (T * 5))); p.hurt = .3; }
}

function updateBullets(dt) {
  const p = player;
  for (const b of bullets) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 8)), sdt = dt / steps;
    for (let i = 0; i < steps && b.life > 0; i++) {
      b.x += b.vx * sdt; b.y += b.vy * sdt;
      if (SOLID(tile(Math.floor(b.x / T), Math.floor(b.y / T)))) { b.life = 0; burst(b.x, b.y, "#aaa", 2); break; }
      if (b.fr) {
        if (boss.active && !boss.dead && b.x > boss.x && b.x < boss.x + boss.w && b.y > boss.y && b.y < boss.y + boss.h) { hurtBoss(b.dmg); b.life = 0; break; }
        for (const s of soldiers) if (s.hp > 0 && b.x > s.x && b.x < s.x + s.w && b.y > s.y && b.y < s.y + s.h) { hurtSoldier(s, b.dmg, Math.sign(b.vx) * 90); b.life = 0; break; }
      } else if (b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) {
        p.hp -= b.dmg; p.hurt = .2; b.life = 0; burst(b.x, b.y, "#b11", 6);
      }
    }
    b.life -= dt;
  }
  bullets = bullets.filter(b => b.life > 0);

  for (const d of dyn) {
    d.fuse -= dt; d.vy += 900 * dt;
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
    if (SOLID(tile(Math.floor(nx / T), Math.floor(d.y / T)))) d.vx *= -.4; else d.x = nx;
    if (SOLID(tile(Math.floor(d.x / T), Math.floor(ny / T)))) { d.vy *= -.35; d.vx *= .7; } else d.y = ny;
    if (Math.random() < .5) parts.push({ x: d.x + 3, y: d.y - 8, vx: rnd(-20, 20), vy: rnd(-60, -20), life: .25, c: "#ffd34d" });
    if (d.fuse <= 0) { explode(d.x, d.y); d.done = true; }
  }
  dyn = dyn.filter(d => !d.done);

  for (const d of bombs) {
    d.fuse -= dt; d.vy += 900 * dt;
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
    if (SOLID(tile(Math.floor(nx / T), Math.floor(d.y / T)))) d.vx *= -.4; else d.x = nx;
    if (SOLID(tile(Math.floor(d.x / T), Math.floor(ny / T)))) { d.vy *= -.35; d.vx *= .7; } else d.y = ny;
    if (d.fuse <= 0 || Math.hypot(p.x + p.w / 2 - d.x, p.y + p.h / 2 - d.y) < 22) { explodeBomb(d.x, d.y); d.done = true; }
  }
  bombs = bombs.filter(d => !d.done);

  for (const it of items) {
    it.vy = Math.min(it.vy + 1500 * dt, it.drop ? 110 : 600);
    if (!SOLID(tile(Math.floor((it.x + 6) / T), Math.floor((it.y + 12 + it.vy * dt) / T)))) it.y += it.vy * dt; else it.vy = 0;
    if (Math.abs(it.x - p.x) < 22 && Math.abs(it.y - p.y - 15) < 30) {
      if (it.kind === "bread") p.hp = Math.min(100, p.hp + 25);
      else if (it.kind === "med") { p.meds++; toast("Medkit picked up (press H)"); }
      else { const g = it.gun || randomGun(); toast("+" + giveAmmo(g, it.big ? 2 : 1) + " " + WEAP[g].name + " ammo"); }
      it.got = true;
    }
  }
  items = items.filter(i => !i.got);
  for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 600 * dt; q.life -= dt; }
  parts = parts.filter(q => q.life > 0);
  shake = Math.max(0, shake - dt * 30); toastT -= dt;
}

/* ---------- üzenetek ---------- */
function win() {
  if (state !== "play") return;
  state = "won";
  showMsg("You are free! 🎉", "You defeated the Mine Lord and escaped the mine.<br>Time: <b>" + fmtTime(runTime) + "</b> · Diamonds left: " + player.dia, "New game");
}
function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return String(m).padStart(2, "0") + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
}
function showMsg(h, p, b) {
  const m = document.getElementById("msg");
  m.innerHTML = "<h1>" + h + "</h1><p>" + p + "</p><button id='start'>" + b + "</button>";
  m.classList.remove("hidden");
  document.getElementById("start").onclick = begin;
}
function begin() { document.getElementById("msg").classList.add("hidden"); reset(); }

/* ---------- rajzolás ---------- */
const MAINCTX = ctx;
function drawWeapon(n, target) {
  const ctx = target || MAINCTX;
  const r = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  switch (n) {
    case "pick": r("#8a5a2b", 0, -1, 20, 3); r("#c9c9d0", 16, -8, 4, 16); r("#888", 16, -8, 4, 2); break;
    case "pistol": r("#222", 0, -3, 11, 4); r("#3a2a1a", 1, 1, 4, 6); break;
    case "rifle": r("#6b4423", -2, -2, 8, 5); r("#333", 6, -3, 16, 4); r("#222", 22, -2, 9, 2); break;
    case "shotgun": r("#6b4423", -2, -2, 9, 5); r("#444", 7, -3, 22, 3); r("#6b4423", 12, 0, 9, 3); break;
    case "smg": r("#222", 0, -3, 15, 5); r("#111", 4, 2, 3, 8); r("#333", 15, -2, 7, 2); break;
    case "sniper": r("#4a3a22", -2, -2, 9, 4); r("#2a2a2a", 7, -2, 28, 3); r("#000", 10, -6, 10, 3); break;
    case "heavy": r("#222", -2, -5, 9, 11); r("#555", 7, -4, 22, 3); r("#666", 7, -1, 22, 3); r("#555", 7, 2, 22, 3); break;
    case "dynamite": r("#c22", 0, -3, 9, 6); r("#fff", 3, -3, 2, 6); break;
  }
}
function weaponTip(n) { return { pick: 20, pistol: 12, rifle: 31, shotgun: 29, smg: 22, sniper: 35, heavy: 29 }[n] || 12; }

function drawPerson(e, o) {
  const cx = e.x - cam.x + e.w / 2, top = e.y - cam.y, h = e.h, w = e.w, face = Math.cos(o.aim) >= 0 ? 1 : -1;
  const mv = Math.abs(e.vx) > 5 ? 1 : 0, sw = Math.sin(o.ph) * 5 * mv;
  const col = o.flash ? "#fff" : null;
  ctx.fillStyle = col || o.pants; ctx.fillRect(cx - w / 2 + 2 + sw, top + h - 16, 6, 16); ctx.fillRect(cx + w / 2 - 8 - sw, top + h - 16, 6, 16);
  ctx.fillStyle = "#111"; ctx.fillRect(cx - w / 2 + 2 + sw + (face > 0 ? 0 : -1), top + h - 4, 7, 4); ctx.fillRect(cx + w / 2 - 8 - sw + (face > 0 ? 0 : -1), top + h - 4, 7, 4);
  ctx.fillStyle = col || o.body; ctx.fillRect(cx - w / 2, top + 12, w, h - 26);
  ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(cx - w / 2, top + 12, 3, h - 26);
  ctx.fillStyle = o.belt; ctx.fillRect(cx - w / 2, top + h - 18, w, 3);
  if (o.slave) { ctx.fillStyle = "#4a3a2a"; ctx.fillRect(cx - w / 2 + 3, top + 18, 4, 6); ctx.fillRect(cx + 1, top + 24, 5, 4); ctx.fillStyle = "#888"; ctx.fillRect(cx - 2, top + 14, 4, 2); }
  else { ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(cx - w / 2 + 2, top + 16, w - 4, 2); }
  ctx.fillStyle = col || o.skin; ctx.fillRect(cx - 5, top, 10, 12);
  ctx.fillStyle = col || o.hat;
  if (o.slave) { ctx.fillRect(cx - 5, top, 10, 3); ctx.fillStyle = "#a22"; ctx.fillRect(cx - 5, top + 2, 10, 2); }
  else { ctx.fillRect(cx - 6, top - 3, 12, 6); ctx.fillRect(face > 0 ? cx : cx - 8, top + 2, 8, 2); }
  ctx.fillStyle = "#000"; ctx.fillRect(cx + face * 2 - 1, top + 5, 2, 2);
  ctx.save(); ctx.translate(cx, top + 20);
  let a = o.aim;
  if (o.weapon === "pick" && o.swing > 0) a += face * (-1.4 + (.3 - o.swing) * 9.3);
  if (o.weapon === "pick" && o.mining) a += Math.sin(time * 22) * .6;
  ctx.rotate(a); if (face < 0) ctx.scale(1, -1);
  ctx.fillStyle = col || o.skin; ctx.fillRect(0, -2, 9, 4);
  ctx.translate(8, 0); drawWeapon(o.weapon);
  if (o.muzzle) { ctx.fillStyle = "#ffe27a"; ctx.beginPath(); ctx.arc(weaponTip(o.weapon) - 8, 0, 6, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(weaponTip(o.weapon) - 8, 0, 3, 0, 7); ctx.fill(); }
  ctx.restore();
}

function drawBackdrop() {
  const base = SURF * T - cam.y;
  if (base < -50) return;
  const g = ctx.createLinearGradient(0, 0, 0, Math.max(60, base));
  g.addColorStop(0, "#4aa3e8"); g.addColorStop(1, "#bfe6ff");
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = "#fff3a8"; ctx.beginPath(); ctx.arc(VW - 150 - cam.x * .05, base - 230, 34, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 6; i++) {
    const x = ((i * 260 + time * 8 - cam.x * .4) % (VW + 300) + VW + 300) % (VW + 300) - 150, y = base - 160 - (i % 3) * 40;
    ctx.beginPath(); ctx.ellipse(x, y, 50, 14, 0, 0, 7); ctx.ellipse(x + 28, y - 8, 30, 14, 0, 0, 7); ctx.ellipse(x - 28, y - 4, 28, 11, 0, 0, 7); ctx.fill();
  }
  for (const [col, par, amp] of [["#7d9ab5", .25, 90], ["#4f7a58", .5, 55]]) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, base + 2);
    for (let x = 0; x <= VW; x += 12) { const wx = x + cam.x * par; ctx.lineTo(x, base - 10 - amp * (.5 + .3 * Math.sin(wx * .008) + .2 * Math.sin(wx * .021 + 1))); }
    ctx.lineTo(VW, base + 2); ctx.fill();
  }
  for (const t of trees) {
    const x = t.x - cam.x; if (x < -60 || x > VW + 60) continue;
    ctx.fillStyle = "#5a3a1e"; ctx.fillRect(x - 5, base - t.h, 10, t.h);
    ctx.fillStyle = "#2f7d2f"; for (const [dx, dy, r] of [[0, -t.h, 24], [-16, -t.h + 12, 18], [16, -t.h + 12, 18]]) { ctx.beginPath(); ctx.arc(x + dx, base + dy, r, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#3f9b3f"; ctx.beginPath(); ctx.arc(x - 5, base - t.h - 6, 12, 0, 7); ctx.fill();
  }
  const sx = (W - 8) * T - cam.x - 70;
  ctx.fillStyle = "#6b4423"; ctx.fillRect(sx + 28, base - 40, 5, 40); ctx.fillStyle = "#a9773f"; ctx.fillRect(sx, base - 56, 62, 22);
  ctx.fillStyle = "#2a1a0a"; ctx.font = "bold 12px Segoe UI"; ctx.fillText("EXIT →", sx + 4, base - 40);
}

function drawChest(c) {
  const x = c.tx * T - cam.x, y = c.ty * T - cam.y + T;
  ctx.fillStyle = "#6b3f1a"; ctx.fillRect(x + 1, y - 13, 22, 13);
  ctx.fillStyle = "#8a5424"; ctx.fillRect(x + 1, y - 13, 22, 4);
  ctx.fillStyle = "#e0b43c"; ctx.fillRect(x + 1, y - 8, 22, 2); ctx.fillRect(x + 10, y - 9, 4, 5);
  ctx.strokeStyle = "#3a2210"; ctx.strokeRect(x + 1.5, y - 12.5, 21, 12);
  if (c.open) { ctx.fillStyle = "#1a1008"; ctx.fillRect(x + 2, y - 12, 20, 5); ctx.fillStyle = "#8a5424"; ctx.fillRect(x + 1, y - 20, 22, 5); }
}

function draw() {
  const p = player;
  cam.x = Math.max(0, Math.min(W * T - VW, p.x + p.w / 2 - VW / 2));
  cam.y = Math.max(0, Math.min(H * T - VH, p.y + p.h / 2 - VH / 2));
  ctx.fillStyle = "#1a1410"; ctx.fillRect(0, 0, VW, VH);
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-shake, shake) * .5, rnd(-shake, shake) * .5);
  drawBackdrop();
  const x0 = Math.floor(cam.x / T), y0 = Math.floor(cam.y / T);
  for (let ty = y0; ty <= y0 + VH / T + 1; ty++) for (let tx = x0; tx <= x0 + VW / T + 1; tx++) {
    const t = tile(tx, ty), sx = tx * T - cam.x | 0, sy = ty * T - cam.y | 0, v = (tx * 7 + ty * 13) & 3;
    if (t === AIR || t === LADDER) {
      if (ty > SURF) ctx.drawImage(TEX[WALL][v], sx, sy);
      if (t === LADDER) {
        ctx.fillStyle = "#a9773f"; ctx.fillRect(sx + 4, sy, 3, T); ctx.fillRect(sx + T - 7, sy, 3, T);
        ctx.fillStyle = "#c79a5a"; for (let r = 3; r < T; r += 8) ctx.fillRect(sx + 4, sy + r, T - 8, 3);
      } else if (ty >= 0 && ty < H && tx >= 0 && tx < W && deco[ty][tx]) {
        ctx.fillStyle = "#5a3a1e";
        if (deco[ty][tx] === 1) { ctx.fillRect(sx + 9, sy, 6, T); ctx.fillStyle = "#7a5230"; ctx.fillRect(sx + 9, sy, 2, T); }
        if (deco[ty][tx] === 2) { ctx.fillStyle = "#6b4423"; ctx.fillRect(sx - T, sy, T * 3, 7); ctx.fillStyle = "#8a5a2b"; ctx.fillRect(sx - T, sy, T * 3, 2); }
      }
      continue;
    }
    ctx.drawImage(TEX[t][v], sx, sy);
    if (t === DIAM && (tx + ty + Math.floor(time * 3)) % 6 === 0) { ctx.fillStyle = "#fff"; ctx.fillRect(sx + 11, sy + 4, 2, 6); ctx.fillRect(sx + 9, sy + 6, 6, 2); }
  }
  for (const tc of torches) {
    const x = tc.x - cam.x, y = tc.y - cam.y; if (x < -20 || x > VW + 20 || y < -20 || y > VH + 20) continue;
    ctx.fillStyle = "#5a3a1e"; ctx.fillRect(x - 2, y, 4, 12);
    const f = 5 + Math.sin(time * 12 + tc.ph) * 1.5;
    ctx.fillStyle = "#ff8a1c"; ctx.beginPath(); ctx.ellipse(x, y - 2, 4, f, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffe27a"; ctx.beginPath(); ctx.ellipse(x, y - 1, 2, f * .55, 0, 0, 7); ctx.fill();
  }
  if (mining.p > 0) { ctx.fillStyle = "rgba(0,0,0," + mining.p * .6 + ")"; ctx.fillRect(mining.x * T - cam.x, mining.y * T - cam.y, T, T); }
  const mx = Math.floor((mouse.x + cam.x) / T), my = Math.floor((mouse.y + cam.y) / T);
  if (p.sel === "pick") { ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.strokeRect(mx * T - cam.x, my * T - cam.y, T, T); }

  for (const c of chests) {
    drawChest(c);
    if (!c.open && Math.hypot(c.tx * T + T / 2 - (p.x + p.w / 2), c.ty * T + T / 2 - (p.y + p.h / 2)) < 48) {
      ctx.fillStyle = "#fff"; ctx.font = "bold 13px Segoe UI"; ctx.textAlign = "center"; ctx.fillText("E – open", c.tx * T + T / 2 - cam.x, c.ty * T - cam.y - 6); ctx.textAlign = "left";
    }
  }
  for (const it of items) {
    const x = it.x - cam.x, y = it.y - cam.y;
    if (it.drop && it.vy > 100) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + 7, y - 16, 16, Math.PI, 0); ctx.fill(); ctx.strokeStyle = "#ddd"; ctx.beginPath(); ctx.moveTo(x - 9, y - 16); ctx.lineTo(x + 7, y); ctx.lineTo(x + 23, y - 16); ctx.stroke(); }
    if (it.kind === "med") { ctx.fillStyle = "#f4f4f4"; ctx.fillRect(x - 1, y - 3, 16, 14); ctx.strokeStyle = "#999"; ctx.strokeRect(x - .5, y - 2.5, 15, 13); ctx.fillStyle = "#d22"; ctx.fillRect(x + 5, y, 4, 9); ctx.fillRect(x + 2, y + 3, 10, 3); }
    else if (it.kind === "bread") { ctx.fillStyle = "#e0a96d"; ctx.fillRect(x, y, 14, 10); ctx.fillStyle = "#b9783a"; ctx.fillRect(x, y + 6, 14, 4); ctx.fillStyle = "#fff"; ctx.fillRect(x + 3, y + 2, 8, 2); }
    else { ctx.fillStyle = "#3d5a2e"; ctx.fillRect(x, y, 14, 10); ctx.fillStyle = "#e0b43c"; ctx.fillRect(x + 3, y + 2, 2, 6); ctx.fillRect(x + 7, y + 2, 2, 6); ctx.fillRect(x + 11, y + 2, 2, 6); }
  }
  for (const s of soldiers) {
    const D = TYPES[s.type];
    if (s.aimT !== null) {
      ctx.strokeStyle = "rgba(255,40,40," + (.4 + (D.laser - s.aimT) * .6) + ")"; ctx.beginPath();
      ctx.moveTo(s.x + s.w / 2 - cam.x, s.y + 20 - cam.y); ctx.lineTo(p.x + p.w / 2 - cam.x, p.y + p.h / 2 - cam.y); ctx.stroke();
    }
    drawPerson(s, { body: D.col, pants: D.pants, hat: D.hat, skin: "#c9a37a", belt: "#222", aim: s.aim, weapon: D.gun, flash: s.flash > 0, ph: s.ph, muzzle: s.mz > 0 });
    if (s.hp < s.maxhp) { ctx.fillStyle = "#400"; ctx.fillRect(s.x - cam.x - 2, s.y - cam.y - 10, s.w + 4, 4); ctx.fillStyle = "#e33"; ctx.fillRect(s.x - cam.x - 2, s.y - cam.y - 10, (s.w + 4) * s.hp / s.maxhp, 4); }
  }
  drawBoss();
  for (const d of bombs) { ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(d.x - cam.x, d.y - cam.y, 7, 0, 7); ctx.fill(); ctx.fillStyle = Math.sin(time * 30) > 0 ? "#f33" : "#ff0"; ctx.fillRect(d.x - cam.x - 1, d.y - cam.y - 11, 3, 4); }
  drawPerson(p, { body: "#9a7c4e", pants: "#5b4a33", hat: "#8a6a3f", skin: "#d9b08c", belt: "#3a2a1a", slave: true, aim: p.aim, weapon: p.sel, flash: p.hurt > 0, ph: p.ph, muzzle: p.muzzle > 0, swing: p.swing, mining: p.mining });
  if (p.swing > 0) {
    ctx.strokeStyle = "rgba(255,255,255," + p.swing * 2.5 + ")"; ctx.lineWidth = 3; ctx.beginPath();
    ctx.arc(p.x + p.w / 2 - cam.x, p.y + 20 - cam.y, 36, p.dir > 0 ? -1.2 : Math.PI - 1.0, p.dir > 0 ? 1.0 : Math.PI + 1.2); ctx.stroke(); ctx.lineWidth = 1;
  }
  for (const b of bullets) {
    ctx.strokeStyle = b.fr ? "#fff6b0" : "#ff7a3a"; ctx.lineWidth = 2; ctx.beginPath();
    const l = Math.hypot(b.vx, b.vy); ctx.moveTo(b.x - cam.x, b.y - cam.y); ctx.lineTo(b.x - cam.x - b.vx / l * 9, b.y - cam.y - b.vy / l * 9); ctx.stroke(); ctx.lineWidth = 1;
  }
  for (const d of dyn) { ctx.fillStyle = "#c22"; ctx.fillRect(d.x - cam.x - 3, d.y - cam.y - 7, 6, 14); ctx.fillStyle = "#fff"; ctx.fillRect(d.x - cam.x - 3, d.y - cam.y - 2, 6, 2); }
  for (const q of parts) { ctx.fillStyle = q.c; ctx.fillRect(q.x - cam.x, q.y - cam.y, 3, 3); }

  const depth = Math.max(0, Math.min(1, (p.y / T - SURF) / 25));
  const dark = Math.max(0, Math.min(1, (p.y / T - SURF + 2) / 6)) * (.4 + depth * .55);
  ctx.globalCompositeOperation = "lighter";
  for (const tc of torches) {
    const x = tc.x - cam.x, y = tc.y - cam.y; if (x < -160 || x > VW + 160 || y < -160 || y > VH + 160) continue;
    const g = ctx.createRadialGradient(x, y, 2, x, y, 120); g.addColorStop(0, "rgba(255,150,40,.28)"); g.addColorStop(1, "rgba(255,150,40,0)");
    ctx.fillStyle = g; ctx.fillRect(x - 120, y - 120, 240, 240);
  }
  ctx.globalCompositeOperation = "source-over";
  if (dark > 0) {
    dctx.globalCompositeOperation = "source-over"; dctx.clearRect(0, 0, VW, VH);
    dctx.fillStyle = "rgba(0,0,0," + dark + ")"; dctx.fillRect(0, 0, VW, VH);
    dctx.globalCompositeOperation = "destination-out";
    const hole = (x, y, r, a) => { const g = dctx.createRadialGradient(x, y, r * .15, x, y, r); g.addColorStop(0, "rgba(0,0,0," + a + ")"); g.addColorStop(1, "rgba(0,0,0,0)"); dctx.fillStyle = g; dctx.fillRect(x - r, y - r, r * 2, r * 2); };
    hole(p.x + p.w / 2 - cam.x, p.y + 15 - cam.y, 250, 1);
    for (const tc of torches) { const x = tc.x - cam.x, y = tc.y - cam.y; if (x > -170 && x < VW + 170 && y > -170 && y < VH + 170) hole(x, y, 150 + Math.sin(time * 10 + tc.ph) * 6, .9); }
    ctx.drawImage(dk, 0, 0);
  }
  ctx.restore();
  if (p.hurt > 0) { ctx.fillStyle = "rgba(200,0,0," + p.hurt * 1.2 + ")"; ctx.fillRect(0, 0, VW, VH); }
  if (toastT > 0) { ctx.globalAlpha = Math.min(1, toastT); ctx.fillStyle = "#fff"; ctx.font = "bold 18px Segoe UI"; ctx.textAlign = "center"; ctx.shadowColor = "#000"; ctx.shadowBlur = 4; ctx.fillText(toastTxt, VW / 2, 70); ctx.shadowBlur = 0; ctx.textAlign = "left"; ctx.globalAlpha = 1; }
  if (boss.active && !boss.dead) {
    const bw = 460, bx0 = (VW - bw) / 2;
    ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fillRect(bx0 - 3, 14, bw + 6, 22);
    ctx.fillStyle = "#400"; ctx.fillRect(bx0, 17, bw, 16);
    ctx.fillStyle = boss.phase === 3 ? "#ff3030" : boss.phase === 2 ? "#e0702a" : "#c23030"; ctx.fillRect(bx0, 17, bw * boss.hp / boss.maxhp, 16);
    ctx.fillStyle = "#fff"; ctx.font = "bold 13px Segoe UI"; ctx.textAlign = "center"; ctx.fillText("THE MINE LORD – " + Math.ceil(boss.hp), VW / 2, 30); ctx.textAlign = "left";
  }
  updateHud();
}

let lastHud = "";
const $ = id => document.getElementById(id);
function updateHud() {
  const p = player;
  $("hp").textContent = Math.max(0, p.hp);
  $("dia").textContent = p.dia;
  $("stone").textContent = p.stone;
  $("depth").textContent = Math.max(0, Math.round(p.y / T - SURF));
  $("timer").textContent = fmtTime(runTime);
  const cd = p.dashCd;
  $("dash").classList.toggle("ready", cd <= 0);
  $("dashfill").style.width = (cd > 0 ? (1 - cd / DASH_CD) * 100 : 100) + "%";
  $("dashtxt").textContent = cd > 0 ? cd.toFixed(1) + "s" : "READY";
  let h = "";
  ORDER.forEach((n, i) => {
    const own = p.own[n], ammo = p.ammo[n];
    h += "<div class='slot" + (p.sel === n ? " sel" : "") + (own ? "" : " locked") + "'><span class='key'>" + (i + 1) + "</span><img src='" + ICON[n] + "'>" +
      (n === "pick" ? "" : "<span class='cnt'>" + ammo + "</span>") + "<span class='lbl'>" + WEAP[n].name + "</span></div>";
  });
  h += "<div class='sep'></div><div class='slot med" + (p.meds ? "" : " locked") + "'><span class='key'>H</span><span class='medic'>+</span><span class='cnt'>" + p.meds + "</span><span class='lbl'>Medkit</span></div>";
  if (h !== lastHud) { $("weapons").innerHTML = h; lastHud = h; }
}

/* ---------- ciklus és bemenet ---------- */
let last = 0, runTime = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const raw = Math.min(0.1, (ts - last) / 1000 || 0), dt = Math.min(0.033, raw); last = ts;
  if ((state === "play" || state === "shop") && boss && !boss.dead) runTime += raw;
  if (state === "play") { time += dt; updatePlayer(dt); updateSoldiers(dt); updateBoss(dt); updateBullets(dt); }
  if (player) draw();
}
addEventListener("keydown", e => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (state === "shop") {
    if (k === "e" || k === "escape") closeShop();
    return;
  }
  if (state !== "play") return;
  if (k === "f") attack();
  if (k === "q") dash();
  if (k === "h") useMedkit();
  if (k === "e" && !openNearChest()) openShop();
  if (k >= "1" && k <= "6") selectWeapon(ORDER[+k - 1]);
  if ([" ", "arrowup", "arrowdown"].includes(k)) e.preventDefault();
});
addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
cv.addEventListener("wheel", e => {
  if (state !== "play") return;
  const own = ORDER.filter(n => player.own[n]); let i = own.indexOf(player.sel);
  i = (i + (e.deltaY > 0 ? 1 : -1) + own.length) % own.length; player.sel = own[i]; e.preventDefault();
}, { passive: false });
cv.addEventListener("mousemove", e => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
cv.addEventListener("mousedown", e => { if (e.button === 0) mouse.left = true; if (e.button === 2) mouse.right = true; });
addEventListener("mouseup", e => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
cv.addEventListener("contextmenu", e => e.preventDefault());
document.getElementById("start").onclick = begin;
buildIcons();
requestAnimationFrame(loop);
