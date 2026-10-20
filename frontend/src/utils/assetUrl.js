/**
 * Resolves uploaded asset URLs to point to the backend host properly,
 * whether running on localhost or via local network IP on mobile.
 */
export function getAssetUrl(path, fallback = '/assets/img/courses/default.svg') {
  if (!path || typeof path !== 'string' || !path.trim()) {
    return fallback;
  }

  const trimmed = path.trim();

  // Already a full URL or blob
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

  return `${getBackendOrigin()}/${cleanPath}`;
}

/**
 * Ensures an external link (like Facebook, Telegram, WhatsApp, etc.)
 * starts with http:// or https:// so the browser doesn't treat it as a relative path.
 */
export function formatExternalUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#' || trimmed.startsWith('/') || /^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

import { getBackendOrigin } from './backendUrl';

