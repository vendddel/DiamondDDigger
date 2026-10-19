(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const TILE = 32;
  const MAP_W = 96;
  const MAP_H = 68;
  const WORLD_W = MAP_W * TILE;
  const WORLD_H = MAP_H * TILE;
  const VIEW_W = canvas.width;
  const VIEW_H = canvas.height;
  const floors = [64, 50, 36, 22];
  const ladders = [12, 32, 52, 72];
  const weapons = [
    { name: "PICKAXE", icon: "⛏", key: "6", kind: "melee" },
    { name: "PISTOL", icon: "⌁", key: "1", kind: "gun", damage: 12, speed: 500, rate: 0.26, pellets: 1, ammo: "pistol" },
    { name: "SHOTGUN", icon: "▰", key: "2", kind: "gun", damage: 9, speed: 420, rate: 0.72, pellets: 5, spread: 0.22, ammo: "shotgun" },
    { name: "SMG", icon: "≋", key: "3", kind: "gun", damage: 5, speed: 560, rate: 0.09, pellets: 1, ammo: "smg" },
    { name: "RIFLE", icon: "╱", key: "4", kind: "gun", damage: 30, speed: 800, rate: 0.64, pellets: 1, ammo: "rifle" },
    { name: "DYNAMITE", icon: "✦", key: "5", kind: "explosive", rate: 0.85, ammo: "dynamite" }
  ];
  const enemyInfo = {
    rifleman: { hp: 34, speed: 52, range: 460, rate: 1.45, color: "#71865c", damage: 8 },
    shotgunner: { hp: 48, speed: 62, range: 205, rate: 1.35, color: "#a96e42", damage: 7 },
    gunner: { hp: 54, speed: 48, range: 375, rate: 1.8, color: "#657a91", damage: 5 },
    sniper: { hp: 36, speed: 34, range: 720, rate: 2.65, color: "#84739a", damage: 22 },
    heavy: { hp: 118, speed: 25, range: 440, rate: 1.7, color: "#6f7475", damage: 7 }
  };
  const tiles = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));
  const tileDamage = new Map();
  let randomState = 28719;
  const random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 4294967296;
  };

  let player;
  let enemies;
  let bullets;
  let explosives;
  let drops;
  let chests;
  let torches;
  let particles;
  let boss;
  let started = false;
  let ended = false;
  let won = false;
  let camera = { x: 0, y: 0 };
  let keys = new Set();
  let pressed = new Set();
  let mouse = { x: 0, y: 0, down: false, rightDown: false };
  let gameTime = 0;
  let lastFrame = 0;
  let hint = "Find a ladder shaft and keep climbing.";
  let hintTimer = 0;
  let attackCooldown = 0;
  let pickaxeCooldown = 0;
  let invulnerable = 0;
  let bossSpawnTimer = 14;
  let airdropTimer = 8;
  let screenShake = 0;

  const ui = {
    start: document.querySelector("#startScreen"),
    end: document.querySelector("#endScreen"),
    endKicker: document.querySelector("#endKicker"),
    endTitle: document.querySelector("#endTitle"),
    endMessage: document.querySelector("#endMessage"),
    healthFill: document.querySelector("#healthFill"),
    healthText: document.querySelector("#healthText"),
    depth: document.querySelector("#depthText"),
    diamonds: document.querySelector("#diamondText"),
    stone: document.querySelector("#stoneText"),
    weapon: document.querySelector("#weaponText"),
    ammo: document.querySelector("#ammoText"),
    hint: document.querySelector("#hintText"),
    hotbar: document.querySelector("#hotbar"),
    help: document.querySelector("#helpBackdrop")
  };

  function setTile(x, y, value) {
    if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) tiles[y][x] = value;
  }

  function generateWorld() {
    for (let y = 10; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        const depth = y / MAP_H;
        const roll = random();
        setTile(x, y, roll < 0.018 ? 3 : roll < 0.2 + depth * 0.2 ? 2 : 1);
      }
    }
    for (let x = 0; x < MAP_W; x++) {
      setTile(x, MAP_H - 1, 7);
      setTile(x, 10, x === 0 || x === MAP_W - 1 ? 7 : 2);
    }
    for (let y = 0; y < MAP_H; y++) {
      setTile(0, y, 7);
      setTile(MAP_W - 1, y, 7);
    }
    for (let y = 0; y < 10; y++) {
      for (let x = 1; x < MAP_W - 1; x++) setTile(x, y, 0);
    }

    floors.forEach((floor, level) => {
      const ground = level === 0 ? 2 : 1;
      for (let x = 1; x < MAP_W - 1; x++) {
        for (let y = floor - 4; y < floor; y++) setTile(x, y, 0);
        setTile(x, floor, x % 9 === 0 ? 4 : ground);
      }
      for (let x = 6 + level * 3; x < MAP_W - 5; x += 15) {
        const pocketY = floor - 8;
        if (pocketY > floors[Math.min(level + 1, floors.length - 1)] + 2) continue;
        for (let px = x; px < Math.min(x + 5, MAP_W - 2); px++) {
          for (let py = pocketY; py < pocketY + 2; py++) setTile(px, py, 0);
        }
      }
    });

    for (let level = 0; level < floors.length - 1; level++) {
      const x = ladders[level];
      const top = floors[level + 1] - 4;
      const bottom = floors[level];
      for (let y = top; y <= bottom; y++) {
        setTile(x, y, 5);
        if (y < bottom) setTile(x - 1, y, 0);
      }
    }
    const surfaceLadder = ladders[3] + 10;
    for (let y = 10; y <= floors[3]; y++) {
      setTile(surfaceLadder, y, 5);
      if (y < floors[3]) setTile(surfaceLadder - 1, y, 0);
    }

    torches = [];
    floors.forEach((floor, level) => {
      for (let x = 8 + (level % 2) * 5; x < MAP_W - 4; x += 14) {
        torches.push({ x: x * TILE + TILE / 2, y: (floor - 3) * TILE + 8 });
      }
    });
    for (let x = 15; x < MAP_W - 5; x += 19) torches.push({ x: x * TILE, y: 7 * TILE });

    return surfaceLadder;
  }

  let surfaceLadder;

  function addEnemy(type, x, floor) {
    const info = enemyInfo[type];
    enemies.push({
      type, x: x * TILE, y: floor * TILE - 29, w: 23, h: 29,
      hp: info.hp, maxHp: info.hp, facing: -1, vx: 0, vy: 0,
      cooldown: 0.8 + random() * 1.2, burst: 0, burstTimer: 0,
      aim: 0, patrol: x * TILE, onGround: false, dead: false
    });
  }

  function resetGame() {
    randomState = 28719;
    tiles.forEach(row => row.fill(0));
    surfaceLadder = generateWorld();
    enemies = [];
    bullets = [];
    explosives = [];
    drops = [];
    particles = [];
    tileDamage.clear();
    gameTime = 0;
    camera = { x: 0, y: 0 };
    boss = { x: 88 * TILE, y: 8 * TILE - 49, w: 48, h: 49, hp: 420, maxHp: 420, phase: 1, cooldown: 2.5, burst: 0, burstTimer: 0, jump: 0, vy: 0, facing: -1, dead: false };
    player = {
      x: 4 * TILE, y: floors[0] * TILE - 30, w: 22, h: 30, vx: 0, vy: 0,
      hp: 100, maxHp: 100, diamonds: 0, stone: 4, facing: 1, onGround: false,
      weapon: 0, owned: new Set([0, 1]), ammo: { pistol: 36, shotgun: 0, smg: 0, rifle: 0, dynamite: 0 }
    };
    [
      ["rifleman", 23, floors[0]], ["shotgunner", 43, floors[0]], ["gunner", 66, floors[0]],
      ["rifleman", 18, floors[1]], ["sniper", 57, floors[1]],
      ["heavy", 23, floors[2]], ["sniper", 63, floors[2]],
      ["gunner", 27, floors[3]], ["heavy", 58, floors[3]]
    ].forEach(args => addEnemy(...args));
    chests = [
      { x: 8 * TILE, y: floors[0] * TILE - 25, reward: "shotgun", opened: false },
      { x: 25 * TILE, y: floors[1] * TILE - 25, reward: "smg", opened: false },
      { x: 39 * TILE, y: floors[2] * TILE - 25, reward: "rifle", opened: false },
      { x: 42 * TILE, y: floors[3] * TILE - 25, reward: "dynamite", opened: false }
    ];
    drops.push({ type: "bread", x: 16 * TILE, y: floors[0] * TILE - 50, vy: 0, parachute: false });
    started = false;
    ended = false;
    won = false;
    attackCooldown = 0;
    pickaxeCooldown = 0;
    invulnerable = 0;
    bossSpawnTimer = 14;
    airdropTimer = 8;
    hint = "Find a ladder shaft and keep climbing.";
    updateHud();
    drawHotbar();
  }

  function tileAt(x, y) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return 7;
    return tiles[ty][tx];
  }

  function solid(tile) {
    return tile >= 1 && tile <= 4 || tile === 7;
  }

  function collides(x, y, w, h) {
    const left = Math.floor(x / TILE);
    const right = Math.floor((x + w - 1) / TILE);
    const top = Math.floor(y / TILE);
    const bottom = Math.floor((y + h - 1) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (solid(tileAt(tx * TILE + TILE / 2, ty * TILE + TILE / 2))) return true;
      }
    }
    return false;
  }

  function moveBody(body, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
    const stepX = dx / steps;
    const stepY = dy / steps;
    body.onGround = false;
    for (let i = 0; i < steps; i++) {
      if (stepX) {
        if (!collides(body.x + stepX, body.y, body.w, body.h)) body.x += stepX;
        else body.vx = 0;
      }
      if (stepY) {
        if (!collides(body.x, body.y + stepY, body.w, body.h)) body.y += stepY;
        else {
          if (stepY > 0) body.onGround = true;
          body.vy = 0;
        }
      }
    }
  }

  function nearLadder(body) {
    const cx = body.x + body.w / 2;
    const cy = body.y + body.h / 2;
    for (let y = Math.floor((body.y - 2) / TILE); y <= Math.floor((body.y + body.h + 2) / TILE); y++) {
      const x = Math.round(cx / TILE);
      if (tileAt(x * TILE + TILE / 2, y * TILE + TILE / 2) === 5 && Math.abs(cx - (x + 0.5) * TILE) < 21) return x;
    }
    if (tileAt(cx, cy) === 5) return Math.floor(cx / TILE);
    return -1;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function setHint(text, duration = 3.2) {
    hint = text;
    hintTimer = duration;
    ui.hint.textContent = text;
  }

  function updateHud() {
    const health = Math.max(0, Math.ceil(player.hp));
    ui.healthText.textContent = health;
    ui.healthFill.style.width = `${Math.max(0, player.hp / player.maxHp * 100)}%`;
    ui.diamonds.textContent = player.diamonds;
    ui.stone.textContent = player.stone;
    const depth = player.y / TILE;
    ui.depth.textContent = depth < 12 ? "SURFACE" : depth > 55 ? "LEVEL 4" : depth > 41 ? "LEVEL 3" : depth > 27 ? "LEVEL 2" : "LEVEL 1";
    const weapon = weapons[player.weapon];
    ui.weapon.textContent = weapon.name;
    ui.ammo.textContent = weapon.kind === "melee" ? "∞" : player.ammo[weapon.ammo];
    for (const slot of ui.hotbar.children) {
      const index = Number(slot.dataset.index);
      slot.classList.toggle("selected", index === player.weapon);
      slot.classList.toggle("locked", !player.owned.has(index));
      const ammo = weapons[index].kind === "melee" ? "∞" : player.ammo[weapons[index].ammo];
      slot.querySelector(".slot-ammo").textContent = player.owned.has(index) ? ammo : "—";
    }
  }

  function drawHotbar() {
    ui.hotbar.replaceChildren();
    weapons.forEach((weapon, index) => {
      const button = document.createElement("button");
      button.className = "weapon-slot";
      button.dataset.index = index;
      button.type = "button";
      button.title = `${weapon.name} (${weapon.key})`;
      button.setAttribute("aria-label", `${weapon.name}, slot ${weapon.key}`);
      button.innerHTML = `<span class="slot-key">${weapon.key}</span><span class="slot-icon">${weapon.icon}</span><span class="slot-ammo"></span>`;
      button.addEventListener("click", () => selectWeapon(index));
      ui.hotbar.append(button);
    });
  }

  function selectWeapon(index) {
    if (!player.owned.has(index)) {
      setHint("Search a chest to find this weapon.");
      return;
    }
    player.weapon = index;
    updateHud();
  }

  function tileDistance(tx, ty) {
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    return Math.hypot((tx + 0.5) * TILE - px, (ty + 0.5) * TILE - py);
  }

  function mineTile(tx, ty) {
    if (tx < 1 || tx > MAP_W - 2 || ty < 0 || ty >= MAP_H - 1 || tileDistance(tx, ty) > TILE * 5.2) return;
    const tile = tiles[ty][tx];
    if (!solid(tile) || tile === 7) return;
    const key = `${tx},${ty}`;
    const damage = (tileDamage.get(key) || 0) + 1;
    const required = tile === 2 ? 3 : tile === 3 ? 2 : tile === 4 ? 2 : 1;
    if (damage < required) {
      tileDamage.set(key, damage);
      spawnParticles((tx + 0.5) * TILE, (ty + 0.5) * TILE, tile === 3 ? "#64d3d1" : "#a8865c", 3);
      return;
    }
    setTile(tx, ty, 0);
    tileDamage.delete(key);
    if (tile === 3) {
      player.diamonds++;
      drops.push({ type: "diamond", x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, vy: -45, parachute: false });
      setHint("Diamond mined! Keep it safe on the way out.", 2.2);
    } else if (tile === 2 || tile === 4) {
      player.stone++;
    }
    spawnParticles((tx + 0.5) * TILE, (ty + 0.5) * TILE, tile === 3 ? "#61d8d5" : tile === 2 ? "#9b8b76" : "#a77143", 7);
    updateHud();
  }

  function cursorWorld() {
    return { x: mouse.x + camera.x, y: mouse.y + camera.y };
  }

  function mineAtCursor() {
    const world = cursorWorld();
    const tx = Math.floor(world.x / TILE);
    const ty = Math.floor(world.y / TILE);
    mineTile(tx, ty);
  }

  function swingPickaxe() {
    if (pickaxeCooldown > 0) return;
    pickaxeCooldown = 0.38;
    const world = cursorWorld();
    let tx = Math.floor(world.x / TILE);
    let ty = Math.floor(world.y / TILE);
    if (!mouse.down || tileDistance(tx, ty) > TILE * 5.2) {
      tx = Math.floor((player.x + player.w / 2 + player.facing * TILE * 1.15) / TILE);
      ty = Math.floor((player.y + player.h * 0.72) / TILE);
    }
    mineTile(tx, ty);
  }

  function addBullet(x, y, vx, vy, owner, damage, color = "#f3d88a", size = 4) {
    bullets.push({ x, y, vx, vy, owner, damage, color, size, life: 2.5 });
  }

  function fireWeapon() {
    const weapon = weapons[player.weapon];
    if (weapon.kind === "melee") {
      swingPickaxe();
      return;
    }
    if (attackCooldown > 0) return;
    const ammo = player.ammo[weapon.ammo];
    if (ammo <= 0) {
      setHint(`Out of ${weapon.name.toLowerCase()} ammo. Look for a chest or supply drop.`, 2.4);
      attackCooldown = 0.5;
      return;
    }
    const aim = cursorWorld();
    const originX = player.x + player.w / 2;
    const originY = player.y + player.h * 0.48;
    const angle = Math.atan2(aim.y - originY, aim.x - originX);
    player.facing = Math.cos(angle) >= 0 ? 1 : -1;
    if (weapon.kind === "explosive") {
      explosives.push({ x: originX + player.facing * 10, y: originY, vx: Math.cos(angle) * 290, vy: Math.sin(angle) * 290 - 180, fuse: 1.5, owner: "player" });
    } else {
      for (let i = 0; i < weapon.pellets; i++) {
        const spread = (random() - 0.5) * (weapon.spread || 0.025);
        addBullet(originX, originY, Math.cos(angle + spread) * weapon.speed, Math.sin(angle + spread) * weapon.speed, "player", weapon.damage, weapon === weapons[1] ? "#f7d58b" : "#ffc979", weapon === weapons[4] ? 5 : 3);
      }
    }
    player.ammo[weapon.ammo]--;
    attackCooldown = weapon.rate;
    screenShake = Math.max(screenShake, weapon === weapons[2] ? 4 : 2);
    updateHud();
  }

  function placeBlock() {
    if (player.stone <= 0) {
      setHint("No stone blocks. Mine rock to collect some.");
      return;
    }
    const world = cursorWorld();
    const tx = Math.floor(world.x / TILE);
    const ty = Math.floor(world.y / TILE);
    if (tx < 1 || tx > MAP_W - 2 || ty < 1 || ty >= MAP_H - 1 || tileDistance(tx, ty) > TILE * 4.5) return;
    if (tiles[ty][tx] !== 0 || collides(player.x, player.y, player.w, player.h) && tx * TILE < player.x + player.w && (tx + 1) * TILE > player.x && ty * TILE < player.y + player.h && (ty + 1) * TILE > player.y) return;
    setTile(tx, ty, 2);
    player.stone--;
    updateHud();
  }

  function useChest() {
    const chest = chests.find(item => !item.opened && Math.hypot(item.x - player.x, item.y - player.y) < TILE * 2.1);
    if (!chest) {
      setHint("No chest nearby. Search along the tunnels.", 1.7);
      return;
    }
    chest.opened = true;
    const slot = weapons.findIndex(weapon => weapon.ammo === chest.reward);
    if (slot >= 0) {
      player.owned.add(slot);
      const weapon = weapons[slot];
      player.ammo[weapon.ammo] += chest.reward === "smg" ? 55 : chest.reward === "dynamite" ? 4 : chest.reward === "rifle" ? 18 : 12;
      player.weapon = slot;
      setHint(`${weapon.name} acquired! Ammo added to your pack.`, 4);
    }
    player.ammo.pistol += 8;
    player.diamonds += 1;
    drops.push({ type: "bread", x: chest.x + 12, y: chest.y - 20, vy: -80, parachute: false });
    updateHud();
  }

  function lineClear(x1, y1, x2, y2) {
    const distance = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(distance / 14);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (solid(tileAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t))) return false;
    }
    return true;
  }

  function enemyFire(enemy) {
    const info = enemyInfo[enemy.type];
    const startX = enemy.x + enemy.w / 2;
    const startY = enemy.y + enemy.h * 0.45;
    const targetX = player.x + player.w / 2;
    const targetY = player.y + player.h * 0.5;
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const shots = enemy.type === "shotgunner" ? 4 : enemy.type === "gunner" ? 1 : 1;
    for (let i = 0; i < shots; i++) {
      const spread = enemy.type === "shotgunner" ? (i - (shots - 1) / 2) * 0.16 : (random() - 0.5) * 0.04;
      const speed = enemy.type === "sniper" ? 560 : enemy.type === "shotgunner" ? 330 : 310;
      addBullet(startX, startY, Math.cos(angle + spread) * speed, Math.sin(angle + spread) * speed, "enemy", info.damage, enemy.type === "sniper" ? "#f34e49" : "#e99c64", enemy.type === "sniper" ? 5 : 3);
    }
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const info = enemyInfo[enemy.type];
      enemy.cooldown -= dt;
      enemy.facing = player.x < enemy.x ? -1 : 1;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.abs(dx);
      if (Math.abs(dy) < 88 && distance < info.range + 80) {
        const desired = enemy.type === "shotgunner" ? 118 : enemy.type === "heavy" ? 205 : enemy.type === "sniper" ? 370 : 245;
        if (distance > desired + 22) enemy.vx = Math.sign(dx) * info.speed;
        else if (distance < desired - 25 && enemy.type !== "sniper") enemy.vx = -Math.sign(dx) * info.speed * 0.72;
        else enemy.vx *= 0.8;
        if (distance < info.range && Math.abs(dy) < 72 && lineClear(enemy.x + enemy.w / 2, enemy.y + 12, player.x + player.w / 2, player.y + 12)) {
          if (enemy.type === "sniper") {
            enemy.aim += dt;
            if (enemy.aim >= 1.25 && enemy.cooldown <= 0) {
              enemyFire(enemy);
              enemy.cooldown = info.rate;
              enemy.aim = 0;
            }
          } else if (enemy.type === "gunner") {
            if (enemy.burst > 0 && enemy.burstTimer <= 0) {
              enemyFire(enemy);
              enemy.burst--;
              enemy.burstTimer = 0.14;
              if (!enemy.burst) enemy.cooldown = info.rate;
            } else if (enemy.cooldown <= 0 && enemy.burst <= 0) {
              enemy.burst = 3;
              enemy.burstTimer = 0;
            }
          } else if (enemy.cooldown <= 0) {
            enemyFire(enemy);
            enemy.cooldown = info.rate;
          }
        } else {
          enemy.aim = Math.max(0, enemy.aim - dt * 2);
        }
      } else {
        enemy.vx = Math.sin(gameTime * 0.8 + enemy.patrol) * 12;
        enemy.aim = 0;
      }
      enemy.burstTimer -= dt;
      enemy.vy = Math.min(500, enemy.vy + 900 * dt);
      moveBody(enemy, enemy.vx * dt, enemy.vy * dt);
    }
    enemies = enemies.filter(enemy => !enemy.dead);
  }

  function damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    spawnParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#e88d63", 4);
    if (enemy.hp <= 0) {
      enemy.dead = true;
      if (random() < 0.42) drops.push({ type: random() < 0.42 ? "bread" : "ammo", x: enemy.x, y: enemy.y, vy: -45, parachute: false });
      if (random() < 0.28) drops.push({ type: "diamond", x: enemy.x + 12, y: enemy.y - 4, vy: -35, parachute: false });
      setHint(`${enemy.type.toUpperCase()} down. Keep moving.`, 1.7);
    }
  }

  function damagePlayer(amount, sourceX) {
    if (invulnerable > 0 || ended) return;
    player.hp -= amount;
    player.vx += player.x < sourceX ? -95 : 95;
    player.vy = -125;
    invulnerable = 0.7;
    screenShake = 6;
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, "#e95847", 8);
    if (player.hp <= 0) endGame(false);
    updateHud();
  }

  function explode(x, y, radius, damage, owner) {
    screenShake = 9;
    spawnParticles(x, y, "#ff9c4b", 20);
    spawnParticles(x, y, "#5e5750", 13);
    for (let ty = Math.floor((y - radius) / TILE); ty <= Math.floor((y + radius) / TILE); ty++) {
      for (let tx = Math.floor((x - radius) / TILE); tx <= Math.floor((x + radius) / TILE); tx++) {
        if (tileDistanceFrom(x, y, (tx + 0.5) * TILE, (ty + 0.5) * TILE) < radius && tiles[ty]?.[tx] > 0 && tiles[ty][tx] !== 7) {
          if (tiles[ty][tx] === 3) player.diamonds++;
          if (tiles[ty][tx] === 2 || tiles[ty][tx] === 4) player.stone++;
          setTile(tx, ty, 0);
        }
      }
    }
    if (owner === "player") {
      for (const enemy of enemies) {
        if (!enemy.dead && tileDistanceFrom(x, y, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2) < radius + enemy.w) damageEnemy(enemy, damage);
      }
      if (!boss.dead && tileDistanceFrom(x, y, boss.x + boss.w / 2, boss.y + boss.h / 2) < radius + boss.w) damageBoss(damage);
    } else if (tileDistanceFrom(x, y, player.x + player.w / 2, player.y + player.h / 2) < radius + player.w) damagePlayer(damage, x);
    updateHud();
  }

  function tileDistanceFrom(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function updateExplosives(dt) {
    for (const item of explosives) {
      item.fuse -= dt;
      item.vy += 420 * dt;
      const oldX = item.x;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      if (collides(item.x - 4, item.y - 4, 8, 8)) {
        item.x = oldX;
        item.vx *= -0.3;
        item.vy *= -0.3;
        item.fuse = Math.min(item.fuse, 0.22);
      }
      if (item.fuse <= 0) {
        explode(item.x, item.y, item.owner === "boss" ? 86 : 104, item.owner === "boss" ? 22 : 48, item.owner === "boss" ? "enemy" : "player");
        item.done = true;
      }
    }
    explosives = explosives.filter(item => !item.done);
  }

  function updateBullets(dt) {
    for (const bullet of bullets) {
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.life <= 0 || solid(tileAt(bullet.x, bullet.y))) {
        bullet.dead = true;
        continue;
      }
      if (bullet.owner === "player") {
        for (const enemy of enemies) {
          if (!enemy.dead && bullet.x >= enemy.x && bullet.x <= enemy.x + enemy.w && bullet.y >= enemy.y && bullet.y <= enemy.y + enemy.h) {
            damageEnemy(enemy, bullet.damage);
            bullet.dead = true;
            break;
          }
        }
        if (!bullet.dead && !boss.dead && bullet.x >= boss.x && bullet.x <= boss.x + boss.w && bullet.y >= boss.y && bullet.y <= boss.y + boss.h) {
          damageBoss(bullet.damage);
          bullet.dead = true;
        }
      } else if (bullet.x >= player.x && bullet.x <= player.x + player.w && bullet.y >= player.y && bullet.y <= player.y + player.h) {
        damagePlayer(bullet.damage, bullet.x);
        bullet.dead = true;
      }
    }
    bullets = bullets.filter(bullet => !bullet.dead);
  }

  function damageBoss(amount) {
    boss.hp -= amount;
    spawnParticles(boss.x + boss.w / 2, boss.y + 20, "#ed9e63", 5);
    const phase = boss.hp > 280 ? 1 : boss.hp > 140 ? 2 : 3;
    if (phase !== boss.phase) {
      boss.phase = phase;
      bossSpawnTimer = 0;
      setHint(`MINE LORD — PHASE ${phase}. Brace for the next attack!`, 3);
    }
    if (boss.hp <= 0 && !boss.dead) {
      boss.dead = true;
      boss.hp = 0;
      bullets = bullets.filter(bullet => bullet.owner === "player");
      setHint("The Mine Lord is down. Run for the surface exit!", 10);
      spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, "#f1c362", 35);
    }
  }

  function bossAttack() {
    const x = boss.x + boss.w / 2;
    const y = boss.y + 19;
    const targetX = player.x + player.w / 2;
    const targetY = player.y + player.h / 2;
    const angle = Math.atan2(targetY - y, targetX - x);
    if (boss.phase === 1) {
      for (let i = -2; i <= 2; i++) addBullet(x, y, Math.cos(angle + i * 0.19) * 265, Math.sin(angle + i * 0.19) * 265, "enemy", 10, "#f47758", 5);
      boss.cooldown = 2.35;
    } else if (boss.phase === 2) {
      boss.burst = 5;
      boss.burstTimer = 0;
      boss.cooldown = 2.8;
    } else if (random() < 0.5) {
      for (let i = 0; i < 3; i++) explosives.push({ x, y, vx: (targetX - x) * 0.45 + (i - 1) * 75, vy: -220 - i * 25, fuse: 1.5, owner: "boss" });
      boss.cooldown = 3;
    } else {
      boss.vy = -460;
      boss.jump = 1;
      boss.cooldown = 3.3;
    }
  }

  function updateBoss(dt) {
    if (boss.dead || player.y > 12 * TILE) return;
    boss.cooldown -= dt;
    boss.burstTimer -= dt;
    const dx = player.x - boss.x;
    boss.facing = dx < 0 ? -1 : 1;
    if (boss.burst > 0 && boss.burstTimer <= 0) {
      const x = boss.x + boss.w / 2;
      const y = boss.y + 20;
      const angle = Math.atan2(player.y + 14 - y, player.x + 11 - x);
      addBullet(x, y, Math.cos(angle) * 370, Math.sin(angle) * 370, "enemy", 8, "#ff8053", 4);
      boss.burst--;
      boss.burstTimer = 0.18;
    }
    if (boss.phase === 3 && boss.jump > 0) {
      boss.vy += 950 * dt;
      boss.y += boss.vy * dt;
      if (boss.y + boss.h >= 10 * TILE - 1) {
        boss.y = 10 * TILE - boss.h;
        boss.vy = 0;
        boss.jump = 0;
        for (const direction of [-1, 1]) addBullet(boss.x + boss.w / 2, boss.y + boss.h - 3, direction * 270, 0, "enemy", 14, "#ffc45b", 7);
        screenShake = 10;
      }
    } else {
      const groundY = 10 * TILE - boss.h;
      boss.y = groundY;
      if (Math.abs(dx) > 160) boss.x += Math.sign(dx) * 14 * dt;
      boss.x = Math.max(75 * TILE, Math.min(92 * TILE, boss.x));
      if (boss.cooldown <= 0 && player.y < 12 * TILE) bossAttack();
    }
    if (bossSpawnTimer <= 0 && enemies.length < 13) {
      const type = boss.phase === 3 ? "heavy" : boss.phase === 2 ? "gunner" : "rifleman";
      addEnemy(type, (player.x < boss.x ? 73 : 91), 10);
      bossSpawnTimer = boss.phase === 3 ? 11 : 17;
      setHint("Reinforcements are dropping in!", 2.2);
    }
    bossSpawnTimer -= dt;
  }

  function updateDrops(dt) {
    for (const drop of drops) {
      if (drop.parachute) {
        drop.vy = Math.min(68, drop.vy + 24 * dt);
      } else {
        drop.vy = Math.min(250, drop.vy + 500 * dt);
      }
      if (!collides(drop.x, drop.y + 8, 12, 12)) drop.y += drop.vy * dt;
      else drop.vy = 0;
      if (Math.hypot(drop.x - player.x, drop.y - player.y) < 25) {
        if (drop.type === "bread") {
          player.hp = Math.min(player.maxHp, player.hp + 28);
          setHint("Bread picked up. Health restored.", 2);
        } else if (drop.type === "diamond") {
          player.diamonds++;
          setHint("Diamond collected.", 1.6);
        } else if (drop.type === "ammo") {
          player.ammo.pistol += 12;
          if (player.owned.has(2)) player.ammo.shotgun += 5;
          if (player.owned.has(3)) player.ammo.smg += 20;
          setHint("Ammo collected.", 1.7);
        } else if (drop.type === "crate") {
          player.ammo.pistol += 15;
          player.ammo.rifle += player.owned.has(4) ? 8 : 0;
          player.ammo.dynamite += player.owned.has(5) ? 2 : 0;
          setHint("Supply crate secured. Ammo replenished.", 2.4);
        }
        drop.collected = true;
        updateHud();
      }
    }
    drops = drops.filter(drop => !drop.collected && drop.y < WORLD_H);
  }

  function airdrop() {
    if (player.y < 12 * TILE) return;
    const x = Math.max(TILE * 2, Math.min(WORLD_W - TILE * 3, player.x + (random() - 0.5) * 360));
    drops.push({ type: random() < 0.55 ? "bread" : "crate", x, y: Math.max(0, camera.y - 40), vy: 0, parachute: true });
    setHint("Supply drop inbound. Look overhead!", 2.4);
  }

  function spawnParticles(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
      const angle = random() * Math.PI * 2;
      const speed = 25 + random() * 125;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.28 + random() * 0.45, max: 0.75, color, size: 2 + random() * 3 });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.vy += 150 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function updatePlayer(dt) {
    const ladderX = nearLadder(player);
    const climbing = ladderX >= 0 && (keys.has("w") || keys.has("s") || keys.has("arrowup") || keys.has("arrowdown"));
    const left = keys.has("a") || keys.has("arrowleft");
    const right = keys.has("d") || keys.has("arrowright");
    const jumpPressed = pressed.has(" ") || pressed.has("w") || pressed.has("arrowup");
    const speed = 185;

    if (left) { player.vx = -speed; player.facing = -1; }
    else if (right) { player.vx = speed; player.facing = 1; }
    else player.vx *= Math.pow(0.0008, dt);

    if (climbing) {
      player.x += ((ladderX + 0.5) * TILE - (player.x + player.w / 2)) * Math.min(1, dt * 10);
      player.vy = (keys.has("s") || keys.has("arrowdown") ? 1 : -1) * 145;
    } else {
      if (jumpPressed && player.onGround) player.vy = -365;
      player.vy = Math.min(620, player.vy + 920 * dt);
    }

    moveBody(player, player.vx * dt, player.vy * dt);
    player.x = Math.max(TILE, Math.min(WORLD_W - TILE - player.w, player.x));
    if (player.y > WORLD_H - 70) player.y = WORLD_H - 70;
    if (invulnerable > 0) invulnerable -= dt;

    if ((keys.has("f") || keys.has("q")) && !mouse.down) swingPickaxe();
    if (mouse.down) {
      if (weapons[player.weapon].kind === "melee") {
        if (attackCooldown <= 0) {
          mineAtCursor();
          attackCooldown = 0.24;
        }
      } else {
        fireWeapon();
      }
    }
    if (mouse.rightDown) {
      if (attackCooldown <= 0) {
        placeBlock();
        attackCooldown = 0.22;
      }
    }
  }

  function update(dt) {
    gameTime += dt;
    attackCooldown = Math.max(0, attackCooldown - dt);
    pickaxeCooldown = Math.max(0, pickaxeCooldown - dt);
    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) {
        hint = player.y < 12 * TILE ? (boss.dead ? "Reach the marked exit to escape." : "The Mine Lord is waiting. Stay sharp.") : "Find a ladder shaft and keep climbing.";
        ui.hint.textContent = hint;
      }
    }
    if (player.y < 12 * TILE) {
      airdropTimer -= dt;
      if (airdropTimer <= 0) {
        airdrop();
        airdropTimer = 10;
      }
    }
    updatePlayer(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateBullets(dt);
    updateExplosives(dt);
    updateDrops(dt);
    updateParticles(dt);
    if (boss.dead && player.x > 92 * TILE && player.y < 12 * TILE) endGame(true);
    camera.x += ((player.x + player.w / 2 - VIEW_W / 2) - camera.x) * Math.min(1, dt * 5);
    camera.y += ((player.y + player.h / 2 - VIEW_H / 2) - camera.y) * Math.min(1, dt * 5);
    camera.x = Math.max(0, Math.min(WORLD_W - VIEW_W, camera.x));
    camera.y = Math.max(0, Math.min(WORLD_H - VIEW_H, camera.y));
    updateHud();
    pressed.clear();
  }

  function endGame(victory) {
    ended = true;
    won = victory;
    ui.end.classList.remove("hidden");
    ui.endKicker.textContent = victory ? "ESCAPE COMPLETE" : "LOST IN THE MINE";
    ui.endTitle.textContent = victory ? "The surface is yours." : "The mine claims another.";
    ui.endMessage.textContent = victory
      ? `The Mine Lord is defeated. You escaped with ${player.diamonds} diamond${player.diamonds === 1 ? "" : "s"}.`
      : `You collected ${player.diamonds} diamond${player.diamonds === 1 ? "" : "s"}. The Mine Lord is still out there.`;
  }

  function colorForDepth(y) {
    if (y < 11 * TILE) return ["#728ca0", "#d3a66a", "#475361"];
    if (y < 24 * TILE) return ["#44444a", "#7d6250", "#39383c"];
    if (y < 38 * TILE) return ["#302f34", "#695347", "#303034"];
    if (y < 52 * TILE) return ["#25262d", "#59483d", "#292a31"];
    return ["#1b1e25", "#483e38", "#25272c"];
  }

  function drawTile(tx, ty, tile) {
    const x = tx * TILE - camera.x;
    const y = ty * TILE - camera.y;
    const palette = colorForDepth(ty * TILE);
    if (tile === 5) {
      ctx.fillStyle = "#79573c";
      ctx.fillRect(x + 8, y, 5, TILE);
      ctx.fillRect(x + 21, y, 5, TILE);
      for (let rung = 5; rung < TILE; rung += 10) {
        ctx.fillStyle = "#bd8d55";
        ctx.fillRect(x + 7, y + rung, 20, 3);
      }
      return;
    }
    if (tile === 0) return;
    if (tile === 7) {
      ctx.fillStyle = "#303139";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#46454a";
      ctx.fillRect(x + 4, y + 5, 11, 3);
      ctx.fillRect(x + 19, y + 20, 8, 3);
      return;
    }
    if (tile === 4) {
      ctx.fillStyle = "#79502e";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#a47643";
      ctx.fillRect(x + 3, y + 4, TILE - 6, 4);
      ctx.fillRect(x + 4, y + 21, TILE - 8, 3);
      ctx.fillStyle = "#513b2c";
      ctx.fillRect(x + 13, y, 4, TILE);
      return;
    }
    ctx.fillStyle = tile === 2 ? palette[2] : palette[1];
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = tile === 2 ? "#b1a39722" : "#dfaf6a20";
    const seed = (tx * 31 + ty * 17) % 7;
    ctx.fillRect(x + 5 + seed, y + 7, 4, 3);
    ctx.fillRect(x + 19 - seed, y + 22, 6, 3);
    if (tile === 1 && ty === 10) {
      ctx.fillStyle = "#6a854c";
      ctx.fillRect(x, y, TILE, 5);
      ctx.fillStyle = "#9ca15c";
      ctx.fillRect(x + 3, y, 7, 2);
    } else if (tile === 2) {
      ctx.fillStyle = "#c5bdb020";
      ctx.fillRect(x + 2, y + 3, 26, 2);
    }
    if (tile === 3) {
      ctx.fillStyle = "#25666c";
      ctx.fillRect(x + 7, y + 8, 19, 18);
      ctx.fillStyle = "#60dbd5";
      ctx.beginPath();
      ctx.moveTo(x + 16, y + 4); ctx.lineTo(x + 25, y + 14); ctx.lineTo(x + 16, y + 27); ctx.lineTo(x + 8, y + 14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#d0ffec";
      ctx.fillRect(x + 14, y + 8, 4, 10);
    }
    const key = `${tx},${ty}`;
    if (tileDamage.has(key)) {
      ctx.strokeStyle = "#201913";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 9, y + 5); ctx.lineTo(x + 14, y + 13); ctx.lineTo(x + 11, y + 19); ctx.lineTo(x + 21, y + 27);
      ctx.stroke();
    }
  }

  function drawBackground() {
    const depth = Math.max(0, Math.min(1, (camera.y + VIEW_H / 2) / WORLD_H));
    const colors = colorForDepth(camera.y + VIEW_H / 2);
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (camera.y < 12 * TILE) {
      const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      gradient.addColorStop(0, "#71899a");
      gradient.addColorStop(0.68, "#bd956d");
      gradient.addColorStop(1, "#45434a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "#d5b26d";
      ctx.beginPath(); ctx.arc(760 - camera.x * 0.08, 94, 31, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = colors[1];
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < 10; i++) {
        const px = (i * 157 - camera.x * 0.13) % (VIEW_W + 200);
        const py = (i * 73 - camera.y * 0.13) % VIEW_H;
        ctx.fillRect(px, py, 90, 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawTorches() {
    for (const torch of torches) {
      const x = torch.x - camera.x;
      const y = torch.y - camera.y;
      if (x < -40 || x > VIEW_W + 40 || y < -40 || y > VIEW_H + 40) continue;
      ctx.fillStyle = "#70492e";
      ctx.fillRect(x - 2, y, 5, 15);
      ctx.fillStyle = "#ffb34f";
      ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.quadraticCurveTo(x + 8, y - 2, x, y + 1); ctx.quadraticCurveTo(x - 7, y - 2, x, y - 9); ctx.fill();
      ctx.fillStyle = "#fff0a6";
      ctx.fillRect(x - 2, y - 5, 3, 5);
    }
  }

  function drawChest(chest) {
    const x = chest.x - camera.x;
    const y = chest.y - camera.y;
    ctx.fillStyle = chest.opened ? "#514131" : "#76502e";
    ctx.fillRect(x, y + 8, 27, 17);
    ctx.fillStyle = chest.opened ? "#82644a" : "#b07b3d";
    ctx.fillRect(x - 1, y + 4, 29, 8);
    ctx.fillStyle = "#453326";
    ctx.fillRect(x + 11, y + 8, 5, 9);
    if (!chest.opened) {
      ctx.fillStyle = "#ecc75d";
      ctx.fillRect(x + 12, y + 10, 3, 4);
    }
    ctx.fillStyle = "#382820";
    ctx.fillRect(x + 3, y + 22, 4, 5);
    ctx.fillRect(x + 21, y + 22, 4, 5);
  }

  function drawCharacter(body, color, type, isEnemy) {
    const x = body.x - camera.x;
    const y = body.y - camera.y;
    const flip = body.facing < 0;
    ctx.save();
    if (flip) {
      ctx.translate(x + body.w, 0);
      ctx.scale(-1, 1);
    } else ctx.translate(x, 0);
    if (isEnemy && body.aim > 0) {
      ctx.strokeStyle = `rgba(255,55,45,${0.45 + Math.sin(gameTime * 17) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(body.w + 5, y + 12 - camera.y);
      ctx.lineTo(VIEW_W * 0.55 - x, player.y + player.h / 2 - body.y - 10);
      ctx.stroke();
    }
    const by = y - camera.y;
    ctx.fillStyle = "#342a25";
    ctx.fillRect(3, by + body.h - 7, 8, 7);
    ctx.fillRect(body.w - 10, by + body.h - 7, 8, 7);
    ctx.fillStyle = color;
    ctx.fillRect(2, by + 9, body.w - 4, body.h - 16);
    ctx.fillStyle = type === "boss" ? "#342d2b" : "#d2a173";
    ctx.fillRect(5, by + 1, body.w - 10, 11);
    ctx.fillStyle = "#262324";
    ctx.fillRect(body.w - 10, by + 5, 3, 2);
    if (type === "boss") {
      ctx.fillStyle = "#d4a34e";
      ctx.fillRect(5, by - 3, body.w - 10, 4);
      ctx.fillRect(7, by - 7, 4, 5);
      ctx.fillRect(body.w - 11, by - 7, 4, 5);
      ctx.fillStyle = "#342d2b";
      ctx.fillRect(-5, by + 14, body.w + 10, 5);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(3, by - 1, body.w - 6, 5);
      ctx.fillStyle = "#b64537";
      if (type === "sniper") ctx.fillRect(13, by + 1, 4, 2);
      if (type === "heavy") ctx.fillRect(1, by + 12, 4, 13);
      if (type === "gunner") ctx.fillRect(4, by + 3, 4, 3);
    }
    ctx.fillStyle = isEnemy ? "#4a4038" : "#7a522e";
    ctx.fillRect(body.w - 1, by + 14, type === "heavy" ? 13 : 9, 4);
    ctx.restore();
  }

  function drawPlayer() {
    if (invulnerable > 0 && Math.floor(gameTime * 18) % 2 === 0) return;
    drawCharacter(player, "#bd874b", "player", false);
  }

  function drawEnemy(enemy) {
    drawCharacter(enemy, enemyInfo[enemy.type].color, enemy.type, true);
    if (enemy.hp < enemy.maxHp) {
      const x = enemy.x - camera.x;
      const y = enemy.y - camera.y - 8;
      ctx.fillStyle = "#211d1a";
      ctx.fillRect(x, y, enemy.w, 4);
      ctx.fillStyle = "#ce6250";
      ctx.fillRect(x, y, enemy.w * Math.max(0, enemy.hp / enemy.maxHp), 4);
    }
  }

  function drawBoss() {
    if (boss.dead || player.y > 12 * TILE) return;
    drawCharacter(boss, boss.phase === 3 ? "#775044" : "#876143", "boss", false);
    const barW = 230;
    const x = (VIEW_W - barW) / 2;
    ctx.fillStyle = "#191718";
    ctx.fillRect(x, 17, barW, 20);
    ctx.fillStyle = "#5d3027";
    ctx.fillRect(x + 3, 20, barW - 6, 13);
    ctx.fillStyle = boss.phase === 3 ? "#e37343" : "#dcb04d";
    ctx.fillRect(x + 3, 20, (barW - 6) * (boss.hp / boss.maxHp), 13);
    ctx.fillStyle = "#f4e9d6";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`MINE LORD  ·  PHASE ${boss.phase}`, VIEW_W / 2, 15);
    ctx.textAlign = "left";
  }

  function drawBullets() {
    for (const bullet of bullets) {
      const x = bullet.x - camera.x;
      const y = bullet.y - camera.y;
      ctx.fillStyle = bullet.color;
      ctx.beginPath(); ctx.arc(x, y, bullet.size, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.28;
      ctx.fillRect(x - bullet.vx * 0.025, y - bullet.vy * 0.025, bullet.size * 2, 2);
      ctx.globalAlpha = 1;
    }
  }

  function drawExplosives() {
    for (const item of explosives) {
      const x = item.x - camera.x;
      const y = item.y - camera.y;
      ctx.fillStyle = item.owner === "boss" ? "#d64e3f" : "#423a2c";
      ctx.fillRect(x - 5, y - 7, 10, 14);
      ctx.fillStyle = "#d1a24e";
      ctx.fillRect(x - 2, y - 9, 5, 3);
      if (Math.sin(gameTime * 23) > 0) {
        ctx.fillStyle = "#ffb253";
        ctx.fillRect(x + 2, y - 12, 3, 3);
      }
    }
  }

  function drawDrops() {
    for (const drop of drops) {
      const x = drop.x - camera.x;
      const y = drop.y - camera.y;
      if (drop.parachute) {
        ctx.strokeStyle = "#ddd5c4";
        ctx.beginPath(); ctx.arc(x + 6, y - 9, 13, Math.PI, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 7, y - 9); ctx.lineTo(x, y + 1); ctx.moveTo(x + 19, y - 9); ctx.lineTo(x + 12, y + 1); ctx.stroke();
      }
      const colors = { bread: "#d78d48", ammo: "#d2b557", diamond: "#6ce0d4", crate: "#b98549" };
      ctx.fillStyle = colors[drop.type] || "#ddd";
      ctx.fillRect(x, y, 13, 13);
      ctx.fillStyle = "#fff4cf";
      ctx.fillRect(x + 3, y + 3, 3, 3);
      if (drop.type === "bread") {
        ctx.fillStyle = "#704028";
        ctx.fillRect(x + 3, y + 8, 8, 3);
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - camera.x, p.y - camera.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawSurfaceExit() {
    if (player.y > 12 * TILE || boss.dead) {
      const x = 93 * TILE - camera.x;
      const y = 10 * TILE - camera.y - 2;
      ctx.fillStyle = boss.dead ? "#e7bd5a" : "#8c6650";
      ctx.fillRect(x, y - 42, 28, 42);
      ctx.fillStyle = "#26201b";
      ctx.fillRect(x + 5, y - 35, 18, 35);
      if (boss.dead) {
        ctx.fillStyle = "#ffe59a";
        ctx.fillRect(x + 11, y - 24, 5, 5);
      }
      ctx.fillStyle = boss.dead ? "#f6d577" : "#d8c3a5";
      ctx.font = "10px monospace";
      ctx.fillText(boss.dead ? "EXIT →" : "SURFACE", x - 10, y - 49);
    }
  }

  function drawLighting() {
    const depth = Math.max(0, Math.min(1, (player.y / WORLD_H)));
    const darkness = player.y < 12 * TILE ? 0 : 0.2 + depth * 0.48;
    if (darkness <= 0) return;
    ctx.save();
    ctx.fillStyle = `rgba(5, 7, 14, ${darkness})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalCompositeOperation = "destination-out";
    const lights = [{ x: player.x + player.w / 2 - camera.x, y: player.y + player.h / 2 - camera.y, r: 165 }];
    for (const torch of torches) {
      const x = torch.x - camera.x;
      const y = torch.y - camera.y;
      if (x > -180 && x < VIEW_W + 180 && y > -180 && y < VIEW_H + 180) lights.push({ x, y, r: 125 });
    }
    for (const light of lights) {
      const gradient = ctx.createRadialGradient(light.x, light.y, 8, light.x, light.y, light.r);
      gradient.addColorStop(0, "rgba(0,0,0,0.9)");
      gradient.addColorStop(0.52, "rgba(0,0,0,0.5)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(light.x, light.y, light.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawCrosshair() {
    if (!started || ended) return;
    ctx.strokeStyle = "rgba(255,235,190,.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mouse.x - 6, mouse.y); ctx.lineTo(mouse.x + 6, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 6); ctx.lineTo(mouse.x, mouse.y + 6);
    ctx.stroke();
  }

  function render() {
    drawBackground();
    ctx.save();
    if (screenShake > 0) {
      ctx.translate((random() - 0.5) * screenShake, (random() - 0.5) * screenShake);
      screenShake *= 0.83;
    }
    const startX = Math.max(0, Math.floor(camera.x / TILE));
    const endX = Math.min(MAP_W, Math.ceil((camera.x + VIEW_W) / TILE) + 1);
    const startY = Math.max(0, Math.floor(camera.y / TILE));
    const endY = Math.min(MAP_H, Math.ceil((camera.y + VIEW_H) / TILE) + 1);
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) drawTile(x, y, tiles[y][x]);
    }
    drawTorches();
    for (const chest of chests) if (chest.x > camera.x - 40 && chest.x < camera.x + VIEW_W + 40) drawChest(chest);
    drawSurfaceExit();
    for (const enemy of enemies) if (enemy.x > camera.x - 80 && enemy.x < camera.x + VIEW_W + 80) drawEnemy(enemy);
    drawBoss();
    drawDrops();
    drawExplosives();
    drawBullets();
    drawPlayer();
    drawParticles();
    drawLighting();
    drawCrosshair();
    ctx.restore();
  }

  function frame(timestamp) {
    const dt = Math.min(0.033, (timestamp - (lastFrame || timestamp)) / 1000);
    lastFrame = timestamp;
    if (started && !ended) update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function updateMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * VIEW_W / rect.width;
    mouse.y = (event.clientY - rect.top) * VIEW_H / rect.height;
  }

  document.querySelector("#startButton").addEventListener("click", () => {
    started = true;
    ui.start.classList.add("hidden");
    canvas.focus();
  });
  document.querySelector("#restartButton").addEventListener("click", () => {
    resetGame();
    started = true;
    ui.end.classList.add("hidden");
    ui.start.classList.add("hidden");
  });
  document.querySelector("#helpButton").addEventListener("click", () => ui.help.classList.remove("hidden"));
  document.querySelector("#closeHelp").addEventListener("click", () => ui.help.classList.add("hidden"));
  ui.help.addEventListener("click", event => {
    if (event.target === ui.help) ui.help.classList.add("hidden");
  });
  canvas.addEventListener("mousemove", updateMouse);
  canvas.addEventListener("mousedown", event => {
    updateMouse(event);
    if (event.button === 0) mouse.down = true;
    if (event.button === 2) {
      mouse.rightDown = true;
      placeBlock();
    }
  });
  window.addEventListener("mouseup", event => {
    if (event.button === 0) mouse.down = false;
    if (event.button === 2) mouse.rightDown = false;
  });
  canvas.addEventListener("contextmenu", event => event.preventDefault());
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    const available = weapons.map((weapon, index) => player.owned.has(index) ? index : -1).filter(index => index >= 0);
    const current = available.indexOf(player.weapon);
    selectWeapon(available[(current + (event.deltaY > 0 ? 1 : available.length - 1)) % available.length]);
  }, { passive: false });
  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
    if (!keys.has(key)) pressed.add(key);
    keys.add(key);
    if (key >= "1" && key <= "6") {
      const slot = weapons.findIndex(weapon => weapon.key === key);
      if (slot >= 0) selectWeapon(slot);
    }
    if (key === "e" && !event.repeat && started) useChest();
    if (key === "escape" && !ui.help.classList.contains("hidden")) ui.help.classList.add("hidden");
  });
  window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => {
    keys.clear();
    mouse.down = false;
    mouse.rightDown = false;
  });

  resetGame();
  requestAnimationFrame(frame);
})();
