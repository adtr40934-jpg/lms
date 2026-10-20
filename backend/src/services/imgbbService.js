const https = require('https');
const fs = require('fs');
const path = require('path');

const IMGBB_IP = '45.43.142.0';

function customLookup(hostname, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    if (hostname === 'api.imgbb.com') {
        if (options && options.all) {
            return callback(null, [{ address: IMGBB_IP, family: 4 }]);
        }
        return callback(null, IMGBB_IP, 4);
    }
    require('dns').lookup(hostname, options, callback);
}

/**
 * Universal ImgBB Uploader with ISP DNS Bypass
 * Bypasses Egyptian ISP DNS poisoning by resolving directly to ImgBB Anycast IP
 * 
 * @param {Buffer|string} fileInput - Buffer, file path, or base64 string
 * @param {string} [name] - optional image name
 * @returns {Promise<string>} - Returns direct image URL (https://i.ibb.co/...)
 */
async function uploadToImgbb(fileInput, name = '', options = {}) {
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
        throw new Error('مفتاح IMGBB_API_KEY غير موجود في ملف .env');
    }

    let base64Data = '';
    if (Buffer.isBuffer(fileInput)) {
        base64Data = fileInput.toString('base64');
    } else if (typeof fileInput === 'string') {
        if (fs.existsSync(fileInput)) {
            base64Data = fs.readFileSync(fileInput).toString('base64');
        } else if (fileInput.startsWith('data:image')) {
            base64Data = fileInput.split(',')[1];
        } else {
            base64Data = fileInput;
        }
    } else {
        throw new Error('نوع ملف غير صالح للرفع إلى ImgBB');
    }

    const postParams = new URLSearchParams();
    postParams.append('image', base64Data);
    if (name) postParams.append('name', name);
    const postBody = postParams.toString();

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.imgbb.com',
            port: 443,
            path: `/1/upload?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postBody)
            },
            lookup: customLookup,
            timeout: 35000
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                try {
                    const bodyText = Buffer.concat(chunks).toString('utf8');
                    const json = JSON.parse(bodyText);
                    if (json && json.success && json.data && json.data.url) {
                        const resUrl = json.data.url;
                        const delUrl = json.data.delete_url || '';
                        const resObj = new String(resUrl);
                        resObj.url = resUrl;
                        resObj.delete_url = delUrl;

                        if ((options === true || (options && options.deleteAfter)) && typeof fileInput === 'string') {
                            removeLocalFileSafely(fileInput);
                        }

                        resolve(resObj);
                    } else {
                        reject(new Error(json?.error?.message || 'فشل رفع الصورة إلى ImgBB'));
                    }
                } catch (parseErr) {
                    reject(new Error(`استجابة غير صالحة من ImgBB: ${parseErr.message}`));
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('انتهت مهلة الاتصال بخادم ImgBB (Timeout)'));
        });

        req.on('error', (err) => {
            reject(new Error(`خطأ اتصال أثناء الرفع إلى ImgBB: ${err.message}`));
        });

        req.write(postBody);
        req.end();
    });
}

function getBrowserPath() {
    const candidates = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return candidates[0];
}

/**
 * Automatically delete an uploaded image from ImgBB servers using its delete_url
 * @param {string} deleteUrl 
 * @returns {Promise<boolean>}
 */
async function deleteFromImgbb(deleteUrl) {
    if (!deleteUrl || typeof deleteUrl !== 'string' || !deleteUrl.includes('ibb.co')) {
        return false;
    }

    console.log(`[ImgBB Delete] Processing deletion for URL: ${deleteUrl}`);
    let browser = null;
    try {
        const puppeteer = require('puppeteer-core');
        const browserPath = getBrowserPath();
        if (!fs.existsSync(browserPath)) {
            console.warn(`[ImgBB Delete] Browser not found at ${browserPath}. Skipping headless deletion.`);
            return false;
        }

        browser = await puppeteer.launch({
            executablePath: browserPath,
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        });

        const page = await browser.newPage();
        let isSuccess = false;

        page.on('response', async res => {
            if (res.url().includes('json') && res.request().method() === 'POST') {
                try {
                    const text = await res.text();
                    if (text.includes('"affected":1') || text.includes('Image deleted') || text.includes('"status_code":200')) {
                        isSuccess = true;
                    }
                } catch (e) {}
            }
        });

        await page.goto(deleteUrl, { waitUntil: 'networkidle2', timeout: 25000 });

        const deleteBtn = await page.$('.link--delete');
        if (deleteBtn) {
            await deleteBtn.click();
            await new Promise(r => setTimeout(r, 800));
            const confirmBtn = await page.$('[data-action=submit]');
            if (confirmBtn) {
                await confirmBtn.click();
                await new Promise(r => setTimeout(r, 2500));
            }
        }

        await browser.close();
        browser = null;
        console.log(`[ImgBB Delete] Deletion completed for ${deleteUrl}. Success: ${isSuccess}`);
        return isSuccess;
    } catch (err) {
        console.error(`[ImgBB Delete Error for ${deleteUrl}]:`, err.message);
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
        return false;
    }
}

function removeLocalFileSafely(targetPath) {
    if (!targetPath) return;
    try {
        const absPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(targetPath);
        if (fs.existsSync(absPath)) {
            try {
                fs.unlinkSync(absPath);
                console.log(`[Upload Cleanup] Deleted local image from backend: ${absPath}`);
            } catch (err) {
                // In case of temporary file handle lock on Windows, retry asynchronously
                setTimeout(() => {
                    try {
                        if (fs.existsSync(absPath)) {
                            fs.unlinkSync(absPath);
                            console.log(`[Upload Cleanup] Deleted local image on retry: ${absPath}`);
                        }
                    } catch (e) {}
                }, 500);
            }
        }
    } catch (e) {}
}

/**
 * Helper to upload a multer file to ImgBB with automatic fallback to local disk storage
 * @param {object} file - multer file object
 * @returns {Promise<string>} - Returns ImgBB URL (or local URL on fallback)
 */
async function uploadMulterFileToImgbb(file) {
    if (!file) return '';

    const localPath = file.path || (file.destination && file.filename ? path.join(file.destination, file.filename) : null);

    try {
        const res = await uploadToImgbb(file.buffer || localPath, file.originalname);
        const imgbbUrl = (res && res.url) ? res.url : String(res);

        // Delete temporary local file from uploads/images immediately once uploaded to ImgBB
        if (localPath) {
            removeLocalFileSafely(localPath);
        }

        return imgbbUrl;
    } catch (err) {
        console.warn(`[ImgBB Fallback] Failed uploading to ImgBB: ${err.message}. Retaining local file.`);
        // Fallback to local file if available
        if (file.filename) {
            return 'uploads/images/' + file.filename;
        } else if (file.path) {
            const rel = path.relative(path.join(__dirname, '..', '..'), file.path).replace(/\\/g, '/');
            return rel;
        } else if (file.buffer) {
            // If multer used memoryStorage, save buffer to disk
            const ext = path.extname(file.originalname || '.jpg') || '.jpg';
            const filename = Date.now() + '_' + Math.random().toString(36).slice(2) + ext;
            const targetDir = path.join(__dirname, '..', '..', 'uploads', 'images');
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
            const targetPath = path.join(targetDir, filename);
            fs.writeFileSync(targetPath, file.buffer);
            return 'uploads/images/' + filename;
        }
        throw err;
    }
}

module.exports = {
    uploadToImgbb,
    uploadMulterFileToImgbb,
    deleteFromImgbb,
    removeLocalFileSafely
};

