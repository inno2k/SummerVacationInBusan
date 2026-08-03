from typer.testing import CliRunner

from app.cli.main import cli


def test_cli_plan_outputs_markdown() -> None:
    result = CliRunner().invoke(cli, ["plan"])

    assert result.exit_code == 0
    assert "Busan Family Travel Plan" in result.output
    assert "Balanced Family Busan" in result.output


def test_cli_replan_outputs_json() -> None:
    result = CliRunner().invoke(
        cli,
        ["replan", "비가 오면 바꿔줘", "--target-date", "2026-08-17", "--output", "json"],
    )

    assert result.exit_code == 0
    assert '"affected_days"' in result.output
    assert "2026-08-17" in result.output
