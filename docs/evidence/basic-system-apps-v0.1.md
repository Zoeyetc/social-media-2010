# Track B Basic System Apps v0.1

Target: iPhone 4, iOS 4.1, October 20, 2010. Minimal functional subset, not exact clones.

## Historical basis

Apple's *iPhone User Guide, For iOS 4 Software*, contemporaneous PDF preserved at [MacDailyNews](https://macdailynews.com/wp-content/uploads/2010/06/iphone_ios4_user_guide.pdf), inspected locally: page 116 Calendar, page 142 Maps, page 158 Calculator. The Calendar capture supports a compact month grid, month arrows, selected-date events area and Today action. The Maps capture supports pre-Apple-Maps Google-era blue chrome, a map pin and location callout. Calculator documentation supports basic operations and the selected-operation white ring.

Calculator basic behavior: EVIDENCE-BACKED BEST FIT. Exact button artwork, reduced key layout, clear/error presentation and micro-spacing: RECONSTRUCTED. Only requested basic arithmetic is implemented; no memory, scientific mode or history. C clears the entry; AC clears the calculation. Repeated equals is outside this subset.

Calendar structure: EVIDENCE-BACKED BEST FIT; reduced month-only chrome and exact artwork RECONSTRUCTED. No approved Calendar event dataset was found; no birthdays, Apple event, parties or appointments were added. Empty dates display No events.

Maps era: pre-Apple-Maps / Google-backed iPhone Maps. This implementation reuses the project's deterministic fictional map, not Google map data or a live provider. Reduced read-only location strip, pin, callout and footer artwork are RECONSTRUCTED. Search, routing, GPS, zoom, satellite and Street View are outside scope; no active controls imply those features.

## Shared geography and eligibility

The user approved only `main-street-diner` and `riverside-park` for Foursquare → Maps. `resolveSystemMapVenue` returns the existing canonical venue object and geography object by reference. Maps stores only a venue ID. No duplicate name, address or coordinates are maintained. Existing exact points remain unchanged.

`night-owl` and `cedar-books` remain LEGACY / NONCANONICAL / MAP-INELIGIBLE under [F7 geography](foursquare-2010-f7-shared-geography.md). They have no active Open in Maps action, synthesized coordinates, aliases or new explanatory copy. Their venue content remains intact.

Direct launch starts at the existing neutral local viewport, with no selected venue, GPS history or player home. Returning during the same session retains the selected venue. Foursquare's Info screen remains retained when opening Maps; return through Home/Foursquare or existing app navigation.

## State and calendar contract

App owns a single reducer for Calculator, Maps and Calendar. DeviceScreen renders all three under the existing app/keyboard provider, using buttons only. The existing session shutdown reset clears calculation and map target and restores Calendar. Ordinary app switching does not reset state. The existing multitasking bar includes these system app icons; SpringBoard positions are unchanged.

Calendar derives its initial civil date from SESSION_START_ISO, not Date.now or the host date. UTC calendar arithmetic prevents host-timezone shifts; month transitions clamp invalid selected days. Gregorian weekday placement, leap years and December/January boundaries are computed. The canonical civil date remains 2010-10-20 throughout this session.

## Verification / manual acceptance

Focused system-app tests cover the five arithmetic examples, decimal rounding, chaining, clear, divide-by-zero recovery, Gregorian dates, leap centuries, year boundaries, host-date isolation, shared-reference identity, rendered eligible/ineligible actions and two resets. Actual App softwareSession coverage exercises Foursquare → Maps → Foursquare, retained Calculator/Calendar state and both session resets.

Safari remains PENDING user manual confirmation. Browser UI automation is unavailable by instruction. No Safari pass is claimed.

Manual sequence:
1. Utilities → Calculator: 2+3=5; AC; 9−4=5; AC; 6×7=42; AC; 8÷2=4; AC; 1.5+2.25=3.75. Home and return: retain result.
2. Calendar: October 2010, October 20 selected; previous → September; next → October; next → November; Today → October 20. Select another date, Home, return: retain selection.
3. Maps direct launch: neutral map. Foursquare → Places → Main Street Diner → Info → Open in Maps: same venue selected. Home → Maps: retain target. Home → Foursquare: same Info screen. Repeat Riverside Park. Night Owl Cafe/Cedar Books Info must have no active Maps action.
4. End/reset session, start Run 2: Calculator 0, Maps neutral, Calendar October 20. Eligibility remains unchanged.
