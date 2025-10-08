import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bucketizeByLength, LENGTH_BUCKETS } from '../../src/lib/grouping.js';
import { ProductCard } from '../../src/components/gear/ProductCard.js';

class StubElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.textContent = '';
  }

  append(...nodes) {
    nodes.forEach((node) => {
      if (node === undefined || node === null) {
        return;
      }
      this.appendChild(node);
    });
  }

  appendChild(child) {
    if (child === undefined || child === null) {
      return child;
    }
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }

  addEventListener() {
    // No-op for tests
  }
}

class StubTextNode {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = text;
  }
}

function stubDocument() {
  const original = global.document;
  global.document = {
    createElement: (tag) => new StubElement(tag),
    createTextNode: (text) => new StubTextNode(text),
  };
  return () => {
    global.document = original;
  };
}

function findDescendant(node, predicate) {
  if (!node || typeof node !== 'object') {
    return null;
  }
  if (predicate(node)) {
    return node;
  }
  if (!Array.isArray(node.children)) {
    return null;
  }
  for (const child of node.children) {
    const match = findDescendant(child, predicate);
    if (match) {
      return match;
    }
  }
  return null;
}

test('bucketizeByLength groups lights by range', () => {
  const sample = [
    { product_id: 'a', title: 'Light A', length_range: '12-20' },
    { product_id: 'b', title: 'Light B', length_range: '48-up' },
    { product_id: 'c', title: 'Light C', length_range: '24-30' },
  ];
  const buckets = bucketizeByLength(sample);
  assert.strictEqual(buckets.length, LENGTH_BUCKETS.length);
  const shortBucket = buckets.find((bucket) => (bucket.bucket_id ?? bucket.id) === '12-18');
  const longBucket = buckets.find((bucket) => (bucket.bucket_id ?? bucket.id) === '48-55');
  assert.ok(shortBucket);
  assert.ok(longBucket);
  assert.deepEqual(shortBucket.items.map((item) => item.product_id), ['a']);
  assert.deepEqual(longBucket.items.map((item) => item.product_id), ['b']);
});

test('ProductCard Amazon button enforces sponsored rel', () => {
  const restore = stubDocument();
  try {
    const item = {
      Product_Name: 'Test Light',
      Amazon_Link: 'https://amzn.to/example',
      rel: 'sponsored noopener noreferrer',
    };
    const card = ProductCard(item, {});
    const anchor = findDescendant(
      card,
      (node) => node.tagName === 'A' && node.attrs && node.attrs.href === item.Amazon_Link,
    );
    assert.ok(anchor, 'Amazon link should be rendered');
    assert.ok(anchor.attrs.rel.includes('sponsored'));
  } finally {
    restore();
  }
});
