/* ═══════════════════════════════════════════════════════
   FISHING FRENZY — GAME LOGIC
   Canvas Rendering, Web Audio Synthesis, and Mechanics
   ═══════════════════════════════════════════════════════ */

// ─── Constants & Configuration ───
const CONFIG = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
  INITIAL_LIVES: 3,
  MAX_DEPTH: 550,    // max hook depth
  SURFACE_Y: 100,    // water level
  BOAT_SPEED: 6,     // pixels per frame
  HOOK_CAST_SPEED: 8,
  HOOK_REEL_SPEED: 6,
  HOOK_REEL_HEAVY: 2.5 // speed when reeling heavy shark/trash
};

// ─── Fish Configurations ───
const FISH_TYPES = {
  SMALL: {
    id: 'small',
    name: 'Neon Guppy',
    points: 10,
    speedMin: 1.6,
    speedMax: 2.6,
    width: 28,
    height: 16,
    depthMin: 140,
    depthMax: 280,
    color: '#00f0ff',
    glow: '#00f0ff',
    heavy: false
  },
  MEDIUM: {
    id: 'medium',
    name: 'Cyber Bass',
    points: 20,
    speedMin: 1.0,
    speedMax: 1.8,
    width: 42,
    height: 24,
    depthMin: 280,
    depthMax: 420,
    color: '#d946ef',
    glow: '#d946ef',
    heavy: false
  },
  GOLDEN: {
    id: 'golden',
    name: 'Golden Aura',
    points: 50,
    speedMin: 2.2,
    speedMax: 3.4,
    width: 32,
    height: 20,
    depthMin: 400,
    depthMax: 520,
    color: '#fbbf24',
    glow: '#fbbf24',
    heavy: false
  },
  BOMB: {
    id: 'bomb',
    name: 'Underwater Bomb',
    points: 0, // Catching bomb deals damage, does not change score
    speedMin: 1.0,
    speedMax: 1.8,
    width: 32,
    height: 32,
    depthMin: 320,
    depthMax: 520,
    color: '#ff4466',
    glow: '#ff4466',
    heavy: true
  },
  TRASH: {
    id: 'trash',
    name: 'Marine Debris',
    points: -10, // obstacle
    speedMin: 0.4,
    speedMax: 0.8,
    width: 24,
    height: 24,
    depthMin: 180,
    depthMax: 500,
    color: '#94a3b8',
    glow: 'transparent',
    heavy: true
  }
};

const GameStates = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER'
};

const HookStates = {
  IDLE: 'IDLE',
  CASTING: 'CASTING',
  REELING: 'REELING'
};

// ─── Game State ───
let state = {
  gameState: GameStates.MENU,
  score: 0,
  highScore: 0,
  lives: 3,

  // Game Entities
  boat: { x: 360, y: 55, width: 90, height: 45 },
  hook: { x: 405, y: 100, state: HookStates.IDLE, caughtItem: null },
  fishList: [],
  bubbles: [],

  // Event state
  activeEvent: null,
  eventTimeLeft: 0,
  nextEventCountdown: 20,
  tornado: { x: 0, speed: 2, angle: 0 },
  gameTimerId: null,

  // Timers and Animation IDs
  gameLoopId: null,
  fishSpawnTimeoutId: null,
  keys: {},
  lastFrameTime: 0,

  // Achievements tracking
  fishesCaughtThisMatch: 0,
  eventsEncounteredThisMatch: 0
};

// ─── DOM References ───
const DOM = {
  menuScreen: document.getElementById('menu-screen'),
  gameScreen: document.getElementById('game-screen'),
  gameoverModal: document.getElementById('gameover-modal'),
  pauseOverlay: document.getElementById('pause-overlay'),
  victoryModal: document.getElementById('victory-modal'),
  canvas: document.getElementById('game-canvas'),
  btnStart: document.getElementById('btn-start'),
  btnRestart: document.getElementById('btn-restart'),
  btnVictoryContinue: document.getElementById('btn-victory-continue'),
  hudScore: document.getElementById('hud-score'),
  hudHighscore: document.getElementById('hud-highscore'),
  hudLives: document.getElementById('hud-lives'),
  hudWeaponItem: document.getElementById('hud-weapon-item'),
  gameoverScore: document.getElementById('gameover-score'),
  gameoverSubtitle: document.getElementById('gameover-subtitle'),
  victoryScore: document.getElementById('victory-score'),
  eventBanner: document.getElementById('event-banner'),
  eventName: document.getElementById('event-name'),
  eventTimer: document.getElementById('event-timer')
};

const ctx = DOM.canvas.getContext('2d');

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

function playSound(type) {
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const startTime = audioCtx.currentTime;

  if (type === 'cast') {
    // Whistle cast down sound
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, startTime);
    osc.frequency.exponentialRampToValueAtTime(150, startTime + 0.35);
    gain.gain.setValueAtTime(0.12, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);
    osc.start(startTime);
    osc.stop(startTime + 0.35);
  } else if (type === 'catch') {
    // Satisfying arcade catch chime
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, startTime);
    osc.frequency.setValueAtTime(660, startTime + 0.08);
    osc.frequency.setValueAtTime(880, startTime + 0.16);
    gain.gain.setValueAtTime(0.18, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
    osc.start(startTime);
    osc.stop(startTime + 0.3);
  } else if (type === 'hook') {
    // Quick bite pop
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, startTime);
    osc.frequency.exponentialRampToValueAtTime(400, startTime + 0.08);
    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.08);
    osc.start(startTime);
    osc.stop(startTime + 0.08);
  } else if (type === 'obstacle') {
    // Low buzzer warn
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, startTime);
    osc.frequency.setValueAtTime(90, startTime + 0.12);
    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.32);
    osc.start(startTime);
    osc.stop(startTime + 0.32);
  }
}

// ═══════════════════════════════════════════════════════
// INITIALIZATION & GAME LOOP
// ═══════════════════════════════════════════════════════

function initGame() {
  state.score = 0;
  state.lives = CONFIG.INITIAL_LIVES;
  state.fishList = [];
  state.bubbles = [];
  state.keys = {};

  // Reset achievements counters
  state.fishesCaughtThisMatch = 0;
  state.eventsEncounteredThisMatch = 0;

  state.activeEvent = null;
  state.eventTimeLeft = 0;
  state.nextEventCountdown = 20 + Math.floor(Math.random() * 11);
  if (DOM.eventBanner) {
    DOM.eventBanner.className = 'event-banner';
  }

  // Boss & weapon state initialization
  state.bossActive = null;
  state.squidGunUnlocked = false;
  state.krakenBeaten = false;
  state.poseidonBeaten = false;
  state.projectiles = [];
  state.boat.invincibleTimer = 0;
  state.krakenState = null;
  state.poseidonState = null;

  if (DOM.hudWeaponItem) {
    DOM.hudWeaponItem.style.display = 'none';
  }

  // Load High Score
  state.highScore = parseInt(localStorage.getItem('fishing_highscore')) || 0;
  updateHUD();

  // Reset positions
  state.boat.x = (CONFIG.CANVAS_WIDTH - state.boat.width) / 2;
  resetHookPosition();

  // Initialize bubbles
  for (let i = 0; i < 15; i++) {
    state.bubbles.push({
      x: Math.random() * CONFIG.CANVAS_WIDTH,
      y: CONFIG.SURFACE_Y + Math.random() * (CONFIG.CANVAS_HEIGHT - CONFIG.SURFACE_Y),
      vy: Math.random() * 0.8 + 0.4,
      size: Math.random() * 4 + 1
    });
  }

  // Pre-populate some fish swimming across
  for (let i = 0; i < 6; i++) {
    spawnFish(true);
  }
}

function resetHookPosition() {
  state.hook.x = state.boat.x + state.boat.width / 2;
  state.hook.y = CONFIG.SURFACE_Y;
  state.hook.state = HookStates.IDLE;
  state.hook.caughtItem = null;
}

function startGame() {
  initGame();

  state.gameState = GameStates.PLAYING;
  showScreen('game-screen');
  hideModal('gameover-modal');

  // Spawn loop
  scheduleNextFishSpawn();

  // Start event seconds timer
  if (state.gameTimerId) clearInterval(state.gameTimerId);
  state.gameTimerId = setInterval(gameSecondTick, 1000);

  // Render & logic ticks
  state.lastFrameTime = performance.now();
  if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
  state.gameLoopId = requestAnimationFrame(gameLoop);
}

function scheduleNextFishSpawn() {
  if (state.gameState !== GameStates.PLAYING) return;
  // Spawn a fish every 1 to 2.5 seconds (or faster in BOMB_MANIA)
  const baseDelay = state.activeEvent === 'BOMB_MANIA' ? 500 : 1000;
  const maxRand = state.activeEvent === 'BOMB_MANIA' ? 700 : 1500;
  const delay = baseDelay + Math.random() * maxRand;

  state.fishSpawnTimeoutId = setTimeout(() => {
    spawnFish();
    scheduleNextFishSpawn();
  }, delay);
}

function gameLoop(timestamp) {
  if (state.gameState !== GameStates.PLAYING) return;

  updatePhysics();
  render();

  state.gameLoopId = requestAnimationFrame(gameLoop);
}

function gameOver() {
  state.gameState = GameStates.GAME_OVER;

  if (state.fishSpawnTimeoutId) clearTimeout(state.fishSpawnTimeoutId);
  if (state.gameTimerId) {
    clearInterval(state.gameTimerId);
    state.gameTimerId = null;
  }
  if (DOM.eventBanner) {
    DOM.eventBanner.classList.remove('active');
  }

  // Save High Score
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem('fishing_highscore', state.highScore);
  }

  // Show Modal
  DOM.gameoverScore.textContent = state.score;
  DOM.hudHighscore.textContent = state.highScore;

  if (state.score >= 200) {
    DOM.gameoverSubtitle.textContent = "Spectacular Angler! 👑";
  } else if (state.score >= 100) {
    DOM.gameoverSubtitle.textContent = "Great Catch! 🌟";
  } else if (state.score >= 0) {
    DOM.gameoverSubtitle.textContent = "Nice Effort! 🎣";
  } else {
    DOM.gameoverSubtitle.textContent = "Better luck next time! 🌊";
  }

  showModal('gameover-modal');
}

function togglePause() {
  if (state.gameState === GameStates.PLAYING) {
    state.gameState = GameStates.PAUSED;
    if (state.fishSpawnTimeoutId) clearTimeout(state.fishSpawnTimeoutId);
    if (state.gameTimerId) {
      clearInterval(state.gameTimerId);
      state.gameTimerId = null;
    }
    showModal('pause-overlay');
  } else if (state.gameState === GameStates.PAUSED) {
    state.gameState = GameStates.PLAYING;
    hideModal('pause-overlay');
    scheduleNextFishSpawn();
    state.gameTimerId = setInterval(gameSecondTick, 1000);
    state.lastFrameTime = performance.now();
    state.gameLoopId = requestAnimationFrame(gameLoop);
  }
}

function restartGame() {
  hideModal('gameover-modal');
  hideModal('pause-overlay');
  startGame();
}

// ═══════════════════════════════════════════════════════
// ENTITY SPAWNING
// ═══════════════════════════════════════════════════════

function spawnFish(prePopulate = false) {
  if (state.bossActive) return;
  // Choose random fish class
  const rand = Math.random();
  let type;
  if (state.activeEvent === 'BOMB_MANIA') {
    // 50% chance of Bomb, others are evenly distributed
    if (rand < 0.50) {
      type = FISH_TYPES.BOMB;
    } else if (rand < 0.70) {
      type = FISH_TYPES.SMALL;
    } else if (rand < 0.85) {
      type = FISH_TYPES.MEDIUM;
    } else if (rand < 0.95) {
      type = FISH_TYPES.GOLDEN;
    } else {
      type = FISH_TYPES.TRASH;
    }
  } else {
    if (rand < 0.35) {
      type = FISH_TYPES.SMALL;
    } else if (rand < 0.65) {
      type = FISH_TYPES.MEDIUM;
    } else if (rand < 0.78) {
      type = FISH_TYPES.GOLDEN;
    } else if (rand < 0.90) {
      type = FISH_TYPES.BOMB;
    } else {
      type = FISH_TYPES.TRASH;
    }
  }

  const headingRight = Math.random() > 0.5;
  const speed = type.speedMin + Math.random() * (type.speedMax - type.speedMin);
  const depth = type.depthMin + Math.random() * (type.depthMax - type.depthMin);

  let x;
  if (prePopulate) {
    // Place randomly across the screen width
    x = Math.random() * (CONFIG.CANVAS_WIDTH + type.width * 2) - type.width;
  } else {
    // Spawn just off the respective edge
    x = headingRight ? -type.width : CONFIG.CANVAS_WIDTH + type.width;
  }

  state.fishList.push({
    x: x,
    y: depth,
    type: type,
    vx: headingRight ? speed : -speed,
    headingRight: headingRight,
    wiggleTimer: Math.random() * 100 // wiggle phase offset
  });
}

// ═══════════════════════════════════════════════════════
// PHYSICS & LOGIC UPDATES
// ═══════════════════════════════════════════════════════

function updatePhysics() {
  const dt = 1; // frame step

  // Invincibility frame update
  if (state.boat.invincibleTimer > 0) {
    state.boat.invincibleTimer--;
  }

  // Boss encounter checks & physics
  checkBossTriggers();
  if (state.bossActive === 'KRAKEN') {
    updateKraken();
  } else if (state.bossActive === 'POSEIDON') {
    updatePoseidon();
  }
  updateProjectiles();

  // 1. Boat Movement (support Arrow keys and A/D keys)
  let moveDir = 0;
  if (state.keys['ArrowLeft'] || state.keys['KeyA']) {
    moveDir = -1;
  } else if (state.keys['ArrowRight'] || state.keys['KeyD']) {
    moveDir = 1;
  }

  // Tornado control inversion
  if (state.activeEvent === 'TORNADO') {
    moveDir = -moveDir;
  }

  if (moveDir !== 0) {
    state.boat.x += moveDir * CONFIG.BOAT_SPEED * dt;
    // Keep boat on-screen
    state.boat.x = Math.max(0, Math.min(CONFIG.CANVAS_WIDTH - state.boat.width, state.boat.x));
  }

  // Tornado physics update
  if (state.activeEvent === 'TORNADO') {
    state.tornado.x += state.tornado.speed * dt;
    state.tornado.angle += 0.08 * dt;

    // Wrap around
    if (state.tornado.x > CONFIG.CANVAS_WIDTH + 150) {
      state.tornado.x = -150;
    } else if (state.tornado.x < -150) {
      state.tornado.x = CONFIG.CANVAS_WIDTH + 150;
    }
  }

  // 2. Hook Physics
  const hookTargetX = state.boat.x + state.boat.width / 2;

  switch (state.hook.state) {
    case HookStates.IDLE:
      // Hook stays anchored below boat center
      state.hook.x = hookTargetX;
      state.hook.y = CONFIG.SURFACE_Y;

      // Cast triggers if Down/Space is pressed
      if (state.keys['ArrowDown'] || state.keys['Space']) {
        state.hook.state = HookStates.CASTING;
        playSound('cast');
      }
      break;

    case HookStates.CASTING:
      // Hook descends vertically
      state.hook.y += CONFIG.HOOK_CAST_SPEED * dt;

      // Automatically reel up if max depth hit
      if (state.hook.y >= CONFIG.MAX_DEPTH) {
        state.hook.state = HookStates.REELING;
      }
      break;

    case HookStates.REELING:
      // Reeling speed depends on weight of the catch
      const isHeavy = state.hook.caughtItem && state.hook.caughtItem.type.heavy;
      const speed = isHeavy ? CONFIG.HOOK_REEL_HEAVY : CONFIG.HOOK_REEL_SPEED;

      state.hook.y -= speed * dt;

      // Hook returns to boat
      if (state.hook.y <= CONFIG.SURFACE_Y) {
        state.hook.y = CONFIG.SURFACE_Y;
        state.hook.state = HookStates.IDLE;

        // Process catching item
        if (state.hook.caughtItem) {
          const item = state.hook.caughtItem;

          if (item.type.id === 'bomb') {
            state.lives--;
            playSound('obstacle');

            // Unlock Kaboom achievement
            if (typeof GameHubAchievements !== 'undefined') {
              GameHubAchievements.unlock('fishing', 'kaboom');
            }
          } else {
            state.score += item.type.points;

            // Increment caught fishes count if it is a real fish
            if (item.type.id !== 'trash') {
              state.fishesCaughtThisMatch++;
              if (typeof GameHubAchievements !== 'undefined' && state.fishesCaughtThisMatch >= 5) {
                GameHubAchievements.unlock('fishing', 'stepping');
              }
            }

            // Check score achievements
            if (typeof GameHubAchievements !== 'undefined') {
              if (state.score >= 250) {
                GameHubAchievements.unlock('fishing', 'novice');
              }
              if (state.score >= 1000) {
                GameHubAchievements.unlock('fishing', 'master');
              }
              if (state.score >= 10000) {
                GameHubAchievements.unlock('fishing', 'surreal');
              }
            }

            // Sound indicator
            if (item.type.points > 0) {
              playSound('catch');
            } else {
              playSound('obstacle');
            }
            triggerScorePop();
          }

          state.hook.caughtItem = null;
          updateHUD();

          if (state.lives <= 0) {
            gameOver();
          }
        }
      }
      break;
  }

  // Hook horizontal alignment adjusts slightly to reel straight back to boat center
  if (state.hook.state !== HookStates.IDLE) {
    // Slowly pull hook horizontally towards the boat's new horizontal coordinate
    state.hook.x += (hookTargetX - state.hook.x) * 0.12 * dt;
  }

  // Check Kraken Eye hit if active and tired (placed outside the fish list loop since fishList is empty during boss fight)
  if (state.bossActive === 'KRAKEN' && state.krakenState && state.krakenState.phase === 'TIRED') {
    if (state.hook.state === HookStates.CASTING && !state.hook.caughtItem) {
      const eyeX = state.krakenState.x;
      const eyeY = state.krakenState.y - 45; // eye is placed slightly above body center
      const hx = state.hook.x;
      const hy = state.hook.y + 12; // hook tip
      const dist = Math.hypot(hx - eyeX, hy - eyeY);
      if (dist < 32) {
        damageKraken();
        state.hook.state = HookStates.REELING;
        playSound('catch');
      }
    }
  }

  // 3. Fish Swimming & Bounding Collisions
  for (let i = state.fishList.length - 1; i >= 0; i--) {
    const fish = state.fishList[i];

    // Move fish horizontally (speed 1.5x in QUICK_CURRENTS)
    const speedMult = state.activeEvent === 'QUICK_CURRENTS' ? 1.5 : 1.0;
    fish.x += fish.vx * speedMult * dt;
    fish.wiggleTimer += 0.15 * speedMult * dt;

    // Check off-screen bounds to delete fish
    const isOffScreen = fish.headingRight
      ? (fish.x > CONFIG.CANVAS_WIDTH + fish.type.width)
      : (fish.x < -fish.type.width * 2);

    if (isOffScreen) {
      state.fishList.splice(i, 1);
      continue;
    }

    // Hook collision logic
    if (state.hook.state === HookStates.CASTING && !state.hook.caughtItem) {
      const isCollide = checkCollision(state.hook, fish);
      if (isCollide) {
        state.hook.state = HookStates.REELING;
        state.hook.caughtItem = fish;

        // Remove from active fish list
        state.fishList.splice(i, 1);
        playSound('hook');
      }
    }
  }

  // 4. Bubbles rising
  state.bubbles.forEach(b => {
    b.y -= b.vy * dt;
    if (b.y < CONFIG.SURFACE_Y) {
      b.y = CONFIG.CANVAS_HEIGHT;
      b.x = Math.random() * CONFIG.CANVAS_WIDTH;
    }
  });
}

function checkCollision(hook, fish) {
  // Simple circular/box collision check between hook tip and fish bounding box
  const hSize = 10;
  const hx = hook.x;
  const hy = hook.y + 12; // lower tip of hook

  const fx1 = fish.x;
  const fx2 = fish.x + fish.type.width;
  const fy1 = fish.y - fish.type.height / 2;
  const fy2 = fish.y + fish.type.height / 2;

  return (hx >= fx1 && hx <= fx2 && hy >= fy1 && hy <= fy2);
}

// ═══════════════════════════════════════════════════════
// RENDERING (Canvas 2D)
// ═══════════════════════════════════════════════════════

function render() {
  // Clear
  ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

  // 1. Draw Sky (top section)
  if (state.bossActive === 'POSEIDON' && state.poseidonState) {
    const ps = state.poseidonState;
    if (ps.disasterActive) {
      ctx.fillStyle = '#0d0002'; // Disaster Realm (hellish black-red)
    } else if (ps.isCursed) {
      ctx.fillStyle = '#13021f'; // Cursed Poseidon normal (dark purple-black)
    } else {
      ctx.fillStyle = '#0a0314'; // Normal Poseidon storm
    }
  } else {
    ctx.fillStyle = '#060f1e';
  }
  ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.SURFACE_Y);

  // 2. Draw Sea Gradient (deepening water)
  if (state.bossActive === 'POSEIDON' && state.poseidonState) {
    const ps = state.poseidonState;
    const seaGrad = ctx.createLinearGradient(0, CONFIG.SURFACE_Y, 0, CONFIG.CANVAS_HEIGHT);
    if (ps.disasterActive) {
      // Blood red hellish depth gradient
      seaGrad.addColorStop(0, '#2d0006');
      seaGrad.addColorStop(0.5, '#140003');
      seaGrad.addColorStop(1, '#050001');
    } else if (ps.isCursed) {
      // Deep cursed purple/indigo gradient
      seaGrad.addColorStop(0, '#0a001a');
      seaGrad.addColorStop(0.5, '#05000d');
      seaGrad.addColorStop(1, '#020005');
    } else {
      // Storm Sea (dark navy with electric purple tint)
      seaGrad.addColorStop(0, '#000a1f');
      seaGrad.addColorStop(0.5, '#000412');
      seaGrad.addColorStop(1, '#03000a');
    }
    ctx.fillStyle = seaGrad;
  } else {
    const grad = ctx.createLinearGradient(0, CONFIG.SURFACE_Y, 0, CONFIG.CANVAS_HEIGHT);
    grad.addColorStop(0, '#001a33');
    grad.addColorStop(0.5, '#000c1a');
    grad.addColorStop(1, '#000308');
    ctx.fillStyle = grad;
  }
  ctx.fillRect(0, CONFIG.SURFACE_Y, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT - CONFIG.SURFACE_Y);

  // Draw lightning flash overlay if any lightning is active (randomly flash)
  if (state.bossActive === 'POSEIDON' && state.poseidonState) {
    const ps = state.poseidonState;
    const hasFiredLightning = ps.lightningStrikes.some(s => s.fired) || (ps.giantLightning && ps.giantLightning.fired);
    if (hasFiredLightning && Math.random() < 0.15) {
      ctx.fillStyle = 'rgba(217, 240, 255, 0.15)'; // electric flash
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    }
  }

  // 3. Draw Water Surface line
  ctx.strokeStyle = 'rgba(0, 210, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, CONFIG.SURFACE_Y);
  ctx.lineTo(CONFIG.CANVAS_WIDTH, CONFIG.SURFACE_Y);
  ctx.stroke();

  // Draw Tornado in background if active
  if (state.activeEvent === 'TORNADO') {
    drawTornado();
  }

  // 4. Draw Bubbles
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  state.bubbles.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // 5. Draw Fish
  state.fishList.forEach(fish => {
    drawFishItem(fish);
  });

  // Draw Bosses
  if (state.bossActive === 'KRAKEN') {
    drawKraken();
  } else if (state.bossActive === 'POSEIDON') {
    drawPoseidon();
  }

  // Draw Projectiles
  if (state.projectiles) {
    state.projectiles.forEach(p => {
      ctx.save();
      ctx.shadowColor = '#d946ef';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff00ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius || 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // 6. Draw Hook & Line
  drawHookAndLine();

  // 7. Draw Boat
  drawBoat(state.boat.x, state.boat.y);
}

function drawBoat(x, y) {
  ctx.save();
  ctx.translate(x, y);

  // Invincibility flickering effect
  if (state.boat.invincibleTimer > 0) {
    ctx.globalAlpha = Math.floor(state.boat.invincibleTimer / 4) % 2 === 0 ? 0.3 : 0.8;
  }

  // Hull gradient (arcade metallic metal look)
  const hullGrad = ctx.createLinearGradient(0, 0, 0, 40);
  hullGrad.addColorStop(0, '#1e293b');
  hullGrad.addColorStop(1, '#0f172a');

  ctx.fillStyle = hullGrad;
  ctx.strokeStyle = '#00d2ff';
  ctx.lineWidth = 2;

  // Draw boat shape
  ctx.beginPath();
  ctx.moveTo(10, 25);
  ctx.lineTo(80, 25);
  ctx.lineTo(70, 45);
  ctx.lineTo(20, 45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cab/Deck structure
  ctx.fillStyle = '#334155';
  ctx.fillRect(25, 5, 30, 20);
  ctx.strokeRect(25, 5, 30, 20);

  // Windshield (cyan glow)
  ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
  ctx.fillRect(45, 9, 8, 12);

  // Fishing Rod
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(75, 25);
  ctx.lineTo(95, -5); // extends outward/upward
  ctx.stroke();

  // Draw Squid Gun (mounted on deck center)
  if (state.squidGunUnlocked) {
    ctx.save();
    ctx.fillStyle = '#d946ef'; // glowing purple blaster
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#d946ef';
    ctx.shadowBlur = 8;

    // Dome/mount
    ctx.beginPath();
    ctx.arc(35, 22, 6, 0, Math.PI, true); // half circle facing up
    ctx.fill();
    ctx.stroke();

    // Gun barrel pointing downwards/slightly forward
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(32, 22, 6, 12);
    ctx.strokeRect(32, 22, 6, 12);

    ctx.restore();
  }

  ctx.restore();
}

function drawHookAndLine() {
  const rx = state.boat.x + 85; // rod tip X coordinate relative to canvas
  const ry = state.boat.y + 15; // rod tip Y

  const hx = state.hook.x;
  const hy = state.hook.y;

  // Draw Fishing Line (thin white-gray rope)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(rx, ry);
  // Curve line slightly or make direct straight line
  ctx.lineTo(hx, hy);
  ctx.stroke();

  // Draw Hook shape (curved shape)
  ctx.save();
  ctx.translate(hx, hy);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 10);
  // Curve up
  ctx.arc(3, 10, 3, Math.PI, Math.PI * 0.4, true);
  ctx.stroke();

  // Draw caught item locked to the hook tip
  if (state.hook.caughtItem) {
    const item = state.hook.caughtItem;
    // Align caught item under the hook
    ctx.restore();
    ctx.save();

    // Draw fish horizontally centered and locked vertically
    const offsetItem = {
      ...item,
      x: hx - item.type.width / 2,
      y: hy + 20, // hangs below hook
      headingRight: true, // caught fish stays faced right
      wiggleTimer: 0 // caught fish doesn't swim/wiggle
    };
    drawFishItem(offsetItem);
  }

  ctx.restore();
}

function drawFishItem(fish) {
  const { x, y, type, headingRight, wiggleTimer } = fish;

  ctx.save();
  ctx.translate(x, y);

  // Flip coordinates if heading right (mouth originally faces left, so flip to face right)
  if (headingRight) {
    ctx.scale(-1, 1);
    ctx.translate(-type.width, 0);
  }

  // Wiggle angle (sinusoidal tail wiggle animation!)
  const wiggle = Math.sin(wiggleTimer) * 5;

  ctx.shadowColor = type.glow;
  ctx.shadowBlur = type.glow !== 'transparent' ? 12 : 0;
  ctx.fillStyle = type.color;

  if (type.id === 'trash') {
    // Draw boot/plastic bottle shape
    ctx.fillStyle = '#64748b';
    ctx.shadowBlur = 0;
    // Draw bottle
    ctx.beginPath();
    ctx.ellipse(type.width / 2, type.height / 2, type.width / 2, type.height / 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bottle cap
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, type.height / 2 - 3, 4, 6);
  } else if (type.id === 'bomb') {
    const cx = type.width / 2;
    const cy = 0;
    const r = type.height / 2.5;

    // Draw spikes radiating from center
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 3.5;
    const numSpikes = 8;
    for (let i = 0; i < numSpikes; i++) {
      const angle = (i * 2 * Math.PI) / numSpikes;
      const x1 = cx + Math.cos(angle) * r;
      const y1 = cy + Math.sin(angle) * r;
      const x2 = cx + Math.cos(angle) * (r + 7);
      const y2 = cy + Math.sin(angle) * (r + 7);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Spiky spherical body
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1b4b'; // deep indigo metallic body
    ctx.fill();
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glowing core
    const pulse = Math.abs(Math.sin(wiggleTimer * 0.8));
    ctx.shadowBlur = 10 + pulse * 10;
    ctx.fillStyle = `rgba(255, 68, 102, ${0.4 + pulse * 0.6})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Standard sleek swimming neon fish
    ctx.beginPath();
    ctx.moveTo(0, 0); // mouth tip
    ctx.quadraticCurveTo(type.width * 0.45, -type.height * 0.65, type.width * 0.75, 0); // top body

    // Tail joint & tail fin (animated wiggle!)
    const tx = type.width * 0.75;
    const ty = 0;
    ctx.lineTo(tx, ty);
    ctx.lineTo(type.width + wiggle * 0.2, -type.height * 0.4 + wiggle);
    ctx.lineTo(type.width - 3, wiggle * 0.5);
    ctx.lineTo(type.width + wiggle * 0.2, type.height * 0.4 + wiggle);
    ctx.lineTo(tx, ty);

    ctx.quadraticCurveTo(type.width * 0.45, type.height * 0.65, 0, 0); // bottom body
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(type.width * 0.18, -type.height * 0.08, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(type.width * 0.18, -type.height * 0.08, 1, 0, Math.PI * 2);
    ctx.fill();

    // Fin details
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(type.width * 0.35, 2);
    ctx.lineTo(type.width * 0.2, 8);
    ctx.stroke();
  }

  ctx.restore();
}

// ═══════════════════════════════════════════════════════
// HUD & STATE TRANSITIONS
// ═══════════════════════════════════════════════════════

function updateHUD() {
  DOM.hudScore.textContent = state.score;
  DOM.hudHighscore.textContent = state.highScore;

  // Render Lives as heart indicators (e.g. ❤️ for alive, 🖤 for lost)
  let hearts = '';
  const maxLives = CONFIG.INITIAL_LIVES;
  for (let i = 0; i < maxLives; i++) {
    if (i < state.lives) {
      hearts += '❤️ ';
    } else {
      hearts += '🖤 ';
    }
  }
  DOM.hudLives.textContent = hearts.trim();

  // Pulse effect if lives are low (e.g. 1 life remaining)
  if (state.lives === 1) {
    DOM.hudLives.classList.add('pop');
    setTimeout(() => DOM.hudLives.classList.remove('pop'), 250);
  }

  // Show Squid Gun status
  if (DOM.hudWeaponItem) {
    DOM.hudWeaponItem.style.display = state.squidGunUnlocked ? 'flex' : 'none';
  }
}

// ─── Event Helper Functions ───

function gameSecondTick() {
  if (state.gameState !== GameStates.PLAYING) return;

  if (state.activeEvent) {
    state.eventTimeLeft--;
    if (state.eventTimeLeft <= 0) {
      endEvent();
    }
  } else {
    state.nextEventCountdown--;
    if (state.nextEventCountdown <= 0) {
      triggerRandomEvent();
    }
  }

  // Cursed Poseidon Resolution passive heal (every 30 seconds heal 6 HP)
  if (state.bossActive === 'POSEIDON' && state.poseidonState && state.poseidonState.isCursed && state.poseidonState.phase !== 'DEFEATED') {
    const ps = state.poseidonState;
    ps.cursedHealTimer = (ps.cursedHealTimer || 0) + 1;
    if (ps.cursedHealTimer >= 30) {
      ps.cursedHealTimer = 0;
      if (ps.health < 30) {
        ps.health = Math.min(30, ps.health + 6);
        playSound('catch');
        ps.healFlash = 25; // green/cyan flash duration
        if (DOM.eventBanner) {
          DOM.eventTimer.textContent = `HP: ${ps.health}/30`;
        }
      }
    }
  }

  // Update HUD and Banner
  updateHUD();
  if (state.activeEvent && DOM.eventTimer) {
    DOM.eventTimer.textContent = `${state.eventTimeLeft}s`;
  }
}

function triggerRandomEvent() {
  const events = ['QUICK_CURRENTS', 'BOMB_MANIA', 'TORNADO'];
  const randomEvent = events[Math.floor(Math.random() * events.length)];

  state.activeEvent = randomEvent;
  state.eventTimeLeft = 15;

  // Increment events encountered count
  state.eventsEncounteredThisMatch = (state.eventsEncounteredThisMatch || 0) + 1;
  if (typeof GameHubAchievements !== 'undefined') {
    if (state.eventsEncounteredThisMatch >= 1) {
      GameHubAchievements.unlock('fishing', 'whatsthat');
    }
    if (state.eventsEncounteredThisMatch >= 5) {
      GameHubAchievements.unlock('fishing', 'seenall');
    }
  }

  if (randomEvent === 'TORNADO') {
    state.tornado.x = Math.random() > 0.5 ? -100 : CONFIG.CANVAS_WIDTH + 50;
    state.tornado.speed = state.tornado.x < 0 ? 1.5 : -1.5;
    state.tornado.angle = 0;
  }

  playSound('catch'); // Play alert chime

  if (DOM.eventBanner) {
    const themeClass = randomEvent.toLowerCase().replace('_', '-');
    DOM.eventBanner.className = `event-banner active ${themeClass}`;
    DOM.eventName.textContent = randomEvent.replace('_', ' ');
    DOM.eventTimer.textContent = `${state.eventTimeLeft}s`;
  }
}

function endEvent() {
  state.activeEvent = null;
  state.eventTimeLeft = 0;
  state.nextEventCountdown = 20 + Math.floor(Math.random() * 11); // 20 to 30 seconds

  if (DOM.eventBanner) {
    DOM.eventBanner.classList.remove('active');
  }
}

function drawTornado() {
  ctx.save();
  ctx.translate(state.tornado.x, 0);

  const startY = 10;
  const endY = CONFIG.SURFACE_Y + 30;
  const steps = 15;

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)'; // Yellow/orange neon wind
  ctx.lineWidth = 1.8;
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 8;

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const y = startY + t * (endY - startY);
    const w = 55 - t * 40;
    const wiggleX = Math.sin(state.tornado.angle + i * 0.45) * 12;

    ctx.beginPath();
    ctx.ellipse(wiggleX, y, w, w * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function triggerScorePop() {
  DOM.hudScore.classList.remove('pop');
  void DOM.hudScore.offsetWidth; // Force layout recalculation
  DOM.hudScore.classList.add('pop');
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function showModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function hideModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// ═══════════════════════════════════════════════════════
// INPUT HANDLERS
// ═══════════════════════════════════════════════════════

window.addEventListener('keydown', (e) => {
  // Resume Audio context on user gesture
  initAudio();

  const code = e.code;
  state.keys[code] = true;

  // Toggle Pause
  if (code === 'KeyP' || code === 'Escape') {
    if (state.gameState === GameStates.PLAYING || state.gameState === GameStates.PAUSED) {
      e.preventDefault();
      togglePause();
    }
  }

  // Restart / Quick Enter play
  if (code === 'Enter' || code === 'Space') {
    if (state.gameState === GameStates.MENU) {
      e.preventDefault();
      startGame();
    } else if (state.gameState === GameStates.GAME_OVER) {
      e.preventDefault();
      restartGame();
    }
  }

  // Squid Gun Firing
  if (state.gameState === GameStates.PLAYING && state.squidGunUnlocked && (code === 'KeyF' || code === 'KeyX' || code === 'KeyZ')) {
    fireSquidGun();
  }
});

window.addEventListener('keyup', (e) => {
  state.keys[e.code] = false;
});

// Button bindings
DOM.btnStart.addEventListener('click', () => {
  initAudio();
  startGame();
});

DOM.btnRestart.addEventListener('click', () => {
  initAudio();
  restartGame();
});

if (DOM.btnVictoryContinue) {
  DOM.btnVictoryContinue.addEventListener('click', () => {
    initAudio();
    continueEndless();
  });
}

// Show main menu on load
showScreen('menu-screen');

// ═══════════════════════════════════════════════════════
// SQUID GUN, BOSSES, AND VICTORY HELPERS (v1.3.0 UPDATE)
// ═══════════════════════════════════════════════════════

function fireSquidGun() {
  if (state.gameState !== GameStates.PLAYING) return;
  const now = Date.now();
  if (!state.lastFireTime || now - state.lastFireTime > 350) { // 350ms cooldown
    state.lastFireTime = now;
    state.projectiles.push({
      x: state.boat.x + 35, // Aligned with mounted blaster
      y: state.boat.y + 35,
      vy: 8,
      radius: 6
    });
    playSound('hook');
  }
}

function continueEndless() {
  hideModal('victory-modal');
  state.gameState = GameStates.PLAYING;
  state.lastFrameTime = performance.now();
  state.gameLoopId = requestAnimationFrame(gameLoop);

  state.nextEventCountdown = 20 + Math.floor(Math.random() * 11);
  scheduleNextFishSpawn();
  state.gameTimerId = setInterval(gameSecondTick, 1000);
}

function victory() {
  state.gameState = GameStates.MENU;
  if (state.fishSpawnTimeoutId) clearTimeout(state.fishSpawnTimeoutId);
  if (state.gameTimerId) {
    clearInterval(state.gameTimerId);
    state.gameTimerId = null;
  }
  if (DOM.eventBanner) {
    DOM.eventBanner.classList.remove('active');
  }

  // Save High Score
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem('fishing_highscore', state.highScore);
  }
  DOM.hudHighscore.textContent = state.highScore;
  DOM.victoryScore.textContent = state.score;

  // Unlock Achievement: The god himself
  if (typeof GameHubAchievements !== 'undefined') {
    GameHubAchievements.unlock('fishing', 'god');
  }

  showModal('victory-modal');
}

function checkBossTriggers() {
  if (state.gameState !== GameStates.PLAYING) return;
  if (state.bossActive) return;

  if (state.score >= 1000 && !state.krakenBeaten) {
    startKrakenFight();
  } else if (state.score >= 4000 && !state.poseidonBeaten) {
    startPoseidonFight();
  }
}

function damagePlayer() {
  if (state.boat.invincibleTimer > 0) return; // Invincible!
  state.lives--;
  state.boat.invincibleTimer = 60; // 1s invincibility
  playSound('obstacle');
  updateHUD();

  if (state.lives <= 0) {
    gameOver();
  }
}

// ─── Kraken Boss Fight ───
function startKrakenFight() {
  state.bossActive = 'KRAKEN';
  endEvent();
  state.fishList = []; // Clear other fish
  state.krakenState = {
    health: 3,
    maxHealth: 3,
    phase: 'INTRO', // INTRO, PREPARING, WATER_JET, TENTACLE_CLAP, TIRED, HIT, DEFEATED
    phaseTimer: 0,
    x: 400,
    y: 700,
    targetY: 460,
    attacksDone: 0,
    waterJets: [],
    tentacles: { leftX: 0, rightX: 0, clapTimer: 0, active: false, targetX: 0 }
  };
  playSound('obstacle');

  if (DOM.eventBanner) {
    DOM.eventBanner.className = 'event-banner active kraken-boss';
    DOM.eventName.textContent = 'KRAKEN BOSS FIGHT';
    DOM.eventTimer.textContent = 'HP: 3/3';
  }
}

function updateKraken() {
  const dt = 1;
  const ks = state.krakenState;
  if (!ks) return;

  ks.phaseTimer += dt;

  if (ks.phase === 'INTRO') {
    ks.y += (ks.targetY - ks.y) * 0.04 * dt;
    if (Math.abs(ks.y - ks.targetY) < 2) {
      ks.y = ks.targetY;
      ks.phase = 'PREPARING';
      ks.phaseTimer = 0;
    }
  } else if (ks.phase === 'DEFEATED') {
    ks.y += 4 * dt; // Sink
    if (ks.y > CONFIG.CANVAS_HEIGHT + 100) {
      state.bossActive = null;
      state.krakenBeaten = true;
      state.score += 500;
      state.lives = CONFIG.INITIAL_LIVES;
      state.squidGunUnlocked = true;
      updateHUD();
      state.krakenState = null;

      // Unlock Achievement: Dinner is served
      if (typeof GameHubAchievements !== 'undefined') {
        GameHubAchievements.unlock('fishing', 'dinner');
      }

      if (DOM.eventBanner) {
        DOM.eventBanner.classList.remove('active');
      }

      // Resume normal fish spawning
      scheduleNextFishSpawn();
    }
    return;
  } else if (ks.phase === 'HIT') {
    if (ks.phaseTimer > 45) {
      if (ks.health <= 0) {
        ks.phase = 'DEFEATED';
      } else {
        ks.phase = 'PREPARING';
      }
      ks.phaseTimer = 0;
      if (DOM.eventBanner) {
        DOM.eventName.textContent = 'KRAKEN BOSS FIGHT';
        DOM.eventTimer.textContent = `HP: ${ks.health}/3`;
      }
    }
    return;
  } else {
    ks.y = ks.targetY + Math.sin(Date.now() / 300) * 8;
  }

  // Attack cycle logic
  if (ks.phase === 'PREPARING') {
    if (ks.phaseTimer > 90) { // 1.5s delay
      ks.phaseTimer = 0;
      if (Math.random() < 0.5) {
        ks.phase = 'WATER_JET';
        ks.waterJets = [150, 320, 480, 650].map(x => ({
          x: x,
          width: 45,
          active: false,
          timer: 0
        }));
      } else {
        ks.phase = 'TENTACLE_CLAP';
        ks.tentacles = {
          leftX: state.boat.x - 130,
          rightX: state.boat.x + state.boat.width + 130,
          targetX: state.boat.x + state.boat.width / 2,
          timer: 0,
          active: false
        };
      }
    }
  }

  // Resolve jets
  if (ks.phase === 'WATER_JET') {
    ks.waterJets.forEach(jet => {
      jet.timer += dt;
      if (jet.timer > 80) {
        jet.active = true;
      }
      if (jet.active && jet.timer < 160) {
        const bx1 = state.boat.x;
        const bx2 = state.boat.x + state.boat.width;
        if (bx1 < jet.x + jet.width / 2 && bx2 > jet.x - jet.width / 2) {
          damagePlayer();
        }
      }
    });

    if (ks.phaseTimer > 170) {
      ks.phase = 'TIRED';
      ks.phaseTimer = 0;
      if (DOM.eventBanner) {
        DOM.eventName.textContent = 'KRAKEN IS TIRED!';
      }
    }
  }

  // Resolve clap
  if (ks.phase === 'TENTACLE_CLAP') {
    const tc = ks.tentacles;
    tc.timer += dt;

    if (tc.timer <= 80) {
      tc.targetX = state.boat.x + state.boat.width / 2;
    }

    if (tc.timer >= 120 && !tc.active) {
      tc.active = true;
      playSound('obstacle');

      const boatCenter = state.boat.x + state.boat.width / 2;
      if (Math.abs(boatCenter - tc.targetX) < 70) {
        damagePlayer();
      }
    }

    if (ks.phaseTimer > 165) {
      ks.phase = 'TIRED';
      ks.phaseTimer = 0;
      if (DOM.eventBanner) {
        DOM.eventName.textContent = 'KRAKEN IS TIRED!';
      }
    }
  }

  if (ks.phase === 'TIRED') {
    if (ks.phaseTimer > 240) { // 4s vulnerable
      ks.phase = 'PREPARING';
      ks.phaseTimer = 0;
      if (DOM.eventBanner) {
        DOM.eventName.textContent = 'KRAKEN BOSS FIGHT';
      }
    }
  }
}

function damageKraken() {
  const ks = state.krakenState;
  if (!ks || ks.phase !== 'TIRED') return;

  ks.health--;
  ks.phase = 'HIT';
  ks.phaseTimer = 0;
  playSound('catch');

  if (DOM.eventBanner) {
    DOM.eventTimer.textContent = `HP: ${ks.health}/3`;
  }
}

// ─── Poseidon Boss Fight ───
function startPoseidonFight() {
  state.bossActive = 'POSEIDON';
  endEvent();
  state.fishList = [];
  state.poseidonState = {
    health: 20,
    maxHealth: 20,
    phase: 'INTRO', // INTRO, PREPARING, TRIDENT_THROW, WRATH_WATER_LIGHTNING, WRATH_GIANT_LIGHTNING, HIT, DEFEATED
    phaseTimer: 0,
    x: 400,
    y: 700,
    targetY: 460,
    vx: 2.3,
    tridents: [],
    lightningStrikes: [],
    waterJets: [],
    passiveLightningTimer: 0,
    giantLightning: null
  };
  playSound('obstacle');

  if (DOM.eventBanner) {
    DOM.eventBanner.className = 'event-banner active poseidon-boss';
    DOM.eventName.textContent = 'POSEIDON BOSS FIGHT';
    DOM.eventTimer.textContent = 'HP: 20/20';
  }
}

function updatePoseidon() {
  const dt = 1;
  const ps = state.poseidonState;
  if (!ps) return;

  ps.phaseTimer += dt;

  if (ps.healFlash > 0) {
    ps.healFlash--;
  }

  if (ps.phase === 'INTRO') {
    ps.y += (ps.targetY - ps.y) * 0.04 * dt;
    if (Math.abs(ps.y - ps.targetY) < 2) {
      ps.y = ps.targetY;
      ps.phase = 'PREPARING';
      ps.phaseTimer = 0;
    }
  } else if (ps.phase === 'DEFEATED') {
    ps.y += 4 * dt;
    if (ps.y > CONFIG.CANVAS_HEIGHT + 100) {
      if (!ps.isCursed) {
        // Transition to Cursed Poseidon (Stage 2)
        ps.isCursed = true;
        ps.health = 30;
        ps.maxHealth = 30;
        ps.phase = 'INTRO';
        ps.phaseTimer = 0;
        ps.x = 400;
        ps.y = 700; // Rise again!
        ps.vx = 2.7; // Faster horizontal speed
        ps.waterJets = [];
        ps.tridents = [];
        ps.lightningStrikes = [];
        ps.passiveLightningTimer = 0;
        ps.giantLightning = null;
        ps.tsunami = null;
        ps.meteor = null;
        ps.disasterActive = false;
        ps.cursedHealTimer = 0;

        if (DOM.eventBanner) {
          DOM.eventBanner.className = 'event-banner active cursed-poseidon-boss';
          DOM.eventName.textContent = 'CURSED POSEIDON (STAGE 2)';
          DOM.eventTimer.textContent = 'HP: 30/30';
        }
        playSound('obstacle');
      } else {
        // Truly defeated!
        state.bossActive = null;
        state.poseidonBeaten = true;
        state.score += 750;
        updateHUD();
        state.poseidonState = null;

        if (DOM.eventBanner) {
          DOM.eventBanner.classList.remove('active');
        }

        victory();
      }
    }
    return;
  } else if (ps.phase === 'HIT') {
    if (ps.phaseTimer > 45) {
      if (ps.health <= 0) {
        ps.phase = 'DEFEATED';
      } else {
        ps.phase = 'PREPARING';
      }
      ps.phaseTimer = 0;
      if (DOM.eventBanner) {
        const maxHP = ps.isCursed ? 30 : 20;
        DOM.eventName.textContent = ps.isCursed ? 'CURSED POSEIDON (STAGE 2)' : 'POSEIDON BOSS FIGHT';
        DOM.eventTimer.textContent = `HP: ${ps.health}/${maxHP}`;
      }
    }
    return;
  } else {
    ps.x += ps.vx * dt;
    if (ps.x < 150 || ps.x > 650) {
      ps.vx *= -1;
    }
    ps.y = ps.targetY + Math.sin(Date.now() / 250) * 10;
  }

  // Passive thunderstorm lightning strikes
  if (!ps.disasterActive) {
    ps.passiveLightningTimer += dt;
    const strikeInterval = ps.isCursed ? 130 : 180;
    if (ps.passiveLightningTimer > strikeInterval + Math.random() * 100) {
      ps.passiveLightningTimer = 0;
      const targetX = state.boat.x + (Math.random() - 0.5) * 180;
      ps.lightningStrikes.push({
        x: Math.max(20, Math.min(CONFIG.CANVAS_WIDTH - 20, targetX)),
        width: 16,
        timer: 0,
        fired: false
      });
    }
  }

  // Update lightning strikes
  for (let i = ps.lightningStrikes.length - 1; i >= 0; i--) {
    const s = ps.lightningStrikes[i];
    s.timer += dt;
    if (s.timer > 60) {
      s.fired = true;
    }
    if (s.fired) {
      if (s.timer < 80) {
        const bx1 = state.boat.x;
        const bx2 = state.boat.x + state.boat.width;
        if (bx1 < s.x + s.width && bx2 > s.x - s.width) {
          damagePlayer();
        }
      } else {
        ps.lightningStrikes.splice(i, 1);
      }
    }
  }

  // Update all tridents
  for (let i = ps.tridents.length - 1; i >= 0; i--) {
    const t = ps.tridents[i];
    t.y += t.vy * dt;

    if (t.y <= state.boat.y + state.boat.height && t.y >= state.boat.y) {
      if (t.x >= state.boat.x && t.x <= state.boat.x + state.boat.width) {
        damagePlayer();
        ps.tridents.splice(i, 1);
        continue;
      }
    }

    if (t.y < 0) {
      ps.tridents.splice(i, 1);
    }
  }

  // Update water jets if defined in either phase
  if ((ps.phase === 'WRATH_WATER_LIGHTNING' || ps.phase === 'DISASTER_REALM') && ps.waterJets) {
    ps.waterJets.forEach(jet => {
      jet.timer += dt;
      if (jet.timer > 80) {
        jet.active = true;
      }
      if (jet.active && jet.timer < 150) {
        const bx1 = state.boat.x;
        const bx2 = state.boat.x + state.boat.width;
        if (bx1 < jet.x + jet.width / 2 && bx2 > jet.x - jet.width / 2) {
          damagePlayer();
        }
      }
    });
  }

  // Action states
  if (ps.phase === 'PREPARING') {
    const prepLimit = ps.isCursed ? 75 : 100;
    if (ps.phaseTimer > prepLimit) {
      ps.phaseTimer = 0;
      if (ps.isCursed) {
        // Choose between 5 attacks for Cursed Poseidon
        const roll = Math.random();
        if (roll < 0.15) {
          ps.phase = 'TRIDENT_THROW';
        } else if (roll < 0.30) {
          ps.phase = 'WRATH_WATER_LIGHTNING';
        } else if (roll < 0.50) {
          ps.phase = 'TRIDENT_MADNESS';
        } else if (roll < 0.70) {
          ps.phase = 'TSUNAMI';
          const dir = Math.random() < 0.5 ? 'left' : 'right';
          ps.tsunami = {
            dir: dir,
            x: dir === 'left' ? -150 : CONFIG.CANVAS_WIDTH + 150,
            width: 140,
            height: 180,
            speed: dir === 'left' ? 7.5 : -7.5,
            timer: 0,
            active: false
          };
          playSound('obstacle');
        } else {
          ps.phase = 'DISASTER_REALM';
          ps.disasterTimer = 0;
          ps.disasterActive = true;
          ps.meteor = null;
          ps.giantLightning = null;
        }
      } else {
        // Stage 1 Normal Poseidon attacks
        if (Math.random() < 0.5) {
          ps.phase = 'TRIDENT_THROW';
        } else {
          ps.phase = 'WRATH_WATER_LIGHTNING';
        }
      }
    }
  }

  if (ps.phase === 'TRIDENT_THROW') {
    if (ps.phaseTimer === 35) {
      ps.tridents.push({
        x: ps.x,
        y: ps.y - 40,
        vy: -6.5,
        width: 16,
        height: 36
      });
      playSound('hook');
    }

    if (ps.phaseTimer > 150) {
      ps.phase = 'PREPARING';
      ps.phaseTimer = 0;
    }
  }

  if (ps.phase === 'TRIDENT_MADNESS') {
    if (ps.phaseTimer === 35) {
      const offsets = [-160, -80, 0, 80, 160];
      offsets.forEach(offset => {
        ps.tridents.push({
          x: Math.max(20, Math.min(CONFIG.CANVAS_WIDTH - 20, ps.x + offset)),
          y: ps.y - 40,
          vy: -5.5,
          width: 16,
          height: 36,
          isCursed: true
        });
      });
      playSound('hook');
    }

    if (ps.phaseTimer > 160) {
      ps.phase = 'PREPARING';
      ps.phaseTimer = 0;
    }
  }

  if (ps.phase === 'TSUNAMI' && ps.tsunami) {
    const ts = ps.tsunami;
    ts.timer += dt;
    if (ts.timer > 60) {
      ts.active = true;
      ts.x += ts.speed * dt;

      // Collision check with boat
      const tx1 = ts.x - ts.width / 2;
      const tx2 = ts.x + ts.width / 2;
      const bx1 = state.boat.x;
      const bx2 = state.boat.x + state.boat.width;
      if (bx1 < tx2 && bx2 > tx1) {
        damagePlayer();
      }
    }

    // Check if finished
    const finishedLeft = ts.dir === 'left' && ts.x > CONFIG.CANVAS_WIDTH + 150;
    const finishedRight = ts.dir === 'right' && ts.x < -150;
    if (finishedLeft || finishedRight) {
      ps.tsunami = null;
      ps.phase = 'PREPARING';
      ps.phaseTimer = 0;
    }
  }

  if (ps.phase === 'WRATH_WATER_LIGHTNING') {
    if (ps.phaseTimer === 1) {
      ps.waterJets = [150, 400, 650].map(x => ({
        x: x,
        width: 95,
        active: false,
        timer: 0
      }));
      for (let j = 0; j < 3; j++) {
        ps.lightningStrikes.push({
          x: 100 + Math.random() * 600,
          width: 18,
          timer: 0,
          fired: false
        });
      }
    }

    if (ps.phaseTimer > 160) {
      ps.phase = 'WRATH_GIANT_LIGHTNING';
      ps.phaseTimer = 0;
      ps.giantLightning = {
        x: state.boat.x + state.boat.width / 2,
        width: 130,
        timer: 0,
        fired: false
      };
      playSound('obstacle');
    }
  }

  if (ps.phase === 'WRATH_GIANT_LIGHTNING') {
    const gl = ps.giantLightning;
    if (gl) {
      gl.timer += dt;
      if (gl.timer > 90) {
        gl.fired = true;
      }
      if (gl.fired) {
        if (gl.timer < 130) {
          const bx1 = state.boat.x;
          const bx2 = state.boat.x + state.boat.width;
          if (bx1 < gl.x + gl.width / 2 && bx2 > gl.x - gl.width / 2) {
            state.lives = 0;
            updateHUD();
            gameOver();
          }
        } else {
          ps.giantLightning = null;
          ps.phase = 'PREPARING';
          ps.phaseTimer = 0;
        }
      }
    }
  }

  if (ps.phase === 'DISASTER_REALM' && ps.disasterActive) {
    ps.disasterTimer += dt;

    // Subphase 1: METEOR (0 - 180)
    if (ps.disasterTimer === 10) {
      ps.meteor = {
        x: state.boat.x + state.boat.width / 2 + (Math.random() - 0.5) * 80,
        y: -100,
        targetY: CONFIG.SURFACE_Y,
        radius: 40,
        vy: 5.0,
        timer: 0,
        fired: false
      };
    }
    if (ps.meteor) {
      ps.meteor.timer += dt;
      if (ps.meteor.timer > 90) {
        ps.meteor.fired = true;
        ps.meteor.y += ps.meteor.vy * dt;
        if (ps.meteor.y >= ps.meteor.targetY) {
          const bx = state.boat.x + state.boat.width / 2;
          const dist = Math.abs(bx - ps.meteor.x);
          if (dist < ps.meteor.radius * 2.5) {
            state.lives = 0;
            updateHUD();
            gameOver();
          }
          playSound('obstacle');
          ps.meteor = null;
        }
      }
    }

    // Subphase 2: WATER JETS (181 - 360)
    if (ps.disasterTimer === 190) {
      ps.waterJets = [150, 400, 650].map(x => ({
        x: x,
        width: 95,
        active: false,
        timer: 0
      }));
    }

    // Subphase 3: CONSECUTIVE THUNDER STRIKES (361 - 540)
    if (ps.disasterTimer >= 361 && ps.disasterTimer <= 540) {
      if (ps.disasterTimer % 20 === 0) {
        ps.lightningStrikes.push({
          x: Math.max(20, Math.min(CONFIG.CANVAS_WIDTH - 20, state.boat.x + (Math.random() - 0.5) * 240)),
          width: 16,
          timer: 0,
          fired: false
        });
      }
    }

    // Subphase 4: GIANT LIGHTNING (541 - 720)
    if (ps.disasterTimer === 550) {
      ps.giantLightning = {
        x: state.boat.x + state.boat.width / 2,
        width: 130,
        timer: 0,
        fired: false
      };
      playSound('obstacle');
    }
    if (ps.giantLightning) {
      const gl = ps.giantLightning;
      gl.timer += dt;
      if (gl.timer > 90) {
        gl.fired = true;
      }
      if (gl.fired) {
        if (gl.timer < 130) {
          const bx1 = state.boat.x;
          const bx2 = state.boat.x + state.boat.width;
          if (bx1 < gl.x + gl.width / 2 && bx2 > gl.x - gl.width / 2) {
            state.lives = 0;
            updateHUD();
            gameOver();
          }
        } else {
          ps.giantLightning = null;
        }
      }
    }

    // End of Disaster Realm
    if (ps.disasterTimer > 750) {
      ps.disasterActive = false;
      ps.phase = 'PREPARING';
      ps.phaseTimer = 0;
    }
  }
}

function damagePoseidon() {
  const ps = state.poseidonState;
  if (!ps || ps.phase === 'HIT' || ps.phase === 'DEFEATED' || ps.phase === 'INTRO') return;

  ps.health--;
  ps.phase = 'HIT';
  ps.phaseTimer = 0;
  playSound('catch');

  if (DOM.eventBanner) {
    const maxHP = ps.isCursed ? 30 : 20;
    DOM.eventTimer.textContent = `HP: ${ps.health}/${maxHP}`;
  }
}

function updateProjectiles() {
  const dt = 1;
  const ps = state.poseidonState;

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const bullet = state.projectiles[i];
    bullet.y += bullet.vy * dt;

    if (bullet.y > CONFIG.CANVAS_HEIGHT) {
      state.projectiles.splice(i, 1);
      continue;
    }

    if (state.bossActive === 'POSEIDON' && ps) {
      const dist = Math.hypot(bullet.x - ps.x, bullet.y - ps.y);
      if (dist < 45) {
        damagePoseidon();
        state.projectiles.splice(i, 1);
      }
    }
  }
}

// ─── Rendering Boss Visuals ───
function drawKraken() {
  const ks = state.krakenState;
  if (!ks) return;

  ctx.save();
  ctx.translate(ks.x, ks.y);

  const isHit = ks.phase === 'HIT';
  if (isHit && Math.floor(ks.phaseTimer / 4) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
  } else {
    ctx.fillStyle = '#831843';
    ctx.shadowColor = '#d946ef';
  }
  ctx.shadowBlur = 15;

  ctx.beginPath();
  ctx.ellipse(0, 0, 80, 60, 0, 0, Math.PI * 2);
  ctx.fill();

  const eyeOpen = ks.phase !== 'TIRED';
  if (eyeOpen) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, -25, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(0, -25, 6, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-18, -25);
    ctx.lineTo(18, -25);
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('LELAH - PANCING MATANYA!', 0, -65);
  }

  const wave = Math.sin(Date.now() / 150) * 10;
  ctx.fillStyle = '#9d174d';
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    ctx.beginPath();
    ctx.ellipse(i * 20, 30 + wave, 8, 30, (i * 10 * Math.PI) / 180, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Water jets rendering
  if (ks.phase === 'WATER_JET') {
    ks.waterJets.forEach(jet => {
      if (jet.active) {
        const jetGrad = ctx.createLinearGradient(jet.x - jet.width / 2, 0, jet.x + jet.width / 2, 0);
        jetGrad.addColorStop(0, 'rgba(0, 240, 255, 0.25)');
        jetGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
        jetGrad.addColorStop(1, 'rgba(0, 240, 255, 0.25)');
        ctx.fillStyle = jetGrad;
        ctx.shadowColor = '#00d2ff';
        ctx.shadowBlur = 20;
        ctx.fillRect(jet.x - jet.width / 2, CONFIG.SURFACE_Y, jet.width, CONFIG.CANVAS_HEIGHT - CONFIG.SURFACE_Y);
      } else {
        if (Math.floor(jet.timer / 8) % 2 === 0) {
          ctx.strokeStyle = '#ff4466';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(jet.x - jet.width / 2, CONFIG.SURFACE_Y, jet.width, CONFIG.CANVAS_HEIGHT - CONFIG.SURFACE_Y);
          ctx.setLineDash([]);
        }
      }
    });
  }

  // Tentacle clap rendering
  if (ks.phase === 'TENTACLE_CLAP') {
    const tc = ks.tentacles;
    ctx.save();
    ctx.fillStyle = '#be185d';
    ctx.strokeStyle = '#00d2ff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#d946ef';
    ctx.lineWidth = 2.5;

    const isWarning = tc.timer <= 80;
    const isClapping = tc.timer > 80 && tc.timer <= 120;
    const hasClapped = tc.timer > 120;

    let leftX = tc.leftX;
    let rightX = tc.rightX;

    if (isWarning) {
      ctx.globalAlpha = 0.3 + Math.abs(Math.sin(Date.now() / 100)) * 0.4;
    } else if (isClapping) {
      const progress = (tc.timer - 80) / 40;
      leftX = tc.leftX + (tc.targetX - 25 - tc.leftX) * progress;
      rightX = tc.rightX + (tc.targetX + 25 - tc.rightX) * progress;
    } else {
      leftX = tc.targetX - 25;
      rightX = tc.targetX + 25;
    }

    ctx.beginPath();
    ctx.moveTo(leftX - 30, CONFIG.CANVAS_HEIGHT);
    ctx.quadraticCurveTo(leftX - 50, CONFIG.SURFACE_Y + 50, leftX, CONFIG.SURFACE_Y + 10);
    ctx.lineTo(leftX + 20, CONFIG.SURFACE_Y + 10);
    ctx.quadraticCurveTo(leftX - 20, CONFIG.SURFACE_Y + 50, leftX - 10, CONFIG.CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightX + 30, CONFIG.CANVAS_HEIGHT);
    ctx.quadraticCurveTo(rightX + 50, CONFIG.SURFACE_Y + 50, rightX, CONFIG.SURFACE_Y + 10);
    ctx.lineTo(rightX - 20, CONFIG.SURFACE_Y + 10);
    ctx.quadraticCurveTo(rightX + 20, CONFIG.SURFACE_Y + 50, rightX + 10, CONFIG.CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (hasClapped && tc.timer < 145) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00d2ff';
      ctx.beginPath();
      ctx.arc(tc.targetX, CONFIG.SURFACE_Y + 40, 40, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawPoseidon() {
  const ps = state.poseidonState;
  if (!ps) return;

  ctx.save();
  ctx.translate(ps.x, ps.y);

  const isHit = ps.phase === 'HIT';
  if (isHit && Math.floor(ps.phaseTimer / 4) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
  } else if (ps.healFlash > 0 && Math.floor(ps.healFlash / 3) % 2 === 0) {
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#34d399';
  } else {
    ctx.fillStyle = ps.isCursed ? '#311042' : '#115e59';
    ctx.shadowColor = ps.isCursed ? '#f43f5e' : '#00f0ff';
  }
  ctx.shadowBlur = 15;

  ctx.beginPath();
  ctx.ellipse(0, 0, 45, 60, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, -75, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ps.isCursed ? '#991b1b' : '#fbbf24';
  ctx.shadowColor = ps.isCursed ? '#ef4444' : '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(-15, -95);
  ctx.lineTo(-10, -85);
  ctx.lineTo(0, -102);
  ctx.lineTo(10, -85);
  ctx.lineTo(15, -95);
  ctx.lineTo(12, -75);
  ctx.lineTo(-12, -75);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = ps.isCursed ? '#701a75' : '#2dd4bf';
  ctx.shadowColor = ps.isCursed ? '#d946ef' : '#2dd4bf';
  ctx.beginPath();
  ctx.moveTo(-20, -75);
  ctx.quadraticCurveTo(-35, -40, -25, 0);
  ctx.lineTo(-15, 0);
  ctx.quadraticCurveTo(-15, -45, -15, -75);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(20, -75);
  ctx.quadraticCurveTo(35, -40, 25, 0);
  ctx.lineTo(15, 0);
  ctx.quadraticCurveTo(15, -45, 15, -75);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = ps.isCursed ? '#f43f5e' : '#ffffff';
  ctx.shadowColor = ps.isCursed ? '#fda4af' : '#ffffff';
  ctx.beginPath();
  ctx.arc(-8, -78, 3, 0, Math.PI * 2);
  ctx.arc(8, -78, 3, 0, Math.PI * 2);
  ctx.fill();

  // Crown/Trident colors
  ctx.strokeStyle = ps.isCursed ? '#b91c1c' : '#fbbf24';
  ctx.lineWidth = 3;
  ctx.shadowColor = ps.isCursed ? '#dc2626' : '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(35, 30);
  ctx.lineTo(35, -70);
  ctx.stroke();

  ctx.fillStyle = ps.isCursed ? '#b91c1c' : '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(27, -70);
  ctx.lineTo(43, -70);
  ctx.lineTo(43, -85);
  ctx.lineTo(38, -80);
  ctx.lineTo(35, -95);
  ctx.lineTo(32, -80);
  ctx.lineTo(27, -85);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // ─── Absolute Canvas Coordinates Drawing ───

  // Lightning strikes render
  ps.lightningStrikes.forEach(strike => {
    if (strike.fired) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 20;
      ctx.lineWidth = 3;
      ctx.beginPath();
      let curX = strike.x;
      ctx.moveTo(curX, 0);
      const segments = 10;
      const segmentHeight = CONFIG.SURFACE_Y / segments;
      for (let s = 1; s <= segments; s++) {
        const nextY = s * segmentHeight;
        const nextX = strike.x + (Math.random() - 0.5) * 15;
        ctx.lineTo(nextX, nextY);
        curX = nextX;
      }
      ctx.lineTo(strike.x, CONFIG.SURFACE_Y);
      ctx.stroke();
      ctx.restore();
    } else {
      if (Math.floor(strike.timer / 6) % 2 === 0) {
        ctx.strokeStyle = 'rgba(255, 68, 102, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(strike.x, 0);
        ctx.lineTo(strike.x, CONFIG.SURFACE_Y);
        ctx.stroke();
      }
    }
  });

  // Tridents render
  ps.tridents.forEach(t => {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.shadowColor = t.isCursed ? '#ef4444' : '#fbbf24';
    ctx.shadowBlur = 12;

    ctx.strokeStyle = t.isCursed ? '#b91c1c' : '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(0, -20);
    ctx.stroke();

    ctx.fillStyle = t.isCursed ? '#b91c1c' : '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-8, -20);
    ctx.lineTo(8, -20);
    ctx.lineTo(8, -28);
    ctx.lineTo(4, -25);
    ctx.lineTo(0, -36);
    ctx.lineTo(-4, -25);
    ctx.lineTo(-8, -28);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  });

  // Water jets wrath render
  if ((ps.phase === 'WRATH_WATER_LIGHTNING' || ps.phase === 'DISASTER_REALM') && ps.waterJets) {
    ps.waterJets.forEach(jet => {
      if (jet.active) {
        const jetGrad = ctx.createLinearGradient(jet.x - jet.width / 2, 0, jet.x + jet.width / 2, 0);
        const color1 = ps.isCursed ? 'rgba(162, 28, 175, 0.25)' : 'rgba(0, 240, 255, 0.25)';
        const color2 = '#ffffff';
        const color3 = ps.isCursed ? 'rgba(162, 28, 175, 0.25)' : 'rgba(0, 240, 255, 0.25)';
        jetGrad.addColorStop(0, color1);
        jetGrad.addColorStop(0.5, color2);
        jetGrad.addColorStop(1, color3);
        ctx.fillStyle = jetGrad;
        ctx.shadowColor = ps.isCursed ? '#dc2626' : '#00d2ff';
        ctx.shadowBlur = 20;
        ctx.fillRect(jet.x - jet.width / 2, CONFIG.SURFACE_Y, jet.width, CONFIG.CANVAS_HEIGHT - CONFIG.SURFACE_Y);
      } else {
        if (Math.floor(jet.timer / 8) % 2 === 0) {
          ctx.strokeStyle = '#ff4466';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(jet.x - jet.width / 2, CONFIG.SURFACE_Y, jet.width, CONFIG.CANVAS_HEIGHT - CONFIG.SURFACE_Y);
          ctx.setLineDash([]);
        }
      }
    });
  }

  // Giant lightning render
  const gl = ps.giantLightning;
  if (gl) {
    if (gl.fired) {
      ctx.save();
      const glLeft = gl.x - gl.width / 2;
      const glRight = gl.x + gl.width / 2;

      const plasGrad = ctx.createLinearGradient(glLeft, 0, glRight, 0);
      const startCol = ps.isCursed ? 'rgba(147, 51, 234, 0.2)' : 'rgba(255, 0, 100, 0.2)';
      const midCol1 = ps.isCursed ? 'rgba(236, 72, 153, 0.7)' : 'rgba(0, 240, 255, 0.7)';
      const midCol2 = '#ffffff';
      const midCol3 = ps.isCursed ? 'rgba(236, 72, 153, 0.7)' : 'rgba(0, 240, 255, 0.7)';
      const endCol = ps.isCursed ? 'rgba(147, 51, 234, 0.2)' : 'rgba(255, 0, 100, 0.2)';
      plasGrad.addColorStop(0, startCol);
      plasGrad.addColorStop(0.3, midCol1);
      plasGrad.addColorStop(0.5, midCol2);
      plasGrad.addColorStop(0.7, midCol3);
      plasGrad.addColorStop(1, endCol);

      ctx.fillStyle = plasGrad;
      ctx.shadowColor = ps.isCursed ? '#d946ef' : '#00f0ff';
      ctx.shadowBlur = 35;
      ctx.fillRect(glLeft, 0, gl.width, CONFIG.CANVAS_HEIGHT);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let cy = 0;
      ctx.moveTo(gl.x + (Math.random() - 0.5) * 30, cy);
      while (cy < CONFIG.CANVAS_HEIGHT) {
        cy += 30;
        ctx.lineTo(gl.x + (Math.random() - 0.5) * 50, cy);
      }
      ctx.stroke();

      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.abs(Math.sin(Date.now() / 80)) * 0.45;
      ctx.fillStyle = 'rgba(255, 0, 50, 0.2)';
      ctx.fillRect(gl.x - gl.width / 2, 0, gl.width, CONFIG.CANVAS_HEIGHT);

      ctx.strokeStyle = '#ff0033';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(gl.x - gl.width / 2, 0);
      ctx.lineTo(gl.x - gl.width / 2, CONFIG.CANVAS_HEIGHT);
      ctx.moveTo(gl.x + gl.width / 2, 0);
      ctx.lineTo(gl.x + gl.width / 2, CONFIG.CANVAS_HEIGHT);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Tsunami wave render
  const ts = ps.tsunami;
  if (ts) {
    ctx.save();
    if (ts.timer < 60) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 22px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      const msg = ts.dir === 'left' ? '⚠ TSUNAMI DARI KIRI! LARI KE KANAN! ⚠' : '⚠ TSUNAMI DARI KANAN! LARI KE KIRI! ⚠';
      ctx.fillText(msg, CONFIG.CANVAS_WIDTH / 2, CONFIG.SURFACE_Y - 15);
    }

    if (ts.active) {
      const waveGrad = ctx.createLinearGradient(ts.x - ts.width / 2, 0, ts.x + ts.width / 2, 0);
      waveGrad.addColorStop(0, 'rgba(162, 28, 175, 0.85)');
      waveGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.9)');
      waveGrad.addColorStop(1, 'rgba(162, 28, 175, 0.85)');

      ctx.fillStyle = waveGrad;
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 25;

      ctx.beginPath();
      const leftX = ts.x - ts.width / 2;
      const rightX = ts.x + ts.width / 2;
      ctx.moveTo(leftX, CONFIG.CANVAS_HEIGHT);
      ctx.lineTo(leftX, CONFIG.SURFACE_Y - 40);
      ctx.quadraticCurveTo(ts.x, CONFIG.SURFACE_Y - 80, rightX, CONFIG.SURFACE_Y - 20);
      ctx.lineTo(rightX, CONFIG.CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Foam
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(ts.x, CONFIG.SURFACE_Y - 50, ts.width / 2, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Meteor render
  const met = ps.meteor;
  if (met) {
    ctx.save();
    if (!met.fired) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(met.x, CONFIG.SURFACE_Y + 20, 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(239, 68, 68, 0.15 + Math.abs(Math.sin(Date.now() / 100)) * 0.2)';
      ctx.beginPath();
      ctx.arc(met.x, CONFIG.SURFACE_Y + 20, 60, 0, Math.PI * 2);
      ctx.fill();
    }

    if (met.y < CONFIG.SURFACE_Y + 30) {
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(met.x, met.y, met.radius, 0, Math.PI * 2);
      ctx.fill();

      const tailGrad = ctx.createLinearGradient(met.x, met.y, met.x, met.y - 120);
      tailGrad.addColorStop(0, '#ef4444');
      tailGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.5)');
      tailGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = tailGrad;
      ctx.beginPath();
      ctx.moveTo(met.x - met.radius, met.y);
      ctx.lineTo(met.x, met.y - 120);
      ctx.lineTo(met.x + met.radius, met.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
