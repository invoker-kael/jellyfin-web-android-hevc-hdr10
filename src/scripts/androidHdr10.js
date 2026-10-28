const hevcMain10CodecStrings = [
    'hvc1.2.4.L123',
    'hev1.2.4.L123'
];

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

export async function supportsAndroidHdr10({
    browser,
    videoElement,
    mediaCapabilities,
    matchMedia,
    serverAutoDetectionEnabled = true,
    clientOverride = null
}) {
    if (!isAndroidMobileHevcClient(browser)) {
        return false;
    }

    const contentType = getHevcMain10ContentType(videoElement);
    if (!contentType) {
        return false;
    }

    if (clientOverride === false) {
        return false;
    }

    if (clientOverride === true) {
        return true;
    }

    if (serverAutoDetectionEnabled !== true) {
        return false;
    }

    let mediaCapabilitiesSupported = false;
    try {
        if (typeof mediaCapabilities?.decodingInfo === 'function') {
            const result = await mediaCapabilities.decodingInfo({
                type: 'file',
                video: {
                    contentType,
                    width: 1920,
                    height: 1080,
                    bitrate: 10000000,
                    framerate: 30,
                    colorGamut: 'rec2020',
                    transferFunction: 'pq',
                    hdrMetadataType: 'smpteSt2086'
                }
            });
            mediaCapabilitiesSupported = result?.supported === true;
        }
    } catch {
        // Keep automatic HDR support disabled when the capability query is inconclusive.
    }

    if (mediaCapabilitiesSupported && supportsHighDynamicRangeDisplay(matchMedia)) {
        return true;
    }

    return false;
}
