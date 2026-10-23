// upload-gifs.js
const axios = require('axios');
const config = require('./config.js');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = config.TOKEN || config.BOT_TOKEN || process.env.BOT_TOKEN;
const GUILD_ID = '1456626927317291050'; 

// The original IDs from GlaceYt that were ANIMATED
const ANIMATED_EMOJIS = [
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

async function deleteEmoji(id) {
    try {
        await axios.delete(`https://discord.com/api/v10/guilds/${GUILD_ID}/emojis/${id}`, {
            headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
        });
        console.log(`   🗑️ Deleted old static emoji ${id}`);
    } catch(e) {}
}

async function uploadGif(name, base64) {
    const response = await axios.post(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/emojis`,
        { name: name, image: `data:image/gif;base64,${base64}` },
        { headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    return response.data;
}

async function main() {
    console.log('🔄 Re-uploading emojis as animated GIFs...');
    
    // First, read existing to delete the ones we uploaded as PNGs yesterday
    const existingReq = await axios.get(`https://discord.com/api/v10/guilds/${GUILD_ID}/emojis`, {
        headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
    });
    const existing = existingReq.data;
    
    // Get emojiData.js to preserve the first 13
    const emojiDataPath = path.join(__dirname, 'UI/emojis/emojiData.js');
    const { REDWHITE_CUSTOMS } = require(emojiDataPath);
    const allEmojis = { ...REDWHITE_CUSTOMS };

    for (const em of ANIMATED_EMOJIS) {
        console.log(`Downloading ${em.name}.gif...`);
        try {
            // Download GIF
            const gifUrl = `https://cdn.discordapp.com/emojis/${em.originalId}.gif?size=96&quality=lossless`;
            const gifRes = await axios.get(gifUrl, { responseType: 'arraybuffer' });
            const base64 = Buffer.from(gifRes.data).toString('base64');
            
            // Delete old static one if exists
            const old = existing.find(e => e.name === em.name && !e.animated);
            if (old) await deleteEmoji(old.id);
            
            // Upload as GIF
            const upRes = await uploadGif(em.name, base64);
            console.log(`   ✅ Uploaded as animated! (${upRes.id})`);
            
            allEmojis[em.key] = { name: upRes.name, id: upRes.id, animated: true };
            
            await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
            console.log(`   ❌ Failed: ${err.message}`);
        }
    }
    
    // Write new file
    let customsCode = 'const REDWHITE_CUSTOMS = Object.freeze({\n';
    const entries = [];
    for (const key of Object.keys(allEmojis)) {
        const e = allEmojis[key];
        const animStr = e.animated ? ', animated: true' : '';
        entries.push(`    ${key}: { name: "${e.name}", id: "${e.id}"${animStr} }`);
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
    for (const key of Object.keys(defaultEmojis)) {
        const def = defaultEmojis[key];
        if (allEmojis[key]) {
            emojiEntries.push(`    ${key}: { default: "${def}", custom: { redwhite: REDWHITE_CUSTOMS.${key} } }`);
        } else {
            emojiEntries.push(`    ${key}: { default: "${def}" }`);
        }
    }
    emojisCode += emojiEntries.join(',\n') + '\n});\n';

    const fullFile = customsCode + emojisCode + `\nmodule.exports = { EMOJIS, REDWHITE_CUSTOMS };\n`;
    fs.writeFileSync(emojiDataPath, fullFile, 'utf8');
    console.log('✅ Done!');
}
main();
