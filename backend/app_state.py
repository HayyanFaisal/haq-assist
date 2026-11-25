"""Shared, lazily created heavy objects (one engine and reranker per process)."""
import threading

_engine = None
_lock = threading.Lock()


def engine():
    """The one Engine for this process. A lock makes sure concurrent first requests (the web page asks for
    /api/health and /api/library at the same moment) build it once, not twice on the GPU."""
    global _engine
    if _engine is None:
        with _lock:
            if _engine is None:
                from .engine import Engine
                _engine = Engine()
    return _engine


def reranker():
    e = engine()
    if e.reranker is None:
        from .search import Reranker
        e.reranker = Reranker()
    return e.reranker
