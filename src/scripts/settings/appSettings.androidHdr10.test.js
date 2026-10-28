import { afterEach, describe, expect, it } from 'vitest';
import appSettings from './appSettings';

const overrideKey = 'androidHdrVideoRangeOverrides';
const previousOverrideKey = 'androidHdr10CompatibilityOverride';
const legacyKey = 'enableAndroidHdr10Compatibility';

describe('Android HDR format client preferences', () => {
    afterEach(() => {
        localStorage.removeItem(overrideKey);
        localStorage.removeItem(previousOverrideKey);
        localStorage.removeItem(legacyKey);
    });

    it('follows the server default when no client override is stored', () => {
        expect(appSettings.androidHdrVideoRangeOverride('HDR10')).toBeNull();
        expect(appSettings.androidHdrVideoRangeOverride('HLG')).toBeNull();
    });

    it('stores independent enabled and disabled overrides for each HDR range type', () => {
        appSettings.androidHdrVideoRangeOverride('HDR10', true);
        appSettings.androidHdrVideoRangeOverride('HLG', false);

        expect(appSettings.androidHdrVideoRangeOverride('HDR10')).toBe(true);
        expect(appSettings.androidHdrVideoRangeOverride('HLG')).toBe(false);
        expect(appSettings.androidHdrVideoRangeOverride('DOVI')).toBeNull();
    });

    it('clears only the selected override to follow the server default', () => {
        appSettings.androidHdrVideoRangeOverride('HDR10', true);
        appSettings.androidHdrVideoRangeOverride('DOVI', false);
        appSettings.androidHdrVideoRangeOverride('HDR10', null);

        expect(appSettings.androidHdrVideoRangeOverride('HDR10')).toBeNull();
        expect(appSettings.androidHdrVideoRangeOverride('DOVI')).toBe(false);
    });

    it('migrates previous HDR10 overrides while treating the legacy default false as inherit', () => {
        localStorage.setItem(previousOverrideKey, 'true');
        expect(appSettings.androidHdrVideoRangeOverride('HDR10')).toBe(true);

        localStorage.setItem(previousOverrideKey, 'false');
        expect(appSettings.androidHdrVideoRangeOverride('HDR10')).toBe(false);

        localStorage.removeItem(previousOverrideKey);
        localStorage.setItem(legacyKey, 'false');
        expect(appSettings.androidHdrVideoRangeOverride('HDR10')).toBeNull();

        localStorage.setItem(legacyKey, 'true');
        expect(appSettings.androidHdrVideoRangeOverride('HDR10')).toBe(true);
    });

    it('keeps the previous HDR10 settings API compatible', () => {
        appSettings.enableAndroidHdr10Compatibility(true);
        expect(appSettings.androidHdrVideoRangeOverride('HDR10')).toBe(true);

        appSettings.enableAndroidHdr10Compatibility(null);
        expect(appSettings.androidHdrVideoRangeOverride('HDR10')).toBeNull();
    });
});
