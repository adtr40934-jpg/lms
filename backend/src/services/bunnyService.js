const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const BUNNY_BYPASS_IPS = [
    process.env.BUNNY_API_IP,
    '169.150.236.103',
    '203.23.179.131',
    '203.23.179.87'
].filter(Boolean);

/**
 * Universal Bunny Stream API Caller that bypasses ISP SNI blocks
 * Automatically tries multiple edge router IPs with failover
 */
async function bunnyApiCall({ path, method = 'GET', headers = {}, body = null }) {
    let lastError = null;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;
    const reqHeaders = {
        'Host': 'video.bunnycdn.com',
        'AccessKey': apiKey,
        ...headers
    };

    let reqBody = body;
    if (reqBody && typeof reqBody === 'object' && !Buffer.isBuffer(reqBody)) {
        reqBody = JSON.stringify(reqBody);
        reqHeaders['Content-Type'] = 'application/json';
    }
    if (reqBody) {
        reqHeaders['Content-Length'] = Buffer.isBuffer(reqBody) ? reqBody.length : Buffer.byteLength(reqBody);
    }

    for (const ip of BUNNY_BYPASS_IPS) {
        try {
            const res = await new Promise((resolve, reject) => {
                const req = https.request({
                    host: ip,
                    port: 443,
                    path,
                    method,
                    headers: reqHeaders,
                    servername: 'video.bunnycdn.com',
                    rejectUnauthorized: true,
                    timeout: 8000
                }, (response) => {
                    const chunks = [];
                    response.on('data', chunk => chunks.push(chunk));
                    response.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        const text = buffer.toString('utf8');
                        let json = null;
                        try { json = JSON.parse(text); } catch (e) { }

                        resolve({
                            status: response.statusCode,
                            ok: response.statusCode >= 200 && response.statusCode < 300,
                            headers: response.headers,
                            text: () => Promise.resolve(text),
                            json: () => Promise.resolve(json || text),
                            buffer: () => Promise.resolve(buffer)
                        });
                    });
                });

                req.on('timeout', () => {
                    req.destroy(new Error(`Timeout connecting to Bunny IP ${ip}`));
                });
                req.on('error', (err) => {
                    reject(err);
                });

                if (reqBody) {
                    req.write(reqBody);
                }
                req.end();
            });

            return res;
        } catch (err) {
            lastError = err;
            console.warn(`Bunny IP ${ip} failed (${err.message}), trying next IP...`);
        }
    }

    throw lastError || new Error('فشل الاتصال بجميع سيرفرات Bunny Stream');
}

/**
 * Generate a signed Bunny Stream Embed Token URL
 * @param {string} videoId Bunny Video GUID
 * @param {number} expiresSeconds Token expiration time in seconds (default: 3600 = 1 hour)
 * @returns {string} Secure Signed Embed URL
 */
function getSignedEmbedUrl(videoId, expiresSeconds = 3600) {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const tokenKey = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY;
    const cdnHost = process.env.BUNNY_STREAM_CDN_URL || 'https://iframe.mediadelivery.net';

    if (!videoId) return '';

    // Clean videoId if passed as full URL
    let cleanId = videoId;
    if (cleanId.includes('/embed/')) {
        const parts = cleanId.split('/embed/')[1]?.split('?')[0]?.split('/');
        cleanId = parts ? parts[parts.length - 1] : cleanId;
    } else if (cleanId.includes('/')) {
        cleanId = cleanId.split('/').pop().split('?')[0];
    }

    if (!libraryId) {
        return `${cdnHost}/embed/${cleanId}`;
    }

    if (!tokenKey || tokenKey.includes('your_') || tokenKey.trim() === '' || tokenKey === 'none' || tokenKey === 'false') {
        return `${cdnHost}/embed/${libraryId}/${cleanId}?autoplay=false&preload=true&enablejsapi=true`;
    }

    const expires = Math.floor(Date.now() / 1000) + expiresSeconds;
    // Bunny Stream Token Auth SHA256 signature formula: tokenKey + videoId + expires
    const hashable = tokenKey + cleanId + expires;
    const token = crypto.createHash('sha256').update(hashable).digest('hex');

    return `${cdnHost}/embed/${libraryId}/${cleanId}?token=${token}&expires=${expires}&autoplay=false&preload=true&enablejsapi=true`;
}

/**
 * Get or Create a Bunny Stream Collection for a Course
 */
async function getOrCreateBunnyCollection(courseName, courseId) {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;

    if (!libraryId || !apiKey || !courseName || !courseId) return null;

    const collectionName = `${courseName} - ${courseId}`.trim();

    try {
        // 1. Search for existing collection via bypass
        const searchRes = await bunnyApiCall({
            path: `/library/${libraryId}/collections?search=${encodeURIComponent(collectionName)}`
        });

        if (searchRes.ok) {
            const searchData = await searchRes.json();
            const existing = searchData?.items?.find(c => c.name === collectionName);
            if (existing && existing.guid) {
                return existing.guid;
            }
        }

        // 2. Create new collection via bypass
        const createRes = await bunnyApiCall({
            path: `/library/${libraryId}/collections`,
            method: 'POST',
            body: { name: collectionName }
        });

        if (createRes.ok) {
            const createData = await createRes.json();
            return createData?.guid || null;
        }
    } catch (err) {
        console.error('Error managing Bunny Collection:', err.message);
    }

    return null;
}

/**
 * Upload video to Bunny Stream API
 * @param {string} title Video Title
 * @param {string|Buffer} filePathOrBuffer Absolute File Path or Buffer
 * @param {string} originalName Original filename
 * @returns {Promise<{videoId: string, embedUrl: string}>}
 */
async function uploadVideoToBunny(title, filePathOrBuffer, originalName = 'video.mp4') {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;

    if (!libraryId || !apiKey) {
        throw new Error('بيانات Bunny Stream غير مكتملة في ملف .env (BUNNY_STREAM_LIBRARY_ID و BUNNY_STREAM_API_KEY)');
    }

    const videoTitle = (title || originalName).trim();

    // 1. Create Video Object in Bunny Stream via bypass
    const createRes = await bunnyApiCall({
        path: `/library/${libraryId}/videos`,
        method: 'POST',
        body: { title: videoTitle }
    });

    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`فشل إنشاء كائن الفيديو في Bunny Stream: ${errText}`);
    }

    const createData = await createRes.json();
    const videoId = createData?.guid;
    if (!videoId) {
        throw new Error('فشل الحصول على معرّف الفيديو (guid) من Bunny Stream');
    }

    // 2. Upload Video Binary Data via bypass
    let fileBuffer;
    if (typeof filePathOrBuffer === 'string') {
        fileBuffer = fs.readFileSync(filePathOrBuffer);
    } else {
        fileBuffer = filePathOrBuffer;
    }

    const uploadRes = await bunnyApiCall({
        path: `/library/${libraryId}/videos/${videoId}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: fileBuffer
    });

    if (!uploadRes.ok) {
        const uploadErr = await uploadRes.text();
        throw new Error(`فشل رفع ملف الفيديو إلى Bunny Stream: ${uploadErr}`);
    }

    const embedUrl = getSignedEmbedUrl(videoId);

    return {
        videoId,
        embedUrl
    };
}

/**
 * Delete video from Bunny Stream Library
 * @param {string} videoId Bunny Video GUID
 */
async function deleteVideoFromBunny(videoId) {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;

    if (!libraryId || !apiKey || !videoId) return;

    let cleanId = videoId;
    if (cleanId.includes('/')) {
        cleanId = cleanId.split('/').pop().split('?')[0];
    }

    try {
        await bunnyApiCall({
            path: `/library/${libraryId}/videos/${cleanId}`,
            method: 'DELETE'
        });
    } catch (err) {
        console.error('فشل حذف الفيديو من Bunny Stream:', err.message);
    }
}

/**
 * Get Video Status & Transcoding Progress from Bunny Stream API
 * @param {string} videoId Bunny Video GUID
 */
async function getVideoStatusFromBunny(videoId) {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;

    if (!libraryId || !apiKey || !videoId) {
        return { status: 4, statusText: 'جاهز للعرض', isReady: true, encodeProgress: 100 };
    }

    let cleanId = videoId;
    if (cleanId.includes('/embed/')) {
        const parts = cleanId.split('/embed/')[1]?.split('?')[0]?.split('/');
        cleanId = parts ? parts[parts.length - 1] : cleanId;
    } else if (cleanId.includes('/')) {
        cleanId = cleanId.split('/').pop().split('?')[0];
    }

    try {
        const res = await bunnyApiCall({
            path: `/library/${libraryId}/videos/${cleanId}`
        });

        if (res.status === 404) {
            return { status: 404, statusText: 'الفيديو تم حذفه من حساب Bunny.net', isDeleted: true, isReady: false, encodeProgress: 0 };
        }
        if (!res.ok) {
            return { status: 4, statusText: 'جاهز للعرض', isReady: true, encodeProgress: 100 };
        }

        const data = await res.json();
        const statusCode = data.status ?? 4;
        const encodeProgress = data.encodeProgress ?? 100;

        let statusText = 'جاهز للعرض (Finished)';
        let isReady = false;

        switch (statusCode) {
            case 0:
                statusText = 'Created (تم إنشاء كائن الفيديو)';
                break;
            case 1:
                statusText = 'Uploading... (جاري الرفع إلى Bunny Stream)';
                break;
            case 2:
                statusText = 'Processing... (جاري التحضير للمعالجة)';
                break;
            case 3:
                statusText = `Transcoding... (${encodeProgress}%) — جاري المعالجة والترميز الرقمي`;
                break;
            case 4:
                statusText = '(الفيديو مكتمل)';
                isReady = true;
                break;
            case 5:
                statusText = 'Error (حدث خطأ في معالجة الفيديو في Bunny)';
                break;
            default:
                statusText = 'Finished (جاهز للعرض)';
                isReady = true;
        }

        return {
            status: statusCode,
            statusText,
            encodeProgress,
            isReady,
            views: data.views || 0,
            width: data.width,
            height: data.height,
            length: data.length
        };
    } catch (err) {
        return { status: 4, statusText: 'جاهز للعرض', isReady: true, encodeProgress: 100 };
    }
}

module.exports = {
    getSignedEmbedUrl,
    uploadVideoToBunny,
    deleteVideoFromBunny,
    getVideoStatusFromBunny,
    getOrCreateBunnyCollection,
    bunnyApiCall,
    BUNNY_BYPASS_IPS
};
