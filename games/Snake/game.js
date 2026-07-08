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
  // Ular
  classic: { name: 'Classic Neon', char: 'ular', head: '#00ff88', bodyStart: '#00cc6a', bodyEnd: '#008844' },
  blue: { name: 'Electric Blue', char: 'ular', head: '#00f0ff', bodyStart: '#00a3ff', bodyEnd: '#0055ff' },
  purple: { name: 'Cyber Purple', char: 'ular', head: '#d946ef', bodyStart: '#a21caf', bodyEnd: '#701a75' },
  gold: { name: 'Gold Aura', char: 'ular', head: '#fbbf24', bodyStart: '#d97706', bodyEnd: '#b45309' },
  // Naga
  naga_fire: { name: 'Fire Dragon', char: 'naga', head: '#ff3a00', bodyStart: '#ff7e00', bodyEnd: '#ffd000' },
  naga_ice: { name: 'Ice Dragon', char: 'naga', head: '#00f0ff', bodyStart: '#38bdf8', bodyEnd: '#1e3a8a' },
  naga_shadow: { name: 'Shadow Dragon', char: 'naga', head: '#a21caf', bodyStart: '#581c87', bodyEnd: '#1e1b4b' },
  // Cacing
  cacing_earth: { name: 'Earth Worm', char: 'cacing', head: '#a87043', bodyStart: '#82522c', bodyEnd: '#573315' },
  cacing_sand: { name: 'Sand Worm', char: 'cacing', head: '#d9a05b', bodyStart: '#b07a3e', bodyEnd: '#784f23' },
  cacing_grub: { name: 'Albino Grub', char: 'cacing', head: '#fbcfe8', bodyStart: '#f472b6', bodyEnd: '#db2777' }
};

const FRUIT_TYPES = {
  APPLE: { color: '#ff4466', score: 10, glow: '#ff4466', weight: 0.7, name: 'Apple' },
  GRAPE: { color: '#a855f7', score: 20, glow: '#a855f7', weight: 0.2, name: 'Grape' },
  STAR: { color: '#fbbf24', score: 30, glow: '#fbbf24', weight: 0.1, name: 'Gold Star' }
};

const POWERUP_TYPES = {
  FREEZE: { id: 'freeze', name: 'Ice Freeze', icon: '❄️', color: '#00f0ff', duration: 8000, speed: 230 },
  GOLD: { id: 'gold', name: 'Golden Rush', icon: '👑', color: '#fbbf24', duration: 8000, speed: 95 },
  SHRINK: { id: 'shrink', name: 'Shrink Potion', icon: '🧪', color: '#ff0055', duration: 0, speed: null }
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
  selectedCharacter: 'ular',
  selectedSkin: 'classic',
  score: 0,
  highScore: 0,
  gameLoopId: null,
  animationFrameId: null,
  lastRenderTime: 0,
  fruitPulse: 0,    // For fruit glow animation
  
  // Powerups and visual effects state
  particles: [],
  screenShake: 0,
  spawnedPowerUp: null, // { x, y, type, despawnTime }
  activePowerUp: null,  // { id, name, icon, color, timeLeft, totalDuration }

  // Achievements tracking
  fruitsEatenThisMatch: 0,
  matchStartTime: 0,
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
  hudHighscore: document.getElementById('hud-highscore'),
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

  // Reset score & load high score
  state.score = 0;
  state.highScore = parseInt(localStorage.getItem('snake_highscore')) || 0;
  updateHUD();

  // Reset power-ups & visual effects
  state.particles = [];
  state.screenShake = 0;
  state.spawnedPowerUp = null;
  state.activePowerUp = null;
  
  if (state.gameLoopId) clearInterval(state.gameLoopId);
  updatePowerUpHUD();

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

  // 1. Handle spawned power-up despawn check
  if (state.spawnedPowerUp && Date.now() >= state.spawnedPowerUp.despawnTime) {
    state.spawnedPowerUp = null;
  }

  // 2. Handle active power-up timer countdown
  if (state.activePowerUp) {
    const currentTickSpeed = state.activePowerUp.id === 'freeze' 
      ? POWERUP_TYPES.FREEZE.speed 
      : (state.activePowerUp.id === 'gold' ? POWERUP_TYPES.GOLD.speed : CONFIG.GAME_SPEED);
    
    state.activePowerUp.timeLeft -= currentTickSpeed;
    if (state.activePowerUp.timeLeft <= 0) {
      deactivatePowerUp();
    } else {
      updatePowerUpHUD();
    }
  }

  // 3. Apply buffered direction
  state.direction = { ...state.nextDirection };

  // 4. Calculate new head position
  const head = state.snake[0];
  const newHead = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y,
  };
  
  // 5. Check wall collision
  if (checkWallCollision(newHead)) {
    gameOver();
    return;
  }

  // 6. Check self collision
  if (checkSelfCollision(newHead)) {
    gameOver();
    return;
  }

  // 7. Check collision with spawned power-up
  const atePowerUp = state.spawnedPowerUp && newHead.x === state.spawnedPowerUp.x && newHead.y === state.spawnedPowerUp.y;

  if (atePowerUp) {
    const powerUpType = state.spawnedPowerUp.type;
    createExplosion(state.spawnedPowerUp.x, state.spawnedPowerUp.y, powerUpType.color, 25, true);
    state.screenShake = 18;
    
    activatePowerUp(powerUpType);
    state.spawnedPowerUp = null;
  }

  // 8. Check fruit collision
  const ateFruit = newHead.x === state.fruit.x && newHead.y === state.fruit.y;

  if (ateFruit) {
    // Score based on fruit type (with 2x multiplier if Gold active)
    const multiplier = (state.activePowerUp && state.activePowerUp.id === 'gold') ? 2 : 1;
    state.score += state.fruitType.score * multiplier;
    triggerScorePop();

    // Increment fruits eaten
    state.fruitsEatenThisMatch++;

    // Check fruit achievements
    if (typeof GameHubAchievements !== 'undefined') {
      if (state.fruitsEatenThisMatch >= 10) {
        GameHubAchievements.unlock('snake', 'hungry');
      }
      if (state.fruitsEatenThisMatch >= 50) {
        GameHubAchievements.unlock('snake', 'hang');
      }
      if (state.fruitsEatenThisMatch >= 250) {
        GameHubAchievements.unlock('snake', 'conqueror');
      }
      if (state.fruitsEatenThisMatch >= 1000) {
        GameHubAchievements.unlock('snake', 'god');
      }
    }

    // Update and persist high score in real-time
    if (state.score > state.highScore) {
      state.highScore = state.score;
      localStorage.setItem('snake_highscore', state.highScore);
    }

    // Play satisfactory eating sound effect
    playEatSound();

    // Create explosion effect when eating (will check selected skin inside createExplosion)
    createExplosion(state.fruit.x, state.fruit.y, state.fruitType.color, 15, false);
    
    // Slight screen shake for Gold Star fruit
    if (state.fruitType === FRUIT_TYPES.STAR) {
      state.screenShake = 12;
    } else {
      state.screenShake = 5;
    }
  } else if (!atePowerUp) {
    // Remove tail if no fruit or power-up was eaten
    state.snake.pop();
  }

  // 9. Add new head
  state.snake.unshift(newHead);

  // 10. Spawn particles trail for active powerups
  if (state.activePowerUp && Math.random() < 0.45) {
    const tailSeg = state.snake[state.snake.length - 1];
    createExplosion(tailSeg.x, tailSeg.y, state.activePowerUp.color, 1, true);
  }

  // 11. Check victory (FR-009)
  if (state.snake.length >= TOTAL_CELLS) {
    victory();
    return;
  }

  // 12. Spawn new fruit & try to spawn a power-up
  if (ateFruit) {
    spawnFruit();
    trySpawnPowerUp();
  }

  // Check survival time achievement (2 minutes = 120,000 ms)
  if (state.matchStartTime && Date.now() - state.matchStartTime >= 120000) {
    if (typeof GameHubAchievements !== 'undefined') {
      GameHubAchievements.unlock('snake', 'survivor');
    }
  }

  // 13. Update HUD
  updateHUD();
}

// ═══════════════════════════════════════════════════════
// RENDERING (Canvas 2D)
// ═══════════════════════════════════════════════════════

function renderLoop(timestamp) {
  state.animationFrameId = requestAnimationFrame(renderLoop);

  // Update fruit pulse animation
  state.fruitPulse = (timestamp || 0) * 0.003;

  // Update particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    state.particles[i].update();
    if (state.particles[i].alpha <= 0) {
      state.particles.splice(i, 1);
    }
  }

  // Decay screen shake
  if (state.screenShake > 0) {
    state.screenShake *= 0.88;
    if (state.screenShake < 0.3) state.screenShake = 0;
  }

  render();
}

function render() {
  const { CELL_SIZE, GRID_SIZE, CANVAS_SIZE } = CONFIG;

  ctx.save();
  // Apply Screen Shake
  if (state.screenShake > 0.5) {
    const dx = (Math.random() - 0.5) * state.screenShake;
    const dy = (Math.random() - 0.5) * state.screenShake;
    ctx.translate(dx, dy);
  }

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

  // ─── Draw Particles ───
  state.particles.forEach(p => p.draw(ctx));

  // ─── Draw Snake ───
  const snakeLen = state.snake.length;
  let skin = { ...SKINS[state.selectedSkin] };
  if (state.activePowerUp) {
    if (state.activePowerUp.id === 'freeze') {
      skin.head = '#00f0ff';
      skin.bodyStart = '#38bdf8';
      skin.bodyEnd = '#1e3a8a';
    } else if (state.activePowerUp.id === 'gold') {
      skin.head = '#facc15';
      skin.bodyStart = '#facc15';
      skin.bodyEnd = '#854d0e';
    }
  }

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

  // ─── Draw Spawned Power-Up ───
  if (state.spawnedPowerUp) {
    const p = state.spawnedPowerUp;
    const ppx = p.x * CELL_SIZE + CELL_SIZE / 2;
    const ppy = p.y * CELL_SIZE + CELL_SIZE / 2;
    const pRadius = CELL_SIZE * 0.38;
    const pulseScale = 1 + Math.sin(state.fruitPulse * 1.5) * 0.1;

    // Blink if time is running out (less than 2.5 seconds remaining)
    const timeLeft = p.despawnTime - Date.now();
    let drawIt = true;
    if (timeLeft < 2500) {
      drawIt = Math.floor(timeLeft / 150) % 2 === 0;
    }

    if (drawIt) {
      ctx.save();
      // Glow
      ctx.shadowColor = p.type.color;
      ctx.shadowBlur = 15 + Math.sin(state.fruitPulse * 1.5) * 8;
      
      // Draw orb
      ctx.fillStyle = p.type.color;
      ctx.beginPath();
      ctx.arc(ppx, ppy, pRadius * pulseScale, 0, Math.PI * 2);
      ctx.fill();

      // Inner glass
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(ppx, ppy, pRadius * 0.8 * pulseScale, 0, Math.PI * 2);
      ctx.fill();

      // Draw Icon
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.floor(CELL_SIZE * 0.45 * pulseScale)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.type.icon, ppx, ppy + 1);
      ctx.restore();
    }
  }

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
    // Draw Grape Cluster
    ctx.shadowBlur = 0;
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

  ctx.restore();
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

  const currentSkin = SKINS[state.selectedSkin] || SKINS.classic;
  const char = currentSkin.char;

  const eyeOffset = 5;
  const eyeRadius = char === 'cacing' ? 2.5 : 3;
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

  let eyeColor = '#ffffff';
  let pupilColor = '#0a0a1a';
  let isGlow = false;

  if (char === 'naga') {
    eyeColor = currentSkin.head === '#00f0ff' ? '#ffffff' : '#ffe600';
    pupilColor = currentSkin.head;
    isGlow = true;
  } else if (char === 'cacing') {
    eyeColor = '#1a0d00';
    pupilColor = '#1a0d00';
  }

  // Draw eye whites/outer eyes
  ctx.save();
  if (isGlow) {
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 6;
  }
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(eye1.x, eye1.y, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eye2.x, eye2.y, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw pupils (worms don't have pupils, they just have beady eyes)
  if (char !== 'cacing') {
    ctx.save();
    if (isGlow) {
      ctx.shadowColor = pupilColor;
      ctx.shadowBlur = 4;
    }
    ctx.fillStyle = pupilColor;
    ctx.beginPath();
    ctx.arc(eye1.x + dir.x * 0.8, eye1.y + dir.y * 0.8, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eye2.x + dir.x * 0.8, eye2.y + dir.y * 0.8, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════
// HUD UPDATE
// ═══════════════════════════════════════════════════════

function updateHUD() {
  DOM.hudScore.textContent = state.score;
  DOM.hudLength.textContent = state.snake.length;
  DOM.hudHighscore.textContent = state.highScore;
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

  // Reset match achievements trackers
  state.fruitsEatenThisMatch = 0;
  state.matchStartTime = Date.now();

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

  deactivatePowerUp();

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

  deactivatePowerUp();

  // Unlock flawless run
  if (typeof GameHubAchievements !== 'undefined') {
    GameHubAchievements.unlock('snake', 'flawless');
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

  deactivatePowerUp();

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
    
    // Resume with the correct speed if a power-up is currently active
    const currentSpeed = (state.activePowerUp && state.activePowerUp.speed) 
      ? state.activePowerUp.speed 
      : CONFIG.GAME_SPEED;
      
    state.gameLoopId = setInterval(gameTick, currentSpeed);
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
  // Initialize or resume AudioContext on user input to follow browser autoplay policies
  initAudio();

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

DOM.btnStart.addEventListener('click', () => {
  initAudio();
  startGame();
});
DOM.btnRestart.addEventListener('click', () => {
  initAudio();
  restartGame();
});
DOM.btnPlayAgain.addEventListener('click', () => {
  initAudio();
  restartGame();
});

// ═══════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════

// ─── Sound System (Web Audio API) ───
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playEatSound() {
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  // Retro arcade triangle wave sound
  osc.type = 'triangle';
  
  const startTime = audioCtx.currentTime;
  // Sweep frequency upward from 160Hz to 750Hz in 0.12s
  osc.frequency.setValueAtTime(160, startTime);
  osc.frequency.exponentialRampToValueAtTime(750, startTime + 0.12);
  
  // Rapid gain volume decay
  gain.gain.setValueAtTime(0.18, startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12);
  
  osc.start(startTime);
  osc.stop(startTime + 0.12);
}

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

// ─── Character & Skin Selection Handlers ───
function renderSkinSelector(charId) {
  const container = document.getElementById('skin-options');
  if (!container) return;

  // Clear current options
  container.innerHTML = '';

  // Find all skins for this character
  const skinKeys = Object.keys(SKINS).filter(key => SKINS[key].char === charId);
  
  skinKeys.forEach((key, idx) => {
    const skin = SKINS[key];
    
    // Create button element
    const btn = document.createElement('button');
    btn.className = `skin-opt${key === state.selectedSkin ? ' active' : ''}`;
    btn.dataset.skin = key;
    btn.type = 'button';
    btn.title = skin.name;

    // Create preview element
    const span = document.createElement('span');
    span.className = `skin-preview skin-preview--${key}`;
    btn.appendChild(span);

    // Event listener
    btn.addEventListener('click', () => {
      document.querySelectorAll('.skin-opt').forEach(opt => opt.classList.remove('active'));
      btn.classList.add('active');
      
      state.selectedSkin = key;
      updateSkinDisplay();
    });

    container.appendChild(btn);
  });
}

function updateSkinDisplay() {
  const skin = SKINS[state.selectedSkin];
  if (!skin) return;

  const nameEl = document.getElementById('selected-skin-name');
  if (nameEl) {
    nameEl.textContent = skin.name;
    nameEl.style.color = skin.head;
  }
}

// Bind character selection buttons
document.querySelectorAll('.char-opt').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.char-opt').forEach(opt => opt.classList.remove('active'));
    btn.classList.add('active');
    
    state.selectedCharacter = btn.dataset.char;
    
    // Auto-select first skin of the chosen character
    const matchingSkins = Object.keys(SKINS).filter(key => SKINS[key].char === state.selectedCharacter);
    if (matchingSkins.length > 0) {
      state.selectedSkin = matchingSkins[0];
    }

    renderSkinSelector(state.selectedCharacter);
    updateSkinDisplay();
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

// Initialize Character & Skin selectors
renderSkinSelector(state.selectedCharacter);
updateSkinDisplay();

// ═══════════════════════════════════════════════════════
// NEW CLASSES & HELPER FUNCTIONS FOR POWER-UPS
// ═══════════════════════════════════════════════════════

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.color = color;
    this.alpha = 1.0;
    this.decay = Math.random() * 0.04 + 0.02;
    this.size = Math.random() * 4 + 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class FireParticle {
  constructor(x, y, colorHead, colorBody) {
    this.x = x;
    this.y = y;
    // Fire particles fly upwards and slightly outwards
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = -Math.random() * 4 - 1; // Always upward speed
    this.alpha = 1.0;
    this.decay = Math.random() * 0.03 + 0.02; // lasts about 30-50 frames
    this.size = Math.random() * 6 + 4; // slightly larger than default
    this.initialSize = this.size;
    this.colorHead = colorHead;
    this.colorBody = colorBody;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    // Shrink over time
    this.size = Math.max(0, this.initialSize * this.alpha);
    this.alpha -= this.decay;
    // Flame drift
    this.vx += (Math.random() - 0.5) * 0.2;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    
    // Elemental fire gradient
    let color;
    if (this.alpha > 0.75) {
      color = '#ffffff'; // Hot core
    } else if (this.alpha > 0.45) {
      color = this.colorHead;
    } else if (this.alpha > 0.15) {
      color = this.colorBody;
    } else {
      color = '#3c3c3c'; // Smoke
    }
    
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class EarthParticle {
  constructor(x, y, skinId) {
    this.x = x;
    this.y = y;
    // Earth particles burst outwards and fall due to gravity
    this.vx = (Math.random() - 0.5) * 5;
    this.vy = (Math.random() - 0.6) * 5; // initially slightly upward or outward
    this.gravity = 0.18; // Pull down
    this.alpha = 1.0;
    this.decay = Math.random() * 0.02 + 0.015; // last slightly longer
    this.size = Math.random() * 5 + 2;
    
    // Choose earth tone palettes depending on the skin ID
    let colors;
    if (skinId === 'cacing_sand') {
      colors = ['#784f23', '#9c6f3d', '#b88a51', '#d9a05b', '#e9c497'];
    } else if (skinId === 'cacing_grub') {
      colors = ['#8c6d7a', '#a68292', '#bf9ba8', '#d9b5c3', '#e8c5d3'];
    } else { // default earth worm (cacing_earth)
      colors = ['#573315', '#6e473b', '#82522c', '#a87043', '#cd853f'];
    }
    
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.isRock = Math.random() > 0.4;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.15;
  }

  update() {
    this.vy += this.gravity; // Gravity pull!
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotSpeed;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    
    // Soil has zero glow (matte)
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    ctx.beginPath();
    if (this.isRock) {
      // Draw a small debris chunk (square/rect)
      ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
    } else {
      // Draw a small dirt clump (circle)
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }
}

function createExplosion(gridX, gridY, color, count = 15, forceDefault = false) {
  const { CELL_SIZE } = CONFIG;
  const cx = gridX * CELL_SIZE + CELL_SIZE / 2;
  const cy = gridY * CELL_SIZE + CELL_SIZE / 2;
  
  const currentSkin = SKINS[state.selectedSkin] || SKINS.classic;
  const char = currentSkin.char;

  for (let i = 0; i < count; i++) {
    if (!forceDefault && char === 'naga') {
      state.particles.push(new FireParticle(cx, cy, currentSkin.head, currentSkin.bodyStart));
    } else if (!forceDefault && char === 'cacing') {
      state.particles.push(new EarthParticle(cx, cy, state.selectedSkin));
    } else {
      state.particles.push(new Particle(cx, cy, color));
    }
  }
}

function trySpawnPowerUp() {
  if (state.spawnedPowerUp || state.gameState !== GameStates.PLAYING) return;
  
  // 20% spawn probability
  if (Math.random() > 0.20) return;

  // Build list of occupied grid cells (snake + fruit)
  const occupied = new Set();
  for (const seg of state.snake) {
    occupied.add(`${seg.x},${seg.y}`);
  }
  occupied.add(`${state.fruit.x},${state.fruit.y}`);

  // Find all remaining empty cells
  const available = [];
  for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
      if (!occupied.has(`${x},${y}`)) {
        available.push({ x, y });
      }
    }
  }

  if (available.length === 0) return;

  // Pick random position
  const idx = Math.floor(Math.random() * available.length);
  const pos = available[idx];

  // Pick random powerup type
  const keys = Object.keys(POWERUP_TYPES);
  const randKey = keys[Math.floor(Math.random() * keys.length)];
  const type = POWERUP_TYPES[randKey];

  state.spawnedPowerUp = {
    x: pos.x,
    y: pos.y,
    type: type,
    despawnTime: Date.now() + 8000 // Lasts 8 seconds on grid
  };
}

function activatePowerUp(type) {
  // Clear any existing active power-up first
  if (state.activePowerUp) {
    deactivatePowerUp();
  }

  if (type.id === 'shrink') {
    // SHRINK is an instant effect
    const originalLength = state.snake.length;
    const newLength = Math.max(CONFIG.INITIAL_LENGTH, Math.floor(originalLength / 2));
    
    // Create explosion for sliced off segments
    for (let i = newLength; i < originalLength; i++) {
      if (state.snake[i]) {
        createExplosion(state.snake[i].x, state.snake[i].y, type.color, 6, true);
      }
    }
    
    state.snake = state.snake.slice(0, newLength);
    state.screenShake = 16;
    updateHUD();
    return;
  }

  // Active status for Freeze and Gold
  state.activePowerUp = {
    id: type.id,
    name: type.name,
    icon: type.icon,
    color: type.color,
    timeLeft: type.duration,
    totalDuration: type.duration,
    speed: type.speed
  };

  // Set the modified game speed ticks
  adjustGameSpeed(type.speed);
  updatePowerUpHUD();
}

function deactivatePowerUp() {
  if (!state.activePowerUp) return;

  state.activePowerUp = null;
  resetGameSpeed();
  updatePowerUpHUD();
}

function adjustGameSpeed(speed) {
  if (state.gameLoopId) {
    clearInterval(state.gameLoopId);
  }
  state.gameLoopId = setInterval(gameTick, speed);
}

function resetGameSpeed() {
  if (state.gameLoopId) {
    clearInterval(state.gameLoopId);
  }
  state.gameLoopId = setInterval(gameTick, CONFIG.GAME_SPEED);
}

const DOM_POWERUP = {
  hud: null,
  icon: null,
  name: null,
  progressBar: null
};

function updatePowerUpHUD() {
  if (!DOM_POWERUP.hud) {
    DOM_POWERUP.hud = document.getElementById('powerup-hud');
    DOM_POWERUP.icon = document.getElementById('powerup-icon');
    DOM_POWERUP.name = document.getElementById('powerup-name');
    DOM_POWERUP.progressBar = document.getElementById('powerup-progress-bar');
  }

  if (!DOM_POWERUP.hud) return;

  if (state.activePowerUp) {
    DOM_POWERUP.icon.textContent = state.activePowerUp.icon;
    DOM_POWERUP.name.textContent = state.activePowerUp.name;
    
    DOM_POWERUP.hud.className = `powerup-hud active ${state.activePowerUp.id}`;
    
    const pct = Math.max(0, (state.activePowerUp.timeLeft / state.activePowerUp.totalDuration) * 100);
    DOM_POWERUP.progressBar.style.width = `${pct}%`;
  } else {
    DOM_POWERUP.hud.className = 'powerup-hud hidden';
  }
}
