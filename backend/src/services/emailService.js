const nodemailer = require('nodemailer');
const Setting = require('../models/Setting');

/**
 * Get SMTP configuration from database Settings or .env
 */
async function getSmtpConfig() {
    try {
        const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_from_email', 'site_name'];
        const settings = await Setting.find({ skey: { $in: keys } }).lean();
        const map = {};
        settings.forEach(s => { map[s.skey] = s.svalue; });

        const host = map.smtp_host || process.env.SMTP_HOST || '';
        const port = parseInt(map.smtp_port || process.env.SMTP_PORT || '587', 10);
        const user = map.smtp_user || process.env.SMTP_USER || '';
        const pass = map.smtp_pass || process.env.SMTP_PASS || '';
        const fromName = map.smtp_from_name || process.env.SMTP_FROM_NAME || map.site_name || 'منصة الكورسات';
        const fromEmail = map.smtp_from_email || process.env.SMTP_FROM_EMAIL || user || 'no-reply@platform.com';

        return {
            host,
            port,
            secure: port === 465,
            auth: (user && pass) ? { user, pass } : null,
            from: `"${fromName}" <${fromEmail}>`,
            siteName: map.site_name || 'منصة الكورسات التعليمية'
        };
    } catch (e) {
        return {
            host: process.env.SMTP_HOST || '',
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: false,
            auth: null,
            from: '"منصة الكورسات" <no-reply@platform.com>',
            siteName: 'منصة الكورسات التعليمية'
        };
    }
}

/**
 * Generate a professional responsive HTML template for OTP verification
 */
function buildOtpHtml({ otp, userName, siteName }) {
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>رمز التحقق لتفعيل الحساب</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f1015; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; direction: rtl;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f1015; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background: #181920; border-radius: 16px; border: 1px solid #272833; box-shadow: 0 20px 40px rgba(0,0,0,0.4); overflow: hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Header with Red Accent -->
          <tr>
            <td style="background: linear-gradient(135deg, #c81e1e 0%, #991b1b 100%); padding: 32px 25px; text-align: center;">
              <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background: rgba(255, 255, 255, 0.15); color: #ffffff; font-size: 26px; font-weight: bold; margin-bottom: 12px;">
                ✓
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">تأكيد بريدك الإلكتروني</h1>
              <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">${siteName}</p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 35px 30px; text-align: right;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #f1f5f9; line-height: 1.6;">
                أهلاً بك <strong>${userName ? userName : 'عزيزنا الطالب'}</strong>،
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14.5px; color: #94a3b8; line-height: 1.7;">
                شكراً لتسجيلك معنا! لتفعيل حسابك والتأكد من صحة بريدك الإلكتروني، يرجى إدخال رمز التحقق (OTP) التالي في صفحة التأكيد:
              </p>

              <!-- OTP Code Display Card -->
              <div style="background: #20222c; border: 2px dashed #c81e1e; border-radius: 14px; padding: 22px; text-align: center; margin: 25px 0;">
                <div style="font-size: 13px; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">رمز التحقق الخاص بك</div>
                <div style="font-size: 38px; font-weight: 800; color: #ffffff; letter-spacing: 10px; font-family: 'Courier New', Courier, monospace; direction: ltr;">
                  ${otp}
                </div>
                <div style="margin-top: 10px; font-size: 12.5px; color: #f87171; font-weight: 500;">
                  ⏳ صالح لمدة 15 دقيقة فقط
                </div>
              </div>

              <div style="background: rgba(200, 30, 30, 0.08); border-right: 4px solid #c81e1e; padding: 12px 16px; border-radius: 6px; margin: 20px 0 30px 0;">
                <p style="margin: 0; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                  ⚠️ <strong>تنبيه أمني:</strong> لا تشارك هذا الرمز مع أي شخص. موظفو المنصة لن يطلبوا منك هذا الرمز أبداً.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                إذا لم تكن قد أنشأت هذا الحساب، يمكنك ببساطة تجاهل هذه الرسالة بأمان.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #13141a; padding: 20px 30px; text-align: center; border-top: 1px solid #232530;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                جميع الحقوق محفوظة © ${new Date().getFullYear()} ${siteName}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
}

/**
 * Send OTP Email to recipient
 */
async function sendOtpEmail(toEmail, otp, userName = '') {
    const config = await getSmtpConfig();

    if (!config.host || !config.auth) {
        console.warn('⚠️ [SMTP Notice] SMTP credentials are not fully configured yet in Settings or .env.');
        return { success: false, unavailable: true };
    }

    try {
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: config.auth,
            tls: { rejectUnauthorized: true }
        });

        const html = buildOtpHtml({ otp, userName, siteName: config.siteName });

        const info = await transporter.sendMail({
            from: config.from,
            to: toEmail,
            subject: `رمز التحقق الخاص بحسابك: ${otp}`,
            text: `رمز التحقق الخاص بحسابك لتفعيل البريد هو: ${otp}. صالح لمدة 15 دقيقة.`,
            html
        });

        console.log(`✅ [SMTP SUCCESS] OTP email sent to ${toEmail}. MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error('❌ [SMTP ERROR] Failed to send email via SMTP server:', err.message);
        // Fallback: don't break user registration if SMTP server is down
        return { success: false, error: err.message };
    }
}

module.exports = {
    getSmtpConfig,
    sendOtpEmail
};
