// GameHub - Centralized Achievement System
// Loaded globally on main page and in each game's page.

(function() {
  const ACHIEVEMENTS_DATA = {
    snake: [
      { id: "hungry", title: "Hungry", desc: "Makan 10 buah dalam satu permainan.", icon: "🍎" },
      { id: "survivor", title: "Survivor", desc: "Bertahan hidup selama 2 menit dalam satu permainan.", icon: "⏱️" },
      { id: "hang", title: "Getting the hang of it", desc: "Makan 50 buah dalam satu permainan.", icon: "🐍" },
      { id: "flawless", title: "Flawless run", desc: "Memenangkan game (mengisi seluruh area grid).", icon: "👑" },
      { id: "conqueror", title: "Snake Conqueror", desc: "Makan 250 buah dalam satu permainan.", icon: "🏆" },
      { id: "god", title: "Snake God", desc: "Makan 1000 buah dalam satu permainan.", icon: "⚡" }
    ],
    fishing: [
      { id: "stepping", title: "Stepping Stone", desc: "Menangkap 5 ikan pertama Anda.", icon: "🐟" },
      { id: "kaboom", title: "Kaboom!", desc: "Menangkap sebuah bom bawah laut.", icon: "💣" },
      { id: "whatsthat", title: "What's that?", desc: "Menghadapi cuaca ekstrem/peristiwa laut.", icon: "❓" },
      { id: "seenall", title: "Seen it all", desc: "Menghadapi 5 peristiwa laut dalam satu permainan.", icon: "👁️" },
      { id: "novice", title: "Novice", desc: "Meraih 250 poin dalam satu permainan.", icon: "🥉" },
      { id: "master", title: "Master Reeler", desc: "Meraih 1000 poin dalam satu permainan.", icon: "🥈" },
      { id: "surreal", title: "Surreal Angler", desc: "Meraih 10000 poin dalam satu permainan.", icon: "🥇" },
      { id: "dinner", title: "Dinner is served", desc: "Kalahkan boss Kraken.", icon: "🦑" },
      { id: "god", title: "The god himself", desc: "Kalahkan boss Poseidon.", icon: "🔱" }
    ],
    zombie: [
      { id: "baby", title: "Baby steps", desc: "Selesaikan Wave 1.", icon: "👣" },
      { id: "gettingused", title: "Getting used to it", desc: "Selesaikan Wave 5.", icon: "🔫" },
      { id: "gunsroses", title: "Guns and roses", desc: "Selesaikan Wave 15.", icon: "🌹" },
      { id: "dominator", title: "Zombie dominator", desc: "Kalahkan Zombie King di Wave 30 dan selesaikan game.", icon: "💀" },
      { id: "infected", title: "Infected", desc: "Gugur sebanyak 1 kali.", icon: "☣️" },
      { id: "nofalter", title: "I will not falter!", desc: "Gunakan serangan Ultimate untuk pertama kali.", icon: "💥" },
      { id: "allin", title: "All in...", desc: "Maksimalkan bar ultimate (200%) dan aktifkan Limit Breaker.", icon: "🔥" },
      { id: "hoarder", title: "Hoarder", desc: "Kumpulkan total 250 ZCoin.", icon: "🪙" },
      { id: "rich", title: "Rich!", desc: "Kumpulkan total 1000 ZCoin.", icon: "💎" }
    ]
  };

  // Inject toast styling dynamically
  function injectStyles() {
    if (document.getElementById('achievement-toast-styles')) return;

    const style = document.createElement('style');
    style.id = 'achievement-toast-styles';
    style.textContent = `
      .achievement-toast {
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: rgba(18, 19, 26, 0.95);
        border: 1px solid rgba(0, 242, 254, 0.4);
        border-left: 5px solid #00f2fe;
        padding: 16px 20px;
        border-radius: 16px;
        box-shadow: 0 15px 35px rgba(0, 200, 255, 0.15), 0 5px 15px rgba(0,0,0,0.4);
        color: #f3f4f6;
        font-family: 'Outfit', -apple-system, sans-serif;
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 16px;
        transform: translateY(100px) scale(0.9);
        opacity: 0;
        transition: transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.35s ease;
        pointer-events: none;
        max-width: 380px;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      .achievement-toast.show {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      .achievement-toast-icon {
        font-size: 2.2rem;
        background: rgba(0, 242, 254, 0.08);
        padding: 8px;
        border-radius: 50%;
        box-shadow: 0 0 15px rgba(0, 242, 254, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 50px;
        height: 50px;
        flex-shrink: 0;
      }
      .achievement-toast-content {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .achievement-toast-label {
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        color: #00f2fe;
        letter-spacing: 1.5px;
        text-shadow: 0 0 5px rgba(0, 242, 254, 0.3);
      }
      .achievement-toast-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: #ffffff;
      }
      .achievement-toast-desc {
        font-size: 0.8rem;
        color: #9ca3af;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);
  }

  // Synthesize chimes when an achievement is unlocked
  function playSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const audioCtx = new AudioContext();
      const startTime = audioCtx.currentTime;

      // Note 1: C5 (523.25 Hz) -> G5 (783.99 Hz)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, startTime);
      osc1.frequency.exponentialRampToValueAtTime(783.99, startTime + 0.18);
      gain1.gain.setValueAtTime(0.15, startTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, startTime + 0.55);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);

      // Note 2: E5 (659.25 Hz) -> C6 (1046.50 Hz) starting slightly later
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, startTime + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(1046.50, startTime + 0.26);
      gain2.gain.setValueAtTime(0.12, startTime + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.65);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);

      osc1.start(startTime);
      osc1.stop(startTime + 0.55);
      osc2.start(startTime + 0.08);
      osc2.stop(startTime + 0.65);
    } catch (e) {
      console.warn("Sound synthesis blocked or failed:", e);
    }
  }

  // Show Toast Dialog
  function showToast(achievement, isFirstActivation) {
    injectStyles();

    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    
    const labelText = isFirstActivation 
      ? '🏆 SYSTEM ACHIEVEMENT AKTIF!' 
      : '🏆 PENCAPAIAN DIBUKA';

    toast.innerHTML = `
      <div class="achievement-toast-icon">${achievement.icon}</div>
      <div class="achievement-toast-content">
        <div class="achievement-toast-label">${labelText}</div>
        <div class="achievement-toast-title">${achievement.title}</div>
        <div class="achievement-toast-desc">${achievement.desc}</div>
      </div>
    `;

    document.body.appendChild(toast);
    playSound();

    // Trigger Slide-in
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    // Slide-out and delete
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 500);
    }, 4500);
  }

  // Expose API
  window.GameHubAchievements = {
    data: ACHIEVEMENTS_DATA,

    getUnlocked() {
      try {
        return JSON.parse(localStorage.getItem('gh_achievements') || '{}');
      } catch (e) {
        return {};
      }
    },

    isUnlocked(gameId, achievementId) {
      const unlocked = this.getUnlocked();
      return !!(unlocked[gameId] && unlocked[gameId].includes(achievementId));
    },

    unlock(gameId, achievementId) {
      // Find the achievement definition
      const list = ACHIEVEMENTS_DATA[gameId];
      if (!list) return;

      const achievement = list.find(a => a.id === achievementId);
      if (!achievement) return;

      // Check if already unlocked
      const unlocked = this.getUnlocked();
      if (!unlocked[gameId]) unlocked[gameId] = [];

      if (unlocked[gameId].includes(achievementId)) {
        return; // Already unlocked
      }

      // Add to unlocked list and persist
      unlocked[gameId].push(achievementId);
      localStorage.setItem('gh_achievements', JSON.stringify(unlocked));

      // Check if this triggers the initial activation
      const wasActivated = localStorage.getItem('achievements_activated') === 'true';
      if (!wasActivated) {
        localStorage.setItem('achievements_activated', 'true');
      }

      // Display Toast
      showToast(achievement, !wasActivated);

      // Notify parent/main window if in iframe (for real-time update in dashboard if open)
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'achievement_unlocked', gameId, achievementId }, '*');
        }
      } catch (err) {}
    },

    reset() {
      localStorage.removeItem('gh_achievements');
      localStorage.removeItem('achievements_activated');
      console.log("Achievements state successfully reset!");
    }
  };
})();
