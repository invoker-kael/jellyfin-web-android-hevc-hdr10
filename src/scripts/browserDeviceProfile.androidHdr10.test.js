import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
    android: true,
    chrome: true,
    mobile: true,
    tv: false,
    versionMajor: 130,
    edgeChromium: false,
    edge: false,
    edgeUwp: false,
    firefox: false,
    opera: false,
    safari: false,
    osx: false,
    ios: false,
    iphone: false,
    ipod: false,
    ipad: false,
    ps4: false,
    xboxOne: false,
    tizen: false,
    web0s: false,
    vidaa: false,
    touch: true
}));

vi.mock('./browser', () => ({ default: browserMock }));

import buildDeviceProfile from './browserDeviceProfile';

const defaultBrowser = { ...browserMock };

function getVideoRange(profile, codec) {
    return profile.CodecProfiles.find((codecProfile) => {
        return codecProfile.Type === 'Video'
            && codecProfile.Codec === codec
            && codecProfile.Conditions?.some((condition) => condition.Property === 'VideoRangeType');
    }).Conditions.find((condition) => condition.Property === 'VideoRangeType').Value;
}

function buildProfile(options = {}, main10Supported = true) {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation((contentType) => {
        if (contentType.includes('.2.4.L123')) {
            return main10Supported ? 'probably' : '';
        }
        if (contentType.includes('hvc1.1.') || contentType.includes('hev1.1.')) {
            return 'probably';
        }
        return '';
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});

    return buildDeviceProfile(options);
}

describe('Android HEVC HDR device profile', () => {
    beforeEach(() => {
        Object.assign(browserMock, defaultBrowser);
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not advertise HDR10 by default on Android mobile Chrome', () => {
        const profile = buildProfile({ supportsHevc: true });

        expect(getVideoRange(profile, 'hevc')).toBe('SDR');
        expect(profile.DirectPlayProfiles.some((directPlayProfile) => {
            return directPlayProfile.Type === 'Video'
                && directPlayProfile.Container.includes('mp4')
                && directPlayProfile.VideoCodec.includes('hevc');
        })).toBe(true);
    });

    it('adds only the Android HDR range types supplied by capability detection to HEVC', () => {
        const profile = buildProfile({
            supportsHevc: true,
            androidHdrVideoRangeTypeOverrides: ['HDR10', 'HLG']
        });

        expect(getVideoRange(profile, 'hevc')).toBe('SDR|HDR10|HLG');
        expect(getVideoRange(profile, 'vp9')).toBe('SDR');
        expect(getVideoRange(profile, 'av1')).toBe('SDR');
    });

    it('does not advertise Android HDR ranges when Main 10 decoding is not reported', () => {
        const profile = buildProfile({
            supportsHevc: true,
            androidHdrVideoRangeTypeOverrides: ['HDR10', 'HLG', 'DOVI']
        }, false);

        expect(getVideoRange(profile, 'hevc')).toBe('SDR');
    });

    it('leaves the existing desktop Chrome HDR profile unchanged', () => {
        Object.assign(browserMock, {
            android: false,
            mobile: false,
            touch: false
        });

        const profile = buildProfile({ androidHdrVideoRangeTypeOverrides: ['HDR10', 'HLG', 'DOVI'] });

        expect(getVideoRange(profile, 'hevc')).toContain('HDR10');
        expect(getVideoRange(profile, 'vp9')).toContain('HDR10');
    });

    it('does not apply the Android override to Android TV', () => {
        Object.assign(browserMock, {
            mobile: false,
            tv: true
        });

        const withOverride = buildProfile({ androidHdrVideoRangeTypeOverrides: ['HDR10', 'HLG', 'DOVI'] });
        const withoutOverride = buildProfile();

        expect(getVideoRange(withOverride, 'hevc')).toBe(getVideoRange(withoutOverride, 'hevc'));
        expect(getVideoRange(withOverride, 'vp9')).toBe(getVideoRange(withoutOverride, 'vp9'));
    });
});
