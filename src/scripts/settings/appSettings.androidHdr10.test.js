import { afterEach, describe, expect, it } from 'vitest';
import appSettings from './appSettings';

const overrideKey = 'androidHdr10CompatibilityOverride';
const legacyKey = 'enableAndroidHdr10Compatibility';

describe('Android HDR10 client preference', () => {
    afterEach(() => {
        localStorage.removeItem(overrideKey);
        localStorage.removeItem(legacyKey);
    });

    it('follows the server when no client override is stored', () => {
        expect(appSettings.enableAndroidHdr10Compatibility()).toBeNull();
    });

    it('stores explicit enabled and disabled overrides', () => {
        appSettings.enableAndroidHdr10Compatibility(true);
        expect(appSettings.enableAndroidHdr10Compatibility()).toBe(true);

        appSettings.enableAndroidHdr10Compatibility(false);
        expect(appSettings.enableAndroidHdr10Compatibility()).toBe(false);
    });

    it('clears the local override to follow the server default', () => {
        appSettings.enableAndroidHdr10Compatibility(true);
        appSettings.enableAndroidHdr10Compatibility(null);

        expect(appSettings.enableAndroidHdr10Compatibility()).toBeNull();
    });

    it('migrates a legacy enabled override but treats the old default false as inherit', () => {
        localStorage.setItem(legacyKey, 'true');
        expect(appSettings.enableAndroidHdr10Compatibility()).toBe(true);

        localStorage.setItem(legacyKey, 'false');
        expect(appSettings.enableAndroidHdr10Compatibility()).toBeNull();
    });
});
