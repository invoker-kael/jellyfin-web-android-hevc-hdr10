import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
    android: true,
    chrome: true,
    mobile: true,
    tv: false,
    versionMajor: 140,
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
import appSettings from './settings/appSettings';

const defaultBrowser = { ...browserMock };

function buildProfile({ ac3Supported = false, eac3Supported = false } = {}) {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation((contentType) => {
        if (contentType.includes('video/x-matroska')) {
            return 'probably';
        }
        if (contentType.includes('ac-3')) {
            return ac3Supported ? 'probably' : '';
        }
        if (contentType.includes('ec-3')) {
            return eac3Supported ? 'probably' : '';
        }
        if (contentType.includes('avc1.42E01E') || contentType.includes('avc1.640029')) {
            return 'probably';
        }
        return '';
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});

    return buildDeviceProfile({});
}

function getMkvAudioCodecs(profile) {
    const mkvProfile = profile.DirectPlayProfiles.find((directPlayProfile) => {
        return directPlayProfile.Type === 'Video' && directPlayProfile.Container.split(',').includes('mkv');
    });

    return mkvProfile.AudioCodec.split(',');
}

describe('AC3 and E-AC3 client compatibility profiles', () => {
    beforeEach(() => {
        Object.assign(browserMock, defaultBrowser);
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('follows browser detection by default', () => {
        const codecs = getMkvAudioCodecs(buildProfile());

        expect(codecs).not.toContain('ac3');
        expect(codecs).not.toContain('eac3');
    });

    it('allows AC3 and E-AC3 to be enabled independently on this client', () => {
        appSettings.audioCodecCompatibilityOverride('ac3', true);
        const ac3Codecs = getMkvAudioCodecs(buildProfile());
        expect(ac3Codecs).toContain('ac3');
        expect(ac3Codecs).not.toContain('eac3');

        localStorage.clear();
        appSettings.audioCodecCompatibilityOverride('eac3', true);
        const eac3Codecs = getMkvAudioCodecs(buildProfile());
        expect(eac3Codecs).not.toContain('ac3');
        expect(eac3Codecs).toContain('eac3');
    });

    it('lets a client disable formats that browser detection reports as supported', () => {
        appSettings.audioCodecCompatibilityOverride('ac3', false);
        appSettings.audioCodecCompatibilityOverride('eac3', false);

        const codecs = getMkvAudioCodecs(buildProfile({ ac3Supported: true, eac3Supported: true }));

        expect(codecs).not.toContain('ac3');
        expect(codecs).not.toContain('eac3');
    });
});
