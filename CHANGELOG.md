# 📘 Changelog

All notable changes to this project will be documented here.

---

## 🚀 v1.1.0 — Stocking Calculator Update
**Date:** 2025-09-17

### ✨ New Features
- **Aggression Meter** added beneath the bioload bar.
- **Aggression & Compatibility Warnings** for common conflicts:
  - Multiple male Bettas (🔥 Danger)  
  - Betta + Tiger Barbs (⚠️ Warning)  
  - Fin-nippers with long-finned species (⚠️ Warning, only when 2+ species)  
  - Dwarf cichlids in tanks < 20 gallons (⚠️ Caution)  
  - Betta + Gourami-family fish (⚠️ Caution)  

### 🛠️ Improvements
- Fish data centralized in `js/fish-data.js`.  
- Unified updates with `updateMeters()`.  
- Styled warnings with severity-based color codes.  

### 🐛 Fixes
- Adding the same fish now **increases quantity** instead of duplicating rows.  
- Guppies alone no longer trigger nipper vs. long-fin conflict.  
- Smooth initialization for dropdown, stock list, and bars.  