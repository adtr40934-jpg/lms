const multer = require('multer');
const path = require('path');
const fs = require('fs');

// -- original proof upload (kept for backward compat) --
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    allowedTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only images are allowed'), false);
};

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });
module.exports = upload;

function makeStorage(folder) {
    const dir = path.join(__dirname, '..', '..', 'uploads', folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return multer.diskStorage({
        destination: (_, __, cb) => cb(null, dir),
        filename: (_, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, Date.now() + '_' + Math.random().toString(36).slice(2) + ext);
        }
    });
}

const imgFilter = (_, file, cb) =>
    /\.(jpg|jpeg|png|webp|gif)$/i.test(file.originalname) ? cb(null, true) : cb(new Error('الملف لازم يكون صورة'));

const vidFilter = (_, file, cb) =>
    /\.(mp4|webm|mov|m4v)$/i.test(file.originalname) ? cb(null, true) : cb(new Error('الملف لازم يكون فيديو'));

const attFilter = (_, file, cb) =>
    /\.(pdf|zip|rar|docx|xlsx|pptx|png|jpg|jpeg)$/i.test(file.originalname) ? cb(null, true) : cb(new Error('نوع الملف غير مدعوم'));

module.exports.uploadImage = (field) =>
    multer({ storage: makeStorage('images'), fileFilter: imgFilter, limits: { fileSize: 6 * 1024 * 1024 } }).single(field);

module.exports.uploadTrackImage = () =>
    multer({ storage: makeStorage('images'), fileFilter: imgFilter, limits: { fileSize: 10 * 1024 * 1024 } }).single('image');

module.exports.uploadTrackFiles = () =>
    multer({ storage: makeStorage('images'), fileFilter: imgFilter, limits: { fileSize: 10 * 1024 * 1024 } }).fields([
        { name: 'image', maxCount: 1 },
        { name: 'instructor_signature', maxCount: 1 },
        { name: 'certificate_logo', maxCount: 1 }
    ]);

module.exports.uploadCourseFiles = () =>
    multer({ storage: makeStorage('images'), fileFilter: imgFilter, limits: { fileSize: 6 * 1024 * 1024 } }).fields([
        { name: 'image', maxCount: 1 },
        { name: 'instructor_signature', maxCount: 1 },
        { name: 'certificate_logo', maxCount: 1 }
    ]);

module.exports.uploadSettingsImages = () =>
    multer({ storage: makeStorage('images'), fileFilter: imgFilter, limits: { fileSize: 6 * 1024 * 1024 } }).fields([
        { name: 'trainer_image', maxCount: 1 },
        { name: 'site_logo', maxCount: 1 },
        { name: 'certificate_default_logo', maxCount: 1 },
        { name: 'certificate_default_signature', maxCount: 1 }
    ]);

module.exports.uploadTrainerCertificateFiles = () =>
    multer({ storage: makeStorage('images'), fileFilter: imgFilter, limits: { fileSize: 10 * 1024 * 1024 } }).any();

module.exports.uploadVideo = (field) =>
    multer({ storage: makeStorage('videos'), fileFilter: vidFilter, limits: { fileSize: 2048 * 1024 * 1024 } }).single(field);

module.exports.uploadAttachment = (field) =>
    multer({ storage: makeStorage('files'), fileFilter: attFilter, limits: { fileSize: 100 * 1024 * 1024 } }).single(field);

const proofFilter = (_, file, cb) =>
    /\.(jpg|jpeg|png)$/i.test(file.originalname) ? cb(null, true) : cb(new Error('صورة الإثبات يجب أن تكون بصيغة PNG أو JPG'));

module.exports.uploadProof = () =>
    multer({ storage: multer.memoryStorage(), fileFilter: proofFilter, limits: { fileSize: 10 * 1024 * 1024 } }).single('proof');
