import { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { api } from '../../api';

function Categories() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/categories');
      setCats(res.categories || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/categories', Object.fromEntries(fd));
      e.target.reset();
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdate = async (id, e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.put(`/categories/${id}`, Object.fromEntries(fd));
      alert('تم تحديث التصنيف');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = (id) => {
    window.SwalConfirm('هل أنت متأكد من حذف التصنيف؟', async () => {
      try {
        await api.delete(`/categories/${id}`);
        fetchData();
      } catch (err) {
        alert(err.message);
      }
    });
  };

  if (loading) return <AdminLayout title="تصنيفات الكورسات"><div style={{ padding: '100px 0', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i></div></AdminLayout>;

  return (
    <AdminLayout title="تصنيفات الكورسات">
      <div className="panel">
        <div className="panel-head"><h2><i className="fa-solid fa-plus"></i> إضافة تصنيف</h2></div>
        <div className="panel-body">
          <form className="inline-form" onSubmit={handleAdd}>
            <input name="name" placeholder="اسم التصنيف (مثال: إعلانات ميتا وفيس بوك)" required />
            <input name="slug" dir="ltr" placeholder="meta-ads" required />
            <input name="icon" dir="ltr" placeholder="fa-solid fa-bullhorn" />
            <input name="sort_order" type="number" defaultValue="0" style={{ width: '70px' }} />
            <button className="btn btn-primary btn-sm">إضافة</button>
          </form>
          <p className="muted" style={{ fontSize: '13px', marginTop: '8px' }}>الأيقونات من مكتبة Font Awesome (مثال: fa-solid fa-bullhorn).</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h2><i className="fa-solid fa-tags"></i> التصنيفات</h2></div>
        <div className="panel-body">
          {cats.map(k => (
            <div key={k._id} className="lesson-item" style={{ border: '1px solid #eee', borderRadius: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span className="n"><i className={k.icon || 'fa-solid fa-tag'}></i></span>
              <form className="inline-form" style={{ flex: 1, minWidth: '300px' }} onSubmit={(e) => handleUpdate(k._id, e)}>
                <input name="name" defaultValue={k.name} required />
                <input name="slug" dir="ltr" defaultValue={k.slug} required />
                <input name="icon" dir="ltr" defaultValue={k.icon} />
                <input name="sort_order" type="number" defaultValue={k.sort_order} style={{ width: '70px' }} />
                <button type="submit" className="btn btn-light btn-sm">حفظ</button>
              </form>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <form onSubmit={(e) => { e.preventDefault(); handleDelete(k._id); }}>
                  <button type="submit" className="btn btn-danger btn-sm btn-icon"><i className="fa-solid fa-trash"></i></button>
                </form>
              </div>
            </div>
          ))}
          {cats.length === 0 && <p className="muted">لا توجد تصنيفات بعد.</p>}
        </div>
      </div>
    </AdminLayout>
  );
}

export default Categories;
