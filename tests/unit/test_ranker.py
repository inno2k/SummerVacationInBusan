from app.core.data_sources.local_fixtures import LocalFixtureDataSource
from app.core.scoring.place_ranker import rank_places


def test_rank_places_prefers_family_for_kid_option() -> None:
    source = LocalFixtureDataSource("data/fixtures")
    places = source.search_places(query="", area=None, category="experience")

    ranked = rank_places(places, option_id="kid_experience")

    assert ranked[0].family_score >= ranked[-1].family_score
