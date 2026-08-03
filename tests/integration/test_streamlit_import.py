import importlib


def test_streamlit_app_imports_without_running_server() -> None:
    module = importlib.import_module("app.web.streamlit_app")

    assert hasattr(module, "render_app")
