# Centum Optional Activity Itinerary Design

## Goal

Replace the 18 August Osiria itinerary with a compact Centum, Suyeong, and
Gwangalli day for the 2026 Busan family trip. The default route must work as a
complete summer day for a parent and a 12-year-old child. Yacht and ice-rink
experiences remain clearly optional, rather than silently changing the confirmed
base itinerary or its budget.

## Scope and Acceptance Criteria

1. Remove every Osiria, National Busan Science Museum, and Skyline Luge
   reference from the itinerary data, agent logic, maps, budget plans, and QA
   fixtures. Lotte World remains excluded.
2. The 18 August base flow is Paradise Hotel Busan, Busan X the Sky, Centum
   lunch, Museum 1, Busan Cinema Center, F1963, Gwangalli dinner, and Paradise
   Hotel Busan. Each handoff has a practical travel buffer.
3. Every budget mode retains that base flow and its map route. A budget choice
   may alter meal candidates and discretionary cost detail, but it must not
   delete or reorder the confirmed places.
4. The yacht and Shinsegae Centum ice rink appear as separate optional
   experiences. Neither is a default time block, default map stop, or included
   base-budget total.
5. Optional-experience cards state location, expected duration, booking or
   operating dependency, weather policy, price policy, and the exact base
   blocks they replace when selected.
6. The itinerary, overview recalculation, explore map, activities, food, and
   budget tabs all reflect the same 18 August base plan.
7. The route agent validates that the route does not backtrack to a removed
   east-coast destination and that any option replaces, rather than appends to,
   its assigned base-time window.
8. A new "area-matched meal candidates" tab supplies at least five researched
   backup restaurants for every scheduled breakfast, lunch, and dinner slot.
   These backups are separate from the selected itinerary meal and can be used
   immediately when the selected restaurant has a long wait or is unavailable.

## Confirmed Base Itinerary

The schedule is deliberately westbound after the Haeundae observatory. It
avoids another Haeundae water-activity block because 17 August already covers
the beach and Paradise pool or Cimer.

| Time | Fixed block | Area | Route role |
| --- | --- | --- | --- |
| 08:00-09:00 | Haeundae-area breakfast and Paradise departure | Haeundae | Start |
| 09:30-11:00 | Busan X the Sky | Haeundae / Marine City | Main observatory activity |
| 11:15-12:45 | Transfer and lunch | Centum City | Meal and travel buffer |
| 13:00-14:40 | Museum 1 media-art experience | Centum City | Main indoor activity |
| 15:00-15:45 | Busan Cinema Center exterior and plaza | Centum City | Short fixed stop |
| 16:15-17:30 | F1963 culture, book, cafe, or rest stop | Suyeong | Flexible fixed stop |
| 18:00-20:00 | Gwangalli dinner and evening beach view | Gwangalli | Evening finish |
| 20:00 onward | Return to Paradise Hotel Busan | Haeundae | End |

The itinerary agent owns chronological blocks. The route agent owns the
matching route order and map identifiers:

`Paradise Hotel Busan -> Busan X the Sky -> Museum 1 -> Busan Cinema Center ->
F1963 -> Gwangalli -> Paradise Hotel Busan`.

Lunch must use Centum candidates and dinner must use Gwangalli candidates. The
food agent must preserve one selected meal genre per trip within each budget
mode, keep at least three candidates per new slot, and attach current-operation
links or day-of warnings where appropriate.

## Area-Matched Meal Candidates

The selected itinerary restaurants remain the first choice. The new tab is a
practical fallback list, not a second set of automatically scheduled meals.
It provides five additional researched candidates for each active meal slot:

| Date | Breakfast area | Lunch area | Dinner area |
| --- | --- | --- | --- |
| 16 August | Seoul Station before the 07:58 KTX | Busan Station / Choryang / science-hall approach | Choryang Traditional Market and Bupyeong Kkangtong Market |
| 17 August | Busan Station / Asti before rental pickup | Haedong Yonggungsa / Songjeong to Mipo approach | Haeundae / Paradise return area |
| 18 August | Haeundae / Paradise departure area | Centum City / Museum 1 area | Gwangalli dinner area |
| 19 August | Haeundae / Paradise checkout area | Haeundae Rib Barbecue Restaurant area before Busan Station | Busan Station boarding-area five-item takeaway or snack fallback |

The 19 August evening has no sit-down dinner: the KTX leaves Busan at 14:31 and
arrives in Seoul at 17:14. Its final group is therefore explicitly labelled
"KTX boarding takeaway" rather than misrepresenting a restaurant visit as part
of the Busan schedule.

Every backup record contains a name, cuisine genre, nearby scheduled area,
meal slot, map or official link, short route-fit reason, wait-risk guidance,
and a day-of operation-confirmation warning. Research prioritizes walkable or
single-short-ride choices from the immediately preceding and following blocks.
It deliberately mixes cuisines so one crowded genre does not force the family
to choose another restaurant of the same kind.

The tab groups the choices by date and breakfast/lunch/dinner, displays the
selected itinerary restaurant first, and then the five researched backups. A
compact status label communicates "go now", "check wait", or "booking/operation
check"; it does not claim live table availability. External map links let the
family make a fast on-site replacement decision.

## Optional Experiences

### Yacht Experience

The app exposes a Suyeong Bay yacht option with a provider/boarding-point link,
not a guaranteed reservation. Its expected tour duration is approximately one
hour, subject to the selected operator and departure slot. The card must state
that rain, wind, sea conditions, or a captain decision can cancel or reschedule
the experience.

The option replaces the combined Busan Cinema Center and F1963 time window; it
does not add a second evening activity. It returns to the Suyeong or Gwangalli
side before the fixed Gwangalli dinner. Its price is an external booking-time
amount because summer, daytime, sunset, night, party size, and provider change
the price. The base budget excludes it and displays a separate "selected
experience" notice rather than a stale hard-coded amount.

### Shinsegae Centum Ice Rink

The ice rink is a same-day, condition-dependent option with an approximately
two-hour session. Its card records the Centum location, booking or arrival
requirement, operating-hours confirmation, protective-equipment requirement,
and a notice that the family decides on the day.

It replaces the Busan Cinema Center and F1963 window, so it is never appended
after the base plan. The base budget excludes it and reports its extra cost only
when the option is selected. The map keeps the default route unchanged until a
future explicit option-selection interaction is added.

## Data and Agent Contract

`docs/assets/data/busan-family-trip-2026.json` remains the single source for
the itinerary. Day 18 receives:

- new `defaultBlocks`, `routeSequences`, `mapRoutePoints`, and
  `mapPlaceCatalog` entries for the confirmed base route;
- Centum and Gwangalli meal candidates, selections, and priorities for each
  budget mode;
- a structured optional-experience collection with stable identifiers,
  replacement block identifiers, condition text, duration, cost policy, and
  source links; and
- budget and source-recheck details that distinguish base costs from optional
  costs.

Add a `mealFallbacks` collection keyed by date and active meal slot. Each entry
has exactly the shared meal-candidate fields plus a wait-risk label. It must
contain at least five entries per displayed slot and must not replace
`mealSlots`, `mealSelections`, or `mealPriorities`; those fields continue to
drive budget-aware itinerary selection. The food agent owns fallback validation
and rejects a record whose area does not match the slot's route area.

The activity agent returns confirmed activities and options separately. The
route agent receives only confirmed activities for the normal route and rejects
an option whose replacement block is absent or whose insertion creates a route
backtrack. The orchestrator reports operational warnings without replacing a
confirmed base block on its own.

## UI Behavior

- Overview recalculation recomputes the selected budget plan while preserving
  the confirmed 18 August route and showing any operational warnings.
- The itinerary day card shows the base blocks in time order, followed by a
  visually distinct optional-experiences section. Optional cards state what
  they replace.
- The explore map highlights and connects only the confirmed base pins for day
  18. Optional cards may link to their place but do not inject a route pin.
- The activities tab exposes the yacht and rink with their constraints. The
  food tab shows the selected Centum lunch and Gwangalli dinner for the active
  budget mode.
- The area-matched meal-candidates tab lets the family open a date, then a
  breakfast, lunch, dinner, or KTX-takeaway group. It keeps the chosen meal
  visually separate from five backup choices and never mutates the itinerary
  unless the user makes a later explicit selection.
- The budget tab includes the base day in every plan and shows the two optional
  activities as excluded, booking-time additions.

## Error Handling and Sources

The app treats operator hours, price, availability, and weather suitability as
reconfirmation requirements, not live guarantees. It preserves the base
itinerary when either option is unavailable. Recheck links must cover Busan X
the Sky, Museum 1, Busan Cinema Center, F1963, the official rink, and the yacht
operator or boarding source.

## Verification

1. Add data and agent tests proving that the removed Osiria attractions no
   longer occur in day 18 data, output, map routes, or budget overrides.
2. Add regression coverage for the identical base route across light, balanced,
   and comfort modes, including overview recalculation.
3. Add optional-experience contract tests for replacement block identifiers,
   duration, conditions, sources, and excluded base-budget treatment.
4. Add food-data tests requiring five fallback records for each displayed meal
   group, area alignment, unique restaurant names within a group, usable links,
   and the 19 August KTX-takeaway exception.
5. Extend static UI QA to require the optional card labels, the new meal
   candidates tab, and day 18 route labels. Run project unit tests, static QA,
   syntax checks, JSON parsing, and the production build before deployment.
6. Manually verify desktop, tablet, and mobile views: a day 18 map selection
   highlights the base route in order, and no option card changes the default
   itinerary accidentally. Verify that meal fallback groups remain readable and
   their external links are reachable without obscuring the selected meal.
