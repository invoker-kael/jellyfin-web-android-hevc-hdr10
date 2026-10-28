import browser from 'scripts/browser';
import Events from '../../utils/events.ts';
import { toBoolean } from '../../utils/string.ts';
import { androidHdrVideoRangeTypes } from '../androidHdr10';

class AppSettings {
    #getKey(name, userId) {
        if (userId) {
            name = userId + '-' + name;
        }

        return name;
    }

    enableAutoLogin(val) {
        if (val !== undefined) {
            this.set('enableAutoLogin', val.toString());
        }

        return toBoolean(this.get('enableAutoLogin'), true);
    }

    /**
     * Get or set 'Enable Gamepad' state.
     * @param {boolean|undefined} val - Flag to enable 'Enable Gamepad' or undefined.
     * @return {boolean} 'Enable Gamepad' state.
     */
    enableGamepad(val) {
        if (val !== undefined) {
            return this.set('enableGamepad', val.toString());
        }

        return toBoolean(this.get('enableGamepad'), false);
    }

    /**
     * Get or set 'Enable smooth scroll' state.
     * @param {boolean|undefined} val - Flag to enable 'Enable smooth scroll' or undefined.
     * @return {boolean} 'Enable smooth scroll' state.
     */
    enableSmoothScroll(val) {
        if (val !== undefined) {
            return this.set('enableSmoothScroll', val.toString());
        }

        return toBoolean(this.get('enableSmoothScroll'), !!browser.tizen);
    }

    enableSystemExternalPlayers(val) {
        if (val !== undefined) {
            this.set('enableSystemExternalPlayers', val.toString());
        }

        return toBoolean(this.get('enableSystemExternalPlayers'), false);
    }

    enableAutomaticBitrateDetection(isInNetwork, mediaType, val) {
        const key = 'enableautobitratebitrate-' + mediaType + '-' + isInNetwork;
        if (val !== undefined) {
            if (isInNetwork && mediaType === 'Audio') {
                val = true;
            }

            this.set(key, val.toString());
        }

        if (isInNetwork && mediaType === 'Audio') {
            return true;
        } else {
            return toBoolean(this.get(key), true);
        }
    }

    maxStreamingBitrate(isInNetwork, mediaType, val) {
        const key = 'maxbitrate-' + mediaType + '-' + isInNetwork;
        if (val !== undefined) {
            if (isInNetwork && mediaType === 'Audio') {
                //  nothing to do, this is always a max value
            } else {
                this.set(key, val);
            }
        }

        if (isInNetwork && mediaType === 'Audio') {
            // return a huge number so that it always direct plays
            return 150000000;
        } else {
            return parseInt(this.get(key) || '0', 10) || 1500000;
        }
    }

    maxStaticMusicBitrate(val) {
        if (val !== undefined) {
            this.set('maxStaticMusicBitrate', val);
        }

        const defaultValue = 320000;
        return parseInt(this.get('maxStaticMusicBitrate') || defaultValue.toString(), 10) || defaultValue;
    }

    maxChromecastBitrate(val) {
        if (val !== undefined) {
            this.set('chromecastBitrate1', val);
        }

        val = this.get('chromecastBitrate1');
        return val ? parseInt(val, 10) : null;
    }

    /**
     * Get or set 'Maximum video width'
     * @param {number|undefined} val - Maximum video width or undefined.
     * @return {number} Maximum video width.
     */
    maxVideoWidth(val) {
        if (val !== undefined) {
            return this.set('maxVideoWidth', val.toString());
        }

        return parseInt(this.get('maxVideoWidth') || '0', 10) || 0;
    }

    /**
     * Get or set 'Limit maximum supported video resolution' state.
     * @param {boolean|undefined} val - Flag to enable 'Limit maximum supported video resolution' or undefined.
     * @return {boolean} 'Limit maximum supported video resolution' state.
     */
    limitSupportedVideoResolution(val) {
        if (val !== undefined) {
            return this.set('limitSupportedVideoResolution', val.toString());
        }

        return toBoolean(this.get('limitSupportedVideoResolution'), false);
    }

    /**
     * Get or set preferred transcode video codec.
     * @param {string|undefined} val - Preferred transcode video codec or undefined.
     * @return {string} Preferred transcode video codec.
     */
    preferredTranscodeVideoCodec(val) {
        if (val !== undefined) {
            return this.set('preferredTranscodeVideoCodec', val);
        }
        return this.get('preferredTranscodeVideoCodec') || '';
    }

    /**
     * Get or set preferred transcode audio codec in video playback.
     * @param {string|undefined} val - Preferred transcode audio codec or undefined.
     * @return {string} Preferred transcode audio codec.
     */
    preferredTranscodeVideoAudioCodec(val) {
        if (val !== undefined) {
            return this.set('preferredTranscodeVideoAudioCodec', val);
        }
        return this.get('preferredTranscodeVideoAudioCodec') || '';
    }

    /**
     * Get or set 'Always burn in subtitle when transcoding' state.
     * @param {boolean|undefined} val - Flag to enable 'Always burn in subtitle when transcoding' or undefined.
     * @return {boolean} 'Always burn in subtitle when transcoding' state.
     */
    alwaysBurnInSubtitleWhenTranscoding(val) {
        if (val !== undefined) {
            return this.set('alwaysBurnInSubtitleWhenTranscoding', val.toString());
        }

        return toBoolean(this.get('alwaysBurnInSubtitleWhenTranscoding'), false);
    }

    /**
     * Get or set 'Enable DTS' state.
     * @param {boolean|undefined} val - Flag to enable 'Enable DTS' or undefined.
     * @return {boolean} 'Enable DTS' state.
     */
    enableDts(val) {
        if (val !== undefined) {
            return this.set('enableDts', val.toString());
        }

        return toBoolean(this.get('enableDts'), false);
    }

    /**
     * Get or set 'Enable TrueHD' state.
     * @param {boolean|undefined} val - Flag to enable 'Enable TrueHD' or undefined.
     * @return {boolean} 'Enable TrueHD' state.
     */
    enableTrueHd(val) {
        if (val !== undefined) {
            return this.set('enableTrueHd', val.toString());
        }

        return toBoolean(this.get('enableTrueHd'), false);
    }

    /**
     * Get or set a local Android HDR video range override.
     * @param {string} rangeType - Jellyfin video range type.
     * @param {boolean|null|undefined} val - Override state, null to follow the server default, or undefined to read.
     * @return {boolean|null} The local override, or null when following the server default.
     */
    androidHdrVideoRangeOverride(rangeType, val) {
        if (!androidHdrVideoRangeTypes.includes(rangeType)) {
            return null;
        }

        const key = 'androidHdrVideoRangeOverrides';
        const oldKey = 'androidHdr10CompatibilityOverride';
        const legacyKey = 'enableAndroidHdr10Compatibility';
        const storedValue = this.get(key);
        let overrides = {};

        if (storedValue !== null) {
            try {
                const parsed = JSON.parse(storedValue);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    overrides = parsed;
                }
            } catch {
                overrides = {};
            }
        }

        if (val === undefined) {
            if (typeof overrides[rangeType] === 'boolean') {
                return overrides[rangeType];
            }

            if (rangeType === 'HDR10') {
                const oldValue = this.get(oldKey);
                if (oldValue === 'true') {
                    return true;
                }
                if (oldValue === 'false') {
                    return false;
                }
                if (this.get(legacyKey) === 'true') {
                    return true;
                }
            }

            return null;
        }

        if (val !== null && typeof val !== 'boolean') {
            return null;
        }

        const hadPreviousHdr10Override = rangeType === 'HDR10'
            && (this.get(oldKey) !== null || this.get(legacyKey) !== null);

        if (rangeType === 'HDR10') {
            localStorage.removeItem(this.#getKey(oldKey));
            localStorage.removeItem(this.#getKey(legacyKey));
        }

        if (val === null) {
            delete overrides[rangeType];
            if (Object.keys(overrides).length === 0) {
                const hadValue = this.get(key) !== null || hadPreviousHdr10Override;
                localStorage.removeItem(this.#getKey(key));
                if (hadValue) {
                    Events.trigger(this, 'change', [key]);
                }
            } else {
                this.set(key, JSON.stringify(overrides));
            }
            return null;
        }

        overrides[rangeType] = val;
        this.set(key, JSON.stringify(overrides));
        return val;
    }

    enableAndroidHdr10Compatibility(val) {
        return this.androidHdrVideoRangeOverride('HDR10', val);
    }

    /**
     * Get or set 'Enable H.264 High 10 Profile' state.
     * @param {boolean|undefined} val - Flag to enable 'Enable H.264 High 10 Profile' or undefined.
     * @return {boolean} 'Enable H.264 High 10 Profile' state.
     */
    enableHi10p(val) {
        if (val !== undefined) {
            return this.set('enableHi10p', val.toString());
        }

        return toBoolean(this.get('enableHi10p'), false);
    }

    /**
     * Get or set 'Disable VBR audio encoding' state.
     * @param {boolean|undefined} val - Flag to enable 'Disable VBR audio encoding' or undefined.
     * @return {boolean} 'Disable VBR audio encoding' state.
     */
    disableVbrAudio(val) {
        if (val !== undefined) {
            return this.set('disableVbrAudio', val.toString());
        }

        return toBoolean(this.get('disableVbrAudio'), false);
    }

    /**
     * Get or set 'Always remux FLAC audio files' state.
     * @param {boolean|undefined} val - Flag to enable 'Always remux FLAC audio files' or undefined.
     * @return {boolean} 'Always remux FLAC audio files' state.
     */
    alwaysRemuxFlac(val) {
        if (val !== undefined) {
            return this.set('alwaysRemuxFlac', val.toString());
        }

        return toBoolean(this.get('alwaysRemuxFlac'), false);
    }

    /**
     * Get or set 'Always remux MP3 audio files' state.
     * @param {boolean|undefined} val - Flag to enable 'Always remux MP3 audio files' or undefined.
     * @return {boolean} 'Always remux MP3 audio files' state.
     */
    alwaysRemuxMp3(val) {
        if (val !== undefined) {
            return this.set('alwaysRemuxMp3', val.toString());
        }

        return toBoolean(this.get('alwaysRemuxMp3'), false);
    }

    set(name, value, userId) {
        const currentValue = this.get(name, userId);
        localStorage.setItem(this.#getKey(name, userId), value);

        if (currentValue !== value) {
            Events.trigger(this, 'change', [name]);
        }
    }

    get(name, userId) {
        return localStorage.getItem(this.#getKey(name, userId));
    }
}

export default new AppSettings();
