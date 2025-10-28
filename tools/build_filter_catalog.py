#!/usr/bin/env python3
"""Generate the prototype filter catalog from audit output."""
from __future__ import annotations

import csv
import json
import math
import pathlib
import re
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
AUDIT_CSV = ROOT / 'audit_out' / 'filters.csv'
OUTPUT_JSON = ROOT / 'data' / 'filters.json'

PRIMARY_ID_ALIASES = {
    'B0002566WY': 'aquaclear-50',
    'B08N4G6GRH': 'aqueon-quietflow-200',
    'B0BR8HH7ND': 'cascade-1500',
    'B005QRDCP2': 'eheim-2213',
    'B07KXJGDLT': 'fluval-107',
    'B09R7MDG8M': 'fluval-fx4',
    'B08F2Z4M6W': 'hygger-quiet-power-filter',
    'B07PHLZYRZ': 'marineland-penguin-350',
    'B01M0N8FPT': 'seachem-tidal-55',
    'B081V6B7LN': 'sunsun-hw-3000',
    'B0B3QFMG6M': 'tetra-whisper-iq-45',
    'filters-g-5-10-01': 'pawfly-sponge-10',
    'filters-g-5-10-02': 'hygger-double-sponge-s',
    'filters-g-5-10-03': 'aquaclear-30',
    'filters-g-10-20-02': 'hygger-double-sponge-m',
    'filters-g-10-20-03': 'aquaneat-sponge-20',
    'filters-g-20-40-02': 'seachem-tidal-35',
    'filters-g-20-40-03': 'fluval-c2',
    'filters-g-40-60-01': 'aquaneat-sponge-60',
    'filters-g-40-60-02': 'seachem-tidal-55',
    'filters-g-40-60-03': 'aquaclear-70',
    'filters-g-60-90-01': 'aqueon-quietflow-75',
    'filters-g-60-90-02': 'fluval-407',
    'filters-g-60-90-03': 'marineland-penguin-350',
    'filters-g-90-125-01': 'fluval-fx2',
    'filters-g-90-125-03': 'seachem-tidal-110',
    'penn-plax-undergravel-aquarium-filter-for-20-long-29-gallon-tanks-two-14-x-11-1-plates': 'penn-plax-ugf-20-29',
}

RATED_GPH_OVERRIDES = {
    'aquaclear-30': 150,
    'aquaclear-50': 200,
    'aquaclear-70': 300,
    'aquaneat-sponge-10': 60,
    'aquaneat-sponge-20': 120,
    'aquaneat-sponge-60': 200,
    'aqueon-quietflow-75': 400,
    'aqueon-quietflow-200': 200,
    'cascade-1500': 350,
    'eheim-2213': 116,
    'fluval-107': 145,
    'fluval-207': 206,
    'fluval-307': 303,
    'fluval-407': 383,
    'fluval-fx2': 475,
    'fluval-fx4': 700,
    'fluval-c2': 119,
    'hygger-double-sponge-s': 80,
    'hygger-double-sponge-m': 120,
    'hygger-quiet-power-filter': 260,
    'marineland-penguin-350': 350,
    'oase-biomaster-250': 250,
    'oase-biomaster-600': 320,
    'pawfly-sponge-10': 60,
    'penn-plax-ugf-20-29': 150,
    'powkoo-dual-sponge-40': 150,
    'seachem-tidal-35': 130,
    'seachem-tidal-55': 250,
    'seachem-tidal-75': 350,
    'seachem-tidal-110': 450,
    'sunsun-hw-3000': 793,
    'tetra-whisper-iq-45': 260,
}

NAME_OVERRIDES = {
    'aquaclear-30': 'AquaClear 30 Power Filter',
    'aquaclear-50': 'AquaClear 50 Power Filter',
    'aquaclear-70': 'AquaClear 70 Power Filter',
    'aquaneat-sponge-10': 'AQUANEAT Single Sponge Filter (Up to 10G)',
    'aquaneat-sponge-20': 'AQUANEAT Single Sponge Filter (Up to 20G)',
    'aquaneat-sponge-60': 'AQUANEAT Single Sponge Filter (Up to 60G)',
    'aqueon-quietflow-75': 'Aqueon QuietFlow 75 LED PRO HOB Filter',
    'aqueon-quietflow-200': 'Aqueon QuietFlow Canister Filter 200',
    'cascade-1500': 'Cascade 1500 Canister Filter',
    'eheim-2213': 'Eheim Classic 2213 Canister Filter',
    'fluval-107': 'Fluval 107 Performance Canister',
    'fluval-207': 'Fluval 207 Performance Canister',
    'fluval-307': 'Fluval 307 Performance Canister',
    'fluval-407': 'Fluval 407 Performance Canister',
    'fluval-fx2': 'Fluval FX2 High Performance Canister',
    'fluval-fx4': 'Fluval FX4 High Performance Canister',
    'fluval-c2': 'Fluval C2 Power Filter',
    'hygger-double-sponge-s': 'Hygger Dual Sponge Filter (Small)',
    'hygger-double-sponge-m': 'Hygger Dual Sponge Filter (Medium)',
    'hygger-quiet-power-filter': 'Hygger Quiet Aquarium Power Filter',
    'marineland-penguin-350': 'Marineland Penguin 350 BIO-Wheel Filter',
    'oase-biomaster-250': 'Oase BioMaster Thermo 250',
    'oase-biomaster-600': 'Oase BioMaster Thermo 600',
    'pawfly-sponge-10': 'Pawfly Nano Sponge Filter (Up to 10G)',
    'penn-plax-ugf-20-29': 'Penn-Plax Undergravel Filter (20–29G)',
    'powkoo-dual-sponge-40': 'Powkoo Dual Sponge Filter (20–55G)',
    'seachem-tidal-35': 'Seachem Tidal 35 HOB Filter',
    'seachem-tidal-55': 'Seachem Tidal 55 HOB Filter',
    'seachem-tidal-75': 'Seachem Tidal 75 HOB Filter',
    'seachem-tidal-110': 'Seachem Tidal 110 HOB Filter',
    'sunsun-hw-3000': 'SunSun HW-3000 Canister Filter',
    'tetra-whisper-iq-45': 'Tetra Whisper IQ Power Filter 45',
}

BRAND_OVERRIDES = {
    '': 'Unbranded',
}

TYPE_KEYWORDS = {
    'CANISTER': ('CANISTER', 'EXTERNAL'),
    'HOB': ('HANG-ON-BACK', 'HANG ON BACK', 'POWER FILTER'),
    'SPONGE': ('SPONGE',),
    'INTERNAL': ('INTERNAL', 'POWERHEAD'),
    'UGF': ('UNDERGRAVEL', 'UGF'),
}

VALID_TYPES = {'CANISTER', 'HOB', 'SPONGE', 'INTERNAL', 'UGF', 'OTHER'}

ID_SAFE_PATTERN = re.compile(r'[^a-z0-9]+')


def slugify(text: str) -> str:
    slug = ID_SAFE_PATTERN.sub('-', text.lower()).strip('-')
    slug = re.sub(r'-{2,}', '-', slug)
    return slug or 'filter'


def normalize_type(raw_declared: str, raw_inferred: str, name: str) -> str:
    declared = (raw_declared or '').strip().upper()
    inferred = (raw_inferred or '').strip().upper()
    if declared in VALID_TYPES:
        return declared
    if inferred in VALID_TYPES:
        return inferred
    upper_name = name.upper()
    for canonical, keywords in TYPE_KEYWORDS.items():
        if any(keyword in upper_name for keyword in keywords):
            return canonical
    return 'OTHER'


def clamp_gph(value: float | str | None) -> int:
    if value is None:
        return 0
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0
    if not math.isfinite(number) or number <= 0:
        return 0
    return int(round(number))


def main() -> None:
    rows = []
    with AUDIT_CSV.open(newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(row)

    entries = []
    used_ids: set[str] = set()
    duplicate_counters: defaultdict[str, int] = defaultdict(int)
    seen_label_combo: set[tuple[str, int]] = set()

    for row in rows:
        raw_id = row['id'].strip()
        raw_name = row['name'].strip()
        brand = row['brand'].strip()
        brand = BRAND_OVERRIDES.get(brand, brand or 'Unknown')
        declared_type = row.get('typeDeclared', '')
        inferred_type = row.get('typeInferred', '')
        gph_raw = row.get('gphRated')

        base_id = PRIMARY_ID_ALIASES.get(raw_id, raw_id)
        canonical_id = slugify(base_id)

        rated_gph = clamp_gph(gph_raw)
        if rated_gph <= 0:
            rated_gph = RATED_GPH_OVERRIDES.get(canonical_id, 0)

        is_alias = raw_id in PRIMARY_ID_ALIASES
        canonical_name = NAME_OVERRIDES.get(canonical_id, raw_name if is_alias else raw_name)
        if is_alias:
            # Preserve source-specific naming to keep duplicate listings distinct in the dropdown.
            canonical_name = raw_name
        product_type = normalize_type(declared_type, inferred_type, canonical_name)

        label_key = (canonical_name, rated_gph)
        if label_key in seen_label_combo and rated_gph > 0:
            # Skip exact duplicates that carry flow data.
            continue
        seen_label_combo.add(label_key)

        product_id = canonical_id
        if product_id in used_ids:
            duplicate_counters[canonical_id] += 1
            suffix = duplicate_counters[canonical_id]
            product_id = f"{canonical_id}-{suffix}"

        entry = {
            'id': product_id,
            'name': canonical_name,
            'brand': brand,
            'type': product_type,
            'rated_gph': rated_gph,
        }
        entries.append(entry)
        used_ids.add(product_id)

    # Sort by brand then name for stable output.
    entries.sort(key=lambda item: (item['brand'].lower(), item['name'].lower()))

    OUTPUT_JSON.write_text(json.dumps(entries, indent=2) + '\n', encoding='utf-8')
    print(f"Wrote {len(entries)} filters to {OUTPUT_JSON}")


if __name__ == '__main__':
    main()
