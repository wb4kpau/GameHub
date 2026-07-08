// GameHub Catalog Configuration
// To add a new game:
// 1. Create a folder under /games/[NewGame] with its index.html.
// 2. Add an entry object in the array below with required properties.

const gamesConfig = [
  {
    id: "snake",
    title: "Snake Game",
    description: "Kendalikan ular neon klasik, makan buah bersinar, raih skor tertinggi, dan hindari menabrak tubuh sendiri atau dinding!",
    thumbnail: "assets/images/thumbnails/snake.png",
    path: "games/Snake/index.html",
    category: "Retro Arcade",
    author: "Developer Komunitas"
  },
  {
    id: "fishing-frenzy",
    title: "Fishing Frenzy",
    description: "Turunkan kail pancing Anda ke laut dalam, tangkap berbagai ikan neon eksotis, hindari bom bawah laut, dan raih skor tertinggi dengan 3 nyawa!",
    thumbnail: "assets/images/thumbnails/fishing.png",
    path: "games/FishingFrenzy/index.html",
    category: "Arcade Action",
    author: "Developer Komunitas"
  },
  {
    id: "zombie-attack",
    title: "Zombie Attack",
    description: "Bertahan hidup di kompleks sekolah dari kepungan zombie! Kalahkan boss setiap 5 wave, lakukan gacha skill elemen acak, dan upgrade senjata Anda dengan ZCoin!",
    thumbnail: "assets/images/thumbnails/zombie.png",
    path: "games/ZombieAttack/index.html",
    category: "Survival Shooter",
    author: "Developer Komunitas"
  }
];
