export function getShouldRestoreVariantFocus(globalObject = globalThis) {
  const target = typeof globalObject === 'object' && globalObject !== null ? globalObject : {};
  const candidate = target.shouldRestoreVariantFocus;
  return typeof candidate === 'function' ? candidate : () => false;
}
