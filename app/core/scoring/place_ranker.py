from app.core.models import PlaceCandidate


def rank_places(places: list[PlaceCandidate], option_id: str) -> list[PlaceCandidate]:
    """Return places sorted for the requested itinerary option."""

    def score(place: PlaceCandidate) -> float:
        if option_id == "kid_experience":
            return (place.family_score * 0.7) + (place.confidence * 0.3)
        if option_id == "food_rest":
            low_fatigue_bonus = 0.2 if place.fatigue_impact == "low" else 0.0
            return (place.food_score * 0.6) + (place.confidence * 0.2) + low_fatigue_bonus
        return (place.family_score * 0.35) + (place.food_score * 0.35) + (
            place.confidence * 0.3
        )

    return sorted(places, key=score, reverse=True)
