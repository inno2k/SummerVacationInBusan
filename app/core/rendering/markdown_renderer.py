from app.core.models import ItineraryBundle, ReplanPatch


def render_itinerary_markdown(bundle: ItineraryBundle) -> str:
    """Render an itinerary bundle as a compact travel-planner Markdown brief."""
    lines = [
        "# Busan Family Travel Plan",
        "",
        f"- Request: {bundle.request_summary}",
        f"- Selected option: {bundle.selected_option_id or 'not selected'}",
        "",
        "## Assumptions",
        *[f"- {assumption}" for assumption in bundle.assumptions],
        "",
        "## Options",
    ]
    for option in bundle.options:
        lines.extend(
            [
                "",
                f"### {option.title}",
                f"- Positioning: {option.positioning}",
                f"- Stay area: {option.recommended_stay_area}",
                f"- Budget: {option.estimated_budget_range}",
            ]
        )
        for day in option.days:
            lines.extend(["", f"#### {day.date.isoformat()} - {day.theme}"])
            lines.append(f"- Route: {day.route_summary}")
            for item in day.schedule_items:
                lines.extend(
                    [
                        f"- {item.time_window}: {item.place.name}",
                        f"  - Activity: {item.activity}",
                        f"  - Transport: {item.transport_hint}",
                    ]
                )
                if item.food_hint:
                    lines.append(f"  - Food: {item.food_hint}")
            lines.append(f"- Fallback: {day.fallback_plan}")
    lines.extend(
        [
            "",
            "## Emergency",
            *[f"- {key}: {value}" for key, value in bundle.emergency_playbook.items()],
        ]
    )
    return "\n".join(lines).strip() + "\n"


def render_replan_markdown(patch: ReplanPatch) -> str:
    """Render a replan patch as a compact Markdown response."""
    lines = [
        "# Busan Replan Patch",
        "",
        f"- Request: {patch.user_request}",
        f"- Explanation: {patch.explanation}",
        "",
        "## Changes",
        *[
            f"- {change.day.isoformat()} {change.operation}: {change.explanation}"
            for change in patch.changes
        ],
        "",
        "## Updated Blocks",
    ]
    for item in patch.updated_schedule_items:
        lines.extend(
            [
                f"- {item.time_window}: {item.place.name}",
                f"  - Activity: {item.activity}",
                f"  - Transport: {item.transport_hint}",
            ]
        )
        if item.food_hint:
            lines.append(f"  - Food: {item.food_hint}")
    return "\n".join(lines).strip() + "\n"
