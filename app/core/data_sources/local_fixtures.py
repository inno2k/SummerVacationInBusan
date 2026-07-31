import json
from datetime import date
from pathlib import Path

from app.core.data_sources.base import DataSourceError
from app.core.models import Coordinates, EmergencyPlaybook, PlaceCandidate, SourceSignal, SourceType

JsonRecord = dict[str, object]


class LocalFixtureDataSource:
    """API-free data source backed by checked-in JSON fixture files."""

    def __init__(self, fixture_dir: str | Path) -> None:
        """Store the fixture directory path for later lazy reads."""
        self.fixture_dir = Path(fixture_dir)

    def search_places(
        self,
        query: str,
        area: str | None = None,
        category: str | None = None,
    ) -> list[PlaceCandidate]:
        """Return local family place and restaurant candidates matching filters."""
        records = [
            *self._read_records("family_places.json"),
            *self._read_records("restaurants.json"),
        ]

        return [
            self._place_from_record(record)
            for record in records
            if self._matches_place(record, query=query, area=area, category=category)
        ]

    def get_emergency_help(self, issue_type: str) -> str:
        """Return emergency help text, falling back to the default playbook entry."""
        entries = self._read_string_mapping("emergency_playbooks.json")
        return EmergencyPlaybook(entries=entries).answer(issue_type)

    def search_youtube_seed(self, query: str) -> list[SourceSignal]:
        """Return API-free YouTube seed signals matching title, keywords, or places."""
        return [
            self._youtube_signal_from_record(record)
            for record in self._read_records("youtube_seed_2026.json")
            if self._matches_youtube_seed(record, query=query)
        ]

    def _read_json(self, filename: str) -> object:
        fixture_path = self.fixture_dir / filename
        try:
            with fixture_path.open(encoding="utf-8") as fixture_file:
                return json.load(fixture_file)
        except OSError as exc:
            raise DataSourceError(f"Could not read fixture file: {fixture_path}") from exc
        except json.JSONDecodeError as exc:
            raise DataSourceError(f"Fixture file is not valid JSON: {fixture_path}") from exc

    def _read_records(self, filename: str) -> list[JsonRecord]:
        data = self._read_json(filename)
        if not isinstance(data, list) or not all(isinstance(item, dict) for item in data):
            raise DataSourceError(f"Fixture file must contain a list of objects: {filename}")
        return data

    def _read_string_mapping(self, filename: str) -> dict[str, str]:
        data = self._read_json(filename)
        if not isinstance(data, dict) or not all(
            isinstance(key, str) and isinstance(value, str) for key, value in data.items()
        ):
            raise DataSourceError(f"Fixture file must contain a string mapping: {filename}")
        return data

    def _matches_place(
        self,
        record: JsonRecord,
        query: str,
        area: str | None,
        category: str | None,
    ) -> bool:
        if area is not None and self._normalize(
            self._required_string(record, "area")
        ) != self._normalize(area):
            return False
        if category is not None and self._normalize(
            self._required_string(record, "category")
        ) != self._normalize(category):
            return False

        return self._query_matches(
            query,
            [self._required_string(record, "name"), *self._string_list(record, "tags")],
        )

    def _matches_youtube_seed(self, record: JsonRecord, query: str) -> bool:
        return self._query_matches(
            query,
            [
                self._required_string(record, "title"),
                *self._string_list(record, "extracted_keywords"),
                *self._string_list(record, "matched_place_names"),
            ],
        )

    def _place_from_record(self, record: JsonRecord) -> PlaceCandidate:
        name = self._required_string(record, "name")
        return PlaceCandidate(
            name=name,
            area=self._required_string(record, "area"),
            address=self._optional_string(record, "address"),
            category=self._required_string(record, "category"),
            tags=self._string_list(record, "tags"),
            coordinates=self._coordinates(record),
            family_score=self._required_float(record, "family_score"),
            food_score=self._required_float(record, "food_score"),
            weather_suitability=self._required_string(record, "weather_suitability"),
            fatigue_impact=self._required_string(record, "fatigue_impact"),
            source_signals=[
                SourceSignal(
                    source_type=SourceType.LOCAL_FIXTURE,
                    title=f"local fixture: {name}",
                    confidence_impact=0.1,
                    fallback_used=True,
                )
            ],
            confidence=self._required_float(record, "confidence"),
        )

    def _youtube_signal_from_record(self, record: JsonRecord) -> SourceSignal:
        published_at = date.fromisoformat(self._required_string(record, "published_at"))
        return SourceSignal(
            source_type=SourceType.YOUTUBE,
            title=self._required_string(record, "title"),
            url=self._optional_string(record, "url"),
            published_at=published_at,
            channel_name=self._optional_string(record, "channel_name"),
            extracted_keywords=self._string_list(record, "extracted_keywords"),
            matched_place_names=self._string_list(record, "matched_place_names"),
            confidence_impact=self._required_float(record, "confidence_impact"),
            live_signal=True,
            fallback_used=True,
        )

    def _coordinates(self, record: JsonRecord) -> Coordinates | None:
        value = record.get("coordinates")
        if value is None:
            return None
        if not isinstance(value, dict):
            raise DataSourceError("Place coordinates must be an object.")
        return Coordinates(
            latitude=self._required_float(value, "latitude"),
            longitude=self._required_float(value, "longitude"),
        )

    def _query_matches(self, query: str, values: list[str]) -> bool:
        terms = [term for term in self._normalize(query).split() if term]
        if not terms:
            return True

        haystack = " ".join(self._normalize(value) for value in values)
        return all(term in haystack for term in terms)

    def _required_string(self, record: JsonRecord, key: str) -> str:
        value = record.get(key)
        if not isinstance(value, str):
            raise DataSourceError(f"Fixture field must be a string: {key}")
        return value

    def _optional_string(self, record: JsonRecord, key: str) -> str | None:
        value = record.get(key)
        if value is None or isinstance(value, str):
            return value
        raise DataSourceError(f"Fixture field must be a string when present: {key}")

    def _required_float(self, record: JsonRecord, key: str) -> float:
        value = record.get(key)
        if isinstance(value, int | float):
            return float(value)
        raise DataSourceError(f"Fixture field must be numeric: {key}")

    def _string_list(self, record: JsonRecord, key: str) -> list[str]:
        value = record.get(key)
        if isinstance(value, list) and all(isinstance(item, str) for item in value):
            return value
        raise DataSourceError(f"Fixture field must be a string list: {key}")

    def _normalize(self, value: str) -> str:
        return value.casefold()
