from app.core.agents.role_factory import AgentRole, build_role


def build_transport_role() -> AgentRole:
    """Return the transport role definition."""
    return build_role(
        name="TransportAgent",
        goal="Plan Seoul Station to Busan and in-city movement hints for a family.",
        specialty="Prioritize predictable KTX, subway, taxi, and fatigue-aware routing.",
    )
