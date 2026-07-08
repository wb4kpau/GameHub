/* ═══════════════════════════════════════════════════════
   ZOMBIE ATTACK — CORE GAME LOGIC
   HTML5 Canvas, Custom Particle Engine, Web Audio Synthesis
   ═══════════════════════════════════════════════════════ */

// ─── Constants & Weapon Database ───
const WEAPONS_DB = {
  pistol: {
    name: "Neon Pistol",
    desc: "Senjata standard. Akurasi baik dengan amunisi tak terbatas.",
    price: 0,
    baseDamage: 12,
    baseFireRate: 350,      // ms between shots
    baseReloadTime: 1200,   // ms
    baseMagazine: Infinity,
    bulletSpread: 0.05,
    bulletSpeed: 12,
    heavy: false
  },
  shotgun: {
    name: "Tactical Shotgun",
    desc: "Menembakkan sebaran peluru jarak dekat. Efektif untuk kerumunan.",
    price: 80,
    baseDamage: 15, // per pellet
    baseFireRate: 850,
    baseReloadTime: 2000,
    baseMagazine: 6,
    bulletSpread: 0.28,
    bulletSpeed: 10,
    pellets: 5,
    heavy: true
  },
  smg: {
    name: "Micro SMG",
    desc: "Menembak sangat cepat dengan recoil sedang. Sangat lincah.",
    price: 150,
    baseDamage: 9,
    baseFireRate: 110,
    baseReloadTime: 1500,
    baseMagazine: 30,
    bulletSpread: 0.15,
    bulletSpeed: 14,
    heavy: false
  },
  assault: {
    name: "Pulse Rifle",
    desc: "Senjata otomatis serbaguna dengan damage dan akurasi tinggi.",
    price: 250,
    baseDamage: 18,
    baseFireRate: 180,
    baseReloadTime: 1800,
    baseMagazine: 25,
    bulletSpread: 0.08,
    bulletSpeed: 15,
    heavy: false
  },
  sniper: {
    name: "Rail Sniper",
    desc: "Tembakan super kuat yang menembus seluruh zombie dalam garis lurus.",
    price: 400,
    baseDamage: 90,
    baseFireRate: 1500,
    baseReloadTime: 2500,
    baseMagazine: 5,
    bulletSpread: 0.01,
    bulletSpeed: 22,
    heavy: true
  },
  minigun: {
    name: "Plasma Minigun",
    desc: "Kekuatan tembak mutlak dengan amunisi raksasa. Memperlambat gerakan saat menembak.",
    price: 600,
    baseDamage: 14,
    baseFireRate: 70,
    baseReloadTime: 3000,
    baseMagazine: 100,
    bulletSpread: 0.22,
    bulletSpeed: 16,
    heavy: true
  }
};

const ENEMY_TYPES = {
  regular: {
    name: "Zombie Biasa",
    baseHp: 35,
    baseSpeed: 1.3,
    baseDamage: 10,
    size: 15,
    color: "#39ff14",
    coinRange: [1, 3]
  },
  runner: {
    name: "Zombie Pelari",
    baseHp: 18,
    baseSpeed: 2.2,
    baseDamage: 6,
    size: 12,
    color: "#ff0055",
    coinRange: [2, 4]
  },
  tank: {
    name: "Zombie Tank",
    baseHp: 100,
    baseSpeed: 0.7,
    baseDamage: 25,
    size: 24,
    color: "#00ffcc",
    coinRange: [5, 10]
  },
  thrower: {
    name: "Zombie Pelempar",
    baseHp: 25,
    baseSpeed: 1.1,
    baseDamage: 12,
    size: 15,
    color: "#b85eff",
    coinRange: [4, 6],
    shootCooldown: 2500 // ms
  },
  boss: {
    name: "MUTATED BOSS",
    baseHp: 500,
    baseSpeed: 0.85,
    baseDamage: 30,
    size: 38,
    color: "#ffaa00",
    coinRange: [50, 100]
  },
  zombie_king: {
    name: "ZOMBIE KING",
    baseHp: 2000,
    baseSpeed: 0.8,
    baseDamage: 40,
    size: 45,
    color: "#e600ff", // Glowing purple/magenta royal theme
    coinRange: [500, 1000],
    shootCooldown: 1800 // ms
  }
};

const OBSTACLES = [
  // School desks, classroom walls, and columns (x, y, w, h)
  { x: 120, y: 150, w: 80, h: 40, label: "Meja Guru" },
  { x: 260, y: 150, w: 120, h: 40, label: "Loker Kelas" },
  { x: 500, y: 150, w: 120, h: 40, label: "Loker Kelas" },
  { x: 150, y: 350, w: 100, h: 60, label: "Meja Kantin" },
  { x: 350, y: 350, w: 100, h: 60, label: "Meja Kantin" },
  { x: 550, y: 350, w: 100, h: 60, label: "Meja Kantin" },
  { x: 80, y: 500, w: 180, h: 30, label: "Papan Tulis Aula" },
  { x: 540, y: 500, w: 180, h: 30, label: "Papan Tulis Aula" }
];

// ─── Sound FX Synthesizer (Web Audio API) ───
class SoundFXManager {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playLaser(pitch = 1) {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(600 * pitch, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80 * pitch, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  playShotgun() {
    this.init();
    if (!this.ctx) return;
    // Synthesis noise buffer for blast
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  playReload() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(450, this.ctx.currentTime + 0.12);
    osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.32);
  }

  playHit() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.13);
  }

  playHurt() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.26);
  }

  playCoin() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
    osc.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.08); // E6

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.26);
  }

  playBossWarning() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(120, this.ctx.currentTime + 0.3);
    osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.85);
  }

  playGachaFlip() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.26);
  }

  playUpgrade() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.06); // E5
    osc.frequency.setValueAtTime(783.99, this.ctx.currentTime + 0.12); // G5
    osc.frequency.setValueAtTime(1046.50, this.ctx.currentTime + 0.18); // C6

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.46);
  }
}

const Sound = new SoundFXManager();

// ─── Game Management Class ───
class ZombieAttackGame {
  constructor() {
    // Canvas & Setup
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // States
    this.active = false;
    this.paused = false;
    this.wave = 1;
    this.score = 0;
    this.runZCoins = 0; // zcoins earned in current playthrough
    this.animationFrameId = null;

    // Persistence Data
    this.zcoins = 0;
    this.unlockedWeapons = ["pistol"];
    this.activeWeapon = "pistol";
    this.extraLives = 0;
    this.weaponStats = {
      pistol: { damageLvl: 1, fireRateLvl: 1, capacityLvl: 1 },
      shotgun: { damageLvl: 1, fireRateLvl: 1, capacityLvl: 1 },
      smg: { damageLvl: 1, fireRateLvl: 1, capacityLvl: 1 },
      assault: { damageLvl: 1, fireRateLvl: 1, capacityLvl: 1 },
      sniper: { damageLvl: 1, fireRateLvl: 1, capacityLvl: 1 },
      minigun: { damageLvl: 1, fireRateLvl: 1, capacityLvl: 1 }
    };

    // Current Run Upgrades (Mutations Gacha Skills)
    this.activeSkills = {
      fire: 0,
      ice: 0,
      shadow: 0
    };

    // Ultimate System State
    this.ultimateCharge = 0;       // 0 to 100
    this.activeUltimate = "laser";  // "laser" or "immortality"
    this.ultimateActive = false;
    this.ultimateTimeRemaining = 0; // seconds remaining
    this.laserAngle = 0;
    this.godMode = false;
    this.limitBreakerActive = false;
    this.supernovaFlashAlpha = 0;

    // Entities
    this.player = {
      x: this.width / 2,
      y: this.height / 2,
      radius: 14,
      hp: 100,
      maxHp: 100,
      speed: 3.5,
      angle: 0,
      ammo: 0,
      maxAmmo: 0,
      isReloading: false,
      reloadProgress: 0, // 0 to 1
      lastShotTime: 0
    };

    this.bullets = [];
    this.enemies = [];
    this.enemyProjectiles = [];
    this.particles = [];
    this.spawnQueue = [];
    this.nextSpawnTime = 0;

    // Control Map
    this.keys = {};
    this.mouse = { x: this.width / 2, y: this.height / 2 };

    // Mobile Virtual Joysticks
    this.joysticks = {
      move: { active: false, startX: 0, startY: 0, curX: 0, curY: 0, dirX: 0, dirY: 0 },
      shoot: { active: false, startX: 0, startY: 0, curX: 0, curY: 0, dirX: 0, dirY: 0 }
    };

    // Shop Navigation Cache
    this.shopSelectedWeapon = "pistol";

    // Bind Event Listeners
    this.initEvents();
    this.resetProgression();
  }

  // ─── Local Storage Progres ───
  saveGame() {
    const data = {
      zcoins: this.zcoins,
      unlockedWeapons: this.unlockedWeapons,
      activeWeapon: this.activeWeapon,
      extraLives: this.extraLives,
      weaponStats: this.weaponStats
    };
    localStorage.setItem("zombie_attack_save", JSON.stringify(data));
    this.updateHUDValues();
  }

  loadGame() {
    const raw = localStorage.getItem("zombie_attack_save");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        this.zcoins = data.zcoins || 0;
        this.unlockedWeapons = data.unlockedWeapons || ["pistol"];
        this.activeWeapon = data.activeWeapon || "pistol";
        this.extraLives = data.extraLives || 0;
        this.weaponStats = data.weaponStats || this.weaponStats;
      } catch (e) {
        console.error("Failed loading save profile, resetting defaults", e);
      }
    }
    this.updateHUDValues();
  }

  resetProgression() {
    this.zcoins = 0;
    this.runZCoins = 0;
    this.extraLives = 0;
    this.unlockedWeapons = ["pistol"];
    this.activeWeapon = "pistol";
    this.weaponStats = {
      pistol: { damageLvl: 1, fireRateLvl: 1, capacityLvl: 1 },
      shotgun: { damageLvl: 1, fireRateLvl: 1, capacityLvl: 1 },
      smg: { damageLvl: 1, fireRateLvl: 1, capacityLvl: 1 },
      assault: { damageLvl: 1, fireRateLvl: 1, capacityLvl: 1 },
      sniper: { damageLvl: 1, fireRateLvl: 1, capacityLvl: 1 },
      minigun: { damageLvl: 1, fireRateLvl: 1, capacityLvl: 1 }
    };
    this.activeSkills = { fire: 0, ice: 0, shadow: 0 };
    this.saveGame();
    this.updateSkillsHUD();

    // Sync menu ultimate selection buttons
    const btnLaser = document.getElementById("btn-select-laser");
    const btnImmortality = document.getElementById("btn-select-immortality");
    if (btnLaser && btnImmortality) {
      if (this.activeUltimate === "laser") {
        btnLaser.classList.add("active");
        btnImmortality.classList.remove("active");
      } else {
        btnImmortality.classList.add("active");
        btnLaser.classList.remove("active");
      }
    }
  }

  // ─── Input & Touch Handlers ───
  initEvents() {
    // Keyboard inputs
    window.addEventListener("keydown", (e) => {
      this.keys[e.key.toLowerCase()] = true;

      // Escape or P pauses
      if (e.key === "Escape" || e.key.toLowerCase() === "p") {
        if (this.active && !document.getElementById("gacha-modal").classList.contains("active") && !document.getElementById("gameover-modal").classList.contains("active")) {
          this.togglePause();
        }
      }

      // Reload
      if (e.key.toLowerCase() === "r" && this.active && !this.paused) {
        this.startReload();
      }

      // Cheat Console activation (backtick or C key)
      if ((e.key === "`" || e.key.toLowerCase() === "c") && this.active) {
        if (document.activeElement !== document.getElementById("cheat-text-input")) {
          e.preventDefault();
          this.toggleCheatConsole();
        }
      }

      // Ultimate activation (G key)
      if (e.key.toLowerCase() === "g" && this.active && !this.paused) {
        this.activateUltimate();
      }

      // Hotkey Weapon Switch
      if (["1", "2", "3", "4", "5", "6"].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        const wNames = Object.keys(WEAPONS_DB);
        if (idx < wNames.length) {
          const tar = wNames[idx];
          if (this.unlockedWeapons.includes(tar)) {
            this.switchWeapon(tar);
          }
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // Mouse aiming inside canvas
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });

    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0 && this.active && !this.paused) {
        this.keys["mousedown"] = true;
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        this.keys["mousedown"] = false;
      }
    });

    // Mouse wheel weapon switch
    this.canvas.addEventListener("wheel", (e) => {
      if (!this.active || this.paused) return;
      e.preventDefault();
      const unlocked = this.unlockedWeapons;
      const curIdx = unlocked.indexOf(this.activeWeapon);
      let nextIdx = curIdx + (e.deltaY > 0 ? 1 : -1);
      if (nextIdx >= unlocked.length) nextIdx = 0;
      if (nextIdx < 0) nextIdx = unlocked.length - 1;
      this.switchWeapon(unlocked[nextIdx]);
    }, { passive: false });

    // Menu Buttons Click Events
    document.getElementById("btn-start").addEventListener("click", () => {
      this.startGame();
    });

    document.getElementById("btn-open-shop-menu").addEventListener("click", () => {
      this.openShop();
    });

    document.getElementById("btn-close-shop").addEventListener("click", () => {
      this.closeShop();
    });

    document.getElementById("btn-pause").addEventListener("click", () => {
      this.togglePause();
    });

    document.getElementById("btn-resume").addEventListener("click", () => {
      this.togglePause();
    });

    document.getElementById("btn-open-shop-hud").addEventListener("click", () => {
      this.openShop();
    });

    document.getElementById("btn-restart-pause").addEventListener("click", () => {
      this.togglePause();
      this.resetProgression();
      this.startGame();
    });

    const btnHomePause = document.getElementById("btn-home-pause");
    if (btnHomePause) {
      btnHomePause.addEventListener("click", (e) => {
        e.preventDefault();
        this.resetProgression();
        window.location.href = btnHomePause.getAttribute("href");
      });
    }

    document.getElementById("btn-restart-gameover").addEventListener("click", () => {
      document.getElementById("gameover-modal").classList.remove("active");
      this.resetProgression();
      this.startGame();
    });

    document.getElementById("btn-home-gameover").addEventListener("click", () => {
      this.resetProgression();
    });

    document.getElementById("btn-use-life").addEventListener("click", () => {
      this.useExtraLife();
    });

    // Ultimate Activator click on HUD
    document.getElementById("ultimate-bar-trigger").addEventListener("click", () => {
      if (this.active && !this.paused) {
        this.activateUltimate();
      }
    });

    // Menu Ultimate Choice selectors
    const btnLaser = document.getElementById("btn-select-laser");
    const btnImmortality = document.getElementById("btn-select-immortality");

    if (btnLaser && btnImmortality) {
      btnLaser.addEventListener("click", () => {
        btnLaser.classList.add("active");
        btnImmortality.classList.remove("active");
        this.activeUltimate = "laser";
        Sound.playGachaFlip();
        this.updateHUDValues();
      });

      btnImmortality.addEventListener("click", () => {
        btnImmortality.classList.add("active");
        btnLaser.classList.remove("active");
        this.activeUltimate = "immortality";
        Sound.playGachaFlip();
        this.updateHUDValues();
      });
    }

    // Mobile Ultimate Button click
    document.getElementById("btn-mobile-ultimate").addEventListener("click", () => {
      if (this.active && !this.paused) {
        this.activateUltimate();
      }
    });

    // Shop Manual Reset Progress Button click
    document.getElementById("btn-reset-progression").addEventListener("click", () => {
      if (confirm("Apakah Anda yakin ingin menghapus semua progres round ini?")) {
        this.resetProgression();
        this.updateShopUI();
        this.updateHUDValues();
      }
    });

    // Cheat Console toggle trigger hooks
    document.getElementById("btn-cheat-toggle").addEventListener("click", () => {
      this.toggleCheatConsole();
    });
    document.getElementById("btn-close-cheat").addEventListener("click", () => {
      this.toggleCheatConsole();
    });

    // Quick Buffs
    document.getElementById("cheat-btn-coins").addEventListener("click", () => {
      if (this.active) {
        this.zcoins += 1000;
        this.runZCoins += 1000;
        this.updateHUDValues();
        this.saveGame();
        Sound.playCoin();
        // Floating coin text particle
        this.particles.push({
          x: this.player.x,
          y: this.player.y - 25,
          vx: 0,
          vy: -1.2,
          color: "var(--color-coin)",
          text: "+1000 ZCoin (Cheat)",
          alpha: 1,
          decay: 0.02
        });
      }
    });

    document.getElementById("cheat-btn-ultimate").addEventListener("click", () => {
      if (this.active) {
        this.ultimateCharge = 100;
        this.updateHUDValues();
        Sound.playUpgrade();
      }
    });

    document.getElementById("cheat-btn-limitbreaker").addEventListener("click", () => {
      if (this.active) {
        this.ultimateCharge = 200;
        this.updateHUDValues();
        Sound.playBossWarning();
      }
    });

    document.getElementById("cheat-btn-godmode").addEventListener("click", () => {
      if (this.active) {
        this.godMode = !this.godMode;
        const btn = document.getElementById("cheat-btn-godmode");
        if (this.godMode) {
          btn.classList.add("active");
          btn.innerText = "🛡️ God Mode: On";
        } else {
          btn.classList.remove("active");
          btn.innerText = "🛡️ God Mode: Off";
        }
        Sound.playUpgrade();
      }
    });

    // Spawner
    document.getElementById("cheat-btn-spawn").addEventListener("click", () => {
      if (this.active) {
        const sel = document.getElementById("cheat-spawn-select").value;
        this.spawnZombie(sel);
        Sound.playBossWarning();
      }
    });

    // Arena clear
    document.getElementById("cheat-btn-clear").addEventListener("click", () => {
      if (this.active) {
        // Kill all active enemies
        this.enemies.forEach(z => {
          z.hp = 0;
          this.particles.push({
            x: z.x,
            y: z.y,
            vx: 0, vy: -1.5,
            color: "#ff0055",
            text: "KILLED (Cheat)",
            alpha: 1, decay: 0.03
          });
        });
        Sound.playBossWarning();
      }
    });

    // Code input submission
    document.getElementById("cheat-btn-submit-code").addEventListener("click", () => {
      this.submitCheatCode();
    });

    document.getElementById("cheat-text-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.submitCheatCode();
      }
    });

    // Shop Upgrades Hook
    document.getElementById("btn-upgrade-damage").addEventListener("click", () => this.buyWeaponUpgrade("damage"));
    document.getElementById("btn-upgrade-firerate").addEventListener("click", () => this.buyWeaponUpgrade("fireRate"));
    document.getElementById("btn-upgrade-capacity").addEventListener("click", () => this.buyWeaponUpgrade("capacity"));
    document.getElementById("btn-buy-life").addEventListener("click", () => this.buyExtraLife());

    // Gacha Overlay Claim
    document.getElementById("btn-trigger-gacha").addEventListener("click", () => {
      this.claimGachaSkill();
    });

    // Setup Gacha Card click listeners (visual reveal)
    const cards = document.querySelectorAll(".gacha-card-item");
    cards.forEach(card => {
      card.addEventListener("click", () => {
        if (!card.classList.contains("flipped") && this.gachaRollActive) {
          this.revealGachaCard(card);
        }
      });
    });

    // Touch Controls Initialization (Dual Joysticks)
    this.initTouchControls();
  }

  // ─── Dual Virtual Joysticks for Mobile ───
  initTouchControls() {
    const moveZone = document.getElementById("joystick-move");
    const shootZone = document.getElementById("joystick-shoot");

    const setupJoystick = (zone, joyState, isShoot) => {
      const handle = zone.querySelector(".joystick-handle");
      const base = zone.querySelector(".joystick-base");

      const onStart = (clientX, clientY, touchId) => {
        const rect = base.getBoundingClientRect();
        joyState.active = true;
        joyState.startX = rect.left + rect.width / 2;
        joyState.startY = rect.top + rect.height / 2;
        joyState.touchId = touchId;
      };

      const onMove = (clientX, clientY) => {
        if (!joyState.active) return;
        const dx = clientX - joyState.startX;
        const dy = clientY - joyState.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 45; // radius of motion

        let angle = Math.atan2(dy, dx);
        let moveX = dx;
        let moveY = dy;

        if (dist > maxDist) {
          moveX = Math.cos(angle) * maxDist;
          moveY = Math.sin(angle) * maxDist;
        }

        handle.style.transform = `translate(${moveX}px, ${moveY}px)`;

        joyState.dirX = moveX / maxDist;
        joyState.dirY = moveY / maxDist;

        if (isShoot && this.active && !this.paused) {
          // If aiming joystick is moved, set aim angle and simulate shooting
          this.player.angle = angle;
          this.keys["mousedown"] = true;
        }
      };

      const onEnd = () => {
        joyState.active = false;
        joyState.dirX = 0;
        joyState.dirY = 0;
        handle.style.transform = "translate(0px, 0px)";
        if (isShoot) {
          this.keys["mousedown"] = false;
        }
      };

      zone.addEventListener("touchstart", (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        onStart(touch.clientX, touch.clientY, touch.identifier);
      });

      window.addEventListener("touchmove", (e) => {
        if (!joyState.active) return;
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === joyState.touchId) {
            onMove(e.touches[i].clientX, e.touches[i].clientY);
            break;
          }
        }
      }, { passive: true });

      window.addEventListener("touchend", (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joyState.touchId) {
            onEnd();
            break;
          }
        }
      });
      window.addEventListener("touchcancel", (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joyState.touchId) {
            onEnd();
            break;
          }
        }
      });
    };

    setupJoystick(moveZone, this.joysticks.move, false);
    setupJoystick(shootZone, this.joysticks.shoot, true);
  }

  // ─── Playthrough Management ───
  startGame() {
    // Reset Game Over modal details back to normal (in case of previous victory)
    const modalIcon = document.querySelector("#gameover-modal .modal-icon");
    const modalTitle = document.querySelector("#gameover-modal .modal-title");
    const modalSubtitle = document.querySelector("#gameover-modal .modal-subtitle");
    if (modalIcon) modalIcon.innerText = "💀";
    if (modalTitle) {
      modalTitle.innerText = "DIALAH ZOMBIE!";
      modalTitle.classList.remove("modal-title--victory");
    }
    if (modalSubtitle) modalSubtitle.innerText = "Anda gugur di kompleks sekolah.";

    // Cancel any existing animation loop to prevent speed build-ups
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.active = true;
    this.paused = false;
    this.wave = 1;
    this.score = 0;
    this.runZCoins = 0;

    // Reset Ultimate Systems
    this.ultimateCharge = 0;
    this.ultimateActive = false;
    this.ultimateTimeRemaining = 0;

    // Reset Mutation Skills
    this.activeSkills = { fire: 0, ice: 0, shadow: 0 };
    this.updateSkillsHUD();

    // Spawn player in center
    this.player.x = this.width / 2;
    this.player.y = this.height / 2;
    this.player.hp = 100;
    this.player.maxHp = 100;
    this.player.isReloading = false;

    // Load active weapon details
    this.switchWeapon(this.activeWeapon);

    // Clear lists
    this.bullets = [];
    this.enemies = [];
    this.enemyProjectiles = [];
    this.particles = [];
    this.spawnQueue = [];

    // Layout transition
    document.getElementById("menu-screen").classList.remove("active");
    document.getElementById("game-screen").classList.add("active");
    document.getElementById("gameover-modal").classList.remove("active");
    document.getElementById("pause-overlay").classList.remove("active");

    Sound.init();
    this.startWave();

    // Run ticker loop
    this.tick();
  }

  startWave() {
    // Increase Max HP by 10 each wave and regenerate player health to full
    this.player.maxHp = 100 + (this.wave - 1) * 10;
    this.player.hp = this.player.maxHp;

    // Check wave-based achievements (unlocked at wave transition)
    if (typeof GameHubAchievements !== 'undefined') {
      if (this.wave === 2) {
        GameHubAchievements.unlock('zombie', 'baby');
      } else if (this.wave === 6) {
        GameHubAchievements.unlock('zombie', 'gettingused');
      } else if (this.wave === 16) {
        GameHubAchievements.unlock('zombie', 'gunsroses');
      }
    }

    this.updateHUDValues();

    // Dynamic wave configuration
    let totalZombies = 4 + this.wave * 3;
    let spawnRate = Math.max(800, 3000 - this.wave * 200); // ms per spawn

    // Queue zombies based on wave
    this.spawnQueue = [];
    const types = ["regular"];
    if (this.wave >= 2) types.push("runner");
    if (this.wave >= 4) types.push("thrower");
    if (this.wave >= 6) types.push("tank");

    // Wave 30 is the Final Boss Wave, multiples of 5 are Regular Boss waves
    const isFinalBossWave = (this.wave === 30);
    const isBossWave = (this.wave % 5 === 0) || isFinalBossWave;

    if (isBossWave) {
      if (isFinalBossWave) {
        totalZombies = 11; // 1 Zombie King + 10 minions
        this.spawnQueue.push({ type: "zombie_king", spawnDelay: 1000 });
        for (let i = 0; i < 10; i++) {
          this.spawnQueue.push({
            type: i % 2 === 0 ? "runner" : "tank",
            spawnDelay: 1500 + Math.random() * 500
          });
        }
      } else {
        totalZombies = 5 + this.wave * 2;
        this.spawnQueue.push({ type: "boss", spawnDelay: 1000 });
      }
      Sound.playBossWarning();
    }

    for (let i = 0; i < totalZombies; i++) {
      if (isFinalBossWave) continue; // Minions already queued above
      let type = types[Math.floor(Math.random() * types.length)];
      if (isBossWave && i < 3) type = "runner"; // spawn runner helpers
      this.spawnQueue.push({
        type: type,
        spawnDelay: spawnRate + Math.random() * 500
      });
    }

    this.nextSpawnTime = Date.now() + 1500;

    // Flash Wave Warning Banner
    const banner = document.getElementById("wave-banner");
    const bannerTitle = document.getElementById("wave-banner-title");
    const bannerSubtitle = document.getElementById("wave-banner-subtitle");

    bannerTitle.innerText = isFinalBossWave ? `FINAL BOSS!` : (isBossWave ? `BOSS DETECTED!` : `WAVE ${this.wave}`);
    bannerSubtitle.innerText = isFinalBossWave ? "Kalahkan Zombie King!" : (isBossWave ? "Kalahkan Mutasi Zombie Terkuat!" : "Kalahkan Semua Zombie!");
    banner.classList.add("show");

    // Set color banner
    if (isBossWave) {
      banner.style.borderColor = "var(--color-danger)";
      banner.style.boxShadow = "0 0 40px var(--color-danger-glow)";
      bannerTitle.style.color = "var(--color-danger)";
    } else {
      banner.style.borderColor = "var(--color-primary)";
      banner.style.boxShadow = "0 0 40px var(--color-primary-glow)";
      bannerTitle.style.color = "var(--color-primary)";
    }

    setTimeout(() => {
      banner.classList.remove("show");
    }, 2500);
  }

  // ─── Ultimate Helper Methods ───
  toggleUltimateType() {
    if (this.ultimateActive) return; // Can't toggle while ultimate is running
    this.activeUltimate = this.activeUltimate === "laser" ? "immortality" : "laser";
    Sound.playGachaFlip();
    this.updateHUDValues();
  }

  activateUltimate() {
    if (this.ultimateActive || this.ultimateCharge < 100) return;

    this.ultimateActive = true;

    if (this.ultimateCharge >= 200) {
      this.ultimateCharge = 0;
      this.limitBreakerActive = true;
      this.ultimateTimeRemaining = 5.0; // 5 seconds duration
      this.laserAngle = 0;
      Sound.playBossWarning();
      
      // Unlock Limit Breaker achievement
      if (typeof GameHubAchievements !== 'undefined') {
        GameHubAchievements.unlock('zombie', 'allin');
      }
    } else {
      this.ultimateCharge = 0; // Consume the charge
      this.limitBreakerActive = false;

      if (this.activeUltimate === "laser") {
        this.ultimateTimeRemaining = 6.0; // 6 seconds duration
        this.laserAngle = 0;
        Sound.playBossWarning();
      } else {
        this.ultimateTimeRemaining = 30.0; // 30 seconds duration
        // Instantly restore ammo and cancel any active reloads
        this.player.ammo = this.player.maxAmmo;
        this.player.isReloading = false;
        Sound.playUpgrade();
      }

      // Unlock Ultimate attack achievement
      if (typeof GameHubAchievements !== 'undefined') {
        GameHubAchievements.unlock('zombie', 'nofalter');
      }
    }

    this.updateHUDValues();
  }

  // ─── Weapon & Switch Helpers ───
  switchWeapon(wKey) {
    this.activeWeapon = wKey;
    const db = WEAPONS_DB[wKey];
    const lvl = this.weaponStats[wKey];

    // Calculate upgraded parameters
    this.player.maxAmmo = db.baseMagazine === Infinity ? Infinity : Math.floor(db.baseMagazine * (1 + (lvl.capacityLvl - 1) * 0.25));
    this.player.ammo = this.player.maxAmmo;
    this.player.isReloading = false;

    this.updateHUDValues();
  }

  getWeaponDamage(wKey) {
    const db = WEAPONS_DB[wKey];
    const lvl = this.weaponStats[wKey];
    let dmg = db.baseDamage * (1 + (lvl.damageLvl - 1) * 0.2); // +20% damage per level

    // Immortality: Double Damage Buff
    if (this.ultimateActive && this.activeUltimate === "immortality") {
      dmg *= 2.0;
    }
    return dmg;
  }

  getWeaponFireRate(wKey) {
    const db = WEAPONS_DB[wKey];
    const lvl = this.weaponStats[wKey];
    let rate = db.baseFireRate * Math.pow(0.85, lvl.fireRateLvl - 1); // -15% cooldown between shots per level

    // Immortality: Double Fire Rate Buff (half delay between shots)
    if (this.ultimateActive && this.activeUltimate === "immortality") {
      rate *= 0.5;
    }
    return rate;
  }

  getWeaponReloadTime(wKey) {
    const db = WEAPONS_DB[wKey];
    const lvl = this.weaponStats[wKey];
    return db.baseReloadTime * Math.pow(0.85, lvl.capacityLvl - 1); // reload is slightly faster when ammo size upgrades
  }

  startReload() {
    // Immortality: Infinite Ammo / No Reload Buff
    if (this.ultimateActive && this.activeUltimate === "immortality") return;

    const db = WEAPONS_DB[this.activeWeapon];
    if (this.player.isReloading || this.player.ammo === this.player.maxAmmo || db.baseMagazine === Infinity) return;

    this.player.isReloading = true;
    this.player.reloadProgress = 0;
    this.player.reloadStartTime = Date.now();
    Sound.playReload();
  }

  completeReload() {
    this.player.isReloading = false;
    this.player.ammo = this.player.maxAmmo;
    this.updateHUDValues();
  }

  // ─── Spawner Mechanics ───
  spawnZombie(typeKey) {
    const type = ENEMY_TYPES[typeKey];
    let x, y;

    // Pick random location around screen borders
    const side = Math.floor(Math.random() * 4);
    const offset = 40;
    if (side === 0) { // Top
      x = Math.random() * this.width;
      y = -offset;
    } else if (side === 1) { // Right
      x = this.width + offset;
      y = Math.random() * this.height;
    } else if (side === 2) { // Bottom
      x = Math.random() * this.width;
      y = this.height + offset;
    } else { // Left
      x = -offset;
      y = Math.random() * this.height;
    }

    // Progres multiplier per wave
    const multiplier = 1 + (this.wave - 1) * 0.15; // +15% HP per wave
    const enemy = {
      id: Math.random().toString(),
      type: typeKey,
      name: type.name,
      x: x,
      y: y,
      radius: type.size,
      maxHp: type.baseHp * multiplier,
      hp: type.baseHp * multiplier,
      speed: type.baseSpeed * (1 + (this.wave - 1) * 0.02), // minor speed increments
      damage: type.baseDamage * multiplier,
      color: type.color,
      coinRange: type.coinRange,
      // Status effects
      burnTicks: 0,
      burnDmg: 0,
      lastBurnTime: 0,
      slowDuration: 0,
      slowFactor: 1,
      // Attacks
      shootCooldown: type.shootCooldown || 0,
      lastShootTime: Date.now() + Math.random() * 2000,
      // Boss state
      isBoss: typeKey === "boss" || typeKey === "zombie_king",
      isZombieKing: typeKey === "zombie_king",
      bossChargeTime: 0,
      isCharging: false,
      chargeStartX: 0,
      chargeStartY: 0,
      chargeAngle: 0,
      lastMinionSummon: Date.now(),
      lastAoEAttack: Date.now(),
      // Zombie King Specific Abilities
      bossLaserActive: false,
      bossLaserTimeRemaining: 0,
      bossLaserAngle: 0,
      bossLaserCooldown: Date.now() + 6000, // first laser in 6s
      bossNukeChargeTime: 0,
      bossNukeActive: false,
      bossNukeCooldown: Date.now() + 3000 // first nuke charge in 3s
    };

    this.enemies.push(enemy);
  }

  // ─── Fire Firing System ───
  fireBullet() {
    if (this.player.isReloading && !(this.ultimateActive && this.activeUltimate === "immortality")) return;
    const db = WEAPONS_DB[this.activeWeapon];

    if (this.player.ammo <= 0 && db.baseMagazine !== Infinity && !(this.ultimateActive && this.activeUltimate === "immortality")) {
      this.startReload();
      return;
    }

    const curTime = Date.now();
    const interval = this.getWeaponFireRate(this.activeWeapon);
    if (curTime - this.player.lastShotTime < interval) return;

    this.player.lastShotTime = curTime;

    // Substract magazine (bypassed during Immortality ultimate)
    if (db.baseMagazine !== Infinity && !(this.ultimateActive && this.activeUltimate === "immortality")) {
      this.player.ammo--;
      this.updateHUDValues();
    }

    // Play synthesized sound
    if (this.activeWeapon === "shotgun") {
      Sound.playShotgun();
    } else if (this.activeWeapon === "sniper") {
      Sound.playLaser(0.4);
    } else if (this.activeWeapon === "minigun") {
      Sound.playLaser(1.4);
    } else {
      Sound.playLaser(1);
    }

    // Spawn Bullet objects
    const count = db.pellets || 1;
    const dmg = this.getWeaponDamage(this.activeWeapon);

    for (let i = 0; i < count; i++) {
      // Add spread rotation
      const spread = (Math.random() - 0.5) * db.bulletSpread;
      const finalAngle = this.player.angle + spread;

      const bullet = {
        x: this.player.x + Math.cos(this.player.angle) * 16,
        y: this.player.y + Math.sin(this.player.angle) * 16,
        vx: Math.cos(finalAngle) * db.bulletSpeed,
        vy: Math.sin(finalAngle) * db.bulletSpeed,
        radius: 3,
        damage: dmg,
        weapon: this.activeWeapon,
        pierceCount: this.activeWeapon === "sniper" ? 99 : this.activeSkills.shadow, // piercing is set by shadow skill, sniper is full pierce
        hitTargets: [] // keep track of pierced IDs
      };

      this.bullets.push(bullet);
    }

    // Visual Muzzle flash particle
    const tipX = this.player.x + Math.cos(this.player.angle) * 18;
    const tipY = this.player.y + Math.sin(this.player.angle) * 18;
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: tipX,
        y: tipY,
        vx: (Math.cos(this.player.angle) + (Math.random() - 0.5) * 0.4) * (2 + Math.random() * 4),
        vy: (Math.sin(this.player.angle) + (Math.random() - 0.5) * 0.4) * (2 + Math.random() * 4),
        color: this.activeWeapon === "minigun" ? "#ffd700" : "#00ddff",
        radius: 2 + Math.random() * 2,
        alpha: 1,
        decay: 0.06
      });
    }
  }

  // ─── Main Physics & Update Loop ───
  tick() {
    if (!this.active) return;

    if (!this.paused) {
      this.updatePhysics();
      this.draw();
    }

    this.animationFrameId = requestAnimationFrame(() => this.tick());
  }

  updatePhysics() {
    // Supernova screen flash fade-out
    if (this.supernovaFlashAlpha > 0) {
      this.supernovaFlashAlpha -= 0.02;
    }

    // 0. Update Active Ultimate Timer
    if (this.ultimateActive) {
      this.ultimateTimeRemaining -= 16.67 / 1000;
      if (this.limitBreakerActive) {
        // Linear acceleration starting at 3.0 RPS and increasing by 1.5 RPS/sec (reaching 10.5 RPS)
        const elapsed = 5.0 - this.ultimateTimeRemaining;
        const currentRPS = 3.0 + elapsed * 1.5;
        this.laserAngle = (this.laserAngle + (currentRPS * Math.PI * 2 * 16.67) / 1000) % (Math.PI * 2);
      } else if (this.activeUltimate === "laser") {
        // 2.5 Rounds Per Second
        this.laserAngle = (this.laserAngle + (2.5 * Math.PI * 2 * 16.67) / 1000) % (Math.PI * 2);
      }
      if (this.ultimateTimeRemaining <= 0) {
        if (this.limitBreakerActive) {
          this.triggerSupernova();
        }
        this.ultimateActive = false;
        this.limitBreakerActive = false;
        this.ultimateTimeRemaining = 0;
        Sound.playReload();
      }
      this.updateHUDValues();
    }

    // 1. Move Player
    let dx = 0;
    let dy = 0;

    // PC Controls
    if (this.keys["w"] || this.keys["arrowup"]) dy = -1;
    if (this.keys["s"] || this.keys["arrowdown"]) dy = 1;
    if (this.keys["a"] || this.keys["arrowleft"]) dx = -1;
    if (this.keys["d"] || this.keys["arrowright"]) dx = 1;

    // Mobile controls (override if active)
    if (this.joysticks.move.active) {
      dx = this.joysticks.move.dirX;
      dy = this.joysticks.move.dirY;
    }

    // Normalize diagonal movement speed vector
    let speedMult = 1;
    if (this.activeWeapon === "minigun" && this.keys["mousedown"]) {
      speedMult = 0.5; // Heavy recoil slow penalty
    }

    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      this.player.x += (dx / length) * this.player.speed * speedMult;
      this.player.y += (dy / length) * this.player.speed * speedMult;
    }

    // Aiming calculation (Auto-aim or PC Mouse controls fallback)
    if (!this.joysticks.shoot.active) {
      let nearestEnemy = null;
      let minDist = Infinity;
      this.enemies.forEach(z => {
        const dist = Math.hypot(z.x - this.player.x, z.y - this.player.y);
        if (dist < minDist) {
          minDist = dist;
          nearestEnemy = z;
        }
      });

      if (nearestEnemy) {
        this.player.angle = Math.atan2(nearestEnemy.y - this.player.y, nearestEnemy.x - this.player.x);
      } else {
        this.player.angle = Math.atan2(this.mouse.y - this.player.y, this.mouse.x - this.player.x);
      }
    }

    // Player collision with map borders
    this.player.x = Math.max(this.player.radius, Math.min(this.width - this.player.radius, this.player.x));
    this.player.y = Math.max(this.player.radius, Math.min(this.height - this.player.radius, this.player.y));

    // Player collision with obstacles
    OBSTACLES.forEach(obs => {
      this.resolveBoxCollision(this.player, obs);
    });

    // 2. Gun Firing Hold Check
    if (this.keys["mousedown"]) {
      this.fireBullet();
    }

    // Reload updates
    if (this.player.isReloading) {
      const duration = this.getWeaponReloadTime(this.activeWeapon);
      const elapsed = Date.now() - this.player.reloadStartTime;
      this.player.reloadProgress = Math.min(1, elapsed / duration);
      if (this.player.reloadProgress >= 1) {
        this.completeReload();
      }
    }

    // 3. Spawning
    if (this.spawnQueue.length > 0 && Date.now() > this.nextSpawnTime) {
      const nextSpawn = this.spawnQueue.shift();
      this.spawnZombie(nextSpawn.type);
      this.nextSpawnTime = Date.now() + nextSpawn.spawnDelay;
    }

    // 4. Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;

      // Check boundary bounds
      if (b.x < 0 || b.x > this.width || b.y < 0 || b.y > this.height) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check obstacle collisions (bypassed if Immortality is active)
      let hitObs = false;
      if (!(this.ultimateActive && this.activeUltimate === "immortality")) {
        for (let j = 0; j < OBSTACLES.length; j++) {
          const obs = OBSTACLES[j];
          if (b.x > obs.x && b.x < obs.x + obs.w && b.y > obs.y && b.y < obs.y + obs.h) {
            hitObs = true;
            break;
          }
        }
      }

      if (hitObs) {
        // Spark particles on brick hit
        for (let k = 0; k < 3; k++) {
          this.particles.push({
            x: b.x,
            y: b.y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            color: "#888",
            radius: 1.5,
            alpha: 0.8,
            decay: 0.08
          });
        }
        this.bullets.splice(i, 1);
        continue;
      }
    }

    // 5. Update Projectiles (From Thrower / Boss)
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.x += p.vx;
      p.y += p.vy;

      // Boundary check
      if (p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Collision with player
      const dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
      if (dist < p.radius + this.player.radius) {
        this.damagePlayer(p.damage);
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
    }

    // 6. Update Zombies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const z = this.enemies[i];

      // Update Slow state
      if (z.slowDuration > 0) {
        z.slowDuration -= 16.67; // approx ms per frame
        if (z.slowDuration <= 0) z.slowFactor = 1;
      }

      // Update Burning DOT
      if (z.burnTicks > 0 && Date.now() - z.lastBurnTime >= 500) {
        z.lastBurnTime = Date.now();
        z.burnTicks--;
        z.hp -= z.burnDmg;

        // Visual fire particles
        this.particles.push({
          x: z.x + (Math.random() - 0.5) * z.radius,
          y: z.y + (Math.random() - 0.5) * z.radius,
          vx: (Math.random() - 0.5) * 1,
          vy: -1 - Math.random() * 2,
          color: "#ff5500",
          radius: 2 + Math.random() * 2,
          alpha: 1,
          decay: 0.05
        });

        // Hit effect
        if (z.hp <= 0) {
          this.handleEnemyDeath(z, i);
          continue;
        }
      }

      // Boss Logic triggers
      if (z.isBoss) {
        this.updateBossBehavior(z);
      } else {
        // Regular movements: chase player
        const angle = Math.atan2(this.player.y - z.y, this.player.x - z.x);
        const curSpeed = z.speed * z.slowFactor;
        z.x += Math.cos(angle) * curSpeed;
        z.y += Math.sin(angle) * curSpeed;
      }

      // Collide with other zombies (push separate)
      for (let j = 0; j < this.enemies.length; j++) {
        if (i === j) continue;
        const other = this.enemies[j];
        const dist = Math.hypot(other.x - z.x, other.y - z.y);
        const minDist = z.radius + other.radius;
        if (dist < minDist) {
          const overlap = minDist - dist;
          const forceX = ((z.x - other.x) / dist) * overlap * 0.25;
          const forceY = ((z.y - other.y) / dist) * overlap * 0.25;
          z.x += forceX;
          z.y += forceY;
          other.x -= forceX;
          other.y -= forceY;
        }
      }

      // Boundary check & Collide with obstacles
      z.x = Math.max(z.radius, Math.min(this.width - z.radius, z.x));
      z.y = Math.max(z.radius, Math.min(this.height - z.radius, z.y));
      OBSTACLES.forEach(obs => {
        this.resolveBoxCollision(z, obs);
      });

      // Laser Ultimate collision and damage check
      if (this.ultimateActive && (this.activeUltimate === "laser" || this.limitBreakerActive)) {
        const cosA = Math.cos(this.laserAngle);
        const sinA = Math.sin(this.laserAngle);
        const dx = z.x - this.player.x;
        const dy = z.y - this.player.y;

        const proj = dx * cosA + dy * sinA;
        const cx = this.player.x + proj * cosA;
        const cy = this.player.y + proj * sinA;

        const dist = Math.hypot(z.x - cx, z.y - cy);
        const hitLimit = this.limitBreakerActive ? (z.radius * 30) : (z.radius * 3);

        if (dist < hitLimit) {
          const curTime = Date.now();
          const tickInterval = this.limitBreakerActive ? 200 : 300;
          const dmgAmount = this.limitBreakerActive ? 30 : 10;

          if (!z.lastLaserHitTime || curTime - z.lastLaserHitTime >= tickInterval) {
            z.lastLaserHitTime = curTime;
            z.hp -= dmgAmount;

            // Damage floats visual feedback
            this.particles.push({
              x: z.x,
              y: z.y - 15,
              vx: (Math.random() - 0.5) * 1,
              vy: -1 - Math.random(),
              color: this.limitBreakerActive ? "#ffffff" : "#00ddff",
              text: `-${dmgAmount}`,
              alpha: 1,
              decay: 0.03
            });

            // Spawn laser contact sparks
            for (let k = 0; k < (this.limitBreakerActive ? 8 : 4); k++) {
              this.particles.push({
                x: z.x + (Math.random() - 0.5) * z.radius,
                y: z.y + (Math.random() - 0.5) * z.radius,
                vx: (Math.random() - 0.5) * (this.limitBreakerActive ? 6 : 4),
                vy: (Math.random() - 0.5) * (this.limitBreakerActive ? 6 : 4),
                color: this.limitBreakerActive ? "#ffffff" : "#00ddff",
                radius: 1.5 + Math.random() * 2,
                alpha: 0.9,
                decay: 0.08
              });
            }
          }

          if (z.hp <= 0) {
            this.handleEnemyDeath(z, i);
            continue; // Skip the rest of this zombie's updates
          }
        }
      }

      // Combat Collision (Zombie bites Player)
      const distToPlayer = Math.hypot(this.player.x - z.x, this.player.y - z.y);
      if (distToPlayer < z.radius + this.player.radius) {
        // Slow bite rates
        if (!z.lastBiteTime || Date.now() - z.lastBiteTime >= 1000) {
          z.lastBiteTime = Date.now();
          this.damagePlayer(z.damage);
        }
      }

      // Thrower or Zombie King projectile launch
      if ((z.type === "thrower" || z.isZombieKing) && !z.bossLaserActive && !z.bossNukeActive && Date.now() - z.lastShootTime >= z.shootCooldown) {
        z.lastShootTime = Date.now();
        const angle = Math.atan2(this.player.y - z.y, this.player.x - z.x);
        this.enemyProjectiles.push({
          x: z.x + Math.cos(angle) * z.radius,
          y: z.y + Math.sin(angle) * z.radius,
          vx: Math.cos(angle) * 5,
          vy: Math.sin(angle) * 5,
          radius: 5,
          damage: z.damage * (z.isZombieKing ? 0.75 : 1.0), // Scale projectile damage for Zombie King balance
          color: "#e600ff"
        });
      }

      // Bullet hit collisions
      for (let k = this.bullets.length - 1; k >= 0; k--) {
        const b = this.bullets[k];

        // Check target ID
        if (b.hitTargets.includes(z.id)) continue;

        const distToBullet = Math.hypot(b.x - z.x, b.y - z.y);
        if (distToBullet < z.radius + b.radius) {
          // HIT!
          z.hp -= b.damage;
          b.hitTargets.push(z.id);

          Sound.playHit();

          // Charge ultimate if not currently active
          if (!this.ultimateActive && this.ultimateCharge < 200) {
            const chargeRates = {
              pistol: 2.0,
              shotgun: 1.0,
              smg: 0.5,
              assault: 1.0,
              sniper: 5.0,
              minigun: 0.2
            };
            const chargeAmt = chargeRates[this.activeWeapon] || 1.0;
            const prevCharge = this.ultimateCharge;
            this.ultimateCharge = Math.min(200, this.ultimateCharge + chargeAmt);

            // Play ping sound cue when ultimate fully charges
            if (prevCharge < 100 && this.ultimateCharge >= 100) {
              Sound.playUpgrade();
            }
            if (prevCharge < 200 && this.ultimateCharge >= 200) {
              Sound.playBossWarning();
            }
            this.updateHUDValues();
          }

          // Apply Mutation status triggers
          if (this.activeSkills.fire > 0) {
            z.burnTicks = 6; // 6 ticks of fire
            z.burnDmg = this.activeSkills.fire * 4; // 4 * lvl DOT damage
            z.lastBurnTime = Date.now();
          }

          if (this.activeSkills.ice > 0) {
            z.slowDuration = 2500; // 2.5s slow
            z.slowFactor = Math.max(0.3, 1 - (this.activeSkills.ice * 0.25)); // 25% slow per lvl
          }

          // Blood particles
          const impactAngle = Math.atan2(b.vy, b.vx);
          for (let pIdx = 0; pIdx < 8; pIdx++) {
            this.particles.push({
              x: b.x,
              y: b.y,
              vx: Math.cos(impactAngle + (Math.random() - 0.5) * 1.2) * (1 + Math.random() * 4),
              vy: Math.sin(impactAngle + (Math.random() - 0.5) * 1.2) * (1 + Math.random() * 4),
              color: z.color,
              radius: 1.5 + Math.random() * 2,
              alpha: 1,
              decay: 0.04
            });
          }

          // Damage floats visual feedback
          this.particles.push({
            x: z.x,
            y: z.y - 15,
            vx: (Math.random() - 0.5) * 1,
            vy: -1 - Math.random(),
            color: "#fff",
            text: `-${Math.round(b.damage)}`,
            alpha: 1,
            decay: 0.03
          });

          // Pierce deduction check
          if (b.pierceCount <= 0) {
            this.bullets.splice(k, 1);
          } else {
            b.pierceCount--;
          }

          // Check kill
          if (z.hp <= 0) {
            this.handleEnemyDeath(z, i);
            break; // skip testing this zombie further
          }
        }
      }
    }

    // 7. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx || 0;
      p.y += p.vy || 0;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 8. Auto checks
    this.checkWaveEnd();
  }

  // ─── Boss Combat Scripting ───
  // Helper to find the laser endpoint for the Boss (Zombie King) blocked by obstacles
  getBossLaserEndpoint(bx, by, px, py) {
    let closestT = 1.0; // 1.0 means it reaches the player
    const a1 = { x: bx, y: by };
    const a2 = { x: px, y: py };

    const getIntersectionT = (p1, p2, q1, q2) => {
      let det = (p2.x - p1.x) * (q2.y - q1.y) - (q2.x - q1.x) * (p2.y - p1.y);
      if (det === 0) return null;
      let t = ((q1.x - p1.x) * (q2.y - q1.y) - (q2.x - q1.x) * (q1.y - p1.y)) / det;
      let u = ((q1.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (q1.y - p1.y)) / det;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return t;
      return null;
    };

    for (let obs of OBSTACLES) {
      const topL = { x: obs.x, y: obs.y };
      const topR = { x: obs.x + obs.w, y: obs.y };
      const botL = { x: obs.x, y: obs.y + obs.h };
      const botR = { x: obs.x + obs.w, y: obs.y + obs.h };

      const edges = [
        [topL, topR], [botL, botR], [topL, botL], [topR, botR]
      ];

      for (let edge of edges) {
        let t = getIntersectionT(a1, a2, edge[0], edge[1]);
        if (t !== null && t < closestT) {
          closestT = t;
        }
      }
    }

    return {
      x: bx + (px - bx) * closestT,
      y: by + (py - by) * closestT,
      blocked: closestT < 1.0
    };
  }

  // ─── Boss Combat Scripting ───
  updateBossBehavior(boss) {
    const time = Date.now();
    const dist = Math.hypot(this.player.x - boss.x, this.player.y - boss.y);

    // ─── ZOMBIE KING CUSTOM BEHAVIOR ───
    if (boss.isZombieKing) {
      // 1. Nuke Attack Charging
      if (boss.bossNukeActive) {
        boss.bossNukeChargeProgress = (time - boss.bossNukeChargeTime) / 2000;

        // Detonate after 2 seconds
        if (boss.bossNukeChargeProgress >= 1.0) {
          boss.bossNukeActive = false;
          boss.bossNukeCooldown = time + 8000; // 8s Cooldown

          // Blast particles
          for (let k = 0; k < 40; k++) {
            const a = (k / 40) * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            this.particles.push({
              x: boss.x,
              y: boss.y,
              vx: Math.cos(a) * speed,
              vy: Math.sin(a) * speed,
              color: "#e600ff",
              radius: 3 + Math.random() * 3,
              alpha: 1.0,
              decay: 0.02
            });
          }

          // Trigger damage if player inside 180px radius
          if (dist < 180) {
            this.damagePlayer(35);
          }
          Sound.playBossWarning(); // Explosive alert sound
        }
        return; // Zombie King stands still while charging nuke
      }

      // 2. Laser Beam Processing
      if (boss.bossLaserActive) {
        boss.bossLaserTimeRemaining -= 16.67 / 1000;
        boss.bossLaserAngle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);

        // Check if player is hit (and not blocked by obstacle)
        const laserEnd = this.getBossLaserEndpoint(boss.x, boss.y, this.player.x, this.player.y);
        if (!laserEnd.blocked) {
          // Tick 10 damage to player every 400ms
          if (!this.player.lastBossLaserHitTime || time - this.player.lastBossLaserHitTime >= 400) {
            this.player.lastBossLaserHitTime = time;
            this.damagePlayer(10);
          }
        }

        // Deactivate Laser
        if (boss.bossLaserTimeRemaining <= 0) {
          boss.bossLaserActive = false;
          boss.bossLaserCooldown = time + 12000; // 12s Cooldown
        }
      }

      // 3. Trigger new abilities if cooldowns are ready
      if (!boss.bossLaserActive) {
        if (time > boss.bossNukeCooldown && dist < 220) {
          // Trigger Nuke charge
          boss.bossNukeActive = true;
          boss.bossNukeChargeTime = time;
          boss.bossNukeChargeProgress = 0;
          return;
        }

        if (time > boss.bossLaserCooldown && dist < 500) {
          // Trigger Laser activation
          boss.bossLaserActive = true;
          boss.bossLaserTimeRemaining = 4.0; // 4s laser duration
          boss.bossLaserAngle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
        }
      }

      // 4. Movement: Walk towards player
      const angle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
      const curSpeed = boss.speed * boss.slowFactor;
      boss.x += Math.cos(angle) * curSpeed;
      boss.y += Math.sin(angle) * curSpeed;
      return;
    }

    // ─── REGULAR BOSS BEHAVIOR (WAVES 5, 10, 15, 20, 25) ───
    // Charge Attack routine
    if (boss.isCharging) {
      // Move fast in direct angle
      boss.x += Math.cos(boss.chargeAngle) * boss.speed * 3.8;
      boss.y += Math.sin(boss.chargeAngle) * boss.speed * 3.8;

      // Charge expiry
      if (time - boss.bossChargeTime > 1500) {
        boss.isCharging = false;
        boss.bossChargeTime = time + 2500; // charge cooldown 2.5s
      }
    } else if (dist < 400 && time > boss.bossChargeTime) {
      // Trigger Warning visual line path indicator
      boss.isCharging = true;
      boss.bossChargeTime = time;
      boss.chargeAngle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
    } else {
      // Regular tracking movement
      const angle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
      const curSpeed = boss.speed * boss.slowFactor;
      boss.x += Math.cos(angle) * curSpeed;
      boss.y += Math.sin(angle) * curSpeed;
    }

    // Summon runner helpers
    if (time - boss.lastMinionSummon >= 8000) {
      boss.lastMinionSummon = time;
      const angle = Math.random() * Math.PI * 2;
      this.enemies.push({
        id: Math.random().toString(),
        type: "runner",
        name: "Spawn Minion",
        x: boss.x + Math.cos(angle) * 40,
        y: boss.y + Math.sin(angle) * 40,
        radius: ENEMY_TYPES.runner.size,
        maxHp: ENEMY_TYPES.runner.baseHp,
        hp: ENEMY_TYPES.runner.baseHp,
        speed: ENEMY_TYPES.runner.baseSpeed,
        damage: ENEMY_TYPES.runner.baseDamage,
        color: ENEMY_TYPES.runner.color,
        coinRange: ENEMY_TYPES.runner.coinRange,
        burnTicks: 0, burnDmg: 0, lastBurnTime: 0,
        slowDuration: 0, slowFactor: 1
      });
      // Ring particle visual
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        this.particles.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(a) * 3,
          vy: Math.sin(a) * 3,
          color: "#ffaa00",
          radius: 2,
          alpha: 1,
          decay: 0.05
        });
      }
    }

    // AoE Slime explosion attack
    if (time - boss.lastAoEAttack >= 5000) {
      boss.lastAoEAttack = time;
      // Spawn 8 projectiles ring outward
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        this.enemyProjectiles.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(a) * 4.5,
          vy: Math.sin(a) * 4.5,
          radius: 6,
          damage: boss.damage * 0.6,
          color: "#ffaa00"
        });
      }
    }
  }

  // ─── Obstacle Colliders ───
  resolveBoxCollision(circle, box) {
    // Closest point coordinates on box to circle center
    const closestX = Math.max(box.x, Math.min(circle.x, box.x + box.w));
    const closestY = Math.max(box.y, Math.min(circle.y, box.y + box.h));

    // Distance vector
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    const dist = Math.hypot(dx, dy);

    if (dist < circle.radius) {
      // Collision occurred! Reposition circle
      const overlap = circle.radius - dist;
      if (dist === 0) {
        // circle center is inside box directly, push upwards
        circle.y -= circle.radius;
      } else {
        circle.x += (dx / dist) * overlap;
        circle.y += (dy / dist) * overlap;
      }
    }
  }

  // ─── Score & Coins Collection ───
  handleEnemyDeath(z, idx) {
    this.enemies.splice(idx, 1);

    if (z.isZombieKing) {
      this.handleVictory();
      return;
    }

    // Roll ZCoins
    const reward = Math.floor(Math.random() * (z.coinRange[1] - z.coinRange[0] + 1)) + z.coinRange[0];
    this.zcoins += reward;
    this.runZCoins += reward;
    this.score += reward * 10;

    Sound.playCoin();

    // Floating text coin visual
    this.particles.push({
      x: z.x,
      y: z.y - 25,
      vx: 0,
      vy: -1.2,
      color: "var(--color-coin)",
      text: `+${reward} ZCoin`,
      alpha: 1,
      decay: 0.02
    });

    // Shadow skill trigger (Vampirism on kill)
    if (this.activeSkills.shadow > 0) {
      const chance = 0.05 * this.activeSkills.shadow; // 5% chance per level
      if (Math.random() < chance) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
        // Green healing spark particles
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2;
          this.particles.push({
            x: this.player.x,
            y: this.player.y,
            vx: Math.cos(a) * 1.5,
            vy: Math.sin(a) * 1.5,
            color: "#39ff14",
            radius: 2,
            alpha: 1,
            decay: 0.06
          });
        }
      }
    }

    this.saveGame();
    this.updateHUDValues();
  }

  damagePlayer(amount) {
    if (!this.active || this.paused) return;
    if (this.godMode) return;
    if (this.ultimateActive && this.activeUltimate === "immortality") return;

    this.player.hp = Math.max(0, this.player.hp - amount);
    Sound.playHurt();

    // Blood red splash screen vignette cue
    const gameContainer = document.querySelector(".canvas-wrapper");
    gameContainer.style.borderColor = "var(--color-danger)";
    setTimeout(() => {
      gameContainer.style.borderColor = "rgba(57, 255, 20, 0.3)";
    }, 150);

    // Floating damage on player
    this.particles.push({
      x: this.player.x,
      y: this.player.y - 18,
      vx: (Math.random() - 0.5) * 1,
      vy: -1.5,
      color: "var(--color-danger)",
      text: `-${Math.round(amount)} HP`,
      alpha: 1,
      decay: 0.025
    });

    this.updateHUDValues();

    if (this.player.hp <= 0) {
      this.handleGameOver();
    }
  }

  // ─── Wave Checks ───
  checkWaveEnd() {
    if (!this.active) return;

    // Wave Success (All dead and queue empty)
    if (this.enemies.length === 0 && this.spawnQueue.length === 0) {
      if (this.wave === 30) {
        this.handleVictory();
        return;
      }

      // Check Boss Gacha Trigger
      if (this.wave % 5 === 0) {
        this.triggerGachaRNGScreen();
      } else {
        // Advance to next wave automatically
        this.wave++;
        this.startWave();
      }
    }
  }

  // ─── Gacha Mutation Mechanics ───
  triggerGachaRNGScreen() {
    this.paused = true;
    this.gachaRollActive = true;

    // Reset flips and selections
    const cards = document.querySelectorAll(".gacha-card-item");
    cards.forEach(card => card.classList.remove("flipped"));

    // Render cards details dynamically based on random rolls
    this.rollGachaItems();

    // Show modal overlay
    document.getElementById("gacha-modal").classList.add("active");
  }

  rollGachaItems() {
    this.gachaChoices = [];
    const skillsList = ["fire", "ice", "shadow"];

    // Fill 3 cards options
    for (let cardIdx = 1; cardIdx <= 3; cardIdx++) {
      const skill = skillsList[Math.floor(Math.random() * skillsList.length)];

      // Roll rarity
      const roll = Math.random() * 100;
      let rarity = "COMMON";
      let rarityClass = "text-common";
      let multiplier = 1;

      if (roll >= 90) { // 10% Legendary
        rarity = "LEGENDARY";
        rarityClass = "text-legendary";
        multiplier = 3;
      } else if (roll >= 60) { // 30% Rare
        rarity = "RARE";
        rarityClass = "text-rare";
        multiplier = 2;
      }

      let title = "MUTASI API";
      let desc = `Peluru membakar target (${multiplier * 4} DPS selama 3d)`;
      let icon = "🔥";
      if (skill === "ice") {
        title = "MUTASI ES";
        desc = `Peluru membekukan target (Slow speed -${multiplier * 20}%)`;
        icon = "❄️";
      } else if (skill === "shadow") {
        title = "MUTASI SHADOW";
        desc = `Peluru pierce +${multiplier} target & 5% chance vampirism`;
        icon = "💀";
      }

      const cardBack = document.querySelector(`#gacha-card-${cardIdx} .card-back`);
      cardBack.innerHTML = `
        <span class="card-icon">${icon}</span>
        <h3 class="card-skill-name">${title}</h3>
        <p class="card-skill-desc">${desc}</p>
        <span class="card-rarity ${rarityClass}">${rarity}</span>
      `;

      // Save option
      this.gachaChoices.push({
        skill: skill,
        level: multiplier
      });
    }

    // Disable claim action button until card flips
    document.getElementById("btn-trigger-gacha").style.display = "none";
  }

  revealGachaCard(cardEl) {
    const cardIdx = parseInt(cardEl.id.split("-").pop()) - 1;
    this.selectedGachaSkill = this.gachaChoices[cardIdx];

    // Flip chosen
    cardEl.classList.add("flipped");
    Sound.playGachaFlip();

    // Flip others after brief pause
    const cards = document.querySelectorAll(".gacha-card-item");
    cards.forEach((card, idx) => {
      if (idx !== cardIdx) {
        setTimeout(() => {
          card.classList.add("flipped");
        }, 300);
      }
    });

    this.gachaRollActive = false; // block additional clicks
    const btn = document.getElementById("btn-trigger-gacha");
    btn.style.display = "inline-block";
    btn.innerText = `AMBIL LEVEL ${this.selectedGachaSkill.level} ${this.selectedGachaSkill.skill.toUpperCase()}`;
  }

  claimGachaSkill() {
    const choice = this.selectedGachaSkill;
    if (choice) {
      this.activeSkills[choice.skill] += choice.level;
      this.updateSkillsHUD();

      // Show float text
      this.particles.push({
        x: this.player.x,
        y: this.player.y - 30,
        vx: 0,
        vy: -1.5,
        color: "#b85eff",
        text: `MUTASI +${choice.level} ${choice.skill.toUpperCase()} AKTIF!`,
        alpha: 1,
        decay: 0.015
      });
    }

    document.getElementById("gacha-modal").classList.remove("active");
    this.paused = false;
    this.wave++;
    this.startWave();
  }

  updateSkillsHUD() {
    const skillList = ["fire", "ice", "shadow"];
    skillList.forEach(s => {
      const slot = document.getElementById(`skill-slot-${s}`);
      const lvlLabel = document.getElementById(`skill-level-${s}`);
      const lvl = this.activeSkills[s];

      if (lvl > 0) {
        slot.classList.add("active");
        lvlLabel.innerText = `Lvl ${lvl}`;
      } else {
        slot.classList.remove("active");
        lvlLabel.innerText = `Lvl 0`;
      }
    });
  }

  // ─── Permanent Shop Logic ───
  openShop() {
    this.paused = true;
    this.updateShopUI();
    document.getElementById("shop-modal").classList.add("active");
  }

  closeShop() {
    document.getElementById("shop-modal").classList.remove("active");
    // Resume game state if we opened from pauses
    const isPausedOverlayActive = document.getElementById("pause-overlay").classList.contains("active");
    if (!this.active) {
      // Main menu, leave pause false
      this.paused = false;
    } else if (!isPausedOverlayActive) {
      // Opened between waves/in-game, resume looping
      this.paused = false;
    }
  }

  updateShopUI() {
    // Render balance
    document.getElementById("shop-zcoin-val").innerText = this.zcoins;

    // Render list
    const container = document.getElementById("shop-weapons-list");
    container.innerHTML = "";

    Object.keys(WEAPONS_DB).forEach(key => {
      const db = WEAPONS_DB[key];
      const itemEl = document.createElement("div");
      itemEl.className = `shop-item ${this.shopSelectedWeapon === key ? "selected" : ""}`;

      let statusLabel = "BELI";
      let statusClass = "status-locked";

      if (this.unlockedWeapons.includes(key)) {
        if (this.activeWeapon === key) {
          statusLabel = "AKTIF";
          statusClass = "status-active";
        } else {
          statusLabel = "PASANG";
          statusClass = "status-unlocked";
        }
      } else {
        statusLabel = `🪙 ${db.price}`;
      }

      itemEl.innerHTML = `
        <span class="shop-item-name">${db.name}</span>
        <span class="shop-item-status ${statusClass}">${statusLabel}</span>
      `;

      itemEl.addEventListener("click", () => {
        this.selectShopWeapon(key);
      });

      container.appendChild(itemEl);
    });

    // Render stats & upgrades details
    const selected = WEAPONS_DB[this.shopSelectedWeapon];
    const lvl = this.weaponStats[this.shopSelectedWeapon];

    document.getElementById("shop-selected-name").innerText = selected.name;
    document.getElementById("shop-selected-desc").innerText = selected.desc;

    // Calc comparisons
    const curDmg = this.getWeaponDamage(this.shopSelectedWeapon);
    const curFireRate = (1000 / this.getWeaponFireRate(this.shopSelectedWeapon)).toFixed(1); // rounds per sec
    const curCap = this.shopSelectedWeapon === "pistol" ? "Tak Terbatas" : Math.floor(selected.baseMagazine * (1 + (lvl.capacityLvl - 1) * 0.25));

    document.getElementById("stat-val-damage").innerText = `${curDmg.toFixed(0)} (Lvl ${lvl.damageLvl})`;
    document.getElementById("stat-val-firerate").innerText = `${curFireRate}/detik (Lvl ${lvl.fireRateLvl})`;
    document.getElementById("stat-val-ammo").innerText = `${curCap} (Lvl ${lvl.capacityLvl})`;

    // Calc upgrade prices
    const getCost = (lvlCur) => lvlCur >= 5 ? "MAX" : lvlCur * 25;

    const dmgCost = getCost(lvl.damageLvl);
    const frCost = getCost(lvl.fireRateLvl);
    const capCost = getCost(lvl.capacityLvl);

    document.getElementById("cost-upgrade-damage").innerText = dmgCost;
    document.getElementById("cost-upgrade-firerate").innerText = frCost;
    document.getElementById("cost-upgrade-capacity").innerText = capCost;

    // Disabled status checks
    document.getElementById("btn-upgrade-damage").disabled = (dmgCost === "MAX" || this.zcoins < dmgCost || !this.unlockedWeapons.includes(this.shopSelectedWeapon));
    document.getElementById("btn-upgrade-firerate").disabled = (frCost === "MAX" || this.zcoins < frCost || !this.unlockedWeapons.includes(this.shopSelectedWeapon));
    document.getElementById("btn-upgrade-capacity").disabled = (capCost === "MAX" || this.zcoins < capCost || !this.unlockedWeapons.includes(this.shopSelectedWeapon) || this.shopSelectedWeapon === "pistol");

    // Buy life item checks
    const lifeCost = 50;
    document.getElementById("cost-buy-life").innerText = lifeCost;
    document.getElementById("btn-buy-life").disabled = (this.extraLives >= 3 || this.zcoins < lifeCost);
    document.getElementById("purchased-lives-indicator").innerText = `Nyawa Cadangan: ${this.extraLives}/3`;
  }

  selectShopWeapon(wKey) {
    // If locked, check purchase eligibility
    if (!this.unlockedWeapons.includes(wKey)) {
      const db = WEAPONS_DB[wKey];
      if (this.zcoins >= db.price) {
        this.zcoins -= db.price;
        this.unlockedWeapons.push(wKey);
        Sound.playUpgrade();
      }
    } else {
      // Locked switch toggle
      this.activeWeapon = wKey;
      if (this.active) {
        this.switchWeapon(wKey);
      }
    }
    this.shopSelectedWeapon = wKey;
    this.saveGame();
    this.updateShopUI();
  }

  buyWeaponUpgrade(statType) {
    const lvl = this.weaponStats[this.shopSelectedWeapon];
    const curLvl = statType === "damage" ? lvl.damageLvl : (statType === "fireRate" ? lvl.fireRateLvl : lvl.capacityLvl);
    const cost = curLvl * 25;

    if (this.zcoins >= cost && curLvl < 5) {
      this.zcoins -= cost;
      if (statType === "damage") lvl.damageLvl++;
      else if (statType === "fireRate") lvl.fireRateLvl++;
      else if (statType === "capacity") lvl.capacityLvl++;

      Sound.playUpgrade();
      if (this.active && this.activeWeapon === this.shopSelectedWeapon) {
        this.switchWeapon(this.activeWeapon);
      }
      this.saveGame();
      this.updateShopUI();
    }
  }

  buyExtraLife() {
    const cost = 50;
    if (this.zcoins >= cost && this.extraLives < 3) {
      this.zcoins -= cost;
      this.extraLives++;
      Sound.playUpgrade();
      this.saveGame();
      this.updateShopUI();
    }
  }

  triggerSupernova() {
    // Deal 500 damage to all active enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const z = this.enemies[i];
      z.hp -= 500;

      // Spawn floating damage feedback (-500)
      this.particles.push({
        x: z.x,
        y: z.y - 15,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -2 - Math.random() * 2,
        color: "#ffffff",
        text: "-500",
        alpha: 1,
        decay: 0.02
      });

      // Spawn large blood blast particles
      for (let k = 0; k < 6; k++) {
        this.particles.push({
          x: z.x,
          y: z.y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          color: z.color,
          radius: 2 + Math.random() * 3,
          alpha: 1,
          decay: 0.04
        });
      }

      // Check death immediately
      if (z.hp <= 0) {
        this.handleEnemyDeath(z, i);
      }
    }

    // Spawn supernova blast sparks at player position
    for (let k = 0; k < 80; k++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 12;
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        color: "#ffffff",
        radius: 2.5 + Math.random() * 4,
        alpha: 1.0,
        decay: 0.015
      });
    }

    // Deep explosive warning blast sound and shockwave flash
    this.supernovaFlashAlpha = 1.0;
    Sound.playBossWarning();
  }

  handleVictory() {
    this.paused = true;
    this.active = false;

    // Unlock Zombie Dominator achievement
    if (typeof GameHubAchievements !== 'undefined') {
      GameHubAchievements.unlock('zombie', 'dominator');
    }

    // Update screen to reflect Victory
    const modalIcon = document.querySelector("#gameover-modal .modal-icon");
    const modalTitle = document.querySelector("#gameover-modal .modal-title");
    const modalSubtitle = document.querySelector("#gameover-modal .modal-subtitle");
    const btnLife = document.getElementById("btn-use-life");
    const btnRestart = document.getElementById("btn-restart-gameover");

    if (modalIcon) modalIcon.innerText = "🏆";
    if (modalTitle) {
      modalTitle.innerText = "SELAMAT! ANDA MENANG!";
      modalTitle.classList.add("modal-title--victory");
    }
    if (modalSubtitle) modalSubtitle.innerText = "Anda berhasil mengalahkan Zombie King!";

    if (btnLife) btnLife.style.display = "none";
    if (btnRestart) {
      btnRestart.innerHTML = '<span class="btn-icon">↻</span> Main Lagi';
    }

    document.getElementById("gameover-wave").innerText = `Wave ${this.wave}`;
    document.getElementById("gameover-coins").innerText = this.runZCoins;

    document.getElementById("gameover-modal").classList.add("active");
    Sound.playUpgrade();
  }

  // ─── Game Over & Extra Lives System ───
  handleGameOver() {
    this.paused = true;

    // Unlock Infected achievement
    if (typeof GameHubAchievements !== 'undefined') {
      GameHubAchievements.unlock('zombie', 'infected');
    }

    // Update screen
    document.getElementById("gameover-wave").innerText = `Wave ${this.wave}`;
    document.getElementById("gameover-coins").innerText = this.runZCoins;

    // Check Extra Life mitigation eligibility
    const btnLife = document.getElementById("btn-use-life");
    if (this.extraLives > 0) {
      btnLife.style.display = "block";
      btnLife.innerText = `❤️ Gunakan Nyawa Cadangan (Sisa: ${this.extraLives})`;
    } else {
      btnLife.style.display = "none";
      this.resetProgression();
    }

    document.getElementById("gameover-modal").classList.add("active");
  }

  useExtraLife() {
    if (this.extraLives <= 0) return;

    this.extraLives--;
    this.player.hp = 100;
    this.player.isReloading = false;
    this.player.ammo = this.player.maxAmmo;

    // Clear close-by threats
    this.enemies = [];
    this.bullets = [];
    this.enemyProjectiles = [];

    this.saveGame();
    this.updateHUDValues();

    // Close screen, start wave ticker again
    document.getElementById("gameover-modal").classList.remove("active");
    this.paused = false;
    this.startWave();
  }

  togglePause() {
    if (!this.active || document.getElementById("gacha-modal").classList.contains("active") || document.getElementById("gameover-modal").classList.contains("active")) return;

    this.paused = !this.paused;
    const overlay = document.getElementById("pause-overlay");

    if (this.paused) {
      overlay.classList.add("active");
    } else {
      overlay.classList.remove("active");
      // Close shop if open
      this.closeShop();
    }
  }

  toggleCheatConsole() {
    if (!this.active || document.getElementById("gacha-modal").classList.contains("active") || document.getElementById("gameover-modal").classList.contains("active")) return;

    const consoleEl = document.getElementById("cheat-modal");
    if (!consoleEl) return;
    const isActive = consoleEl.classList.contains("active");

    if (isActive) {
      consoleEl.classList.remove("active");
      // Resume game only if Pause overlay is not active
      if (!document.getElementById("pause-overlay").classList.contains("active")) {
        this.paused = false;
      }
    } else {
      consoleEl.classList.add("active");
      this.paused = true;
      // Close pause or shop overlays to prevent clutter
      document.getElementById("pause-overlay").classList.remove("active");
      document.getElementById("shop-modal").classList.remove("active");

      // Focus the input box automatically for ease of typing
      setTimeout(() => {
        const inputEl = document.getElementById("cheat-text-input");
        if (inputEl) {
          inputEl.value = "";
          inputEl.focus();
        }
        const statusEl = document.getElementById("cheat-status-msg");
        if (statusEl) {
          statusEl.innerText = "";
          statusEl.className = "cheat-status-text";
        }
      }, 100);
    }
  }

  submitCheatCode() {
    const inputEl = document.getElementById("cheat-text-input");
    const statusEl = document.getElementById("cheat-status-msg");
    if (!inputEl || !statusEl) return;

    const code = inputEl.value.trim().toLowerCase();
    if (!code) return;

    let success = false;
    let message = "";

    if (code === "kaching") {
      this.zcoins += 10000;
      this.runZCoins += 10000;
      this.updateHUDValues();
      this.saveGame();
      success = true;
      message = "Cheat Sukses: +10.000 ZCoins!";
      Sound.playCoin();
    } else if (code === "ultimate") {
      this.ultimateCharge = 100;
      this.updateHUDValues();
      success = true;
      message = "Cheat Sukses: Ultimate Terisi Penuh!";
      Sound.playUpgrade();
    } else if (code === "godmode") {
      this.godMode = !this.godMode;
      const btn = document.getElementById("cheat-btn-godmode");
      if (this.godMode) {
        if (btn) {
          btn.classList.add("active");
          btn.innerText = "🛡️ God Mode: On";
        }
        message = "Cheat Sukses: God Mode AKTIF!";
      } else {
        if (btn) {
          btn.classList.remove("active");
          btn.innerText = "🛡️ God Mode: Off";
        }
        message = "Cheat Sukses: God Mode MATI!";
      }
      success = true;
      Sound.playUpgrade();
    } else if (code === "spawnking") {
      this.spawnZombie("zombie_king");
      success = true;
      message = "Cheat Sukses: Zombie King Bangkit!";
      Sound.playBossWarning();
    } else if (code === "limitbreak") {
      this.ultimateCharge = 200;
      this.updateHUDValues();
      success = true;
      message = "Cheat Sukses: Limit Breaker Siap!";
      Sound.playBossWarning();
    } else if (code === "clearall") {
      this.enemies.forEach(z => {
        z.hp = 0;
      });
      success = true;
      message = "Cheat Sukses: Semua Zombie Dimusnahkan!";
      Sound.playBossWarning();
    } else {
      success = false;
      message = "Kode salah / tidak dikenal!";
    }

    statusEl.innerText = message;
    if (success) {
      statusEl.className = "cheat-status-text success";
      inputEl.value = ""; // clear input on success
      this.particles.push({
        x: this.player.x,
        y: this.player.y - 30,
        vx: 0, vy: -1.5,
        color: "#39ff14",
        text: "CHEAT AKTIF!",
        alpha: 1, decay: 0.02
      });
    } else {
      statusEl.className = "cheat-status-text error";
    }
  }

  // ─── HUD Rendering UI updates ───
  updateHUDValues() {
    // Lives display
    document.getElementById("hud-zcoin").innerText = this.zcoins;
    document.getElementById("hud-wave").innerText = `WAVE ${this.wave}`;

    // Check coin achievements
    if (typeof GameHubAchievements !== 'undefined') {
      if (this.zcoins >= 250) {
        GameHubAchievements.unlock('zombie', 'hoarder');
      }
      if (this.zcoins >= 1000) {
        GameHubAchievements.unlock('zombie', 'rich');
      }
    }

    // HP Progress Bar
    const hpPercent = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
    document.getElementById("hp-bar-fill").style.width = `${hpPercent}%`;
    document.getElementById("hp-text").innerText = `${Math.round(this.player.hp)}/${this.player.maxHp}`;

    // Weapon active
    const db = WEAPONS_DB[this.activeWeapon];
    document.getElementById("hud-weapon").innerText = db.name.toUpperCase();

    if (this.player.isReloading) {
      document.getElementById("hud-ammo").innerText = "[RELOADING...]";
      document.getElementById("hud-ammo").style.color = "var(--color-danger)";
    } else {
      document.getElementById("hud-ammo").innerText = `[${this.player.ammo}/${this.player.maxAmmo}]`;
      document.getElementById("hud-ammo").style.color = "var(--color-primary)";
    }

    // Ultimate HUD elements updates
    const ultFill = document.getElementById("ultimate-bar-fill");
    const ultText = document.getElementById("ultimate-text");
    const ultTrigger = document.getElementById("ultimate-bar-trigger");
    const mobileUlt = document.getElementById("btn-mobile-ultimate");
    const switcher = document.getElementById("btn-toggle-ultimate");

    if (ultFill && ultText) {
      if (this.ultimateActive) {
        if (ultTrigger) {
          ultTrigger.classList.remove("ready");
          ultTrigger.classList.remove("limit-breaker-ready");
        }
        if (mobileUlt) {
          mobileUlt.classList.remove("ready");
          mobileUlt.classList.remove("limit-breaker-ready");
        }

        const maxDuration = this.limitBreakerActive ? 5.0 : (this.activeUltimate === "laser" ? 6.0 : 30.0);
        const pct = Math.max(0, (this.ultimateTimeRemaining / maxDuration) * 100);
        ultFill.style.width = `${pct}%`;

        if (this.limitBreakerActive) {
          ultFill.style.background = "#ffffff";
          ultFill.style.boxShadow = "0 0 10px rgba(255, 255, 255, 0.8)";
          ultText.innerText = `LIMIT BREAK: ${Math.max(0, this.ultimateTimeRemaining).toFixed(1)}s`;
        } else if (this.activeUltimate === "laser") {
          ultFill.style.background = "linear-gradient(90deg, #ff0055 0%, #ff5500 100%)";
          ultFill.style.boxShadow = "0 0 10px rgba(255, 0, 85, 0.5)";
          ultText.innerText = `LASER: ${Math.max(0, this.ultimateTimeRemaining).toFixed(1)}s`;
        } else {
          ultFill.style.background = "linear-gradient(90deg, #ffcc00 0%, #ffd700 100%)";
          ultFill.style.boxShadow = "0 0 10px rgba(255, 215, 0, 0.5)";
          ultText.innerText = `SHIELD: ${Math.max(0, this.ultimateTimeRemaining).toFixed(1)}s`;
        }
      } else {
        const pct = Math.min(100, (this.ultimateCharge / 200) * 100);
        ultFill.style.width = `${pct}%`;
        ultFill.style.background = "linear-gradient(90deg, #00d2ff 0%, #0066ff 100%)";
        ultFill.style.boxShadow = "0 0 10px rgba(0, 210, 255, 0.5)";

        if (this.ultimateCharge >= 200) {
          ultText.innerText = "LIMIT BREAK (G)!";
          if (ultTrigger) {
            ultTrigger.classList.add("limit-breaker-ready");
            ultTrigger.classList.remove("ready");
          }
          if (mobileUlt) {
            mobileUlt.classList.add("limit-breaker-ready");
            mobileUlt.classList.remove("ready");
          }
        } else if (this.ultimateCharge >= 100) {
          ultText.innerText = "READY (G)!";
          if (ultTrigger) {
            ultTrigger.classList.add("ready");
            ultTrigger.classList.remove("limit-breaker-ready");
          }
          if (mobileUlt) {
            mobileUlt.classList.add("ready");
            mobileUlt.classList.remove("limit-breaker-ready");
          }
        } else {
          ultText.innerText = `${Math.floor(this.ultimateCharge)}%`;
          if (ultTrigger) {
            ultTrigger.classList.remove("ready");
            ultTrigger.classList.remove("limit-breaker-ready");
          }
          if (mobileUlt) {
            mobileUlt.classList.remove("ready");
            mobileUlt.classList.remove("limit-breaker-ready");
          }
        }
      }
    }

    if (switcher) {
      if (this.activeUltimate === "laser") {
        switcher.className = "btn-ultimate-toggle laser";
        switcher.innerHTML = "<span>⚡</span> Laser";
      } else {
        switcher.className = "btn-ultimate-toggle immortality";
        switcher.innerHTML = "<span>🛡️</span> Shield";
      }
    }
  }

  // ─── Canvas Custom Painting ───
  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Grid Ground Map (School Complex Style)
    this.drawGround();

    // 2. Draw Obstacles (School structures)
    this.drawObstacles();

    // 3. Draw Projectiles
    this.enemyProjectiles.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = p.color;
      this.ctx.fill();
      this.ctx.shadowBlur = 0; // reset
    });

    // 4. Draw Bullets
    this.bullets.forEach(b => {
      this.ctx.beginPath();
      // Capsule look based on vx/vy velocity vector
      const speed = Math.hypot(b.vx, b.vy);
      const trailX = b.x - (b.vx / speed) * 12;
      const trailY = b.y - (b.vy / speed) * 12;

      this.ctx.moveTo(b.x, b.y);
      this.ctx.lineTo(trailX, trailY);

      this.ctx.strokeStyle = this.activeWeapon === "minigun" ? "#ffd700" : "#00ddff";
      this.ctx.lineWidth = b.radius * 2;
      this.ctx.lineCap = "round";

      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = this.ctx.strokeStyle;
      this.ctx.stroke();
      this.ctx.shadowBlur = 0; // reset
    });

    // 5. Draw Enemies
    this.enemies.forEach(z => {
      // Glow shadows
      this.ctx.shadowBlur = z.isBoss ? 20 : 10;
      this.ctx.shadowColor = z.color;

      // Zombie King Nuke warning indicator underneath
      if (z.isZombieKing && z.bossNukeActive) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(z.x, z.y, 180, 0, Math.PI * 2);
        this.ctx.strokeStyle = "rgba(230, 0, 255, 0.4)";
        this.ctx.lineWidth = 2.5;
        this.ctx.setLineDash([6, 12]);
        this.ctx.stroke();

        // Translucent red/purple explosion charge indicator
        this.ctx.fillStyle = `rgba(230, 0, 255, ${z.bossNukeChargeProgress * 0.18})`;
        this.ctx.fill();
        this.ctx.restore();
      }

      // Zombie King Laser drawing underneath
      if (z.isZombieKing && z.bossLaserActive) {
        this.ctx.save();
        const end = this.getBossLaserEndpoint(z.x, z.y, this.player.x, this.player.y);

        // Outer glowing purple beam (75px width)
        this.ctx.beginPath();
        this.ctx.moveTo(z.x, z.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.strokeStyle = "#e600ff";
        this.ctx.lineWidth = 75;
        this.ctx.lineCap = "round";
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = "#e600ff";
        this.ctx.stroke();

        // White inner core (25px width)
        this.ctx.beginPath();
        this.ctx.moveTo(z.x, z.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.strokeStyle = "#fff";
        this.ctx.lineWidth = 25;
        this.ctx.shadowBlur = 0;
        this.ctx.stroke();

        // Impact spark at contact point (larger radius for thick beam)
        this.ctx.beginPath();
        this.ctx.arc(end.x, end.y, 15, 0, Math.PI * 2);
        this.ctx.fillStyle = "#e600ff";
        this.ctx.fill();
        this.ctx.restore();
      }

      // Body circle
      this.ctx.beginPath();
      this.ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = "#0c1017";
      this.ctx.strokeStyle = z.color;
      this.ctx.lineWidth = z.isBoss ? 4 : 2;
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.shadowBlur = 0; // reset

      // Eyes
      const angleToPlayer = Math.atan2(this.player.y - z.y, this.player.x - z.x);
      const eyeOffset = z.radius * 0.45;
      const leftEyeX = z.x + Math.cos(angleToPlayer - 0.5) * eyeOffset;
      const leftEyeY = z.y + Math.sin(angleToPlayer - 0.5) * eyeOffset;
      const rightEyeX = z.x + Math.cos(angleToPlayer + 0.5) * eyeOffset;
      const rightEyeY = z.y + Math.sin(angleToPlayer + 0.5) * eyeOffset;

      this.ctx.beginPath();
      this.ctx.arc(leftEyeX, leftEyeY, z.isBoss ? 3.5 : 2, 0, Math.PI * 2);
      this.ctx.arc(rightEyeX, rightEyeY, z.isBoss ? 3.5 : 2, 0, Math.PI * 2);
      this.ctx.fillStyle = z.slowFactor < 1 ? "#00b7ff" : "#ffd700"; // yellow or cyan freeze
      this.ctx.fill();

      // HP bar for injured
      if (z.hp < z.maxHp) {
        const barW = z.radius * 1.8;
        const barH = 4;
        const barX = z.x - barW / 2;
        const barY = z.y - z.radius - 8;

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        this.ctx.fillRect(barX, barY, barW, barH);

        const fillW = Math.max(0, (z.hp / z.maxHp) * barW);
        this.ctx.fillStyle = z.isBoss ? "var(--color-danger)" : "var(--color-primary)";
        this.ctx.fillRect(barX, barY, fillW, barH);
      }

      // Draw active status rings
      if (z.slowFactor < 1) { // Ice active ring
        this.ctx.beginPath();
        this.ctx.arc(z.x, z.y, z.radius + 4, 0, Math.PI * 2);
        this.ctx.strokeStyle = "rgba(0, 221, 255, 0.4)";
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }

      // Boss charge visual line path indicator
      if (z.isBoss && z.isCharging) {
        this.ctx.beginPath();
        this.ctx.moveTo(z.x, z.y);
        // Draw warning vector line towards player
        this.ctx.lineTo(z.x + Math.cos(z.chargeAngle) * 500, z.y + Math.sin(z.chargeAngle) * 500);
        this.ctx.strokeStyle = "rgba(255, 0, 85, 0.15)";
        this.ctx.lineWidth = 40;
        this.ctx.setLineDash([10, 15]);
        this.ctx.stroke();
        this.ctx.setLineDash([]); // reset
      }
    });

    // 6. Draw Player
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = "#00ddff";

    // Player body circle
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = "#0d131f";
    this.ctx.strokeStyle = "#00ddff";
    this.ctx.lineWidth = 3;
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.shadowBlur = 0; // reset

    // Aiming gun barrel representation
    const barrelLength = 16;
    const barrelX = this.player.x + Math.cos(this.player.angle) * barrelLength;
    const barrelY = this.player.y + Math.sin(this.player.angle) * barrelLength;

    this.ctx.beginPath();
    this.ctx.moveTo(this.player.x, this.player.y);
    this.ctx.lineTo(barrelX, barrelY);
    this.ctx.strokeStyle = "#fff";
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    // Immortality Shield pulsating ring around player
    if (this.ultimateActive && this.activeUltimate === "immortality") {
      this.ctx.save();
      this.ctx.beginPath();
      const pulseRadius = this.player.radius + 8 + Math.sin(Date.now() / 100) * 3;
      this.ctx.arc(this.player.x, this.player.y, pulseRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = "#ffd700"; // Golden
      this.ctx.lineWidth = 3;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = "#ffd700";
      this.ctx.stroke();
      this.ctx.fillStyle = "rgba(255, 215, 0, 0.08)";
      this.ctx.fill();
      this.ctx.restore();
    }

    // Laser Beam rotating double-sided sweep lines
    if (this.ultimateActive && (this.activeUltimate === "laser" || this.limitBreakerActive)) {
      this.ctx.save();

      const cosA = Math.cos(this.laserAngle);
      const sinA = Math.sin(this.laserAngle);
      const length = Math.max(this.width, this.height) * 2;

      const strokeWidth = this.limitBreakerActive ? 180 : 18;
      const coreWidth = this.limitBreakerActive ? 60 : 6;
      const glowColor = this.limitBreakerActive ? "#ffffff" : "#00ddff";

      // Outer glowing laser line
      this.ctx.beginPath();
      this.ctx.moveTo(this.player.x - cosA * length, this.player.y - sinA * length);
      this.ctx.lineTo(this.player.x + cosA * length, this.player.y + sinA * length);
      this.ctx.strokeStyle = glowColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.lineCap = "round";
      this.ctx.shadowBlur = this.limitBreakerActive ? 40 : 20;
      this.ctx.shadowColor = glowColor;
      this.ctx.stroke();

      // Bright white inner core laser line
      this.ctx.beginPath();
      this.ctx.moveTo(this.player.x - cosA * length, this.player.y - sinA * length);
      this.ctx.lineTo(this.player.x + cosA * length, this.player.y + sinA * length);
      this.ctx.strokeStyle = "#fff";
      this.ctx.lineWidth = coreWidth;
      this.ctx.shadowBlur = 0;
      this.ctx.stroke();

      this.ctx.restore();
    }

    // Reload circle animation loader around player
    if (this.player.isReloading) {
      this.ctx.beginPath();
      this.ctx.arc(this.player.x, this.player.y, this.player.radius + 6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * this.player.reloadProgress));
      this.ctx.strokeStyle = "var(--color-danger)";
      this.ctx.lineWidth = 2.5;
      this.ctx.stroke();
    }

    // 7. Draw Particles
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      if (p.text) {
        this.ctx.font = "bold 10px Inter";
        this.ctx.fillStyle = p.color;
        this.ctx.textAlign = "center";
        this.ctx.fillText(p.text, p.x, p.y);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = p.color;
        this.ctx.fill();
      }
      this.ctx.restore();
    });

    // 8. Draw active ultimate screen vignette overlay
    if (this.ultimateActive) {
      this.ctx.save();
      let grad = this.ctx.createRadialGradient(this.width / 2, this.height / 2, this.width / 4, this.width / 2, this.height / 2, this.width / 2);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, this.activeUltimate === "laser" ? "rgba(255, 0, 85, 0.22)" : "rgba(255, 215, 0, 0.22)");
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.restore();
    }

    // 9. Draw Supernova Full-Screen White Flash Shockwave
    if (this.supernovaFlashAlpha > 0) {
      this.ctx.save();
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.supernovaFlashAlpha})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.restore();
    }
  }

  drawGround() {
    // Background tiles
    const size = 40;
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += size) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.height; y += size) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }

    // Classroom doors / lockers lines
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    this.ctx.fillRect(0, 0, this.width, 40);
  }

  drawObstacles() {
    OBSTACLES.forEach(obs => {
      // Draw neon border box
      this.ctx.fillStyle = "#0f1624";
      this.ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

      this.ctx.strokeStyle = "rgba(57, 255, 20, 0.35)";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

      // Labeling interior details text
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      this.ctx.font = "8px Inter";
      this.ctx.textAlign = "center";
      this.ctx.fillText(obs.label, obs.x + obs.w / 2, obs.y + obs.h / 2 + 3);
    });
  }
}

// ─── Instantiation on load ───
let GameInstance = null;
document.addEventListener("DOMContentLoaded", () => {
  GameInstance = new ZombieAttackGame();
});
