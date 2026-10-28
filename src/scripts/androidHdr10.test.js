import { describe, expect, it, vi } from 'vitest';
import {
    getAndroidHdrVideoRangeTypes,
    getHdrVideoRangePolicy,
    getHevcMain10ContentType,
    hdrVideoRangeServerSettings,
    hdrVideoRangeTypes,
    isAndroidMobileHevcClient
} from './androidHdr10';

const androidChrome = {
    android: true,
    chrome: true,
    mobile: true,
    tv: false
};

const allServerEnabled = Object.fromEntries(hdrVideoRangeTypes.map(rangeType => [rangeType, true]));
const allServerDisabled = Object.fromEntries(hdrVideoRangeTypes.map(rangeType => [rangeType, false]));

function createVideoElement({ main10Supported = true, dolbyVisionProfiles = [5, 8] } = {}) {
    return {
        canPlayType: vi.fn((contentType) => {
            if (contentType.includes('.2.4.L123')) {
                return main10Supported ? 'probably' : '';
            }
            if (contentType.includes('.05.06')) {
                return dolbyVisionProfiles.includes(5) ? 'probably' : '';
            }
            if (contentType.includes('.08.06')) {
                return dolbyVisionProfiles.includes(8) ? 'probably' : '';
            }
            return '';
        })
    };
}

function createMediaCapabilities(supportsConfiguration = () => true) {
    return {
        decodingInfo: vi.fn(async ({ video }) => {
            const supported = supportsConfiguration(video);
            return { supported, smooth: supported, powerEfficient: supported };
        })
    };
}

function createMatchMedia(matches = true) {
    return vi.fn(() => ({ media: '(dynamic-range: high)', matches }));
}

describe('HDR video range policy and Android capability detection', () => {
    it('limits Android capability probing to Android mobile Chrome and the Android app shell', () => {
        expect(isAndroidMobileHevcClient(androidChrome, false)).toBe(true);
        expect(isAndroidMobileHevcClient({ ...androidChrome, mobile: false }, false)).toBe(false);
        expect(isAndroidMobileHevcClient({ ...androidChrome, tv: true }, false)).toBe(false);
        expect(isAndroidMobileHevcClient({ ...androidChrome, android: false }, false)).toBe(false);
        expect(isAndroidMobileHevcClient({ ...androidChrome, chrome: false }, false)).toBe(false);
        expect(isAndroidMobileHevcClient({ ...androidChrome, chrome: false }, true)).toBe(true);
    });

    it('resolves each client choice over the server enable or disable default', () => {
        expect(getHdrVideoRangePolicy({ HDR10: false }, {})).toEqual({
            HDR10: false,
            HLG: true,
            DOVI: true,
            DOVIWithHDR10: true,
            DOVIWithHLG: true,
            DOVIWithSDR: true
        });
        expect(getHdrVideoRangePolicy({ HDR10: false }, { HDR10: true, HLG: false })).toMatchObject({
            HDR10: true,
            HLG: false
        });
        expect(getHdrVideoRangePolicy({ HDR10: true }, { HDR10: null })).toMatchObject({ HDR10: true });
    });

    it('requires HEVC Main 10 support before reporting any Android HDR range', async () => {
        const mediaCapabilities = createMediaCapabilities();
        const videoElement = createVideoElement({ main10Supported: false });

        await expect(getAndroidHdrVideoRangeTypes({
            browser: androidChrome,
            videoElement,
            mediaCapabilities,
            matchMedia: createMatchMedia(),
            serverDefaults: allServerEnabled,
            clientOverrides: { HDR10: true, DOVI: true }
        })).resolves.toEqual([]);

        expect(mediaCapabilities.decodingInfo).not.toHaveBeenCalled();
        expect(getHevcMain10ContentType(videoElement)).toBeNull();
    });

    it('uses browser decoding and display checks for server-enabled Android formats', async () => {
        const mediaCapabilities = createMediaCapabilities();

        await expect(getAndroidHdrVideoRangeTypes({
            browser: androidChrome,
            videoElement: createVideoElement(),
            mediaCapabilities,
            matchMedia: createMatchMedia(),
            serverDefaults: allServerEnabled
        })).resolves.toEqual(hdrVideoRangeTypes);

        const configurations = mediaCapabilities.decodingInfo.mock.calls.map(([config]) => config.video);
        expect(configurations).toContainEqual(expect.objectContaining({
            contentType: 'video/mp4; codecs="hvc1.2.4.L123"',
            width: 3840,
            height: 2160,
            bitrate: 18000000,
            framerate: 24,
            colorGamut: 'rec2020',
            transferFunction: 'pq',
            hdrMetadataType: 'smpteSt2086'
        }));
        expect(configurations).toContainEqual(expect.objectContaining({
            contentType: 'video/mp4; codecs="hvc1.2.4.L123"',
            transferFunction: 'hlg'
        }));
        expect(configurations).toContainEqual(expect.objectContaining({
            contentType: 'video/mp4; codecs="dvh1.05.06"'
        }));
        expect(configurations).toContainEqual(expect.objectContaining({
            contentType: 'video/mp4; codecs="dvh1.08.06"'
        }));
    });

    it('does not report formats whose decoder query is unsupported, unsmooth, or rejected', async () => {
        const mediaCapabilities = {
            decodingInfo: vi.fn(async ({ video }) => {
                if (video.hdrMetadataType === 'smpteSt2086') {
                    return { supported: true, smooth: false };
                }
                if (video.transferFunction === 'hlg') {
                    return { supported: true, smooth: true };
                }
                return { supported: false, smooth: false };
            })
        };

        await expect(getAndroidHdrVideoRangeTypes({
            browser: androidChrome,
            videoElement: createVideoElement(),
            mediaCapabilities,
            matchMedia: createMatchMedia(),
            serverDefaults: allServerEnabled
        })).resolves.toEqual(['HLG']);
    });

    it('requires an HDR display for HDR output but not for Dolby Vision with an SDR base layer', async () => {
        await expect(getAndroidHdrVideoRangeTypes({
            browser: androidChrome,
            videoElement: createVideoElement(),
            mediaCapabilities: createMediaCapabilities(),
            matchMedia: createMatchMedia(false),
            serverDefaults: allServerEnabled
        })).resolves.toEqual(['DOVIWithSDR']);
    });

    it('applies server disable and client override choices independently', async () => {
        const mediaCapabilities = createMediaCapabilities();
        const options = {
            browser: androidChrome,
            videoElement: createVideoElement(),
            mediaCapabilities,
            matchMedia: createMatchMedia(),
            serverDefaults: allServerDisabled
        };

        await expect(getAndroidHdrVideoRangeTypes(options)).resolves.toEqual([]);
        expect(mediaCapabilities.decodingInfo).not.toHaveBeenCalled();

        await expect(getAndroidHdrVideoRangeTypes({
            ...options,
            clientOverrides: { HDR10: true, HLG: false, DOVI: true }
        })).resolves.toEqual(['HDR10', 'DOVI']);

        await expect(getAndroidHdrVideoRangeTypes({
            ...options,
            serverDefaults: { ...allServerDisabled, HDR10: true }
        })).resolves.toEqual(['HDR10']);

        await expect(getAndroidHdrVideoRangeTypes({
            ...options,
            serverDefaults: allServerEnabled,
            clientOverrides: { HDR10: false, DOVIWithHDR10: false }
        })).resolves.toEqual(['HLG', 'DOVI', 'DOVIWithHLG', 'DOVIWithSDR']);
    });

    it('maps every HDR range to a unique persisted server enable or disable setting', () => {
        expect(Object.keys(hdrVideoRangeServerSettings)).toEqual(hdrVideoRangeTypes);
        expect(new Set(Object.values(hdrVideoRangeServerSettings)).size).toBe(hdrVideoRangeTypes.length);
    });

    it('does not manually report Dolby Vision without the matching codec profile', async () => {
        await expect(getAndroidHdrVideoRangeTypes({
            browser: androidChrome,
            videoElement: createVideoElement({ dolbyVisionProfiles: [] }),
            clientOverrides: { DOVI: true, DOVIWithHDR10: true }
        })).resolves.toEqual([]);
    });

    it('does not apply Android-only decoding probes to other device classes', async () => {
        await expect(getAndroidHdrVideoRangeTypes({
            browser: { ...androidChrome, android: false },
            videoElement: createVideoElement(),
            mediaCapabilities: createMediaCapabilities(),
            matchMedia: createMatchMedia(),
            clientOverrides: { HDR10: true }
        })).resolves.toEqual([]);

        await expect(getAndroidHdrVideoRangeTypes({
            browser: { ...androidChrome, mobile: false, tv: true },
            videoElement: createVideoElement(),
            clientOverrides: { HDR10: true }
        })).resolves.toEqual([]);
    });
});
