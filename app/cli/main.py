from datetime import date
from enum import StrEnum
from typing import Annotated

import typer

from app.core.models import OptionId, TripRequest
from app.core.orchestration.planner_engine import PlannerEngine
from app.core.orchestration.replanner import Replanner
from app.core.rendering.json_renderer import render_json
from app.core.rendering.markdown_renderer import render_itinerary_markdown, render_replan_markdown


class OutputFormat(StrEnum):
    JSON = "json"
    MARKDOWN = "markdown"


cli = typer.Typer(help="Busan family travel planner.")


@cli.command()
def plan(
    output: Annotated[OutputFormat, typer.Option("--output", "-o")] = OutputFormat.MARKDOWN,
    selected_option: Annotated[OptionId | None, typer.Option("--selected-option")] = None,
) -> None:
    """Generate the default Seoul-to-Busan family itinerary."""
    bundle = PlannerEngine.fixture_only().generate(TripRequest.default_family_trip())
    bundle.selected_option_id = selected_option
    rendered = (
        render_json(bundle)
        if output == OutputFormat.JSON
        else render_itinerary_markdown(bundle)
    )
    typer.echo(rendered)


@cli.command()
def replan(
    request: Annotated[str, typer.Argument()],
    target_date: Annotated[str | None, typer.Option("--target-date")] = None,
    selected_option: Annotated[
        OptionId,
        typer.Option("--selected-option"),
    ] = OptionId.BALANCED,
    output: Annotated[OutputFormat, typer.Option("--output", "-o")] = OutputFormat.MARKDOWN,
) -> None:
    """Generate a small patch for weather, fatigue, closure, or general travel changes."""
    bundle = PlannerEngine.fixture_only().generate(TripRequest.default_family_trip())
    bundle.selected_option_id = selected_option
    patch = Replanner.fixture_only().replan(
        bundle=bundle,
        user_request=request,
        target_date=_parse_target_date(target_date),
    )
    rendered = render_json(patch) if output == OutputFormat.JSON else render_replan_markdown(patch)
    typer.echo(rendered)


def _parse_target_date(value: str | None) -> date | None:
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise typer.BadParameter("target date must use YYYY-MM-DD format") from exc


def main() -> None:
    """Run the Typer CLI application."""
    cli()
