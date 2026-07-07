import json

from google import genai
from config import PROJECT_ID, LOCATION

client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION
)


def explain_sql(sql: str, question: str) -> dict:
    """
    Break a SQL query into clause-by-clause explanation.
    Returns structured JSON with each clause, its SQL fragment,
    a plain-English explanation, and the clause type for highlighting.
    """

    prompt = f"""
You are a SQL Explainability Engine.

USER QUESTION:
{question}

SQL QUERY:
{sql}

Break this SQL query into individual clauses and explain each one
in simple business language.

Return ONLY valid JSON in this exact format:

{{
  "summary": "One-line plain-English summary of what this query does",
  "clauses": [
    {{
      "clause_type": "SELECT",
      "sql_fragment": "SELECT sp.supplier_name, COUNT(sh.shipment_id) AS shipment_count",
      "explanation": "Retrieves the supplier name and counts total shipments for each supplier"
    }},
    {{
      "clause_type": "FROM",
      "sql_fragment": "FROM intern_c_supplychain.shipments sh",
      "explanation": "Reads from the shipments table as the primary data source"
    }},
    {{
      "clause_type": "JOIN",
      "sql_fragment": "JOIN intern_c_supplychain.suppliers sp ON sh.supplier_id = sp.supplier_id",
      "explanation": "Connects shipments to suppliers using the supplier ID foreign key"
    }},
    {{
      "clause_type": "WHERE",
      "sql_fragment": "WHERE sh.status = 'Delivered'",
      "explanation": "Filters to only include delivered shipments"
    }},
    {{
      "clause_type": "GROUP BY",
      "sql_fragment": "GROUP BY sp.supplier_name",
      "explanation": "Groups results by each supplier to calculate per-supplier totals"
    }},
    {{
      "clause_type": "ORDER BY",
      "sql_fragment": "ORDER BY shipment_count DESC",
      "explanation": "Sorts results from highest to lowest shipment count"
    }},
    {{
      "clause_type": "LIMIT",
      "sql_fragment": "LIMIT 5",
      "explanation": "Returns only the top 5 results"
    }}
  ]
}}

RULES:
1. Include ONLY clauses that exist in the query.
2. Valid clause_type values: SELECT, FROM, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, SUBQUERY, WITH, CASE, WINDOW
3. If there are multiple JOINs, list each as a separate clause entry.
4. Keep explanations under 20 words each.
5. Use business language, not technical jargon.
6. The sql_fragment must be the EXACT text from the query.
7. Return ONLY JSON. No markdown. No explanation outside JSON.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    text = response.text.strip()
    text = text.replace("```json", "")
    text = text.replace("```", "")
    text = text.strip()

    try:
        result = json.loads(text)
        if "clauses" not in result:
            result = {"summary": "Query explanation unavailable.", "clauses": []}
        if "summary" not in result:
            result["summary"] = "SQL query breakdown"
        return result
    except Exception:
        return {
            "summary": "Unable to parse query explanation.",
            "clauses": []
        }
