export function createElement(tag, options = {}, children = []) {
  const element = document.createElement(tag);
  if (options.className) {
    element.className = options.className;
  }
  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        element.dataset[key] = value;
      }
    });
  }
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        element.setAttribute(key, value);
      }
    });
  }
  if (options.text) {
    element.textContent = options.text;
  }
  if (!Array.isArray(children)) {
    children = [children];
  }
  children.forEach((child) => {
    if (child === undefined || child === null) {
      return;
    }
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
      return;
    }
    element.appendChild(child);
  });
  return element;
}

export function clearElement(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}
