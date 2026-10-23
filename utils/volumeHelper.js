/**
 * Safely and instantly updates the player volume on Lavalink v4.
 * Updates both the native player volume (0-100) and the filter volume (0.0-1.0)
 * so that volume changes take effect immediately whether filters are active or not.
 * 
 * @param {import('riffy').Player} player 
 * @param {number} volume Volume level (0-100)
 */
async function setPlayerVolume(player, volume) {
    if (!player) return false;

    const clampedVolume = Math.min(100, Math.max(0, Number(volume) || 100));
    const floatVolume = clampedVolume / 100;

    player.volume = clampedVolume;

    if (player.filters) {
        player.filters.volume = floatVolume;
    }

    try {
        if (player.node && player.node.rest && player.guildId) {
            await player.node.rest.updatePlayer({
                guildId: player.guildId,
                data: {
                    volume: clampedVolume,
                    filters: {
                        ...(player.filters ? {
                            equalizer: player.filters.equalizer,
                            karaoke: player.filters.karaoke,
                            timescale: player.filters.timescale,
                            tremolo: player.filters.tremolo,
                            vibrato: player.filters.vibrato,
                            rotation: player.filters.rotation,
                            distortion: player.filters.distortion,
                            channelMix: player.filters.channelMix,
                            lowPass: player.filters.lowPass,
                        } : {}),
                        volume: floatVolume
                    }
                }
            });
            return true;
        }
    } catch (err) {
        console.warn('[ VOLUME ] Error updating player via REST payload:', err?.message || err);
    }

    // Fallback to standard player.setVolume if REST call was not possible
    try {
        if (typeof player.setVolume === 'function') {
            player.setVolume(clampedVolume);
        }
        return true;
    } catch (e) {
        console.error('[ VOLUME ] Error calling player.setVolume:', e?.message || e);
        return false;
    }
}

module.exports = { setPlayerVolume };
