

require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN || process.env.TOKEN || '',
  CLIENT_ID: process.env.CLIENT_ID || '',
  OWNER_ID: process.env.OWNER_ID || '',
  TOKEN: process.env.TOKEN || process.env.BOT_TOKEN || '',
  language: "en",
  ownerID: [process.env.OWNER_ID || '', ""],
  mongodbUri : process.env.MONGODB_URI || "",
  spotifyClientId : process.env.SPOTIFY_CLIENT_ID || "",
  spotifyClientSecret : process.env.SPOTIFY_CLIENT_SECRET || "",
  setupFilePath: './commands/setup.json',
  commandsDir: './commands',  
  embedColor: "#e11d2e",
  enableVoiceChannelIdPatch: true,
  customEmoji: true,  // true = use custom emoji IDs from emoji.js, false = use default unicode
  emojiTheme: "redwhite", // active custom emoji theme key in emoji.js
  helpBannerUrl: "https://ibb.co/twtJHJ5f", // Optional: set a direct image URL to show an inline banner in /help
  activityName: "INFINITY MUSIC V2", 
  activityType: "LISTENING",  // Available activity types : LISTENING , PLAYING
  SupportServer: "https://dsc.gg/imposter-network",
  embedTimeout: 5,
  showProgressBar: false,  // Show progress bar in track embed
  showVisualizer: false,  // Show visualizer on music card (disabled for low-memory optimization)
  generateSongCard: true,  // custom song card image, if false uses thumbnail
  metadataTag: true,  // If true, always show Song Details even when the card image is present
  lowMemoryMode: true,   // Performance optimizations for low-memory environments (512MB RAM)
  errorLog: "", 
  nodes: [
    {
      name: "Strixnodes",
      password: "glace",
      host: "de-01.strixnodes.com",
      port: 2010,
      secure: false
    },
    {
      name: "Nazha",
      password: "nazhafreelava",
      host: "lavalink.nazha.online",
      port: 443,
      secure: true
    },
    {
      name: "MilloHost",
      password: "https://discord.gg/mjS5J2K3ep",
      host: "lava-v4.millohost.my.id",
      port: 443,
      secure: true
    }
  ]
}
