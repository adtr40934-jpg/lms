const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
];

function parseAllowedOrigins(...values) {
  const configured = values
    .filter(Boolean)
    .flatMap(value => value.split(','))
    .map(value => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_ORIGINS, ...configured]));
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return true;
  if (typeof origin !== 'string') return false;

  const cleanOrigin = origin.replace(/\/+$/, '');
  if (allowedOrigins.includes(cleanOrigin)) return true;

  try {
    const parsed = new URL(cleanOrigin);
    if (parsed.origin !== cleanOrigin || !['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    return false;
  } catch {
    return false;
  }
}

module.exports = { parseAllowedOrigins, isOriginAllowed };
