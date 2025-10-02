import { createElement } from './helpers.js';

function formatDate(value) {
  if (!value) {
    return 'Unknown';
  }
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return value;
  }
}

export function FooterMeta(options) {
  const { sources, generatedAt, auditLink } = options;
  const footer = createElement('footer', {
    className: 'gear-footer',
    attrs: { 'data-testid': 'footer-meta' },
  });

  const list = createElement('ul', { className: 'footer-links' });

  if (sources?.length) {
    const sourceList = createElement('li');
    sourceList.append('Data Sources: ');
    sources.forEach((source, index) => {
      const link = createElement('a', {
        text: source.category,
        attrs: { href: source.path },
      });
      sourceList.append(link);
      if (index < sources.length - 1) {
        sourceList.append(', ');
      }
    });
    list.appendChild(sourceList);
  }

  if (auditLink) {
    list.appendChild(
      createElement('li', {}, [
        createElement('a', { text: 'Audit Report', attrs: { href: auditLink } }),
      ]),
    );
  }

  list.appendChild(createElement('li', { text: `Last Updated: ${formatDate(generatedAt)}` }));

  footer.appendChild(list);
  return footer;
}
