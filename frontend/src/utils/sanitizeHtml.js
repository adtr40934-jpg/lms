import DOMPurify from 'dompurify';

export function sanitizeHtml(value) {
  return DOMPurify.sanitize(typeof value === 'string' ? value : '', {
    USE_PROFILES: { html: true }
  });
}
