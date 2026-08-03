from app.core.agents import build_trip_director_role
from app.core.orchestration.crew_runner import CrewRunner


def test_trip_director_role_has_structured_output_instruction() -> None:
    role = build_trip_director_role()

    assert "structured JSON" in role["backstory"]
    assert "avoid booking automation" in role["backstory"]
    assert role["name"] == "TripDirectorAgent"


def test_crew_runner_defaults_to_deterministic_mode() -> None:
    runner = CrewRunner()

    assert runner.mode == "deterministic"
    assert runner.is_live_agent_mode() is False


def test_crew_runner_exposes_seven_agent_roles() -> None:
    roles = CrewRunner().role_definitions()

    assert [role["name"] for role in roles] == [
        "TripDirectorAgent",
        "TransportAgent",
        "StayAreaAgent",
        "FoodAgent",
        "ExperienceAgent",
        "RiskAndFallbackAgent",
        "ConciergeAgent",
    ]
    assert all("structured JSON" in role["backstory"] for role in roles)
    assert all("avoid booking automation" in role["backstory"] for role in roles)
