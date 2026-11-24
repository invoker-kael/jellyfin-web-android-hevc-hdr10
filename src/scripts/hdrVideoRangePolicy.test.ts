import { describe, expect, it, vi } from 'vitest';

import { applyHdrVideoRangePolicy } from './browserDeviceProfile';
import {
    canPlayHevcInMediaSource,
    canPlayHevcMain10InMediaSource,
    getAndroidHdrVideoRangeTypes,
    getHdrVideoRangePolicy,
    getHevcMain10ContentType,
    hdrVideoRangeServerSettings,
    hdrVideoRangeTypes
} from './hdrVideoRangePolicy';

const createMain10Video = () => ({
    canPlayType: vi.fn((contentType: string) => contentType.includes('.L153') ? 'probably' : 'no')
});

describe('HDR video range policy', () => {
    it('covers every Jellyfin 12.4 HDR video range type', () => {
        expect(hdrVideoRangeTypes).toEqual([
            'HDR10',
            'HDR10Plus',
            'HLG',
            'DOVI',
            'DOVIWithHDR10',
            'DOVIWithHDR10Plus',
            'DOVIWithHLG',
            'DOVIWithSDR',
            'DOVIWithEL',
            'DOVIWithELHDR10Plus',
            'DOVIInvalid'
        ]);
        expect(Object.keys(hdrVideoRangeServerSettings)).toEqual(hdrVideoRangeTypes);
    });

    it('uses server values by default and lets an explicit client setting override them', () => {
        const policy = getHdrVideoRangePolicy({
            EnableAndroidHdr10AutoDetection: false,
            EnableHdr10Plus: false
        }, {
            HDR10: true,
            HDR10Plus: false,
            HLG: null
        });

        expect(policy.HDR10).toBe(true);
        expect(policy.HDR10Plus).toBe(false);
        expect(policy.HLG).toBe(true);
        expect(policy.DOVIInvalid).toBe(true);
    });

    it('detects Android Chrome HEVC Main10 HDR10 only with a capable decoder, MSE, and HDR display', async () => {
        const videoElement = createMain10Video();
        const mediaSource = {
            isTypeSupported: vi.fn((contentType: string) => contentType.includes('.L153'))
        };
        const mediaCapabilities = {
            decodingInfo: vi.fn(({ video }: { video: { hdrMetadataType?: string } }) => Promise.resolve({
                supported: video.hdrMetadataType === 'smpteSt2086',
                smooth: video.hdrMetadataType === 'smpteSt2086'
            }))
        };

        const detected = await getAndroidHdrVideoRangeTypes({
            browser: { android: true, chrome: true, mobile: true, tv: false },
            videoElement,
            mediaSource,
            mediaCapabilities,
            matchMedia: vi.fn(() => ({ media: '(dynamic-range: high)', matches: true }))
        });

        expect(getHevcMain10ContentType(videoElement)).toContain('hvc1.2.4.L153');
        expect(canPlayHevcMain10InMediaSource(videoElement, mediaSource)).toBe(true);
        expect(detected).toContain('HDR10');
        expect(detected).not.toContain('HDR10Plus');
    });

    it('does not automatically enable HDR on non-Android or non-HDR clients', async () => {
        const videoElement = createMain10Video();
        const common = {
            videoElement,
            mediaSource: { isTypeSupported: () => true },
            mediaCapabilities: { decodingInfo: () => Promise.resolve({ supported: true, smooth: true }) },
            matchMedia: () => ({ media: '(dynamic-range: high)', matches: true })
        };

        await expect(getAndroidHdrVideoRangeTypes({
            ...common,
            browser: { android: false, chrome: true, mobile: false, tv: false }
        })).resolves.toEqual([]);

        await expect(getAndroidHdrVideoRangeTypes({
            ...common,
            browser: { android: true, chrome: true, mobile: true, tv: false },
            mediaCapabilities: { decodingInfo: () => Promise.resolve({ supported: false, smooth: false }) }
        })).resolves.toEqual([]);
    });

    it('requires MSE support for Android Main10 fMP4', () => {
        expect(canPlayHevcMain10InMediaSource(createMain10Video(), {
            isTypeSupported: () => false
        })).toBe(false);
        expect(canPlayHevcMain10InMediaSource(createMain10Video(), undefined)).toBe(false);
    });

    it('keeps the existing HEVC Main profile available on Android when only 8-bit MSE decoding is reported', () => {
        const videoElement = {
            canPlayType: vi.fn((contentType: string) => contentType.includes('hvc1.1.L120') ? 'probably' : 'no')
        };
        const mediaSource = {
            isTypeSupported: vi.fn((contentType: string) => contentType.includes('hvc1.1.L120'))
        };

        expect(canPlayHevcInMediaSource(videoElement, mediaSource)).toBe(true);
        expect(canPlayHevcMain10InMediaSource(videoElement, mediaSource)).toBe(false);
    });

    it('applies server disablement and only force-enables HDR when the client can decode the codec', () => {
        const videoElement = createMain10Video();

        expect(applyHdrVideoRangePolicy('SDR|HDR10', 'hevc', {
            hdrVideoRangePolicy: { HDR10: false }
        }, videoElement)).toBe('SDR');

        expect(applyHdrVideoRangePolicy('SDR', 'hevc', {
            hdrVideoRangePolicy: { HDR10: true },
            hdrVideoRangeClientOverrides: { HDR10: true }
        }, videoElement)).toBe('SDR|HDR10');

        const unsupportedVideo = { canPlayType: () => 'no' };
        expect(applyHdrVideoRangePolicy('SDR', 'hevc', {
            hdrVideoRangePolicy: { HDR10: true },
            hdrVideoRangeClientOverrides: { HDR10: true }
        }, unsupportedVideo)).toBe('SDR');
    });
});
