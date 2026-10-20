const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const net = require('node:net');
const QRCode = require('qrcode');
const puppeteer = require('puppeteer-core');

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

function generateSecureCertificateId() {
    return 'UC-' + crypto.randomBytes(5).toString('hex').toUpperCase();
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function safeImageUrl(value) {
    if (typeof value !== 'string' || value.length > 200000) return '';
    if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
    try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        if (url.protocol !== 'https:' || url.username || url.password) return '';
        if (net.isIP(host) || host === 'localhost' || host.endsWith('.localhost')) return '';
        if (host !== 'qrserver.com' && !host.endsWith('.qrserver.com') && host !== 'imgbb.com' && !host.endsWith('.ibb.co')) return '';
        return url.href;
    } catch {
        return '';
    }
}

async function generateQrCodeDataUrl(verificationUrl) {
    try {
        return await QRCode.toDataURL(verificationUrl, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 200,
            color: {
                dark: '#0f172a',
                light: '#ffffff'
            }
        });
    } catch (e) {
        console.error('QR code generation error:', e);
        return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verificationUrl)}`;
    }
}

function buildCertificateHtml(data, qrCodeDataUrl) {
    const {
        studentName: rawStudentName = 'الطالب',
        courseTitle: rawCourseTitle = 'الدورة التدريبية',
        certificateId: rawCertificateId = 'UC-123456789',
        issueDate: rawIssueDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
        instructorName: rawInstructorName = 'م. محمد بهاء',
        logoUrl: rawLogoUrl = '',
        themeColor: rawThemeColor = '#d4af37',
        titleEn: rawTitleEn = 'CERTIFICATE OF COMPLETION',
        titleAr: rawTitleAr = 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة',
        preNameText: rawPreNameText = 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:',
        completionStatement: rawCompletionStatement = 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات الدورة التدريبية:'
    } = data;

    const studentName = escapeHtml(rawStudentName);
    const courseTitle = escapeHtml(rawCourseTitle);
    const certificateId = escapeHtml(rawCertificateId);
    const issueDate = escapeHtml(rawIssueDate);
    const instructorName = escapeHtml(rawInstructorName);
    const themeColor = /^#[0-9a-f]{6}$/i.test(rawThemeColor) ? rawThemeColor : '#d4af37';
    const titleEn = escapeHtml(rawTitleEn);
    const titleAr = escapeHtml(rawTitleAr);
    const preNameText = escapeHtml(rawPreNameText);
    const completionStatement = escapeHtml(rawCompletionStatement);
    const safeLogoUrl = safeImageUrl(rawLogoUrl);
    const qrFallback = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://mohamedbahaa.com/verify-certificate/${rawCertificateId}`)}`;
    const qrUrl = escapeHtml(safeImageUrl(qrCodeDataUrl) || qrFallback);

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Outfit:wght@700;800;900&display=swap">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 1000px;
      height: 708px;
      overflow: hidden;
      background: #ffffff;
      font-family: 'Cairo', sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    @page {
      size: 1000px 708px landscape;
      margin: 0;
    }
    .cert-root {
      width: 1000px;
      height: 708px;
      position: relative;
      background: #ffffff;
      margin: 0;
      overflow: hidden;
      direction: rtl;
      font-family: 'Cairo', 'Outfit', sans-serif;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 30px 40px;
      border: 10px solid #0f172a;
    }
    .gold-frame-1 {
      position: absolute;
      top: 10px; left: 10px; right: 10px; bottom: 10px;
      border: 1.5px solid ${themeColor};
      pointer-events: none;
      z-index: 2;
    }
    .gold-frame-2 {
      position: absolute;
      top: 13px; left: 13px; right: 13px; bottom: 13px;
      border: 1px solid ${themeColor}33;
      pointer-events: none;
      z-index: 2;
    }
    .corner-ornament {
      position: absolute;
      width: 40px;
      height: 40px;
      z-index: 3;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="cert-root">
    <div class="gold-frame-1"></div>
    <div class="gold-frame-2"></div>

    <!-- Corners -->
    <svg class="corner-ornament" style="top: 13px; left: 13px;" viewBox="0 0 48 48">
      <path d="M 0,0 L 40,0 L 40,4 L 4,4 L 4,40 L 0,40 Z" fill="${themeColor}" />
      <rect x="8" y="8" width="6" height="6" fill="${themeColor}" transform="rotate(45 11 11)" />
    </svg>
    <svg class="corner-ornament" style="top: 13px; right: 13px; transform: scaleX(-1);" viewBox="0 0 48 48">
      <path d="M 0,0 L 40,0 L 40,4 L 4,4 L 4,40 L 0,40 Z" fill="${themeColor}" />
      <rect x="8" y="8" width="6" height="6" fill="${themeColor}" transform="rotate(45 11 11)" />
    </svg>
    <svg class="corner-ornament" style="bottom: 13px; left: 13px; transform: scaleY(-1);" viewBox="0 0 48 48">
      <path d="M 0,0 L 40,0 L 40,4 L 4,4 L 4,40 L 0,40 Z" fill="${themeColor}" />
      <rect x="8" y="8" width="6" height="6" fill="${themeColor}" transform="rotate(45 11 11)" />
    </svg>
    <svg class="corner-ornament" style="bottom: 13px; right: 13px; transform: scale(-1, -1);" viewBox="0 0 48 48">
      <path d="M 0,0 L 40,0 L 40,4 L 4,4 L 4,40 L 0,40 Z" fill="${themeColor}" />
      <rect x="8" y="8" width="6" height="6" fill="${themeColor}" transform="rotate(45 11 11)" />
    </svg>

    <!-- Guilloche Pattern -->
    <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.025; z-index: 1; pointer-events: none;">
      <pattern id="cert-g" width="50" height="50" patternUnits="userSpaceOnUse">
        <circle cx="25" cy="25" r="23" fill="none" stroke="#0f172a" stroke-width="0.8" />
        <circle cx="25" cy="25" r="16" fill="none" stroke="${themeColor}" stroke-width="0.6" />
        <circle cx="25" cy="25" r="10" fill="none" stroke="#0f172a" stroke-width="0.6" />
        <path d="M 0,25 Q 25,0 50,25 Q 25,50 0,25" fill="none" stroke="${themeColor}" stroke-width="0.5" />
        <path d="M 25,0 Q 50,25 25,50 Q 0,25 25,0" fill="none" stroke="#0f172a" stroke-width="0.5" />
      </pattern>
      <rect width="100%" height="100%" fill="url(#cert-g)" />
    </svg>

    <!-- Top Bar -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; z-index: 10; position: relative;">
      <div style="display: flex; align-items: center;">
        ${safeLogoUrl ? `<img src="${escapeHtml(safeLogoUrl)}" style="max-height: 52px; max-width: 180px; object-fit: contain;" />` : ''}
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-start; direction: ltr;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
          <span style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Certificate No:</span>
          <span style="font-family: monospace; font-size: 11px; font-weight: 800; color: #0f172a; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0; letter-spacing: 1px;">${certificateId}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px; font-size: 10px; color: #64748b; font-weight: 600;">
          <span style="color: #94a3b8; text-transform: uppercase; font-size: 9px; font-weight: 700; letter-spacing: 1px;">Issue Date:</span>
          <span style="color: #0f172a; font-weight: 700;">${issueDate}</span>
        </div>
      </div>
    </div>

    <!-- Center Content -->
    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; max-width: 820px; margin: 0 auto; z-index: 10; position: relative;">
      <div style="font-size: 20px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase; color: #0f172a; font-family: 'Outfit', sans-serif; direction: ltr; margin-bottom: 2px;">
        ${titleEn}
      </div>
      <div style="font-size: 22px; font-weight: 900; color: ${themeColor}; font-family: 'Cairo', sans-serif; margin-bottom: 4px;">
        ${titleAr}
      </div>

      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; width: 300px;">
        <div style="flex: 1; height: 1.5px; background: linear-gradient(to right, transparent, ${themeColor});"></div>
        <div style="font-size: 9px; color: ${themeColor};">★</div>
        <div style="width: 7px; height: 7px; background: ${themeColor}; transform: rotate(45deg);"></div>
        <div style="font-size: 9px; color: ${themeColor};">★</div>
        <div style="flex: 1; height: 1.5px; background: linear-gradient(to left, transparent, ${themeColor});"></div>
      </div>

      <div style="font-size: 12.5px; color: #475569; font-weight: 700; margin-bottom: 4px; font-family: 'Cairo', sans-serif;">
        ${preNameText}
      </div>

      <div style="font-size: 44px; font-weight: 900; color: #090e17; font-family: 'Cairo', sans-serif; line-height: 1.15; margin-bottom: 4px; text-align: center;">
        ${studentName}
      </div>

      <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 8px; width: 240px;">
        <div style="flex: 1; height: 1.5px; background: linear-gradient(to right, transparent, ${themeColor});"></div>
        <div style="width: 5px; height: 5px; border-radius: 50%; background: ${themeColor};"></div>
        <div style="flex: 1; height: 1.5px; background: linear-gradient(to left, transparent, ${themeColor});"></div>
      </div>

      <div style="font-size: 12px; color: #64748b; font-weight: 700; margin-bottom: 6px; font-family: 'Cairo', sans-serif;">
        ${completionStatement}
      </div>

      <div style="font-size: 22px; font-weight: 900; color: #090e17; font-family: 'Cairo', sans-serif; line-height: 1.35; text-align: center; padding: 6px 26px; background: linear-gradient(135deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%); border: 1.5px solid ${themeColor}66; border-radius: 10px; max-width: 85%;">
        ${courseTitle}
      </div>
    </div>

    <!-- Bottom Bar -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%; border-top: 1px solid #e2e8f0; padding-top: 8px; z-index: 10; position: relative;">
      <div style="display: flex; flex-direction: column; align-items: center; width: 220px;">
        <div style="width: 150px; height: 1.5px; background: linear-gradient(to right, transparent, #94a3b8, transparent); margin-bottom: 5px;"></div>
        <div style="font-size: 13.5px; font-weight: 800; color: #090e17; font-family: 'Cairo', sans-serif;">
          ${instructorName}
        </div>
        <div style="font-size: 10px; color: #64748b; font-weight: 600; font-family: 'Cairo', sans-serif;">
          المدرب والمحاضر المعتمد
        </div>
      </div>

      <!-- 3D Gold Seal -->
      <div style="display: flex; flex-direction: column; align-items: center; position: relative;">
        <div style="width: 74px; height: 74px; border-radius: 50%; background: radial-gradient(ellipse at 35% 25%, #fff9e6 0%, ${themeColor} 45%, #946e09 85%, #5c4302 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px ${themeColor}55, inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 6px rgba(0,0,0,0.4); border: 1.5px solid #fff6d6;">
          <div style="width: 62px; height: 62px; border-radius: 50%; background: linear-gradient(135deg, #090e17 0%, #172437 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px dashed #e6c86e; color: #fff; text-align: center; padding: 3px;">
            <i class="fa-solid fa-medal" style="font-size: 15px; color: ${themeColor}; margin-bottom: 2px;"></i>
            <div style="font-size: 7px; font-weight: 900; color: ${themeColor}; font-family: 'Cairo', sans-serif; line-height: 1.1;">
              معتمدة ورسمية
            </div>
            <div style="font-size: 5.5px; font-weight: 900; letter-spacing: 0.8px; color: #ffffff; text-transform: uppercase; margin-top: 2px; direction: ltr;">
              VERIFIED
            </div>
          </div>
        </div>
      </div>

      <!-- QR Code -->
      <div style="display: flex; align-items: center; gap: 8px; direction: ltr; width: 220px; justify-content: flex-end;">
        <div style="padding: 4px; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; box-shadow: 0 3px 10px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center;">
          <img src="${qrUrl}" style="width: 48px; height: 48px; display: block;" />
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-start;">
          <div style="font-size: 9px; font-weight: 800; color: #090e17; text-transform: uppercase; letter-spacing: 0.5px;">
            SCAN TO VERIFY
          </div>
          <div style="font-size: 8px; color: #64748b; font-weight: 600;">
            التحقق من صحة الشهادة
          </div>
          <div style="background: #090e17; color: ${themeColor}; font-size: 7px; font-weight: bold; padding: 1.5px 5px; border-radius: 3px; margin-top: 2px; display: flex; align-items: center; gap: 2px;">
            <i class="fa-solid fa-shield-halved"></i> OFFICIAL
          </div>
        </div>
      </div>
    </div>

  </div>
</body>
</html>`;
}

async function renderCertificateToJpg(data, qrCodeDataUrl) {
    const browserPath = getBrowserPath();
    const htmlContent = buildCertificateHtml(data, qrCodeDataUrl);

    const tmpDir = os.tmpdir();
    const id = crypto.randomBytes(4).toString('hex');
    const htmlFilePath = path.join(tmpDir, `cert_${id}.html`);
    const imgFilePath = path.join(tmpDir, `cert_${id}.jpg`);

    fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');

    const args = [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        '--window-size=1000,708',
        `--screenshot=${imgFilePath}`,
        htmlFilePath
    ];

    return new Promise((resolve, reject) => {
        execFile(browserPath, args, (err) => {
            try {
                if (err) {
                    try { fs.unlinkSync(htmlFilePath); } catch (e) {}
                    return reject(err);
                }

                if (!fs.existsSync(imgFilePath)) {
                    try { fs.unlinkSync(htmlFilePath); } catch (e) {}
                    return reject(new Error('Screenshot file was not created'));
                }

                const imgBuffer = fs.readFileSync(imgFilePath);
                const base64Data = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;

                try { fs.unlinkSync(htmlFilePath); } catch (e) {}
                try { fs.unlinkSync(imgFilePath); } catch (e) {}

                resolve(base64Data);
            } catch (cleanupErr) {
                reject(cleanupErr);
            }
        });
    });
}

async function renderCertificateToPdf(data, qrCodeDataUrl) {
    const browserPath = getBrowserPath();
    const htmlContent = buildCertificateHtml(data, qrCodeDataUrl);

    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: browserPath,
            headless: true,
            args: ['--disable-gpu']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1000, height: 708 });
        await page.setContent(htmlContent, { waitUntil: ['load', 'networkidle0'] });
        
        const pdfBuffer = await page.pdf({
            width: '1000px',
            height: '708px',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
        });

        await browser.close();
        return pdfBuffer;
    } catch (err) {
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }

        // Direct Chromium CLI fallback for PDF export
        const tmpDir = os.tmpdir();
        const id = crypto.randomBytes(4).toString('hex');
        const htmlFilePath = path.join(tmpDir, `cert_${id}.html`);
        const pdfFilePath = path.join(tmpDir, `cert_${id}.pdf`);

        fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');
        const args = [
            '--headless',
            '--disable-gpu',
            '--no-pdf-header-footer',
            `--print-to-pdf=${pdfFilePath}`,
            htmlFilePath
        ];

        return new Promise((resolve, reject) => {
            execFile(browserPath, args, (cliErr) => {
                try {
                    if (cliErr || !fs.existsSync(pdfFilePath)) {
                        try { fs.unlinkSync(htmlFilePath); } catch (e) {}
                        return reject(cliErr || new Error('CLI PDF generation failed'));
                    }
                    const pdfBuffer = fs.readFileSync(pdfFilePath);
                    try { fs.unlinkSync(htmlFilePath); } catch (e) {}
                    try { fs.unlinkSync(pdfFilePath); } catch (e) {}
                    resolve(pdfBuffer);
                } catch (cleanupErr) {
                    reject(cleanupErr);
                }
            });
        });
    }
}

module.exports = {
    renderCertificateToJpg,
    renderCertificateToPdf,
    buildCertificateHtml,
    generateQrCodeDataUrl,
    generateSecureCertificateId
};
