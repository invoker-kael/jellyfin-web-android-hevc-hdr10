import { describe, expect, it, vi } from 'vitest';
import {
    androidHdrVideoRangeServerSettings,
    androidHdrVideoRangeTypes,
    getAndroidHdrVideoRangeTypes,
    getHevcMain10ContentType,
    isAndroidMobileHevcClient
} from './androidHdr10';

const androidChrome = {
    android: true,
    chrome: true,
    mobile: true,
    tv: false
};

const allServerAutoDetection = Object.fromEntries(androidHdrVideoRangeTypes.map(rangeType => [rangeType, true]));

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

describe('Android HDR video range capability detection', () => {
    it('limits automatic detection to Android mobile Chrome and the Android app shell', () => {
        expect(isAndroidMobileHevcClient(androidChrome, false)).toBe(true);
        expect(isAndroidMobileHevcClient({ ...androidChrome, mobile: false }, false)).toBe(false);
        expect(isAndroidMobileHevcClient({ ...androidChrome, tv: true }, false)).toBe(false);
        expect(isAndroidMobileHevcClient({ ...androidChrome, android: false }, false)).toBe(false);
        expect(isAndroidMobileHevcClient({ ...androidChrome, chrome: false }, false)).toBe(false);
        expect(isAndroidMobileHevcClient({ ...androidChrome, chrome: false }, true)).toBe(true);
    });

    it('requires HEVC Main 10 support before automatic or manual range overrides', async () => {
        const mediaCapabilities = createMediaCapabilities();
        const videoElement = createVideoElement({ main10Supported: false });

        await expect(getAndroidHdrVideoRangeTypes({
            browser: androidChrome,
            videoElement,
            mediaCapabilities,
            matchMedia: createMatchMedia(),
            clientOverrides: { HDR10: true, DOVI: true }
        })).resolves.toEqual([]);

        expect(mediaCapabilities.decodingInfo).not.toHaveBeenCalled();
        expect(getHevcMain10ContentType(videoElement)).toBeNull();
    });

    it('detects each supported HDR range type independently', async () => {
        const mediaCapabilities = createMediaCapabilities();

        await expect(getAndroidHdrVideoRangeTypes({
            browser: androidChrome,
            videoElement: createVideoElement(),
            mediaCapabilities,
            matchMedia: createMatchMedia(),
            serverAutoDetection: allServerAutoDetection
        })).resolves.toEqual(androidHdrVideoRangeTypes);

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

    it('does not advertise formats whose decoding query is unsupported, unsmooth, or rejected', async () => {
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
            serverAutoDetection: allServerAutoDetection
        })).resolves.toEqual(['HLG']);
    });

    it('requires an HDR display for HDR output while retaining an SDR Dolby Vision base-layer match', async () => {
        await expect(getAndroidHdrVideoRangeTypes({
            browser: androidChrome,
            videoElement: createVideoElement(),
            mediaCapabilities: createMediaCapabilities(),
            matchMedia: createMatchMedia(false),
            serverAutoDetection: allServerAutoDetection
        })).resolves.toEqual(['DOVIWithSDR']);
    });

    it('applies server detection settings independently and lets client choices override them', async () => {
        const mediaCapabilities = createMediaCapabilities();
        const options = {
            browser: androidChrome,
            videoElement: createVideoElement(),
            mediaCapabilities,
            matchMedia: createMatchMedia(),
            serverAutoDetection: {}
        };

        await expect(getAndroidHdrVideoRangeTypes(options)).resolves.toEqual([]);
        expect(mediaCapabilities.decodingInfo).not.toHaveBeenCalled();

        await expect(getAndroidHdrVideoRangeTypes({
            ...options,
            clientOverrides: { HDR10: true, HLG: false, DOVI: true }
        })).resolves.toEqual(['HDR10', 'DOVI']);

        await expect(getAndroidHdrVideoRangeTypes({
            ...options,
            serverAutoDetection: { HDR10: true }
        })).resolves.toEqual(['HDR10']);

        await expect(getAndroidHdrVideoRangeTypes({
            ...options,
            serverAutoDetection: allServerAutoDetection,
            clientOverrides: { HDR10: false, DOVIWithHDR10: false }
        })).resolves.toEqual(['HLG', 'DOVI', 'DOVIWithHLG', 'DOVIWithSDR']);
    });

    it('maps every server-controlled range type to a distinct setting', () => {
        expect(Object.keys(androidHdrVideoRangeServerSettings)).toEqual(androidHdrVideoRangeTypes);
        expect(new Set(Object.values(androidHdrVideoRangeServerSettings)).size).toBe(androidHdrVideoRangeTypes.length);
    });

    it('does not manually advertise Dolby Vision without the corresponding codec profile', async () => {
        await expect(getAndroidHdrVideoRangeTypes({
            browser: androidChrome,
            videoElement: createVideoElement({ dolbyVisionProfiles: [] }),
            clientOverrides: { DOVI: true, DOVIWithHDR10: true }
        })).resolves.toEqual([]);
    });

    it('does not enable Android mobile HDR ranges for other device classes', async () => {
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
