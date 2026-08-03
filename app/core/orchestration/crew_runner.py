from app.core.agents import (
    build_concierge_role,
    build_experience_role,
    build_food_role,
    build_risk_fallback_role,
    build_stay_area_role,
    build_transport_role,
    build_trip_director_role,
)
from app.core.agents.role_factory import AgentRole


class CrewRunner:
    """Thin adapter boundary for deterministic or future CrewAI orchestration."""

    def __init__(self, mode: str = "deterministic") -> None:
        self.mode = mode

    def is_live_agent_mode(self) -> bool:
        """Return whether the runner should delegate to a live agent framework."""
        return self.mode == "crewai"

    def role_definitions(self) -> list[AgentRole]:
        """Return all role definitions in the MVP orchestration order."""
        return [
            build_trip_director_role(),
            build_transport_role(),
            build_stay_area_role(),
            build_food_role(),
            build_experience_role(),
            build_risk_fallback_role(),
            build_concierge_role(),
        ]
