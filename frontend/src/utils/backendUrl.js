export function getBackendOrigin() {
  if (import.meta.env.VITE_API_URL) {
    try { return new URL(import.meta.env.VITE_API_URL).origin; } catch { /* use the local fallback */ }
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    const isStandardPort = !window.location.port || window.location.port === '80' || window.location.port === '443';
    if (isStandardPort) return window.location.origin;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:5000`;
  }
  return 'http://localhost:5000';
}

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL || `${getBackendOrigin()}/api`;
}
