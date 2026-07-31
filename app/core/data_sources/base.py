from typing import Protocol

from app.core.models import PlaceCandidate, SourceSignal


class DataSourceError(RuntimeError):
    """Raised when a data source cannot load or adapt source data."""


class PlaceDataSource(Protocol):
    """Protocol for sources that can return place candidates."""

    def search_places(
        self,
        query: str,
        area: str | None = None,
        category: str | None = None,
    ) -> list[PlaceCandidate]:
        """Return place candidates matching a query and optional filters."""
        ...


class EmergencyDataSource(Protocol):
    """Protocol for sources that can return emergency guidance."""

    def get_emergency_help(self, issue_type: str) -> str:
        """Return emergency guidance for an issue type."""
        ...


class YouTubeSeedDataSource(Protocol):
    """Protocol for API-free YouTube seed search."""

    def search_youtube_seed(self, query: str) -> list[SourceSignal]:
        """Return YouTube seed source signals matching a query."""
        ...
