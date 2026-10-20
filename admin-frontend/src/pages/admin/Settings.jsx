import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import UploadProgressModal from '../../components/UploadProgressModal';
import RichTextEditor from '../../components/RichTextEditor';
import { getAssetUrl } from '../../utils/assetUrl';

function Settings() {
  const [settings, setSettings] = useState({});
  const [trainerDesc, setTrainerDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadState, setUploadState] = useState({ isUploading: false, progress: 0, loaded: 0, total: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/settings/admin');
      const st = res.settings || {};
      setSettings(st);
      setTrainerDesc(st.trainer_desc || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (trainerDesc !== undefined) {
      fd.set('trainer_desc', trainerDesc);
    }

    const onProgress = (percent, loadedBytes, totalBytes) => {
      setUploadState({ isUploading: true, progress: percent, loaded: loadedBytes, total: totalBytes });
    };

    try {
      setUploadState({ isUploading: true, progress: 0, loaded: 0, total: 0 });
      const res = await api.put('/settings/admin', fd, true, onProgress);
      alert(res.message);
      fetchData(); // refresh settings e.g. for image preview
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadState({ isUploading: false, progress: 0, loaded: 0, total: 0 });
    }
  };

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await api.put('/settings/admin/account', Object.fromEntries(fd));
      alert(res.message);
      e.target.reset();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <AdminLayout title="الإعدادات"><div style={{ padding: '100px 0', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i></div></AdminLayout>;

  return (
    <AdminLayout title="الإعدادات">
      <form onSubmit={handleSettingsSubmit}>
        <div className="grid-2">
          <div className="panel" style={{ gridColumn: '1/-1' }}>
            <div className="panel-head"><h2><i className="fa-solid fa-layer-group"></i> هوية المنصة واللوجو</h2></div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="field"><label>اسم المنصة</label><input name="site_name" defaultValue={settings.site_name || 'محمد بهاء'} placeholder="مثال: محمد بهاء" /></div>
                <div className="field"><label>الشعار الفرعي / الوصف المختصر</label><input name="site_subtitle" defaultValue={settings.site_subtitle || 'بتاع تسويق'} placeholder="مثال: بتاع تسويق" /></div>
                <div className="field"><label>نص زر عن المنصة في الهيرو</label><input name="about_btn_text" defaultValue={settings.about_btn_text} placeholder="مثال: عن المنصة (اتركه فارغاً للافتراضي)" /></div>
                <div className="field">
                  <label>فيديو عن المنصة (رابط يوتيوب أو فيديو مباشر)</label>
                  <input name="about_video_url" dir="ltr" defaultValue={settings.about_video_url} placeholder="مثال: https://www.youtube.com/watch?v=... أو https://..." />
                  <div className="hint" style={{ fontSize: '11.5px', marginTop: '3px', color: '#64748b' }}>
                    عند إضافة رابط فيديو هنا، سيقوم زر "عن المنصة" في الهيرو بتشغيل الفيديو مباشرة في نافذة منبثقة أنيقة (Modal).
                  </div>
                </div>
                <div className="field full"><label>رابط بديل لزر عن المنصة (اختياري في حال عدم وجود فيديو)</label><input name="about_btn_url" dir="ltr" defaultValue={settings.about_btn_url} placeholder="مثال: /about" /></div>
                <div className="field full">
                  <label>لوجو المنصة</label>
                  {settings.site_logo && (
                    <div style={{ marginBottom: '10px' }}>
                      <img src={getAssetUrl(settings.site_logo)} alt="Platform Logo" style={{ maxHeight: '60px', objectFit: 'contain', background: '#111', padding: '8px', borderRadius: '8px' }} />
                    </div>
                  )}
                  <input type="file" name="site_logo" accept="image/*" />
                  <div className="hint">اختر صورة الشعار (يفضل صيغة PNG شفافة أو WebP)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2><i className="fa-solid fa-phone"></i> التواصل والدفع</h2></div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="field"><label>رقم التواصل</label><input name="phone" dir="ltr" defaultValue={settings.phone} placeholder="01xxxxxxxxx" /></div>
                <div className="field"><label>رقم الدفع (InstaPay / Vodafone Cash)</label><input name="payment_number" dir="ltr" defaultValue={settings.payment_number} placeholder="01xxxxxxxxx أو instapay" /></div>
                <div className="field"><label>رقم WhatsApp (بالصيغة الدولية)</label><input name="whatsapp" dir="ltr" defaultValue={settings.whatsapp} placeholder="201xxxxxxxxx" /><div className="hint">مثال: 201028283777 (بدون +)</div></div>
                <div className="field"><label>البريد الإلكتروني</label><input name="email" dir="ltr" defaultValue={settings.email} placeholder="admin@example.com" /></div>
                <div className="field full"><label>رسالة واتساب الافتراضية</label><input name="whatsapp_message" defaultValue={settings.whatsapp_message} placeholder="مرحباً، أود الاستفسار عن الدورة..." /></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2><i className="fa-solid fa-users-rectangle"></i> مجتمعات وجروبات الطلاب (تظهر في صفحة كورساتي)</h2></div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="field full">
                  <label><i className="fa-brands fa-telegram" style={{ color: '#0088cc' }}></i> رابط جروب التليجرام (متاح الأسئلة بعد التطبيق نظراً لوجود أي خطأ)</label>
                  <input name="telegram_group_url" dir="ltr" defaultValue={settings.telegram_group_url} placeholder="https://t.me/..." />
                  <div className="hint">يظهر لطلاب المنصة في صفحة كورساتي للانضمام للجروب والاستفسار بعد التطبيق.</div>
                </div>
                <div className="field full">
                  <label><i className="fa-brands fa-facebook" style={{ color: '#1877f2' }}></i> رابط جروب الفيس بوك (أسئلة بشكل شهري على فيس بوك جروب)</label>
                  <input name="facebook_group_url" dir="ltr" defaultValue={settings.facebook_group_url} placeholder="https://facebook.com/groups/..." />
                  <div className="hint">يظهر لطلاب المنصة في صفحة كورساتي لحضور جلسات الأسئلة الشهرية.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2><i className="fa-solid fa-share-nodes"></i> حسابات السوشيال ميديا</h2></div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="field"><label><i className="fa-brands fa-facebook"></i> Facebook</label><input name="facebook" dir="ltr" defaultValue={settings.facebook} placeholder="https://facebook.com/..." /></div>
                <div className="field"><label><i className="fa-brands fa-instagram"></i> Instagram</label><input name="instagram" dir="ltr" defaultValue={settings.instagram} placeholder="https://instagram.com/..." /></div>
                <div className="field"><label><i className="fa-brands fa-tiktok"></i> TikTok</label><input name="tiktok" dir="ltr" defaultValue={settings.tiktok} placeholder="https://tiktok.com/@..." /></div>
                <div className="field"><label><i className="fa-brands fa-youtube"></i> YouTube</label><input name="youtube" dir="ltr" defaultValue={settings.youtube} placeholder="https://youtube.com/..." /></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2><i className="fa-solid fa-chart-line"></i> أرقام الإحصائيات (عن المدرب)</h2></div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="field"><label>سنوات الخبرة التدريبية</label><input type="number" name="stat_years" defaultValue={settings.stat_years} placeholder="مثال: 5" /></div>
                <div className="field"><label>عدد المتدربين</label><input type="number" name="stat_students" defaultValue={settings.stat_students} placeholder="مثال: 1200" /></div>
                <div className="field"><label>عدد الكورسات</label><input type="number" name="stat_courses" defaultValue={settings.stat_courses} placeholder="مثال: 10" /></div>
                <div className="field"><label>ساعات المحتوى التدريبي</label><input type="number" name="stat_hours" defaultValue={settings.stat_hours} placeholder="مثال: 50" /></div>
                <div className="field"><label>عدد العملاء (ساعدنا أكثر من)</label><input type="number" name="stat_clients" defaultValue={settings.stat_clients} placeholder="مثال: 1050" /></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2><i className="fa-solid fa-user-tie"></i> معلومات المدرب</h2></div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="field full"><label>اسم المدرب</label><input name="trainer_name" defaultValue={settings.trainer_name} placeholder="مثال: محمد بهاء" /></div>
                <div className="field full"><label>المسمى الوظيفي</label><input name="trainer_subtitle" defaultValue={settings.trainer_subtitle} placeholder="مثال: مدرب تسويق إلكتروني وصانع محتوى" /></div>
                <div className="field full">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>نبذة عن المدرب</span>
                    <small style={{ color: '#94a3b8', fontSize: '12px' }}>
                      <i className="fa-solid fa-wand-magic-sparkles text-red"></i> يمكنك تلوين أي كلمة، جعلها عريضة (Bold)، أو تنظيمها كنقاط
                    </small>
                  </label>
                  <RichTextEditor
                    name="trainer_desc"
                    value={trainerDesc}
                    onChange={setTrainerDesc}
                    placeholder="اكتب نبذة عن المدرب ومؤهلاته وخبرته..."
                  />
                </div>
                <div className="field">
                  {settings.trainer_image && (
                    <img src={getAssetUrl(settings.trainer_image)} alt="Trainer" style={{ width: '140px', borderRadius: '14px', objectFit: 'cover' }} />
                  )}
                </div>
                <div className="field">
                  <label>رفع صورة جديدة</label><input type="file" name="trainer_image" accept="image/*" />
                  <div className="hint">يفضّل صورة طولية (مثلاً 1000×1200) بخلفية داكنة أو PNG مفرّغة</div>
                </div>
                <div className="field full" style={{ marginTop: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-award text-red"></i> شهادات واعتمادات المدرب
                    </strong>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>إدارة ورفع صور الشهادات التي تظهر في صفحة "عن المدرب"</span>
                  </div>
                  <Link to="/admin/trainer-certificates" className="btn btn-light btn-sm" style={{ fontWeight: 'bold', gap: '6px' }}>
                    إدارة الشهادات <i className="fa-solid fa-arrow-left"></i>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ gridColumn: '1/-1' }}>
            <div className="panel-head"><h2><i className="fa-solid fa-magnifying-glass"></i> SEO الصفحة الرئيسية</h2></div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="field full"><label>Meta Title</label><input name="meta_title" defaultValue={settings.meta_title} placeholder="اكتب عنوان الصفحة الرئيسية الذي يظهر في جوجل..." /></div>
                <div className="field full"><label>Meta Description</label><textarea name="meta_desc" style={{ minHeight: '70px' }} defaultValue={settings.meta_desc} placeholder="اكتب وصف الموقع الذي يظهر أسفل العنوان في محركات البحث..."></textarea></div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ gridColumn: '1/-1' }}>
            <div className="panel-head"><h2><i className="fa-solid fa-envelope-circle-check"></i> إعدادات إرسال الإيميل ورمز التحقق (SMTP & OTP)</h2></div>
            <div className="panel-body">
              <div style={{ background: 'rgba(230, 57, 70, 0.08)', border: '1px solid rgba(230, 57, 70, 0.2)', padding: '12px 16px', borderRadius: '10px', marginBottom: '18px', fontSize: '13px', lineHeight: '1.7', color: '#ccc' }}>
                <i className="fa-solid fa-circle-info text-red" style={{ marginLeft: '8px' }}></i>
                تُستخدم هذه الإعدادات لإرسال رمز التحقق (OTP) للطلاب فور التسجيل. في حال تركها فارغة، سيعمل السيرفر في وضع المحاكاة ويطبع الرمز في الـ Console الخاص بالباك إند للتجربة دون توقف التسجيل.
              </div>
              <div className="form-grid">
                <div className="field"><label>خادم البريد (SMTP Host)</label><input name="smtp_host" dir="ltr" defaultValue={settings.smtp_host} placeholder="smtp.gmail.com" /></div>
                <div className="field"><label>منفذ الخادم (Port)</label><input name="smtp_port" dir="ltr" defaultValue={settings.smtp_port} placeholder="465 أو 587" /></div>
                <div className="field"><label>اسم المستخدم / البريد (User)</label><input name="smtp_user" dir="ltr" defaultValue={settings.smtp_user} placeholder="your-email@gmail.com" /></div>
                <div className="field"><label>كلمة المرور / App Password</label><input type="password" name="smtp_pass" dir="ltr" defaultValue={settings.smtp_pass} placeholder="كلمة مرور التطبيق من Google أو الخادم" /></div>
                <div className="field"><label>اسم المُرسل الظاهر (Sender Name)</label><input name="smtp_from_name" defaultValue={settings.smtp_from_name} placeholder="منصة محمد بهاء التعليمية" /></div>
                <div className="field"><label>بريد المُرسل الظاهر (Sender Email)</label><input name="smtp_from_email" dir="ltr" defaultValue={settings.smtp_from_email} placeholder="no-reply@yourdomain.com" /></div>
              </div>
            </div>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{ padding: '12px 30px' }}><i className="fa-solid fa-floppy-disk"></i> حفظ الإعدادات</button>
      </form>

      <div className="panel" style={{ marginTop: '26px' }}>
        <div className="panel-head"><h2><i className="fa-solid fa-user-shield"></i> حساب الأدمن</h2></div>
        <div className="panel-body">
          <form onSubmit={handleAccountSubmit}>
            <div className="form-grid">
              <div className="field"><label>الاسم</label><input name="name" placeholder="مدير النظام" /></div>
              <div className="field"><label>البريد الإلكتروني (للدخول)</label><input name="email" dir="ltr" placeholder="admin@example.com" /></div>
              <div className="field">
                <label>كلمة المرور الجديدة (اختياري)</label>
                <input
                  name="newPassword"
                  type="password"
                  dir="ltr"
                  pattern="(?=.*[A-Za-z])(?=.*\d).{6,}"
                  title="كلمة المرور يجب أن تتكون من 6 خانات على الأقل وتجمع بين الحروف والأرقام"
                  placeholder="حروف وأرقام (6 خانات على الأقل)"
                />
              </div>
              <div className="field"><label>كلمة المرور الحالية *</label><input name="current" type="password" dir="ltr" required placeholder="••••••••" /></div>
              <div className="full"><button type="submit" className="btn btn-dark"><i className="fa-solid fa-key"></i> تحديث بيانات الدخول</button></div>
            </div>
          </form>
        </div>
      </div>

      <UploadProgressModal
        isUploading={uploadState.isUploading}
        progress={uploadState.progress}
        loaded={uploadState.loaded}
        total={uploadState.total}
        title="جاري رفع الهوية واللواحق..."
      />
    </AdminLayout>
  );
}

export default Settings;
