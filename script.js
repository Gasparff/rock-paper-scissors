"use strict";

/* ---------- Reglas: cada opción y a quiénes vence ---------- */
const RULES = {
  scissors: ["paper", "lizard"],
  paper: ["rock", "spock"],
  rock: ["lizard", "scissors"],
  lizard: ["spock", "paper"],
  spock: ["scissors", "rock"],
};

const NAMES = {
  rock: "Piedra",
  paper: "Papel",
  scissors: "Tijera",
  lizard: "Lagarto",
  spock: "Spock",
};

const CHOICES = Object.keys(RULES);
const HOUSE_DELAY_MS = 1000;
const POPUP_DELAY_MS = 1500; // tiempo para ver las fichas y la onda antes del popup
const STORAGE_KEY = "rpsls-score";
const MOTION_KEY = "rpsls-motion";

/** Devuelve "win" | "lose" | "draw" desde el punto de vista del jugador. */
function getOutcome(player, house) {
  if (player === house) return "draw";
  return RULES[player].includes(house) ? "win" : "lose";
}

const randomChoice = () => CHOICES[Math.floor(Math.random() * CHOICES.length)];

/* ---------- Persistencia (con try/catch por si localStorage está bloqueado) ---------- */
function loadScore() {
  try {
    const n = Number.parseInt(localStorage.getItem(STORAGE_KEY), 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function saveScore(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch { /* el juego sigue sin persistir */ }
}

function loadMotion() {
  try {
    return localStorage.getItem(MOTION_KEY) !== "off";
  } catch {
    return true;
  }
}

function saveMotion(on) {
  try {
    localStorage.setItem(MOTION_KEY, on ? "on" : "off");
  } catch { /* nada */ }
}

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const board = $("board");
const result = $("result");
const scoreEl = $("score");
const playerSlot = $("player-slot");
const houseSlot = $("house-slot");
const verdictText = $("verdict-text");
const againBtn = $("again");
const rulesDialog = $("rules");
const popup = $("popup");
const motionToggle = $("motion-toggle");

/* Las animaciones están activas por defecto; solo se apagan con el botón. */
const motion = { on: loadMotion() };

function applyMotion() {
  document.body.classList.toggle("no-motion", !motion.on);
  motionToggle.textContent = `Animaciones: ${motion.on ? "sí" : "no"}`;
  motionToggle.setAttribute("aria-pressed", String(motion.on));
}

/* ---------- Fondo animado de puntos ---------- */
const CHOICE_COLORS = {
  rock: "340, 100%, 58%",
  paper: "330, 100%, 82%",
  scissors: "328, 100%, 62%",
  lizard: "318, 85%, 48%",
  spock: "325, 100%, 92%",
};

const bgFx = (() => {
  const canvas = $("bg");
  const ctx = canvas.getContext("2d");
  const mouse = { x: -9999, y: -9999 };
  const waves = [];
  const particles = [];
  let dots = [];
  let w = 0;
  let h = 0;
  let running = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const gap = w < 768 ? 30 : 38;
    dots = [];
    for (let y = gap / 2; y < h + gap; y += gap) {
      for (let x = gap / 2; x < w + gap; x += gap) {
        dots.push({ x, y, phase: Math.random() * Math.PI * 2 });
      }
    }
    if (!running) draw(performance.now());
  }

  function draw(now) {
    ctx.clearRect(0, 0, w, h);
    const t = motion.on ? now * 0.001 : 0;

    for (let i = waves.length - 1; i >= 0; i--) {
      if (now - waves[i].start > 2600) waves.splice(i, 1);
    }

    for (const d of dots) {
      // deriva suave en forma de ola
      let x = d.x + Math.sin(t * 0.8 + d.y * 0.012 + d.phase * 0.2) * 9;
      let y = d.y + Math.cos(t * 0.7 + d.x * 0.012) * 9;
      const glow = 0.5 + 0.5 * Math.sin(t * 1.4 + d.phase);
      let radius = 1.4 + glow * 0.8;
      let color = "255, 46, 147";
      let alpha = 0.12 + glow * 0.2;

      // el mouse empuja los puntos
      const mx = x - mouse.x;
      const my = y - mouse.y;
      const md = Math.hypot(mx, my);
      if (md < 150) {
        const f = (1 - md / 150) ** 2;
        x += (mx / (md || 1)) * f * 38;
        y += (my / (md || 1)) * f * 38;
        radius += f * 2.2;
        alpha += f * 0.5;
      }

      // la onda expansiva empuja y enciende los puntos
      for (const wv of waves) {
        const r = (now - wv.start) * 0.55;
        const dx = x - wv.x;
        const dy = y - wv.y;
        const dist = Math.hypot(dx, dy);
        const delta = Math.abs(dist - r);
        if (delta < 90) {
          const f = (1 - delta / 90) * (1 - (now - wv.start) / 2600);
          x += (dx / (dist || 1)) * f * 26;
          y += (dy / (dist || 1)) * f * 26;
          radius += f * 3;
          alpha += f * 0.7;
          color = wv.color;
        }
      }

      ctx.fillStyle = `rgba(${color}, ${Math.min(alpha, 0.95)})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // partículas de las explosiones
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= 0.016;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 0.06;
      p.x += p.vx;
      p.y += p.vy;
      ctx.fillStyle = `hsla(${p.color}, ${Math.min(p.life * 1.5, 1)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop(now) {
    draw(now);
    if (motion.on) {
      requestAnimationFrame(loop);
    } else {
      running = false;
    }
  }

  function start() {
    if (!motion.on || running) return;
    running = true;
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  document.documentElement.addEventListener("mouseleave", () => { mouse.x = mouse.y = -9999; });
  resize();

  return {
    start,
    redraw: () => draw(performance.now()),
    shockwave(x, y) {
      if (!motion.on) return;
      waves.push({ x, y, start: performance.now(), color: "255, 214, 236" });
    },
    burst(x, y, choice, count = 60) {
      if (!motion.on) return;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 7;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          size: 2 + Math.random() * 3.5,
          life: 0.8 + Math.random() * 0.9,
          color: CHOICE_COLORS[choice],
        });
      }
    },
  };
})();

/** Centro de un elemento en coordenadas de pantalla. */
function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Lanza la onda expansiva animada + partículas desde la ficha ganadora. */
function celebrate(slot, choice) {
  for (let i = 0; i < 3; i++) {
    const ring = document.createElement("span");
    ring.className = "shock";
    ring.style.setProperty("--i", i);
    slot.appendChild(ring);
  }
  const { x, y } = centerOf(slot);
  bgFx.burst(x, y, choice, 90);
  bgFx.shockwave(x, y);
  // la onda de puntos se repite al ritmo de las ondas CSS
  slot._waveTimer = setInterval(() => bgFx.shockwave(x, y), 2400);
}

function clearCelebration() {
  for (const slot of [playerSlot, houseSlot]) {
    clearInterval(slot._waveTimer);
    slot.querySelectorAll(".shock").forEach((n) => n.remove());
    slot.classList.remove("is-winner", "is-loser", "is-draw");
  }
}

/* ---------- Estado ---------- */
let score = loadScore();
let busy = false; // evita dobles clics mientras la casa "piensa"
let timer = null;
let popupTimer = null;

function renderScore(animate = false) {
  scoreEl.textContent = score;
  if (!animate || !motion.on) return;
  scoreEl.classList.remove("is-bumping");
  void scoreEl.offsetWidth; // reinicia la animación
  scoreEl.classList.add("is-bumping");
}

function buildChip(choice, { isNew = false } = {}) {
  const chip = document.createElement("div");
  chip.className = `chip chip--${choice}${isNew ? " is-new" : ""}`;
  chip.setAttribute("role", "img");
  chip.setAttribute("aria-label", NAMES[choice]);
  chip.innerHTML = `<span class="chip__inner"><span class="icon"></span></span>`;
  return chip;
}

/* Ejecuta el cambio de DOM con View Transition si el navegador la soporta */
function transition(update) {
  if (!document.startViewTransition || !motion.on) {
    update();
    return Promise.resolve();
  }
  return document.startViewTransition(update).finished.catch(() => {});
}

/* ---------- Popup del resultado ---------- */
function showPopup(player, house, outcome) {
  const copy = {
    win: { title: "¡Ganaste!", detail: `${NAMES[player]} vence a ${NAMES[house]}`, points: "+1 punto" },
    lose: { title: "Perdiste", detail: `${NAMES[house]} vence a ${NAMES[player]}`, points: "−1 punto" },
    draw: { title: "Empate", detail: `Los dos eligieron ${NAMES[player]}`, points: "0 puntos" },
  }[outcome];

  popup.dataset.outcome = outcome;
  $("popup-title").textContent = copy.title;
  $("popup-detail").textContent = copy.detail;
  $("popup-points").textContent = `${copy.points} · Total: ${score}`;

  const left = buildChip(player);
  const right = buildChip(house);
  if (outcome === "win") { left.classList.add("is-winner"); right.classList.add("is-loser"); }
  if (outcome === "lose") { right.classList.add("is-winner"); left.classList.add("is-loser"); }
  const vs = document.createElement("span");
  vs.className = "vs";
  vs.textContent = "VS";
  $("popup-chips").replaceChildren(left, vs, right);

  buildConfetti(outcome === "win");
  popup.showModal();
  $("popup-again").focus({ preventScroll: true });
}

function buildConfetti(enabled) {
  const box = $("popup-confetti");
  box.replaceChildren();
  if (!enabled || !motion.on) return;
  const colors = ["#ff2e93", "#ff0a7b", "#ff9ccb", "#fff4fa", "#a8004f", "#ff2e93"];
  for (let i = 0; i < 46; i++) {
    const c = document.createElement("i");
    c.className = "confetto";
    c.style.setProperty("--x", `${Math.random() * 100}%`);
    c.style.setProperty("--w", `${6 + Math.random() * 6}px`);
    c.style.setProperty("--c", colors[i % colors.length]);
    c.style.setProperty("--d", `${1.8 + Math.random() * 1.6}s`);
    c.style.setProperty("--delay", `${Math.random() * 0.6}s`);
    c.style.setProperty("--dx", `${(Math.random() - 0.5) * 220}px`);
    c.style.setProperty("--rot", `${(Math.random() - 0.5) * 900}deg`);
    box.appendChild(c);
  }
}

/* ---------- Flujo de una ronda ---------- */
function play(choice, trigger) {
  if (busy) return;
  busy = true;

  // la ficha del tablero y la del resultado comparten nombre: el navegador las "une"
  trigger.style.viewTransitionName = "player-chip";
  const origin = centerOf(trigger);
  bgFx.burst(origin.x, origin.y, choice, 24); // chispas al elegir

  transition(() => {
    clearCelebration();
    trigger.style.viewTransitionName = "";
    board.hidden = true;
    result.hidden = false;
    result.classList.remove("is-revealed");
    verdictText.textContent = "";

    const chip = buildChip(choice);
    chip.style.viewTransitionName = "player-chip";
    playerSlot.replaceChildren(chip);

    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    houseSlot.replaceChildren(placeholder);
  });

  const house = randomChoice();
  timer = setTimeout(() => reveal(choice, house), motion.on ? HOUSE_DELAY_MS : 0);
}

function reveal(player, house) {
  const outcome = getOutcome(player, house);

  houseSlot.replaceChildren(buildChip(house, { isNew: true }));
  result.classList.add("is-revealed");

  const messages = { win: "Ganaste", lose: "Perdiste", draw: "Empate" };
  verdictText.textContent = messages[outcome];

  if (outcome === "win") {
    playerSlot.classList.add("is-winner");
    houseSlot.classList.add("is-loser");
    celebrate(playerSlot, player);
  } else if (outcome === "lose") {
    houseSlot.classList.add("is-winner");
    playerSlot.classList.add("is-loser");
    celebrate(houseSlot, house);
  } else {
    playerSlot.classList.add("is-draw");
    houseSlot.classList.add("is-draw");
  }

  if (outcome !== "draw") {
    score += outcome === "win" ? 1 : -1;
    saveScore(score);
    renderScore(true);
  }

  busy = false;
  popupTimer = setTimeout(() => showPopup(player, house, outcome), motion.on ? POPUP_DELAY_MS : 0);
}

function reset() {
  clearTimeout(timer);
  clearTimeout(popupTimer);
  busy = false;
  if (popup.open) popup.close();
  clearCelebration();
  transition(() => {
    result.hidden = true;
    result.classList.remove("is-revealed");
    board.hidden = false;
  });
}

/* ---------- Eventos ---------- */
board.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-choice]");
  if (btn) play(btn.dataset.choice, btn);
});

againBtn.addEventListener("click", reset);
$("popup-again").addEventListener("click", reset);
$("popup-close").addEventListener("click", () => {
  popup.close();
  againBtn.focus({ preventScroll: true });
});

$("open-rules").addEventListener("click", () => rulesDialog.showModal());
$("close-rules").addEventListener("click", () => rulesDialog.close());
// clic en el fondo oscuro (fuera de la caja) cierra los modales
for (const dlg of [rulesDialog, popup]) {
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
}

motionToggle.addEventListener("click", () => {
  motion.on = !motion.on;
  saveMotion(motion.on);
  applyMotion();
  if (motion.on) bgFx.start();
});

applyMotion();
renderScore();
bgFx.start();
