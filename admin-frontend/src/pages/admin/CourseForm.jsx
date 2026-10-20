import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import UploadProgressModal from '../../components/UploadProgressModal';
import { getAssetUrl } from '../../utils/assetUrl';

function CourseForm() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadState, setUploadState] = useState({ isUploading: false, progress: 0, loaded: 0, total: 0 });
  const [durationVal, setDurationVal] = useState('');
  const [isManual, setIsManual] = useState(false);
  const [calculatedDuration, setCalculatedDuration] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [catsRes, tracksRes] = await Promise.all([
        api.get('/categories'),
        api.get('/tracks/admin/all').catch(() => ({ tracks: [] }))
      ]);
      setCategories(catsRes.categories || []);
      setTracks(tracksRes.tracks || []);

      if (id) {
        const [coursesRes, contentRes] = await Promise.all([
          api.get('/courses/admin/all'),
          api.get(`/courses/admin/${id}/content`).catch(() => null)
        ]);
        const c = coursesRes.courses?.find(x => x._id === id);
        if (c) {
          const calcDur = contentRes?.course?.calculated_duration || '';
          const isMan = c.is_duration_manual ?? (contentRes?.course?.is_duration_manual ?? false);
          setCourse(c);
          setDurationVal(c.duration || calcDur || '');
          setIsManual(isMan);
          setCalculatedDuration(calcDur);
        }
      } else {
        setCourse(null);
        setDurationVal('');
        setIsManual(false);
        setCalculatedDuration('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    const onProgress = (percent, loadedBytes, totalBytes) => {
      setUploadState({ isUploading: true, progress: percent, loaded: loadedBytes, total: totalBytes });
    };

    try {
      setUploadState({ isUploading: true, progress: 0, loaded: 0, total: 0 });
      let res;
      if (id) {
        res = await api.put(`/courses/admin/${id}`, fd, true, onProgress);
        alert('تم حفظ التعديلات بنجاح');
      } else {
        res = await api.post('/courses/admin', fd, true, onProgress);
        alert('تم إضافة الكورس بنجاح');
        if (res.course && res.course._id) {
          navigate(`/admin/courses/form?id=${res.course._id}`, { replace: true });
        }
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadState({ isUploading: false, progress: 0, loaded: 0, total: 0 });
    }
  };

  if (loading) return <AdminLayout title={id ? "تعديل الكورس" : "إضافة كورس جديد"}><div style={{ padding: '100px 0', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i></div></AdminLayout>;

  return (
    <AdminLayout title={id ? "تعديل الكورس" : "إضافة كورس جديد"}>
      <form onSubmit={handleSubmit}>
        <div className="grid-3">
          <div>
            <div className="panel">
              <div className="panel-head"><h2><i className="fa-solid fa-circle-info"></i> البيانات الأساسية</h2></div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="field"><label>اسم الكورس *</label><input name="title" defaultValue={course?.title} required placeholder="مثال: كورس إعلانات فيسبوك الشامل" /></div>
                  <div className="field">
                    <label>رابط الكورس (Slug)</label>
                    <input name="slug" dir="ltr" placeholder="meta-ads" defaultValue={course?.slug} />
                    <div className="hint">يظهر في الرابط: /course/<b>slug</b> — اتركه فارغ للتوليد التلقائي</div>
                  </div>
                  <div className="field full"><label>وصف مختصر (يظهر في الكارت)</label><textarea name="short_desc" defaultValue={course?.short_desc} style={{ minHeight: '70px' }} placeholder="اكتب وصفاً جذاباً وقصيراً يظهر للطلاب في كارت الكورس..."></textarea></div>
                  <div className="field full"><label>وصف الكورس بالتفصيل</label><textarea name="description" defaultValue={course?.description} style={{ minHeight: '150px' }} placeholder="اكتب كل التفاصيل الخاصة بالكورس هنا..."></textarea></div>
                  <div className="field full"><label>ماذا ستتعلم؟ (كل نقطة في سطر)</label><textarea name="what_learn" defaultValue={course?.what_learn} placeholder="مثال:&#10;كيفية إطلاق حملة إعلانية ناجحة&#10;تحليل البيانات بدقة"></textarea></div>
                  <div className="field full"><label>لمن هذا الكورس؟ (كل نقطة في سطر)</label><textarea name="audience" defaultValue={course?.audience} placeholder="مثال:&#10;أصحاب المشاريع الصغيرة&#10;المسوقين المبتدئين"></textarea></div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h2><i className="fa-solid fa-magnifying-glass"></i> SEO</h2></div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="field full"><label>Meta Title</label><input name="meta_title" defaultValue={course?.meta_title} placeholder="اتركه فارغ لاستخدام اسم الكورس" /></div>
                  <div className="field full"><label>Meta Description</label><textarea name="meta_desc" defaultValue={course?.meta_desc} style={{ minHeight: '70px' }} placeholder="اتركه فارغ لاستخدام الوصف المختصر"></textarea></div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="panel">
              <div className="panel-head"><h2><i className="fa-solid fa-tag"></i> السعر والنشر</h2></div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="field full"><label>السعر (بالدولار $) *</label><input type="number" name="price" defaultValue={course?.price} min="0" step="0.01" required placeholder="مثال: 50" /></div>
                  <div className="field full"><label className="check"><input type="checkbox" name="is_published" value="true" defaultChecked={course ? course.is_published : true} /> منشور على الموقع</label></div>
                  <div className="field full">
                    <label className="check" style={{ color: '#d97706', fontWeight: 'bold' }}>
                      <input type="checkbox" name="is_soon" value="true" defaultChecked={course?.is_soon} />
                      <span>قريباً (Soon) - إيقاف الشراء وعرض شارة وطبقة قريباً على الكارت</span>
                    </label>
                    <div className="hint" style={{ marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                      عند التفعيل: سيظهر الكورس كـ "قريباً" مع طبقة تظليل وشارة مميزة، وسيتم تحويل زر الشراء إلى "قريباً" وتعطيل الشراء.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h2><i className="fa-solid fa-image"></i> الصورة والفيديو</h2></div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="field full">
                    <label>صورة الكورس (Cover)</label>
                    {course?.image && (
                      <img 
                        src={getAssetUrl(course.image, '/assets/img/courses/default.svg')} 
                        alt="" 
                        style={{width:'100%', marginBottom:'10px', borderRadius:'8px'}} 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/assets/img/courses/default.svg';
                        }}
                      />
                    )}
                    <input type="file" name="image" accept="image/*" />
                    <div className="hint">المقاس المقترح 1600×1000 بكسل (JPG / PNG / WEBP)</div>
                  </div>
                  <div className="field full">
                    <label>الفيديو التعريفي (رابط)</label><input name="intro_video" defaultValue={course?.intro_video} dir="ltr" placeholder="https://www.youtube.com/watch?v=..." />
                    <div className="hint">يدعم YouTube / Vimeo / روابط التضمين المباشرة (إذا تُرك فارغاً، سيتم تلقائياً عرض المحاضرة الأولى كفيديو تعريفي إذا كانت مجانية)</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h2><i className="fa-solid fa-sliders"></i> تفاصيل الكورس</h2></div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="field">
                    <label>المستوى</label>
                    <select name="level" defaultValue={course?.level || 'مبتدئ'}>
                      <option>مبتدئ</option><option>متوسط</option><option>متقدم</option><option>مبتدئ / متوسط</option>
                    </select>
                  </div>
                  <div className="field"><label>عدد المحاضرات (احتياطي)</label><input type="number" name="lessons_count" defaultValue={course?.lessons_count} placeholder="مثال: 12" /><div className="hint">يُحسب تلقائياً من المحاضرات المضافة</div></div>

                  {/* مدة الكورس: تلقائي أو يدوي */}
                  <div className="field full" style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <label style={{ fontWeight: '700', fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                        <i className="fa-regular fa-clock text-red"></i> مدة الكورس
                      </label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <label className="check" style={{ margin: 0, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="checkbox"
                            checked={isManual}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsManual(checked);
                              if (!checked && calculatedDuration) {
                                setDurationVal(calculatedDuration);
                              }
                            }}
                          />
                          <span>تحديد يدوي</span>
                        </label>
                        {calculatedDuration && (
                          <button
                            type="button"
                            className="btn btn-light btn-sm"
                            style={{ fontSize: '12px', padding: '4px 10px', color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}
                            onClick={() => {
                              setDurationVal(calculatedDuration);
                              setIsManual(false);
                            }}
                            title="حساب المدة تلقائياً من الفيديوهات المرفوعة"
                          >
                            <i className="fa-solid fa-wand-magic-sparkles"></i> استخدام الحساب التلقائي ({calculatedDuration})
                          </button>
                        )}
                      </div>
                    </div>

                    <input type="hidden" name="is_duration_manual" value={isManual ? "true" : "false"} />
                    <input
                      name="duration"
                      value={durationVal}
                      onChange={(e) => {
                        setDurationVal(e.target.value);
                        setIsManual(true);
                      }}
                      placeholder={isManual ? "اكتب مدة الكورس يدوياً (مثال: 8 ساعات)" : (calculatedDuration ? `محسوبة تلقائياً: ${calculatedDuration}` : "تُحسب تلقائياً من الفيديوهات المرفوعة")}
                    />

                    <div className="hint" style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                      {isManual ? (
                        <span><i className="fa-solid fa-pen" style={{ color: '#2563eb' }}></i> <b>الوضع اليدوي:</b> أنت تحدد مدة الكورس بنفسك، ولن يتم استبدالها تلقائياً عند رفع فيديوهات جديدة.</span>
                      ) : (
                        <span><i className="fa-solid fa-bolt text-red"></i> <b>الوضع التلقائي:</b> يتم احتساب مدة الكورس وتحديثها تلقائياً مع كل فيديو أو محاضرة ترفعها {calculatedDuration ? `(حالياً: ${calculatedDuration})` : '(سيتم الحساب فور رفع الفيديوهات)'}.</span>
                      )}
                    </div>
                  </div>

                  <div className="field"><label>ترتيب العرض</label><input type="number" name="sort_order" defaultValue={course?.sort_order || 0} placeholder="مثال: 1" /></div>
                  <div className="field"><label>ترتيبه في المسار التعليمي</label><input type="number" name="path_order" defaultValue={course?.path_order || 0} placeholder="مثال: 1" /></div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h2><i className="fa-solid fa-route"></i> التراك التعليمي (المسار)</h2></div>
              <div className="panel-body">
                <div className="field full">
                  <label>اختر التراك التابع له هذا الكورس</label>
                  <select name="track" defaultValue={course?.track?._id || course?.track || ''}>
                    <option value="">— بدون تراك (كورس منفصل غير تابع لتراك) —</option>
                    {tracks.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.title} (${t.price})
                      </option>
                    ))}
                  </select>
                  <div className="hint" style={{ marginTop: '6px' }}>
                    عند تحديد تراك، سيظهر الكورس كجزء من ذلك التراك ويتم تضمينه في باقة التراك الكاملة، مع تمكين الطالب من شرائه بمفرده أو مع التراك.
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h2><i className="fa-solid fa-tags"></i> التصنيفات</h2></div>
              <div className="panel-body">
                {categories.map(cat => (
                  <label key={cat._id} className="check" style={{ display: 'flex' }}>
                    <input type="checkbox" name="categories" value={cat._id} defaultChecked={course?.categories?.some(c => c._id === cat._id || c === cat._id)} />
                    {cat.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h2><i className="fa-solid fa-clock-rotate-left"></i> مدة صلاحية الاشتراك (إتاحة الكورس)</h2></div>
              <div className="panel-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="field">
                    <label>المدة المتاحة للطالب</label>
                    <input 
                      type="number" 
                      name="access_duration_value" 
                      defaultValue={course?.access_duration_value !== undefined ? course.access_duration_value : 1} 
                      min="1" 
                      placeholder="1"
                    />
                  </div>
                  <div className="field">
                    <label>وحدة المدة</label>
                    <select 
                      name="access_duration_unit" 
                      defaultValue={course?.access_duration_unit || 'years'}
                    >
                      <option value="hours">ساعة (Hours)</option>
                      <option value="days">يوم (Days)</option>
                      <option value="months">شهر (Months)</option>
                      <option value="years">سنة (Years - افتراضي)</option>
                      <option value="lifetime">مدى الحياة (دائم بلا انتهاء)</option>
                    </select>
                  </div>
                </div>
                <div className="hint" style={{ marginTop: '10px', fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
                  <i className="fa-solid fa-circle-info" style={{ color: 'var(--red)', marginLeft: '4px' }}></i>
                  يبدأ احتساب المدة من تاريخ تفعيل اشتراك الطالب. بعد انتهاء المدة يتم إغلاق الكورس تلقائياً ويلزم الطالب إعادة الشراء لفتحه مجدداً.
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h2><i className="fa-solid fa-certificate"></i> إعدادات الشهادة</h2></div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="field full">
                    <label className="check" style={{ marginBottom: '10px' }}>
                      <input type="checkbox" name="has_certificate" value="true" defaultChecked={course?.has_certificate} /> 
                      هذا الكورس يوفر شهادة إتمام للطلاب (إظهار الشهادة في صفحة الدورة)
                    </label>
                    <label className="check">
                      <input type="checkbox" name="is_certificate_active" value="true" defaultChecked={course?.is_certificate_active} /> 
                      تفعيل استخراج الشهادة الآن (الكورس مكتمل الدروس ومتاح للطلاب للحصول على الشهادة عند إتمامه)
                    </label>
                    <div className="hint" style={{ marginTop: '10px', color: '#94a3b8', fontSize: '13px' }}>
                      <i className="fa-solid fa-circle-info" style={{ color: '#d4af37', marginLeft: '6px' }}></i>
                      تعتمد الشهادة تلقائياً على التصميم المعتمد الموحد والإعدادات العامة في لوحة تحكم الشهادات.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: '#1a1c23', padding: '20px', borderRadius: '12px', marginTop: '30px', border: '1px solid #3d4052', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '15px 40px', fontSize: '18px', fontWeight: 'bold' }}>
            <i className="fa-solid fa-floppy-disk"></i> حفظ إعدادات الكورس
          </button>
        </div>
      </form>

      <UploadProgressModal
        isUploading={uploadState.isUploading}
        progress={uploadState.progress}
        loaded={uploadState.loaded}
        total={uploadState.total}
        title="جاري رفع البيانات وغلاف الكورس..."
      />
    </AdminLayout>
  );
}

export default CourseForm;
