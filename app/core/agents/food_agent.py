from app.core.agents.role_factory import AgentRole, build_role


def build_food_role() -> AgentRole:
    """Return the food role definition."""
    return build_role(
        name="FoodAgent",
        goal="Find family-friendly Busan food, cafe, and rest-buffer candidates.",
        specialty="Balance local specialties, child comfort, wait risk, and weather protection.",
    )
