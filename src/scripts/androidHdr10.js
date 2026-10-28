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
    serverAutoDetectionEnabled = true,
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

    if (serverAutoDetectionEnabled === true) {
        const [hdr10Supported, hlgSupported] = await Promise.all([
            supportsDecoding(mediaCapabilities, main10ContentType, {
                colorGamut: 'rec2020',
                transferFunction: 'pq',
                hdrMetadataType: 'smpteSt2086'
            }),
            supportsDecoding(mediaCapabilities, main10ContentType, {
                colorGamut: 'rec2020',
                transferFunction: 'hlg'
            })
        ]);

        if (highDynamicRangeDisplay) {
            if (hdr10Supported) {
                automaticTypes.add('HDR10');
            }
            if (hlgSupported) {
                automaticTypes.add('HLG');
            }
        }

        const dolbyVisionProfile5 = getDolbyVisionContentType(videoElement, 5);
        const dolbyVisionProfile8 = getDolbyVisionContentType(videoElement, 8);
        const [dolbyVisionProfile5Supported, profile8Supported] = await Promise.all([
            supportsDecoding(mediaCapabilities, dolbyVisionProfile5),
            supportsDecoding(mediaCapabilities, dolbyVisionProfile8)
        ]);

        if (highDynamicRangeDisplay && dolbyVisionProfile5Supported) {
            automaticTypes.add('DOVI');
        }
        if (profile8Supported) {
            automaticTypes.add('DOVIWithSDR');
            if (highDynamicRangeDisplay && hdr10Supported) {
                automaticTypes.add('DOVIWithHDR10');
            }
            if (highDynamicRangeDisplay && hlgSupported) {
                automaticTypes.add('DOVIWithHLG');
            }
        }
    }

    for (const rangeType of androidHdrVideoRangeTypes) {
        const override = clientOverrides?.[rangeType];
        if (override === false) {
            automaticTypes.delete(rangeType);
        } else if (override === true) {
            if (!dolbyVisionRangeTypes.has(rangeType)
                || (rangeType === 'DOVI' && getDolbyVisionContentType(videoElement, 5))
                || (rangeType !== 'DOVI' && getDolbyVisionContentType(videoElement, 8))) {
                automaticTypes.add(rangeType);
            }
        }
    }

    return androidHdrVideoRangeTypes.filter((rangeType) => automaticTypes.has(rangeType));
}
