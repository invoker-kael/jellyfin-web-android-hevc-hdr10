export const hdrVideoRangeTypes = [
    'HDR10',
    'HDR10Plus',
    'HLG',
    'DOVI',
    'DOVIWithHDR10',
    'DOVIWithHDR10Plus',
    'DOVIWithHLG',
    'DOVIWithSDR',
    'DOVIWithEL',
    'DOVIWithELHDR10Plus',
    'DOVIInvalid'
];

export const hdrVideoRangeServerSettings = {
    HDR10: 'EnableAndroidHdr10AutoDetection',
    HDR10Plus: 'EnableHdr10Plus',
    HLG: 'EnableAndroidHlgAutoDetection',
    DOVI: 'EnableAndroidDolbyVisionAutoDetection',
    DOVIWithHDR10: 'EnableAndroidDolbyVisionWithHdr10AutoDetection',
    DOVIWithHDR10Plus: 'EnableDolbyVisionWithHdr10Plus',
    DOVIWithHLG: 'EnableAndroidDolbyVisionWithHlgAutoDetection',
    DOVIWithSDR: 'EnableAndroidDolbyVisionWithSdrAutoDetection',
    DOVIWithEL: 'EnableDolbyVisionWithEnhancementLayer',
    DOVIWithELHDR10Plus: 'EnableDolbyVisionWithEnhancementLayerAndHdr10Plus',
    DOVIInvalid: 'EnableDolbyVisionInvalid'
};

export const hdrVideoRangeLabels = {
    HDR10: 'HdrRangeHDR10',
    HDR10Plus: 'HdrRangeHDR10Plus',
    HLG: 'HdrRangeHLG',
    DOVI: 'HdrRangeDolbyVision',
    DOVIWithHDR10: 'HdrRangeDolbyVisionHDR10',
    DOVIWithHDR10Plus: 'HdrRangeDolbyVisionHDR10Plus',
    DOVIWithHLG: 'HdrRangeDolbyVisionHLG',
    DOVIWithSDR: 'HdrRangeDolbyVisionSDR',
    DOVIWithEL: 'HdrRangeDolbyVisionEnhancementLayer',
    DOVIWithELHDR10Plus: 'HdrRangeDolbyVisionEnhancementLayerHDR10Plus',
    DOVIInvalid: 'HdrRangeDolbyVisionInvalid'
};

const hevcMain10CodecStrings = [
    'hvc1.2.4.L123',
    'hev1.2.4.L123',
    'hvc1.2.4.L153',
    'hev1.2.4.L153'
];

const hevcMainCodecStrings = [
    'hvc1.1.L120',
    'hev1.1.L120',
    'hvc1.1.0.L120',
    'hev1.1.0.L120'
];

const decodingParameters = {
    width: 3840,
    height: 2160,
    bitrate: 18000000,
    framerate: 24
};

function canPlayType(videoElement, contentType) {
    if (typeof videoElement?.canPlayType !== 'function') {
        return false;
    }

    try {
        return !!videoElement.canPlayType(contentType).replace(/no/, '');
    } catch {
        return false;
    }
}

export function getHevcMain10ContentType(videoElement) {
    for (const codecString of hevcMain10CodecStrings) {
        const contentType = `video/mp4; codecs="${codecString}"`;
        if (canPlayType(videoElement, contentType)) {
            return contentType;
        }
    }

    return null;
}

export function canPlayHevcMain10InMediaSource(videoElement, mediaSource) {
    if (typeof mediaSource?.isTypeSupported !== 'function') {
        return false;
    }

    return hevcMain10CodecStrings.some(codecString => {
        const contentType = `video/mp4; codecs="${codecString}"`;
        if (!canPlayType(videoElement, contentType)) {
            return false;
        }

        try {
            return mediaSource.isTypeSupported(contentType) === true;
        } catch {
            return false;
        }
    });
}

export function canPlayHevcInMediaSource(videoElement, mediaSource) {
    if (typeof mediaSource?.isTypeSupported !== 'function') {
        return false;
    }

    return hevcMainCodecStrings.some(codecString => {
        const contentType = `video/mp4; codecs="${codecString}"`;
        if (!canPlayType(videoElement, contentType)) {
            return false;
        }

        try {
            return mediaSource.isTypeSupported(contentType) === true;
        } catch {
            return false;
        }
    });
}

export function getHdrVideoRangePolicy(serverConfiguration = {}, clientOverrides = {}) {
    return Object.fromEntries(hdrVideoRangeTypes.map(rangeType => {
        const serverSetting = hdrVideoRangeServerSettings[rangeType];
        const serverEnabled = serverConfiguration?.[serverSetting] !== false;
        const clientOverride = clientOverrides?.[rangeType];
        return [rangeType, typeof clientOverride === 'boolean' ? clientOverride : serverEnabled];
    }));
}

export function isAndroidMobileHevcClient(browser, nativeShell = false) {
    return !!(browser?.android
        && (browser?.chrome || nativeShell)
        && browser?.mobile
        && !browser?.tv);
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

function getDolbyVisionContentType(videoElement, profile) {
    const profileString = String(profile).padStart(2, '0');
    for (const sampleEntry of [ 'dvh1', 'dvhe' ]) {
        const contentType = `video/mp4; codecs="${sampleEntry}.${profileString}.06"`;
        if (canPlayType(videoElement, contentType)) {
            return contentType;
        }
    }

    return null;
}

function isRangeEnabled(rangeType, serverConfiguration, clientOverrides) {
    if (clientOverrides?.[rangeType] === false) {
        return false;
    }

    if (clientOverrides?.[rangeType] === true) {
        return true;
    }

    return serverConfiguration?.[hdrVideoRangeServerSettings[rangeType]] !== false;
}

export async function getAndroidHdrVideoRangeTypes({
    browser,
    videoElement,
    mediaSource,
    mediaCapabilities,
    matchMedia,
    serverConfiguration = {},
    clientOverrides = {}
}) {
    if (!isAndroidMobileHevcClient(browser, typeof window !== 'undefined' && !!window.NativeShell)) {
        return [];
    }

    const main10ContentType = getHevcMain10ContentType(videoElement);
    if (!main10ContentType || !canPlayHevcMain10InMediaSource(videoElement, mediaSource)) {
        return [];
    }

    const displaySupportsHdr = supportsHighDynamicRangeDisplay(matchMedia);
    const detectedTypes = new Set();
    const enabled = rangeType => isRangeEnabled(rangeType, serverConfiguration, clientOverrides);
    const hdr10Enabled = enabled('HDR10') || enabled('HDR10Plus') || enabled('DOVIWithHDR10') || enabled('DOVIWithHDR10Plus');
    const hlgEnabled = enabled('HLG') || enabled('DOVIWithHLG');

    const [ hdr10Supported, hlgSupported, hdr10PlusSupported ] = await Promise.all([
        hdr10Enabled && displaySupportsHdr ? supportsDecoding(mediaCapabilities, main10ContentType, {
            colorGamut: 'rec2020',
            transferFunction: 'pq',
            hdrMetadataType: 'smpteSt2086'
        }) : Promise.resolve(false),
        hlgEnabled && displaySupportsHdr ? supportsDecoding(mediaCapabilities, main10ContentType, {
            colorGamut: 'rec2020',
            transferFunction: 'hlg'
        }) : Promise.resolve(false),
        enabled('HDR10Plus') && displaySupportsHdr ? supportsDecoding(mediaCapabilities, main10ContentType, {
            colorGamut: 'rec2020',
            transferFunction: 'pq',
            hdrMetadataType: 'smpteSt2094-40'
        }) : Promise.resolve(false)
    ]);

    if (hdr10Supported && enabled('HDR10')) {
        detectedTypes.add('HDR10');
    }
    if (hlgSupported && enabled('HLG')) {
        detectedTypes.add('HLG');
    }
    if (hdr10PlusSupported && enabled('HDR10Plus')) {
        detectedTypes.add('HDR10Plus');
    }

    const doviProfile5 = enabled('DOVI') ? getDolbyVisionContentType(videoElement, 5) : null;
    const doviProfile8 = [ 'DOVIWithHDR10', 'DOVIWithHDR10Plus', 'DOVIWithHLG', 'DOVIWithSDR' ]
        .some(enabled) ? getDolbyVisionContentType(videoElement, 8) : null;
    const [ dovi5Supported, dovi8Supported ] = await Promise.all([
        supportsDecoding(mediaCapabilities, doviProfile5),
        supportsDecoding(mediaCapabilities, doviProfile8)
    ]);

    if (dovi5Supported && displaySupportsHdr && enabled('DOVI')) {
        detectedTypes.add('DOVI');
    }
    if (dovi8Supported && enabled('DOVIWithSDR')) {
        detectedTypes.add('DOVIWithSDR');
    }
    if (dovi8Supported && hdr10Supported && displaySupportsHdr && enabled('DOVIWithHDR10')) {
        detectedTypes.add('DOVIWithHDR10');
    }
    if (dovi8Supported && hlgSupported && displaySupportsHdr && enabled('DOVIWithHLG')) {
        detectedTypes.add('DOVIWithHLG');
    }
    if (dovi8Supported && hdr10PlusSupported && displaySupportsHdr && enabled('DOVIWithHDR10Plus')) {
        detectedTypes.add('DOVIWithHDR10Plus');
    }

    return hdrVideoRangeTypes.filter(rangeType => detectedTypes.has(rangeType));
}
