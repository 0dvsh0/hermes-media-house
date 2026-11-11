"""
hermes-media-desk plugin package.

Re-exports the FastAPI router so the Hermes host can mount it at the
declared mount point without importing the submodule directly.
"""
import sys
from pathlib import Path

_plugin_root = str(Path(__file__).resolve().parent)
if _plugin_root not in sys.path:
    sys.path.insert(0, _plugin_root)

from dashboard.plugin_api import init_plugin, router  # noqa: F401

__all__ = ["router", "register"]


def register(ctx) -> None:
    """Initialize plugin runtime with Hermes context."""
    init_plugin(ctx)
