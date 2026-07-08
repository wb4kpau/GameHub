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
  canvas: document.getElementById('game-canvas'),
  btnStart: document.getElementById('btn-start'),
  btnRestart: document.getElementById('btn-restart'),
  hudScore: document.getElementById('hud-score'),
  hudHighscore: document.getElementById('hud-highscore'),
  hudLives: document.getElementById('hud-lives'),
  gameoverScore: document.getElementById('gameover-score'),
  gameoverSubtitle: document.getElementById('gameover-subtitle'),
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
  ctx.fillStyle = '#060f1e';
  ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.SURFACE_Y);

  // 2. Draw Sea Gradient (deepening water)
  const grad = ctx.createLinearGradient(0, CONFIG.SURFACE_Y, 0, CONFIG.CANVAS_HEIGHT);
  grad.addColorStop(0, '#001a33');
  grad.addColorStop(0.5, '#000c1a');
  grad.addColorStop(1, '#000308');
  ctx.fillStyle = grad;
  ctx.fillRect(0, CONFIG.SURFACE_Y, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT - CONFIG.SURFACE_Y);

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

  // 6. Draw Hook & Line
  drawHookAndLine();

  // 7. Draw Boat
  drawBoat(state.boat.x, state.boat.y);
}

function drawBoat(x, y) {
  ctx.save();
  ctx.translate(x, y);

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
    ctx.ellipse(type.width/2, type.height/2, type.width/2, type.height/3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bottle cap
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, type.height/2 - 3, 4, 6);
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

// Show main menu on load
showScreen('menu-screen');
