const Lesson = require('../models/Lesson');
const Section = require('../models/Section');
const path = require('path');
const fs = require('fs');
const { uploadVideoToBunny, deleteVideoFromBunny, getSignedEmbedUrl, getVideoStatusFromBunny } = require('../services/bunnyService');

function deleteFile(filePath) {
    if (!filePath) return;
    const abs = path.join(__dirname, '..', '..', filePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
}

// GET /api/admin/lessons/bunny-status/:videoId
exports.getBunnyStatus = async (req, res) => {
    try {
        const { videoId } = req.params;
        const statusData = await getVideoStatusFromBunny(videoId);
        if (statusData && statusData.length > 0) {
            const totalSeconds = Math.round(statusData.length);
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            const fmt = h > 0
                ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                : `${m}:${s.toString().padStart(2, '0')}`;
            const lesson = await Lesson.findOne({ bunny_video_id: videoId });
            if (lesson && (!lesson.duration || lesson.duration === '00:00' || lesson.duration === '0:00')) {
                lesson.duration = fmt;
                await lesson.save();
            }
        }
        res.json(statusData);
    } catch (err) {
        res.status(500).json({ status: 4, statusText: 'جاهز للعرض', isReady: true, encodeProgress: 100 });
    }
};

// POST /api/admin/lessons/bunny-prepare
// Creates a Bunny video object — returns ONLY videoId (API key stays on server)
exports.bunnyPrepare = async (req, res) => {
    try {
        const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
        const apiKey = process.env.BUNNY_STREAM_API_KEY;

        if (!libraryId || !apiKey) {
            return res.status(400).json({ message: 'Bunny Stream غير مفعّل في ملف .env' });
        }

        const { title, courseName, courseId } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'أرسل عنوان الفيديو' });
        }

        const { getOrCreateBunnyCollection, bunnyApiCall } = require('../services/bunnyService');
        let collectionId = null;
        if (courseName && courseId) {
            collectionId = await getOrCreateBunnyCollection(courseName, courseId);
        }

        const payload = { title: title.trim() };
        if (collectionId) {
            payload.collectionId = collectionId;
        }

        // Create video object on Bunny via ISP bypass
        const createRes = await bunnyApiCall({
            path: `/library/${libraryId}/videos`,
            method: 'POST',
            body: payload
        });

        if (!createRes.ok) {
            const errText = await createRes.text();
            return res.status(500).json({ message: `فشل إنشاء كائن الفيديو: ${errText}` });
        }

        const data = await createRes.json();
        const videoId = data?.guid;
        if (!videoId) {
            return res.status(500).json({ message: 'فشل الحصول على معرّف الفيديو من Bunny' });
        }

        // ✅ Generate TUS Resumable Upload Signature (صلاحية 24 ساعة)
        const crypto = require('crypto');
        const expiration = Math.floor(Date.now() / 1000) + (24 * 3600);
        const signatureData = `${libraryId}${apiKey}${expiration}${videoId}`;
        const signature = crypto.createHash('sha256').update(signatureData).digest('hex');

        // Note: Client connects to local backend TUS proxy to completely avoid ISP blocks
        const host = req.get('host') || 'localhost:5000';
        const tusEndpoint = `${req.protocol}://${host}/api/courses/admin/lessons/tusupload`;

        res.json({
            videoId,
            libraryId,
            signature,
            expiration,
            tusEndpoint,
            embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`
        });
    } catch (err) {
        console.error('bunnyPrepare error:', err);
        res.status(500).json({ message: 'حدث خطأ في تحضير الرفع: ' + err.message });
    }
};

// DELETE /api/courses/admin/lessons/bunny-cancel/:videoId
exports.bunnyCancel = async (req, res) => {
    try {
        const { videoId } = req.params;
        if (videoId) {
            await deleteVideoFromBunny(videoId);
        }
        res.json({ success: true, message: 'تم إلغاء الرفع بنجاح' });
    } catch (err) {
        console.error('bunnyCancel error:', err);
        res.status(500).json({ success: false, message: 'فشل إلغاء الرفع' });
    }
};

const https = require('https');

// TUS Resumable Upload Proxy — forwards browser TUS requests directly to Bunny via bypass IP
exports.tusProxy = (req, res) => {
    if (!['POST', 'PATCH', 'HEAD', 'DELETE'].includes(req.method)) {
        return res.status(405).json({ message: 'طريقة الطلب غير مدعومة' });
    }
    let pathname;
    try { pathname = new URL(req.originalUrl || req.url, 'http://localhost').pathname; }
    catch { return res.status(400).json({ message: 'مسار الرفع غير صالح' }); }
    const marker = '/tusupload';
    const idx = pathname.indexOf(marker);
    if (idx !== -1) {
        pathname = pathname.substring(idx + marker.length);
    } else {
        pathname = '';
    }
    if (pathname.length > 1024 || !/^(?:\/[A-Za-z0-9/_-]*)?$/.test(pathname) || pathname.includes('..')) {
        return res.status(400).json({ message: 'مسار الرفع غير صالح' });
    }
    const targetPath = '/tusupload' + pathname;

    const forwardedHeaderNames = new Set([
        'accept', 'content-type', 'content-length', 'tus-resumable', 'tus-version', 'tus-extension',
        'upload-offset', 'upload-length', 'upload-metadata', 'upload-defer-length', 'upload-concat',
        'upload-checksum', 'authorization-signature', 'authorization-expire', 'authorizationsignature',
        'authorizationexpire', 'libraryid', 'videoid'
    ]);
    const headers = Object.fromEntries(Object.entries(req.headers)
        .filter(([name]) => forwardedHeaderNames.has(name.toLowerCase())));
    headers.host = 'video.bunnycdn.com';

    const { BUNNY_BYPASS_IPS } = require('../services/bunnyService');
    const bypassIp = process.env.BUNNY_API_IP || (BUNNY_BYPASS_IPS && BUNNY_BYPASS_IPS[0]) || '169.150.236.103';

    const clientReq = https.request({
        host: bypassIp,
        port: 443,
        path: targetPath,
        method: req.method,
        headers,
        servername: 'video.bunnycdn.com',
        rejectUnauthorized: true
    }, (clientRes) => {
        const resHeaders = { ...clientRes.headers };
        for (const header of Object.keys(resHeaders)) {
            if (header.toLowerCase().startsWith('access-control-') || header.toLowerCase() === 'set-cookie') delete resHeaders[header];
        }

        if (resHeaders['location']) {
            const loc = resHeaders['location'];
            const locSub = loc.replace(/^https?:\/\/[^\/]+/, '').replace('/tusupload', '');
            const currentHost = req.get('host') || 'localhost:5000';
            resHeaders['location'] = `${req.protocol}://${currentHost}/api/courses/admin/lessons/tusupload${locSub}`;
        }

        res.writeHead(clientRes.statusCode, resHeaders);
        clientRes.pipe(res);
    });

    clientReq.on('error', (err) => {
        console.error('TUS Proxy error:', err.message);
        if (!res.headersSent) {
            res.status(502).json({ message: 'فشل الاتصال بسيرفر الرفع' });
        }
    });

    req.pipe(clientReq);
};

exports.bunnyStreamUpload = (req, res) => {
    const { videoId } = req.params;
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;

    if (!libraryId || !apiKey || !videoId) {
        return res.status(400).json({ message: 'بيانات غير مكتملة' });
    }

    const options = {
        host: process.env.BUNNY_API_IP || '203.23.179.87',
        port: 443,
        path: `/library/${libraryId}/videos/${videoId}`,
        method: 'PUT',
        headers: {
            'Host': 'video.bunnycdn.com',
            'AccessKey': apiKey,
            'Content-Type': 'application/octet-stream'
        },
        servername: 'video.bunnycdn.com',
        rejectUnauthorized: true
    };

    if (req.headers['content-length']) {
        options.headers['Content-Length'] = req.headers['content-length'];
    }

    const bunnyReq = https.request(options, (bunnyRes) => {
        let responseBody = '';
        bunnyRes.on('data', chunk => responseBody += chunk);
        bunnyRes.on('end', () => {
            if (bunnyRes.statusCode >= 200 && bunnyRes.statusCode < 300) {
                if (!res.headersSent) res.json({ success: true, videoId });
            } else {
                console.error(`Bunny upload failed: ${bunnyRes.statusCode} - ${responseBody}`);
                if (!res.headersSent) res.status(500).json({ message: `فشل الرفع لـ Bunny: ${responseBody}` });
            }
        });
    });

    bunnyReq.on('error', (err) => {
        console.error('bunnyStreamUpload req error:', err);
        if (!res.headersSent) res.status(500).json({ message: 'حدث خطأ أثناء الرفع: ' + err.message });
    });

    req.pipe(bunnyReq);
};

// GET /api/admin/lessons/:id
exports.show = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id).lean();
        if (!lesson) return res.status(404).json({ message: 'المحاضرة غير موجودة' });
        if (lesson.bunny_video_id) {
            lesson.embed_url = getSignedEmbedUrl(lesson.bunny_video_id);
        }
        res.json({ lesson });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

function extractBunnyGuid(url) {
    if (!url) return '';
    if (url.includes('/embed/')) {
        const parts = url.split('/embed/')[1]?.split('?')[0]?.split('/');
        return parts ? parts[parts.length - 1] : '';
    }
    if (url.includes('mediadelivery.net') || url.includes('bunnycdn.com')) {
        const parts = url.split('?')[0].split('/');
        return parts.pop() || '';
    }
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(url.trim())) {
        return url.trim();
    }
    return '';
}

// POST /api/admin/lessons
exports.create = async (req, res) => {
    try {
        const { courseId, sectionId, title, description, video_url, duration, is_preview, sort_order, bunny_video_id } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ message: 'اكتب عنوان المحاضرة' });
        if (!sectionId || sectionId === 'null' || sectionId === 'undefined') {
            return res.status(400).json({ message: 'يجب اختيار أو إنشاء قسم (سيكشن) للمحاضرة أولاً' });
        }

        const max = await Lesson.find({ section: sectionId }).sort({ sort_order: -1 }).limit(1).lean();
        const order = sort_order || (max.length ? max[0].sort_order + 1 : 1);

        let video_file = '';
        let createdBunnyId = bunny_video_id || extractBunnyGuid(video_url);

        // If a file is uploaded, prioritize the file and upload to Bunny
        if (req.files && req.files.video_file && req.files.video_file[0]) {
            const uploadedFile = req.files.video_file[0];
            video_file = 'uploads/videos/' + uploadedFile.filename;
            const fullLocalPath = path.join(__dirname, '..', '..', video_file);

            if (process.env.BUNNY_STREAM_LIBRARY_ID && process.env.BUNNY_STREAM_API_KEY) {
                try {
                    const bunnyRes = await uploadVideoToBunny(title, fullLocalPath, uploadedFile.originalname);
                    createdBunnyId = bunnyRes.videoId;
                } catch (bunnyErr) {
                    console.error('Bunny Upload Error:', bunnyErr.message);
                }
            }
        }

        let assetsArray = [];
        if (req.body.assets) {
            try { assetsArray = JSON.parse(req.body.assets); } catch (e) { }
        }

        const lesson = await Lesson.create({
            course: courseId, section: sectionId,
            title: title.trim(), description: description || '',
            video_url: video_url || '', video_file,
            bunny_video_id: createdBunnyId,
            duration: duration || '',
            is_preview: is_preview === 'true' || is_preview === true,
            sort_order: order,
            assets: assetsArray
        });

        // مزامنة مدة الكورس تلقائياً من الفيديوهات
        const { syncCourseDuration } = require('../utils/durationHelper');
        await syncCourseDuration(courseId);

        const lessonObj = lesson.toObject();
        if (lessonObj.bunny_video_id) {
            lessonObj.embed_url = getSignedEmbedUrl(lessonObj.bunny_video_id);
        }

        res.status(201).json({ message: 'تم إضافة المحاضرة', lesson: lessonObj });
    } catch (err) {
        console.error('Lesson create error:', err);
        res.status(500).json({ message: err.message || 'حدث خطأ أثناء إضافة المحاضرة' });
    }
};

// PUT /api/admin/lessons/:id
exports.update = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) return res.status(404).json({ message: 'المحاضرة غير موجودة' });

        const fields = ['title', 'description', 'video_url', 'duration', 'sort_order', 'section', 'bunny_video_id'];
        fields.forEach(f => { if (req.body[f] !== undefined) lesson[f] = req.body[f]; });

        // Handle checkbox which is omitted from FormData if unchecked
        lesson.is_preview = req.body.is_preview === 'true' || req.body.is_preview === true;

        if (req.body.assets) {
            try { lesson.assets = JSON.parse(req.body.assets); } catch (e) { }
        }

        // If a file is uploaded, prioritize the file and upload to Bunny
        if (req.files && req.files.video_file && req.files.video_file[0]) {
            deleteFile(lesson.video_file);
            const uploadedFile = req.files.video_file[0];
            lesson.video_file = 'uploads/videos/' + uploadedFile.filename;
            const fullLocalPath = path.join(__dirname, '..', '..', lesson.video_file);

            if (process.env.BUNNY_STREAM_LIBRARY_ID && process.env.BUNNY_STREAM_API_KEY) {
                try {
                    if (lesson.bunny_video_id) {
                        await deleteVideoFromBunny(lesson.bunny_video_id);
                    }
                    const bunnyRes = await uploadVideoToBunny(lesson.title, fullLocalPath, uploadedFile.originalname);
                    lesson.bunny_video_id = bunnyRes.videoId;
                } catch (bunnyErr) {
                    console.error('Bunny Upload Error on update:', bunnyErr.message);
                }
            }
        } else if (req.body.video_url !== undefined) {
            // If no new file uploaded, check if video_url has a Bunny GUID
            const guid = extractBunnyGuid(req.body.video_url);
            if (guid) {
                lesson.bunny_video_id = guid;
            } else if (!req.body.video_url) {
                lesson.bunny_video_id = '';
            }
        }

        if (req.body.remove_video === 'true') {
            deleteFile(lesson.video_file);
            if (lesson.bunny_video_id) {
                await deleteVideoFromBunny(lesson.bunny_video_id);
                lesson.bunny_video_id = '';
            }
            lesson.video_file = '';
            lesson.video_url = '';
        }

        await lesson.save();

        // مزامنة مدة الكورس تلقائياً من الفيديوهات
        const { syncCourseDuration } = require('../utils/durationHelper');
        await syncCourseDuration(lesson.course);

        const lessonObj = lesson.toObject();
        if (lessonObj.bunny_video_id) {
            lessonObj.embed_url = getSignedEmbedUrl(lessonObj.bunny_video_id);
        }

        res.json({ message: 'تم حفظ المحاضرة', lesson: lessonObj });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// DELETE /api/admin/lessons/:id
exports.remove = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) return res.status(404).json({ message: 'المحاضرة غير موجودة' });
        deleteFile(lesson.video_file);
        if (lesson.bunny_video_id) {
            await deleteVideoFromBunny(lesson.bunny_video_id);
        }
        const courseId = lesson.course;
        await lesson.deleteOne();

        // مزامنة مدة الكورس تلقائياً من الفيديوهات بعد حذف المحاضرة
        const { syncCourseDuration } = require('../utils/durationHelper');
        await syncCourseDuration(courseId);

        res.json({ message: 'تم حذف المحاضرة' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};

// PATCH /api/admin/lessons/:id/reorder
exports.reorder = async (req, res) => {
    try {
        const { sectionId, ids } = req.body; // ids: ordered array
        if (!Array.isArray(ids)) return res.status(400).json({ message: 'أرسل مصفوفة IDs' });
        await Promise.all(ids.map((id, i) => Lesson.findByIdAndUpdate(id, { sort_order: i + 1 })));
        res.json({ message: 'تم ترتيب المحاضرات' });
    } catch (err) {
        console.error('Reorder error:', err);
        res.status(500).json({ message: 'حدث خطأ' });
    }
};
