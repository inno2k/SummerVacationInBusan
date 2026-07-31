from app.core.data_sources.local_fixtures import LocalFixtureDataSource
from app.core.models import SourceType


def test_search_places_returns_local_fixture_source_signal() -> None:
    source = LocalFixtureDataSource("data/fixtures")

    places = source.search_places(query="beach", area="Haeundae", category="experience")

    assert places
    assert places[0].source_signals
    assert places[0].source_signals[0].source_type == SourceType.LOCAL_FIXTURE
    assert places[0].source_signals[0].fallback_used is True


def test_emergency_help_includes_pharmacy_and_default_119() -> None:
    source = LocalFixtureDataSource("data/fixtures")

    assert "pharmacy" in source.get_emergency_help("late_night_pharmacy").lower()
    assert "119" in source.get_emergency_help("default")


def test_search_youtube_seed_returns_2026_source_signals() -> None:
    source = LocalFixtureDataSource("data/fixtures")

    signals = source.search_youtube_seed(query="Busan food")

    assert signals
    assert all(signal.source_type == SourceType.YOUTUBE for signal in signals)
    assert all(signal.fallback_used is True for signal in signals)
    assert all(signal.published_at.year == 2026 for signal in signals if signal.published_at)


def test_unknown_emergency_issue_falls_back_to_default() -> None:
    source = LocalFixtureDataSource("data/fixtures")

    assert source.get_emergency_help("unknown_issue") == source.get_emergency_help("default")
