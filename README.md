# Summer Vacation In Busan

Engine-first Busan family travel planner for a Seoul Station to Busan family trip from 2026-08-16 to 2026-08-19.

## What It Does

- Generates three itinerary options: balanced, kid experience, and food/rest.
- Supports shallow replanning for requests such as rainy-day changes or child fatigue.
- Runs without API keys using local fixtures.
- Keeps optional live-source hooks for YouTube, places, and weather data.
- Filters live YouTube travel signals to 2026 videos only.
- Exports Markdown and JSON for CLI, web, and later agent workflows.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -e .[dev]
```

## CLI Demo

```bash
python -m app.cli.main plan --output markdown
python -m app.cli.main plan --output json
python -m app.cli.main replan "비가 오면 실내 일정으로 바꿔줘" --target-date 2026-08-17
```

`--format` is also available as an alias for `--output`.

## Web Demo

```bash
python -m streamlit run app/web/streamlit_app.py
```

## Optional API Keys

Copy `.env.example` to `.env` and fill the keys you want to use. The planner still works without keys.

```dotenv
LIVE_DATA_ENABLED=false
YOUTUBE_API_KEY=
GOOGLE_PLACES_API_KEY=
WEATHER_API_KEY=
OPENAI_API_KEY=
```

## Architecture

The project keeps the travel engine deterministic and testable. Optional agent frameworks such as CrewAI can use the role definitions in `app/core/agents`, but the business logic remains in Pydantic models, data-source adapters, scoring, planner, replanner, and renderers.

## Verification

```bash
python -m ruff check .
python -m pytest -v
python -m app.cli.main plan --output markdown
python -m app.cli.main plan --output json
```

## MVP Limits

This project does not book KTX tickets, hotels, restaurants, or paid experiences. It generates planning guidance and flags real-time details that must be confirmed before travel.
