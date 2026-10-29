const hevcMain10CodecStrings = [
    'hvc1.2.4.L123',
    'hev1.2.4.L123'
];

export const hdrVideoRangeTypes = [
    'HDR10',
    'HLG',
    'DOVI',
    'DOVIWithHDR10',
    'DOVIWithHLG',
    'DOVIWithSDR'
];

export const hdrVideoRangeServerSettings = {
    HDR10: 'EnableAndroidHdr10AutoDetection',
    HLG: 'EnableAndroidHlgAutoDetection',
    DOVI: 'EnableAndroidDolbyVisionAutoDetection',
    DOVIWithHDR10: 'EnableAndroidDolbyVisionWithHdr10AutoDetection',
    DOVIWithHLG: 'EnableAndroidDolbyVisionWithHlgAutoDetection',
    DOVIWithSDR: 'EnableAndroidDolbyVisionWithSdrAutoDetection'
};

// Keep the legacy serialized property names so existing server configurations remain compatible.
// Keep the old export names for callers from downstream Web builds.
export const androidHdrVideoRangeTypes = hdrVideoRangeTypes;
export const androidHdrVideoRangeServerSettings = hdrVideoRangeServerSettings;

const dolbyVisionRangeTypes = new Set([
    'DOVI',
    'DOVIWithHDR10',
    'DOVIWithHLG',
    'DOVIWithSDR'
]);

const decodingParameters = {
    width: 3840,
    height: 2160,
    bitrate: 18000000,
    framerate: 24
};

export function isAndroidMobileHevcClient(browser, nativeShell = typeof window !== 'undefined' && !!window.NativeShell) {
    return !!(browser?.android && (browser?.chrome || nativeShell) && browser?.mobile && !browser?.tv);
}

export function getHdrVideoRangePolicy(serverDefaults = {}, clientOverrides = {}) {
    return Object.fromEntries(hdrVideoRangeTypes.map((rangeType) => {
        const clientOverride = clientOverrides?.[rangeType];
        const serverDefault = serverDefaults?.[rangeType] !== false;
        return [rangeType, typeof clientOverride === 'boolean' ? clientOverride : serverDefault];
    }));
}

export function getHevcMain10ContentType(videoElement) {
    if (typeof videoElement?.canPlayType !== 'function') {
        return null;
    }

    for (const codecString of hevcMain10CodecStrings) {
        try {
            const contentType = `video/mp4; codecs="${codecString}"`;
            if (videoElement.canPlayType(contentType).replace(/no/, '')) {
                return contentType;
            }
        } catch {
            // Continue with the alternate HEVC sample entry.
        }
    }

    return null;
}

export function canPlayHevcMain10InMediaSource(videoElement, mediaSource) {
    if (typeof mediaSource?.isTypeSupported !== 'function' || typeof videoElement?.canPlayType !== 'function') {
        return false;
    }

    for (const codecString of hevcMain10CodecStrings) {
        try {
            const contentType = `video/mp4; codecs="${codecString}"`;
            const decoderSupported = videoElement.canPlayType(contentType).replace(/no/, '');
            if (decoderSupported && mediaSource.isTypeSupported(contentType)) {
                return true;
            }
        } catch {
            // Continue with the alternate HEVC sample entry.
        }
    }

    return false;
}

function getDolbyVisionContentType(videoElement, profile) {
    if (typeof videoElement?.canPlayType !== 'function') {
        return null;
    }

    const profileString = String(profile).padStart(2, '0');
    for (const sampleEntry of ['dvh1', 'dvhe']) {
        const contentType = `video/mp4; codecs="${sampleEntry}.${profileString}.06"`;
        try {
            if (videoElement.canPlayType(contentType).replace(/no/, '')) {
                return contentType;
            }
        } catch {
            // Continue with the alternate Dolby Vision sample entry.
        }
    }

    return null;
}

function supportsHighDynamicRangeDisplay(matchMedia) {
    if (typeof matchMedia !== 'function') {
        return false;
    }

    try {
        const query = matchMedia('(dynamic-range: high)');
        return query?.media !== 'not all' && query?.matches === true;
    } catch {
        return false;
    }
}

async function supportsDecoding(mediaCapabilities, contentType, videoOptions = {}) {
    if (typeof mediaCapabilities?.decodingInfo !== 'function' || !contentType) {
        return false;
    }

    try {
        const result = await mediaCapabilities.decodingInfo({
            type: 'file',
            video: {
                contentType,
                ...decodingParameters,
                ...videoOptions
            }
        });

        return result?.supported === true && result?.smooth === true;
    } catch {
        return false;
    }
}

export async function getAndroidHdrVideoRangeTypes({
    browser,
    videoElement,
    mediaCapabilities,
    matchMedia,
    serverDefaults = {},
    clientOverrides = {}
}) {
    if (!isAndroidMobileHevcClient(browser)) {
        return [];
    }

    const main10ContentType = getHevcMain10ContentType(videoElement);
    if (!main10ContentType) {
        return [];
    }

    const detectedTypes = new Set();
    const highDynamicRangeDisplay = supportsHighDynamicRangeDisplay(matchMedia);
    const isEnabledByServer = rangeType => serverDefaults?.[rangeType] !== false;

    if (hdrVideoRangeTypes.some(isEnabledByServer)) {
        const shouldDetectHdr10 = isEnabledByServer('HDR10') || isEnabledByServer('DOVIWithHDR10');
        const shouldDetectHlg = isEnabledByServer('HLG') || isEnabledByServer('DOVIWithHLG');
        const [hdr10Supported, hlgSupported] = await Promise.all([
            shouldDetectHdr10 ? supportsDecoding(mediaCapabilities, main10ContentType, {
                colorGamut: 'rec2020',
                transferFunction: 'pq',
                hdrMetadataType: 'smpteSt2086'
            }) : Promise.resolve(false),
            shouldDetectHlg ? supportsDecoding(mediaCapabilities, main10ContentType, {
                colorGamut: 'rec2020',
                transferFunction: 'hlg'
            }) : Promise.resolve(false)
        ]);

        if (highDynamicRangeDisplay) {
            if (isEnabledByServer('HDR10') && hdr10Supported) {
                detectedTypes.add('HDR10');
            }
            if (isEnabledByServer('HLG') && hlgSupported) {
                detectedTypes.add('HLG');
            }
        }

        const detectDolbyVisionProfile5 = isEnabledByServer('DOVI');
        const detectDolbyVisionProfile8 = ['DOVIWithHDR10', 'DOVIWithHLG', 'DOVIWithSDR'].some(isEnabledByServer);
        const dolbyVisionProfile5 = detectDolbyVisionProfile5 ? getDolbyVisionContentType(videoElement, 5) : null;
        const dolbyVisionProfile8 = detectDolbyVisionProfile8 ? getDolbyVisionContentType(videoElement, 8) : null;
        const [dolbyVisionProfile5Supported, profile8Supported] = await Promise.all([
            detectDolbyVisionProfile5 ? supportsDecoding(mediaCapabilities, dolbyVisionProfile5) : Promise.resolve(false),
            detectDolbyVisionProfile8 ? supportsDecoding(mediaCapabilities, dolbyVisionProfile8) : Promise.resolve(false)
        ]);

        if (isEnabledByServer('DOVI') && highDynamicRangeDisplay && dolbyVisionProfile5Supported) {
            detectedTypes.add('DOVI');
        }
        if (isEnabledByServer('DOVIWithSDR') && profile8Supported) {
            detectedTypes.add('DOVIWithSDR');
        }
        if (isEnabledByServer('DOVIWithHDR10') && highDynamicRangeDisplay && profile8Supported && hdr10Supported) {
            detectedTypes.add('DOVIWithHDR10');
        }
        if (isEnabledByServer('DOVIWithHLG') && highDynamicRangeDisplay && profile8Supported && hlgSupported) {
            detectedTypes.add('DOVIWithHLG');
        }
    }

    for (const rangeType of hdrVideoRangeTypes) {
        const override = clientOverrides?.[rangeType];
        if (override === false) {
            detectedTypes.delete(rangeType);
        } else if (override === true
            && (!dolbyVisionRangeTypes.has(rangeType)
                || getDolbyVisionContentType(videoElement, rangeType === 'DOVI' ? 5 : 8))) {
            detectedTypes.add(rangeType);
        }
    }

    return hdrVideoRangeTypes.filter((rangeType) => detectedTypes.has(rangeType));
}
