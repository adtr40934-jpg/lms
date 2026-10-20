import { Link } from 'react-router-dom';
import { usePageReady } from '../hooks/usePageReady';
import SEO from '../components/common/SEO';

function Subscribe() {
  usePageReady(true);
  return (
    <main>
      <SEO
        title="طريقة الاشتراك في المنصة"
        description="تعرف على خطوات الاشتراك والتسجيل في كورسات منصة محمد بهاء التعليمية وطرق الدفع المتاحة."
        canonical="/subscribe"
      />
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">الرئيسية</Link><i className="fa-solid fa-chevron-left"></i><span>طريقة الاشتراك</span>
          </div>
          <h1>طريقة الاشتراك في المنصة</h1>
          <p>الدفع متاح الآن يدوياً من خلال المحافظ الإلكترونية، تعرف على الخطوات وابدأ رحلتك التعليمية الآن.</p>
        </div>
      </section>

      <section className="section section-gray">
        <div className="container">
          
          <div className="section-head reveal">
            <span className="section-tag" style={{ background: 'linear-gradient(135deg, #c81e1e 0%, #000 100%)', color: '#fff', border: 'none', boxShadow: '0 8px 20px rgba(200,30,30,0.3)', padding: '8px 20px', fontSize: '15px' }}>٤ خطوات تفصلك عن البداية</span>
            <h2 style={{ marginTop: '20px' }}>كيف تبدأ رحلتك معنا؟</h2>
            <p>اتبع هذه الخطوات البسيطة لتفعيل اشتراكك وبدء التعلم فوراً</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            <div className="feature reveal">
              <div className="ic"><i className="fa-solid fa-user-plus"></i></div>
              <h3>1. أنشئ حسابك</h3>
              <p>قم بعمل <Link to="/register?redirect=/checkout" style={{ color: 'var(--red)', fontWeight: 'bold' }}>حساب جديد</Link> على المنصة بخطوات بسيطة ومجانية للبدء.</p>
            </div>
            
            <div className="feature reveal reveal-d1">
              <div className="ic"><i className="fa-solid fa-money-bill-transfer"></i></div>
              <h3>2. حوّل قيمة الكورس</h3>
              <p>قم باختيار الكورس الذي ترغب باشتراكه وحوّل قيمته عن طريق إنستاباي أو المحافظ الإلكترونية.</p>
            </div>
            
            <div className="feature reveal reveal-d2">
              <div className="ic"><i className="fa-solid fa-image"></i></div>
              <h3>3. احتفظ بالـ Screenshot</h3>
              <p>لا تنسَ التقاط صورة لشاشة التحويل (Screenshot) توضح المبلغ واسم المرسل بوضوح.</p>
            </div>
            
            <div className="feature reveal reveal-d3">
              <div className="ic"><i className="fa-solid fa-circle-check"></i></div>
              <h3>4. تأكيد الدفع</h3>
              <p>انتقل لصفحة الكورس واضغط على شراء، ثم قم برفع الإيصال ليتم مراجعته وتفعيل الكورس.</p>
            </div>
          </div>

          <div className="reveal" style={{ maxWidth: '800px', margin: '0 auto 40px', background: '#fff', border: '1px solid #fecaca', borderRadius: '16px', padding: 'clamp(14px, 3vw, 24px)', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fef2f2', color: '#c81e1e', display: 'grid', placeItems: 'center', fontSize: '18px', flexShrink: 0 }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '4px', color: '#b91c1c' }}>ملاحظة هامة جداً</h4>
              <p style={{ color: '#7f1d1d', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>لا يتم تفعيل الكورس تلقائياً بمجرد التحويل، يجب عليك إرفاق إيصال الدفع من داخل صفحة الكورس ليتم مراجعته يدوياً من قبل الدعم الفني وتفعيل حسابك.</p>
            </div>
          </div>

          <div className="center reveal">
            <Link to="/courses" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '16px' }}>
              <i className="fa-solid fa-arrow-left"></i> تصفح الكورسات وابدأ الآن
            </Link>
          </div>

        </div>
      </section>
    </main>
  );
}

export default Subscribe;
