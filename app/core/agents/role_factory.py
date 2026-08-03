AgentRole = dict[str, str]

COMMON_BACKSTORY = (
    "Return structured JSON fragments only, cite source labels when available, "
    "and avoid booking automation for trains, hotels, restaurants, and paid experiences."
)


def build_role(name: str, goal: str, specialty: str) -> AgentRole:
    """Build a deterministic role definition for optional CrewAI-style orchestration."""
    return {
        "name": name,
        "goal": goal,
        "backstory": f"{specialty} {COMMON_BACKSTORY}",
    }
