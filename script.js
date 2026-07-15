/* ───────────────────────────────────────────────
   BlockForge — CodePen Challenge: Blocks
   Isometric grid · palette · stacking · gravity
   Ghost preview · paint mode · orbit camera
   Structural integrity · chain collapse · sound
   ─────────────────────────────────────────────── */

const SIZE = 8;
const TILE = 60;
const LIFT = 26;
const MAX_Z = 6;
const HALF = (SIZE * TILE) / 2;
const KEY = "blockforge.scene";

const TYPES = [
  { id: "core",  label: "Core",  tone: "var(--cyan)",   hex: "#53f4ff", note: "base unit", mass: 3 },
  { id: "pulse", label: "Pulse", tone: "var(--pink)",   hex: "#ff4fd8", note: "emitter",   mass: 2 },
  { id: "solar", label: "Solar", tone: "var(--yellow)", hex: "#ffd166", note: "power",     mass: 2 },
  { id: "moss",  label: "Moss",  tone: "var(--green)",  hex: "#7cff9b", note: "organic",   mass: 1 },
  { id: "void",  label: "Void",  tone: "var(--purple)", hex: "#b98bff", note: "absorbs",   mass: 4 },
  { id: "ember", label: "Ember", tone: "var(--orange)", hex: "#ff8a5b", note: "unstable",  mass: 1 }
];

const $ = (s) => document.querySelector(s);
const stage     = $("#stage");
const scene3d   = $("#scene3d");
const gridEl    = $("#grid");
const blocksEl  = $("#blocks");
const sparksEl  = $("#sparks");
const paletteEl = $("#palette");
const inspectEl = $("#inspector");
const jsonEl    = $("#json");
const hintEl    = $("#hint");

/* ── state ── */
let scene    = [];              // { id, x, y, z, type }
let past     = [];
let future   = [];
let active   = TYPES[0].id;
let selected = null;
let uid      = 0;

let gravity  = false;
let sound    = true;
let audio    = null;

let spin = 45, tilt = 58, zoom = 1;
let orbiting = false, painting = false, paintedTiles = new Set();
let dragStart = null;

const type = (id) => TYPES.find((t) => t.id === id);
const toneOf = (id) => type(id).tone;
const column = (x, y) => scene.filter((b) => b.x === x && b.y === y);
const heightAt = (x, y) => column(x, y).reduce((m, b) => Math.max(m, b.z + 1), 0);
const at = (x, y, z) => scene.find((b) => b.x === x && b.y === y && b.z === z);

/* a block is supported if z===0 or something sits directly beneath it */
const supported = (b) => b.z === 0 || !!at(b.x, b.y, b.z - 1);
const unstable = () => scene.filter((b) => !supported(b));

/* ═══════════════ PALETTE ═══════════════ */
TYPES.forEach((t, i) => {
  const chip = document.createElement("button");
  chip.className = "chip";
  chip.style.setProperty("--tone", t.tone);
  chip.setAttribute("aria-pressed", String(t.id === active));
  chip.dataset.type = t.id;
  chip.draggable = true;
  chip.innerHTML = `
    <span class="swatch"></span>
    <span>${t.label}<small>${t.note} · m${t.mass}</small></span>
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
    c.setAttribute("aria-pressed", String(c.dataset.type === id))
  );
  ghost.style.setProperty("--tone", toneOf(id));
  beep(700, "ui");
}

/* ═══════════════ GHOST ═══════════════ */
const ghost = document.createElement("div");
ghost.className = "ghost";
ghost.innerHTML = `<div class="face top"></div><div class="face n"></div><div class="face e"></div>`;
ghost.style.setProperty("--tone", toneOf(active));
blocksEl.appendChild(ghost);

function showGhost(x, y) {
  const z = heightAt(x, y);
  if (z >= MAX_Z) { ghost.classList.remove("show"); return; }
  ghost.style.transform =
    `translate3d(${x * TILE - HALF}px, ${y * TILE - HALF}px, ${z * LIFT}px)`;
  ghost.classList.add("show");
}
const hideGhost = () => ghost.classList.remove("show");

/* ═══════════════ GRID ═══════════════ */
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.x = x;
    tile.dataset.y = y;

    tile.addEventListener("pointerenter", () => {
      showGhost(x, y);
      if (painting) paintTile(x, y);
    });
    tile.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      painting = true;
      paintedTiles.clear();
      paintTile(x, y);
    });
    tile.addEventListener("dragover", (e) => { e.preventDefault(); showGhost(x, y); });
    tile.addEventListener("drop", (e) => {
      e.preventDefault();
      place(x, y, e.dataTransfer.getData("text/plain") || active);
    });
    gridEl.appendChild(tile);
  }
}
gridEl.addEventListener("pointerleave", hideGhost);

function paintTile(x, y) {
  const key = `${x},${y}`;
  if (paintedTiles.has(key)) return;
  paintedTiles.add(key);
  place(x, y, active, true);
  showGhost(x, y);
}

/* ═══════════════ MUTATIONS ═══════════════ */
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

  if (batched) {
    // paint mode: mutate without flooding the undo stack per tile
    scene = [...scene, { id: ++uid, x, y, z, type: t, fresh: true }];
    render();
  } else {
    commit([...scene, { id: ++uid, x, y, z, type: t, fresh: true }]);
  }
  burst(x, y, z, toneOf(t), 9);
  beep(190 + z * 45, "place");
}

function remove(id) {
  const b = scene.find((n) => n.id === id);
  if (!b) return;

  const isTop = b.z === heightAt(b.x, b.y) - 1;
  if (!gravity && !isTop) { flash("Gravity is off — clear the block above first."); return; }

  if (selected === id) selected = null;
  burst(b.x, b.y, b.z, toneOf(b.type), 14);
  beep(340, "break");

  let next = scene.filter((n) => n.id !== id);
  if (gravity) next = settle(next, b.x, b.y);
  commit(next);
}

/* drop every block in a column down into the gaps beneath it */
function settle(list, x, y) {
  const col = list
    .filter((b) => b.x === x && b.y === y)
    .sort((a, b) => a.z - b.z);

  let moved = false;
  col.forEach((b, i) => {
    if (b.z !== i) {
      b.fz = b.z;          // remembered start height, for the fall animation
      b.z = i;
      b.falling = true;
      moved = true;
    }
  });

  if (moved) {
    setTimeout(() => beep(130, "thud"), 220);
    setTimeout(() => cascade(), 340);   // let neighbours react
  }
  return list;
}

/* chain reaction: any floating block anywhere falls too */
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

function flash(msg, tone = "var(--pink)") {
  hintEl.textContent = msg;
  hintEl.style.color = tone;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => { hintEl.style.color = ""; }, 1600);
}

/* ═══════════════ RENDER ═══════════════ */
function render() {
  const floats = new Set(unstable().map((b) => b.id));

  [...blocksEl.querySelectorAll(".block")].forEach((n) => n.remove());

  [...scene].sort((a, b) => a.z - b.z).forEach((b) => {
    const el = document.createElement("div");
    el.className = "block";
    if (b.id === selected) el.classList.add("sel");
    if (floats.has(b.id) && !b.falling) el.classList.add("unstable");

    el.style.setProperty("--tone", toneOf(b.type));
    el.style.setProperty("--x", `${b.x * TILE - HALF}px`);
    el.style.setProperty("--y", `${b.y * TILE - HALF}px`);
    el.style.setProperty("--z", `${b.z * LIFT}px`);
    el.style.transform =
      `translate3d(${b.x * TILE - HALF}px, ${b.y * TILE - HALF}px, ${b.z * LIFT}px)`;

    if (b.falling) {
      el.style.setProperty("--fz", `${(b.fz ?? b.z + 1) * LIFT}px`);
      el.classList.add("falling");
      el.addEventListener("animationend", () => {
        el.classList.remove("falling");
        el.classList.add("landed");
        burst(b.x, b.y, b.z, toneOf(b.type), 5, 0.5);
      }, { once: true });
      delete b.falling; delete b.fz;
    } else if (b.fresh) {
      el.classList.add("fresh");
      delete b.fresh;
    }

    el.innerHTML = `<div class="face top"></div><div class="face n"></div><div class="face e"></div>`;
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      selected = b.id;
      render();
    });
    el.addEventListener("dblclick", (e) => { e.stopPropagation(); remove(b.id); });
    el.addEventListener("mouseenter", () => inspect(b));
    blocksEl.appendChild(el);
  });

  gridEl.querySelectorAll(".tile").forEach((t) => {
    t.classList.toggle("occupied", heightAt(+t.dataset.x, +t.dataset.y) > 0);
  });

  const maxH = scene.reduce((m, b) => Math.max(m, b.z + 1), 0);
  const stability = scene.length
    ? Math.round(((scene.length - floats.size) / scene.length) * 100)
    : 100;

  $("#statBlocks").textContent = scene.length;
  $("#statHeight").textContent = maxH;
  $("#statStable").innerHTML = `${stability}<i>%</i>`;
  $("#statStable").style.color = stability < 100 ? "var(--pink)" : "";

  $("[data-act=undo]").disabled = !past.length;
  $("[data-act=redo]").disabled = !future.length;

  inspect(scene.find((b) => b.id === selected));
  paintJSON(maxH, stability, floats.size);
}

function inspect(b) {
  if (!b) {
    inspectEl.innerHTML = `<p class="empty">
      <b>Click</b> a tile to place · <b>drag</b> across tiles to paint<br>
      <b>Double-click</b> a block to break it<br>
      <b>Drag</b> empty space to orbit · <b>scroll</b> to zoom<br>
      <b>1–6</b> pick type · <b>G</b> gravity · <b>Del</b> remove</p>`;
    return;
  }
  const t = type(b.type);
  const float = !supported(b);
  inspectEl.innerHTML = `
    <div class="row"><span>type</span><span style="color:${t.tone}">${t.label}</span></div>
    <div class="row"><span>id</span><span>#${b.id}</span></div>
    <div class="row"><span>position</span><span>${b.x}, ${b.y}, z${b.z}</span></div>
    <div class="row"><span>mass</span><span>${t.mass}</span></div>
    <div class="row"><span>load above</span><span>${column(b.x, b.y).filter((n) => n.z > b.z).reduce((s, n) => s + type(n.type).mass, 0)}</span></div>
    <div class="row"><span>state</span>${
      float ? `<span class="badge">floating</span>`
            : `<span style="color:var(--green)">supported</span>`}</div>`;
}

function paintJSON(maxH, stability, floating) {
  const mass = scene.reduce((s, b) => s + type(b.type).mass, 0);
  const data = {
    grid: `${SIZE}×${SIZE}×${MAX_Z}`,
    blocks: scene.length,
    height: maxH,
    mass,
    stability: `${stability}%`,
    floating,
    gravity,
    scene: scene.map(({ type: t, x, y, z }) => [t, x, y, z])
  };
  jsonEl.innerHTML = JSON.stringify(data, null, 1)
    .replace(/"([^"]+)":/g, '<span class="k">"$1"</span>:')
    .replace(/: ("[^"]*"|\d+|true|false)/g, ': <span class="v">$1</span>');
}

/* ═══════════════ PARTICLES ═══════════════ */
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

/* ═══════════════ SOUND ═══════════════ */
function beep(freq, kind) {
  if (!sound) return;
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === "suspended") audio.resume();

  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  const cfg = {
    place: { type: "triangle", to: freq * 2.2, dur: 0.13, vol: 0.14 },
    break: { type: "sawtooth", to: freq * 0.32, dur: 0.20, vol: 0.11 },
    thud:  { type: "sine",     to: freq * 0.45, dur: 0.26, vol: 0.20 },
    ui:    { type: "square",   to: freq,        dur: 0.05, vol: 0.05 }
  }[kind] || { type: "sine", to: freq, dur: 0.1, vol: 0.1 };

  osc.type = cfg.type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, cfg.to), t + cfg.dur);
  gain.gain.setValueAtTime(cfg.vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + cfg.dur);

  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + cfg.dur + 0.02);
}

/* ═══════════════ CAMERA ═══════════════ */
function applyCam(snap = false) {
  scene3d.classList.toggle("snap", snap);
  scene3d.style.setProperty("--spin", `${spin}deg`);
  scene3d.style.setProperty("--tilt", `${tilt}deg`);
  scene3d.style.setProperty("--zoom", zoom);
  if (snap) setTimeout(() => scene3d.classList.remove("snap"), 520);
}

stage.addEventListener("pointerdown", (e) => {
  if (e.target !== stage && e.target !== scene3d) return;
  orbiting = true;
  selected = null;
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
  orbiting = false;
  painting = false;
  paintedTiles.clear();
  dragStart = null;
  stage.classList.remove("dragging");
});

stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  zoom = Math.min(1.8, Math.max(0.5, zoom - e.deltaY * 0.0012));
  applyCam();
}, { passive: false });

/* ═══════════════ TOOLBAR ═══════════════ */
document.querySelector(".toolbar").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === "undo") undo();
  if (act === "redo") redo();
  if (act === "clear") { commit([]); beep(180, "break"); }

  if (act === "gravity") {
    gravity = !gravity;
    btn.classList.toggle("on", gravity);
    $("#gravLabel").textContent = gravity ? "ON" : "OFF";
    beep(gravity ? 560 : 260, "ui");
    if (gravity) {
      const n = unstable().length;
      flash(n ? `Gravity on — ${n} floating block${n > 1 ? "s" : ""} will collapse.`
              : "Gravity on — break a block and everything above it falls.",
            "var(--green)");
      if (n) setTimeout(cascade, 250);
    } else {
      flash("Gravity off — floating blocks stay put.", "var(--muted)");
      render();
    }
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

/* ═══════════════ SCENES ═══════════════ */
function demo() {
  const out = [];
  for (let x = 1; x < 7; x++) {
    for (let y = 1; y < 7; y++) {
      const d = Math.max(Math.abs(x - 3.5), Math.abs(y - 3.5));
      const h = Math.max(1, Math.round(5 - d * 1.4));
      for (let z = 0; z < h; z++) {
        out.push({ id: ++uid, x, y, z, type: TYPES[(x + y + z * 2) % TYPES.length].id });
      }
    }
  }
  commit(out);
  flash("Ziggurat loaded — turn on Gravity, then carve into it.", "var(--cyan)");
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
    const data = JSON.parse(raw);
    commit(data.map(([t, x, y, z]) => ({ id: ++uid, x, y, z, type: t, fresh: true })));
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

/* ═══════════════ KEYBOARD ═══════════════ */
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
  if (e.key === "Delete" || e.key === "Backspace") { if (selected) remove(selected); }
  const i = "123456".indexOf(e.key);
  if (i > -1) setActive(TYPES[i].id);
});

/* ═══════════════ GO ═══════════════ */
$("[data-act=sound]").classList.add("on");
applyCam();
setActive(active);
render();
