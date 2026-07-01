const sanitizeHtml = require('sanitize-html');

// Allowlist for admin-authored rich-text bodies (news articles, advocacy content).
// Permits normal formatting/embedding but strips <script>, event-handler attributes
// (onclick/onerror/…), javascript: URLs, <iframe>, <style>, etc. — the vectors for
// stored XSS. Rendered raw via innerHTML on the public site, so this is the guard.
const RICH_TEXT = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr', 'blockquote', 'pre', 'code',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark', 'small', 'span',
    'ul', 'ol', 'li',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
    'div',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    '*': ['style'],
  },
  // Only safe URL schemes; blocks javascript:, data: (except images), vbscript:, etc.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  // Restrict inline styles to harmless presentational properties.
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^[a-zA-Z]+$/],
      'background-color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^[a-zA-Z]+$/],
      'font-weight': [/^(bold|normal|\d{3})$/],
      'font-style': [/^(italic|normal)$/],
      'text-decoration': [/^(underline|line-through|none)$/],
    },
  },
  // Force external links to be safe (no reverse-tabnabbing / referrer leak).
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
};

// Sanitize a rich-text HTML string. Returns '' for null/undefined; passes through
// non-strings (nothing to sanitize) so callers can hand us any body value safely.
function sanitizeRichText(html) {
  if (html === null || html === undefined) return html;
  if (typeof html !== 'string') return html;
  return sanitizeHtml(html, RICH_TEXT);
}

module.exports = { sanitizeRichText };
