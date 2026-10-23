// Standalone script to upload remaining emojis
// Run with: node upload-emojis.js
const axios = require('axios');
const config = require('./config.js');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = config.TOKEN || config.BOT_TOKEN || process.env.BOT_TOKEN;
const GUILD_ID = '1456626927317291050'; // Your server ID from the logs

// Emojis that still need to be uploaded (the 19 that failed)
const REMAINING_EMOJIS = [
    { key: 'play',     name: 'x_play',    originalId: '1492414921789411338' },
    { key: 'pause',    name: 'x_pause',   originalId: '1492414913702789312' },
    { key: 'stop',     name: 'x_delete',  originalId: '1492414971013890068' },
    { key: 'next',     name: 'x_right',   originalId: '1492414926679965747' },
    { key: 'back',     name: 'x_left',    originalId: '1492414218975182908' },
    { key: 'success',  name: 'x_tick',    originalId: '1492414936671060000' },
    { key: 'error',    name: 'x_cross',   originalId: '1492414962595926026' },
    { key: 'warning',  name: 'x_annc',    originalId: '1492414950939951136' },
    { key: 'queue',    name: 'x_homes',   originalId: '1492415031802073238' },
    { key: 'search',   name: 'x_replit',  originalId: '1492414924146868264' },
    { key: 'volume',   name: 'x_speak',   originalId: '1492414932157730846' },
    { key: 'voice',    name: 'x_mic',     originalId: '1492414232954798120' },
    { key: 'ticket',   name: 'x_mail',    originalId: '1492414224301953054' },
    { key: 'mod',      name: 'x_mod',     originalId: '1492414235538624744' },
    { key: 'security', name: 'x_automod', originalId: '1492414953716711554' },
    { key: 'welcome',  name: 'x_heart',   originalId: '1492415025564880917' },
    { key: 'owner',    name: 'x_owner',   originalId: '1492414907281576026' },
    { key: 'folder',   name: 'x_folder1', originalId: '1492414988797739140' },
    { key: 'cloud',    name: 'scloud',    originalId: '1492415334668435556' },
];

// Already uploaded emojis (from previous successful run)
const EXISTING = {
    home:     { name: "x_home",    id: "1534583615072239826" },
    help:     { name: "x_info",    id: "1534583629504577746" },
    music:    { name: "x_music",   id: "1534583644423979218" },
    playlist: { name: "x_folder2", id: "1534583658583953642" },
    basic:    { name: "x_setting", id: "1534583674656391320" },
    utility:  { name: "x_tools",   id: "1534583689273409536" },
    commands: { name: "x_js",      id: "1534583705455165601" },
    servers:  { name: "x_world",   id: "1534583720424767640" },
    users:    { name: "x_members", id: "1534583735964532776" },
    uptime:   { name: "x_time",    id: "1534583750284021830" },
    ping:     { name: "x_ping",    id: "1534583764779532479" },
    info:     { name: "x_info",    id: "1534583629504577746" },
    support:  { name: "x_partner", id: "1534583778989576394" },
    github:   { name: "x_github",  id: "1534583794030477363" },
    settings: { name: "x_setting", id: "1534583674656391320" },
    tools:    { name: "x_tools",   id: "1534583689273409536" },
    link:     { name: "x_github",  id: "1534583794030477363" },
    shuffle:  { name: "x_world",   id: "1534583720424767640" },
};

async function downloadEmoji(emojiId) {
    // Try PNG first, then GIF
    for (const ext of ['png', 'gif']) {
        const url = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=96&quality=lossless`;
        try {
            console.log(`   📥 Downloading .${ext}...`);
            const response = await axios.get(url, { 
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            if (response.data && response.data.length > 100) {
                const base64 = Buffer.from(response.data).toString('base64');
                const mimeType = ext === 'gif' ? 'image/gif' : 'image/png';
                return { data: `data:${mimeType};base64,${base64}`, animated: ext === 'gif' };
            }
        } catch (err) {
            console.log(`   ⚠️ .${ext} failed: ${err.message}`);
        }
    }
    return null;
}

async function uploadEmoji(name, imageData) {
    try {
        const response = await axios.post(
            `https://discord.com/api/v10/guilds/${GUILD_ID}/emojis`,
            { name: name, image: imageData },
            {
                headers: {
                    'Authorization': `Bot ${BOT_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );
        return response.data;
    } catch (err) {
        if (err.response?.status === 429) {
            const retryAfter = err.response.data?.retry_after || 10;
            console.log(`   ⏳ Rate limited! Waiting ${retryAfter}s...`);
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            // Retry once
            const response = await axios.post(
                `https://discord.com/api/v10/guilds/${GUILD_ID}/emojis`,
                { name: name, image: imageData },
                {
                    headers: {
                        'Authorization': `Bot ${BOT_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                }
            );
            return response.data;
        }
        throw err;
    }
}

async function checkExistingEmojis() {
    try {
        const response = await axios.get(
            `https://discord.com/api/v10/guilds/${GUILD_ID}/emojis`,
            {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` },
                timeout: 10000
            }
        );
        const existing = new Map();
        for (const emoji of response.data) {
            existing.set(emoji.name, emoji);
        }
        return existing;
    } catch (err) {
        console.error('Failed to fetch existing emojis:', err.message);
        return new Map();
    }
}

function updateEmojiDataFile(allEmojis) {
    const emojiDataPath = path.join(__dirname, 'UI/emojis/emojiData.js');
    
    const keys = Object.keys(allEmojis);
    let customsCode = 'const REDWHITE_CUSTOMS = Object.freeze({\n';
    const entries = [];
    for (const key of keys) {
        const e = allEmojis[key];
        if (e) {
            const animStr = e.animated ? ', animated: true' : '';
            entries.push(`    ${key}: { name: "${e.name}", id: "${e.id}"${animStr} }`);
        }
    }
    customsCode += entries.join(',\n') + '\n});\n';

    const defaultEmojis = {
        home: '🏠', help: '❓', music: '🎵', playlist: '📚', basic: '⚙️',
        utility: '🧰', commands: '🧩', servers: '🌐', users: '👥', uptime: '⏱️',
        ping: '📶', info: 'ℹ️', support: '🛟', github: '💻', play: '▶️',
        pause: '⏸️', stop: '⏹️', next: '⏭️', back: '⏮️', settings: '⚙️',
        tools: '🛠️', success: '✅', error: '❌', warning: '⚠️', queue: '📋',
        search: '🔎', volume: '🔊', voice: '🔈', ticket: '🎫', link: '🔗',
        mod: '🛡️', security: '🔒', welcome: '👋', owner: '👑', shuffle: '🔀',
        folder: '📁', cloud: '☁️'
    };

    let emojisCode = '\nconst EMOJIS = Object.freeze({\n';
    const emojiEntries = [];
    for (const key of keys) {
        const def = defaultEmojis[key] || '❓';
        if (allEmojis[key]) {
            emojiEntries.push(`    ${key}: { default: "${def}", custom: { redwhite: REDWHITE_CUSTOMS.${key} } }`);
        } else {
            emojiEntries.push(`    ${key}: { default: "${def}" }`);
        }
    }
    emojisCode += emojiEntries.join(',\n') + '\n});\n';

    const fullFile = customsCode + emojisCode + `\nmodule.exports = {\n    EMOJIS,\n    REDWHITE_CUSTOMS\n};\n`;
    fs.writeFileSync(emojiDataPath, fullFile, 'utf8');
    console.log('\n✅ Updated emojiData.js');
}

async function main() {
    console.log('🎨 Emoji Upload Script');
    console.log('='.repeat(40));
    
    // First stop the bot if running
    console.log('\n⚠️  Make sure the bot is STOPPED (Ctrl+C) before running this!\n');

    // Check existing emojis in the server
    console.log('📋 Checking existing emojis in server...');
    const existingInServer = await checkExistingEmojis();
    console.log(`   Found ${existingInServer.size} emojis in server\n`);

    const allEmojis = { ...EXISTING };
    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const emoji of REMAINING_EMOJIS) {
        console.log(`[${uploaded + skipped + failed + 1}/${REMAINING_EMOJIS.length}] ${emoji.name}:`);

        // Check if already exists
        if (existingInServer.has(emoji.name)) {
            const existing = existingInServer.get(emoji.name);
            allEmojis[emoji.key] = { name: existing.name, id: existing.id, animated: existing.animated || false };
            console.log(`   ⏭️ Already exists (${existing.id})`);
            skipped++;
            continue;
        }

        // Download from CDN
        const emojiData = await downloadEmoji(emoji.originalId);
        if (!emojiData) {
            console.log(`   ❌ Download failed - skipping`);
            failed++;
            continue;
        }

        // Upload to server
        try {
            const result = await uploadEmoji(emoji.name, emojiData.data);
            allEmojis[emoji.key] = { name: result.name, id: result.id, animated: result.animated || false };
            console.log(`   ✅ Uploaded! (${result.id})`);
            uploaded++;
            
            // Small delay
            await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
            console.log(`   ❌ Upload failed: ${err.response?.data?.message || err.message}`);
            failed++;
        }
    }

    console.log('\n' + '='.repeat(40));
    console.log(`📦 Uploaded: ${uploaded}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`❌ Failed: ${failed}`);

    // Update the emoji data file
    updateEmojiDataFile(allEmojis);

    console.log('\n🔄 Now start the bot with: npm start');
    console.log('   All emojis should work! 🎉');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
