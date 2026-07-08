// GameHub - Main Logic

document.addEventListener('DOMContentLoaded', () => {
  renderGames();
  setupUpdateLogModal();
  setupAchievementsModal();
  checkAchievementsActivation();
});

// Refresh achievements system button state when returning to this page
window.addEventListener('focus', () => {
  checkAchievementsActivation();
});

/**
 * Renders the game cards dynamically from the gamesConfig array.
 */
function renderGames() {
  const gridContainer = document.getElementById('games-grid');
  
  if (!gridContainer) {
    console.error('Error: Games grid container not found!');
    return;
  }
  
  // Clear any existing content (e.g. loading states)
  gridContainer.innerHTML = '';
  
  // Check if gamesConfig exists and is not empty
  if (typeof gamesConfig === 'undefined' || !Array.isArray(gamesConfig) || gamesConfig.length === 0) {
    gridContainer.innerHTML = `
      <div class="no-games">
        <p>Belum ada game yang tersedia saat ini.</p>
      </div>
    `;
    return;
  }
  
  // Add single-game class if there is only 1 game to keep it beautifully centered
  if (gamesConfig.length === 1) {
    gridContainer.classList.add('single-game');
  } else {
    gridContainer.classList.remove('single-game');
  }
  
  // Render each game card
  gamesConfig.forEach(game => {
    const card = document.createElement('article');
    card.className = 'game-card';
    
    // Create card inner structure
    card.innerHTML = `
      <div class="game-thumbnail-wrapper">
        <img 
          src="${game.thumbnail}" 
          alt="${game.title} Preview" 
          class="game-thumbnail"
          loading="lazy"
          onerror="this.src='https://placehold.co/600x337/12131a/f3f4f6?text=${encodeURIComponent(game.title)}'"
        >
        ${game.category ? `<span class="game-badge category-badge">${game.category}</span>` : ''}
      </div>
      
      <div class="game-info">
        <h2 class="game-title">
          ${game.title}
        </h2>
        <p class="game-description">${game.description}</p>
        
        <a 
          href="${game.path}" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="btn-play"
          id="play-${game.id}"
        >
          <span class="btn-play-text">Main Sekarang</span>
          <span class="btn-play-icon">▶</span>
        </a>
      </div>
    `;
    
    // Add click handler to the card so clicking the card itself (not just the button) triggers the game launch
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      // If the user clicked the button or a link, let the native anchor behavior handle it
      if (e.target.closest('.btn-play')) {
        return;
      }
      
      // Otherwise, simulate a click on the anchor to respect popup blocker and noreferrer settings
      const playButton = card.querySelector('.btn-play');
      if (playButton) {
        playButton.click();
      }
    });
    
    gridContainer.appendChild(card);
  });
}

/**
 * Sets up event listeners for opening and closing the Update Log modal.
 */
function setupUpdateLogModal() {
  const modal = document.getElementById('update-log-modal');
  const openModalBtn = document.getElementById('btn-update-log');
  
  if (!modal || !openModalBtn) {
    console.warn('Update log modal or button not found in the DOM.');
    return;
  }
  
  const closeModalBtns = [
    document.getElementById('modal-close-btn'),
    document.getElementById('modal-close-footer'),
    modal.querySelector('.modal-overlay')
  ];

  // Open modal
  openModalBtn.addEventListener('click', () => {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Disable scroll under overlay
    modal.setAttribute('aria-hidden', 'false');
  });

  // Close modal with close buttons
  closeModalBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scroll
        modal.setAttribute('aria-hidden', 'true');
      });
    }
  });

  // Close modal on Escape key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      modal.setAttribute('aria-hidden', 'true');
    }
  });
}

/**
 * Checks if the achievements system has been activated and shows the menu button.
 */
function checkAchievementsActivation() {
  const btn = document.getElementById('btn-achievements');
  if (!btn) return;
  
  const isActivated = localStorage.getItem('achievements_activated') === 'true';
  if (isActivated) {
    btn.style.display = 'flex';
  } else {
    btn.style.display = 'none';
  }
}

/**
 * Sets up event listeners for opening and closing the Achievements modal.
 */
function setupAchievementsModal() {
  const modal = document.getElementById('achievements-modal');
  const openModalBtn = document.getElementById('btn-achievements');
  
  if (!modal || !openModalBtn) return;
  
  const closeModalBtns = [
    document.getElementById('achievements-close-btn'),
    document.getElementById('achievements-close-footer'),
    modal.querySelector('.modal-overlay')
  ];

  // Open modal
  openModalBtn.addEventListener('click', () => {
    renderAchievements(); // Refresh list on open
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    modal.setAttribute('aria-hidden', 'false');
  });

  // Close modal with close buttons
  closeModalBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        modal.setAttribute('aria-hidden', 'true');
      });
    }
  });

  // Close modal on Escape key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      modal.setAttribute('aria-hidden', 'true');
    }
  });
}

/**
 * Renders the achievements categorized by game in a premium grid layout.
 */
function renderAchievements() {
  const container = document.getElementById('achievements-content');
  if (!container || typeof GameHubAchievements === 'undefined') return;
  
  container.innerHTML = '';
  
  const games = [
    { id: 'snake', title: '🐍 Snake Game' },
    { id: 'fishing', title: '🎣 Fishing Frenzy' },
    { id: 'zombie', title: '🧟 Zombie Attack' }
  ];
  
  games.forEach(game => {
    const list = GameHubAchievements.data[game.id];
    if (!list) return;
    
    const categorySec = document.createElement('div');
    categorySec.className = 'achievement-category';
    
    // Count unlocked achievements
    const unlockedCount = list.filter(ach => GameHubAchievements.isUnlocked(game.id, ach.id)).length;
    
    categorySec.innerHTML = `
      <h3 class="achievement-category-title">
        ${game.title}
        <span>${unlockedCount}/${list.length} Terbuka</span>
      </h3>
      <div class="achievements-grid"></div>
    `;
    
    const grid = categorySec.querySelector('.achievements-grid');
    
    list.forEach(ach => {
      const isUnlocked = GameHubAchievements.isUnlocked(game.id, ach.id);
      const card = document.createElement('div');
      card.className = `achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`;
      
      card.innerHTML = `
        <div class="achievement-card-icon">${isUnlocked ? ach.icon : '🔒'}</div>
        <div class="achievement-card-info">
          <div class="achievement-card-title">${ach.title}</div>
          <div class="achievement-card-desc">${isUnlocked ? ach.desc : 'Pencapaian rahasia. Mainkan game untuk membuka.'}</div>
          <div class="achievement-card-status">${isUnlocked ? 'Terbuka' : 'Terkunci'}</div>
        </div>
      `;
      
      grid.appendChild(card);
    });
    
    container.appendChild(categorySec);
  });
}
