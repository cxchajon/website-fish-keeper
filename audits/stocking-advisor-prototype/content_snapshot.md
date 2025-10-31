# Content Snapshot

## Hero
- **Heading:** "Stocking Advisor"
- **Subline:** "Prepared by The Tank Guide (A FishKeepingLifeCo Project)."
- **Tagline:** "Plan a healthy community by checking bioload, compatibility — and get recommended water parameters for your tank."
- **Inline link:** "How it works"
- **Live region placeholder:** Empty `#stocking-status` status region (screen-reader only).

### Stocking Tip Popover
- Trigger label: "i" (button with aria-label "Stocking tip details").
- Popover heading: "Stocking Tip"
- Body copy: "Always quarantine new livestock. During stocking phases, test ammonia, nitrite, and nitrate weekly, and log temperature, pH, and hardness. Consistent tracking helps your parameters stay stable as the biofilter adapts."

## Advertisement Slot (pre-tool)
- Label: "Advertisement"

## Tank Size Card
- **Heading:** "Tank Size"
- **Subtitle:** "Select a tank size to begin."
- **Tank size popover heading:** "Tank size picker"
  - Bullet 1: "Select your aquarium volume to anchor stocking, parameter, and filter calculations."
  - Bullet 2: "Preset options reflect popular tank footprints, but you can type a custom gallon value anytime."
  - Bullet 3: "Adjustments update every card instantly so you can compare scenarios before buying equipment."
- **Tank size control:** Empty `<select>` with aria-label "Tank size" (options populated by script).
- **Facts line placeholder:** Empty `div` (aria-live polite).

### Filter Product Block
- **Field label:** "Filter Product"
- **Popover heading:** "Picking a filter"
  - Bullet 1: "Select a model rated for your tank volume or one size larger for heavy stocking plans."
  - Bullet 2: "Choosing a product fills in its rated gallons-per-hour so turnover math stays accurate."
  - Bullet 3: "Switch to a custom entry if you run multiple filters or throttle the manufacturer flow."
- **Select default option:** "— Select a product —"
- **Primary action button:** "Add Selected" (disabled by default).
- **Helper note:** "Choose a filter matched to your tank size and use Add Selected when ready."

### Custom Flow Controls
- Helper copy: "Choose a filter to estimate how much water flow your tank has per hour."
- Group label: "Add custom filter"
- Dropdown placeholder: "Filter type…" with options "HOB", "Canister", "Internal", "Sponge", "Powerhead".
- Text field placeholder: "GPH" (label "Rated flow (GPH)").
- Button: "Add custom" (aria-disabled true initially).
- Hint: "Tip: press Enter in the GPH field to add quickly."

### Filter Summary Area
- Chip list placeholder: empty `role="list"` container.
- Empty-state text: "No filters added yet."
- Turnover heading label: "Estimated turnover"
- Tooltip trigger text: "i" (title "More info").
- Summary string default: "Filtration: 0 GPH • 0.0×/h"
- Heads-up note: "Heads-up for later: As your tank matures—especially if you add lots of healthy, fast-growing plants—your effective capacity can change. Keep testing your water and revisit your plan after cycling."
- Compact turnover input: readonly value "5.0" with suffix "×/h" and placeholder "—".

## Current Stock Card
- **Heading:** "Current Stock"
- Subtitle: "Your selected fish and inverts appear here. No stock yet. Add species to begin."
- Popover heading: "Responsible Stocking Checklist"
  - Bullet 1: "Verify your nitrogen cycle is stable with zero ammonia and nitrite before introducing new species."
  - Bullet 2: "Match species by temperature, pH, and hardness tolerances, leaning into the overlapping sweet spot."
  - Bullet 3: "Stage livestock additions over several weeks so the biofilter can adjust without stress spikes."
  - Bullet 4: "Seed extra bio media to buffer bioload swings as you expand the community."
  - Bullet 5: "Keep a quick log of maintenance, feedings, and behavior shifts so you can course-correct early."
- Stock list container initially empty (`data-testid="species-list"`).
- Warning container hidden (`#stock-warnings`).

## Environmental Recommendations Card
- **Heading:** "Environmental Recommendations"
- Subtitle: "Derived from your selected stock."
- Popover heading: "Environmental Card Guide"
  - Bullet 1: "Ranges blend the overlapping temperature, pH, hardness, and flow preferences of the fish you add."
  - Bullet 2: "Alerts surface when your planned community drifts outside that shared band so you can adjust stock or gear."
  - Bullet 3: "Use these guardrails as a starting point and verify with your own water tests before introducing livestock."
- Compact summary placeholder: "Add species to see recommendations."
- Body containers for warnings, recommendation list, large-grid layout, metric bars, and extra tips (initially empty/hidden).

## Plan Your Stock Panel
- **Heading:** "Plan Your Stock"
- Field labels: "Species" (dropdown), "Quantity" (text input placeholder "Qty").
- Action button: "Add to Stock"
- Candidate chip container empty.
- Status banner (hidden by default): "Stocking safeguards: fix highlighted issues before adding."

### Primary CTA Link
- Button-style link: "See Gear Suggestions"

### Post-results Advertisement Placeholder
- Bold label: "Advertisement"
- Paragraph: "This post-results placement reserves space for contextual ads that complement aquarium planning advice. Educational copy continues below so the experience stays helpful even when ads are paused."

## Explainer Section
- **Heading:** "Plan Your Aquarium with Confidence"
  - Paragraph: "The Stocking Advisor helps you build a calm, healthy tank. It uses real-world stocking data and hobby feedback to show you—at a glance—how your choices affect bioload, filtration needs, and species mix. No spreadsheets. No guesswork."
- **Heading:** "The Science Behind the Recommendations"
  - **Subheading:** "Bioload, not “inches per gallon”"
    - Paragraph: "The Advisor estimates bioload—how much waste your stock produces—using conservative rules plus activity multipliers. Fast swimmers (like danios) add more load than slow cruisers (like gouramis). Because this walkthrough assumes a fresh setup, only your filtration setup increases the tank’s effective biological capacity; revisit your plan after cycling if you grow a dense plant canopy."
  - **Subheading:** "Water chemistry guardrails"
    - Paragraph: "Each species carries preferred ranges for temperature, pH, and hardness. If your plan mixes fish outside a shared range, the Environmental card highlights it so you can adjust stock, remineralize, or tweak heat and flow."
  - **Subheading:** "Compatibility and behavior"
    - Paragraph: "The Advisor warns about known problem pairs—fin nippers with long fins, shrimp-unsafe hunters with inverts, or aggressive fish with peaceful schooling species—so you can fix issues before they’re in the water."
  - Follow-up paragraph: "When your plan looks good, head to the Gear Guide to match filters, heaters, and lights, or brush up on testing in the Cycling Coach. And if you’d like, you can even have your tank featured by us — Submit your tank or see featured tanks from the community."

## FAQ Section
- **Heading:** "Stocking Advisor FAQ"
  - Q: "How accurate are the tank size recommendations?"
    - A: "The advisor uses a balanced approach that considers species behavior, activity level, and conservative new-tank assumptions. It avoids rigid “rules” and instead provides conservative starting points so aquarists can fine-tune their stocking levels through regular testing and observation."
  - Q: "Why don’t plants change capacity here?"
    - A: "This tool is a new-tank walkthrough. Fresh setups don’t have established plant mass or stable growth, so we don’t count a plant bonus. After your tank cycles and plants are thriving, your effective capacity may improve. That’s why we recommend regular water testing (ammonia, nitrite, nitrate, pH, KH/GH) and rechecking your plan as the tank matures."
  - Q: "What water parameters does the Stocking Advisor monitor?"
    - A: "Temperature, pH, carbonate hardness, general hardness, and flow are tracked for every species profile. When a planned community falls outside those overlapping bands, the tool surfaces alerts so you can adjust gear or livestock before completing the build."
  - Q: "How often is the species library updated?"
    - A: "We continuously build on our own research and real-world testing, blending it with trusted hobbyist knowledge and feedback from The Tank Guide community. Each update reflects new discoveries or refined care methods so the guidance stays accurate and easy to apply."

## SEO Intro Footer Copy
- Paragraph: "The Tank Guide Stocking Advisor calculates aquarium bioload and compatibility. Plan balanced communities of bettas, tetras, shrimp, and more, powered by FishKeepingLifeCo."

## Bioload Info Panel
- Title: "Bioload capacity guide"
- Paragraph 1: "Filtration increases your tank’s capacity to process waste. Stocking % is now calculated using your tank’s effective biological capacity (RBC)."
- Paragraph 2: "Heads-up for later: As your tank matures—especially if you add lots of healthy, fast-growing plants—your effective capacity can change. Keep testing your water and revisit your plan after cycling."

## How It Works Modal
- Title: "How the Stocking Advisor works"
- Ordered steps:
  1. "Pick your tank size." — "Enter a volume or choose a preset — stocking levels update right away."
  2. "Select your filter." — "Choose a model to auto-fill flow; adjust GPH if you’ve modded your setup."
  3. "Add your fish." — "Search and add species. Reorder or remove as you plan. Chips flag conflicts."
  4. "Review the health cards." — "See target temperature, pH, hardness, and flow — and how to stay there."
- Button: "Close"

## Cookie Banner & Preferences
- Banner title: "Cookies & Advertising"
- Banner description: "We use cookies to run this site and (if you allow) to show relevant ads from Google AdSense. You can accept all cookies, reject personalized ads, or manage preferences anytime."
- Banner buttons: "Reject (Non-personalized)", "Manage", "Accept All"
- Modal title: "Cookie Preferences"
  - Checkbox row: "Essential — required for core site functions." (checked, disabled)
  - Checkbox row: "Analytics — understand usage (if enabled later)."
  - Checkbox row: "Advertising — allow personalized ads (Google AdSense)."
- Modal buttons: "Cancel", "Save Preferences"
