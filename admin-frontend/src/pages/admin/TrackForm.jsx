import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import UploadProgressModal from '../../components/UploadProgressModal';
import { getAssetUrl } from '../../utils/assetUrl';

function TrackForm() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const navigate = useNavigate();

  const [track, setTrack] = useState(null);
  const [allCourses, setAllCourses] = useState([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [trackPrice, setTrackPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadState, setUploadState] = useState({ isUploading: false, progress: 0, loaded: 0, total: 0 });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const coursesRes = await api.get('/courses/admin/all');
      const coursesList = coursesRes.courses || [];
      setAllCourses(coursesList);

      if (id) {
        const tracksRes = await api.get('/tracks/admin/all');
        const found = (tracksRes.tracks || []).find(t => t._id === id);
        if (found) {
          setTrack(found);
          setTrackPrice(found.price !== undefined ? found.price : '');
          const initialCourseIds = (found.courses || []).map(c => typeof c === 'object' ? c._id : c);
          setSelectedCourseIds(initialCourseIds);
        }
      } else {
        setTrack(null);
        setTrackPrice('');
        setSelectedCourseIds([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCourseToggle = (courseId) => {
    setSelectedCourseIds(prev => {
      if (prev.includes(courseId)) {
        return prev.filter(c => c !== courseId);
      } else {
        return [...prev, courseId];
      }
    });
  };

  const selectAllCourses = () => {
    setSelectedCourseIds(allCourses.map(c => c._id));
  };

  const deselectAllCourses = () => {
    setSelectedCourseIds([]);
  };

  // Calculations
  const selectedCoursesObjects = allCourses.filter(c => selectedCourseIds.includes(c._id));
  const sumCoursesPrice = selectedCoursesObjects.reduce((acc, c) => acc + (Number(c.price) || 0), 0);
  const parsedTrackPrice = Number(trackPrice) || 0;
  const savings = Math.max(0, sumCoursesPrice - parsedTrackPrice);
  const savingsPercent = sumCoursesPrice > 0 && savings > 0 
    ? Math.round((savings / sumCoursesPrice) * 100) 
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    // Append courses as JSON array or multiple values
    fd.delete('courses');
    selectedCourseIds.forEach(cId => {
      fd.append('courses', cId);
    });

    if (e.target.has_certificate) {
      fd.set('has_certificate', e.target.has_certificate.checked);
    }
    if (e.target.is_certificate_active) {
      fd.set('is_certificate_active', e.target.is_certificate_active.checked);
    }

    const onProgress = (percent, loadedBytes, totalBytes) => {
      setUploadState({ isUploading: true, progress: percent, loaded: loadedBytes, total: totalBytes });
    };

    try {
      setUploadState({ isUploading: true, progress: 0, loaded: 0, total: 0 });
      let res;
      if (id) {
        res = await api.put(`/tracks/admin/${id}`, fd, true, onProgress);
        alert('تم حفظ تعديلات التراك بنجاح');
      } else {
        res = await api.post('/tracks/admin', fd, true, onProgress);
        alert('تم إنشاء التراك بنجاح');
      }
      navigate('/admin/tracks');
    } catch (err) {
      alert(err.message || 'حدث خطأ');
    } finally {
      setUploadState({ isUploading: false, progress: 0, loaded: 0, total: 0 });
    }
  };

  if (loading) {
    return (
      <AdminLayout title={id ? "تعديل التراك التعليمي" : "إضافة تراك تعليمي جديد"}>
        <div style={{ padding: '100px 0', textAlign: 'center' }}>
          <i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={id ? "تعديل التراك التعليمي" : "إضافة تراك تعليمي جديد"}>
      <form onSubmit={handleSubmit}>
        <div className="grid-3">
          {/* Main Info */}
          <div>
            <div className="panel">
              <div className="panel-head">
                <h2><i className="fa-solid fa-circle-info"></i> بيانات التراك الأساسية</h2>
              </div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="field">
                    <label>عنوان التراك (المسار التعليمي) *</label>
                    <input 
                      name="title" 
                      defaultValue={track?.title} 
                      required 
                      placeholder="مثال: دبلومة التسويق الرقمي الشاملة" 
                    />
                  </div>
                  <div className="field">
                    <label>رابط التراك (Slug)</label>
                    <input 
                      name="slug" 
                      dir="ltr" 
                      placeholder="digital-marketing-diploma" 
                      defaultValue={track?.slug} 
                    />
                    <div className="hint">يظهر في الرابط: /track/<b>slug</b> — اتركه فارغ للتوليد التلقائي</div>
                  </div>
                  <div className="field full">
                    <label>وصف مختصر (يظهر في كروت التراكات)</label>
                    <textarea 
                      name="short_desc" 
                      defaultValue={track?.short_desc} 
                      style={{ minHeight: '70px' }} 
                      placeholder="اكتب وصفاً موجزاً وجذاباً للمسار..."
                    ></textarea>
                  </div>
                  <div className="field full">
                    <label>وصف التراك بالتفصيل</label>
                    <textarea 
                      name="description" 
                      defaultValue={track?.description} 
                      style={{ minHeight: '140px' }} 
                      placeholder="اشرح بالتفصيل أهداف هذا التراك وما الذي يميزه..."
                    ></textarea>
                  </div>
                  <div className="field full">
                    <label>ماذا سيتعلم الطالب في هذا التراك؟ (كل نقطة في سطر)</label>
                    <textarea 
                      name="what_learn" 
                      defaultValue={track?.what_learn} 
                      placeholder="مثال:&#10;إتقان إعلانات فيسبوك وانستجرام من الصفر حتى الاحتراف&#10;استراتيجيات تحسين معدل التحويل والمبيعات"
                    ></textarea>
                  </div>
                  <div className="field full">
                    <label>لمن هذا التراك؟ (كل نقطة في سطر)</label>
                    <textarea 
                      name="audience" 
                      defaultValue={track?.audience} 
                      placeholder="مثال:&#10;المسوقين الراغبين في بناء مسار مهني متكامل&#10;أصحاب المتاجر الإلكترونية"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            {/* SEO */}
            <div className="panel">
              <div className="panel-head">
                <h2><i className="fa-solid fa-magnifying-glass"></i> تحسين محركات البحث (SEO)</h2>
              </div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="field full">
                    <label>Meta Title</label>
                    <input name="meta_title" defaultValue={track?.meta_title} placeholder="اتركه فارغ لاستخدام عنوان التراك" />
                  </div>
                  <div className="field full">
                    <label>Meta Description</label>
                    <textarea name="meta_desc" defaultValue={track?.meta_desc} style={{ minHeight: '70px' }} placeholder="اتركه فارغ لاستخدام الوصف المختصر"></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing, Courses & Settings */}
          <div>
            {/* Pricing Panel */}
            <div className="panel">
              <div className="panel-head">
                <h2><i className="fa-solid fa-tags"></i> تسعير باقة التراك الكاملة</h2>
              </div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="field">
                    <label>سعر باقة التراك بالكامل (بالدولار $) *</label>
                    <input 
                      type="number" 
                      name="price" 
                      value={trackPrice}
                      onChange={(e) => setTrackPrice(e.target.value)}
                      min="0" 
                      step="0.01" 
                      required 
                      placeholder="مثال: 99" 
                    />
                    <div className="hint">السعر الموحد الذي يدفعه الطالب لشراء جميع كورسات التراك دفعة واحدة.</div>
                  </div>
                  <div className="field">
                    <label>السعر قبل الخصم (اختياري $)</label>
                    <input 
                      type="number" 
                      name="old_price" 
                      defaultValue={track?.old_price} 
                      min="0" 
                      step="0.01" 
                      placeholder={sumCoursesPrice ? `مثال: ${sumCoursesPrice}` : "مثال: 150"} 
                    />
                    <div className="hint">اتركه فارغاً أو حدده لإظهار شطب على السعر القديم.</div>
                  </div>

                  {/* Real-time Calculation Summary Box */}
                  <div className="field full">
                    <div style={{
                      background: '#0f172a',
                      color: '#fff',
                      borderRadius: '12px',
                      padding: '16px',
                      border: '1px solid #1e293b'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>عدد الكورسات المختارة:</span>
                        <strong style={{ fontSize: '15px', color: '#38bdf8' }}>{selectedCourseIds.length} كورس</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>مجموع أسعار الكورسات الفردية:</span>
                        <strong style={{ fontSize: '15px', color: '#e2e8f0' }}>${sumCoursesPrice}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>سعر باقة التراك المطلوب:</span>
                        <strong style={{ fontSize: '16px', color: '#4ade80' }}>${parsedTrackPrice}</strong>
                      </div>
                      <hr style={{ borderColor: '#334155', margin: '10px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: '#fbbf24' }}>التوفير الفعلي للطالب:</span>
                        <strong style={{ fontSize: '14px', color: '#fbbf24' }}>
                          وفر ${savings} ({savingsPercent}% خصم)
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="field full">
                    <label className="check">
                      <input 
                        type="checkbox" 
                        name="is_published" 
                        value="true" 
                        defaultChecked={track ? track.is_published : true} 
                      /> 
                      <span>منشور ومتاح على الموقع</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Courses Selection Panel */}
            <div className="panel">
              <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <h2><i className="fa-solid fa-layer-group"></i> الكورسات داخل التراك ({selectedCourseIds.length})</h2>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={selectAllCourses} className="btn btn-light btn-sm" style={{ fontSize: '11px', padding: '3px 8px' }}>
                    تحديد الكل
                  </button>
                  <button type="button" onClick={deselectAllCourses} className="btn btn-light btn-sm" style={{ fontSize: '11px', padding: '3px 8px' }}>
                    إلغاء الكل
                  </button>
                </div>
              </div>
              <div className="panel-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#64748b' }}>
                  اختر الكورسات التي يتضمنها هذا التراك. كل كورس يحتفظ بسعره الفردي ويتمكن الطالب من شرائه منفرداً أو شراء التراك كاملاً.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {allCourses.map(c => {
                    const isSelected = selectedCourseIds.includes(c._id);
                    return (
                      <label 
                        key={c._id} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          background: isSelected ? '#f0fdf4' : '#fff',
                          border: isSelected ? '1px solid #86efac' : '1px solid #e2e8f0',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleCourseToggle(c._id)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <img
                          src={getAssetUrl(c.image, '/assets/img/courses/default.svg')}
                          alt=""
                          style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover' }}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/assets/img/courses/default.svg';
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ display: 'block', fontSize: '13.5px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.title}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {c.lessons || c.lessons_count || 0} درس {c.duration ? `• ${c.duration}` : ''}
                          </span>
                        </div>
                        <div style={{ fontWeight: '800', fontSize: '14px', color: c.price > 0 ? '#16a34a' : '#2563eb' }}>
                          ${c.price}
                        </div>
                      </label>
                    );
                  })}
                  {allCourses.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                      لا توجد كورسات مضافة في المنصة بعد.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Media & Duration */}
            <div className="panel">
              <div className="panel-head">
                <h2><i className="fa-solid fa-photo-film"></i> الغلاف وإعدادات الصلاحية</h2>
              </div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="field full">
                    <label>صورة غلاف التراك (Cover)</label>
                    {track?.image && (
                      <img 
                        src={getAssetUrl(track.image)} 
                        alt="" 
                        style={{ width: '100%', marginBottom: '10px', borderRadius: '8px', maxHeight: '180px', objectFit: 'cover' }} 
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <input type="file" name="image" accept="image/*" />
                    <div className="hint">المقاس المقترح 1600×1000 بكسل (JPG / PNG / WEBP)</div>
                  </div>

                  <div className="field">
                    <label>مدة صلاحية اشتراك التراك</label>
                    <input 
                      type="number" 
                      name="access_duration_value" 
                      defaultValue={track?.access_duration_value !== undefined ? track.access_duration_value : 1} 
                      min="1" 
                    />
                  </div>
                  <div className="field">
                    <label>وحدة المدة</label>
                    <select 
                      name="access_duration_unit" 
                      defaultValue={track?.access_duration_unit || 'years'}
                    >
                      <option value="hours">ساعة (Hours)</option>
                      <option value="days">يوم (Days)</option>
                      <option value="months">شهر (Months)</option>
                      <option value="years">سنة (Years - افتراضي)</option>
                      <option value="lifetime">مدى الحياة (دائم)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>أيقونة التراك (FontAwesome)</label>
                    <input name="icon" defaultValue={track?.icon || 'fa-solid fa-route'} placeholder="fa-solid fa-route" />
                  </div>
                  <div className="field">
                    <label>ترتيب العرض</label>
                    <input type="number" name="sort_order" defaultValue={track?.sort_order || 0} placeholder="0" />
                  </div>
                </div>
              </div>
            </div>

            {/* Certificate Settings */}
            <div className="panel">
              <div className="panel-head">
                <h2><i className="fa-solid fa-certificate"></i> إعدادات شهادة التراك المعتمدة</h2>
              </div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="field full">
                    <label className="check" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        name="has_certificate" 
                        value="true" 
                        defaultChecked={track?.has_certificate !== false} 
                        style={{ width: '18px', height: '18px', accentColor: '#c81e1e' }}
                      /> 
                      <span style={{ fontWeight: '600' }}>هذا المسار يوفر شهادة إتمام للطلاب (إظهار الشهادة في صفحة المسار التعليمي)</span>
                    </label>
                    <label className="check" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        name="is_certificate_active" 
                        value="true" 
                        defaultChecked={track?.is_certificate_active !== false} 
                        style={{ width: '18px', height: '18px', accentColor: '#c81e1e' }}
                      /> 
                      <span style={{ fontWeight: '600' }}>تفعيل استخراج الشهادة الآن (المسار مكتمل ومتاح للطلاب للحصول على الشهادة عند إتمامه 100%)</span>
                    </label>
                    <div className="hint" style={{ marginTop: '10px', color: '#94a3b8', fontSize: '13px' }}>
                      <i className="fa-solid fa-circle-info" style={{ color: '#d4af37', marginLeft: '6px' }}></i>
                      تعتمد الشهادة تلقائياً على التصميم المعتمد الموحد والإعدادات العامة في لوحة تحكم الشهادات.
                    </div>
                  </div>

                  <div className="field full" style={{ marginTop: '10px' }}>
                    <label>اسم المدرب / المحاضر المعتمد على شهادة المسار (اختياري)</label>
                    <input 
                      name="instructor_name" 
                      defaultValue={track?.instructor_name || ''} 
                      placeholder="اتركه فارغاً لاستخدام الاسم الافتراضي من إعدادات الشهادات العامة" 
                    />
                  </div>

                  {/* تخصيص لوجو أو توقيع خاص بالتراك (اختياري) */}
                  <div className="field full" style={{ marginTop: '10px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '12px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-stamp text-red"></i> تخصيصات إضافية لشهادة التراك (اختياري)
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>لوجو مخصص للشهادة:</label>
                        {track?.certificate_logo && (
                          <div style={{ marginBottom: '8px', padding: '4px 10px', background: '#0f172a', borderRadius: '6px', width: 'fit-content' }}>
                            <img src={getAssetUrl(track.certificate_logo)} alt="" style={{ maxHeight: '35px', maxWidth: '120px', objectFit: 'contain' }} />
                          </div>
                        )}
                        <input type="file" name="certificate_logo" accept="image/*" style={{ fontSize: '12px' }} />
                        <div className="hint" style={{ fontSize: '11px', marginTop: '4px' }}>يحل محل لوجو المنصة الافتراضي على شهادة هذا التراك فقط</div>
                      </div>

                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>توقيع مخصص للمدرب:</label>
                        {track?.instructor_signature && (
                          <div style={{ marginBottom: '8px', padding: '4px 10px', background: '#f1f5f9', borderRadius: '6px', width: 'fit-content' }}>
                            <img src={getAssetUrl(track.instructor_signature)} alt="" style={{ maxHeight: '35px', maxWidth: '120px', objectFit: 'contain' }} />
                          </div>
                        )}
                        <input type="file" name="instructor_signature" accept="image/*" style={{ fontSize: '12px' }} />
                        <div className="hint" style={{ fontSize: '11px', marginTop: '4px' }}>يحل محل التوقيع الافتراضي على شهادة هذا التراك فقط</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div style={{
          background: '#1a1c23',
          padding: '20px',
          borderRadius: '12px',
          marginTop: '30px',
          border: '1px solid #3d4052',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <Link to="/admin/tracks" className="btn btn-dark" style={{ background: '#2d303e' }}>
            <i className="fa-solid fa-arrow-right"></i> الرجوع للتراكات
          </Link>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ padding: '14px 36px', fontSize: '17px', fontWeight: 'bold' }}
          >
            <i className="fa-solid fa-floppy-disk"></i> {id ? 'حفظ تعديلات التراك' : 'إنشاء وحفظ التراك'}
          </button>
        </div>
      </form>

      <UploadProgressModal
        isUploading={uploadState.isUploading}
        progress={uploadState.progress}
        loaded={uploadState.loaded}
        total={uploadState.total}
        title="جاري رفع بيانات وغلاف التراك..."
      />
    </AdminLayout>
  );
}

export default TrackForm;
