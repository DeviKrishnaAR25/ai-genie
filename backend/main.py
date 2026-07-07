"""
main.py

FastAPI backend for AI BI Genie.
Serves both API endpoints AND the React frontend static files.
"""

import os
import uuid
from typing import Optional

from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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


@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "AI BI Genie"}


@app.post("/chat")
def chat(
    user_query: UserQuery,
    x_session_id: Optional[str] = Header(None),
):
    session_id = user_query.session_id or x_session_id or str(uuid.uuid4())
    question = user_query.question

    try:
        sql = generate_sql(question, session_id)
        results = execute_query(sql)
        analytics = analyze_results(question, results, session_id)
        chart = generate_chart(question, results, session_id)
        sql_explanation = explain_sql(sql, question)

        result_summary = ""
        if results:
            cols = list(results[0].keys())
            result_summary = (
                f"{len(results)} rows, columns: {cols}. "
                f"First row: {results[0]}"
            )

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


# ─── Serve React Frontend ───
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=os.path.join(STATIC_DIR, "static")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
