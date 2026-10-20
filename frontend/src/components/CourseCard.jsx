import { Link } from 'react-router-dom';
import { getAssetUrl } from '../utils/assetUrl';

function CourseCard({ course, index }) {
  const off = (course.old_price && course.old_price > course.price) 
    ? Math.round(100 - (course.price / course.old_price) * 100) 
    : 0;

  const coverUrl = getAssetUrl(course.image, '/assets/img/courses/default.svg');

  return (
    <article className={`course-card ${course.is_soon ? 'is-soon' : ''} reveal reveal-d${(index % 3) + 1}`}>
      <Link to={`/course/${course.slug}`} className="course-thumb">
        <img 
          src={coverUrl} 
          alt={`كورس ${course.title}`} 
          loading="lazy" 
          width="800" 
          height="500" 
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/assets/img/courses/default.svg';
          }}
        />
        {course.is_soon ? (
          <div className="course-thumb-soon-overlay">
            <span className="soon-pill-badge">
              <i className="fa-solid fa-hourglass-start"></i> قريباً Soon
            </span>
          </div>
        ) : (
          <>
            <span className="course-badge"><i className="fa-solid fa-signal"></i> {course.level}</span>
            {off > 0 && <span className="course-discount">خصم {off}%</span>}
          </>
        )}
      </Link>
      <div className="course-body">
        <div className="course-cats">
          {course.track && (
            <span style={{ background: '#fef2f2', color: '#c81e1e', fontWeight: 'bold' }}>
              <i className="fa-solid fa-route" style={{ marginInlineEnd: '3px' }}></i> {course.track.title}
            </span>
          )}
          {course.categories?.slice(0, 2).map((cat, i) => (
            <span key={i}>{cat.name}</span>
          ))}
        </div>
        <h3><Link to={`/course/${course.slug}`}>{course.title}</Link></h3>
        <p>{course.short_desc}</p>
        <div className="course-meta">
          <span><i className="fa-solid fa-circle-play"></i>{course.lessons_count || 0} درس</span>
          <span><i className="fa-regular fa-clock"></i>{course.duration}</span>
        </div>
        <div className="course-foot" style={course.enrolled ? { flexDirection: 'column', gap: '12px', alignItems: 'stretch' } : {}}>
          {course.enrolled ? (
            <>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', color: 'var(--accent, #aa3bff)' }}>
                  <strong>نسبة الإنجاز</strong>
                  <strong>{course.progress_percent || 0}%</strong>
                </div>
                <div style={{ height: '6px', background: 'var(--border, #e5e4e7)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--accent, #aa3bff)', width: `${course.progress_percent || 0}%` }}></div>
                </div>
              </div>
              <Link to={`/account/learn/${course.slug}`} className="btn btn-primary btn-sm" style={{ justifyContent: 'center' }}>متابعة التعلم <i className="fa-solid fa-play"></i></Link>
            </>
          ) : course.is_soon ? (
            <>
              <div className="price" style={{ color: '#d97706', fontSize: '16px', fontWeight: '800' }}>
                <i className="fa-regular fa-clock" style={{ marginInlineEnd: '4px' }}></i> يتاح قريباً
              </div>
              <button type="button" className="btn btn-soon btn-sm" disabled>
                قريباً <i className="fa-solid fa-lock"></i>
              </button>
            </>
          ) : (
            <>
              <div className="price">
                {off > 0 && <del>${Number(course.old_price).toLocaleString()}</del>}
                ${Number(course.price).toLocaleString()}
              </div>
              <Link to={`/course/${course.slug}`} className="btn btn-dark btn-sm">تفاصيل الكورس <i className="fa-solid fa-arrow-left"></i></Link>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default CourseCard;
