const PROTOTYPE_SEGMENT = '/prototype/';
const PROTOTYPE_ASSET_ROOT = '/prototype/assets';
const LIVE_ASSET_ROOT = '/assets';

const override = typeof globalThis !== 'undefined' && typeof globalThis.__TTG_ASSET_ROOT__ === 'string'
  ? globalThis.__TTG_ASSET_ROOT__
  : null;

function detectAssetRoot() {
  if (override) {
    return override;
  }

  if (typeof location !== 'undefined') {
    try {
      const path = typeof location.pathname === 'string' ? location.pathname : '';
      if (path.includes(PROTOTYPE_SEGMENT)) {
        return PROTOTYPE_ASSET_ROOT;
      }
    } catch (_error) {
      // ignore access errors (e.g., jsdom)
    }
  }

  return LIVE_ASSET_ROOT;
}

export const ASSET_ROOT = detectAssetRoot();
export const IS_PROTOTYPE_BUILD = ASSET_ROOT === PROTOTYPE_ASSET_ROOT;
export const LIVE_ASSET_ROOT_NAME = LIVE_ASSET_ROOT;
export const PROTOTYPE_ASSET_ROOT_NAME = PROTOTYPE_ASSET_ROOT;
