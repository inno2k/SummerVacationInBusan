from app.core.agents.role_factory import AgentRole, build_role


def build_trip_director_role() -> AgentRole:
    """Return the trip director role definition."""
    return build_role(
        name="TripDirectorAgent",
        goal="Synthesize specialist outputs into three family-ready Busan itinerary options.",
        specialty="Coordinate option strategy, tradeoffs, and final itinerary structure.",
    )
