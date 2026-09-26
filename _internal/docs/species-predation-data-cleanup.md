# Future task: species predation tag / data clean-up

Status: open — not started. Found during Phase 2E (see
`_internal/reports/warning-visibility-audit-2026-09.md` §4). Deliberately not edited in Phase 2E.

## Why it does not affect results today

The Stocking Advisor's shrimp / snail warnings read each predator's explicit
`behavior.predationRisks` first; the generic tags are only a fallback when a record has no
explicit entry. So the contradictions below do not change any warning. They do make the raw data
inconsistent for anything else that reads the tags.

## Contradictions in `data/stocking-advisor/species.v2.json`

`shrimp_safe` tag although `behavior.predationRisks` lists shrimp as prey:
- chili-rasbora — "Shrimp (juvenile)"
- harlequin-rasbora — "Shrimp (juvenile)"
- rummynose-tetra — "Shrimp (juvenile)"
- zebra-danio — "Shrimp (juvenile)"
- neon-tetra — "Shrimp (cherry)"

Explicit shrimp prey but no `shrimp_risk` tag:
- cardinal-tetra — "Shrimp (cherry)"
- cherry-barb — "Shrimp (cherry)", "Shrimp (amano)"
- chili-rasbora, harlequin-rasbora, rummynose-tetra, zebra-danio, kuhli-loach, keyhole-cichlid,
  upside-down-catfish — "Shrimp (juvenile)"
- neon-tetra — "Shrimp (cherry)"
- pea-puffer — "Shrimp (all sizes)"
- tiger-barb — "Shrimp (all sizes)"

`shrimp_risk` tag with no explicit shrimp entry:
- ghost-shrimp

Snail tags and data agree (assassin-snail, pea-puffer).

## Questions to settle with sources

- Neon Tetra and Cardinal Tetra list "Shrimp (cherry)", which makes them red with Cherry Shrimp.
  Check whether the sources support predation on adult cherry shrimp or only on shrimplets
  ("Shrimp (juvenile)"), a very common beginner pairing.
- Should the `shrimp_safe` tags above be removed, or do their sources support the tag over the
  predation entry?
- Ghost Shrimp: add a sourced predationRisks entry, or drop the tag.

Each change needs a source per `data/stocking-advisor/SPECIES_DATA_POLICY.md`.
