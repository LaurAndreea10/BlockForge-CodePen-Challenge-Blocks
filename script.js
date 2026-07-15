/* ───────────────────────────────────────────────
   BlockForge — CodePen Challenge: Blocks
   Build · Demolish · Challenge
   ─────────────────────────────────────────────── */

const SIZE = 8, TILE = 60, LIFT = 26, MAX_Z = 6;
const HALF = (SIZE * TILE) / 2;
const KEY = "blockforge.scene";
const BEST = "blockforge.best";

const TYPES = [
  { id: "core",  label: "Core",  tone: "var(--cyan)",   note: "base unit", mass: 3, hp: 3, cost: 2 },
  { id: "pulse", label: "Pulse", tone: "var(--pink)",   note: "emitter",   mass: 2, hp: 2, cost: 2 },
  { id: "solar", label: "Solar", tone: "var(--yellow)", note: "power",     mass: 2, hp: 2, cost: 3 },
  { id: "moss",  label: "Moss",  tone: "var(--green)",  note: "organic",   mass: 1, hp: 1, cost: 1 },
  { id: "void",  label: "Void",  tone: "var(--purple)", note: "absorbs",   mass: 4, hp: 4, cost: 4 },
  { id: "ember", label: "Ember", tone: "var(--orange)", note: "brittle",   mass: 1, hp: 1, cost: 1 }
];

const BUDGET = 40;   // challenge: total cost you may spend

const $ = (s) => document.querySelector(s);
const stage    = $("#stage");
const scene3d  = $("#scene3d");
const gridEl   = $("#grid");
const blocksEl = $("#blocks");
const sparksEl = $("#sparks");
const paletteEl= $("#palette");
const missionEl= $("#mission");
const inspectEl= $("#inspector");
const jsonEl   = $("#json");
const hintEl   = $("#hint");
const bannerEl = $("#banner");
const wreckEl  = $("#wrecking");

/* ── state ── */
let scene = [], past = [], future = [];
let active = TYPES[0].id, selected = null, uid = 0;
let mode = "build";
let gravity = false, sound = true, audio = null;
let spin = 45, tilt = 58, zoom = 1;
let orbiting = false, painting = false;
let paintedTiles = new Set(), dragStart = null;
let spent = 0, running = false, score = 0;

const type = (id) => TYPES.find((t) => t.id === id);
const toneOf = (id) => type(id).tone;
const column = (x, y) => scene.filter((b) => b.x === x && b.y === y);
const heightAt = (x, y) => column(x, y).reduce((m, b) => Math.max(m, b.z + 1), 0);
const at = (x, y, z) => scene.find((b) => b.x === x && b.y === y && b.z === z);
const supported = (b) => b.z === 0 || !!at(b.x, b.y, b.z - 1);
const unstable = () => scene.filter((b) => !supported(b));
const budgetLeft = () => BUDGET - spent;

/* ═══ PALETTE ═══ */
TYPES.forEach((t, i) => {
  const chip = document.createElement("button");
  chip.className = "chip";
  chip.style.setProperty("--tone", t.tone);
  chip.setAttribute("aria-pressed", String(t.id === active));
  chip.dataset.type = t.id;
  chip.draggable = true;
  chip.innerHTML = `
    <span class="swatch"></span>
    <span>${t.label}<small class="meta">${t.note} · m${t.mass}</small></span>
    <kbd>${i + 1}</kbd>`;
  chip.addEventListener("click", () => setActive(t.id));
  chip.addEventListener("dragstart", (e) => {
    setActive(t.id);
    e.dataTransfer.setData("text/plain", t.id);
  });
  paletteEl.appendChild(chip);
});

function setActive(id) {
  active = id;
  paletteEl.querySelectorAll(".chip").forEach((c) =>
    c.setAttribute("aria-pressed", String(c.dataset.type === id)));
  ghost.style.setProperty("--tone", toneOf(id));
  beep(700, "ui");
}

/* costs shown only in challenge mode */
function refreshChips() {
  paletteEl.querySelectorAll(".chip").forEach((c) => {
    const t = type(c.dataset.type);
    c.querySelector(".meta").textContent =
      mode === "challenge" ? `cost ${t.cost} · m${t.mass}` : `${t.note} · m${t.mass}`;
  });
}

/* ═══ GHOST ═══ */
const ghost = document.createElement("div");
ghost.className = "ghost";
ghost.innerHTML = `<div class="face top"></div><div class="face n"></div><div class="face e"></div>`;
ghost.style.setProperty("--tone", toneOf(active));
blocksEl.appendChild(ghost);

function showGhost(x, y) {
  if (mode === "demolish") { hideGhost(); return; }
  const z = heightAt(x, y);
  if (z >= MAX_Z) { hideGhost(); return; }
  ghost.style.transform = `translate3d(${x * TILE - HALF}px, ${y * TILE - HALF}px, ${z * LIFT}px)`;
  ghost.classList.add("show");
}
const hideGhost = () => ghost.classList.remove("show");

/* ═══ GRID ═══ */
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.x = x; tile.dataset.y = y;

    tile.addEventListener("pointerenter", () => {
      showGhost(x, y);
      if (painting && mode !== "demolish") paintTile(x, y);
    });
    tile.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (mode === "demolish") { wreck(x, y); return; }
      painting = true; paintedTiles.clear();
      paintTile(x, y);
    });
    tile.addEventListener("dragover", (e) => { e.preventDefault(); showGhost(x, y); });
    tile.addEventListener("drop", (e) => {
      e.preventDefault();
      if (mode === "demolish") return;
      place(x, y, e.dataTransfer.getData("text/plain") || active);
    });
    gridEl.appendChild(tile);
  }
}
gridEl.addEventListener("pointerleave", hideGhost);

function paintTile(x, y) {
  const k = `${x},${y}`;
  if (paintedTiles.has(k)) return;
  paintedTiles.add(k);
  place(x, y, active, true);
  showGhost(x, y);
}

/* ═══ MUTATIONS ═══ */
function commit(next) {
  past.push(scene.map((b) => ({ ...b })));
  if (past.length > 60) past.shift();
  future = [];
  scene = next;
  render();
}

function place(x, y, t, batched = false) {
  const z = heightAt(x, y);
  if (z >= MAX_Z) { flash(`Stack limit — ${MAX_Z} high.`); return; }

  if (mode === "challenge") {
    if (!running) { flash("Press Start run first.", "var(--yellow)"); return; }
    const c = type(t).cost;
    if (c > budgetLeft()) { flash(`Not enough budget — ${type(t).label} costs ${c}.`); beep(140, "break"); return; }
    spent += c;
  }

  const block = { id: ++uid, x, y, z, type: t, hp: type(t).hp, fresh: true };
  if (batched) { scene = [...scene, block]; render(); }
  else commit([...scene, block]);

  burst(x, y, z, toneOf(t), 9);
  beep(190 + z * 45, "place");

  if (mode === "challenge" && budgetLeft() <= 0) setTimeout(finishRun, 500);
}

function remove(id, silent = false) {
  const b = scene.find((n) => n.id === id);
  if (!b) return;
  if (!gravity && b.z !== heightAt(b.x, b.y) - 1) {
    flash("Gravity is off — clear the block above first."); return;
  }
  if (selected === id) selected = null;
  if (!silent) { burst(b.x, b.y, b.z, toneOf(b.type), 14); beep(340, "break"); }

  let next = scene.filter((n) => n.id !== id);
  if (gravity) next = settle(next, b.x, b.y);
  commit(next);
}

function settle(list, x, y) {
  const col = list.filter((b) => b.x === x && b.y === y).sort((a, b) => a.z - b.z);
  let moved = false;
  col.forEach((b, i) => {
    if (b.z !== i) { b.fz = b.z; b.z = i; b.falling = true; moved = true; }
  });
  if (moved) {
    setTimeout(() => beep(130, "thud"), 220);
    setTimeout(cascade, 340);
  }
  return list;
}

function cascade() {
  if (!gravity) return;
  const floats = unstable();
  if (!floats.length) return;
  const cols = new Set(floats.map((b) => `${b.x},${b.y}`));
  let next = scene.map((b) => ({ ...b }));
  cols.forEach((k) => {
    const [x, y] = k.split(",").map(Number);
    next = settle(next, x, y);
  });
  scene = next;
  beep(95, "thud");
  floats.forEach((b) => burst(b.x, b.y, b.z, toneOf(b.type), 4, 0.6));
  render();
}

function undo() { if (past.length) { future.push(scene); scene = past.pop(); selected = null; render(); beep(300, "ui"); } }
function redo() { if (future.length) { past.push(scene); scene = future.pop(); selected = null; render(); beep(500, "ui"); } }

function flash(msg, tone = "var(--red)") {
  hintEl.textContent = msg;
  hintEl.style.color = tone;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => { hintEl.style.color = ""; }, 1800);
}

/* ═══ DEMOLITION ═══ */
function wreck(x, y) {
  const col = column(x, y);
  if (!col.length) { flash("Nothing to smash there.", "var(--faint)"); return; }

  // aim the ball at the screen position of the tile
  const tile = gridEl.querySelector(`.tile[data-x="${x}"][data-y="${y}"]`);
  const r = tile.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const bx = ((r.left + r.width / 2 - s.left) / s.width) * 100;
  const by = ((r.top + r.height / 2 - s.top) / s.height) * 100;

  wreckEl.hidden = false;
  wreckEl.style.setProperty("--bx", `${bx}%`);
  wreckEl.style.setProperty("--by", `${by}%`);
  wreckEl.style.setProperty("--bh", `${by * (s.height / 100) + 60}px`);
  wreckEl.style.setProperty("--swing", `${(bx - 50) * 0.3}deg`);
  wreckEl.classList.add("swinging");
  beep(70, "swoosh");

  setTimeout(() => {
    stage.classList.add("shake");
    setTimeout(() => stage.classList.remove("shake"), 380);
    beep(60, "thud");
    impact(x, y);
    wreckEl.classList.remove("swinging");
  }, 190);
}

/* damage the column + splash damage to the 4 neighbours */
function impact(x, y) {
  const hits = [
    { x, y, dmg: 3 },
    { x: x + 1, y, dmg: 1 }, { x: x - 1, y, dmg: 1 },
    { x, y: y + 1, dmg: 1 }, { x, y: y - 1, dmg: 1 }
  ];

  let next = scene.map((b) => ({ ...b }));
  const dead = [];

  hits.forEach(({ x: hx, y: hy, dmg }) => {
    next.filter((b) => b.x === hx && b.y === hy).forEach((b) => {
      b.hp = (b.hp ?? type(b.type).hp) - dmg;
      if (b.hp <= 0) dead.push(b);
      else { b.cracked = true; burst(b.x, b.y, b.z, toneOf(b.type), 3, 0.5); }
    });
  });

  if (!dead.length) { flash("Cracked, but it held.", "var(--orange)"); render(); return; }

  // fly the doomed blocks apart before deleting them
  dead.forEach((b) => {
    const el = [...blocksEl.querySelectorAll(".block")].find((n) => +n.dataset.id === b.id);
    if (el) {
      el.style.setProperty("--kx", `${(Math.random() - 0.5) * 120}px`);
      el.style.setProperty("--ky", `${(Math.random() - 0.5) * 120}px`);
      el.classList.add("smash");
    }
    burst(b.x, b.y, b.z, toneOf(b.type), 16, 1.3);
  });

  const ids = new Set(dead.map((b) => b.id));
  next = next.filter((b) => !ids.has(b.id));

  const wasGravity = gravity;
  gravity = true;                                 // demolition always settles
  const cols = new Set(dead.map((b) => `${b.x},${b.y}`));
  cols.forEach((k) => {
    const [cx, cy] = k.split(",").map(Number);
    next = settle(next, cx, cy);
  });

  setTimeout(() => {
    commit(next);
    gravity = wasGravity;
    $("[data-act=gravity]").classList.toggle("on", gravity);
    $("#gravLabel").textContent = gravity ? "ON" : "OFF";
    flash(`${dead.length} block${dead.length > 1 ? "s" : ""} destroyed.`, "var(--red)");
  }, 260);
}

/* ═══ CHALLENGE ═══ */
function paintMission() {
  if (mode !== "challenge") { missionEl.hidden = true; return; }
  missionEl.hidden = false;
  const pct = (budgetLeft() / BUDGET) * 100;
  const best = +(localStorage.getItem(BEST) || 0);

  missionEl.innerHTML = `
    <h3>Mission</h3>
    <p>Build the tallest <b>stable</b> tower you can. Every floating block costs you.
       Score = height² × stability × mass efficiency.</p>
    <div class="budget"><span>budget</span><b>${budgetLeft()} / ${BUDGET}</b></div>
    <div class="bar ${pct < 30 ? "low" : ""}"><i style="width:${Math.max(0, pct)}%"></i></div>
    ${best ? `<div class="budget" style="margin-top:12px"><span>best</span><b style="color:var(--yellow)">${best}</b></div>` : ""}
    <button class="go" data-act="run">${running ? "⏹ Finish run" : "▶ Start run"}</button>`;
}

function startRun() {
  spent = 0; score = 0; running = true;
  gravity = true;
  $("[data-act=gravity]").classList.add("on");
  $("#gravLabel").textContent = "ON";
  commit([]);
  flash(`Run started — ${BUDGET} points of budget. Gravity is on.`, "var(--yellow)");
  beep(880, "ui");
}

function calcScore() {
  const h = scene.reduce((m, b) => Math.max(m, b.z + 1), 0);
  const floats = unstable().length;
  const stab = scene.length ? (scene.length - floats) / scene.length : 0;
  const mass = scene.reduce((s, b) => s + type(b.type).mass, 0);
  const eff = mass ? Math.min(1.5, (scene.length * 2) / mass) : 0;
  return Math.round(h * h * 100 * stab * eff);
}

function finishRun() {
  if (!running) return;
  running = false;
  score = calcScore();

  const h = scene.reduce((m, b) => Math.max(m, b.z + 1), 0);
  const floats = unstable().length;
  const best = +(localStorage.getItem(BEST) || 0);
  const isBest = score > best;
  if (isBest) localStorage.setItem(BEST, score);

  const rank =
    score >= 3000 ? "Master Architect" :
    score >= 1800 ? "Structural Engineer" :
    score >= 900  ? "Foreman" :
    score >= 300  ? "Apprentice" : "Rubble Enthusiast";

  bannerEl.hidden = false;
  bannerEl.innerHTML = `
    <h3>${isBest ? "New personal best" : "Run complete"}</h3>
    <p>Height ${h} · ${scene.length} blocks · ${floats} floating · ${spent}/${BUDGET} spent</p>
    <div class="score">${score.toLocaleString()}</div>
    <div class="rank">${rank}</div>
    <button data-act="again">Run again</button>`;

  beep(isBest ? 990 : 660, "ui");
  setTimeout(() => beep(isBest ? 1320 : 780, "ui"), 130);
  for (let i = 0; i < 26; i++) {
    setTimeout(() => burst(
      Math.floor(Math.random() * SIZE), Math.floor(Math.random() * SIZE),
      Math.floor(Math.random() * 5),
      TYPES[i % TYPES.length].tone, 6, 1.4
    ), i * 45);
  }
  paintMission();
  render();
}

bannerEl.addEventListener("click", (e) => {
  if (e.target.dataset.act === "again") { bannerEl.hidden = true; startRun(); }
});

/* ═══ MODES ═══ */
$("#modes").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  setMode(btn.dataset.mode);
});

function setMode(m) {
  mode = m;
  running = false;
  bannerEl.hidden = true;
  wreckEl.hidden = m !== "demolish";

  $("#modes").querySelectorAll("button").forEach((b) =>
    b.classList.toggle("on", b.dataset.mode === m));
  stage.classList.toggle("demolish", m === "demolish");
  stage.classList.toggle("challenge", m === "challenge");
  paletteEl.classList.toggle("locked", m === "demolish");
  $("#scoreCard").classList.toggle("live", m === "challenge");

  if (m === "demolish") {
    gravity = true;
    $("[data-act=gravity]").classList.add("on");
    $("#gravLabel").textContent = "ON";
    flash("Demolition — click a column to swing the ball. Splash damage hits neighbours.", "var(--red)");
  }
  if (m === "build") flash("Build — click to place, drag to paint.", "var(--cyan)");
  if (m === "challenge") { spent = 0; flash("Challenge — press Start run.", "var(--yellow)"); }

  refreshChips();
  paintMission();
  hideGhost();
  render();
}

missionEl.addEventListener("click", (e) => {
  if (e.target.dataset.act !== "run") return;
  running ? finishRun() : startRun();
});

/* ═══ RENDER ═══ */
function render() {
  const floats = new Set(unstable().map((b) => b.id));
  [...blocksEl.querySelectorAll(".block")].forEach((n) => n.remove());

  [...scene].sort((a, b) => a.z - b.z).forEach((b) => {
    const el = document.createElement("div");
    el.className = "block";
    el.dataset.id = b.id;
    if (b.id === selected) el.classList.add("sel");
    if (floats.has(b.id) && !b.falling) el.classList.add("unstable");
    if (b.cracked) el.classList.add("cracked");

    el.style.setProperty("--tone", toneOf(b.type));
    el.style.setProperty("--x", `${b.x * TILE - HALF}px`);
    el.style.setProperty("--y", `${b.y * TILE - HALF}px`);
    el.style.setProperty("--z", `${b.z * LIFT}px`);
    el.style.transform = `translate3d(${b.x * TILE - HALF}px, ${b.y * TILE - HALF}px, ${b.z * LIFT}px)`;

    if (b.falling) {
      el.style.setProperty("--fz", `${(b.fz ?? b.z + 1) * LIFT}px`);
      el.classList.add("falling");
      el.addEventListener("animationend", () => {
        el.classList.remove("falling");
        el.classList.add("landed");
        burst(b.x, b.y, b.z, toneOf(b.type), 5, 0.5);
      }, { once: true });
      delete b.falling; delete b.fz;
    } else if (b.fresh) { el.classList.add("fresh"); delete b.fresh; }

    el.innerHTML = `<div class="face top"></div><div class="face n"></div><div class="face e"></div>`;
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (mode === "demolish") { wreck(b.x, b.y); return; }
      selected = b.id; render();
    });
    el.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (mode !== "demolish") remove(b.id);
    });
    el.addEventListener("mouseenter", () => inspect(b));
    blocksEl.appendChild(el);
  });

  gridEl.querySelectorAll(".tile").forEach((t) =>
    t.classList.toggle("occupied", heightAt(+t.dataset.x, +t.dataset.y) > 0));

  const maxH = scene.reduce((m, b) => Math.max(m, b.z + 1), 0);
  const stability = scene.length
    ? Math.round(((scene.length - floats.size) / scene.length) * 100) : 100;

  bump("#statBlocks", scene.length);
  bump("#statHeight", maxH);
  $("#statStable").innerHTML = `${stability}<i>%</i>`;
  $("#statStable").style.color = stability < 100 ? "var(--pink)" : "";
  if (mode === "challenge") bump("#statScore", running ? calcScore() : score);

  $("[data-act=undo]").disabled = !past.length;
  $("[data-act=redo]").disabled = !future.length;

  inspect(scene.find((b) => b.id === selected));
  paintJSON(maxH, stability, floats.size);
  paintMission();
}

function bump(sel, val) {
  const el = $(sel);
  const txt = String(val);
  if (el.textContent === txt) return;
  el.textContent = txt;
  const card = el.closest(".stat");
  card.classList.remove("pop");
  void card.offsetWidth;
  card.classList.add("pop");
}

function inspect(b) {
  if (!b) {
    inspectEl.innerHTML = `<p class="empty">
      <b>Build</b> — click to place, drag to paint<br>
      <b>Demolish</b> — click a column to swing the ball<br>
      <b>Challenge</b> — tallest stable tower on a budget<br><br>
      <b>Drag</b> empty space to orbit · <b>scroll</b> to zoom<br>
      <b>1–6</b> pick type · <b>G</b> gravity · <b>Del</b> remove</p>`;
    return;
  }
  const t = type(b.type);
  const hp = b.hp ?? t.hp;
  const load = column(b.x, b.y).filter((n) => n.z > b.z).reduce((s, n) => s + type(n.type).mass, 0);
  inspectEl.innerHTML = `
    <div class="row"><span>type</span><span style="color:${t.tone}">${t.label}</span></div>
    <div class="row"><span>position</span><span>${b.x}, ${b.y}, z${b.z}</span></div>
    <div class="row"><span>integrity</span><span>${"▮".repeat(hp)}${"▯".repeat(Math.max(0, t.hp - hp))} ${hp}/${t.hp}</span></div>
    <div class="row"><span>mass · cost</span><span>${t.mass} · ${t.cost}</span></div>
    <div class="row"><span>load above</span><span>${load}</span></div>
    <div class="row"><span>state</span>${
      supported(b) ? `<span style="color:var(--green)">supported</span>`
                   : `<span class="badge">floating</span>`}</div>`;
}

function paintJSON(maxH, stability, floating) {
  const mass = scene.reduce((s, b) => s + type(b.type).mass, 0);
  const data = {
    mode, gravity,
    grid: `${SIZE}×${SIZE}×${MAX_Z}`,
    blocks: scene.length, height: maxH, mass,
    stability: `${stability}%`, floating,
    ...(mode === "challenge" ? { budget: `${spent}/${BUDGET}`, score: running ? calcScore() : score } : {}),
    scene: scene.map(({ type: t, x, y, z }) => [t, x, y, z])
  };
  jsonEl.innerHTML = JSON.stringify(data, null, 1)
    .replace(/"([^"]+)":/g, '<span class="k">"$1"</span>:')
    .replace(/: ("[^"]*"|\d+|true|false)/g, ': <span class="v">$1</span>');
}

/* ═══ PARTICLES ═══ */
function burst(x, y, z, tone, count = 9, scale = 1) {
  const sx = x * TILE - HALF + TILE / 2;
  const sy = y * TILE - HALF + TILE / 2;
  const sz = z * LIFT + LIFT;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const a = Math.random() * Math.PI * 2;
    const r = (24 + Math.random() * 44) * scale;
    p.className = "spark";
    p.style.setProperty("--tone", tone);
    p.style.setProperty("--sx", `${sx}px`);
    p.style.setProperty("--sy", `${sy}px`);
    p.style.setProperty("--sz", `${sz}px`);
    p.style.setProperty("--dx", `${Math.cos(a) * r}px`);
    p.style.setProperty("--dy", `${Math.sin(a) * r}px`);
    p.style.setProperty("--dz", `${(26 + Math.random() * 58) * scale}px`);
    p.style.setProperty("--dur", `${460 + Math.random() * 340}ms`);
    p.addEventListener("animationend", () => p.remove(), { once: true });
    sparksEl.appendChild(p);
  }
}

/* ═══ SOUND ═══ */
function beep(freq, kind) {
  if (!sound) return;
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === "suspended") audio.resume();

  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const cfg = {
    place:  { type: "triangle", to: freq * 2.2,  dur: 0.13, vol: 0.14 },
    break:  { type: "sawtooth", to: freq * 0.32, dur: 0.20, vol: 0.11 },
    thud:   { type: "sine",     to: freq * 0.4,  dur: 0.34, vol: 0.26 },
    swoosh: { type: "sawtooth", to: freq * 4,    dur: 0.18, vol: 0.08 },
    ui:     { type: "square",   to: freq,        dur: 0.05, vol: 0.05 }
  }[kind] || { type: "sine", to: freq, dur: 0.1, vol: 0.1 };

  osc.type = cfg.type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(35, cfg.to), t + cfg.dur);
  gain.gain.setValueAtTime(cfg.vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + cfg.dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(t); osc.stop(t + cfg.dur + 0.02);
}

/* ═══ CAMERA ═══ */
function applyCam(snap = false) {
  scene3d.classList.toggle("snap", snap);
  scene3d.style.setProperty("--spin", `${spin}deg`);
  scene3d.style.setProperty("--tilt", `${tilt}deg`);
  scene3d.style.setProperty("--zoom", zoom);
  if (snap) setTimeout(() => scene3d.classList.remove("snap"), 520);
}

stage.addEventListener("pointerdown", (e) => {
  if (e.target !== stage && e.target !== scene3d) return;
  orbiting = true; selected = null;
  dragStart = { x: e.clientX, y: e.clientY, spin, tilt };
  stage.classList.add("dragging");
  stage.setPointerCapture(e.pointerId);
  render();
});
addEventListener("pointermove", (e) => {
  if (!orbiting || !dragStart) return;
  spin = dragStart.spin + (e.clientX - dragStart.x) * 0.4;
  tilt = Math.min(88, Math.max(18, dragStart.tilt - (e.clientY - dragStart.y) * 0.3));
  applyCam();
});
addEventListener("pointerup", () => {
  orbiting = false; painting = false;
  paintedTiles.clear(); dragStart = null;
  stage.classList.remove("dragging");
});
stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  zoom = Math.min(1.8, Math.max(0.5, zoom - e.deltaY * 0.0012));
  applyCam();
}, { passive: false });

/* ═══ TOOLBAR ═══ */
document.querySelector(".toolbar").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === "undo") undo();
  if (act === "redo") redo();
  if (act === "clear") { commit([]); spent = 0; beep(180, "break"); }

  if (act === "gravity") {
    gravity = !gravity;
    btn.classList.toggle("on", gravity);
    $("#gravLabel").textContent = gravity ? "ON" : "OFF";
    beep(gravity ? 560 : 260, "ui");
    if (gravity) {
      const n = unstable().length;
      flash(n ? `Gravity on — ${n} floating block${n > 1 ? "s" : ""} will collapse.`
              : "Gravity on — break a block and everything above it falls.", "var(--green)");
      if (n) setTimeout(cascade, 250);
    } else { flash("Gravity off — floating blocks stay put.", "var(--muted)"); render(); }
  }

  if (act === "sound") {
    sound = !sound;
    btn.classList.toggle("on", sound);
    $("#sndLabel").textContent = sound ? "ON" : "OFF";
    if (sound) beep(660, "ui");
  }

  if (act === "reset") { spin = 45; tilt = 58; zoom = 1; applyCam(true); beep(440, "ui"); }
  if (act === "demo") demo();
  if (act === "save") save();
  if (act === "load") load();
  if (act === "export") exportJSON();
});

/* ═══ SCENES ═══ */
function demo() {
  const out = [];
  for (let x = 1; x < 7; x++) {
    for (let y = 1; y < 7; y++) {
      const d = Math.max(Math.abs(x - 3.5), Math.abs(y - 3.5));
      const h = Math.max(1, Math.round(5 - d * 1.4));
      for (let z = 0; z < h; z++) {
        const t = TYPES[(x + y + z * 2) % TYPES.length].id;
        out.push({ id: ++uid, x, y, z, type: t, hp: type(t).hp });
      }
    }
  }
  commit(out);
  flash("Ziggurat loaded — switch to Demolish and wreck it.", "var(--cyan)");
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(scene.map(({ type: t, x, y, z }) => [t, x, y, z])));
    flash("Scene saved to this browser.", "var(--green)");
    beep(780, "ui");
  } catch { flash("Couldn't save — storage unavailable."); }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { flash("Nothing saved yet."); return; }
    commit(JSON.parse(raw).map(([t, x, y, z]) =>
      ({ id: ++uid, x, y, z, type: t, hp: type(t).hp, fresh: true })));
    flash("Scene restored.", "var(--green)");
    beep(620, "ui");
  } catch { flash("Saved scene is corrupt."); }
}

function exportJSON() {
  const blob = new Blob([jsonEl.textContent.replace(/<[^>]+>/g, "")], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "blockforge-scene.json";
  a.click();
  URL.revokeObjectURL(a.href);
  flash("Exported blockforge-scene.json", "var(--cyan)");
}

/* ═══ KEYBOARD ═══ */
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (e.ctrlKey || e.metaKey) {
    if (k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (k === "y") { e.preventDefault(); redo(); return; }
    if (k === "s") { e.preventDefault(); save(); return; }
  }
  if (k === "g") $("[data-act=gravity]").click();
  if (k === "s") $("[data-act=sound]").click();
  if (k === "0") $("[data-act=reset]").click();
  if (k === "b") setMode("build");
  if (k === "d") setMode("demolish");
  if (k === "c") setMode("challenge");
  if ((e.key === "Delete" || e.key === "Backspace") && selected) remove(selected);
  const i = "123456".indexOf(e.key);
  if (i > -1) setActive(TYPES[i].id);
});

/* ═══ GO ═══ */
$("[data-act=sound]").classList.add("on");
applyCam();
setActive(active);
setMode("build");
