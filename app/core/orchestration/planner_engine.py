from collections.abc import Sequence

from app.core.data_sources.base import DataSourceError
from app.core.data_sources.local_fixtures import LocalFixtureDataSource
from app.core.models import (
    ItineraryBundle,
    ItineraryDay,
    ItineraryOption,
    OptionId,
    PlaceCandidate,
    ScheduleItem,
    SourceSignal,
    SourceType,
    TripRequest,
)
from app.core.scoring.place_ranker import rank_places


class PlannerEngine:
    """Generate deterministic itinerary options from configured data sources."""

    def __init__(self, fixture_source: LocalFixtureDataSource) -> None:
        self.fixture_source = fixture_source

    @classmethod
    def fixture_only(cls) -> "PlannerEngine":
        """Build an engine that runs without API keys."""
        return cls(LocalFixtureDataSource("data/fixtures"))

    def generate(self, request: TripRequest) -> ItineraryBundle:
        """Generate three fixture-backed itinerary options for a trip request."""
        experiences = self.fixture_source.search_places(query="", area=None, category="experience")
        food_candidates = self.fixture_source.search_places(query="", area=None, category=None)
        if not experiences or not food_candidates:
            raise DataSourceError("Local fixtures must include experience and food candidates.")

        options = [
            self._build_option(
                option_id=OptionId.BALANCED,
                title="Balanced Family Busan",
                positioning="Representative sights, local food, efficient movement, and rest.",
                stay_area="Haeundae",
                request=request,
                experiences=experiences,
                food_candidates=food_candidates,
            ),
            self._build_option(
                option_id=OptionId.KID_EXPERIENCE,
                title="Kid Experience Busan",
                positioning="Child-friendly activities, beach time, and indoor fallback safety.",
                stay_area="Haeundae",
                request=request,
                experiences=experiences,
                food_candidates=food_candidates,
            ),
            self._build_option(
                option_id=OptionId.FOOD_REST,
                title="Food and Rest Busan",
                positioning="Lower-fatigue meals, cafes, ocean views, and calmer routes.",
                stay_area="Gwangalli",
                request=request,
                experiences=experiences,
                food_candidates=food_candidates,
            ),
        ]

        return ItineraryBundle(
            request_summary=(
                f"{request.origin} to {request.destination}, "
                f"{request.start_date.isoformat()} to {request.end_date.isoformat()}, "
                f"family of {len(request.travelers)}"
            ),
            assumptions=[
                "Runs with local fixture fallback when API keys are absent.",
                "KTX, restaurants, and venue hours must be confirmed before travel.",
                "No booking automation is included in the MVP.",
            ],
            options=options,
            emergency_playbook=self._emergency_playbook(),
            source_audit=self._collect_source_audit(
                [*experiences, *food_candidates],
            ),
        )

    def _build_option(
        self,
        option_id: OptionId,
        title: str,
        positioning: str,
        stay_area: str,
        request: TripRequest,
        experiences: Sequence[PlaceCandidate],
        food_candidates: Sequence[PlaceCandidate],
    ) -> ItineraryOption:
        ranked_experiences = rank_places(list(experiences), option_id.value)
        ranked_food = rank_places(list(food_candidates), option_id.value)
        days = [
            self._build_day(
                option_id=option_id,
                day_index=index,
                trip_date=trip_date,
                stay_area=stay_area,
                experience=ranked_experiences[index % len(ranked_experiences)],
                food=ranked_food[index % len(ranked_food)],
            )
            for index, trip_date in enumerate(request.trip_dates)
        ]
        return ItineraryOption(
            id=option_id,
            title=title,
            positioning=positioning,
            recommended_stay_area=stay_area,
            days=days,
            pros=[
                "API keys are optional for the demo path.",
                "Each day keeps one main movement block.",
                "Fallback guidance is included.",
            ],
            cautions=[
                (
                    "Confirm current operating hours, reservations, and transit status "
                    "before visiting."
                ),
                "Treat fixture-backed suggestions as planning guidance, not booking confirmation.",
            ],
            estimated_budget_range="medium",
            confidence=0.7,
        )

    def _build_day(
        self,
        option_id: OptionId,
        day_index: int,
        trip_date,
        stay_area: str,
        experience: PlaceCandidate,
        food: PlaceCandidate,
    ) -> ItineraryDay:
        return ItineraryDay(
            date=trip_date,
            theme=self._theme_for_day(option_id, day_index),
            route_summary=f"Base around {stay_area}; keep one major cross-city movement block.",
            schedule_items=[
                ScheduleItem(
                    time_window="10:00-14:00",
                    place=experience,
                    activity=f"Visit {experience.name} with a food/rest buffer near {food.name}.",
                    transport_hint=(
                        "Use subway for predictable routes and taxi when family fatigue rises."
                    ),
                    food_hint=f"Consider {food.name}; confirm current hours before visiting.",
                    estimated_cost_level="medium",
                    child_friendliness=experience.family_score,
                    fatigue_level=experience.fatigue_impact,
                    source_refs=[signal.title for signal in experience.source_signals],
                )
            ],
            fallback_plan=(
                "If weather, queues, or fatigue become an issue, switch to Busan Aquarium, "
                "Centum City, or a cafe rest block."
            ),
        )

    def _theme_for_day(self, option_id: OptionId, day_index: int) -> str:
        themes = {
            OptionId.BALANCED: [
                "Arrival and beach",
                "East Busan family sights",
                "Culture and local food",
                "Departure buffer",
            ],
            OptionId.KID_EXPERIENCE: [
                "Arrival and aquarium",
                "Active family day",
                "Indoor fallback day",
                "Easy departure",
            ],
            OptionId.FOOD_REST: [
                "Arrival and ocean cafe",
                "Local food focus",
                "Slow beach day",
                "Departure meal",
            ],
        }
        return themes[option_id][day_index]

    def _emergency_playbook(self) -> dict[str, str]:
        return {
            issue_type: self.fixture_source.get_emergency_help(issue_type)
            for issue_type in ("default", "late_night_pharmacy", "lost_item", "tired_child")
        }

    def _collect_source_audit(self, places: Sequence[PlaceCandidate]) -> list[SourceSignal]:
        seen: set[tuple[SourceType, str]] = set()
        audit: list[SourceSignal] = []
        for place in places:
            for signal in place.source_signals:
                key = (signal.source_type, signal.title)
                if key in seen:
                    continue
                seen.add(key)
                audit.append(signal)
        return audit
