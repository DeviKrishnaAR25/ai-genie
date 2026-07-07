import json

from google import genai
from config import PROJECT_ID, LOCATION
from memory_manager import format_history_for_prompt

client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION
)


def generate_chart(
    question: str,
    rows: list,
    session_id: str = ""
) -> dict | None:
    """
    Decide the best chart type for the data.
    Now supports: bar, grouped_bar, pie, line, scatter, none.
    """

    if not rows:
        return None

    conversation_context = format_history_for_prompt(session_id)

    columns = list(rows[0].keys())

    prompt = f"""
CONVERSATION HISTORY

{conversation_context}

CURRENT QUESTION

{question}

Available Columns:
{columns}

Sample Data:
{rows[:10]}

Choose the best visualization for this data.

CHART TYPE RULES:

1. "bar" — single category vs single numeric value
   (e.g., top suppliers by count, warehouse shipments)

2. "grouped_bar" — when data has a GROUPING dimension like year, month, or category
   that creates multiple bars per category.
   REQUIRED: data must have at least 3 columns where one is a grouping key.
   Examples: YoY comparison, monthly breakdown by status, supplier performance by year.
   Detect this when columns include year/month/period + category + value.

3. "pie" — distribution, percentage, share, proportion
   (e.g., status distribution, regional share)

4. "line" — trends over time, monthly/daily/weekly patterns
   (e.g., monthly shipment trend, daily volume)

5. "scatter" — correlation, relationship between two numeric variables
   (e.g., delay vs quantity, rating vs shipment volume)
   REQUIRED: at least 2 numeric columns that represent different measures.

6. "none" — single number answers, yes/no, or data not suitable for charts

Return ONLY JSON:

{{
  "chart_type": "bar|grouped_bar|pie|line|scatter|none",
  "x_axis": "column name for x-axis",
  "y_axis": "column name for y-axis",
  "group_by": "column name for grouping (only for grouped_bar, otherwise null)",
  "scatter_label": "column name for point labels (only for scatter, otherwise null)"
}}
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    text = response.text
    text = text.replace("```json", "")
    text = text.replace("```", "")

    try:
        chart_json = json.loads(text)
    except Exception:
        chart_json = {"chart_type": "bar"}

    chart_type = chart_json.get("chart_type", "bar")

    if chart_type == "none":
        return None

    if len(columns) < 2:
        return None

    # Build chart config based on type
    x_axis = chart_json.get("x_axis", columns[0])
    y_axis = chart_json.get("y_axis", columns[1])

    # Validate columns exist
    if x_axis not in columns:
        x_axis = columns[0]
    if y_axis not in columns:
        y_axis = columns[1]

    chart_config = {
        "type": chart_type,
        "xAxis": x_axis,
        "yAxis": y_axis,
        "data": rows[:50]
    }

    # Grouped bar: need group_by column
    if chart_type == "grouped_bar":
        group_by = chart_json.get("group_by")
        if group_by and group_by in columns:
            chart_config["groupBy"] = group_by

            # Pivot data for grouped bar
            pivoted = _pivot_for_grouped_bar(rows, x_axis, y_axis, group_by)
            if pivoted:
                chart_config["data"] = pivoted["data"]
                chart_config["groups"] = pivoted["groups"]
            else:
                chart_config["type"] = "bar"
        else:
            chart_config["type"] = "bar"

    # Scatter: include label column
    if chart_type == "scatter":
        scatter_label = chart_json.get("scatter_label")
        if scatter_label and scatter_label in columns:
            chart_config["scatterLabel"] = scatter_label
        chart_config["data"] = rows[:200]

    return chart_config


def _pivot_for_grouped_bar(rows, x_axis, y_axis, group_by):
    """
    Pivot data so each group becomes a separate key in each data point.
    Input:  [{year: 2023, supplier: A, count: 10}, {year: 2024, supplier: A, count: 15}]
    Output: [{supplier: A, 2023: 10, 2024: 15}]
    """
    try:
        groups = sorted(set(str(row.get(group_by, "")) for row in rows))
        categories = []
        seen = set()
        for row in rows:
            cat = str(row.get(x_axis, ""))
            if cat not in seen:
                categories.append(cat)
                seen.add(cat)

        pivoted = []
        for cat in categories:
            point = {x_axis: cat}
            for group in groups:
                val = 0
                for row in rows:
                    if str(row.get(x_axis, "")) == cat and str(row.get(group_by, "")) == group:
                        val = row.get(y_axis, 0)
                        break
                point[str(group)] = val
            pivoted.append(point)

        return {
            "data": pivoted[:30],
            "groups": groups
        }
    except Exception:
        return None
