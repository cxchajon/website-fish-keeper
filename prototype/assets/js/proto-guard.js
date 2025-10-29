import { PROTOTYPE_ASSET_ROOT_NAME } from '../../../assets/js/env/asset-roots.js';

const PROTOTYPE_SEGMENT = '/prototype/';
const PROTOTYPE_ASSET_ROOT = PROTOTYPE_ASSET_ROOT_NAME || '/prototype/assets';

const hasWindow = typeof window !== 'undefined';
const hasDocument = typeof document !== 'undefined';

function isPrototypePath() {
  if (typeof location === 'undefined' || typeof location.pathname !== 'string') {
    return false;
  }
  return location.pathname.includes(PROTOTYPE_SEGMENT);
}

function detectPrototypeAssetUsage() {
  if (!hasDocument) {
    return false;
  }
  const nodes = document.querySelectorAll('script[src],link[href]');
  for (const node of nodes) {
    const ref = node?.src || node?.href || '';
    if (typeof ref === 'string' && ref.includes('/prototype/assets/js/proto-guard.js')) {
      continue;
    }
    if (typeof ref === 'string' && ref.includes(PROTOTYPE_ASSET_ROOT)) {
      return true;
    }
  }
  return false;
}

if (hasWindow && hasDocument) {
  const protoPath = isPrototypePath();
  const usingPrototypeAssets = detectPrototypeAssetUsage();

  if (protoPath && !usingPrototypeAssets) {
    console.warn('[ProtoGuard] Prototype page detected, but non-prototype assets referenced.');
  }

  if (!protoPath && usingPrototypeAssets) {
    console.error('[ProtoGuard] Live page is referencing /prototype/assets — blocking init.');
    window.__TTG_BLOCK_INIT__ = true;
  }
}
