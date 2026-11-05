/* =========================================================
   NEON PINBALL — 赛博弹珠
   手写 2D 物理 + Canvas 渲染，无任何第三方依赖
   ========================================================= */
(() => {
  "use strict";

  /* ---------------- 基础 ---------------- */
  const W = 480;
  const H = 860;
  const S = 2; // 内部超采样，保证霓虹边缘清晰
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = W * S;
  canvas.height = H * S;
  ctx.setTransform(S, 0, 0, S, 0, 0);

  const $ = (id) => document.getElementById(id);
  const scoreEl = $("score");
  const ballsEl = $("balls");
  const multEl = $("mult");
  const odEl = $("od");
  const odFill = $("odFill");
  const bestEl = $("best");
  const startScreen = $("startScreen");
  const overScreen = $("overScreen");
  const pauseScreen = $("pauseScreen");
  const finalScoreEl = $("finalScore");
  const finalBestEl = $("finalBest");
  const helpSheet = $("helpSheet");
  const helpBtn = $("helpBtn");
  const helpLink = $("helpLink");
  const helpClose = $("helpClose");
  const helpStart = $("helpStart");

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  const COLORS = {
    cyan: "#39f6ff",
    pink: "#ff3bd4",
    violet: "#8b5cff",
    amber: "#ffd166",
    white: "#eafcff",
  };

  const STORAGE_KEY = "neon-pinball-best";
  let best = 0;
  try { best = Number(localStorage.getItem(STORAGE_KEY)) || 0; } catch (e) { best = 0; }

  /* ---------------- 音效 ---------------- */
  const Sound = {
    ctx: null,
    muted: false,
    init() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) this.ctx = new AC();
        }
        if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      } catch (e) { /* 静默失败 */ }
    },
    tone(freq, dur = 0.1, type = "sine", vol = 0.05, endFreq = 0) {
      if (this.muted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t + dur);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.03);
      } catch (e) { /* 忽略音频错误 */ }
    },
    flip() { this.tone(190, 0.05, "square", 0.025, 130); },
    bump() { this.tone(420, 0.1, "triangle", 0.05, 900); },
    target() { this.tone(920, 0.09, "sine", 0.045, 1500); },
    lane() { this.tone(700, 0.07, "sine", 0.03, 1100); },
    launch() { this.tone(90, 0.32, "sawtooth", 0.045, 420); },
    drain() { this.tone(320, 0.45, "sawtooth", 0.05, 55); },
    over() {
      [220, 330, 440, 660].forEach((f, i) => {
        window.setTimeout(() => this.tone(f, 0.26, "triangle", 0.045), i * 95);
      });
    },
    coin() {
      this.tone(660, 0.08, "square", 0.035, 990);
      window.setTimeout(() => this.tone(990, 0.14, "square", 0.035), 95);
    },
  };

  /* ---------------- 桌面几何 ---------------- */
  const walls = [];
  function wall(x1, y1, x2, y2, opt = {}) {
    walls.push({
      a: { x: x1, y: y1 },
      b: { x: x2, y: y2 },
      e: opt.e === undefined ? 0.55 : opt.e,
      kick: opt.kick || 0,
      oneWay: !!opt.oneWay,
      sling: !!opt.sling,
    });
  }

  // 顶部圆弧（用折线逼近）
  const ARC = [
    [14, 190], [14, 152], [18, 122], [27, 99], [41, 83], [60, 72],
    [85, 65], [118, 61], [160, 59], [205, 53], [240, 46], [275, 53], [320, 59],
    [362, 61], [395, 65], [420, 72], [439, 83], [453, 99], [462, 122], [466, 152], [466, 190],
  ];
  for (let i = 0; i < ARC.length - 1; i++) {
    wall(ARC[i][0], ARC[i][1], ARC[i + 1][0], ARC[i + 1][1], { e: 0.5 });
  }

  // 弹力板（全部黄色；内侧两块按蓝线长度缩短）
  const rails = [
    { a: { x: 18, y: 234 }, b: { x: 83, y: 334 }, color: "#ffe14d" },
    { a: { x: 84, y: 472 }, b: { x: 160, y: 395 }, color: "#ffe14d" },
    { a: { x: 320, y: 395 }, b: { x: 396, y: 472 }, color: "#ffe14d" },
    { a: { x: 397, y: 334 }, b: { x: 462, y: 234 }, color: "#ffe14d" },
  ];
  for (const r of rails) {
    wall(r.a.x, r.a.y, r.b.x, r.b.y, { e: 1.02, kick: 430, sling: true });
  }

  // 主台面边界（左右对称，底部留出掉球口）
  wall(14, 190, 14, 660);
  wall(14, 660, 72, 718);
  wall(72, 718, 108, 762);
  wall(108, 762, 140, 800);
  wall(140, 800, 178, 826);

  wall(466, 190, 466, 660);
  wall(466, 660, 408, 718);
  wall(408, 718, 372, 762);
  wall(372, 762, 340, 800);
  wall(340, 800, 302, 826);

  // 弹弓（碰撞面，放大到红色线框的尺寸）
  wall(40, 658, 150, 742, { e: 0.85, kick: 600, sling: true });
  wall(440, 658, 330, 742, { e: 0.85, kick: 600, sling: true });

  const bumpers = [
    { x: 100, y: 250, r: 24, color: COLORS.cyan, flash: 0, lastHit: -1 },
    { x: 180, y: 205, r: 24, color: COLORS.pink, flash: 0, lastHit: -1 },
    { x: 300, y: 205, r: 24, color: COLORS.violet, flash: 0, lastHit: -1 },
    { x: 380, y: 250, r: 24, color: COLORS.cyan, flash: 0, lastHit: -1 },
    { x: 180, y: 390, r: 20, color: COLORS.amber, flash: 0, lastHit: -1 },
    { x: 300, y: 390, r: 20, color: COLORS.amber, flash: 0, lastHit: -1 },
    { x: 60, y: 360, r: 16, color: COLORS.cyan, flash: 0, lastHit: -1 },
    { x: 420, y: 360, r: 16, color: COLORS.pink, flash: 0, lastHit: -1 },
    { x: 70, y: 500, r: 18, color: COLORS.violet, flash: 0, lastHit: -1 },
    { x: 410, y: 500, r: 18, color: COLORS.cyan, flash: 0, lastHit: -1 },
    { x: 86, y: 598, r: 12, color: COLORS.cyan, flash: 0, lastHit: -1 },
    { x: 394, y: 598, r: 12, color: COLORS.pink, flash: 0, lastHit: -1 },
  ];

  const targets = [
    { x: 130, y: 525, r: 15, lit: false },
    { x: 190, y: 525, r: 15, lit: false },
    { x: 290, y: 525, r: 15, lit: false },
    { x: 350, y: 525, r: 15, lit: false },
  ];

  const lanes = [
    { x: 180, y: 152, r: 15, lit: false, cd: 0 },
    { x: 240, y: 132, r: 15, lit: false, cd: 0 },
    { x: 300, y: 152, r: 15, lit: false, cd: 0 },
  ];

  const flippers = [
    { pivot: { x: 160, y: 745 }, len: 70, r: 7.5, rest: 0.60, active: -0.55, angle: 0.60, omega: 0, on: false },
    { pivot: { x: 320, y: 745 }, len: 70, r: 7.5, rest: Math.PI - 0.60, active: Math.PI + 0.55, angle: Math.PI - 0.60, omega: 0, on: false },
  ];

  /* ---------------- 状态 ---------------- */
  let state = "menu"; // menu | playing | paused | over
  let score = 0;
  let ballsLeft = 3;
  let multiplier = 1;
  let overdrive = 0;
  let odActive = 0;
  let odTimer = 0;
  let combo = 0;
  let comboTimer = 0;
  let charge = 0;
  let charging = false;
  let shake = 0;
  let flash = 0;
  let flashColor = COLORS.cyan;
  let respawn = 0;
  let stuck = 0;
  let targetReset = 0;
  let hudTick = 0;
  let visual = 0;
  let bannerText = "";
  let bannerLife = 0;
  let bannerMax = 1;
  let helpOpen = false;
  let helpReturnState = null;
  let helpTrigger = null;
  let helpHideTimer = 0;

  const ball = {
    x: 240, y: 775, vx: 0, vy: 0, r: 8.5,
    waiting: true, dead: false, trail: [],
  };

  let particles = [];
  let popups = [];

  /* ---------------- 音效切换 ---------------- */
  const soundBtn = $("soundBtn");
  function toggleMute() {
    Sound.muted = !Sound.muted;
    soundBtn.setAttribute("aria-pressed", String(Sound.muted));
    soundBtn.setAttribute("aria-label", Sound.muted ? "开启声音" : "关闭声音");
  }
  soundBtn.addEventListener("click", () => {
    Sound.init();
    toggleMute();
  });

  /* ---------------- HUD ---------------- */
  function updateHud() {
    scoreEl.textContent = String(score).padStart(6, "0");
    let dots = "";
    for (let i = 0; i < 3; i++) dots += i < ballsLeft ? "●" : "○";
    ballsEl.textContent = dots.split("").join(" ");
    const shown = multiplier * (odActive > 0 ? 2 : 1);
    multEl.textContent = "×" + shown;
    const fill = odActive > 0 ? (odTimer / 8) * 100 : overdrive;
    odFill.style.width = clamp(fill, 0, 100) + "%";
    odEl.classList.toggle("is-full", odActive > 0 || overdrive >= 100);
  }

  function showOverlay(el, show) {
    el.classList.toggle("overlay--hidden", !show);
  }

  /* ---------------- 游戏流程 ---------------- */
  function resetBall() {
    ball.x = 240;
    ball.y = 775;
    ball.vx = 0;
    ball.vy = 0;
    ball.waiting = true;
    ball.dead = false;
    ball.trail.length = 0;
    charge = 0;
    charging = false;
    stuck = 0;
  }

  function startGame() {
    Sound.init();
    score = 0;
    ballsLeft = 3;
    multiplier = 1;
    overdrive = 0;
    odActive = 0;
    odTimer = 0;
    combo = 0;
    comboTimer = 0;
    targetReset = 0;
    particles = [];
    popups = [];
    bumpers.forEach((b) => { b.flash = 0; b.lastHit = -1; });
    targets.forEach((t) => { t.lit = false; });
    lanes.forEach((l) => { l.lit = false; l.cd = 0; });
    resetBall();
    state = "playing";
    showOverlay(startScreen, false);
    showOverlay(overScreen, false);
    showOverlay(pauseScreen, false);
    banner("SYSTEM ONLINE", 1.1);
    updateHud();
    Sound.coin();
  }

  function gameOver() {
    state = "over";
    charging = false;
    if (score > best) {
      best = score;
      try { localStorage.setItem(STORAGE_KEY, String(best)); } catch (e) { /* 忽略 */ }
    }
    finalScoreEl.textContent = String(score);
    finalBestEl.textContent = String(best);
    bestEl.textContent = String(best).padStart(6, "0");
    showOverlay(overScreen, true);
    Sound.over();
  }

  function loseBall() {
    if (ball.dead || state !== "playing") return;
    ballsLeft = Math.max(0, ballsLeft - 1);
    ball.dead = true;
    ball.waiting = true;
    ball.vx = 0;
    ball.vy = 0;
    ball.trail.length = 0;
    respawn = 0.9;
    flash = 0.45;
    flashColor = COLORS.pink;
    shake = Math.max(shake, 10);
    spawnParticles(ball.x, Math.min(ball.y, H - 20), COLORS.pink, 18);
    Sound.drain();
    updateHud();
    if (ballsLeft <= 0) {
      window.setTimeout(() => { if (state === "playing") gameOver(); }, 700);
    }
  }

  function startCharge() {
    if (state !== "playing" || !ball.waiting || ball.dead) return;
    charging = true;
    charge = 0;
  }

  function releaseCharge() {
    if (!charging) return;
    charging = false;
    launchBall();
  }

  function launchBall() {
    if (state !== "playing" || !ball.waiting || ball.dead) return;
    ball.waiting = false;
    ball.y = 773;
    ball.vx = (Math.random() < 0.5 ? -1 : 1) * (70 + 60 * charge);
    ball.vy = -(880 + 620 * clamp(charge, 0, 1));
    charge = 0;
    charging = false;
    Sound.launch();
  }

  /* ---------------- 计分 ---------------- */
  function popup(text, x, y, color) {
    popups.push({ text, x, y, color, life: 0.9, max: 0.9 });
  }

  function addScore(base, x, y, color) {
    const pts = Math.round(base * multiplier * (odActive > 0 ? 2 : 1));
    score += pts;
    combo += 1;
    comboTimer = 2.2;
    popup("+" + pts, x, y, color || COLORS.cyan);
    updateHud();
  }

  function addOverdrive(amount) {
    if (odActive > 0) return;
    overdrive = clamp(overdrive + amount, 0, 100);
    if (overdrive >= 100) {
      odActive = 8;
      odTimer = 8;
      flash = 0.6;
      flashColor = COLORS.cyan;
      shake = Math.max(shake, 9);
      banner("OVERDRIVE", 1.4);
      Sound.over();
    }
    updateHud();
  }

  function banner(text, life) {
    bannerText = text;
    bannerLife = life;
    bannerMax = life;
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const sp = rand(40, 260);
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.25, 0.7),
        max: 0.7,
        size: rand(1.5, 3.4),
        color,
      });
    }
  }

  /* ---------------- 碰撞 ---------------- */
  function collideWall(b, w) {
    const ax = w.a.x, ay = w.a.y;
    const abx = w.b.x - ax, aby = w.b.y - ay;
    const t = clamp(((b.x - ax) * abx + (b.y - ay) * aby) / (abx * abx + aby * aby || 1), 0, 1);
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    let dx = b.x - cx;
    let dy = b.y - cy;
    let d = Math.hypot(dx, dy);
    if (d > b.r) return;

    if (w.oneWay && b.vy <= 0) return;

    if (d < 0.0001) { dx = 0; dy = -1; d = 1; }
    const nx = dx / d;
    const ny = dy / d;
    b.x += nx * (b.r - d);
    b.y += ny * (b.r - d);

    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      const e = w.e;
      b.vx -= (1 + e) * vn * nx;
      b.vy -= (1 + e) * vn * ny;

      const tx = -ny;
      const ty = nx;
      const vt = b.vx * tx + b.vy * ty;
      b.vx -= tx * vt * 0.025;
      b.vy -= ty * vt * 0.025;

      if (w.kick) {
        b.vx += nx * w.kick;
        b.vy += ny * w.kick;
        shake = Math.max(shake, 4);
        spawnParticles(cx, cy, COLORS.pink, 6);
        Sound.bump();
      }
    }

    // 单向闸门：把停在闸门上的球推回台面
    if (w.oneWay) {
      b.vx -= 300;
      b.vy -= 70;
    }
  }

  function collideBumper(b, c) {
    let dx = b.x - c.x;
    let dy = b.y - c.y;
    let d = Math.hypot(dx, dy);
    const min = b.r + c.r;
    if (d > min) return;
    if (d < 0.0001) { dx = 0; dy = -1; d = 1; }
    const nx = dx / d;
    const ny = dy / d;
    b.x += nx * (min - d);
    b.y += ny * (min - d);

    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= 1.02 * vn * nx;
      b.vy -= 1.02 * vn * ny;
    }
    if (performance.now() / 1000 - c.lastHit > 0.07) {
      c.lastHit = performance.now() / 1000;
      c.flash = 1;
      b.vx += nx * 320;
      b.vy += ny * 320;
      spawnParticles(c.x + nx * c.r, c.y + ny * c.r, c.color, 10);
      addScore(100, c.x, c.y - 20, c.color);
      addOverdrive(6);
      shake = Math.max(shake, 5);
      Sound.bump();
    }
  }

  function collideTarget(b, t) {
    if (t.lit) return;
    const dx = b.x - t.x;
    const dy = b.y - t.y;
    const d = Math.hypot(dx, dy);
    const min = b.r + t.r;
    if (d > min) return;
    const nx = d > 0.0001 ? dx / d : 0;
    const ny = d > 0.0001 ? dy / d : -1;
    b.x += nx * (min - d);
    b.y += ny * (min - d);
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= 0.95 * vn * nx;
      b.vy -= 0.95 * vn * ny;
      b.vx += nx * 160;
      b.vy += ny * 160;
    }
    t.lit = true;
    spawnParticles(t.x, t.y, COLORS.amber, 14);
    addScore(250, t.x, t.y - 18, COLORS.amber);
    addOverdrive(12);
    shake = Math.max(shake, 4);
    Sound.target();

    if (targets.every((x) => x.lit)) {
      multiplier = Math.min(5, multiplier + 1);
      score += 1000;
      targetReset = 3;
      banner("MULTIPLIER ×" + multiplier, 1.2);
      flash = 0.3;
      flashColor = COLORS.amber;
      updateHud();
    }
  }

  function collideFlipper(b, f) {
    const tipX = f.pivot.x + Math.cos(f.angle) * f.len;
    const tipY = f.pivot.y + Math.sin(f.angle) * f.len;
    const abx = tipX - f.pivot.x;
    const aby = tipY - f.pivot.y;
    const t = clamp(((b.x - f.pivot.x) * abx + (b.y - f.pivot.y) * aby) / (abx * abx + aby * aby || 1), 0, 1);
    const cx = f.pivot.x + abx * t;
    const cy = f.pivot.y + aby * t;
    let dx = b.x - cx;
    let dy = b.y - cy;
    let d = Math.hypot(dx, dy);
    const min = b.r + f.r;
    if (d > min) return;
    if (d < 0.0001) { dx = 0; dy = -1; d = 1; }
    const nx = dx / d;
    const ny = dy / d;
    b.x += nx * (min - d);
    b.y += ny * (min - d);

    const rx = cx - f.pivot.x;
    const ry = cy - f.pivot.y;
    const svx = -f.omega * ry;
    const svy = f.omega * rx;
    const rvx = b.vx - svx;
    const rvy = b.vy - svy;
    const vn = rvx * nx + rvy * ny;
    const moving = Math.abs(f.omega) > 3;

    if (vn < 0) {
      const e = moving ? 0.55 : 0.22;
      b.vx -= (1 + e) * vn * nx;
      b.vy -= (1 + e) * vn * ny;
    }

    if (moving) {
      b.vx += svx * 0.12 + nx * 60;
      b.vy += svy * 0.12 + ny * 60;
      shake = Math.max(shake, 2.5);
    }
  }

  function collideLane(b, l) {
    if (l.cd > 0) return;
    const d = Math.hypot(b.x - l.x, b.y - l.y);
    if (d > l.r + b.r) return;
    l.cd = 1.2;
    if (!l.lit) {
      l.lit = true;
      addScore(75, l.x, l.y + 16, COLORS.cyan);
      addOverdrive(5);
      Sound.lane();
      spawnParticles(l.x, l.y, COLORS.cyan, 5);
      if (lanes.every((x) => x.lit)) {
        score += 1000;
        banner("TOP LANES CLEARED", 1.2);
        flash = 0.25;
        lanes.forEach((x) => { x.lit = false; });
        updateHud();
      }
    }
  }

  /* ---------------- 物理更新 ---------------- */
  function update(dt) {
    visual += dt;

    // 挡板始终响应
    for (const f of flippers) {
      const target = f.on ? f.active : f.rest;
      const prev = f.angle;
      const max = 20 * dt;
      f.angle += clamp(target - f.angle, -max, max);
      f.omega = (f.angle - prev) / dt;
    }

    if (state !== "playing") return;

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    if (bannerLife > 0) bannerLife -= dt;

    if (odActive > 0) {
      odTimer -= dt;
      if (odTimer <= 0) {
        odActive = 0;
        odTimer = 0;
        overdrive = 0;
        banner("OVERDRIVE END", 0.9);
        updateHud();
      } else {
        hudTick += dt;
        if (hudTick > 0.06) {
          hudTick = 0;
          updateHud();
        }
      }
    }

    if (targetReset > 0) {
      targetReset -= dt;
      if (targetReset <= 0) targets.forEach((t) => { t.lit = false; });
    }

    // 粒子与飘字
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.2 * dt;
      p.vy *= 1 - 2.2 * dt;
      p.vy += 70 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.y -= 34 * dt;
      p.life -= dt;
      if (p.life <= 0) popups.splice(i, 1);
    }

    bumpers.forEach((b) => {
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 4);
    });
    lanes.forEach((l) => {
      if (l.cd > 0) l.cd = Math.max(0, l.cd - dt);
    });

    if (shake > 0) shake = Math.max(0, shake - dt * 34);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.8);

    // 等待发射
    if (ball.dead) {
      respawn -= dt;
      if (respawn <= 0) {
        if (ballsLeft > 0) {
          resetBall();
          banner("BALL READY", 0.9);
        }
      }
      return;
    }

    if (ball.waiting) {
      if (charging) {
        charge = Math.min(1, charge + dt * 1.5);
        ball.y = 775 - charge * 6;
      }
      return;
    }

    const b = ball;

    b.vy += 1180 * dt;
    b.vx *= 1 - 0.05 * dt;
    b.vy *= 1 - 0.012 * dt;

    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 1560) {
      b.vx = (b.vx / speed) * 1560;
      b.vy = (b.vy / speed) * 1560;
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // 记录拖尾
    if (b.trail.length === 0 || Math.hypot(b.x - b.trail[b.trail.length - 1].x, b.y - b.trail[b.trail.length - 1].y) > 4) {
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 12) b.trail.shift();
    }

    for (const w of walls) collideWall(b, w);
    for (const c of bumpers) collideBumper(b, c);
    for (const t of targets) collideTarget(b, t);
    for (const f of flippers) collideFlipper(b, f);
    for (const l of lanes) collideLane(b, l);

    // 边界保护
    if (b.x < 8 + b.r) { b.x = 8 + b.r; b.vx = Math.abs(b.vx) * 0.5; }
    if (b.x > W - 8 - b.r) { b.x = W - 8 - b.r; b.vx = -Math.abs(b.vx) * 0.5; }
    if (b.y < 8 + b.r) { b.y = 8 + b.r; b.vy = Math.abs(b.vy) * 0.5; }

    // 掉球
    if (b.y > H + 24) {
      loseBall();
      return;
    }

    // 卡球处理
    if (Math.hypot(b.vx, b.vy) < 24) {
      stuck += dt;
    } else {
      stuck = 0;
    }
    if (stuck > 2.4) {
      stuck = 0;
      if (b.y > 760 && Math.abs(b.x - 240) < 40) {
        resetBall();
        banner("RE-LAUNCH", 1);
      } else {
        b.vx += rand(-260, 260);
        b.vy -= 320;
      }
    }
  }

  /* ---------------- 渲染工具 ---------------- */
  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function neonPath(points, color, width, glow) {
    if (points.length < 2) return;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = Math.max(0.8, width * 0.32);
    ctx.stroke();
    ctx.restore();
  }

  function drawBackground(t) {
    const g = ctx.createRadialGradient(240, 240, 30, 240, 440, 640);
    g.addColorStop(0, "#0a1124");
    g.addColorStop(0.55, "#060a15");
    g.addColorStop(1, "#03040a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    roundRect(7, 7, W - 14, H - 14, 16);
    ctx.clip();

    // 网格
    ctx.strokeStyle = "rgba(57,246,255,0.045)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // 光晕
    const cyan = ctx.createRadialGradient(240, 120, 10, 240, 120, 300);
    cyan.addColorStop(0, "rgba(57,246,255,0.11)");
    cyan.addColorStop(1, "rgba(57,246,255,0)");
    ctx.fillStyle = cyan;
    ctx.fillRect(0, 0, W, 460);

    const pink = ctx.createRadialGradient(240, 800, 10, 240, 800, 300);
    pink.addColorStop(0, "rgba(255,59,212,0.10)");
    pink.addColorStop(1, "rgba(255,59,212,0)");
    ctx.fillStyle = pink;
    ctx.fillRect(0, 500, W, 360);

    // 扫描摆动线
    const sy = (t * 60) % (H + 120) - 60;
    const scan = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
    scan.addColorStop(0, "rgba(57,246,255,0)");
    scan.addColorStop(0.5, "rgba(57,246,255,0.045)");
    scan.addColorStop(1, "rgba(57,246,255,0)");
    ctx.fillStyle = scan;
    ctx.fillRect(0, sy - 30, W, 60);

    ctx.restore();
  }

  function drawTable(t) {
    // 外框
    ctx.save();
    ctx.shadowColor = "rgba(57,246,255,0.6)";
    ctx.shadowBlur = 16;
    const frame = ctx.createLinearGradient(0, 0, W, H);
    frame.addColorStop(0, COLORS.cyan);
    frame.addColorStop(0.5, COLORS.violet);
    frame.addColorStop(1, COLORS.pink);
    roundRect(7, 7, W - 14, H - 14, 16);
    ctx.strokeStyle = frame;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 主台面边界（三条路径，底部留出掉球口）
    const border = ctx.createLinearGradient(0, 60, W, H);
    border.addColorStop(0, COLORS.cyan);
    border.addColorStop(0.55, "rgba(139,92,255,0.9)");
    border.addColorStop(1, COLORS.pink);

    function strokeOuter(points) {
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = border;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    strokeOuter(ARC);
    strokeOuter([[14, 190], [14, 660], [72, 718], [108, 762], [140, 800], [178, 826]]);
    strokeOuter([[466, 190], [466, 660], [408, 718], [372, 762], [340, 800], [302, 826]]);

    // 弹力板
    for (const r of rails) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(r.a.x, r.a.y);
      ctx.lineTo(r.b.x, r.b.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const dx = r.b.x - r.a.x;
      const dy = r.b.y - r.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.2;
      for (let i = 1; i <= 4; i++) {
        const t = i / 5;
        const px = r.a.x + dx * t;
        const py = r.a.y + dy * t;
        ctx.beginPath();
        ctx.moveTo(px - nx * 6, py - ny * 6);
        ctx.lineTo(px + nx * 6, py + ny * 6);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 挡板之间的弹射底座
    const px = 240;
    const py = 780;
    ctx.save();
    ctx.translate(px, py);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    const hot = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
    hot.addColorStop(0, "rgba(57,246,255,0.20)");
    hot.addColorStop(0.6, "rgba(57,246,255,0.06)");
    hot.addColorStop(1, "rgba(57,246,255,0)");
    ctx.fillStyle = hot;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(57,246,255,0.38)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, 21, t * 0.8, t * 0.8 + TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    if (charging || charge > 0) {
      const arc = ctx.createLinearGradient(-20, 20, 20, -20);
      arc.addColorStop(0, COLORS.cyan);
      arc.addColorStop(1, COLORS.pink);
      ctx.strokeStyle = arc;
      ctx.lineWidth = 3;
      ctx.shadowColor = COLORS.pink;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, 21, -Math.PI / 2, -Math.PI / 2 + TAU * charge);
      ctx.stroke();
    }

    if (ball.waiting) {
      ctx.globalAlpha = 0.45 + pulse * 0.45;
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      for (let i = 0; i < 2; i++) {
        const yy = -30 - i * 8;
        ctx.beginPath();
        ctx.moveTo(-6, yy + 5);
        ctx.lineTo(0, yy);
        ctx.lineTo(6, yy + 5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // 弹弓
    function sling(points, color) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      ctx.lineTo(points[1][0], points[1][1]);
      ctx.lineTo(points[2][0], points[2][1]);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,59,212,0.12)";
      ctx.fill();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    sling([[40, 658], [150, 742], [40, 766]], COLORS.pink);
    sling([[440, 658], [330, 742], [440, 766]], COLORS.pink);

    // 数据靶连线
    ctx.save();
    ctx.setLineDash([3, 8]);
    ctx.strokeStyle = "rgba(255,209,102,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(130, 525);
    ctx.lineTo(350, 525);
    ctx.stroke();
    ctx.restore();

    for (const l of lanes) drawLane(l, t);
    for (const tg of targets) drawTarget(tg, t);
  }

  function drawLane(l, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 + l.x);
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(8, 6);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.fillStyle = l.lit ? "rgba(57,246,255,0.85)" : "rgba(57,246,255,0.10)";
    ctx.strokeStyle = l.lit ? COLORS.cyan : "rgba(57,246,255,0.28)";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = l.lit ? 16 : 4 + pulse * 3;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawTarget(tg, t) {
    ctx.save();
    ctx.translate(tg.x, tg.y);
    const r = tg.r;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (tg.lit) {
      ctx.fillStyle = "rgba(255,209,102,0.05)";
      ctx.strokeStyle = "rgba(255,209,102,0.25)";
      ctx.lineWidth = 1;
    } else {
      const pulse = 0.65 + 0.35 * Math.sin(t * 4 + tg.x);
      ctx.fillStyle = "rgba(255,209,102,0.14)";
      ctx.strokeStyle = COLORS.amber;
      ctx.lineWidth = 2;
      ctx.shadowColor = COLORS.amber;
      ctx.shadowBlur = 12 * pulse;
    }
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, TAU);
    ctx.fillStyle = tg.lit ? "rgba(255,209,102,0.2)" : COLORS.amber;
    ctx.fill();
    ctx.restore();
  }

  function drawBumpers(t) {
    for (const b of bumpers) {
      const pulse = 1 + Math.sin(t * 2.4 + b.x * 0.02) * 0.035 + b.flash * 0.12;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(pulse, pulse);

      const glow = ctx.createRadialGradient(0, 0, b.r * 0.2, 0, 0, b.r * 1.5);
      glow.addColorStop(0, "rgba(255,255,255,0.16)");
      glow.addColorStop(0.55, b.color + "22");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, b.r * 1.5, 0, TAU);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, TAU);
      const fill = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.35, 2, 0, 0, b.r);
      fill.addColorStop(0, "rgba(255,255,255,0.28)");
      fill.addColorStop(0.45, b.color + "33");
      fill.addColorStop(1, "rgba(4,8,16,0.9)");
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.shadowColor = b.color;
      ctx.shadowBlur = 16 + b.flash * 22;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, b.r - 7, t * 1.4, t * 1.4 + TAU);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, TAU);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFlippers(t) {
    for (const f of flippers) {
      const tipX = f.pivot.x + Math.cos(f.angle) * f.len;
      const tipY = f.pivot.y + Math.sin(f.angle) * f.len;
      const active = Math.abs(f.omega) > 2;

      ctx.save();
      ctx.lineCap = "round";
      const grad = ctx.createLinearGradient(f.pivot.x, f.pivot.y, tipX, tipY);
      grad.addColorStop(0, COLORS.cyan);
      grad.addColorStop(0.55, "#7a8cff");
      grad.addColorStop(1, COLORS.pink);
      ctx.strokeStyle = grad;
      ctx.lineWidth = f.r * 2;
      ctx.shadowColor = active ? COLORS.pink : COLORS.cyan;
      ctx.shadowBlur = active ? 26 : 14;
      ctx.beginPath();
      ctx.moveTo(f.pivot.x, f.pivot.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(f.pivot.x, f.pivot.y, f.r + 1.5, 0, TAU);
      ctx.fillStyle = "#0a1120";
      ctx.fill();
      ctx.strokeStyle = "rgba(57,246,255,0.65)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBall(t) {
    if (ball.dead) return;
    const b = ball;

    // 拖尾
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < b.trail.length; i++) {
      const p = b.trail[i];
      const k = (i + 1) / b.trail.length;
      ctx.beginPath();
      ctx.arc(p.x, p.y, b.r * k * 0.8, 0, TAU);
      ctx.fillStyle = "rgba(57,246,255," + (0.03 + k * 0.08) + ")";
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "rgba(57,246,255,0.9)";
    ctx.shadowBlur = 20;
    const grad = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, 1, b.x, b.y, b.r);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.35, "#d6f6ff");
    grad.addColorStop(0.75, "#7ea9c6");
    grad.addColorStop(1, "#203449");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.32, b.r * 0.22, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.restore();
  }

  function drawEffects() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fill();
    }
    ctx.restore();

    for (const p of popups) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = "700 13px ui-monospace, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  function drawBanner(t) {
    if (bannerLife <= 0) return;
    const a = clamp(bannerLife / Math.min(0.35, bannerMax), 0, 1);
    const scale = 1 + (1 - clamp(bannerLife / bannerMax, 0, 1)) * 0.06;
    ctx.save();
    ctx.translate(240, 630);
    ctx.scale(scale, scale);
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.font = "400 10px ui-monospace, Consolas, monospace";
    ctx.fillStyle = "rgba(57,246,255,0.6)";
    ctx.fillText("// " + bannerText + " //", 0, 0);
    ctx.restore();
  }

  function render(t) {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (shake > 0.1) {
      ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
    }

    drawBackground(t);
    drawTable(t);
    drawBumpers(t);
    drawFlippers(t);
    drawBall(t);
    drawEffects();
    drawBanner(t);

    // OVERDRIVE 视觉
    if (odActive > 0) {
      const a = 0.08 + 0.04 * Math.sin(t * 14);
      const v = ctx.createRadialGradient(240, 430, 120, 240, 430, 520);
      v.addColorStop(0, "rgba(255,59,212,0)");
      v.addColorStop(1, "rgba(255,59,212," + a + ")");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }

    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = flash * 0.55;
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    ctx.restore();
  }

  /* ---------------- 主循环 ---------------- */
  const STEP = 1 / 240;
  let acc = 0;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state === "playing") {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 12) {
        update(STEP);
        acc -= STEP;
        steps++;
      }
      if (steps === 12) acc = 0;
    } else {
      acc = 0;
      // 菜单/暂停时仍推进轻微动画
      for (const f of flippers) f.omega = 0;
    }

    render(now / 1000);
    requestAnimationFrame(frame);
  }

  /* ---------------- 输入 ---------------- */
  function setFlip(index, on) {
    const f = flippers[index];
    if (!f) return;
    if (on && !f.on && state === "playing") Sound.flip();
    f.on = on;
  }

  function togglePause(force) {
    if (state === "playing" || state === "paused") {
      const pause = force === undefined ? state === "playing" : force;
      if (pause) {
        state = "paused";
        charging = false;
        flippers.forEach((f) => { f.on = false; });
        showOverlay(pauseScreen, true);
      } else {
        state = "playing";
        showOverlay(pauseScreen, false);
        last = performance.now();
        acc = 0;
      }
    }
  }

  function openHelp(trigger) {
    if (helpOpen) return;
    helpOpen = true;
    helpTrigger = trigger || document.activeElement;
    helpReturnState = state;
    if (state === "playing") {
      state = "paused";
      charging = false;
      flippers.forEach((f) => { f.on = false; });
      showOverlay(pauseScreen, false);
    }
    window.clearTimeout(helpHideTimer);
    helpSheet.hidden = false;
    window.requestAnimationFrame(() => helpSheet.classList.add("is-open"));
    helpClose.focus();
  }

  function closeHelp() {
    if (!helpOpen) return;
    helpOpen = false;
    helpSheet.classList.remove("is-open");
    window.clearTimeout(helpHideTimer);
    helpHideTimer = window.setTimeout(() => { helpSheet.hidden = true; }, 260);

    if (helpReturnState === "playing") {
      state = "playing";
      last = performance.now();
      acc = 0;
    }
    const trigger = helpTrigger;
    helpReturnState = null;
    helpTrigger = null;
    if (trigger && document.contains(trigger)) trigger.focus();
  }

  const pauseBtn = $("pauseBtn");
  pauseBtn.addEventListener("click", () => togglePause());

  helpBtn.addEventListener("click", () => openHelp(helpBtn));
  helpLink.addEventListener("click", () => openHelp(helpLink));
  helpClose.addEventListener("click", closeHelp);
  helpSheet.addEventListener("click", (e) => {
    if (e.target === helpSheet) closeHelp();
  });
  helpStart.addEventListener("click", () => {
    closeHelp();
  });

  // 焦点锁在说明面板内
  helpSheet.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const focusables = Array.prototype.slice.call(
      helpSheet.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")
    ).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  $("startBtn").addEventListener("click", startGame);
  $("retryBtn").addEventListener("click", startGame);
  $("resumeBtn").addEventListener("click", () => togglePause(false));

  window.addEventListener("keydown", (e) => {
    const k = e.code;
    if (!helpSheet.hidden) {
      if (k === "Escape") {
        e.preventDefault();
        closeHelp();
      } else if (k === "Space" || k === "ArrowLeft" || k === "ArrowRight") {
        e.preventDefault();
      }
      return;
    }
    if (k === "Space" || k === "ArrowLeft" || k === "ArrowRight" || k === "Slash") e.preventDefault();
    if (e.repeat) return;

    if (k === "Space") {
      if (state === "menu" || state === "over") { startGame(); return; }
      if (state === "paused") { togglePause(false); return; }
      if (state === "playing" && ball.waiting) startCharge();
      return;
    }
    if (k === "ArrowLeft" || k === "KeyZ") { setFlip(0, true); return; }
    if (k === "ArrowRight" || k === "Slash") { setFlip(1, true); return; }
    if (k === "KeyP" || k === "Escape") { togglePause(); return; }
    if (k === "KeyR") { startGame(); return; }
    if (k === "KeyM") { Sound.init(); toggleMute(); }
  }, { passive: false });

  window.addEventListener("keyup", (e) => {
    if (!helpSheet.hidden) return;
    const k = e.code;
    if (k === "Space") {
      if (state === "playing" && charging) releaseCharge();
      return;
    }
    if (k === "ArrowLeft" || k === "KeyZ") setFlip(0, false);
    if (k === "ArrowRight" || k === "Slash") setFlip(1, false);
  });

  // 触屏挡板
  function bindPad(el, index) {
    const down = (e) => {
      e.preventDefault();
      el.classList.add("is-down");
      setFlip(index, true);
    };
    const up = (e) => {
      if (e) e.preventDefault();
      el.classList.remove("is-down");
      setFlip(index, false);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", up);
  }
  bindPad($("padLeft"), 0);
  bindPad($("padRight"), 1);

  const padLaunch = $("padLaunch");
  padLaunch.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    padLaunch.classList.add("is-down");
    if (state === "menu" || state === "over") startGame();
    if (state === "playing" && ball.waiting) startCharge();
  });
  const padUp = (e) => {
    if (e) e.preventDefault();
    padLaunch.classList.remove("is-down");
    if (state === "playing" && charging) releaseCharge();
  };
  padLaunch.addEventListener("pointerup", padUp);
  padLaunch.addEventListener("pointercancel", padUp);
  padLaunch.addEventListener("pointerleave", padUp);

  // 切后台自动暂停
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") togglePause(true);
  });

  /* ---------------- 调试接口（自动化测试用） ---------------- */
  window.__neon = {
    start: startGame,
    launch(power = 0.8) {
      if (state !== "playing") return false;
      if (!ball.waiting) return false;
      charge = clamp(power, 0, 1);
      launchBall();
      return true;
    },
    flip(index, on) { setFlip(index, !!on); },
    drain() {
      if (state !== "playing") return false;
      ball.waiting = false;
      ball.dead = false;
      ball.y = H + 40;
      return true;
    },
    simulate(seconds) {
      const dt = 1 / 240;
      for (let i = 0; i < seconds * 240; i++) update(dt);
    },
    info() {
      return {
        state, score, balls: ballsLeft, multiplier,
        overdrive, odActive,
        x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy,
        waiting: ball.waiting, dead: ball.dead,
        targets: targets.filter((t) => t.lit).length,
        angles: flippers.map((f) => Number(f.angle.toFixed(3))),
        charging, charge: Number(charge.toFixed(2)),
      };
    },
  };

  /* ---------------- 启动 ---------------- */
  bestEl.textContent = String(best).padStart(6, "0");
  updateHud();
  requestAnimationFrame(frame);
})();
