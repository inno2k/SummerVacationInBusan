# Breakfast, Rental, and Luggage Transfer Design

## Goal

Update the Busan family-trip application for the confirmed 16-19 August 2026
plan. Every travel day has a local breakfast option, 17 August uses a rental car
for Haedong Yonggungsa before the Haeundae day, and 19 August uses Zim Carry to
send luggage from Paradise Hotel Busan to Busan Station before lunch at Haeundae
Rib Barbecue Restaurant.

## Scope and Acceptance Criteria

1. The itinerary, food, route, budget, and overview tabs show breakfast, lunch,
   and dinner for every applicable day. The 16 August breakfast is before the
   Seoul KTX departure; the other breakfasts are in the relevant local area.
2. A selected budget type changes the meal choices and costs consistently across
   all tabs while retaining the fixed KTX, lodging, 17 August rental/temple, and
   19 August luggage-transfer commitments.
3. The 17 August route is ordered as Asti Hotel, rental pickup, Paradise luggage
   drop, Haedong Yonggungsa, Mipo, Cheongsapo, Paradise water activity, Haeundae
   beach, and Haeundae-area rental return. Its map route uses the same order.
4. The transportation view provides a comparison card for SK Rent-a-Car Busan
   Station and Lotte Rent-a-Car Busan Station, including booking links, pickup
   location, and a reminder to confirm same-day Haeundae return availability.
5. The 19 August route is ordered as Paradise checkout, Zim Carry handoff,
   Haeundae Rib Barbecue Restaurant lunch, Busan Station Zim Carry collection,
   KTX boarding buffer, and the 14:31 KTX departure. It must not include a
   second Haeundae activity.
6. Every selected meal genre is unique within a budget type. Each meal slot has
   at least three candidates, a local-area reason, a current-information link,
   and a day-of-operation warning where needed.
7. All three budget displays include the added breakfast, rental-car, and Zim
   Carry costs in amounts and explanatory detail.

## Data Model

`docs/assets/data/busan-family-trip-2026.json` remains the single itinerary
source. Add a `breakfast` entry to each day in `mealSlots`, `mealSelections`, and
`mealPriorities`. Existing food-selection logic consumes slots generically, so a
slot is identified by `meal: "breakfast"`, rather than a special UI-only field.

Add a `rentalOptions` object with two providers:

| Provider | Pickup reference | Required display rule |
| --- | --- | --- |
| SK Rent-a-Car | Busan Station branch, Jungang-daero 180beon-gil 12 | Link to booking/location and require return-branch confirmation. |
| Lotte Rent-a-Car | Busan Station branch, Jungang-daero 248beon-gil 7-7 | Link to official branch information and require return-branch confirmation. |

Add a `luggageTransfer` record for Zim Carry with Paradise Hotel pickup,
Busan Station first-floor meeting-hall collection, booking link, collection
deadline warning, and a fixed `confirmed` state. The state represents the
user-confirmed planned service, not a guarantee of a vendor reservation.

Update `defaultBlocks`, `routeSequences`, `mapRoutePoints`, and
`mapPlaceCatalog` together. Map coordinates and block titles must use matching
place identifiers so date selection highlights the same pins that route drawing
uses.

## Itinerary Rules

### 16 August

Show a Seoul Station local/cafe breakfast before the 07:58 KTX. Do not alter the
fixed 10:46 Busan arrival, Asti luggage drop, Ijaemo Pizza lunch, science hall,
Choryang market, Bupyeong Kkangtong Market dinner, or Asti return.

### 17 August

Use a Busan Station-area breakfast, Asti checkout, and rental pickup. Use the
car for Paradise luggage drop, Haedong Yonggungsa, and Mipo parking. The
Blue Line Park section must be a Mipo-based round trip so the car is not left at
Cheongsapo. Continue to Paradise Ocean Pool or Cimer, Haeundae Beach, dinner,
and rental return in the Haeundae area. The UI must identify the rental return as
booking-dependent and offer Busan Station return as the fallback, without
silently changing the route.

### 18 August

Add a Haeundae-area local breakfast before the existing Osiria experience day.
Retain the weather-dependent science museum/luge logic and avoid duplicating
the 17 August Haeundae water activities.

### 19 August

Add a Mipo/Haeundae-area local breakfast. After checkout, send luggage through
Zim Carry to Busan Station, eat lunch at Haeundae Rib Barbecue Restaurant when
it opens, then take a direct taxi to Busan Station. The schedule reserves a
collection and boarding buffer before 14:31. The user-facing warning must say
to reserve Zim Carry and confirm both its collection cutoff and the restaurant
wait-list timing before departure.

## Agent Responsibilities

The itinerary agent owns time blocks and ordering. The route agent owns
route-sequence validation and matching map pins. The transport agent owns KTX,
rental provider options, return fallback, and Zim Carry handoff/collection. The
food agent owns three candidates per meal slot, unique selected genres, and
budget-aware selection. The lodging agent owns Asti checkout and Paradise
handoff/check-out blocks. The orchestrator combines these results and emits a
warning if a rental return, restaurant opening/wait-list, or Zim Carry booking
has not been reconfirmed.

## UI Behavior

- Overview: recalculation regenerates the current budget itinerary and includes
  breakfast, rental, luggage transfer, and its warnings.
- Itinerary: displays each day in its existing day card, with breakfast inserted
  chronologically rather than appended.
- Explore map: selecting 17 or 19 draws the complete ordered route, highlights
  its pins, and distinguishes logistics stops from food/activity stops in labels.
- Transport: displays the two rental options and the Zim Carry step as actionable
  logistics cards with external links.
- Food and budget: show only the selected budget's detailed food amount and
  selected meals; alternatives remain available in each meal slot.

## Error Handling

External links and vendor operations are not treated as live availability. If a
booking is not marked reconfirmed, the UI preserves the approved schedule and
shows an explicit action warning. If Haeundae-area rental return is unavailable,
the transport agent offers Busan Station return as a visible alternative, with
its extra time impact. It never removes KTX or the user's requested restaurant
without a visible warning.

## Verification

1. Extend unit tests for breakfast slot coverage, selected-genre uniqueness,
   17 August route order, rental provider metadata, and 19 August Zim Carry /
   galbi / KTX ordering.
2. Extend static QA to require the new operational labels and links.
3. Run all project tests, JavaScript syntax checks, JSON parsing, and the static
   QA server check.
4. Manually verify desktop and mobile layouts for all tabs, then verify that
   switching each budget type updates food, itinerary, overview, and map route
   consistently.
