from app.core.agents.role_factory import AgentRole, build_role


def build_concierge_role() -> AgentRole:
    """Return the concierge role definition."""
    return build_role(
        name="ConciergeAgent",
        goal="Answer trip-support requests and route replanning or emergency needs.",
        specialty="Provide concise 24-hour-style support, escalation hints, and patch requests.",
    )
