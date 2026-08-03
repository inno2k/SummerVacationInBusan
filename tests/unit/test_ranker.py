from app.core.models import PlaceCandidate, SourceSignal, SourceType
from app.core.scoring.place_ranker import rank_places


def _candidate(
    *,
    name: str,
    family_score: float,
    food_score: float,
    confidence: float,
    fatigue_impact: str = "medium",
) -> PlaceCandidate:
    return PlaceCandidate(
        name=name,
        area="Test Area",
        category="experience",
        family_score=family_score,
        food_score=food_score,
        weather_suitability="indoor",
        fatigue_impact=fatigue_impact,
        confidence=confidence,
        source_signals=[
            SourceSignal(
                source_type=SourceType.LOCAL_FIXTURE,
                title=f"local fixture: {name}",
                confidence_impact=0.1,
                fallback_used=True,
            )
        ],
    )


def test_rank_places_prefers_family_for_kid_option() -> None:
    places = [
        _candidate(name="child first", family_score=0.95, food_score=0.2, confidence=0.7),
        _candidate(name="food first", family_score=0.4, food_score=0.95, confidence=0.9),
    ]

    ranked = rank_places(places, option_id="kid_experience")

    assert ranked[0].name == "child first"


def test_rank_places_prefers_food_and_low_fatigue_for_rest_option() -> None:
    places = [
        _candidate(
            name="popular but tiring",
            family_score=0.9,
            food_score=0.8,
            confidence=0.9,
            fatigue_impact="high",
        ),
        _candidate(
            name="easy meal",
            family_score=0.4,
            food_score=0.82,
            confidence=0.7,
            fatigue_impact="low",
        ),
    ]

    ranked = rank_places(places, option_id="food_rest")

    assert ranked[0].name == "easy meal"
