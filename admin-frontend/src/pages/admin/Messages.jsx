import { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import api from '../../api/axios';

function Messages() {
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/messages/admin');
      setMsgs(data.messages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRead = async (id, currentStatus) => {
    try {
      // Assuming patch simply toggles or we can pass a value if needed.
      // Usually marking as read is sufficient, but we will call the endpoint.
      await api.patch(`/messages/admin/${id}/read`);
      setMsgs(msgs.map(m => m._id === id ? { ...m, is_read: true } : m));
    } catch (err) {
      alert('حدث خطأ');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await api.delete(`/messages/admin/${id}`);
      setMsgs(msgs.filter(m => m._id !== id));
    } catch (err) {
      alert('حدث خطأ أثناء الحذف');
    }
  };

  return (
    <AdminLayout title="رسائل التواصل">
      <div className="panel">
        <div className="panel-head"><h2><i className="fa-solid fa-envelope"></i> الرسائل ({msgs.length})</h2></div>
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>جاري التحميل...</div>
          ) : (
            <table>
              <thead>
                <tr><th>المرسل</th><th>الرسالة</th><th>التاريخ</th><th>الحالة</th><th></th></tr>
              </thead>
              <tbody>
                {msgs.map(m => (
                  <tr key={m._id} style={m.is_read ? {} : { background: '#fffafa' }}>
                    <td>
                      <strong>{m.name}</strong>
                      <span className="sub ltr">{m.phone}</span>
                      <span className="sub ltr">{m.email}</span>
                    </td>
                    <td style={{ maxWidth: '460px', whiteSpace: 'pre-line' }}>{m.message}</td>
                    <td className="ltr" style={{ fontSize: '13px' }}>{new Date(m.created_at).toLocaleDateString()}</td>
                    <td><span className={`pill ${m.is_read ? 'p-gray' : 'st-pending'}`}>{m.is_read ? 'مقروءة' : 'جديدة'}</span></td>
                    <td>
                      <div className="row-actions">
                        {m.phone && <a className="btn btn-success btn-sm btn-icon" target="_blank" rel="noreferrer" href={`https://wa.me/2${m.phone}`}><i className="fa-brands fa-whatsapp"></i></a>}
                        {!m.is_read && (
                          <button className="btn btn-light btn-sm" onClick={() => toggleRead(m._id, m.is_read)}>تمت القراءة</button>
                        )}
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(m._id)}><i className="fa-solid fa-trash"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {msgs.length === 0 && (
                  <tr><td colSpan="5" className="empty"><i className="fa-regular fa-envelope"></i>لا توجد رسائل</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default Messages;
