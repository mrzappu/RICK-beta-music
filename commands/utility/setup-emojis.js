const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Original emoji IDs from the original bot
const EMOJI_SET = [
    { key: 'home',     name: 'x_home',    originalId: '1492415029557985330' },
    { key: 'help',     name: 'x_info',    originalId: '1492415034825904289' },
    { key: 'music',    name: 'x_music',   originalId: '1492414900864159744' },
    { key: 'playlist', name: 'x_folder2', originalId: '1492414993335980113' },
    { key: 'basic',    name: 'x_setting', originalId: '1492414929779691580' },
    { key: 'utility',  name: 'x_tools',   originalId: '1492414943784341575' },
    { key: 'commands', name: 'x_js',      originalId: '1492414215993036930' },
    { key: 'servers',  name: 'x_world',   originalId: '1492414946661765172' },
    { key: 'users',    name: 'x_members', originalId: '1492414230480293989' },
    { key: 'uptime',   name: 'x_time',    originalId: '1492414939107950653' },
    { key: 'ping',     name: 'x_ping',    originalId: '1492414919256309861' },
    { key: 'info',     name: 'x_info',    originalId: '1492415034825904289' },
    { key: 'support',  name: 'x_partner', originalId: '1492414910364385430' },
    { key: 'github',   name: 'x_github',  originalId: '1492415015284768909' },
    { key: 'play',     name: 'x_play',    originalId: '1492414921789411338' },
    { key: 'pause',    name: 'x_pause',   originalId: '1492414913702789312' },
    { key: 'stop',     name: 'x_delete',  originalId: '1492414971013890068' },
    { key: 'next',     name: 'x_right',   originalId: '1492414926679965747' },
    { key: 'back',     name: 'x_left',    originalId: '1492414218975182908' },
    { key: 'settings', name: 'x_setting', originalId: '1492414929779691580' },
    { key: 'tools',    name: 'x_tools',   originalId: '1492414943784341575' },
    { key: 'success',  name: 'x_tick',    originalId: '1492414936671060000' },
    { key: 'error',    name: 'x_cross',   originalId: '1492414962595926026' },
    { key: 'warning',  name: 'x_annc',    originalId: '1492414950939951136' },
    { key: 'queue',    name: 'x_homes',   originalId: '1492415031802073238' },
    { key: 'search',   name: 'x_replit',  originalId: '1492414924146868264' },
    { key: 'volume',   name: 'x_speak',   originalId: '1492414932157730846' },
    { key: 'voice',    name: 'x_mic',     originalId: '1492414232954798120' },
    { key: 'ticket',   name: 'x_mail',    originalId: '1492414224301953054' },
    { key: 'link',     name: 'x_github',  originalId: '1492415015284768909' },
    { key: 'mod',      name: 'x_mod',     originalId: '1492414235538624744' },
    { key: 'security', name: 'x_automod', originalId: '1492414953716711554' },
    { key: 'welcome',  name: 'x_heart',   originalId: '1492415025564880917' },
    { key: 'owner',    name: 'x_owner',   originalId: '1492414907281576026' },
    { key: 'shuffle',  name: 'x_world',   originalId: '1492414946661765172' },
    { key: 'folder',   name: 'x_folder1', originalId: '1492414988797739140' },
    { key: 'cloud',    name: 'scloud',    originalId: '1492415334668435556' },
];

const data = new SlashCommandBuilder()
    .setName('setup-emojis')
    .setDescription('Upload custom emojis to this server and configure the bot to use them')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions);

function updateEmojiFiles(results) {
    const emojiDataPath = path.join(__dirname, '../../UI/emojis/emojiData.js');
    const seenKeys = new Set();
    
    const entries = [];
    for (const emoji of EMOJI_SET) {
        if (seenKeys.has(emoji.key)) continue;
        seenKeys.add(emoji.key);
        const result = results[emoji.key];
        const id = result ? result.id : '000000000000000000';
        const name = result ? result.name : emoji.name;
        const animatedStr = (result && result.animated) ? ', animated: true' : '';
        entries.push(`    ${emoji.key}: { name: "${name}", id: "${id}"${animatedStr} }`);
    }
    let customsCode = 'const REDWHITE_CUSTOMS = Object.freeze({\n' + entries.join(',\n') + '\n});\n';

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

    const emojiEntries = [];
    for (const key of seenKeys) {
        const def = defaultEmojis[key] || '❓';
        emojiEntries.push(`    ${key}: { default: "${def}", custom: { redwhite: REDWHITE_CUSTOMS.${key} } }`);
    }
    let emojisCode = '\nconst EMOJIS = Object.freeze({\n' + emojiEntries.join(',\n') + '\n});\n';

    const fullFile = customsCode + emojisCode + `\nmodule.exports = {\n    EMOJIS,\n    REDWHITE_CUSTOMS\n};\n`;
    fs.writeFileSync(emojiDataPath, fullFile, 'utf8');

    const configPath = path.join(__dirname, '../../config.js');
    let configContent = fs.readFileSync(configPath, 'utf8');
    configContent = configContent.replace(/customEmoji:\s*(true|false)/, 'customEmoji: true');
    fs.writeFileSync(configPath, configContent, 'utf8');
}

module.exports = {
    data: data,
    run: async (client, interaction) => {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const guild = interaction.guild;
            if (!guild) {
                return interaction.editReply({ content: '❌ This command can only be used in a server.' });
            }

            const me = guild.members.me;
            if (!me.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
                return interaction.editReply({ content: '❌ I need the **Manage Expressions** permission to upload emojis.' });
            }

            const config = require('../../config.js');
            const ownerIds = [config.OWNER_ID, ...(config.ownerID || [])].filter(Boolean);
            if (!ownerIds.includes(interaction.user.id)) {
                return interaction.editReply({ content: '❌ Only the bot owner can run this command.' });
            }

            // Get existing emojis
            const existingEmojis = await guild.emojis.fetch();
            const existingNames = new Map();
            existingEmojis.forEach(e => existingNames.set(e.name, e));

            const uniqueNames = [...new Set(EMOJI_SET.map(e => e.name))];
            const needUpload = uniqueNames.filter(n => !existingNames.has(n));

            await interaction.editReply({
                content: `🔄 **Uploading ${needUpload.length} emojis** (${uniqueNames.length - needUpload.length} already exist)...\nPlease wait ~${Math.ceil(needUpload.length * 2 / 60)} min!`
            });

            const results = {};
            let uploaded = 0;
            let failed = 0;
            let skipped = 0;
            const failedNames = [];
            const uploadedByName = new Map();

            for (let i = 0; i < EMOJI_SET.length; i++) {
                const emoji = EMOJI_SET[i];
                try {
                    // Skip duplicate names
                    if (uploadedByName.has(emoji.name)) {
                        const existing = uploadedByName.get(emoji.name);
                        results[emoji.key] = { name: existing.name, id: existing.id, animated: existing.animated || false };
                        skipped++;
                        continue;
                    }

                    // Skip if already in server
                    const existing = existingNames.get(emoji.name);
                    if (existing) {
                        results[emoji.key] = { name: existing.name, id: existing.id, animated: existing.animated || false };
                        uploadedByName.set(emoji.name, existing);
                        skipped++;
                        continue;
                    }

                    // Try uploading directly using CDN URL
                    let newEmoji = null;
                    const extensions = ['png', 'gif'];
                    
                    for (const ext of extensions) {
                        if (newEmoji) break;
                        const cdnUrl = `https://cdn.discordapp.com/emojis/${emoji.originalId}.${ext}?size=96&quality=lossless`;
                        try {
                            console.log(`📥 Trying ${emoji.name} (.${ext})...`);
                            newEmoji = await guild.emojis.create({
                                attachment: cdnUrl,
                                name: emoji.name,
                            });
                        } catch (err) {
                            console.log(`   ⚠️ ${ext} failed for ${emoji.name}: ${err.message}`);
                            // If rate limited, wait and retry
                            if (err.status === 429 || err.message?.includes('rate limit')) {
                                const retryAfter = err.retryAfter || 10;
                                console.log(`   ⏳ Rate limited, waiting ${retryAfter}s...`);
                                await new Promise(r => setTimeout(r, retryAfter * 1000));
                                try {
                                    newEmoji = await guild.emojis.create({
                                        attachment: cdnUrl,
                                        name: emoji.name,
                                    });
                                } catch (_) {}
                            }
                        }
                    }

                    if (newEmoji) {
                        results[emoji.key] = { name: newEmoji.name, id: newEmoji.id, animated: newEmoji.animated || false };
                        uploadedByName.set(emoji.name, newEmoji);
                        uploaded++;
                        console.log(`✅ Uploaded: ${emoji.name} (${newEmoji.id}) [${uploaded}/${needUpload.length}]`);

                        if (uploaded % 5 === 0) {
                            await interaction.editReply({
                                content: `🔄 **Progress: ${uploaded}/${needUpload.length} emojis uploaded...**`
                            }).catch(() => {});
                        }

                        // Delay between uploads
                        await new Promise(r => setTimeout(r, 1500));
                    } else {
                        console.error(`❌ Failed all attempts for ${emoji.name}`);
                        results[emoji.key] = null;
                        failed++;
                        failedNames.push(emoji.name);
                    }

                } catch (err) {
                    console.error(`❌ Error for ${emoji.name}:`, err.message);
                    results[emoji.key] = null;
                    failed++;
                    failedNames.push(emoji.name);
                }
            }

            // Save new emoji IDs
            updateEmojiFiles(results);

            let summary = `✅ **Emoji Setup Complete!**\n\n` +
                `📦 Uploaded: **${uploaded}**\n` +
                `⏭️ Already existed: **${skipped}**\n` +
                `❌ Failed: **${failed}**\n\n`;

            if (failed > 0) {
                summary += `⚠️ Failed: ${failedNames.join(', ')}\n\n`;
            }

            summary += `🔄 **Restart the bot now** (\`Ctrl+C\` → \`npm start\`) for emojis to appear!`;

            await interaction.editReply({ content: summary });

        } catch (error) {
            console.error('Setup emojis error:', error);
            await interaction.editReply({
                content: `❌ Error: ${error.message}`
            }).catch(() => {});
        }
    }
};
