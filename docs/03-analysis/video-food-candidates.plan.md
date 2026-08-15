# Video food candidates plan

- [x] Confirm the requested behavior: list every collected candidate in the food tab by itinerary area, not only the three itinerary recommendations.
- [x] Preserve the three-meal itinerary limit while exposing the complete candidate list separately.
- [x] Add structured candidates with area, menu, route status, and source identifier.
- [x] Mark candidates outside the scheduled area as `우회 필요` instead of dropping them.
- [x] Add a regression test covering the full candidate list and the itinerary limit.
- [x] Verify JSON parsing, agent tests, JavaScript syntax, and the food tab in the local app.

## Acceptance criteria

- The food tab shows all stored candidates for each travel date.
- Each candidate visibly states its area, route status, menu type, and video source identifier.
- The itinerary summary remains capped by the selected budget mode's meal limit.
