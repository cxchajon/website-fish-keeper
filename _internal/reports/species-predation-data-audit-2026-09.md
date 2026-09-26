# Phase 2F — Species predation data audit (shrimp / snail)

Date: 2026-09-26 · Branch: `claude/species-predation-audit-p15sj0` · Status: **audit only — no data,
engine, severity or precedence changes.** `species.v2.json` is untouched.

Inputs: `_internal/docs/species-predation-data-cleanup.md` (starting inventory),
`data/stocking-advisor/species.v2.json`, `data/stocking-advisor/SPECIES_DATA_POLICY.md`,
`js/stocking-advisor/logic/species-adapter.v2.js`, and the Phase 2E predation engine
(`evaluateInvertPredation` / `readPreyEntry` in `js/logic/compute.legacy.js`).

---

## 1. Executive summary

- All **44** selectable species were inventoried. **29** carry a shrimp/snail prey entry or a
  shrimp/snail risk tag and were audited relationship by relationship; the other 15 were checked
  for understated risk.
- **13** records have tag ↔ data contradictions (the cleanup record listed 12 of them correctly but
  missed that it is a union; see §3). One more record (Assassin Snail) has a tag that contradicts
  its own cited source.
- **3 records overstate risk** under the current engine: **Neon Tetra** and **Cardinal Tetra**
  ("Shrimp (cherry)" → red with Cherry Shrimp; sources support shrimplet predation only) and
  **Cherry Barb → Amano** (the cited Aquarium Co-Op guide says Cherry Barbs do *okay* with Amano).
- **1 record understates risk**: **Molly** ("Shrimp (juvenile)" → amber; Aquarium Co-Op says larger
  mollies will most likely eat cherry shrimp).
- **2 records have no reliable species-level support**: Upside-Down Catfish and Keyhole Cichlid
  (both "Shrimp (juvenile)"). **1 tag-only record**: Ghost Shrimp.
- **7 records are directionally right but rest on group-level or extrapolated evidence** (Kribensis,
  Tiger Barb, Pearl Gourami, Betta (Female), Harlequin Rasbora, Platy, Swordtail).
- The binary `shrimp_safe` / `shrimp_risk` vocabulary is **too coarse** (§8). It cannot express
  "adult-safe, shrimplet risk", and the juvenile rule fires against Amano and Bamboo Shrimp, which do
  not breed in freshwater.
- **Source-access blocker:** the review environment's egress proxy blocks seriouslyfish.com,
  aquariumcoop.com, fishbase.se, theshrimpfarm.com, practicalfishkeeping.co.uk, fishkeeper.co.uk and
  aquainfo.nl (both `curl` and direct page fetch return EGRESS_BLOCKED). **Every claim below is
  therefore `search-extract` or `search-summary` level** (policy §5). No page was read directly and
  **no text in this report is a verbatim quotation**. Every proposed correction needs a manual page
  read before implementation (§9).

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

### 4.2 Evidence log (by source)

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

## 5. Evidence categories (per relationship)

A = adult / all-size supported · B = juvenile-only supported · C = named shrimp type supported ·
D = opportunistic / possible only · E = no reliable support · F = contradictory / uncertain.
"Group-level" means the source names a group (e.g. "dwarf cichlids", "barbs", "rasboras") the species
belongs to, not the species itself.

| Predator → prey (current entry) | Class | Basis |
|---|---|---|
| Neon Tetra → Cherry Shrimp ("Shrimp (cherry)") | **B** | S6 (congener, indirect), S7 (T4), S2 group (small tetras not in "larger tetras"). No source supports adult cherry predation as the norm. |
| Cardinal Tetra → Cherry Shrimp ("Shrimp (cherry)") | **B** | S3, species-named, explicit "leaves adult dwarf shrimp alone". |
| Chili Rasbora → shrimp (juvenile) | **B** | S5 species-named; S2 group. |
| Harlequin Rasbora → shrimp (juvenile) | **B (group-level)** | S2 "rasboras"; S27 silent. |
| Rummynose Tetra → shrimp (juvenile) | **B** | S4 species-named. |
| Zebra Danio → shrimp (juvenile) | **B** (+ harassment note) | S2 "small danios"; S1 may not eat adults outright but chases/outcompetes. |
| Blue Ram → shrimp (all sizes) | **A (group-level)** | S1 "dwarf cichlids" avoid; S2 dwarf cichlids clear up any shrimp. Not named. |
| Bolivian Ram → shrimp (all sizes) | **A (group-level)** | Same as Blue Ram; species-named evidence was forum-only. |
| Cockatoo Cichlid → shrimp (all sizes) | **A** | S11 genus-named (Apistogramma hunt dwarf shrimp), S1, S2. |
| Angelfish → shrimp (all sizes) | **A** | S12 species-named; S2 species-named. |
| Kribensis → shrimp (all sizes) | **A (group-level, weak)** | S2 "cichlids"/"dwarf cichlids" only; S25 species page silent. |
| Tiger Barb → shrimp (all sizes) | **A (group-level, weak)** | S2 "larger … barbs"; S21 "barbs" big enough to eat Amano; S26 silent. |
| Pea Puffer → shrimp (all sizes) | **A**, tier-1 caveat | S1 (avoid), S16 (fully grown small shrimp at risk). S15 (T1): cohabitation reported with varying success. That does not deny predation, so it is recorded as a caveat, not as F. |
| Betta (Male) → Cherry Shrimp | **A for dwarf shrimp** (entry is narrower, C) | S1, S10 name bettas; S2: individual-dependent (caveat). Amano: **E** (only forum reports). |
| Betta (Female) → Cherry Shrimp | **A, extrapolated** | No source distinguishes sex. Same evidence as male applied by genus. |
| Dwarf Gourami → Cherry Shrimp | **C** (doesn't distinguish age) | S9 names cherry shrimp; S1 names dwarf gouramis. |
| Pearl Gourami → Cherry Shrimp | **E (species) / group-level only** | S10 "gouramis" generic; no Pearl-specific statement surfaced. |
| Cherry Barb → Cherry Shrimp | **C (adults)** | S8: may go after adult cherry shrimp. |
| Cherry Barb → Amano Shrimp | **E, contradicted** | S8: does okay with bigger Amano. |
| Celestial Pearl Danio → shrimp (juvenile) | **B** | S14 species-named. |
| Guppy (Male) → shrimp (juvenile) | **B** | S2 species-named; S28. |
| Honey Gourami → shrimp (juvenile) | **B** | S1 species-named, explicit: not adults (Amano or Cherry), babies yes. |
| Keyhole Cichlid → shrimp (juvenile) | **E** (species) | S24 silent; S2's "cichlids dismissed" is group-level and would imply *stronger* than juvenile, so it is flagged. |
| Kuhli Loach → shrimp (juvenile) | **B** | S2 species-named. |
| Molly → shrimp (juvenile) | **C (cherry; adults implied)** → understated | S13: larger mollies most likely eat cherry shrimp. |
| Platy → shrimp (juvenile) | **B (universal statement only)** | S1/S20 "almost all fish eat baby shrimp"; no platy-specific statement. |
| Swordtail → shrimp (juvenile) | **B (universal) / F-risk** | As platy. Swordtails reach the size S13 says makes mollies dangerous; no source found either way. |
| Upside-Down Catfish → shrimp (juvenile) | **E** | S23 silent; only universal statement. |
| Ghost Shrimp → shrimp (tag only) | **B** | S19 (T3): adults eat larvae/small shrimplets; S20 (T2): does well with cherry shrimp. |
| Assassin Snail → Snails | **A (size-dependent)**; nerite/mystery **F** | S17: groups can kill nerite/mystery; S18: generally ignores nerites/larger snails. |
| Assassin Snail → shrimp (tag `shrimp_safe`) | **D** | S17: debated; shrimp fry reportedly caught. Not enough for a warning. |
| Pea Puffer → Snails | **A (small snails)** | S15 (T1): feed small snails regularly. Prey size matters for large nerite/mystery snails. |

---

## 6. Proposed correction table

"Outcome" = the warning the **current Phase 2E engine** produces with Cherry Shrimp (or a Nerite for
snail predators), simulated in §7. Confidence reflects source tier **and** the fact that no page was
read directly (max "medium" for anything resting on one search extract).

| Species | Current tags | Current predationRisks | Strongest source | URL | Tier | Class | Adult shrimp? | Juvenile shrimp? | Snail? | Proposed tag change | Proposed predationRisks change | Outcome now → proposed | Confidence | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Neon Tetra | shrimp_safe | Shrimp (cherry) | S7 / S6 (indirect) | aquariadise.com/do-tetras-eat-shrimp/ · aquariumcoop.com/…/green-neon-tetra | 4 / 2 | B | no (rare) | yes | no | remove shrimp_safe *or* keep pending vocabulary (§8); add shrimp_risk only if tags must mirror data | "Shrimp (cherry)" → **"Shrimp (juvenile)"** | red → **amber** | low–medium | No T1/T2 page names Neon Tetra. Needs manual read of an Aquarium Co-Op / SF neon page. |
| Cardinal Tetra | — | Shrimp (cherry) | S3 | aquariumcoop.com/blogs/aquarium/cardinal-tetra | 2 | B | no | yes | no | (optional) add shrimp_risk for consistency | "Shrimp (cherry)" → **"Shrimp (juvenile)"** | red → **amber** | medium | Species-named, explicit on adults. |
| Chili Rasbora | shrimp_safe | Shrimp (juvenile) | S5 | aquariumcoop.com/blogs/aquarium/chili-rasbora | 2 | B | no | yes | no | tag conflict only; shrimp_safe is correct *for adults* but misleading | none | amber → amber | medium | |
| Harlequin Rasbora | shrimp_safe | Shrimp (juvenile) | S2 (group) | practicalfishkeeping.co.uk/features/what-can-i-keep-with-shrimp/ | 2 | B (group) | uncertain | yes | no | as Chili | none | amber → amber | low–medium | Needs a species-level source. |
| Rummynose Tetra | shrimp_safe | Shrimp (juvenile) | S4 | aquariumcoop.com/blogs/aquarium/rummy-nose-tetra | 2 | B | no | yes | no | as Chili | none | amber → amber | medium | |
| Zebra Danio | shrimp_safe | Shrimp (juvenile) | S1, S2 | aquariumcoop.com/blogs/aquarium/cherry-shrimp-tankmates | 2 | B | no (but chases / outcompetes) | yes | no | as Chili; shrimp_safe is misleading given S1 advises steering clear | none | amber → amber | medium | Harassment isn't predation; no vocabulary for it. |
| Blue Ram | shrimp_risk, snail_safe | Shrimp (all sizes) | S2, S1 (group) | practicalfishkeeping.co.uk/features/what-can-i-keep-with-shrimp/ | 2 | A (group) | yes (group) | yes | no | none | none; **add cited predation source to husbandry_review** | red → red | medium | |
| Bolivian Ram | shrimp_risk, snail_safe | Shrimp (all sizes) | S2, S1 (group) | same | 2 | A (group) | yes (group) | yes | no | none | none; add source | red → red | medium | Species-named statement was forum only. |
| Cockatoo Cichlid | shrimp_risk, snail_safe | Shrimp (all sizes) | S11 | aquariumcoop.com/blogs/aquarium/apistogramma-dwarf-cichlid | 2 | A | yes | yes | no | none | none; add source | red → red | medium | Genus-level, explicit. |
| Angelfish | shrimp_risk, snail_safe | Shrimp (all sizes), Small fish | S12, S2 | aquariumcoop.com/blogs/aquarium/angelfish-care-guide | 2 | A | yes | yes | no | none | none; add source | red → red | medium–high | Named in two T2 sources. |
| Kribensis | shrimp_risk, snail_safe | Shrimp (all sizes) | S2 (group) | practicalfishkeeping.co.uk/features/what-can-i-keep-with-shrimp/ | 2 | A (group, weak) | uncertain | yes | no | none | none now; **manual review** | red → red | low | Species page silent. |
| Tiger Barb | — | Shrimp (all sizes) | S2, S21 (group) | same · aquariumcoop.com/blogs/aquarium/amano-shrimp | 2 | A (group, weak) | uncertain | yes | no | (optional) add shrimp_risk | none now; **manual review** | red → red | low | |
| Pea Puffer | snail_risk, predatory | Shrimp (all sizes), Snails | S15, S16, S1 | seriouslyfish.com/species/carinotetraodon-travancoricus/ | 1 / 3 / 2 | A (+T1 caveat); snails A (small) | yes (small species) | yes | yes (small snails) | add shrimp_risk (consistency) | none; record S15 caveat in `disagreements`; fix source claim text | red → red (shrimp), red (nerite) | medium | Nerite prey-size question: §9. |
| Betta (Male) | shrimp_risk | Shrimp (cherry), Juvenile fry | S1, S10, S2 | aquariumcoop.com/blogs/aquarium/cherry-shrimp-tankmates | 2 | A (dwarf shrimp); Amano E | yes (dwarf; individual-dependent) | yes | no | none | none (named cherry matches evidence; do **not** broaden to Amano) | red → red; Amano none → none | medium | |
| Betta (Female) | shrimp_risk | Shrimp (cherry), Juvenile fry | S1 (species, sex not stated) | same | 2 | A (extrapolated) | uncertain | yes | no | none | none; manual review | red → red | low–medium | |
| Dwarf Gourami | shrimp_risk | Shrimp (cherry) | S9 | aquariumcoop.com/blogs/aquarium/dwarf-gourami | 2 | C | yes (fits in mouth) | yes | no | none | none | red → red | medium | |
| Pearl Gourami | shrimp_risk | Shrimp (cherry), Small fry | S10 (group) | aquariumcoop.com/blogs/aquarium/honey-gourami | 2 | E (species) | uncertain | uncertain | no | none now | none now; **manual review** — candidate for "Shrimp (juvenile)" if no species source | red → red (candidate amber) | low | |
| Cherry Barb | — | Shrimp (cherry), Shrimp (amano) | S8 | aquariumcoop.com/blogs/aquarium/cherry-barb | 2 | C (cherry); E contradicted (Amano) | yes (cherry) | yes | no | (optional) add shrimp_risk | **remove "Shrimp (amano)"**; keep "Shrimp (cherry)" | cherry red → red; **Amano red → none** | medium | |
| Celestial Pearl Danio | shrimp_risk, snail_safe | Shrimp (juvenile) | S14 | aquariumcoop.com/blogs/aquarium/celestial-pearl-danio | 2 | B | no (forum-only reports) | yes | no | none | none; add source | amber → amber | medium | |
| Guppy (Male) | shrimp_risk | Shrimp (juvenile) | S2 | practicalfishkeeping.co.uk/features/what-can-i-keep-with-shrimp/ | 2 | B | no | yes | no | none | none | amber → amber | medium | |
| Honey Gourami | shrimp_risk, snail_safe | Shrimp (juvenile) | S1 | aquariumcoop.com/blogs/aquarium/cherry-shrimp-tankmates | 2 | B | no (explicit) | yes | no | none | none; add source | amber → amber | medium | Best-sourced juvenile record. |
| Keyhole Cichlid | snail_safe | Shrimp (juvenile) | — | — | — | E | uncertain | uncertain | no | none now | none now; **manual review** (could be stronger per S2 group) | amber → amber | low | |
| Kuhli Loach | — | Shrimp (juvenile) | S2 | practicalfishkeeping.co.uk/features/what-can-i-keep-with-shrimp/ | 2 | B | no | yes | no | (optional) add shrimp_risk | none | amber → amber | medium | |
| Molly | shrimp_risk, snail_safe | Shrimp (juvenile) | S13 | aquariumcoop.com/blogs/aquarium/molly-fish-care | 2 | C (cherry, adults implied) | **yes (larger mollies)** | yes | no | none | add **"Shrimp (cherry)"** (keep "Shrimp (juvenile)") | amber → **red** | medium | Size-conditional ("larger mollies"); engine cannot express that. |
| Platy | shrimp_risk, snail_safe | Shrimp (juvenile) | S1/S20 (universal) | aquariumcoop.com/blogs/aquarium/cherry-shrimp-tankmates | 2 | B (universal) | uncertain | yes | no | none | none; manual review | amber → amber | low | |
| Swordtail | shrimp_risk, snail_safe | Shrimp (juvenile) | S1/S20 (universal) | same | 2 | B / F-risk | uncertain | yes | no | none | none; manual review (possible understatement) | amber → amber | low | |
| Upside-Down Catfish | — | Shrimp (juvenile) | — (S23 silent) | seriouslyfish.com/species/synodontis-nigriventris | 1 | E | no evidence | uncertain | no | none | none now; remove if manual review finds nothing, or keep under a "universal juvenile" policy (§8) | amber → amber | low | |
| Ghost Shrimp | shrimp_risk, snail_safe | — | S19 / S20 | theshrimpfarm.com/posts/shrimp-caresheet-ghost-shrimp-palaemonetes-sp/ | 3 / 2 | B | no (S20) | yes | no | keep shrimp_risk | **add "Shrimp (juvenile)"** | amber (tag) → amber (juvenile wording) | medium | Mislabelled whisker shrimp risk noted in S19. |
| Assassin Snail | shrimp_safe, snail_risk, predatory | Snails | S17, S18 | aquariumcoop.com/blogs/aquarium/assassin-snail | 2 / 3 | A (size-dependent); nerite F; shrimp D | no | possible (D) | yes | consider removing shrimp_safe (contradicts own cited claim); no engine effect | none now (do not weaken) | nerite red → red | medium | "Snails" vs "small snails" is a vocabulary question (§8). |

---

## 7. Warning-impact preview (current Phase 2E engine, simulated)

Method: `compute.buildComputedState` was run exactly as `tests/unit/invert-predation.test.mjs` does
(125 g tank, 800 gph canister, 6 prey + 1 predator). One run used the current dataset. The other used
an **in-memory copy** with the five proposed predationRisks changes (Neon, Cardinal, Cherry Barb, Molly,
Ghost Shrimp). The simulation script lives in the session scratchpad. Neither the engine nor
`species.v2.json` was modified.

### 7.1 Requested pairs

| Pair | Current | Proposed |
|---|---|---|
| Neon + Cherry Shrimp | **red** — "Neon Tetra may prey on Cherry Shrimp" (named) | **amber** — "may eat juvenile Cherry Shrimp" |
| Cardinal + Cherry Shrimp | **red** (named) | **amber** (juvenile) |
| Betta (Male) + Cherry Shrimp | red (named) | red (named), unchanged |
| Betta (Male) + Amano | none | none, unchanged |
| Blue Ram + Cherry Shrimp | red (all sizes) | red, unchanged |
| Molly + Cherry Shrimp | amber (juvenile) | **red** (named cherry outranks juvenile) |
| Pea Puffer + Cherry Shrimp | red (all sizes) | red, unchanged |
| Assassin Snail + Nerite | red ("Snails") | red, unchanged |

### 7.2 Every changed outcome (full 29 × 7 prey matrix)

| Pair | Current | Proposed | Note |
|---|---|---|---|
| Neon + Cherry | red (named) | amber (juvenile) | intended |
| Neon + Amano / Ghost / Bamboo | none | **amber (juvenile)** | side effect: "Shrimp (juvenile)" covers every shrimp type |
| Cardinal + Cherry | red (named) | amber (juvenile) | intended |
| Cardinal + Amano / Ghost / Bamboo | none | **amber (juvenile)** | same side effect |
| Cherry Barb + Amano | red (named) | none | intended |
| Molly + Cherry | amber (juvenile) | red (named) | intended |
| Ghost Shrimp + Cherry / Amano / Bamboo | amber (tag) | amber (juvenile) | wording only; severity unchanged |

Net: **2 reds removed** (Neon/Cardinal + Cherry), **1 red removed** (Cherry Barb + Amano), **1 red added**
(Molly + Cherry), **6 new ambers** (Neon/Cardinal against Amano, Ghost, Bamboo), 3 amber rewordings.
All other 200-odd pairs are unchanged. Tag-only proposals change nothing (no rule reads `*_safe`).

The 6 new ambers are technically consistent with the existing juvenile rule, but Amano and Bamboo
Shrimp do not reproduce in freshwater (S22), so a "shrimplets at risk" amber against them is noise.
This already happens today for all 13 juvenile-only predators (e.g. Chili Rasbora + Amano = amber).
See §8.

---

## 8. Schema / tag limitations (report only — no redesign in this phase)

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

Conclusion: the vocabulary should eventually become more nuanced, e.g. prey scope
(`all` / `adult-dwarf` / `juvenile`), named type, an optional size condition, and a prey-side
freshwater-breeding flag. Not designed here.

---

## 9. Records needing manual source review

Every proposed change needs a direct page read (policy §5: nothing here is `direct`). Priority:

1. **Neon Tetra.** No T1/T2 page naming *P. innesi* surfaced. Read an Aquarium Co-Op neon page and SF
   *Paracheirodon innesi* before changing it.
2. **Cardinal Tetra.** Confirm S3 wording on adult dwarf shrimp.
3. **Cherry Barb.** Confirm S8 wording on Amano and on adult cherry shrimp.
4. **Molly.** Confirm S13 wording. Decide whether "larger mollies" justifies a named red for every
   planned molly.
5. **Pea Puffer.** Read S15 in full. Record the "varying success" caveat. Decide nerite prey size
   (Nerite record: "Predators: pufferfish"; S15 speaks of small snails).
6. **Assassin Snail vs Nerite / Mystery.** S17 and S18 disagree (group kills vs generally ignores).
   Record it in `disagreements`.
7. **Kribensis, Tiger Barb, Blue Ram, Bolivian Ram.** Evidence is group-level only. A species-named
   source is needed to keep "all sizes" at medium or higher confidence.
8. **Pearl Gourami, Betta (Female).** No species or sex-specific source.
9. **Keyhole Cichlid, Upside-Down Catfish, Platy, Swordtail, Harlequin Rasbora.** Juvenile entries
   with no species-level source.
10. **All 20 legacy records.** Their `sources` block names publications without URLs or claims. They
    cannot pass the current policy without new `husbandry_review` entries.
11. **Aquariadise (S7)** is tier 4 and cannot be the basis for the Neon change on its own.

Sources that could not be accessed directly: **all** of Seriously Fish, Aquarium Co-Op, FishBase,
The Shrimp Farm, Practical Fishkeeping, Fishkeeper UK, AquaInfo (egress blocked). To fix it, either
allow those hosts in the environment's network settings or do the reads by hand.

---

## 10. Recommended implementation order (for a later phase — not started)

1. **Manual source reads** for §9 items 1–6. Record `verification: direct` and exact quotes in
   `husbandry_review`.
2. **Evidence-backed severity corrections (warning-visible):** Neon and Cardinal → "Shrimp (juvenile)";
   Cherry Barb drop "Shrimp (amano)"; Molly add "Shrimp (cherry)". Update
   `tests/unit/invert-predation.test.mjs` expectations. None of the existing assertions reference these
   four pairs, but add explicit ones.
3. **Ghost Shrimp:** add "Shrimp (juvenile)" (wording only).
4. **Attach predation sources** to every record that keeps an entry (Blue/Bolivian Ram, Cockatoo,
   Angelfish, Pea Puffer, CPD, Honey Gourami, Guppy, Kuhli, Chili, Rummynose, Zebra, Dwarf Gourami,
   Betta). Add the `disagreements` notes (Pea Puffer, Assassin Snail).
5. **Tag hygiene (no engine effect):** resolve the 13 tag ↔ data contradictions and Assassin Snail's
   `shrimp_safe`. Do it only after step 6's decision, to avoid churning tags twice.
6. **Policy decision** on juvenile entries (§8.5) and on juvenile warnings against non-breeding prey
   (§8.4). Then handle UDC / Keyhole / Platy / Swordtail / Pearl Gourami accordingly.
7. **Vocabulary redesign** (§8), as its own phase.
