/* ═══════════════════════════════════════════════════════
   SNAKE GAME — GAME LOGIC
   State machine, game loop, input, rendering, collision
   ═══════════════════════════════════════════════════════ */

// ─── Constants & Configuration ───
const CONFIG = {
  GRID_SIZE: 20,           // 20x20 grid
  CELL_SIZE: 30,           // 600 / 20 = 30px per cell
  CANVAS_SIZE: 600,        // 600×600 canvas
  GAME_SPEED: 150,         // ms per game tick (~6.7 ticks/sec)
  SCORE_PER_FRUIT: 10,     // Points per fruit
  INITIAL_LENGTH: 3,       // Starting snake length
};

// Total cells for victory check
const TOTAL_CELLS = CONFIG.GRID_SIZE * CONFIG.GRID_SIZE;

// ─── Skins & Fruit Configuration ───
const SKINS = {
  classic: { name: 'Classic Neon', head: '#00ff88', bodyStart: '#00cc6a', bodyEnd: '#008844' },
  blue: { name: 'Electric Blue', head: '#00f0ff', bodyStart: '#00a3ff', bodyEnd: '#0055ff' },
  purple: { name: 'Cyber Purple', head: '#d946ef', bodyStart: '#a21caf', bodyEnd: '#701a75' },
  gold: { name: 'Gold Aura', head: '#fbbf24', bodyStart: '#d97706', bodyEnd: '#b45309' }
};

const FRUIT_TYPES = {
  APPLE: { color: '#ff4466', score: 10, glow: '#ff4466', weight: 0.7, name: 'Apple' },
  GRAPE: { color: '#a855f7', score: 20, glow: '#a855f7', weight: 0.2, name: 'Grape' },
  STAR: { color: '#fbbf24', score: 30, glow: '#fbbf24', weight: 0.1, name: 'Gold Star' }
};

// ─── Game State ───
const GameStates = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
  VICTORY: 'VICTORY',
};

let state = {
  gameState: GameStates.MENU,
  snake: [],
  direction: { x: 1, y: 0 },
  nextDirection: { x: 1, y: 0 },
  fruit: { x: 0, y: 0 },
  fruitType: FRUIT_TYPES.APPLE,
  selectedSkin: 'classic',
  score: 0,
  gameLoopId: null,
  animationFrameId: null,
  lastRenderTime: 0,
  fruitPulse: 0,    // For fruit glow animation
};

// ─── DOM References ───
const DOM = {
  app: document.getElementById('app'),
  menuScreen: document.getElementById('menu-screen'),
  gameScreen: document.getElementById('game-screen'),
  gameoverModal: document.getElementById('gameover-modal'),
  victoryModal: document.getElementById('victory-modal'),
  pauseOverlay: document.getElementById('pause-overlay'),
  canvas: document.getElementById('game-canvas'),
  btnStart: document.getElementById('btn-start'),
  btnRestart: document.getElementById('btn-restart'),
  btnPlayAgain: document.getElementById('btn-play-again'),
  hudScore: document.getElementById('hud-score'),
  hudLength: document.getElementById('hud-length'),
  gameoverScore: document.getElementById('gameover-score'),
  victoryScore: document.getElementById('victory-score'),
};

const ctx = DOM.canvas.getContext('2d');

// ═══════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════

function initGame() {
  // Reset snake — starts at center, moving right
  const startX = Math.floor(CONFIG.GRID_SIZE / 2);
  const startY = Math.floor(CONFIG.GRID_SIZE / 2);

  state.snake = [];
  for (let i = 0; i < CONFIG.INITIAL_LENGTH; i++) {
    state.snake.push({ x: startX - i, y: startY });
  }

  // Reset direction
  state.direction = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };

  // Reset score
  state.score = 0;
  updateHUD();

  // Spawn first fruit
  spawnFruit();

  // Reset animation state
  state.fruitPulse = 0;
}

// ═══════════════════════════════════════════════════════
// FRUIT SPAWNING (FR-003)
// ═══════════════════════════════════════════════════════

function spawnFruit() {
  // Build set of occupied positions
  const occupied = new Set();
  for (const seg of state.snake) {
    occupied.add(`${seg.x},${seg.y}`);
  }

  // Collect all available cells
  const available = [];
  for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
      if (!occupied.has(`${x},${y}`)) {
        available.push({ x, y });
      }
    }
  }

  // If no available cells → victory is imminent (handled in game tick)
  if (available.length === 0) return;

  // Pick random available cell
  const idx = Math.floor(Math.random() * available.length);
  state.fruit = available[idx];

  // Roll for fruit type based on probabilities
  const rand = Math.random();
  if (rand < FRUIT_TYPES.APPLE.weight) {
    state.fruitType = FRUIT_TYPES.APPLE;
  } else if (rand < FRUIT_TYPES.APPLE.weight + FRUIT_TYPES.GRAPE.weight) {
    state.fruitType = FRUIT_TYPES.GRAPE;
  } else {
    state.fruitType = FRUIT_TYPES.STAR;
  }
}

// ═══════════════════════════════════════════════════════
// COLLISION DETECTION (FR-006)
// ═══════════════════════════════════════════════════════

function checkWallCollision(head) {
  return (
    head.x < 0 ||
    head.x >= CONFIG.GRID_SIZE ||
    head.y < 0 ||
    head.y >= CONFIG.GRID_SIZE
  );
}

function checkSelfCollision(head) {
  // Check against all body segments (skip head at index 0 since we check new position)
  for (let i = 0; i < state.snake.length; i++) {
    if (state.snake[i].x === head.x && state.snake[i].y === head.y) {
      return true;
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════
// GAME LOOP (Core tick logic)
// ═══════════════════════════════════════════════════════

function gameTick() {
  if (state.gameState !== GameStates.PLAYING) return;

  // 1. Apply buffered direction
  state.direction = { ...state.nextDirection };

  // 2. Calculate new head position
  const head = state.snake[0];
  const newHead = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y,
  };
  // 3. Check wall collision
  if (checkWallCollision(newHead)) {
    gameOver();
    return;
  }

  // 4. Check self collision
  if (checkSelfCollision(newHead)) {
    gameOver();
    return;
  }

  // 5. Check fruit collision
  const ateFruit = newHead.x === state.fruit.x && newHead.y === state.fruit.y;

  if (ateFruit) {
    // Score based on fruit type (FR-005)
    state.score += state.fruitType.score;
    triggerScorePop();
  } else {
    // Remove tail if no fruit eaten (FR-004)
    state.snake.pop();
  }

  // 6. Add new head
  state.snake.unshift(newHead);

  // 7. Check victory (FR-009)
  if (state.snake.length >= TOTAL_CELLS) {
    victory();
    return;
  }

  // 8. Spawn new fruit after eating
  if (ateFruit) {
    spawnFruit();
  }

  // 9. Update HUD
  updateHUD();
}

// ═══════════════════════════════════════════════════════
// RENDERING (Canvas 2D)
// ═══════════════════════════════════════════════════════

function renderLoop(timestamp) {
  state.animationFrameId = requestAnimationFrame(renderLoop);

  // Update fruit pulse animation
  state.fruitPulse = (timestamp || 0) * 0.003;

  render();
}

function render() {
  const { CELL_SIZE, GRID_SIZE, CANVAS_SIZE } = CONFIG;

  // Clear canvas
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // ─── Draw Grid ───
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < GRID_SIZE; i++) {
    const pos = i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, CANVAS_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(CANVAS_SIZE, pos);
    ctx.stroke();
  }

  // ─── Draw Snake ───
  const snakeLen = state.snake.length;
  const skin = SKINS[state.selectedSkin];

  for (let i = snakeLen - 1; i >= 0; i--) {
    const seg = state.snake[i];
    const px = seg.x * CELL_SIZE;
    const py = seg.y * CELL_SIZE;
    const isHead = i === 0;

    // Color gradient from head to tail
    const t = snakeLen > 1 ? i / (snakeLen - 1) : 0;

    if (isHead) {
      // Head — bright neon skin color with glow
      ctx.shadowColor = skin.head;
      ctx.shadowBlur = 15;
      ctx.fillStyle = skin.head;
    } else {
      // Body — gradient body color interpolating between bodyStart and bodyEnd
      ctx.fillStyle = getGradientColor(skin.bodyStart, skin.bodyEnd, t);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // Draw rounded rect
    const padding = isHead ? 1 : 2;
    const radius = isHead ? 6 : 4;
    drawRoundedRect(
      px + padding,
      py + padding,
      CELL_SIZE - padding * 2,
      CELL_SIZE - padding * 2,
      radius
    );

    // Draw eyes on head
    if (isHead) {
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      drawSnakeEyes(seg);
    }
  }

  // Reset shadow
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  // ─── Draw Fruit ───
  const fpx = state.fruit.x * CELL_SIZE + CELL_SIZE / 2;
  const fpy = state.fruit.y * CELL_SIZE + CELL_SIZE / 2;
  const fruitRadius = CELL_SIZE * 0.35;
  const pulseScale = 1 + Math.sin(state.fruitPulse) * 0.08;

  // Fruit glow
  ctx.shadowColor = state.fruitType.glow;
  ctx.shadowBlur = 12 + Math.sin(state.fruitPulse) * 6;

  // Fruit body
  ctx.fillStyle = state.fruitType.color;

  if (state.fruitType === FRUIT_TYPES.STAR) {
    // Draw Star
    drawStar(fpx, fpy, 5, fruitRadius * pulseScale, fruitRadius * 0.45 * pulseScale);
  } else if (state.fruitType === FRUIT_TYPES.GRAPE) {
    // Draw Grape Cluster (overlapping small circles)
    ctx.shadowBlur = 0; // reset for individual grapes
    ctx.beginPath();
    ctx.arc(fpx - 3, fpy - 3, fruitRadius * 0.5 * pulseScale, 0, Math.PI * 2);
    ctx.arc(fpx + 3, fpy - 3, fruitRadius * 0.5 * pulseScale, 0, Math.PI * 2);
    ctx.arc(fpx, fpy + 3, fruitRadius * 0.5 * pulseScale, 0, Math.PI * 2);
    ctx.fill();
    
    // Add a small stem
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fpx, fpy - 3);
    ctx.quadraticCurveTo(fpx - 2, fpy - 8, fpx + 1, fpy - 9);
    ctx.stroke();
  } else {
    // Classic Apple
    ctx.beginPath();
    ctx.arc(fpx, fpy, fruitRadius * pulseScale, 0, Math.PI * 2);
    ctx.fill();

    // Fruit highlight
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(fpx - fruitRadius * 0.25, fpy - fruitRadius * 0.25, fruitRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Fruit stem
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fpx, fpy - fruitRadius * pulseScale);
    ctx.lineTo(fpx + 3, fpy - fruitRadius * pulseScale - 6);
    ctx.stroke();
  }
}

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function drawSnakeEyes(head) {
  const { CELL_SIZE } = CONFIG;
  const px = head.x * CELL_SIZE;
  const py = head.y * CELL_SIZE;
  const cx = px + CELL_SIZE / 2;
  const cy = py + CELL_SIZE / 2;

  const eyeOffset = 5;
  const eyeRadius = 3;
  const pupilRadius = 1.5;

  let eye1, eye2;

  // Position eyes based on direction
  const dir = state.direction;
  if (dir.x === 1) { // Right
    eye1 = { x: cx + 5, y: cy - eyeOffset };
    eye2 = { x: cx + 5, y: cy + eyeOffset };
  } else if (dir.x === -1) { // Left
    eye1 = { x: cx - 5, y: cy - eyeOffset };
    eye2 = { x: cx - 5, y: cy + eyeOffset };
  } else if (dir.y === -1) { // Up
    eye1 = { x: cx - eyeOffset, y: cy - 5 };
    eye2 = { x: cx + eyeOffset, y: cy - 5 };
  } else { // Down
    eye1 = { x: cx - eyeOffset, y: cy + 5 };
    eye2 = { x: cx + eyeOffset, y: cy + 5 };
  }

  // Draw eye whites
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(eye1.x, eye1.y, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eye2.x, eye2.y, eyeRadius, 0, Math.PI * 2);
  ctx.fill();

  // Draw pupils
  ctx.fillStyle = '#0a0a1a';
  ctx.beginPath();
  ctx.arc(eye1.x + dir.x * 1, eye1.y + dir.y * 1, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eye2.x + dir.x * 1, eye2.y + dir.y * 1, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
}

// ═══════════════════════════════════════════════════════
// HUD UPDATE
// ═══════════════════════════════════════════════════════

function updateHUD() {
  DOM.hudScore.textContent = state.score;
  DOM.hudLength.textContent = state.snake.length;
}

function triggerScorePop() {
  DOM.hudScore.classList.remove('pop');
  // Force reflow to restart animation
  void DOM.hudScore.offsetWidth;
  DOM.hudScore.classList.add('pop');
}

// ═══════════════════════════════════════════════════════
// GAME STATE TRANSITIONS
// ═══════════════════════════════════════════════════════

function startGame() {
  // Initialize game state
  initGame();

  // Switch to game screen
  showScreen('game-screen');
  hideModal('gameover-modal');
  hideModal('victory-modal');
  hideModal('pause-overlay');

  // Set state
  state.gameState = GameStates.PLAYING;

  // Start game loop (fixed tick rate)
  if (state.gameLoopId) clearInterval(state.gameLoopId);
  state.gameLoopId = setInterval(gameTick, CONFIG.GAME_SPEED);

  // Start render loop (smooth animation)
  if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
  state.animationFrameId = requestAnimationFrame(renderLoop);

  // Initial render
  render();
}

function gameOver() {
  state.gameState = GameStates.GAME_OVER;

  // Stop game loop
  if (state.gameLoopId) {
    clearInterval(state.gameLoopId);
    state.gameLoopId = null;
  }

  // Update modal score
  DOM.gameoverScore.textContent = state.score;

  // Show game over modal
  showModal('gameover-modal');
}

function victory() {
  state.gameState = GameStates.VICTORY;

  // Stop game loop
  if (state.gameLoopId) {
    clearInterval(state.gameLoopId);
    state.gameLoopId = null;
  }

  // Update modal score
  DOM.victoryScore.textContent = state.score;

  // Show victory modal
  showModal('victory-modal');
}

function restartGame() {
  // Stop everything
  if (state.gameLoopId) {
    clearInterval(state.gameLoopId);
    state.gameLoopId = null;
  }
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }

  // Hide modals
  hideModal('gameover-modal');
  hideModal('victory-modal');
  hideModal('pause-overlay');

  // Go back to menu
  state.gameState = GameStates.MENU;
  showScreen('menu-screen');
}

function togglePause() {
  if (state.gameState === GameStates.PLAYING) {
    state.gameState = GameStates.PAUSED;
    clearInterval(state.gameLoopId);
    state.gameLoopId = null;
    showModal('pause-overlay');
  } else if (state.gameState === GameStates.PAUSED) {
    state.gameState = GameStates.PLAYING;
    hideModal('pause-overlay');
    state.gameLoopId = setInterval(gameTick, CONFIG.GAME_SPEED);
  }
}

// ═══════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════

function showScreen(screenId) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.remove('active');
  });
  // Show target screen
  document.getElementById(screenId).classList.add('active');
}

function showModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function hideModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// ═══════════════════════════════════════════════════════
// INPUT HANDLING (FR-002)
// ═══════════════════════════════════════════════════════

// Direction mapping
const KEY_MAP = {
  // WASD
  'KeyW': { x: 0, y: -1 },
  'KeyA': { x: -1, y: 0 },
  'KeyS': { x: 0, y: 1 },
  'KeyD': { x: 1, y: 0 },
  // Arrow Keys
  'ArrowUp': { x: 0, y: -1 },
  'ArrowLeft': { x: -1, y: 0 },
  'ArrowDown': { x: 0, y: 1 },
  'ArrowRight': { x: 1, y: 0 },
};

document.addEventListener('keydown', (e) => {
  const code = e.code;

  // ─── Movement keys ───
  if (KEY_MAP[code]) {
    e.preventDefault(); // Prevent scrolling with arrow keys

    if (state.gameState !== GameStates.PLAYING) return;

    const newDir = KEY_MAP[code];

    // Anti-180° check: reject if new direction is opposite of current
    if (
      newDir.x + state.direction.x === 0 &&
      newDir.y + state.direction.y === 0
    ) {
      return;
    }

    // Buffer the next direction (applied on next tick)
    state.nextDirection = { ...newDir };
    return;
  }

  // ─── Pause toggle ───
  if (code === 'KeyP' || code === 'Escape') {
    if (
      state.gameState === GameStates.PLAYING ||
      state.gameState === GameStates.PAUSED
    ) {
      e.preventDefault();
      togglePause();
    }
    return;
  }

  // ─── Enter/Space for menu interactions ───
  if (code === 'Enter' || code === 'Space') {
    e.preventDefault();

    if (state.gameState === GameStates.MENU) {
      startGame();
    } else if (state.gameState === GameStates.GAME_OVER || state.gameState === GameStates.VICTORY) {
      restartGame();
    }
    return;
  }
});

// ═══════════════════════════════════════════════════════
// BUTTON EVENT BINDINGS
// ═══════════════════════════════════════════════════════

DOM.btnStart.addEventListener('click', startGame);
DOM.btnRestart.addEventListener('click', restartGame);
DOM.btnPlayAgain.addEventListener('click', restartGame);

// ═══════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════

// ─── Helpers ───
function getGradientColor(colorStart, colorEnd, t) {
  const hex = (h) => {
    const num = parseInt(h.slice(1), 16);
    return [ (num >> 16) & 255, (num >> 8) & 255, num & 255 ];
  };
  const c1 = hex(colorStart);
  const c2 = hex(colorEnd);
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  let step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

// ─── Skin Selection Handlers ───
document.querySelectorAll('.skin-opt').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.skin-opt').forEach(opt => opt.classList.remove('active'));
    btn.classList.add('active');
    
    state.selectedSkin = btn.dataset.skin;
    
    const skin = SKINS[state.selectedSkin];
    const nameEl = document.getElementById('selected-skin-name');
    nameEl.textContent = skin.name;
    nameEl.style.color = skin.head;
  });
});

// ─── Mobile Touch Bindings ───
const bindMobileButton = (id, direction) => {
  const btn = document.getElementById(id);
  if (!btn) return;
  
  const handlePress = (e) => {
    e.preventDefault();
    if (state.gameState !== GameStates.PLAYING) return;
    
    if (
      direction.x + state.direction.x === 0 &&
      direction.y + state.direction.y === 0
    ) {
      return;
    }
    state.nextDirection = { ...direction };
  };
  
  btn.addEventListener('touchstart', handlePress, { passive: false });
  btn.addEventListener('mousedown', handlePress);
};

bindMobileButton('ctrl-up', { x: 0, y: -1 });
bindMobileButton('ctrl-left', { x: -1, y: 0 });
bindMobileButton('ctrl-down', { x: 0, y: 1 });
bindMobileButton('ctrl-right', { x: 1, y: 0 });

// Show menu on load
showScreen('menu-screen');
