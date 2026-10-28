let nextField = 0;

/** Dynamic content is always text or DOM nodes, never imported HTML. */
export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  const append = value => {
    if (Array.isArray(value)) value.forEach(append);
    else if (value !== null && value !== undefined && value !== false) node.append(value instanceof Node ? value : document.createTextNode(String(value)));
  };
  children.forEach(append);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'className') node.className = value;
    else if (key === 'htmlFor') node.htmlFor = value;
    else if (['value', 'checked', 'disabled', 'required', 'multiple', 'hidden', 'selected'].includes(key)) node[key] = value;
    else node.setAttribute(key, String(value));
  }
  return node;
}

export function button(label, onClick, { variant = 'secondary', disabled = false, type = 'button', ...attributes } = {}) {
  return el('button', { type, className: `button button--${variant}`, disabled, onClick, ...attributes }, label);
}

export function field(label, input, { hint, error } = {}) {
  if (!input.id) input.id = `field-${++nextField}`;
  const description = [];
  const children = [el('label', { htmlFor: input.id }, label), input];
  if (hint) {
    const id = `${input.id}-hint`;
    description.push(id);
    children.push(el('p', { id, className: 'field__hint' }, hint));
  }
  if (error) {
    const id = `${input.id}-error`;
    description.push(id);
    children.push(el('p', { id, className: 'field__error' }, error));
    input.setAttribute('aria-invalid', 'true');
  }
  if (description.length) input.setAttribute('aria-describedby', description.join(' '));
  return el('div', { className: 'field' }, children);
}

export function notice(text, kind = 'info') {
  return el('div', { className: `notice notice--${kind}`, role: kind === 'error' ? 'alert' : 'status' }, text);
}

export function emptyState(title, description, action = null) {
  return el('section', { className: 'empty-state' }, el('span', { className: 'empty-state__mark', 'aria-hidden': 'true' }, '○'),
    el('h2', {}, title), el('p', {}, description), action);
}

export function formatDate(value) {
  if (value === null) return 'Por confirmar';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function formatPoints(units) {
  if (!Number.isSafeInteger(units)) throw new TypeError('Invalid points payload');
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(units / 2);
}
