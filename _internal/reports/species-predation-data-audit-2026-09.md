# Phase 2F — Species predation data audit (shrimp / snail)

Date: 2026-09-26 · Branch: `claude/species-predation-audit-p15sj0` · Status: **audit only — no data,
engine, severity or precedence changes.** `species.v2.json` is untouched. · **Revision 1** (same day):
source-quality correction after direct external review of the key source pages (see §0). ·
**Revision 2 (final)**: exact reviewed pages recorded for every direct source, plus implementation
readiness (§11) and final status (§12).

Inputs: `_internal/docs/species-predation-data-cleanup.md` (starting inventory),
`data/stocking-advisor/species.v2.json`, `data/stocking-advisor/SPECIES_DATA_POLICY.md`,
`js/stocking-advisor/logic/species-adapter.v2.js`, and the Phase 2E predation engine
(`evaluateInvertPredation` / `readPreyEntry` in `js/logic/compute.legacy.js`).

---

## 0. Revision 1 — what changed and why

The original audit relied only on search-engine extracts, because this environment cannot open the
source hosts (§4.1). The project owner then read the key pages directly outside this environment and
reported what they state. Those reports are logged in §4.3 as `reviewer-reported`
(policy §5), the verification level already used in `species.v2.json` for externally read pages. This
revision applies them and tightens the evidence standard. **A relationship is now "confirmed" only
when a directly read page names the species.** Group-level statements ("dwarf cichlids", "barbs",
"almost all fish eat baby shrimp") no longer count as species-level support.

| # | Original Phase 2F conclusion | Revised conclusion |
|---|---|---|
| 1 | Cardinal: B, confidence medium | **Confirmed by direct species-level source**: adult Cherry Shrimp predation not supported, juvenile supported. Confidence **medium-high**. |
| 2 | Neon: B (juvenile supported), low–medium | **Adult risk unsupported. Juvenile risk plausible only at general small-fish level.** "Shrimp (juvenile)" is **provisional** until a Neon-specific husbandry source is found. Confidence low–medium. |
| 3 | Cherry Barb: cherry C / Amano E, medium | **Confirmed direct**: adult Cherry Shrimp risk supported (red justifiable); Amano: no predation warning from this source. Cherry evidence is **not** generalised to other shrimp. |
| 4 | Molly: understated, medium | **Confirmed direct**: Cherry Shrimp risk beyond shrimplets. Source is specific to *larger* mollies, which the schema cannot express. |
| 5 | Pea Puffer: "A (+T1 caveat)", shrimp all sizes kept | **Snails confirmed. "Shrimp (all sizes)" is NOT confirmed**: the directly read Seriously Fish page reports shrimp cohabitation "with varying degrees of success". Needs more source review. |
| 6 | Blue Ram: "A (group-level)", all sizes "supported" | **Not confirmed at species level.** Group-level evidence supports meaningful risk; adult-vs-juvenile scope uncertain; manual-review item. The same standard now applies to Bolivian Ram, Cockatoo Cichlid and Kribensis. |
| 7 | Assassin Snail: snails A; nerite F; shrimp D | **General snail predation confirmed**; strong risk to small pest snails; **blanket red against Nerite is too broad** (Practical Fishkeeping: generally ignores Nerites and larger snails); **`shrimp_safe` too absolute** (Practical Fishkeeping: known to eat shrimplets). No size-aware rule proposed. |
| 8 | Table used A–F only; 15 "well supported" | Re-bucketed into the five evidence tiers (§6). "Well supported" is no longer used for group-level or extract-only evidence. |
| 9 | Warning preview | Re-run with the revised proposals, plus two sensitivity runs (§7). |

**Revision 2 (final documentation cleanup).** No conclusion was reversed. Presumed and missing source
pages were replaced with the exact pages reviewed:

| Item | Revision 1 | Revision 2 |
|---|---|---|
| Assassin Snail, larger snails / Nerites (R8) | Practical Fishkeeping, URL not supplied | "Natural born killers": https://www.practicalfishkeeping.co.uk/features/natural-born-killers/ |
| Assassin Snail, shrimplets (R9) | Practical Fishkeeping, URL not supplied | "How do I deal with aquarium snails?": https://www.practicalfishkeeping.co.uk/fishkeeping-answers/how-do-i-deal-with-aquarium-snails/. Establishes shrimplet predation only, not adult shrimp. |
| Neon Tetra (R4) | SF URL to be confirmed | Confirmed: https://www.seriouslyfish.com/species/paracheirodon-innesi/. Natural diet only. Adult Cherry Shrimp stays **unsupported**, juvenile stays **plausible / general**. |
| Blue Ram (R7) | Presumed record pages | Confirmed: SF https://www.seriouslyfish.com/species/mikrogeophagus-ramirezi/ and ACO https://www.aquariumcoop.com/blogs/aquarium/ram-cichlid-care-guide. Neither establishes all-size prey. Stays **group-level only + manual review**. |
| General shrimp-community guidance (R5) | Presumed ACO tank-mates page (S1) | **Corrected**: ACO "Cherry Shrimp Care Guide", https://www.aquariumcoop.com/blogs/aquarium/cherry-shrimp-care. General evidence only, never species-specific Neon evidence. The dwarf-cichlid caution comes from S1 / S2 (search extracts), not R5. |

---

## 1. Executive summary (revised)

- All **44** selectable species were inventoried. **29** carry a shrimp/snail prey entry or risk tag.
  Split into predator → prey relationships, that is **35 relationships** audited (§6).
- **13** records have tag ↔ data contradictions (§3). Assassin Snail's `shrimp_safe` also
  contradicts directly read evidence (it is known to eat shrimplets).
- **Evidence tiers after revision (35 relationships):** **8 confirmed** by a directly read
  species-level source · **7** group / general husbandry only · **6** plausible but not
  species-specific · **1** unsupported · **13** needing manual review. Of those 13, 2 are genuinely
  contradictory; 11 are species-named statements seen only in search extracts, awaiting a direct read.
- **Directly confirmed corrections (ready to plan):**
  - **Cardinal Tetra**: "Shrimp (cherry)" → "Shrimp (juvenile)" (red → amber).
  - **Cherry Barb**: drop "Shrimp (amano)" (Amano red → none), keep "Shrimp (cherry)" (red).
  - **Molly**: add "Shrimp (cherry)" (amber → red).
- **Provisional correction:** **Neon Tetra** "Shrimp (cherry)" → "Shrimp (juvenile)" (red → amber).
  Adult risk is unsupported, so the current red is overstated. The juvenile replacement rests on
  general small-fish evidence only.
- **Stored claims that are no longer treated as confirmed:** Pea Puffer "Shrimp (all sizes)", and
  "Shrimp (all sizes)" on Blue Ram, Bolivian Ram, Cockatoo Cichlid, Kribensis and Tiger Barb. They stay
  unchanged (red) pending review. There is no species-level source for them yet, and none against them.
- **Assassin Snail:** red against Nerite is broader than the evidence, but the current schema cannot
  narrow it. The obvious data-only workaround, a "Snails (small)" qualifier, would silently remove
  **every** Assassin Snail warning, including those against pest snails (§7.3). Keep "Snails" until a
  size-aware rule exists.
- The binary `shrimp_safe` / `shrimp_risk` vocabulary is too coarse (§8).
- **Source access:** this environment still cannot open the source hosts. Items marked
  `reviewer-reported` (R1–R9, §4.3) were read directly by the project owner outside this
  environment. Every one now names its exact page URL. Items marked S (§4.2) are search-level
  evidence only. Exact sentences still need to be copied into `husbandry_review` when implementing.
  No quotation in this report is verbatim.
- **Implementation readiness:** only **Cardinal Tetra, Cherry Barb and Molly** are ready for the first
  production data patch (§11).

---

## 2. Complete inventory (current data, all 44 species)

Tags shown are the raw v2 tags (shrimp/snail/predatory only). "Adapter" is what
`normalizeTraits` produces: any shrimp/snail prey entry adds `shrimp_risk`/`snail_risk` and drops the
contradicting `*_safe` tag. Legacy = the record has no `husbandry_review`; its `sources` block names
publications only (no URLs, no claims, no verification method). **20 of 44 records are legacy.**

| # | Slug (engine id) | Common name | Scientific name | Raw shrimp/snail tags | predationRisks (prey) | Incompatibilities | Predation source in record | Provenance |
|---|---|---|---|---|---|---|---|---|
| 1 | amano-shrimp (amano) | Amano Shrimp | — | shrimp_safe, snail_safe | — ("Predators: large fish") | — | none | legacy |
| 2 | assassin-snail | Assassin Snail | *Anentome helena* | shrimp_safe, snail_risk, predatory, snail_control | Snails | — | TSF (T3) + ACO (T2), search-summary | reviewed |
| 3 | bamboo-shrimp | Bamboo Shrimp | *Atyopsis moluccensis* | shrimp_safe, snail_safe | — | — | none | reviewed |
| 4 | blue-ram | Blue Ram | *Mikrogeophagus ramirezi* | shrimp_risk, snail_safe | Shrimp (all sizes) | — | **none** (SF/ACO cited for tank/size only) | reviewed |
| 5 | bolivian-ram | Bolivian Ram | *M. altispinosus* | shrimp_risk, snail_safe | Shrimp (all sizes) | — | **none** | reviewed |
| 6 | betta-female | Betta (Female) | — | shrimp_risk | Shrimp (cherry), Juvenile fry | Fin-nippers, Large cichlids | none (names only) | legacy |
| 7 | betta-male | Betta (Male) | — | shrimp_risk | Shrimp (cherry), Juvenile fry | Male bettas, Fin-nippers | none (names only) | legacy |
| 8 | bristlenose-pleco | Bristlenose Pleco | *Ancistrus* sp. | shrimp_safe, snail_safe | — | — | none | reviewed |
| 9 | bronze-corydoras | Bronze Corydoras | — | — | — | Aggressive large cichlids | none | legacy |
| 10 | cardinal-tetra (cardinal) | Cardinal Tetra | — | **(none)** | Shrimp (cherry) | — | none (names only) | legacy |
| 11 | celestial-pearl-danio | Celestial Pearl Danio | *Danio margaritatus* | shrimp_risk, snail_safe | Shrimp (juvenile) | — | **none** | reviewed |
| 12 | cherry-barb (cherrybarb) | Cherry Barb | — | **(none)** | Shrimp (cherry), Shrimp (amano) | Long-finned bettas | none (names only) | legacy |
| 13 | cherry-shrimp (neocaridina) | Cherry Shrimp | — | shrimp_safe, snail_safe | — ("Predators: bettas / gouramis") | — | none | legacy |
| 14 | chili-rasbora (chili) | Chili Rasbora | — | **shrimp_safe** | Shrimp (juvenile) | Large boisterous fish | none (names only) | legacy |
| 15 | cockatoo-cichlid | Cockatoo Cichlid | *Apistogramma cacatuoides* | shrimp_risk, snail_safe | Shrimp (all sizes) | — | **none** | reviewed |
| 16 | dwarf-gourami (dgourami) | Dwarf Gourami | — | shrimp_risk | Shrimp (cherry) | Aggressive gouramis | none (names only) | legacy |
| 17 | ember-tetra | Ember Tetra | *Hyphessobrycon amandae* | shrimp_safe, snail_safe | — | Large boisterous tankmates | none | reviewed |
| 18 | freshwater-angelfish | Angelfish | *Pterophyllum scalare* | shrimp_risk, snail_safe | Shrimp (all sizes), Small fish (e.g., Neon Tetras) | — | **none** | reviewed |
| 19 | ghost-shrimp | Ghost Shrimp | *Palaemonetes paludosus* | **shrimp_risk**, snail_safe | **—** | — | TSF (T3) search-summary: "adults eat larvae and small shrimplets" | reviewed |
| 20 | glass-catfish | Glass Catfish | *Kryptopterus vitreolus* | — | — | — | none | reviewed |
| 21 | guppy-male | Guppy (Male) | — | shrimp_risk | Shrimp (juvenile) | Fin-nippers, Large predators | none (names only) | legacy |
| 22 | harlequin-rasbora | Harlequin Rasbora | — | **shrimp_safe** | Shrimp (juvenile) | — | none (names only) | legacy |
| 23 | hillstream-loach | Hillstream Loach | *Sewellia lineolata* | — | — | — | none | reviewed |
| 24 | honey-gourami | Honey Gourami | *Trichogaster chuna* | shrimp_risk, snail_safe | Shrimp (juvenile) | Aggressive gouramis | **none** | reviewed |
| 25 | keyhole-cichlid | Keyhole Cichlid | *Cleithracara maronii* | snail_safe (**no shrimp tag**) | Shrimp (juvenile) | — | **none** | reviewed |
| 26 | kuhli-loach (kuhli) | Kuhli Loach | — | **(none)** | Shrimp (juvenile) | Large predatory fish | none (names only) | legacy |
| 27 | kribensis | Kribensis | *Pelvicachromis pulcher* | shrimp_risk, snail_safe | Shrimp (all sizes) | — | **none** | reviewed |
| 28 | molly | Molly | *Poecilia sphenops* (hybrids) | shrimp_risk, snail_safe | Shrimp (juvenile) | — | **none** | reviewed |
| 29 | mystery-snail | Mystery Snail | *Pomacea diffusa* | shrimp_safe, snail_safe | — | — | none | reviewed |
| 30 | neon-tetra (neon) | Neon Tetra | — | **shrimp_safe** | Shrimp (cherry) | — | none (names only) | legacy |
| 31 | nerite-snail (nerite) | Nerite Snail | — | shrimp_safe, snail_safe | — ("Predators: pufferfish") | Copper-based meds | none | legacy |
| 32 | otocinclus | Otocinclus | — | — | — | Uncycled tanks | none | legacy |
| 33 | panda-corydoras | Panda Corydoras | — | — | — | Rough substrate | none | legacy |
| 34 | pea-puffer | Pea Puffer | *Carinotetraodon travancoricus* | snail_risk, predatory (**no shrimp_risk**) | Shrimp (all sizes), Snails | — | ACO (T2) search-summary: "eats snails…" (fields list shrimp_risk, claim does not mention shrimp) | reviewed |
| 35 | pearl-gourami (pgourami) | Pearl Gourami | — | shrimp_risk | Shrimp (cherry), Small fry | Fin-nippers, Highly aggressive fish | none (names only) | legacy |
| 36 | platy | Platy | *Xiphophorus maculatus* | shrimp_risk, snail_safe | Shrimp (juvenile) | — | **none** | reviewed |
| 37 | pygmy-corydoras | Pygmy Corydoras | *Corydoras pygmaeus* | shrimp_safe, snail_safe | — | — | none | reviewed |
| 38 | ramshorn-snail | Ramshorn Snail | *Planorbella duryi* | shrimp_safe, snail_safe | — | — | none | reviewed |
| 39 | rummynose-tetra (rummynose) | Rummynose Tetra | — | **shrimp_safe** | Shrimp (juvenile) | Slow long-finned fish | none (names only) | legacy |
| 40 | swordtail | Swordtail | *Xiphophorus hellerii* | shrimp_risk, snail_safe | Shrimp (juvenile) | — | **none** | reviewed |
| 41 | upside-down-catfish | Upside-Down Catfish | *Synodontis nigriventris* | **(none)** | Shrimp (juvenile) | — | **none** | reviewed |
| 42 | white-cloud-mountain-minnow | White Cloud Mountain Minnow | *Tanichthys albonubes* | shrimp_safe, snail_safe | — | — | none | reviewed |
| 43 | tiger-barb (tiger_barb) | Tiger Barb | — | **(none)** | Shrimp (all sizes) | Long-finned species, Slow bettas | none (names only) | legacy |
| 44 | zebra-danio (zebra) | Zebra Danio | — | **shrimp_safe** | Shrimp (juvenile) | Slow long-finned fish | none (names only) | legacy |

Grouped by predation wording (prey entries only):

| Wording | Species |
|---|---|
| Shrimp (all sizes) | Blue Ram, Bolivian Ram, Cockatoo Cichlid, Angelfish, Kribensis, Tiger Barb, Pea Puffer (7) |
| Shrimp (juvenile) | Celestial Pearl Danio, Chili Rasbora, Guppy (Male), Harlequin Rasbora, Honey Gourami, Keyhole Cichlid, Kuhli Loach, Molly, Platy, Rummynose Tetra, Swordtail, Upside-Down Catfish, Zebra Danio (13) |
| Shrimp (cherry) | Betta (Male), Betta (Female), Dwarf Gourami, Pearl Gourami, Cardinal Tetra, Neon Tetra, Cherry Barb (7) |
| Shrimp (amano) | Cherry Barb (1) |
| Generic shrimp wording | none |
| Snails | Assassin Snail, Pea Puffer (2) |
| Generic snail wording | none |
| shrimp_risk tag, no shrimp prey entry | Ghost Shrimp (1) |
| snail_risk tag, no snail prey entry | none |

**Key provenance finding:** no audited record has a source that supports its *predation* field
except Assassin Snail, Ghost Shrimp and (partly) Pea Puffer. The 2026-09 husbandry review cited
sources for tank size, adult size and water — the predation entries on the 24 reviewed records were
carried over without a cited predation claim, and the 20 legacy records cite publication names only.

---

## 3. Contradictions (verified against the current dataset)

**A. `shrimp_safe` tag although `predationRisks` lists shrimp (5):** chili-rasbora, harlequin-rasbora,
rummynose-tetra, zebra-danio (all "Shrimp (juvenile)"), neon-tetra ("Shrimp (cherry)").

**B. Shrimp prey entry but no `shrimp_risk` tag (12):** cardinal-tetra, cherry-barb, chili-rasbora,
harlequin-rasbora, rummynose-tetra, zebra-danio, kuhli-loach, keyhole-cichlid, upside-down-catfish,
neon-tetra, pea-puffer, tiger-barb.

**C. `shrimp_risk` tag with no shrimp prey entry (1):** ghost-shrimp (engine falls back to amber "tag"
wording: "tagged as a shrimp predator … with no detail").

**D. Tag contradicts the record's own cited source (1, not in the cleanup record):** assassin-snail
carries `shrimp_safe`, while its own cited Aquarium Co-Op claim says shrimp safety is debated
(shrimplets / moulting shrimp).

**E. Source-field mismatch (not in the cleanup record):** pea-puffer's Aquarium Co-Op source lists
`shrimp_risk` in `fields` but its `claim` text does not mention shrimp.

Distinct records with a tag ↔ data contradiction (A ∪ B ∪ C): **13**. Snail tags and data agree
(assassin-snail, pea-puffer), as the cleanup record said.

**Engine impact of tags:** `shrimp_safe` / `snail_safe` are read by **no** engine rule (only listed in
`speciesSchema.js` vocabulary), and the adapter drops them whenever a prey entry exists. Tag-only
fixes in A/B/D therefore change **no** warning. Only C (Ghost Shrimp) changes wording.

---

## 4. Source review

### 4.1 Access

| Host | Direct access from this environment |
|---|---|
| seriouslyfish.com, aquariumcoop.com, fishbase.se, theshrimpfarm.com, practicalfishkeeping.co.uk, fishkeeper.co.uk, aquainfo.nl | **Blocked** (EGRESS_BLOCKED / curl 000) |

Evidence was gathered with a domain-restricted web search. Results give the page URL plus a
search-engine summary of it. Per policy §5 this is **`search-extract`** when the summary attributes the
statement to that exact page, and **`search-summary`** when the summary merges several pages. Summaries
are paraphrases. **Nothing below is a verbatim quote.** Where a summary appeared to extrapolate (e.g. it
applied a Green Neon statement to Neon Tetra), that is flagged.

### 4.2 Evidence log (by source) — search-level evidence from the original audit; see §4.3 for direct reviews that supersede rows S3, S8, S13, S15, S17 (shrimp part), S18 (S1 is a different page from R5 and stays search-extract)

| ID | Source (tier) | URL | Claim as extracted (paraphrase) | Level | Species it bears on |
|---|---|---|---|---|---|
| S1 | Aquarium Co-Op — Cherry Shrimp tank mates (T2) | https://www.aquariumcoop.com/blogs/aquarium/cherry-shrimp-tankmates | Avoid medium–large fish (goldfish, cichlids, rainbowfish, big plecos) and small mainly-meat-eating fish (**betta, dwarf cichlids, dwarf gouramis, pea puffers**) with cherry shrimp; otos / stiphodon / dwarf plecos may snack on baby shrimp but generally leave adults; **honey gouramis don't seem to go after adult Amano or Cherry shrimp but opportunistically eat babies**; zebra danios / silver tips may not eat adults outright but outcompete and chase them; almost all fish eat baby shrimp. | search-extract | Betta, Blue/Bolivian Ram, Cockatoo, Kribensis (group), Dwarf Gourami, Pea Puffer, Honey Gourami, Zebra Danio |
| S2 | Practical Fishkeeping — What can I keep with shrimp? (T2) | https://www.practicalfishkeeping.co.uk/features/what-can-i-keep-with-shrimp/ | Large fish and cichlids (incl. angelfish, discus) dismissed; **even dwarf cichlids are hunting machines that will clear up any shrimp**; larger tetras and barbs will eat shrimp; **guppies, rasboras, small danios, kuhli loaches**, pencilfish, clown killies, corys, WCMM, *Pseudomugil* will almost certainly eat **young** shrimp — a "happy medium" if not breeding; Betta success depends on individual personality and chance. | search-extract | Angelfish, dwarf cichlids (group), Tiger Barb (group), Guppy, Rasboras, Zebra Danio, Kuhli, Betta |
| S3 | Aquarium Co-Op — Cardinal Tetra care (T2) | https://www.aquariumcoop.com/blogs/aquarium/cardinal-tetra | Opportunistically eats baby shrimp; usually leaves adult dwarf shrimp alone given hiding spots; establish shrimp colony first. | search-extract | Cardinal Tetra |
| S4 | Aquarium Co-Op — Rummy-Nose Tetra care (T2) | https://www.aquariumcoop.com/blogs/aquarium/rummy-nose-tetra | Opportunistically snacks on baby shrimp and fry; tends to leave adult dwarf shrimp and snails alone. | search-extract | Rummynose |
| S5 | Aquarium Co-Op — Chili Rasbora care (T2) | https://www.aquariumcoop.com/blogs/aquarium/chili-rasbora | Won't bother adult shrimp; tiny mouths; any losses are the youngest baby shrimp. | search-extract | Chili Rasbora |
| S6 | Aquarium Co-Op — Green Neon Tetra care (T2) | https://www.aquariumcoop.com/blogs/aquarium/green-neon-tetra | Green neons usually safe with adult dwarf shrimp but may eat babies. **Species is *P. simulans*, not Neon Tetra**. The search summary's "same applies to regular neon" is its own extrapolation. | search-extract (other species) | Neon (indirect only) |
| S7 | Aquariadise — Do tetras eat shrimp? (T4) | https://www.aquariadise.com/do-tetras-eat-shrimp/ | Neons hoover up baby cherry shrimp; ganging up on an adult has been known but is rare. | search-extract, T4 corroboration only | Neon |
| S8 | Aquarium Co-Op — Cherry Barb care (T2) | https://www.aquariumcoop.com/blogs/aquarium/cherry-barb | **May try to go after adult cherry shrimp**; **seems to do okay with bigger Amano shrimp**; add hiding spots, be ready to separate. | search-extract | Cherry Barb |
| S9 | Aquarium Co-Op — Dwarf Gourami care (T2) | https://www.aquariumcoop.com/blogs/aquarium/dwarf-gourami | Opportunistically snacks on anything that fits in its mouth, **like cherry shrimp** and baby fish. | search-extract | Dwarf Gourami |
| S10 | Aquarium Co-Op — Honey Gourami care (T2) | https://www.aquariumcoop.com/blogs/aquarium/honey-gourami | Dwarf shrimp are not safe with betta fish or gouramis; most fish treat adult and baby shrimp as snacks. (Page-level; S1 is more specific for Honey Gourami itself.) | search-extract | Betta, gouramis (group) |
| S11 | Aquarium Co-Op — Apistogramma care (T2) | https://www.aquariumcoop.com/blogs/aquarium/apistogramma-dwarf-cichlid | Apistogrammas will hunt down dwarf shrimp, baby fish and any small creature that fits in their mouths. | search-extract | Cockatoo Cichlid (genus) |
| S12 | Aquarium Co-Op — Angelfish care (T2) | https://www.aquariumcoop.com/blogs/aquarium/angelfish-care-guide | Shouldn't be kept with small creatures like dwarf shrimp, which can be eaten. | search-extract | Angelfish |
| S13 | Aquarium Co-Op — Molly care (T2) | https://www.aquariumcoop.com/blogs/aquarium/molly-fish-care | **Larger mollies will most likely eat smaller animals like cherry shrimp.** | search-extract | Molly |
| S14 | Aquarium Co-Op — Celestial Pearl Danio care (T2) | https://www.aquariumcoop.com/blogs/aquarium/celestial-pearl-danio | Varied results with cherry shrimp; add hiding spots and **expect CPDs to prey on baby shrimp**. (A forum report of adults being wiped out also surfaced: T4, not usable alone.) | search-extract | CPD |
| S15 | Seriously Fish — *Carinotetraodon travancoricus* (T1) | https://www.seriouslyfish.com/species/carinotetraodon-travancoricus/ | Feed small snails (shell on) regularly to wear the teeth; relishes shellfish; cohabitation with some freshwater shrimp is reported **with varying degrees of success**. | search-extract | Pea Puffer |
| S16 | The Shrimp Farm — Pea Puffer care (T3) | https://www.theshrimpfarm.com/posts/pea-puffer-care/ | Baby cherry shrimp eaten without hesitation; even fully grown **small** shrimp species remain at risk; Amano sometimes suggested but not recommended; species tank advised. | search-extract | Pea Puffer |
| S17 | Aquarium Co-Op — Assassin Snail care (T2) | https://www.aquariumcoop.com/blogs/aquarium/assassin-snail | In groups can take down larger snails such as mystery, nerite and rabbit snails; attacking a large mystery snail is unlikely but possible; shrimp safety debated, some report shrimp fry caught. | search-extract | Assassin Snail |
| S18 | The Shrimp Farm — Assassin Snail care (T3) | https://www.theshrimpfarm.com/posts/assassin-snail-care/ | Usually targets snails of similar size or smaller and **generally ignores nerites** and other larger species. (The summary merged S17/S18, so attribution is uncertain.) | search-summary | Assassin Snail |
| S19 | The Shrimp Farm — Ghost Shrimp care (T3) | https://www.theshrimpfarm.com/posts/shrimp-caresheet-ghost-shrimp-palaemonetes-sp/ | Existing record claim: adults eat larvae and small shrimplets. Mislabelled "ghost" shrimp (whisker shrimp) are larger and aggressive. | search-summary (existing) | Ghost Shrimp |
| S20 | Aquarium Co-Op — Cherry Shrimp tank mates (T2), same page as S1 | https://www.aquariumcoop.com/blogs/aquarium/cherry-shrimp-tankmates | Amano and ghost shrimp can do well with cherry shrimp (similar size); avoid long-arm shrimp / prawns / crayfish. | search-extract | Ghost Shrimp |
| S21 | Aquarium Co-Op — Amano Shrimp care (T2) | https://www.aquariumcoop.com/blogs/aquarium/amano-shrimp | Avoid fish big enough to eat Amano, such as medium–large cichlids, **barbs**, goldfish. | search-extract | Tiger Barb (group) |
| S22 | The Shrimp Farm — Breeding Amano Shrimp (T3) | https://www.theshrimpfarm.com/posts/breeding-amano-shrimp/ | Amano larvae need brackish or salt water; no reproduction in a freshwater tank. | search-extract | Schema (§8) |
| S23 | Seriously Fish — *Synodontis nigriventris* (T1) | https://www.seriouslyfish.com/species/synodontis-nigriventris | Omnivorous, unfussy; one of the most peaceful Synodontis; combine with most peaceful species. **No shrimp statement surfaced.** | search-extract | Upside-Down Catfish |
| S24 | Seriously Fish — *Cleithracara maronii* (T1) and Fishkeeper UK keyhole page (T2) | https://www.seriouslyfish.com/species/cleithracara-maronii · https://www.fishkeeper.co.uk/fish/freshwater/cichlids/keyhole-cichlid | Diet only (brine shrimp, mysis, etc. as food items). **No live-shrimp tankmate statement surfaced.** | search-extract | Keyhole Cichlid |
| S25 | Seriously Fish — *Pelvicachromis pulcher* (T1) | https://www.seriouslyfish.com/species/pelvicachromis-pulcher/ | Tankmates: small characins, barbs, danios, rasboras, corys, gouramis, loricariids. **No shrimp statement surfaced.** | search-extract | Kribensis |
| S26 | Aquarium Co-Op — Tiger Barb care (T2) | https://www.aquariumcoop.com/blogs/aquarium/tiger-barb | Tank mate guidance about fish only. **No shrimp statement surfaced.** | search-extract | Tiger Barb |
| S27 | Aquarium Co-Op — Harlequin/Lambchop Rasbora care (T2) | https://www.aquariumcoop.com/blogs/aquarium/rasbora-hets-and-espei-rasboras-great-for-planted-aquariums | Omnivore; gets along with community fish too small to eat it. **No shrimp statement surfaced.** | search-extract | Harlequin |
| S28 | Aquarium Co-Op — Platy care (T2) / Guppy care (T2) | https://www.aquariumcoop.com/blogs/aquarium/platy-care-guide · https://www.aquariumcoop.com/blogs/aquarium/guppy-care-guide | Small livebearers (guppies, Endlers) can live with cherry shrimp given dense plants. **No platy/swordtail-specific shrimp statement surfaced.** | search-summary | Guppy, Platy, Swordtail |

Sources rejected as sole basis (policy): Aquarium Co-Op **forum** threads (Bolivian Ram "tasty snack",
betta/Amano harassment, CPD colony loss, Kuhli reports), FishLore, Planted Tank, Aquatic Arts,
AquariumStoreDepot, Loaches Online forum. They were read in results only as corroboration.

FishBase: no species page surfaced a shrimp-predation statement for any audited species (FishBase
gives natural diet, not aquarium compatibility). No primary literature surfaced that was directly
useful for aquarium-context predation on dwarf shrimp.

---

### 4.3 Direct source reviews (reviewer-reported, Revisions 1–2)

Revision 2 (final): every R-row now names the exact page that was reviewed. No presumed or missing
URLs remain. The R rows are **direct page reviews**, and S rows (§4.2) are **search-level evidence**. An
S row never outranks an R row for the same page.

These pages were read directly by the project owner outside this environment (2026-09-26). They are
logged at the `reviewer-reported` verification level and **take precedence over the search extracts
in §4.2** for the same page. Wording below is the reviewer's paraphrase, not a verbatim quote.

| ID | Source (tier) | URL | Directly reviewed statement (paraphrase) | Supersedes | Species |
|---|---|---|---|---|---|
| R1 | Aquarium Co-Op — Cardinal Tetra care guide (T2) | https://www.aquariumcoop.com/blogs/aquarium/cardinal-tetra | Cardinal Tetras generally leave adult dwarf shrimp alone when cover is available, but opportunistically eat baby shrimp. | S3 | Cardinal Tetra |
| R2 | Aquarium Co-Op — Cherry Barb care guide (T2) | https://www.aquariumcoop.com/blogs/aquarium/cherry-barb | Larger Amano shrimp generally do okay with Cherry Barbs; adult Cherry Shrimp may be pursued/eaten. | S8 | Cherry Barb |
| R3 | Aquarium Co-Op — Molly care guide (T2) | https://www.aquariumcoop.com/blogs/aquarium/molly-fish-care | Larger mollies will most likely eat smaller animals such as Cherry Shrimp. | S13 | Molly |
| R4 | Seriously Fish — *Paracheirodon innesi* — Neon Tetra (T1) | https://www.seriouslyfish.com/species/paracheirodon-innesi/ (page confirmed) | Small crustaceans occur in the natural diet. This is a natural-diet statement: it does **not** establish adult Cherry Shrimp as prey, and on its own it does not confirm juvenile-shrimp risk. | — | Neon Tetra |
| R5 | Aquarium Co-Op — Cherry Shrimp Care Guide (T2) | https://www.aquariumcoop.com/blogs/aquarium/cherry-shrimp-care (page confirmed; **not** the tank-mates page S1) | General shrimp-community guidance: almost all fish may eat baby shrimp; small peaceful fish can sometimes coexist with adult shrimp; shrimp cover matters; adult compatibility and shrimplet survival are different questions. **General evidence only. Not species-specific Neon evidence.** | — (distinct page from S1; S1 stays search-extract) | General (all small fish) |
| R6 | Seriously Fish — *Carinotetraodon travancoricus* (T1) | https://www.seriouslyfish.com/species/carinotetraodon-travancoricus/ | Small snails should be fed regularly; there are reports of cohabitation with freshwater shrimp with varying degrees of success. | S15 | Pea Puffer |
| R7a | Seriously Fish — *Mikrogeophagus ramirezi* (T1) | https://www.seriouslyfish.com/species/mikrogeophagus-ramirezi/ (page confirmed) | Does not establish "Shrimp (all sizes)" as a documented prey relationship. | — | Blue Ram |
| R7b | Aquarium Co-Op — Ram Cichlid Care Guide (T2) | https://www.aquariumcoop.com/blogs/aquarium/ram-cichlid-care-guide (page confirmed) | Does not establish "Shrimp (all sizes)" as a documented prey relationship. | — | Blue Ram |
| R8 | Practical Fishkeeping — "Natural born killers" (T2) | https://www.practicalfishkeeping.co.uk/features/natural-born-killers/ (page confirmed) | Assassin Snails generally target snails of similar size or smaller; Nerites and other larger snails are generally ignored. General snail predation remains supported. The blanket Assassin Snail → Nerite red is too broad. | S18 (attribution corrected: this statement is Practical Fishkeeping's, not The Shrimp Farm's) | Assassin Snail |
| R9 | Practical Fishkeeping — "How do I deal with aquarium snails?" (T2) | https://www.practicalfishkeeping.co.uk/fishkeeping-answers/how-do-i-deal-with-aquarium-snails/ (page confirmed) | Assassin Snails have been known to eat shrimplets, so `shrimp_safe` is too absolute. Does **not** establish adult-shrimp predation. | S17 (shrimp part) | Assassin Snail |

Note on S17: the Aquarium Co-Op search extract said that groups of Assassin Snails can take down
larger snails such as mystery and nerite snails. That page has not been read directly. It conflicts
with R8 and is recorded as a disagreement, not used to override R8.

---

## 5. Evidence categories (per relationship, revised)

Two labels are used for each relationship:

- **Class (what the evidence says):** A = adult / all-size · B = juvenile-only · C = named shrimp type ·
  D = opportunistic / possible only · E = no reliable support · F = contradictory / uncertain.
- **Tier (how strong the evidence is):** see §6.

"Group-level" = the source names a group (dwarf cichlids, barbs, rasboras, gouramis, "almost all fish")
that the species belongs to, not the species itself. **Group-level evidence never confirms a
species-specific scope** (all sizes vs juvenile).

| # | Predator → prey (stored entry) | Class | Key evidence | Tier |
|---|---|---|---|---|
| 1 | Neon → Cherry Shrimp as adult-risk ("Shrimp (cherry)") | **E** | R4 (SF Neon page) is natural diet only; R5 (ACO Cherry Shrimp Care Guide) is general. No source names Neon as a predator of adult shrimp. | Unsupported |
| 2 | Neon → shrimp (juvenile) (proposed) | B (general only) | R5 "almost all fish may eat baby shrimp" (general, not Neon-specific); R4 natural diet includes small crustaceans; S7 (T4) and S6 (congener) are extracts only. | Plausible, not species-specific |
| 3 | Cardinal → adult Cherry Shrimp | **E (directly negated)** | R1: generally leaves adult dwarf shrimp alone. | Confirmed (direct) |
| 4 | Cardinal → shrimp (juvenile) | **B** | R1: opportunistically eats baby shrimp. | Confirmed (direct) |
| 5 | Chili Rasbora → shrimp (juvenile) | B | S5 names the species (extract). | Manual review (species-named extract) |
| 6 | Harlequin → shrimp (juvenile) | B | S2 "rasboras" (group). | Group-level |
| 7 | Rummynose → shrimp (juvenile) | B | S4 names the species (extract). | Manual review (species-named extract) |
| 8 | Zebra Danio → shrimp (juvenile) | B (+ harassment) | S1 names zebra danios (extract); S2 "small danios". | Manual review (species-named extract) |
| 9 | Blue Ram → shrimp (all sizes) | **F (scope uncertain)** | R7a/R7b (SF and ACO Blue Ram pages): neither establishes all-size prey. S1/S2 "dwarf cichlids" (group, extracts). | Group-level |
| 10 | Bolivian Ram → shrimp (all sizes) | F (scope uncertain) | Group only; the species-named statement was forum-only. | Group-level |
| 11 | Cockatoo Cichlid → shrimp (all sizes) | F (scope uncertain) | S11 is genus-level *Apistogramma* (extract); group. | Group-level |
| 12 | Angelfish → shrimp (all sizes) | A | S12 and S2 name angelfish (extracts). | Manual review (species-named extract) |
| 13 | Kribensis → shrimp (all sizes) | F (scope uncertain) | Group only; S25 species page silent. | Group-level |
| 14 | Tiger Barb → shrimp (all sizes) | F (scope uncertain) | S2 "larger barbs", S21 "barbs" (group); S26 silent. | Group-level |
| 15 | Pea Puffer → shrimp (all sizes) | **F** | R6 (T1, direct): cohabitation reported with varying success. S1 names pea puffers as meat-eaters to avoid (extract). S16 (T3 extract): grown small shrimp at risk. | Contradictory / manual review |
| 16 | Pea Puffer → snails | **A** | R6: feed small snails regularly. | Confirmed (direct) |
| 17 | Betta (Male) → Cherry Shrimp | C / A (dwarf shrimp) | S1, S10 name bettas (extracts). S2: success depends on the individual fish. | Manual review (species-named extract) |
| 18 | Betta (Female) → Cherry Shrimp | C (extrapolated) | No source distinguishes sex. | Plausible, not species-specific |
| 19 | Dwarf Gourami → Cherry Shrimp | C | S9 names cherry shrimp (extract). | Manual review (species-named extract) |
| 20 | Pearl Gourami → Cherry Shrimp | E (species) | S10 "gouramis" (group). | Group-level |
| 21 | Cherry Barb → adult Cherry Shrimp | **C (adults)** | R2. | Confirmed (direct) |
| 22 | Cherry Barb → Amano | **E (directly negated)** | R2: larger Amano generally do okay. | Confirmed (direct) |
| 23 | Celestial Pearl Danio → shrimp (juvenile) | B | S14 names CPDs (extract). | Manual review (species-named extract) |
| 24 | Guppy (Male) → shrimp (juvenile) | B | S2 names guppies (extract). | Manual review (species-named extract) |
| 25 | Honey Gourami → shrimp (juvenile) | B | S1 names honey gouramis, explicitly not adults (extract). | Manual review (species-named extract) |
| 26 | Keyhole Cichlid → shrimp (juvenile) | B (general only) | S24 silent; only "almost all fish". | Plausible, not species-specific |
| 27 | Kuhli Loach → shrimp (juvenile) | B | S2 names kuhli loaches (extract). | Manual review (species-named extract) |
| 28 | Molly → Cherry Shrimp beyond shrimplets | **C (larger mollies)** | R3. | Confirmed (direct) |
| 29 | Platy → shrimp (juvenile) | B (general only) | Only "almost all fish". | Plausible, not species-specific |
| 30 | Swordtail → shrimp (juvenile) | B (general only) | Only "almost all fish". Possible understatement by analogy with R3 (size), unsourced. | Plausible, not species-specific |
| 31 | Upside-Down Catfish → shrimp (juvenile) | B (general only) | S23 silent; only "almost all fish". | Plausible, not species-specific |
| 32 | Ghost Shrimp → shrimp (tag only; proposed juvenile) | B | S19 (T3 extract): adults eat larvae/small shrimplets; S20 (extract): does well with cherry shrimp. | Manual review (species-named extract) |
| 33 | Assassin Snail → small / pest snails | **A (size-limited)** | R8. | Confirmed (direct) |
| 34 | Assassin Snail → Nerite (larger snails) | **F** | R8 (direct): generally ignores Nerites. S17 (extract): groups can kill them. | Contradictory / manual review |
| 35 | Assassin Snail → shrimplets | **B** | R9. | Confirmed (direct) |

---

## 6. Proposed correction table (revised, grouped by evidence tier)

"Outcome" = the warning the **current Phase 2E engine** produces with Cherry Shrimp (or with a Nerite
for snail predators), simulated in §7. Verification: `RR` = reviewer-reported direct read (§4.3);
`SE` = search extract (§4.2); `SS` = search summary. Relationship numbers refer to §5.

### 6.1 CONFIRMED BY DIRECT SPECIES-LEVEL SOURCE (8 relationships)

| # | Species | Current tags | Current predationRisks | Source | URL | Tier / verif. | Class | Adult shrimp? | Juvenile shrimp? | Snail? | Proposed tag change | Proposed predationRisks change | Outcome now → proposed | Confidence | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3, 4 | Cardinal Tetra | — | Shrimp (cherry) | R1 | https://www.aquariumcoop.com/blogs/aquarium/cardinal-tetra | T2 / RR | B (adult negated) | **no** | **yes** | no | (optional, no engine effect) add shrimp_risk | "Shrimp (cherry)" → **"Shrimp (juvenile)"** | red → **amber** | **medium-high** | Side effect: new amber vs Amano / Ghost / Bamboo (§7). |
| 21, 22 | Cherry Barb | — | Shrimp (cherry), Shrimp (amano) | R2 | https://www.aquariumcoop.com/blogs/aquarium/cherry-barb | T2 / RR | C (cherry adults); Amano negated | **yes (Cherry)**; **no (Amano)** | yes | no | (optional) add shrimp_risk | **remove "Shrimp (amano)"**; keep "Shrimp (cherry)" | Cherry red → red; **Amano red → none** | medium-high | Cherry evidence is not generalised to Ghost / Bamboo (no warning for those, unchanged). |
| 28 | Molly | shrimp_risk, snail_safe | Shrimp (juvenile) | R3 | https://www.aquariumcoop.com/blogs/aquarium/molly-fish-care | T2 / RR | C (larger mollies) | **yes (Cherry, larger mollies)** | yes | no | none | **add "Shrimp (cherry)"**, keep "Shrimp (juvenile)" | Cherry **amber → red**; others amber | medium | Source is specific to *larger* mollies. The schema cannot express size, so red applies to every planned molly. |
| 16 | Pea Puffer (snails) | snail_risk, predatory | Snails | R6 | https://www.seriouslyfish.com/species/carinotetraodon-travancoricus/ | T1 / RR | A (small snails) | — | — | **yes** | none | none | Nerite red → red | high (general); prey size open | R6 speaks of *small* snails. Whether large Nerites are really at risk is not settled. |
| 33, 35 | Assassin Snail | shrimp_safe, snail_risk, predatory, snail_control | Snails | R8, R9 | https://www.practicalfishkeeping.co.uk/features/natural-born-killers/ · https://www.practicalfishkeeping.co.uk/fishkeeping-answers/how-do-i-deal-with-aquarium-snails/ | T2 / RR | A (small snails); B (shrimplets) | no | **yes** | **yes (similar size or smaller)** | **remove shrimp_safe** (too absolute) | keep "Snails"; *optional* add "Shrimp (juvenile)" | snails red → red; Cherry **none → amber** if the optional entry is added | medium-high | R9 does not establish adult-shrimp predation. Nerite: see 6.5 (#34). |

### 6.2 SUPPORTED ONLY BY GROUP / GENERAL HUSBANDRY EVIDENCE (7)

No data change is proposed for any of these. All stay as manual-review items. "Shrimp (all sizes)" is
**not** labelled supported for any of them.

| # | Species | Current tags | Current predationRisks | Strongest source (group) | URL | Tier / verif. | Class | Adult? | Juvenile? | Proposed change | Outcome now → proposed | Confidence | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 9 | Blue Ram | shrimp_risk, snail_safe | Shrimp (all sizes) | S1 / S2 "dwarf cichlids" (group); species pages R7a/R7b silent | https://www.practicalfishkeeping.co.uk/features/what-can-i-keep-with-shrimp/ | T2 / SE (group) + RR (species pages: no support) | F (scope) | uncertain | yes (general) | none now | red → red | low (for "all sizes"); meaningful risk: medium | GROUP-LEVEL ONLY + MANUAL REVIEW. SF and ACO Blue Ram pages (R7a, R7b) do not establish all-size prey. |
| 10 | Bolivian Ram | shrimp_risk, snail_safe | Shrimp (all sizes) | same | same | T2 / SE | F (scope) | uncertain | yes (general) | none now | red → red | low (scope) | Species-named evidence was forum-only. |
| 11 | Cockatoo Cichlid | shrimp_risk, snail_safe | Shrimp (all sizes) | S11 (*Apistogramma*, genus) | https://www.aquariumcoop.com/blogs/aquarium/apistogramma-dwarf-cichlid | T2 / SE | F (scope) | uncertain (genus: "hunt dwarf shrimp") | yes | none now | red → red | low–medium | Closest to species-level of this group. A direct read of S11 could promote it. |
| 13 | Kribensis | shrimp_risk, snail_safe | Shrimp (all sizes) | S2 "cichlids" | as Blue Ram | T2 / SE | F (scope) | uncertain | yes (general) | none now | red → red | low | SF species page silent (S25). |
| 14 | Tiger Barb | — | Shrimp (all sizes) | S2 "larger barbs", S21 "barbs" | as Blue Ram · https://www.aquariumcoop.com/blogs/aquarium/amano-shrimp | T2 / SE | F (scope) | uncertain | yes (general) | none now | red → red | low | ACO Tiger Barb page silent (S26). |
| 20 | Pearl Gourami | shrimp_risk | Shrimp (cherry), Small fry | S10 "gouramis" | https://www.aquariumcoop.com/blogs/aquarium/honey-gourami | T2 / SE | E (species) | uncertain | uncertain | none now; candidate for "Shrimp (juvenile)" if no species source | red → red | low | |
| 6 | Harlequin Rasbora | shrimp_safe | Shrimp (juvenile) | S2 "rasboras" | as Blue Ram | T2 / SE | B | no evidence | yes (group) | none | amber → amber | low–medium | `shrimp_safe` raw-tag conflict (no engine effect). |

### 6.3 PLAUSIBLE BUT NOT SPECIES-SPECIFIC (6)

Rests only on the general statement that almost all fish eat baby shrimp (R5), or on extrapolation.

| # | Species | Current tags | Current predationRisks | Basis | Class | Adult? | Juvenile? | Proposed change | Outcome now → proposed | Confidence | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1→2 | **Neon Tetra** | shrimp_safe | Shrimp (cherry) | R4 (SF Neon page, natural diet), R5 (ACO Cherry Shrimp Care Guide, general) | E for adults; B general | **unsupported** | plausible | "Shrimp (cherry)" → **"Shrimp (juvenile)" — PROVISIONAL** pending a Neon-specific husbandry source; `shrimp_safe` correct for adults but misleading | **red → amber** | low–medium | The current red is overstated whatever the final juvenile decision. |
| 18 | Betta (Female) | shrimp_risk | Shrimp (cherry), Juvenile fry | Male-betta evidence extrapolated | C (extrapolated) | uncertain | yes (general) | none | red → red | low–medium | No source distinguishes sex. |
| 26 | Keyhole Cichlid | snail_safe | Shrimp (juvenile) | R5 general only | B general | uncertain | plausible | none now | amber → amber | low | |
| 29 | Platy | shrimp_risk, snail_safe | Shrimp (juvenile) | R5 general only | B general | uncertain | plausible | none now | amber → amber | low | |
| 30 | Swordtail | shrimp_risk, snail_safe | Shrimp (juvenile) | R5 general only | B general | uncertain | plausible | none now | amber → amber | low | Possible understatement by size analogy with R3 (unsourced). |
| 31 | Upside-Down Catfish | — | Shrimp (juvenile) | R5 general only; S23 silent | B general | no evidence | plausible | none now | amber → amber | low | |

### 6.4 UNSUPPORTED (1)

| # | Relationship | Current effect | Finding | Proposed |
|---|---|---|---|---|
| 1 | Neon Tetra → adult Cherry Shrimp (the adult-level red produced by "Shrimp (cherry)") | red | No reviewed source supports it. R4 (SF Neon page) is natural diet only (small crustaceans). R5 (ACO Cherry Shrimp Care Guide) says small peaceful fish can sometimes coexist with adult shrimp. | Remove the adult-level claim (via the provisional juvenile replacement in 6.3). |

(Betta → Amano and Cherry Barb → Amano have no supporting evidence either. Betta → Amano has no stored
claim and produces no warning, which is correct. Cherry Barb → Amano is directly negated, see 6.1.)

### 6.5 CONTRADICTORY / NEEDS MANUAL REVIEW (13)

**Genuinely contradictory (2):**

| # | Relationship | Current | Evidence for | Evidence against | Proposed now | Outcome |
|---|---|---|---|---|---|---|
| 15 | Pea Puffer → shrimp (all sizes) | red | S1 (ACO extract: avoid with cherry shrimp); S16 (T3 extract: grown small shrimp at risk) | R6 (T1 direct): cohabitation reported with varying success. Not an all-size claim. | **No change. Do not classify as confirmed all-size.** More source review needed. | red → red |
| 34 | Assassin Snail → Nerite (larger snails) | red ("Snails") | S17 (ACO extract: groups can kill nerites) | R8 (PF direct): generally ignores Nerites and larger snails | **Blanket red is too broad**, but no data-only fix is safe (§7.3). Keep until a size-aware rule exists. | red → red |

**Species-named, extract only — need a direct read before they can be "confirmed" (11):** #5 Chili
Rasbora (S5), #7 Rummynose (S4), #8 Zebra Danio (S1), #12 Angelfish (S12, S2), #17 Betta (Male) (S1,
S10, S2), #19 Dwarf Gourami (S9), #23 CPD (S14), #24 Guppy (S2), #25 Honey Gourami (S1), #27 Kuhli
Loach (S2), #32 Ghost Shrimp (S19 / S20; proposal: add "Shrimp (juvenile)", amber tag → amber juvenile
wording). None of these is contradicted. Current data and proposed outcomes are unchanged except
Ghost Shrimp's wording.

---

## 7. Warning-impact preview (current Phase 2E engine, re-run for Revision 1)

Method: `compute.buildComputedState` was run exactly as `tests/unit/invert-predation.test.mjs` does
(125 g tank, 800 gph canister, 6 prey + 1 predator), for all 29 predators × 7 invert prey. Runs:
**current** dataset; **proposed** = in-memory copy with the revised proposals (Neon juvenile
*provisional*, Cardinal juvenile, Cherry Barb cherry-only, Molly cherry + juvenile, Ghost Shrimp
juvenile, Assassin Snail optional "Shrimp (juvenile)" and `shrimp_safe` removed); and two
**sensitivity** runs that are *not* proposals. `species.v2.json` and the engine were not modified.

### 7.1 Required pairs

| Pair | Current | Proposed (Revision 1) | Evidence tier behind the proposed outcome |
|---|---|---|---|
| Neon + Cherry Shrimp | **red** (named) | **amber** (juvenile) | red removal: unsupported claim; amber: plausible / provisional |
| Cardinal + Cherry Shrimp | **red** (named) | **amber** (juvenile) | confirmed direct (R1) |
| Cherry Barb + Cherry Shrimp | red (named) | red (named), unchanged | confirmed direct (R2) |
| Cherry Barb + Amano | **red** (named) | **none** | confirmed direct (R2) |
| Molly + Cherry Shrimp | **amber** (juvenile) | **red** (named) | confirmed direct (R3), larger mollies only |
| Blue Ram + Cherry Shrimp | red (all sizes) | red, unchanged | group-level only; manual review |
| Pea Puffer + Cherry Shrimp | red (all sizes) | red, unchanged | contradictory; manual review (not confirmed all-size) |
| Pea Puffer + snail (Nerite / Mystery / Ramshorn) | red | red, unchanged | confirmed direct (R6); large-snail size open |
| Assassin Snail + Nerite | red ("Snails") | red, unchanged | contradictory. Broader than evidence, no safe data-only fix (§7.3). |

### 7.2 Every changed outcome in the proposed run

| Pair | Current | Proposed | Note |
|---|---|---|---|
| Neon + Cherry | red | amber | provisional |
| Neon + Amano / Ghost / Bamboo | none | amber (juvenile) | side effect of a generic juvenile entry |
| Cardinal + Cherry | red | amber | confirmed |
| Cardinal + Amano / Ghost / Bamboo | none | amber (juvenile) | side effect. Amano / Bamboo don't breed in freshwater (§8.4). |
| Cherry Barb + Amano | red | none | confirmed |
| Molly + Cherry | amber | red | confirmed (larger mollies) |
| Ghost Shrimp + Cherry / Amano / Bamboo | amber (tag) | amber (juvenile) | wording only |
| Assassin Snail + Cherry / Amano / Ghost / Bamboo | none | amber (juvenile) | only if the optional R9 entry is added |

Totals: 3 reds removed (Neon + Cherry, Cardinal + Cherry, Cherry Barb + Amano), 1 red added
(Molly + Cherry), 6 new ambers from Neon/Cardinal (+4 more if the optional Assassin entry is taken),
3 amber rewordings. Nothing else changes. Raw-tag changes (`shrimp_safe` removals) have no engine
effect.

### 7.3 Sensitivity runs (NOT proposals — shown because they look like easy fixes)

| Hypothetical data change | Result under the current engine | Why |
|---|---|---|
| Pea Puffer "Shrimp (all sizes)" → "Shrimp (juvenile)" | Pea Puffer + Cherry / Amano / Ghost / Bamboo: red → amber | Would be a downgrade on contradictory evidence. Not proposed. |
| Assassin Snail "Snails" → "Snails (small)" | **Assassin + Nerite, Mystery AND Ramshorn all red → none** | `readPreyEntry` treats an unknown qualifier as a named type. "small" matches no prey name, so every snail warning disappears, including the one against pest ramshorns. **Do not use a size qualifier without an engine change.** |

---

## 8. Schema / tag limitations (report only — no redesign in this phase; items 8–9 added in Revision 1)

1. **`shrimp_safe` is binary and unscoped.** Of the 6 Phase 2E contradiction records, 5 are "safe with
   adults, shrimplets at risk". For those `shrimp_safe` is *correct for adults* but misleading as a
   bare tag. Neon (named-cherry entry) is the sixth. The tag is read by no engine rule, so it is
   documentation-only drift.
2. **No scope for size-conditional predators.** "Larger mollies" (S13), "anything that fits in its
   mouth" (S9, S11) and "small shrimp species even when grown" (S16) are all size-conditional. The
   vocabulary has only all / juvenile / named.
3. **Named entries are read as adult-level red.** "Shrimp (cherry)" is used both for "eats adult
   cherry shrimp" (Cherry Barb, S8) and, apparently, for "eats cherry shrimplets" (Neon, Cardinal).
   The engine cannot tell these apart.
4. **Juvenile entries apply to non-breeding prey.** Amano (and Bamboo) larvae need brackish water
   (S22), so a juvenile-only warning against them warns about offspring that cannot exist in the tank.
   It would need a prey-side "breeds in freshwater" attribute, or a per-prey qualifier.
5. **"Almost all fish eat baby shrimp" (S1, S20).** If juvenile entries were added wherever that
   universal statement applies, nearly every fish (Ember Tetra, WCMM, corys, otos, Bristlenose, …)
   would get one. Today 13 species have juvenile entries and ~10 comparable fish do not, with no
   documented rule deciding which. The project should decide whether juvenile entries need
   *species-specific* evidence (then UDC / Keyhole / Platy / Swordtail are unsupported) or reflect
   the universal rule (then many `shrimp_safe` fish are understated).
6. **Harassment ≠ predation.** Zebra Danio (S1) and Betta with Amano (forum) describe chasing or
   outcompeting, which the schema cannot express.
7. **Snail prey size.** "Snails" is all-size, but both snail predators are size-limited (S15 "small
   snails", S18 "similar size or smaller").

8. **Size qualifiers are silently dropped by the engine.** Any qualifier other than all / juvenile /
   a prey name (e.g. "Snails (small)", "Shrimp (small)") makes `readPreyEntry` return no match. The
   warning disappears instead of being narrowed (§7.3). A size-aware rule for Assassin Snail
   (R8) or Molly (R3) therefore needs an engine change, not just data.
9. **Group-level vs species-level provenance is not recorded.** `husbandry_review` has no field saying
   whether a predation claim is species-named or group-level. That distinction drove most of
   Revision 1.

Conclusion: the vocabulary should eventually become more nuanced, e.g. prey scope
(`all` / `adult-dwarf` / `juvenile`), named type, an optional size condition, and a prey-side
freshwater-breeding flag. Not designed here.

---

## 9. Records needing manual source review (revised)

Items 1–3 below are **already directly reviewed** (R1–R3). They only need exact wording recorded.

1. **Cardinal Tetra, Cherry Barb, Molly.** Copy the exact sentences from R1–R3 into `husbandry_review`
   (`verification: reviewer-reported` or `direct`).
2. **Assassin Snail.** Pages identified (R8 "Natural born killers", R9 "How do I deal with aquarium
   snails?"). Record the S17 (Aquarium Co-Op, search extract) vs R8 disagreement. Implementation is
   blocked on the size-aware modelling decision (§11), not on sources.
3. **Neon Tetra.** Find a **Neon-specific husbandry source** on shrimp or shrimplets. Until then the
   juvenile entry is provisional. (R4 page confirmed: natural diet only.)
4. **Pea Puffer shrimp.** Read further sources (Aquarium Co-Op pea puffer guide, The Shrimp Farm pea
   puffer page S16, Practical Fishkeeping dwarf puffer article) to decide all-size vs juvenile vs
   uncertain. Record the R6 caveat either way.
5. **Dwarf cichlids and Tiger Barb** (Blue Ram, Bolivian Ram, Cockatoo, Kribensis, Tiger Barb). A
   species-named source is needed before "all sizes" can be called confirmed. Cockatoo (S11,
   genus-level) is the closest. (Blue Ram pages R7a/R7b confirmed: no all-size statement.)
6. **Species-named extracts** (§6.5, 11 items). Read each page directly to promote it to confirmed.
7. **Pearl Gourami, Betta (Female), Keyhole, Platy, Swordtail, Upside-Down Catfish, Harlequin.**
   Need species-level sources, or the §8.5 policy decision.
8. **All 20 legacy records.** They need `husbandry_review` entries with URLs and claims.

Hosts this environment cannot reach: Seriously Fish, Aquarium Co-Op, FishBase, The Shrimp Farm,
Practical Fishkeeping, Fishkeeper UK, AquaInfo.

---

## 10. Recommended implementation order (for a later phase — not started)

1. **Record exact wording** for R1–R3 (URLs are in §4.3).
2. **First production data patch (new branch, after this audit is merged): directly confirmed,
   warning-visible corrections:**
   - Cardinal "Shrimp (cherry)" → "Shrimp (juvenile)".
   - Cherry Barb: drop "Shrimp (amano)".
   - Molly: add "Shrimp (cherry)".

   Add explicit test cases for all four pairs (Cardinal + Cherry, Cherry Barb + Cherry, Cherry Barb +
   Amano, Molly + Cherry). The existing `invert-predation.test.mjs` assertions (Cherry Barb + Amano is
   red, test C/D) **will need updating** for the Cherry Barb change.
3. **Neon Tetra:** apply the provisional juvenile replacement only once the owner accepts general
   small-fish evidence, or a Neon source is found. The current red is overstated either way.
4. **Assassin Snail:** remove `shrimp_safe` (no engine effect). Decide on the optional
   "Shrimp (juvenile)" entry (adds amber vs shrimp). Leave "Snails" unchanged.
5. **Ghost Shrimp:** add "Shrimp (juvenile)" (wording only).
6. **Policy decisions** before touching the rest: juvenile entries without species-specific evidence
   (§8.5); juvenile warnings against non-breeding prey (§8.4); size-aware predation (§8.2, §8.8).
7. **Pea Puffer and dwarf cichlid / Tiger Barb "all sizes"**: only after §9 items 4–5.
8. **Tag hygiene** (13 contradictions) after step 6, then vocabulary redesign as its own phase.

---

## 11. Implementation readiness

### READY FOR FIRST PRODUCTION DATA PATCH

| Species | Direct source | Proposed data change | Warning change (current engine) |
|---|---|---|---|
| **Cardinal Tetra** | R1, ACO Cardinal Tetra guide: https://www.aquariumcoop.com/blogs/aquarium/cardinal-tetra. Adult dwarf shrimp generally left alone; baby shrimp may be eaten. | "Shrimp (cherry)" → "Shrimp (juvenile)" | Cardinal + Cherry: red → amber. Side effect: new amber vs Amano / Ghost / Bamboo (§7.2, §8.4). |
| **Cherry Barb** | R2, ACO Cherry Barb guide: https://www.aquariumcoop.com/blogs/aquarium/cherry-barb. Adult Cherry Shrimp may be pursued / eaten; larger Amano generally do okay. | Keep "Shrimp (cherry)" (adult risk); remove "Shrimp (amano)" | Cherry Barb + Cherry: red (unchanged); Cherry Barb + Amano: red → none. Test C/D in `invert-predation.test.mjs` must be updated. |
| **Molly** | R3, ACO Molly guide: https://www.aquariumcoop.com/blogs/aquarium/molly-fish-care. Larger mollies may eat Cherry Shrimp. | Add named "Shrimp (cherry)" adult-risk entry; keep "Shrimp (juvenile)" | Molly + Cherry: amber → red. The schema cannot represent predator size ("larger mollies"), so red applies to every planned molly. Record this limitation in the record's notes. |

### NOT READY — NEEDS MORE MODELLING OR SOURCE REVIEW

| Species / relationship | Why not ready |
|---|---|
| **Neon Tetra** | Adult Cherry Shrimp predation is **unsupported** (R4: natural diet only; R5: general). The current red is overstated, but the juvenile replacement rests on general evidence only. Needs a Neon-specific husbandry source or an owner decision to accept general evidence. |
| **Blue Ram** | SF and ACO species pages (R7a/R7b) do not establish "Shrimp (all sizes)". Group-level dwarf-cichlid evidence only; adult-vs-juvenile scope uncertain. Manual review. |
| **Bolivian Ram** | Group-level only; species-named statement was forum-only. |
| **Cockatoo Cichlid** | Genus-level (*Apistogramma*) search extract only (S11); needs a direct read / species source. |
| **Kribensis** | Group-level only; SF species page silent (S25). |
| **Tiger Barb** | Group-level only ("barbs"); ACO species page silent (S26). |
| **Pea Puffer → shrimp** | Contradictory: SF (R6) reports cohabitation with varying success. "All sizes" not confirmed. (Pea Puffer → snails **is** confirmed and needs no change.) |
| **Assassin Snail → larger snails / Nerites** | Evidence is now well understood (R8: generally ignores Nerites and larger snails; general snail predation confirmed). But narrowing the warning needs an **engine / data-model decision** on size-aware predation, not a species-data edit. The obvious data-only change ("Snails (small)") would silently remove every Assassin Snail warning, including those against pest snails (§7.3, §8.8). |
| **Assassin Snail → shrimplets / `shrimp_safe`** | R9 supports shrimplet predation (not adult). Removing `shrimp_safe` has no engine effect, and the optional "Shrimp (juvenile)" entry adds new ambers, so it should go with the snail modelling decision rather than batch 1. |
| **Ghost Shrimp** | Tag-only record. Proposed "Shrimp (juvenile)" rests on a T3 search summary (S19). Needs a direct read. |
| **Pearl Gourami, Betta (Female)** | No species-level (or sex-level) source. |
| **Keyhole Cichlid, Platy, Swordtail, Upside-Down Catfish, Harlequin Rasbora** | Juvenile entries rest on general / group evidence only. Needs species sources or the §8.5 policy decision. |
| **Chili Rasbora, Rummynose, Zebra Danio, Angelfish, Betta (Male), Dwarf Gourami, CPD, Guppy, Honey Gourami, Kuhli Loach** | Species-named, but seen only in search extracts (§6.5). Current data is likely right but needs direct reads before being called confirmed. No change proposed. |
| **Tag hygiene (13 tag ↔ data contradictions)** | No engine effect. Wait for the vocabulary / juvenile-policy decisions (§8) to avoid churning tags twice. |

---

## 12. Final Phase 2F status

**Phase 2F AUDIT COMPLETE.**

The audit itself is ready to merge as documentation.

Production species-data corrections have **NOT** been implemented. `species.v2.json`, the species
adapter, `fish-data.js`, the warning engine and the tests are unchanged on this branch.

The first proposed implementation batch is:

1. Cardinal Tetra
2. Cherry Barb
3. Molly

Those changes must occur on a **NEW branch after the audit branch is merged**.
