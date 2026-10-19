# Cloudinary Feature Your Tank security hardening

Date: 2026-10-19

## Scope

Cloud: `fishkeepinglifeco`  
Production unsigned upload preset: `feature-your-tank`

This record intentionally excludes API credentials, exact private metadata values, and visitor information.

## Verified before-state

- Signing mode: unsigned.
- Asset folder: `feature-your-tank`.
- Overwrite assets with the same public ID: disabled.
- Public IDs: auto-generated, unguessable values.
- Original filename as public ID: disabled.
- Original filename as display name: enabled.
- Resource type: upload.
- Incoming transformation: empty.
- Eager transformation: empty.
- Browser widget allowed JPG, JPEG, PNG, GIF, and WebP.
- Browser widget allowed up to five files and 10 MB per file.
- Published pages included direct original delivery URLs.
- One published original was previously confirmed to contain GPS-related EXIF fields. Exact values are not recorded here.

## Repository changes

- Removed GIF from the upload widget allowlist so the UI accepts only JPG, JPEG, PNG, and WebP.
- Added explicit metadata-stripping transformations to visitor-photo delivery URLs.
- Changed social-preview and JSON-LD delivery for the published tank photo to a transformed JPEG URL.
- Added transformed delivery for other direct Cloudinary originals on the published tank page.
- Bumped the Feature Your Tank script cache version from 1.0.6 to 1.0.7.

## Planned preset after-state

Apply only after validation:

- Keep unsigned mode because the current browser Upload Widget depends on it.
- Keep the fixed `feature-your-tank` asset folder.
- Keep overwrite disabled.
- Keep auto-generated, unguessable public IDs.
- Disallow caller-supplied public IDs if the current Cloudinary UI exposes that supported option.
- Stop using the original filename as the display name.
- Restrict accepted formats to JPG, JPEG, PNG, and WebP if the preset UI exposes a server-enforced allowlist.
- Add an incoming transformation that caps dimensions and permanently strips metadata from future stored uploads.
- Do not add paid moderation or unrelated transformations.

## Important limitation

Transformed delivery prevents embedded photo metadata from being sent through normal website and social-preview URLs. It does not remove metadata from an already stored original and does not make that original private. Replacing or deleting an existing original requires separate owner approval after every reference is mapped.

## Abandoned upload handling

The current browser-first upload flow creates Cloudinary assets before the Formspree submission is complete. A reliable cleanup mechanism therefore needs a server-side candidate/finalized workflow with authenticated deletion capability. That architecture is not added in this focused change because it would materially change the working upload path.

A future implementation should:

1. Mark new uploads as temporary candidates.
2. Finalize only the asset IDs included in a successful submission.
3. Remove only unfinalized candidates older than a conservative retention period.
4. Log asset IDs and timestamps, never image metadata or visitor form contents.
5. Run first in report-only mode.
6. Require explicit approval before activating deletion.

## Rollback

- Revert the pull request to restore prior website URLs and the prior widget format list.
- In Cloudinary, restore the values in the verified before-state above.
- Do not delete or overwrite existing assets as part of rollback.
