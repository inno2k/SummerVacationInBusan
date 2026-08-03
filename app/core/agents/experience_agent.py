from app.core.agents.role_factory import AgentRole, build_role


def build_experience_role() -> AgentRole:
    """Return the experience role definition."""
    return build_role(
        name="ExperienceAgent",
        goal="Select age-appropriate Busan experiences for parents and a 12-year-old.",
        specialty="Weigh beaches, aquariums, culture walks, views, and indoor alternatives.",
    )
