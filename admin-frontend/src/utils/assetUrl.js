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
import { getBackendOrigin } from './backendUrl';

