"""
memory_manager.py

Manages per-session conversation memory for AI BI Genie.

Each session stores a rolling history of conversation turns
(user question + bot answer + SQL used + key data summary).

Memory is kept in-process using a dict keyed by session_id.
A sliding window (default 20 turns) prevents unbounded growth.
"""

import time
import threading
from typing import Dict, List, Optional


# --------------- configuration ---------------

MAX_TURNS_PER_SESSION = 20        # sliding window size
SESSION_TTL_SECONDS = 3600        # auto-expire after 1 hour of inactivity
CLEANUP_INTERVAL_SECONDS = 600    # run cleanup every 10 minutes


# --------------- in-memory store ---------------

_store: Dict[str, dict] = {}
_lock = threading.Lock()


# --------------- public helpers ---------------

def get_history(session_id: str) -> List[dict]:
    """Return the conversation history list for a session."""
    with _lock:
        entry = _store.get(session_id)
        if entry is None:
            return []
        entry["last_access"] = time.time()
        return list(entry["history"])


def add_turn(
    session_id: str,
    question: str,
    sql: str,
    answer: str,
    insights: Optional[List[str]] = None,
    result_summary: Optional[str] = None,
):
    """Append one Q&A turn to the session history."""
    turn = {
        "question": question,
        "sql": sql,
        "answer": answer,
        "insights": insights or [],
        "result_summary": result_summary or "",
    }
    with _lock:
        if session_id not in _store:
            _store[session_id] = {
                "history": [],
                "last_access": time.time(),
            }
        entry = _store[session_id]
        entry["history"].append(turn)
        entry["last_access"] = time.time()

        # enforce sliding window
        if len(entry["history"]) > MAX_TURNS_PER_SESSION:
            entry["history"] = entry["history"][-MAX_TURNS_PER_SESSION:]


def clear_session(session_id: str):
    """Explicitly clear a session's memory."""
    with _lock:
        _store.pop(session_id, None)


def format_history_for_prompt(session_id: str) -> str:
    """
    Build a concise text block that can be injected into any
    LLM prompt so the model is aware of prior conversation context.
    """
    history = get_history(session_id)
    if not history:
        return "No prior conversation."

    lines = []
    for i, turn in enumerate(history, 1):
        lines.append(f"--- Turn {i} ---")
        lines.append(f"User: {turn['question']}")
        lines.append(f"SQL:  {turn['sql']}")
        lines.append(f"Answer: {turn['answer']}")
        if turn["insights"]:
            lines.append(f"Insights: {'; '.join(turn['insights'])}")
        if turn["result_summary"]:
            lines.append(f"Data snapshot: {turn['result_summary']}")
        lines.append("")

    return "\n".join(lines)


# --------------- background cleanup ---------------

def _cleanup_expired():
    """Remove sessions that have been idle longer than SESSION_TTL_SECONDS."""
    while True:
        time.sleep(CLEANUP_INTERVAL_SECONDS)
        now = time.time()
        with _lock:
            expired = [
                sid for sid, entry in _store.items()
                if now - entry["last_access"] > SESSION_TTL_SECONDS
            ]
            for sid in expired:
                del _store[sid]


_cleanup_thread = threading.Thread(
    target=_cleanup_expired,
    daemon=True,
)
_cleanup_thread.start()
