"""
main.py

FastAPI backend for AI BI Genie with:
- Per-session chat memory
- SQL explainability
- Enhanced chart types (grouped_bar, scatter)
"""

import uuid
from typing import Optional

from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sql_agent import generate_sql
from bigquery_client import execute_query
from analytics_agent import analyze_results
from chart_agent import generate_chart
from sql_explainer import explain_sql
import memory_manager

app = FastAPI(
    title="AI BI Genie",
    description="Supply Chain Analytics with Memory, Explainability & Advanced Charts",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UserQuery(BaseModel):
    question: str
    session_id: Optional[str] = None


@app.get("/")
def home():
    return {
        "message": "AI BI Genie Running (Memory + Explainability + Advanced Charts)"
    }


@app.post("/chat")
def chat(
    user_query: UserQuery,
    x_session_id: Optional[str] = Header(None),
):
    """
    Main chat endpoint with:
    - Memory-aware SQL generation
    - SQL explainability (clause-by-clause)
    - Advanced chart types (grouped_bar, scatter)
    """

    session_id = user_query.session_id or x_session_id or str(uuid.uuid4())
    question = user_query.question

    try:

        # 1. Generate SQL (memory-aware)
        sql = generate_sql(question, session_id)

        # 2. Execute query
        results = execute_query(sql)

        # 3. Analyze results (memory-aware)
        analytics = analyze_results(question, results, session_id)

        # 4. Generate chart recommendation (memory-aware, now with grouped_bar + scatter)
        chart = generate_chart(question, results, session_id)

        # 5. Generate SQL explanation (clause-by-clause)
        sql_explanation = explain_sql(sql, question)

        # 6. Build result summary for memory
        result_summary = ""
        if results:
            cols = list(results[0].keys())
            result_summary = (
                f"{len(results)} rows, columns: {cols}. "
                f"First row: {results[0]}"
            )

        # 7. Persist turn in memory
        memory_manager.add_turn(
            session_id=session_id,
            question=question,
            sql=sql,
            answer=analytics.get("answer", ""),
            insights=analytics.get("insights", []),
            result_summary=result_summary,
        )

        return {
            "session_id": session_id,
            "question": question,
            "answer": analytics["answer"],
            "insights": analytics["insights"],
            "sql_query": sql,
            "sql_explanation": sql_explanation,
            "results": results,
            "chart": chart,
        }

    except Exception as e:

        return {
            "session_id": session_id,
            "error": str(e),
        }


@app.get("/history/{session_id}")
def get_history(session_id: str):
    return {
        "session_id": session_id,
        "history": memory_manager.get_history(session_id),
    }


@app.delete("/history/{session_id}")
def clear_history(session_id: str):
    memory_manager.clear_session(session_id)
    return {
        "session_id": session_id,
        "message": "Conversation memory cleared.",
    }
