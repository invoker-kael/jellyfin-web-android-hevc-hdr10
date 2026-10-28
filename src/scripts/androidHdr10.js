const hevcMain10CodecStrings = [
    'hvc1.2.4.L123',
    'hev1.2.4.L123'
];

export const androidHdrVideoRangeTypes = [
    'HDR10',
    'HLG',
    'DOVI',
    'DOVIWithHDR10',
    'DOVIWithHLG',
    'DOVIWithSDR'
];

export const androidHdrVideoRangeServerSettings = {
    HDR10: 'EnableAndroidHdr10AutoDetection',
    HLG: 'EnableAndroidHlgAutoDetection',
    DOVI: 'EnableAndroidDolbyVisionAutoDetection',
    DOVIWithHDR10: 'EnableAndroidDolbyVisionWithHdr10AutoDetection',
    DOVIWithHLG: 'EnableAndroidDolbyVisionWithHlgAutoDetection',
    DOVIWithSDR: 'EnableAndroidDolbyVisionWithSdrAutoDetection'
};

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
    serverAutoDetection = {},
    clientOverrides = {}
}) {
    if (!isAndroidMobileHevcClient(browser)) {
        return [];
    }

    const main10ContentType = getHevcMain10ContentType(videoElement);
    if (!main10ContentType) {
        return [];
    }

    const automaticTypes = new Set();
    const highDynamicRangeDisplay = supportsHighDynamicRangeDisplay(matchMedia);
    const isServerAutoDetectionEnabled = rangeType => serverAutoDetection?.[rangeType] === true;

    if (androidHdrVideoRangeTypes.some(isServerAutoDetectionEnabled)) {
        const shouldDetectHdr10 = isServerAutoDetectionEnabled('HDR10') || isServerAutoDetectionEnabled('DOVIWithHDR10');
        const shouldDetectHlg = isServerAutoDetectionEnabled('HLG') || isServerAutoDetectionEnabled('DOVIWithHLG');
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
            if (isServerAutoDetectionEnabled('HDR10') && hdr10Supported) {
                automaticTypes.add('HDR10');
            }
            if (isServerAutoDetectionEnabled('HLG') && hlgSupported) {
                automaticTypes.add('HLG');
            }
        }

        const detectDolbyVisionProfile5 = isServerAutoDetectionEnabled('DOVI');
        const detectDolbyVisionProfile8 = ['DOVIWithHDR10', 'DOVIWithHLG', 'DOVIWithSDR'].some(isServerAutoDetectionEnabled);
        const dolbyVisionProfile5 = detectDolbyVisionProfile5 ? getDolbyVisionContentType(videoElement, 5) : null;
        const dolbyVisionProfile8 = detectDolbyVisionProfile8 ? getDolbyVisionContentType(videoElement, 8) : null;
        const [dolbyVisionProfile5Supported, profile8Supported] = await Promise.all([
            detectDolbyVisionProfile5 ? supportsDecoding(mediaCapabilities, dolbyVisionProfile5) : Promise.resolve(false),
            detectDolbyVisionProfile8 ? supportsDecoding(mediaCapabilities, dolbyVisionProfile8) : Promise.resolve(false)
        ]);

        if (isServerAutoDetectionEnabled('DOVI') && highDynamicRangeDisplay && dolbyVisionProfile5Supported) {
            automaticTypes.add('DOVI');
        }
        if (isServerAutoDetectionEnabled('DOVIWithSDR') && profile8Supported) {
            automaticTypes.add('DOVIWithSDR');
        }
        if (isServerAutoDetectionEnabled('DOVIWithHDR10') && highDynamicRangeDisplay && profile8Supported && hdr10Supported) {
            automaticTypes.add('DOVIWithHDR10');
        }
        if (isServerAutoDetectionEnabled('DOVIWithHLG') && highDynamicRangeDisplay && profile8Supported && hlgSupported) {
            automaticTypes.add('DOVIWithHLG');
        }
    }

    for (const rangeType of androidHdrVideoRangeTypes) {
        const override = clientOverrides?.[rangeType];
        if (override === false) {
            automaticTypes.delete(rangeType);
        } else if (override === true
            && (!dolbyVisionRangeTypes.has(rangeType)
                || getDolbyVisionContentType(videoElement, rangeType === 'DOVI' ? 5 : 8))) {
            automaticTypes.add(rangeType);
        }
    }

    return androidHdrVideoRangeTypes.filter((rangeType) => automaticTypes.has(rangeType));
}
