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
import * as userSettings from './settings/userSettings';

const defaultBrowser = { ...browserMock };
let originalMediaSource;

function getVideoRange(profile, codec) {
    return profile.CodecProfiles.find((codecProfile) => {
        return codecProfile.Type === 'Video'
            && codecProfile.Codec === codec
            && codecProfile.Conditions?.some((condition) => condition.Property === 'VideoRangeType');
    }).Conditions.find((condition) => condition.Property === 'VideoRangeType').Value;
}

function buildProfile(options = {}, main10Supported = true) {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation((contentType) => {
        if (contentType.includes('mp4a.40.2') || contentType === 'audio/aac') {
            return 'probably';
        }
        if (contentType.includes('.2.4.L123')) {
            return main10Supported ? 'probably' : '';
        }
        if (contentType.includes('avc1.') || contentType.includes('hvc1.1.') || contentType.includes('hev1.1.')) {
            return 'probably';
        }
        return '';
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});

    return buildDeviceProfile(options);
}

describe('generic HDR video range device profile', () => {
    beforeEach(() => {
        Object.assign(browserMock, defaultBrowser);
        localStorage.clear();
        originalMediaSource = Object.getOwnPropertyDescriptor(window, 'MediaSource');
        Object.defineProperty(window, 'MediaSource', {
            configurable: true,
            value: { isTypeSupported: () => true }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        if (originalMediaSource) {
            Object.defineProperty(window, 'MediaSource', originalMediaSource);
        } else {
            delete window.MediaSource;
        }
        delete window.NativeShell;
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

    it('adds Android-detected HDR range types to HEVC without adding them to other codecs', () => {
        const profile = buildProfile({
            supportsHevc: true,
            androidHdrDetectedVideoRangeTypes: ['HDR10', 'HLG']
        });

        expect(getVideoRange(profile, 'hevc')).toBe('SDR|HDR10|HLG');
        expect(getVideoRange(profile, 'vp9')).toBe('SDR');
        expect(getVideoRange(profile, 'av1')).toBe('SDR');
    });

    it('advertises Android Main 10 for HLS fMP4 only when MediaSource accepts HEVC', () => {
        const profile = buildProfile({
            hdrVideoRangePolicy: { HDR10: true },
            hdrVideoRangeClientOverrides: { HDR10: true },
            androidHdrDetectedVideoRangeTypes: ['HDR10']
        });
        const fmp4Profile = profile.TranscodingProfiles.find((transcodingProfile) => {
            return transcodingProfile.Type === 'Video'
                && transcodingProfile.Protocol === 'hls'
                && transcodingProfile.Container === 'mp4';
        });

        expect(getVideoRange(profile, 'hevc')).toContain('HDR10');
        expect(fmp4Profile.VideoCodec.split(',')).toContain('hevc');

        // eslint-disable-next-line compat/compat
        window.MediaSource.isTypeSupported = () => false;
        const unsupportedProfile = buildProfile({ supportsHevc: true });
        const unsupportedFmp4Profile = unsupportedProfile.TranscodingProfiles.find((transcodingProfile) => {
            return transcodingProfile.Type === 'Video'
                && transcodingProfile.Protocol === 'hls'
                && transcodingProfile.Container === 'mp4';
        });

        expect(unsupportedFmp4Profile.VideoCodec.split(',')).not.toContain('hevc');
        expect(getVideoRange(unsupportedProfile, 'hevc')).toBe('SDR');
    });

    it('enables fMP4 by default for an Android native shell and respects an explicit opt-out', () => {
        browserMock.chrome = false;
        window.NativeShell = {};

        const profile = buildProfile();
        const fmp4Profile = profile.TranscodingProfiles.find((transcodingProfile) => {
            return transcodingProfile.Type === 'Video'
                && transcodingProfile.Protocol === 'hls'
                && transcodingProfile.Container === 'mp4';
        });
        expect(fmp4Profile.VideoCodec.split(',')).toContain('hevc');

        userSettings.preferFmp4HlsContainer(false);
        const optedOutProfile = buildProfile();
        expect(optedOutProfile.TranscodingProfiles.some((transcodingProfile) => {
            return transcodingProfile.Type === 'Video'
                && transcodingProfile.Protocol === 'hls'
                && transcodingProfile.Container === 'mp4';
        })).toBe(false);
    });

    it('does not advertise Android mobile HEVC fMP4 for other mobile browsers', () => {
        Object.assign(browserMock, {
            android: false,
            chrome: false,
            mobile: true
        });
        userSettings.preferFmp4HlsContainer(true);

        const profile = buildProfile({ supportsHevc: true });
        const fmp4Profile = profile.TranscodingProfiles.find((transcodingProfile) => {
            return transcodingProfile.Type === 'Video'
                && transcodingProfile.Protocol === 'hls'
                && transcodingProfile.Container === 'mp4';
        });

        expect(fmp4Profile.VideoCodec.split(',')).not.toContain('hevc');
    });

    it('does not advertise Android-detected ranges when Main 10 decoding is not reported', () => {
        const profile = buildProfile({
            supportsHevc: true,
            androidHdrDetectedVideoRangeTypes: ['HDR10', 'HLG', 'DOVI']
        }, false);

        expect(getVideoRange(profile, 'hevc')).toBe('SDR');
    });

    it('keeps the existing desktop Chrome profile when it follows enabled server defaults', () => {
        Object.assign(browserMock, {
            android: false,
            mobile: false,
            touch: false
        });

        const profile = buildProfile({
            hdrVideoRangePolicy: { HDR10: true, HLG: true, DOVI: true },
            hdrVideoRangeClientOverrides: {}
        });

        expect(getVideoRange(profile, 'hevc')).toContain('HDR10');
        expect(getVideoRange(profile, 'vp9')).toContain('HDR10');
    });

    it('applies server defaults to Android TV browser profiles too', () => {
        Object.assign(browserMock, {
            mobile: false,
            tv: true
        });

        const withDisabledDefault = buildProfile({
            hdrVideoRangePolicy: { HDR10: false },
            hdrVideoRangeClientOverrides: {}
        });

        expect(getVideoRange(withDisabledDefault, 'hevc')).not.toContain('HDR10');
        expect(getVideoRange(withDisabledDefault, 'vp9')).not.toContain('HDR10');
    });

    it('lets a client explicitly enable a format only for codecs that report 10-bit support', () => {
        const profile = buildProfile({
            supportsHevc: true,
            hdrVideoRangePolicy: { HDR10: true },
            hdrVideoRangeClientOverrides: { HDR10: true }
        });

        expect(getVideoRange(profile, 'hevc')).toContain('HDR10');
        expect(getVideoRange(profile, 'vp9')).toBe('SDR');
        expect(getVideoRange(profile, 'av1')).toBe('SDR');
    });

    it('does not let a client enable a range when the required decoder profile is absent', () => {
        const profile = buildProfile({
            supportsHevc: true,
            hdrVideoRangePolicy: { HDR10: true },
            hdrVideoRangeClientOverrides: { HDR10: true }
        }, false);

        expect(getVideoRange(profile, 'hevc')).toBe('SDR');
    });
});
