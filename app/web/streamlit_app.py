import streamlit as st

from app.core.models import OptionId, TripRequest
from app.core.orchestration.planner_engine import PlannerEngine
from app.core.orchestration.replanner import Replanner
from app.core.rendering import render_itinerary_markdown


def render_app() -> None:
    """Render the local Streamlit planner around the deterministic engine."""
    st.set_page_config(page_title="Busan Family Travel Planner", layout="wide")
    st.title("Busan Family Travel Planner")
    st.caption("Seoul Station to Busan family trip, 2026-08-16 to 2026-08-19")

    request = TripRequest.default_family_trip()
    bundle = PlannerEngine.fixture_only().generate(request)
    selected_value = st.selectbox(
        "Choose itinerary option",
        options=[option.id.value for option in bundle.options],
        index=0,
    )
    bundle.selected_option_id = OptionId(selected_value)
    selected = next(option for option in bundle.options if option.id == bundle.selected_option_id)

    left, right = st.columns([2, 1])
    with left:
        st.subheader(selected.title)
        st.write(selected.positioning)
        st.write(f"Recommended stay area: {selected.recommended_stay_area}")
        for day in selected.days:
            with st.expander(f"{day.date.isoformat()} - {day.theme}", expanded=True):
                st.write(day.route_summary)
                for item in day.schedule_items:
                    st.markdown(f"- **{item.time_window}** {item.activity}")
                    st.caption(f"Transport: {item.transport_hint}")
                    if item.food_hint:
                        st.caption(f"Food: {item.food_hint}")
                st.info(day.fallback_plan)

    with right:
        st.subheader("24-hour Support")
        issue_type = st.selectbox(
            "Issue type",
            options=["default", "late_night_pharmacy", "lost_item", "tired_child"],
        )
        st.write(Replanner.fixture_only().emergency_answer(bundle, issue_type))

        st.subheader("Replan")
        replan_request = st.text_input("Request", value="비가 오면 실내 일정으로 바꿔줘")
        target_date = st.selectbox(
            "Target date",
            options=[day.date.isoformat() for day in selected.days],
        )
        if st.button("Generate patch"):
            target_day = next(day for day in selected.days if day.date.isoformat() == target_date)
            patch = Replanner.fixture_only().replan(
                bundle=bundle,
                user_request=replan_request,
                target_date=target_day.date,
            )
            st.json(patch.model_dump(mode="json"))

        markdown = render_itinerary_markdown(bundle)
        st.download_button(
            "Download Markdown",
            markdown,
            file_name="busan-family-travel-plan.md",
        )


if __name__ == "__main__":
    render_app()
