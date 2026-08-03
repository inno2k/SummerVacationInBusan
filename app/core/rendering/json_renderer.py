import json

from pydantic import BaseModel


def render_json(model: BaseModel) -> str:
    """Render a Pydantic model as stable, human-readable JSON."""
    return json.dumps(
        model.model_dump(mode="json"),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    )
