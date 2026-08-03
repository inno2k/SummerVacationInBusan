from app.core.agents.role_factory import AgentRole, build_role


def build_stay_area_role() -> AgentRole:
    """Return the stay-area role definition."""
    return build_role(
        name="StayAreaAgent",
        goal="Recommend base areas that reduce transfers and support family rest.",
        specialty="Compare Haeundae, Gwangalli, Seomyeon, and Busan Station tradeoffs.",
    )
