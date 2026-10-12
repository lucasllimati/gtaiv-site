import DOMPurify from 'dompurify';
import { Marked } from 'marked';
import { BASE } from './env.ts';

/**
 * Markdown editorial → HTML seguro.
 * HTML bruto no texto é escapado; o resultado ainda passa pelo DOMPurify com lista restrita de tags.
 * Links internos ("/personagens") recebem o base path; externos abrem em nova aba com rel seguro.
 */
const marked = new Marked({ gfm: true, breaks: false });
marked.use({
  renderer: {
    html({ text }) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
  },
});

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'hr', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'del'];
const ALLOWED_ATTR = ['href', 'title', 'alt', 'src', 'loading'];

let hooked = false;
function ensureHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? '';
      if (/^https?:\/\//i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      } else if (href.startsWith('/') && !href.startsWith('//')) {
        node.setAttribute('href', BASE.replace(/\/$/, '') + href);
      }
    }
    if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
  });
}

export function renderMarkdown(md: string): string {
  ensureHooks();
  const html = marked.parse(md, { async: false });
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [...ALLOWED_ATTR, 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:https?:|\/|#)/i,
  });
}
