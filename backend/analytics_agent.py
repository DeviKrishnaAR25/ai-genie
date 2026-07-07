import json

from google import genai
from config import PROJECT_ID, LOCATION
from memory_manager import format_history_for_prompt

client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION
)


def analyze_results(
    question: str,
    results: list,
    session_id: str = ""
) -> dict:
    """
    Generate a business-analyst-style answer with insights.
    Enhanced for multi-join analytical patterns.
    """

    conversation_context = format_history_for_prompt(session_id)

    prompt = f"""
You are AI BI Genie — an expert business intelligence analyst
specializing in supply chain analytics.

CONVERSATION HISTORY

{conversation_context}

CURRENT QUESTION

{question}

QUERY RESULTS (current turn)

{results[:20]}

Return ONLY valid JSON.

Format:

{{
  "answer": "business answer",
  "insights": [
      "...",
      "...",
      "..."
  ]
}}

Rules:

1. Speak like a business analyst.
2. Give a direct answer to the CURRENT QUESTION.
3. Mention specific numbers from the results.
4. Maximum 3 insights.
5. No SQL explanation.
6. No markdown.
7. If this is a follow-up question, reference prior context
   naturally.
8. Keep the answer self-contained.

ANALYTICAL PATTERN RULES:

9. For BREACH RATE results:
   - Highlight which entity has highest/lowest breach rate
   - Compare breach rates across entities
   - Flag any breach rate above 20% as concerning

10. For DELAY BY REGION results:
    - Identify the region with worst delays
    - Mention total penalty costs
    - Suggest which regions need attention

11. For WAREHOUSE UTILISATION results:
    - Flag warehouses above 90% as near capacity
    - Flag warehouses below 30% as underutilized
    - Suggest rebalancing if utilisation varies widely

12. For YEAR-OVER-YEAR results:
    - Calculate and mention growth/decline percentages
    - Identify trends (growing, declining, stable)
    - Highlight any significant year-over-year changes

13. For CORRELATION / SCATTER results:
    - Describe the relationship (positive, negative, none)
    - Identify outliers if present
    - Suggest business implications of the correlation
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    text = response.text.strip()
    text = text.replace("```json", "")
    text = text.replace("```", "")

    try:
        return json.loads(text)
    except Exception:
        return {
            "answer": "Unable to generate summary.",
            "insights": []
        }
