// Authored T2 DOM primitives only: no HTML parser, layout, browser or network.
class AuthoredNode {
  constructor(tagName = null, value = '') {
    this.tagName = tagName?.toUpperCase() ?? null;
    this.nodeType = tagName === null ? 3 : 1;
    this.value = value;
    this.childNodes = [];
    this.attributes = new Map();
    this.listeners = new Map();
  }
  append(...nodes) {
    if (nodes.some(node => !(node instanceof AuthoredNode))) throw new Error('authored_node_required');
    this.childNodes.push(...nodes);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  get className() { return this.getAttribute('class') ?? ''; }
  set className(value) { this.setAttribute('class', value); }
  get textContent() { return this.nodeType === 3 ? this.value : this.childNodes.map(node => node.textContent).join(''); }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(callback);
  }
  emit(name) {
    for (const callback of this.listeners.get(name) ?? []) callback({ type: name, target: this, currentTarget: this });
  }
}

export function withAuthoredDOM(render) {
  const saved = Object.fromEntries(['Node', 'document'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperty(globalThis, 'Node', { configurable: true, value: AuthoredNode });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: tag => new AuthoredNode(tag),
    createTextNode: value => new AuthoredNode(null, String(value)),
  } });
  try { return render(); }
  finally {
    for (const [name, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

export function findAll(root, predicate) {
  return [root, ...root.childNodes.flatMap(node => findAll(node, () => true))].filter(predicate);
}

export function snapshot(root) {
  return root.nodeType === 3 ? root.textContent : {
    tag: root.tagName, attributes: [...root.attributes], children: root.childNodes.map(snapshot),
  };
}
