from datetime import date

from app.core.data_sources.base import DataSourceError
from app.core.data_sources.local_fixtures import LocalFixtureDataSource
from app.core.models import (
    EmergencyPlaybook,
    ItineraryBundle,
    ItineraryOption,
    ReplanChange,
    ReplanPatch,
    ScheduleItem,
    SourceSignal,
)


class Replanner:
    """Create small itinerary patches for weather, fatigue, and emergency events."""

    def __init__(self, fixture_source: LocalFixtureDataSource) -> None:
        self.fixture_source = fixture_source

    @classmethod
    def fixture_only(cls) -> "Replanner":
        """Build a replanner that runs without API keys."""
        return cls(LocalFixtureDataSource("data/fixtures"))

    def replan(
        self,
        bundle: ItineraryBundle,
        user_request: str,
        target_date: date | None = None,
    ) -> ReplanPatch:
        """Return a patch proposal for the selected option without mutating the bundle."""
        selected_option = self._selected_option(bundle)
        affected_date = target_date or selected_option.days[0].date
        issue_type = self._classify_issue(user_request)
        replacement = self._replacement_item(issue_type=issue_type, target_date=affected_date)
        explanation = self._explanation(issue_type, affected_date)

        return ReplanPatch(
            user_request=user_request,
            affected_days=[affected_date],
            changes=[
                ReplanChange(
                    operation="replace_time_block",
                    day=affected_date,
                    explanation=explanation,
                )
            ],
            updated_schedule_items=[replacement],
            explanation=explanation,
            source_audit=self._source_audit(replacement),
        )

    def emergency_answer(self, bundle: ItineraryBundle, issue_type: str) -> str:
        """Answer emergency help requests using the bundle playbook and safe fallback."""
        return EmergencyPlaybook(entries=bundle.emergency_playbook).answer(issue_type)

    def _selected_option(self, bundle: ItineraryBundle) -> ItineraryOption:
        selected_id = bundle.selected_option_id or bundle.options[0].id
        for option in bundle.options:
            if option.id == selected_id:
                return option
        raise DataSourceError(f"Selected option is not available: {selected_id}")

    def _classify_issue(self, user_request: str) -> str:
        normalized = user_request.casefold()
        if any(term in normalized for term in ("rain", "weather", "비", "우천")):
            return "rain"
        if any(term in normalized for term in ("tired", "fatigue", "피곤", "힘들")):
            return "fatigue"
        if any(term in normalized for term in ("closed", "close", "휴무", "폐장")):
            return "closure"
        return "default"

    def _replacement_item(self, issue_type: str, target_date: date) -> ScheduleItem:
        indoor_candidates = self.fixture_source.search_places(
            query="indoor",
            area=None,
            category="experience",
        )
        if not indoor_candidates:
            raise DataSourceError("Local fixtures must include at least one indoor fallback.")

        place = indoor_candidates[0]
        activity_by_issue = {
            "rain": (
                f"Switch to {place.name} as an indoor family block "
                f"on {target_date.isoformat()}."
            ),
            "fatigue": f"Shorten the day around {place.name} and add a rest buffer.",
            "closure": f"Use {place.name} while confirming the original venue status.",
            "default": f"Use {place.name} as a safe fallback block.",
        }
        return ScheduleItem(
            time_window="14:00-17:00",
            place=place,
            activity=activity_by_issue[issue_type],
            transport_hint="Keep the route subway-first; take a taxi if rain or fatigue increases.",
            food_hint="Add a nearby cafe or hotel rest stop before dinner.",
            estimated_cost_level="medium",
            child_friendliness=place.family_score,
            fatigue_level="low",
            source_refs=[signal.title for signal in place.source_signals],
        )

    def _explanation(self, issue_type: str, affected_date: date) -> str:
        reasons = {
            "rain": "Heavy rain risk: replace the exposed block with an indoor family fallback.",
            "fatigue": "Family fatigue risk: reduce walking and keep one low-effort block.",
            "closure": "Venue disruption risk: keep the day intact with a nearby proven fallback.",
            "default": "Planning change: provide a conservative fallback patch.",
        }
        return f"{affected_date.isoformat()} - {reasons[issue_type]}"

    def _source_audit(self, item: ScheduleItem) -> list[SourceSignal]:
        return [
            signal
            for signal in item.place.source_signals
            if signal.title in set(item.source_refs)
        ]
