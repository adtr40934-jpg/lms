import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { getAssetUrl } from '../../utils/assetUrl';

/**
 * Universal SEO & Head Management Component for React 19 / Vite SPA
 * Dynamically synchronizes document title, standard meta tags, Open Graph,
 * Twitter cards, canonical URLs, robots directives, and JSON-LD structured data.
 */
export default function SEO({
  title,
  rawTitle = false,
  description,
  canonical,
  keywords,
  ogType = 'website',
  ogImage,
  robots = 'index, follow',
  schema,
  author = 'محمد بهاء'
}) {
  const { settings } = useSettings();
  const location = useLocation();

  useEffect(() => {
    const siteName = settings?.site_name || 'منصة محمد بهاء التعليمية';
    const siteSubtitle = settings?.site_subtitle || 'بتاع تسويق';
    const defaultDesc =
      settings?.meta_desc ||
      'منصة تعليمية متخصصة في تدريب وتطوير مهارات التسويق الرقمي والإعلانات الممولة وصناعة المحتوى بإشراف المدرب محمد بهاء.';

    // 1. Document Title
    const finalTitle = rawTitle
      ? title || siteName
      : title
        ? `${title} | ${siteName}`
        : `${siteName} - ${siteSubtitle}`;

    document.title = finalTitle;

    // Helper to update or create <meta> tags
    const setMeta = (attrName, attrValue, content) => {
      if (!content && content !== '') return;
      let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Helper to update or create <link> tags
    const setLink = (rel, href) => {
      if (!href) return;
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    // 2. Canonical URL Resolution
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let finalCanonical = canonical;
    if (!finalCanonical) {
      finalCanonical = `${origin}${location.pathname}`;
    } else if (finalCanonical.startsWith('/')) {
      finalCanonical = `${origin}${finalCanonical}`;
    }

    setLink('canonical', finalCanonical);

    // 3. Standard SEO Meta Tags
    const finalDescription = description || defaultDesc;
    setMeta('name', 'description', finalDescription);
    setMeta('name', 'author', author);
    setMeta('name', 'robots', robots);
    setMeta('name', 'googlebot', robots);

    if (keywords) {
      const kwString = Array.isArray(keywords) ? keywords.join(', ') : keywords;
      setMeta('name', 'keywords', kwString);
    }

    // 4. Open Graph & Social Sharing
    let finalOgImage = ogImage;
    if (!finalOgImage) {
      if (settings?.site_logo) {
        finalOgImage = getAssetUrl(settings.site_logo);
      } else {
        finalOgImage = `${origin}/assets/img/og-preview.jpg`;
      }
    } else if (finalOgImage.startsWith('/')) {
      finalOgImage = `${origin}${finalOgImage}`;
    }

    setMeta('property', 'og:site_name', siteName);
    setMeta('property', 'og:title', finalTitle);
    setMeta('property', 'og:description', finalDescription);
    setMeta('property', 'og:url', finalCanonical);
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:image', finalOgImage);
    setMeta('property', 'og:locale', 'ar_AR');

    // 5. Twitter Card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', finalTitle);
    setMeta('name', 'twitter:description', finalDescription);
    setMeta('name', 'twitter:image', finalOgImage);

    // 6. JSON-LD Structured Data
    const scriptId = 'seo-structured-data';
    let scriptEl = document.getElementById(scriptId);

    if (schema) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = scriptId;
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(schema, null, 2);
    } else if (scriptEl) {
      scriptEl.remove();
    }

    return () => {
      // Cleanup script on unmount if needed
    };
  }, [
    title,
    rawTitle,
    description,
    canonical,
    keywords,
    ogType,
    ogImage,
    robots,
    schema,
    author,
    settings,
    location.pathname
  ]);

  return null;
}
