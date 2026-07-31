from pydantic import BaseModel, Field

SAFE_EMERGENCY_MESSAGE = "For immediate danger in Korea, call 119 for emergency services."


class EmergencyPlaybook(BaseModel):
    entries: dict[str, str] = Field(default_factory=dict)

    def answer(self, issue_type: str) -> str:
        """Return the best available emergency response for an issue type."""
        return (
            self.entries.get(issue_type)
            or self.entries.get("default")
            or SAFE_EMERGENCY_MESSAGE
        )
