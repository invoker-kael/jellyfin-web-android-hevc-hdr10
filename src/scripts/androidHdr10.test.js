import { describe, expect, it, vi } from 'vitest';
import { getHevcMain10ContentType, isAndroidMobileHevcClient, supportsAndroidHdr10 } from './androidHdr10';

const androidChrome = {
    android: true,
    chrome: true,
    mobile: true,
    tv: false
};

function createVideoElement(main10Supported = true) {
    return {
        canPlayType: vi.fn((contentType) => {
            return main10Supported && contentType.includes('.2.4.L123') ? 'probably' : '';
        })
    };
}

function createMediaCapabilities(supported = true) {
    return {
        decodingInfo: vi.fn().mockResolvedValue({
            supported,
            smooth: supported,
            powerEfficient: supported
        })
    };
}

describe('Android HDR10 capability detection', () => {
    it('limits the feature to Android mobile Chrome and System WebView', () => {
        expect(isAndroidMobileHevcClient(androidChrome, false)).toBe(true);
        expect(isAndroidMobileHevcClient({ ...androidChrome, mobile: false }, false)).toBe(false);
        expect(isAndroidMobileHevcClient({ ...androidChrome, tv: true }, false)).toBe(false);
        expect(isAndroidMobileHevcClient({ ...androidChrome, android: false }, false)).toBe(false);
        expect(isAndroidMobileHevcClient({ ...androidChrome, chrome: false }, false)).toBe(false);
        expect(isAndroidMobileHevcClient({ ...androidChrome, chrome: false }, true)).toBe(true);
    });

    it('allows Android mobile WebView clients in the native app shell', async () => {
        const originalNativeShell = window.NativeShell;
        window.NativeShell = {};

        try {
            await expect(supportsAndroidHdr10({
                browser: { ...androidChrome, chrome: false },
                videoElement: createVideoElement(),
                mediaCapabilities: createMediaCapabilities(),
                matchMedia: () => ({ media: '(dynamic-range: high)', matches: true })
            })).resolves.toBe(true);
        } finally {
            if (originalNativeShell === undefined) {
                delete window.NativeShell;
            } else {
                window.NativeShell = originalNativeShell;
            }
        }
    });

    it('requires the browser to report HEVC Main 10 support', async () => {
        const mediaCapabilities = createMediaCapabilities();

        await expect(supportsAndroidHdr10({
            browser: androidChrome,
            videoElement: createVideoElement(false),
            mediaCapabilities,
            matchMedia: () => ({ media: '(dynamic-range: high)', matches: true }),
            clientOverride: true
        })).resolves.toBe(false);

        expect(mediaCapabilities.decodingInfo).not.toHaveBeenCalled();
        expect(getHevcMain10ContentType(createVideoElement(false))).toBeNull();
    });

    it('requires HEVC HDR decoding and a high dynamic range display by default', async () => {
        const mediaCapabilities = createMediaCapabilities();
        const matchMedia = vi.fn(() => ({ media: '(dynamic-range: high)', matches: true }));

        await expect(supportsAndroidHdr10({
            browser: androidChrome,
            videoElement: createVideoElement(),
            mediaCapabilities,
            matchMedia
        })).resolves.toBe(true);

        expect(mediaCapabilities.decodingInfo).toHaveBeenCalledWith({
            type: 'file',
            video: {
                contentType: 'video/mp4; codecs="hvc1.2.4.L123"',
                width: 1920,
                height: 1080,
                bitrate: 10000000,
                framerate: 30,
                colorGamut: 'rec2020',
                transferFunction: 'pq',
                hdrMetadataType: 'smpteSt2086'
            }
        });
        expect(matchMedia).toHaveBeenCalledWith('(dynamic-range: high)');
    });

    it('does not auto-enable when either HDR signal is missing or negative', async () => {
        const videoElement = createVideoElement();
        const mediaCapabilities = createMediaCapabilities();

        await expect(supportsAndroidHdr10({
            browser: androidChrome,
            videoElement,
            mediaCapabilities,
            matchMedia: () => ({ media: 'not all', matches: false })
        })).resolves.toBe(false);

        await expect(supportsAndroidHdr10({
            browser: androidChrome,
            videoElement,
            mediaCapabilities: createMediaCapabilities(false),
            matchMedia: () => ({ media: '(dynamic-range: high)', matches: true })
        })).resolves.toBe(false);

        await expect(supportsAndroidHdr10({
            browser: androidChrome,
            videoElement,
            mediaCapabilities,
            matchMedia: () => ({ media: '(dynamic-range: high)', matches: true })
        })).resolves.toBe(true);
    });

    it('allows the explicit compatibility setting when automatic HDR APIs are inconclusive', async () => {
        await expect(supportsAndroidHdr10({
            browser: androidChrome,
            videoElement: createVideoElement(),
            clientOverride: true,
            serverAutoDetectionEnabled: false
        })).resolves.toBe(true);

        await expect(supportsAndroidHdr10({
            browser: androidChrome,
            videoElement: createVideoElement(),
            mediaCapabilities: createMediaCapabilities(),
            matchMedia: () => ({ media: '(dynamic-range: high)', matches: false }),
            clientOverride: true
        })).resolves.toBe(true);
    });

    it('uses the server default for automatic detection unless the client overrides it', async () => {
        const options = {
            browser: androidChrome,
            videoElement: createVideoElement(),
            mediaCapabilities: createMediaCapabilities(),
            matchMedia: () => ({ media: '(dynamic-range: high)', matches: true }),
            serverAutoDetectionEnabled: false
        };

        await expect(supportsAndroidHdr10(options)).resolves.toBe(false);
        await expect(supportsAndroidHdr10({ ...options, clientOverride: false })).resolves.toBe(false);
        await expect(supportsAndroidHdr10({ ...options, clientOverride: true })).resolves.toBe(true);
        await expect(supportsAndroidHdr10({ ...options, serverAutoDetectionEnabled: true })).resolves.toBe(true);
        await expect(supportsAndroidHdr10({
            ...options,
            serverAutoDetectionEnabled: true,
            clientOverride: false
        })).resolves.toBe(false);
    });

    it.each([
        [{ ...androidChrome, android: false }],
        [{ ...androidChrome, mobile: false }],
        [{ ...androidChrome, tv: true }]
    ])('does not enable the Android mobile path for other device classes', async (browser) => {
        await expect(supportsAndroidHdr10({
            browser,
            videoElement: createVideoElement(),
            mediaCapabilities: createMediaCapabilities(),
            matchMedia: () => ({ media: '(dynamic-range: high)', matches: true }),
            clientOverride: true
        })).resolves.toBe(false);
    });
});
