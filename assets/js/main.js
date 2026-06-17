// GameHub - Main Logic

document.addEventListener('DOMContentLoaded', () => {
  renderGames();
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
