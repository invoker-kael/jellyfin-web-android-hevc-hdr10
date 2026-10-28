import { afterEach, describe, expect, it } from 'vitest';
import appSettings from './appSettings';

const storageKey = 'audioCodecCompatibilityOverrides';

describe('audio codec client compatibility overrides', () => {
    afterEach(() => {
        localStorage.removeItem(storageKey);
    });

    it('uses browser detection unless a client override is stored', () => {
        expect(appSettings.audioCodecCompatibilityOverride('ac3')).toBeNull();
        expect(appSettings.audioCodecCompatibilityOverride('eac3')).toBeNull();

        appSettings.audioCodecCompatibilityOverride('ac3', true);
        appSettings.audioCodecCompatibilityOverride('eac3', false);

        expect(appSettings.audioCodecCompatibilityOverride('ac3')).toBe(true);
        expect(appSettings.audioCodecCompatibilityOverride('eac3')).toBe(false);

        appSettings.audioCodecCompatibilityOverride('ac3', null);
        expect(appSettings.audioCodecCompatibilityOverride('ac3')).toBeNull();
        expect(appSettings.audioCodecCompatibilityOverride('eac3')).toBe(false);
    });

    it('ignores codec names outside AC3 and E-AC3', () => {
        expect(appSettings.audioCodecCompatibilityOverride('dts', true)).toBeNull();
        expect(appSettings.audioCodecCompatibilityOverride('dts')).toBeNull();
    });
});
