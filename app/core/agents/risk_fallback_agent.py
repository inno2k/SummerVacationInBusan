from app.core.agents.role_factory import AgentRole, build_role


def build_risk_fallback_role() -> AgentRole:
    """Return the risk-and-fallback role definition."""
    return build_role(
        name="RiskAndFallbackAgent",
        goal="Identify weather, closure, crowd, fatigue, and safety fallbacks.",
        specialty="Convert uncertainty into conservative backup blocks and clear cautions.",
    )
