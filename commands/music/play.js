const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config.js');
const SpotifyWebApi = require('spotify-web-api-node');
const { getData } = require('spotify-url-info')(require('node-fetch'));
const { sendErrorResponse, handleCommandError, safeDeferReply, buildPaleCard, sanitizeTitle, stripLeadingIcons } = require('../../utils/responseHandler.js');
const { checkVoiceChannel: checkVC } = require('../../utils/voiceChannelCheck.js');
const { getLavalinkManager } = require('../../lavalink.js');
const { getLang } = require('../../utils/languageLoader');
const { getEmoji } = require('../../UI/emojis/emoji');
const requesters = new Map();

function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

    return [
        hours > 0 ? `${hours}h` : null,
        minutes > 0 ? `${minutes}m` : null,
        `${seconds}s`,
    ]
        .filter(Boolean)
        .join(' ');
}

const data = new SlashCommandBuilder()
  .setName("play")
  .setDescription("Play a song from a name or link")
  .addStringOption(option =>
    option.setName("name")
      .setDescription("Enter song name / link or playlist")
      .setRequired(true)
      .setAutocomplete(true)
  );

const spotifyApi = new SpotifyWebApi({
    clientId: config.spotifyClientId, 
    clientSecret: config.spotifyClientSecret,
});

async function waitForPlayerConnection(player, timeoutMs = 8000) {
    if (!player) return false;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (player.connected || (player.connection && player.connection.isReady)) {
            player.connected = true;
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (player.connection && typeof player.connection.resolve === 'function') {
        try {
            await player.connection.resolve();
            player.connected = true;
            return true;
        } catch (_) {}
    }
    return player.connected || false;
}

async function getSpotifyPlaylistTracks(playlistId) {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body.access_token);

        let tracks = [];
        let offset = 0;
        let limit = 100;
        let total = 0;

        do {
            const response = await spotifyApi.getPlaylistTracks(playlistId, { limit, offset });
            total = response.body.total;
            offset += limit;

            for (const item of response.body.items) {
                if (item.track && item.track.name && item.track.artists) {
                    const trackName = `${item.track.name} - ${item.track.artists.map(a => a.name).join(', ')}`;
                    tracks.push(trackName);
                }
            }
        } while (tracks.length < total);

        return tracks;
    } catch (error) {
        console.error("Error fetching Spotify playlist tracks:", error);
        return [];
    }
}

module.exports = {
    data: data,
    run: async (client, interaction) => {
        try {
            // Handle autocomplete
            if (interaction.isAutocomplete()) {
                const focusedOption = interaction.options.getFocused(true);
                if (focusedOption.name === 'name') {
                    const query = focusedOption.value;
                    if (query.length < 2) {
                        return interaction.respond([]);
                    }

                    try {
                        const nodeManager = getLavalinkManager();
                        if (!nodeManager) {
                            return interaction.respond([]);
                        }

                        await nodeManager.ensureNodeAvailable();
                        const resolve = await client.riffy.resolve({ query, requester: interaction.user.username });

                        if (resolve && resolve.tracks && resolve.tracks.length > 0) {
                            const choices = resolve.tracks.slice(0, 25).map(track => {
                                const info = track.info;
                                const duration = formatDuration(info.length);
                                const display = `${info.title} - ${info.author} (${duration})`;
                                return {
                                    name: display.length > 100 ? display.substring(0, 97) + '...' : display,
                                    value: info.uri || query
                                };
                            });
                            return interaction.respond(choices);
                        } else {
                            return interaction.respond([]);
                        }
                    } catch (error) {
                        console.error('Autocomplete error:', error);
                        return interaction.respond([]);
                    }
                }
            }

            const lang = await getLang(interaction.guildId);
            const t = lang.music.play;

            const query = interaction.options.getString('name');

            const deferred = await safeDeferReply(interaction);

            if (!deferred && !interaction.deferred && !interaction.replied) return;
            const existingPlayer = client.riffy.players.get(interaction.guildId);
            const voiceCheck = await checkVC(interaction, existingPlayer);
            if (!voiceCheck.allowed) {
                const reply = await interaction.editReply(voiceCheck.response);
                setTimeout(() => reply.delete().catch(() => {}), 5000);
                return reply;
            }

            const nodeManager = getLavalinkManager();
            if (!nodeManager) {
                return sendErrorResponse(
                    interaction,
                    t.lavalinkManagerError.title + '\n\n' +
                    t.lavalinkManagerError.message + '\n' +
                    t.lavalinkManagerError.note,
                    5000
                );
            }
            
            try {
                await nodeManager.ensureNodeAvailable();
            } catch (error) {
                const nodeCount = nodeManager.getNodeCount();
                const totalCount = nodeManager.getTotalNodeCount();
                return sendErrorResponse(
                    interaction,
                    t.noNodes.title + '\n\n' +
                    t.noNodes.message
                        .replace('{connected}', nodeCount)
                        .replace('{total}', totalCount) + '\n' +
                    t.noNodes.note,
                    5000
                );
            }

            const userVoiceChannel = interaction.member.voice.channelId;
            
            if (existingPlayer && existingPlayer.voiceChannel !== userVoiceChannel) {
                try {
                    const { cleanupTrackMessages } = require('../../player.js');
                    await cleanupTrackMessages(client, existingPlayer);
                    existingPlayer.queue.clear();
                    existingPlayer.stop();
                    await new Promise(resolve => setTimeout(resolve, 300));
                    existingPlayer.destroy();
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error('Error destroying old player:', error);
                    try {
                        if (!existingPlayer.destroyed) {
                            existingPlayer.destroy();
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    } catch (e) {}
                }
            }

            let player = (existingPlayer && existingPlayer.voiceChannel === userVoiceChannel && !existingPlayer.destroyed)
                ? existingPlayer
                : null;

            if (!player) {
                if (!nodeManager.hasConnectedNodes()) {
                    await nodeManager.checkAllNodesHealth().catch(() => {});
                    await nodeManager.forceConnectAllNodes().catch(() => {});
                    await new Promise(res => setTimeout(res, 200));
                }

                let attempts = 0;
                const maxAttempts = 3;
                while (attempts < maxAttempts) {
                    try {
                        await nodeManager.ensureNodeAvailable().catch(() => {});
                        player = client.riffy.createConnection({
                            guildId: interaction.guildId,
                            voiceChannel: userVoiceChannel,
                            textChannel: interaction.channelId,
                            deaf: true
                        });
                        if (player) break;
                    } catch (err) {
                        attempts++;
                        const msg = err?.message || '';
                        if (attempts < maxAttempts && (msg.includes('No nodes are available') || msg.includes('fetch failed'))) {
                            await nodeManager.reconnectNodesNow?.(4000).catch(() => {});
                            await new Promise(res => setTimeout(res, 500));
                            continue;
                        }
                        if (attempts >= maxAttempts) {
                            console.error('Error creating player in play command:', err);
                            const nodeCount = nodeManager.getNodeCount();
                            const totalCount = nodeManager.getTotalNodeCount();
                            return sendErrorResponse(
                                interaction,
                                t.noNodes.title + '\n\n' +
                                t.noNodes.message
                                    .replace('{connected}', nodeCount)
                                    .replace('{total}', totalCount) + '\n' +
                                t.noNodes.note,
                                5000
                            );
                        }
                    }
                }
            }

            if (!player) {
                return sendErrorResponse(
                    interaction,
                    t.lavalinkManagerError.title + '\n\n' +
                    t.lavalinkManagerError.message + '\n' +
                    t.lavalinkManagerError.note,
                    5000
                );
            }

            let tracksToQueue = [];
            let isPlaylist = false;
            let queuedTracks = 0;

            if (query.includes('spotify.com')) {
                try {
                    const spotifyData = await getData(query);

                    if (spotifyData.type === 'track') {
                        const trackName = `${spotifyData.name} - ${spotifyData.artists.map(a => a.name).join(', ')}`;
                        tracksToQueue.push(trackName);
                    } else if (spotifyData.type === 'playlist') {
                        isPlaylist = true;
                        const playlistId = query.split('/playlist/')[1].split('?')[0]; 
                        tracksToQueue = await getSpotifyPlaylistTracks(playlistId);
                    }
                } catch (err) {
                    console.error('Error fetching Spotify data:', err);
                    return sendErrorResponse(
                        interaction,
                        t.spotifyError.title + '\n\n' +
                        t.spotifyError.message + '\n' +
                        t.spotifyError.note,
                        5000
                    );
                }
            } else {
                let resolve;
                try {
                    resolve = await client.riffy.resolve({ query, requester: interaction.user.username });
                } catch (err) {
                    const msg = err?.message || '';
                    if (msg.includes('fetch failed') || msg.includes('No nodes are available') || (err.cause && err.cause.code === 'ECONNREFUSED')) {
                        await nodeManager.reconnectNodesNow?.(5000).catch(() => {});
                        await nodeManager.ensureNodeAvailable().catch(() => {});
                        try {
                            resolve = await client.riffy.resolve({ query, requester: interaction.user.username });
                        } catch (retryErr) {
                            console.error('Retry resolve failed:', retryErr);
                            return sendErrorResponse(
                                interaction,
                                t.noNodes.title + '\n\n' +
                                t.noNodes.message
                                    .replace('{connected}', nodeManager.getNodeCount())
                                    .replace('{total}', nodeManager.getTotalNodeCount()) + '\n' +
                                t.noNodes.note,
                                5000
                            );
                        }
                    } else {
                        console.error('Resolve error in play command:', err);
                        return sendErrorResponse(
                            interaction,
                            t.invalidResponse.title + '\n\n' +
                            (err.message || t.invalidResponse.message) + '\n' +
                            t.invalidResponse.note,
                            5000
                        );
                    }
                }

                if (!resolve || typeof resolve !== 'object' || !Array.isArray(resolve.tracks) || resolve.tracks.length === 0) {
                    return sendErrorResponse(
                        interaction,
                        t.noResults.title + '\n\n' +
                        t.noResults.message + '\n' +
                        t.noResults.note,
                        5000
                    );
                }

                if (resolve.loadType === 'playlist') {
                    isPlaylist = true;
                    for (const track of resolve.tracks) {
                        track.info.requester = interaction.user.username;
                        player.queue.add(track);
                        requesters.set(track.info.uri, interaction.user.username);
                        queuedTracks++;
                    }
                } else if (resolve.loadType === 'search' || resolve.loadType === 'track') {
                    const track = resolve.tracks.shift() || resolve.tracks[0];
                    if (!track) {
                        return sendErrorResponse(
                            interaction,
                            t.noResults.title + '\n\n' +
                            t.noResults.message + '\n' +
                            t.noResults.note,
                            5000
                        );
                    }
                    track.info.requester = interaction.user.username;
                    player.queue.add(track);
                    requesters.set(track.info.uri, interaction.user.username);
                    queuedTracks = 1;
                } else {
                    return sendErrorResponse(
                        interaction,
                        t.noResults.title + '\n\n' +
                        t.noResults.message + '\n' +
                        t.noResults.note,
                        5000
                    );
                }
            }

            const maxTracks = 200;
            for (let i = 0; i < Math.min(tracksToQueue.length, maxTracks); i++) {
                const trackQuery = tracksToQueue[i];
                try {
                    const resolve = await client.riffy.resolve({ query: trackQuery, requester: interaction.user.username });
                    if (resolve && resolve.tracks && resolve.tracks.length > 0) {
                        const trackInfo = resolve.tracks[0];
                        player.queue.add(trackInfo);
                        requesters.set(trackInfo.info.uri, interaction.user.username);
                        queuedTracks++;
                    }
                } catch (error) {
                    console.error(`Error resolving track ${trackQuery}:`, error);
                }
            }
            
            if (tracksToQueue.length > maxTracks) {
                console.warn(`Playlist truncated: ${tracksToQueue.length} tracks requested, only ${maxTracks} queued`);
            }

            const connected = await waitForPlayerConnection(player);
            if (!connected) {
                console.warn(`[ PLAYER ] Voice connection wait timed out for guild ${interaction.guildId}`);
            }

            if (!player.playing && !player.paused) {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        if (player.connection && player.connection.isReady) {
                            player.connected = true;
                        }
                        await player.play();
                        break;
                    } catch (playErr) {
                        const msg = playErr?.message || '';
                        if (attempt < 3 && (msg.includes('connection is not initiated') || msg.includes('resolve') || msg.includes('timed out'))) {
                            await new Promise(r => setTimeout(r, 800));
                            continue;
                        }
                        console.error('[ PLAYER ] Error in player.play():', msg || playErr);
                        break;
                    }
                }
            }

            const successTitle = isPlaylist ? t.success.titlePlaylist : t.success.titleTrack;
            const titleIcon = isPlaylist ? (getEmoji('playlist') || '📚') : (getEmoji('music') || '🎵');
            const addedIcon = isPlaylist ? (getEmoji('playlist') || '📚') : (getEmoji('success') || '✅');
            const statusIcon = player.playing ? (getEmoji('play') || '▶️') : (getEmoji('pause') || '⏸️');
            const statusText = stripLeadingIcons(player.playing ? t.success.nowPlaying : t.success.queueReady);
            const successContainer = buildPaleCard(
                `${titleIcon} ${sanitizeTitle(successTitle, 'Play')}`,
                [
                    `### ${addedIcon} Added` + '\n' +
                    (isPlaylist
                        ? t.success.playlistAdded.replace('{count}', queuedTracks)
                        : t.success.trackAdded),
                    `### ${statusIcon} Status` + '\n' +
                    statusText
                ]
            );

            const message = await interaction.editReply({ 
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2,
                fetchReply: true
            });

            setTimeout(() => {
                message.delete().catch(() => {}); 
            }, 3000);

        } catch (error) {
            console.error('[ PLAY COMMAND ERROR ]:', error);
            const lang = await getLang(interaction.guildId).catch(() => ({ music: { play: { errors: {} } } }));
            const t = lang.music?.play?.errors || {};
            
            return handleCommandError(
                interaction,
                error,
                'play',
                (t.title || '## ❌ Error') + '\n\n' + (error.message || t.message || 'An error occurred while processing the request.\nPlease try again later.')
            );
        }
    },
    requesters: requesters,
};
