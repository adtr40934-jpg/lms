function renderErrorPage({ status = 404, title = 'حدث خطأ', message = 'الصفحة غير موجودة', subMessage = '' } = {}) {
  const safeStatus = Number(status) || 500;
  const safeTitle = String(title || '');
  const safeMessage = String(message || '');
  const safeSubMessage = String(subMessage || '');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeStatus} - ${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 60%, #020617 100%);
      font-family: 'Cairo', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #f8fafc;
      padding: 24px;
      overflow-x: hidden;
    }
    .card {
      max-width: 520px;
      width: 100%;
      text-align: center;
      background: rgba(30, 41, 59, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      padding: 48px 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.18);
    }
    .status-code {
      font-size: clamp(4.5rem, 12vw, 6.5rem);
      font-weight: 900;
      line-height: 1;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #f43f5e 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -2px;
      user-select: none;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 12px;
      color: #f1f5f9;
    }
    p {
      font-size: 1rem;
      line-height: 1.6;
      color: #94a3b8;
      margin-bottom: 12px;
    }
    .sub-msg {
      font-size: 0.875rem;
      color: #64748b;
      margin-bottom: 28px;
      font-family: 'Inter', sans-serif;
      direction: ltr;
    }
    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
      font-family: inherit;
    }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="status-code">${safeStatus}</div>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    ${safeSubMessage ? `<div class="sub-msg">${safeSubMessage}</div>` : ''}
    <div class="actions">
      <a href="/" class="btn btn-primary">الرئيسية / Home</a>
      <button onclick="window.history.back()" class="btn btn-secondary">رجوع / Back</button>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderErrorPage };
