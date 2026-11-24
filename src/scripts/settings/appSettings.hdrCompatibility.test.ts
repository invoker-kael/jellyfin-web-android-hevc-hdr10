import { beforeEach, describe, expect, it } from 'vitest';

import appSettings from './appSettings';

describe('appSettings codec compatibility overrides', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('stores tri-state HDR overrides and removes them when returning to the server default', () => {
        expect(appSettings.hdrVideoRangeOverride('HDR10')).toBeNull();
        expect(appSettings.hdrVideoRangeOverride('HDR10', true)).toBe(true);
        expect(appSettings.hdrVideoRangeOverride('HDR10')).toBe(true);

        expect(appSettings.hdrVideoRangeOverride('HDR10', null)).toBeNull();
        expect(appSettings.hdrVideoRangeOverride('HDR10')).toBeNull();
        expect(localStorage.getItem('androidHdrVideoRangeOverrides')).toBeNull();
    });

    it('keeps existing HDR10 client settings readable', () => {
        localStorage.setItem('androidHdr10CompatibilityOverride', 'false');
        expect(appSettings.hdrVideoRangeOverride('HDR10')).toBe(false);
    });

    it('stores independent AC-3 and E-AC-3 overrides', () => {
        expect(appSettings.audioCodecCompatibilityOverride('ac3')).toBeNull();
        expect(appSettings.audioCodecCompatibilityOverride('ac3', true)).toBe(true);
        expect(appSettings.audioCodecCompatibilityOverride('eac3', false)).toBe(false);

        expect(appSettings.audioCodecCompatibilityOverride('ac3')).toBe(true);
        expect(appSettings.audioCodecCompatibilityOverride('eac3')).toBe(false);
        expect(appSettings.audioCodecCompatibilityOverride('ac3', null)).toBeNull();
        expect(appSettings.audioCodecCompatibilityOverride('ac3')).toBeNull();
    });
});
