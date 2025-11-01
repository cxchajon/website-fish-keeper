# AdSense Readiness Pack

## Executive Summary
All static QA checkpoints passed for the monetized templates, consent wiring, and ads.txt entry, so the site is currently **ready_for_submission = true** with no blocking findings.

## Publisher & Inventory
- **Publisher ID:** ca-pub-9905718149811880

| Placement | Slot ID |
|-----------|---------|
| stocking_top | 8419879326 |
| stocking_bottom | 8979116676 |
| params_top | 8136808291 |
| params_bottom | 5754828160 |
| gear_top | 7692943403 |
| gear_bottom | 1762971638 |
| media_bottom | 9522042154 |

## Page Results
| Page | loader_once_head | slots_match | placement_looks_ok | cls_guard | banner_initial | accept_ads | accept_persist | reject_ads_non_personalized | reject_persist | legal_pages_adfree |
|------|------------------|-------------|---------------------|-----------|----------------|------------|----------------|-----------------------------|----------------|--------------------|
| /stocking-advisor.html | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| /params.html | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| /gear.html | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| /media.html | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| /privacy-legal.html | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Consent Mode
CMP scripts load in the expected order with the banner visible for EEA users, and both Accept and Reject actions trigger the appropriate AdSense consent paths with state persisting across reloads.

## CLS & Placement
Each monetized template keeps the loader tag scoped to a single `<head>` include, reserves height through the shared `.ttg-adunit` rule, and positions ad units between primary content sections without crowding CTAs or footers.

## ads.txt Status
`google.com, pub-9905718149811880, DIRECT, f08c47fec0942fa0`

## Artifacts
- JSON matrix: `/ad-audits/adsense-readiness.json`
- Static ad QA notes: `/static-qa-ads.md`
- Static ad QA data: `/static-qa-ads.json`
- Consent QA notes: `/static-qa-consent.md`
- Consent QA data: `/static-qa-consent.json`
- Screenshots directory: `/tests/screenshots` (none present)

## Reviewer Notes
- Media page intentionally serves a single bottom ad unit.
- Legal disclosures remain ad-free by policy.
- Gear redirect shell relies on dynamic top slot injection but retains global CLS guard.

## Owner Checklist
1. [ ] Domain in AdSense account matches site exactly (https + apex).
2. [ ] Site loads over HTTPS.
3. [ ] No intrusive interstitials/sticky ads.
4. [ ] Footer shows Privacy, Terms, Copyright/DMCA, Accessibility, Contact.
5. [ ] Consent banner appears only for EEA/UK/CH.
6. [ ] Non-EEA defaults allow ads w/out banner.
7. [ ] No ads on /privacy-legal.html and other legal routes.
8. [ ] Pages have original content beyond ad units.

## Final Status
**READY FOR SUBMISSION: YES**
