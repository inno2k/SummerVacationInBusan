# Busan Family Travel Multi-Agent Planner Design

## 1. Purpose

Build a Busan travel multi-agent planner for a family trip from Seoul Station to Busan from 2026-08-16 to 2026-08-19.

The product should feel like a small travel agency: it creates tailored itinerary options, considers transport, stay area, route efficiency, food, experiences, fallback plans, and 24-hour problem solving.

The first implementation milestone is an agent engine. After the engine is stable, the project will add a local web planner and prepare the repository for GitHub use.

## 2. Approved Product Direction

The MVP uses an engine-first approach.

1. Build a CLI/API-capable agent engine.
2. Generate structured JSON and a human-readable Markdown travel proposal.
3. Wrap the engine with a local Streamlit web app.
4. Prepare README, sample outputs, tests, and GitHub sync.

The engine starts with three itinerary options, then supports shallow conversational replanning for the selected option.

## 3. Target Trip Defaults

- Origin: Seoul Station
- Destination: Busan
- Dates: 2026-08-16 to 2026-08-19
- Travelers:
  - Father, age 46
  - Mother, age 44
  - Son, age 12
- Trip style:
  - Family-friendly
  - Balanced pace
  - Local food
  - Weather-aware
  - Fallback-ready

## 4. User Experience

The planner first generates three itinerary options.

- Balanced: representative attractions, food, efficient movement, and rest.
- Kid Experience: activities, beaches, aquariums, indoor options, and places likely to interest a 12-year-old.
- Food and Rest: lower fatigue, food, cafes, ocean views, and a calmer route.

After the user chooses one option, the replanning flow supports requests such as:

- Change to rainy-day indoor activities.
- Rebuild the route around a Haeundae stay area.
- Reduce day 3 if the child is tired.
- Replace a dinner category.
- Provide late-night help for pharmacy, hospital, taxi, lost items, or emergency needs.

The output always includes:

- Markdown travel proposal for humans.
- Structured JSON for the web app and future exports.

## 5. Agent Structure

The MVP uses seven agents.

### TripDirectorAgent

Interprets trip constraints, family profile, dates, preferences, and overall trip tone. It coordinates the three-option itinerary bundle.

### TransportAgent

Plans Seoul Station to Busan Station transport guidance, Busan local movement, and when to prefer subway, bus, taxi, or walking.

### StayAreaAgent

Recommends stay areas instead of booking a specific hotel. Candidate areas include Haeundae, Gwangalli, Seomyeon, and Busan Station. If the user selects a stay area, the route is recalculated around it.

### FoodAgent

Recommends family-friendly Busan food options such as dwaeji gukbap, milmyeon, seafood, cafes, and child-friendly restaurants. It considers queue risk, route fit, taste diversity, and family suitability.

### ExperienceAgent

Suggests family activities such as beaches, Busan Aquarium, Songdo Marine Cable Car, Gamcheon Culture Village, Taejongdae, and indoor alternatives.

### RiskAndFallbackAgent

Adds fallback plans for rain, heat, fatigue, queues, transport delays, closures, and crowding.

### ConciergeAgent

Handles 24-hour problem-solving questions such as pharmacy, hospital, lost items, late-night transport, taxi guidance, emergency contacts, and itinerary compression.

## 6. Engine Flow

1. TripDirectorAgent normalizes the TripRequest.
2. Specialist agents generate candidate data through tool interfaces.
3. TripDirectorAgent assembles three itinerary options.
4. RiskAndFallbackAgent adds weather, fatigue, crowd, and closure alternatives.
5. The engine validates the result against Pydantic models.
6. The renderer exports JSON and Markdown.
7. If the user selects an option, ConciergeAgent and specialist agents generate a shallow ReplanPatch.

The agents return structured JSON fragments instead of free-form long text. This keeps the output stable for the CLI, web app, future map views, PDF export, and replanning.

## 7. Data and API Strategy

The data strategy is hybrid.

- Use live data sources when API keys are configured.
- Use local fixtures when API keys are missing or live calls fail.
- Always record source, confidence, lastChecked, and fallbackUsed.
- Avoid definitive claims for real-time-sensitive information such as operating hours, booking status, prices, or availability.

### Local Fixtures

Local fixtures make the project runnable without API keys.

- Busan areas
- Family places
- Restaurants
- Rainy-day options
- Emergency playbooks
- YouTube seed data for 2026

### Optional Live Sources

- Google Maps Places or compatible Places API for location candidates.
- Weather API for rain, heat, and storm-aware fallback plans.
- Web search for recent operation changes, events, and closures.
- YouTube Data API for 2026 Busan travel and food video signals.

KTX and Korail are handled as guidance and checklist items in the MVP. The MVP does not automate train booking.

### Future Sources

- Korea Tourism Organization TourAPI
- Kakao or Naver Local
- Accommodation partner links
- Calendar and messenger integrations

## 8. YouTube Travel Intelligence

YouTube is used as a travel signal source, not as a source of truth.

The live YouTube source only accepts videos published in 2026. As of the design date, 2026-07-31, the practical search window is 2026-01-01 through 2026-07-31.

Example queries:

- 2026 부산 가족여행 3박4일
- 2026 부산 아이랑 가볼만한곳
- 2026 부산 맛집 해운대
- 2026 부산 비오는날 실내 여행
- 2026 부산 여름 여행 코스

YouTube Data API usage:

- search.list finds candidate videos.
- videos.list enriches candidates with metadata such as published date, channel, description, and engagement data.

Ranking rules:

- Include 2026 videos only.
- Prefer family, child-friendly, summer, food, rainy-day, and Busan-area relevance.
- Treat repeated place mentions as candidate signals.
- Lower confidence for likely sponsored, promotional, vague, or weakly related videos.
- Cross-check YouTube-derived places against local fixtures and live place sources where available.

## 9. Tool Interfaces

Agents access data only through tools.

- search_places(query, area, category)
- estimate_route(origin, destination, mode)
- get_weather_forecast(city, date_range)
- get_transport_options(origin, destination, date)
- get_emergency_help(location, issue_type, time)
- search_youtube_travel_videos(query, published_after, max_results)
- rank_video_signals(videos, trip_context)
- extract_place_candidates_from_video_metadata(video)
- cross_check_place_candidates(candidates, local_fixtures, places_api_results)

This keeps CrewAI replaceable and prevents business logic from being trapped inside agent prompts.

## 10. Architecture and File Structure

```text
summer-vacation-in-busan/
  README.md
  .env.example
  pyproject.toml

  app/
    __init__.py

    cli/
      main.py

    web/
      streamlit_app.py

    core/
      models/
        trip_request.py
        itinerary.py
        place.py
        source.py
        emergency.py

      agents/
        trip_director.py
        transport_agent.py
        stay_area_agent.py
        food_agent.py
        experience_agent.py
        risk_fallback_agent.py
        concierge_agent.py

      orchestration/
        crew_runner.py
        planner_engine.py
        replanner_engine.py

      tools/
        places.py
        routes.py
        weather.py
        transport.py
        youtube.py
        emergency.py

      data_sources/
        base.py
        local_fixtures.py
        google_places.py
        youtube_data_api.py
        weather_api.py
        web_search.py

      scoring/
        place_ranker.py
        itinerary_ranker.py
        confidence.py

      rendering/
        markdown_report.py
        json_export.py

      validation/
        schema_validator.py
        repair.py

  data/
    fixtures/
      busan_areas.json
      family_places.json
      restaurants.json
      rainy_day_options.json
      emergency_playbooks.json
      youtube_seed_2026.json

  outputs/
    .gitkeep

  docs/
    03-analysis/
      busan-travel-agent.plan.md
    04-report/
    superpowers/
      specs/

  tests/
    unit/
      test_models.py
      test_ranker.py
      test_youtube_filter.py
      test_fallback_sources.py

    integration/
      test_planner_engine.py
      test_replanner_engine.py
```

## 11. Core Models

### TripRequest

- origin
- destination
- startDate
- endDate
- travelers
- preferences
- selectedStayArea
- liveDataEnabled

### ItineraryBundle

- requestSummary
- assumptions
- options
- selectedOptionId
- emergencyPlaybook
- sourceAudit
- generatedAt

Each option contains:

- id: balanced, kid_experience, or food_rest
- title
- positioning
- recommendedStayArea
- days
- pros
- cautions
- estimatedBudgetRange
- confidence

Each day contains:

- date
- theme
- routeSummary
- scheduleItems
- fallbackPlan

Each schedule item contains:

- timeWindow
- place
- activity
- transportHint
- foodHint
- estimatedCostLevel
- childFriendliness
- fatigueLevel
- sourceRefs

### PlaceCandidate

- name
- area
- category
- address
- coordinates
- tags
- familyScore
- foodScore
- weatherSuitability
- fatigueImpact
- sourceSignals
- confidence

### SourceSignal

- sourceType: youtube, local_fixture, google_places, weather, or web_search
- title
- url
- publishedAt
- channelName
- extractedKeywords
- matchedPlaceNames
- confidenceImpact
- notes

### ReplanPatch

- userRequest
- affectedDays
- changes
- updatedScheduleItems
- explanation
- sourceAudit

The replanning flow patches an existing itinerary instead of regenerating the whole bundle.

## 12. Error Handling

The planner should still produce a useful result when live sources fail.

- Missing API key: use local fixtures and mark fallbackUsed=true.
- YouTube API failure: use 2026 seed data or continue without YouTube signals.
- Places API failure: use local place candidates.
- Weather API failure: mark weather as unchecked and include default rain and heat alternatives.
- Invalid LLM output: validate, attempt one repair, then use deterministic fallback template if repair fails.
- Real-time-sensitive claims: include caution text and avoid certainty.

## 13. Validation Rules

- Trip dates must generate exactly four days: 2026-08-16, 2026-08-17, 2026-08-18, and 2026-08-19.
- YouTube live signals must have publishedAt in 2026.
- The itinerary bundle must include balanced, kid_experience, and food_rest options.
- Every recommended place or schedule item must have at least one source signal or fallback source.
- ReplanPatch may only modify valid existing days and items.
- The final output must pass Pydantic validation before rendering.

## 14. Testing Strategy

### Unit Tests

- TripRequest date and traveler validation.
- YouTube 2026 filtering.
- API failure to local fixture fallback.
- Place ranking.
- JSON schema validation and repair behavior.

### Integration Tests

- Generate three options without API keys.
- Generate with mocked 2026 YouTube signals.
- Generate a rainy-day ReplanPatch.
- Render Markdown and JSON exports.

### Manual Smoke Tests

- Run the CLI with default trip values.
- View three options in Streamlit.
- Select one option and request replanning.
- Export Markdown and JSON.

## 15. MVP Delivery Plan

### MVP 1: Agent Engine

- Python project scaffold.
- Pydantic models.
- Local fixture data.
- DataSource interface and local fallback.
- YouTube source, 2026 filter, and signal ranking.
- Seven agent roles.
- PlannerEngine for three itinerary options.
- ReplannerEngine for shallow conversational changes.
- Markdown and JSON renderers.
- Unit and integration tests.

### MVP 2: Local Web Planner

- Streamlit app.
- Default trip form.
- Three-option comparison view.
- Selected itinerary detail view.
- Replanning input.
- Markdown download and JSON export.

### MVP 3: GitHub Readiness

- README.
- .env.example.
- Sample output files.
- Test commands.
- Minimal GitHub Actions CI.
- Demo path that works without API keys.

## 16. Out of Scope for MVP

- Real booking or payment.
- Automated KTX reservation.
- Accommodation booking.
- Real-time collaborative editing.
- Calendar integration.
- Mobile app.
- Offline travel companion mode.
- Drag-and-drop map editing.

## 17. Key Risks and Controls

- CrewAI output instability: use Pydantic validation, one repair pass, and deterministic fallback.
- Stale or wrong live information: show source, confidence, lastChecked, and caution text.
- YouTube promotional bias: use 2026 filter, repeated-signal ranking, and cross-checking.
- API key friction: default to local fixtures.
- Scope growth: keep booking, collaboration, and advanced map editing outside MVP.

## 18. Definition of Done

The first implementation is done when:

- The project runs without API keys.
- The default trip generates three itinerary options.
- YouTube signals are limited to 2026 data.
- Output includes fallback, source, and confidence information.
- JSON and Markdown exports work.
- Planner and replanner tests pass.
- README explains setup, optional API keys, and demo commands.
