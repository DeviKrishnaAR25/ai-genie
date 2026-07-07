from google import genai

from config import PROJECT_ID, LOCATION
from schema_context import SCHEMA_CONTEXT
from memory_manager import format_history_for_prompt

client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION
)


def generate_sql(question: str, session_id: str = "") -> str:
    """
    Convert a business question into BigQuery SQL.
    Enhanced with multi-join patterns for breach rate,
    delay by region, and warehouse utilisation.
    """

    conversation_context = format_history_for_prompt(session_id)

    prompt = f"""
You are a Senior Supply Chain Data Analyst and BigQuery SQL Expert.

Your job is to convert business questions into highly optimized BigQuery SQL.

DATABASE SCHEMA

{SCHEMA_CONTEXT}

CONVERSATION HISTORY (use this to resolve follow-up references)

{conversation_context}

IMPORTANT RULES

1. Generate VALID BigQuery SQL only.
2. Return ONLY SQL.
3. Do NOT return markdown.
4. Do NOT explain anything.
5. Use dataset name:
   intern_c_supplychain

6. Use explicit JOINS whenever data exists across tables.

7. Never use:
   SELECT *

8. Select only required columns.

9. Use aggregation whenever appropriate:
   COUNT, SUM, AVG, MAX, MIN

10. Use GROUP BY correctly.

11. Use aliases for readability.

12. Always order ranked results logically.

13. Optimize query performance.

14. Use LIMIT intelligently:
    - highest / lowest / best / worst / most / least
    - top supplier / top warehouse => LIMIT 1
    - top 3 => LIMIT 3
    - top 5 => LIMIT 5
    - top 10 => LIMIT 10
    - detailed listings => LIMIT 100
    - distribution reports => LIMIT not required

15. If user asks:
    "Which warehouse handles the most shipments?"
    return only the top warehouse.

16. If user asks:
    "Which supplier has highest rating?"
    return only the highest rated supplier.

17. If user asks for trends:
    group by date/month/year appropriately.

18. If user asks for percentages:
    calculate percentages.

19. If user asks for comparison:
    rank and compare entities.

20. If user asks for delayed shipments:
    use sla_breaches table.

21. If user asks for warehouse performance:
    join warehouses and shipments.

22. If user asks for supplier performance:
    join suppliers and shipments.

23. If user asks for SLA analysis:
    join sla_breaches and shipments.

24. Use fully qualified table names.

25. CRITICAL — FOLLOW-UP AWARENESS:
    If the user says things like:
      "what about the second one"
      "compare it with last month"
      "show me more details"
      "now break it down by region"
      "the same supplier"
    Use the CONVERSATION HISTORY above to understand
    what "it", "that", "the same", "more" etc. refer to.

26. BREACH RATE CALCULATION:
    If user asks about breach rate, SLA breach rate,
    or breach percentage:
    - Join shipments with sla_breaches using LEFT JOIN
    - Calculate: COUNT(sla_breaches.breach_id) / COUNT(shipments.shipment_id) * 100
    - Alias as breach_rate_pct
    - Can be grouped by supplier, warehouse, region, or time period

    Example:
    SELECT
        sp.supplier_name,
        COUNT(sh.shipment_id) AS total_shipments,
        COUNT(sb.breach_id) AS total_breaches,
        ROUND(COUNT(sb.breach_id) * 100.0 / COUNT(sh.shipment_id), 2) AS breach_rate_pct
    FROM intern_c_supplychain.shipments sh
    JOIN intern_c_supplychain.suppliers sp
        ON sh.supplier_id = sp.supplier_id
    LEFT JOIN intern_c_supplychain.sla_breaches sb
        ON sh.shipment_id = sb.shipment_id
    GROUP BY sp.supplier_name
    ORDER BY breach_rate_pct DESC

27. DELAY BY REGION (3-TABLE JOIN):
    If user asks about delay by region, regional delays,
    or average delay per region:
    - Join sla_breaches → shipments → suppliers (for region)
    - Calculate AVG(delay_days), SUM(penalty), COUNT(breach_id)
    - ALWAYS cast delay_days results to INT64 (no decimals for days)

    Example:
    SELECT
        sp.region,
        COUNT(sb.breach_id) AS total_breaches,
        CAST(ROUND(AVG(sb.delay_days), 0) AS INT64) AS avg_delay_days,
        SUM(sb.penalty) AS total_penalty
    FROM intern_c_supplychain.sla_breaches sb
    JOIN intern_c_supplychain.shipments sh
        ON sb.shipment_id = sh.shipment_id
    JOIN intern_c_supplychain.suppliers sp
        ON sh.supplier_id = sp.supplier_id
    GROUP BY sp.region
    ORDER BY avg_delay_days DESC

28. WAREHOUSE UTILISATION:
    If user asks about warehouse utilisation, capacity usage,
    or warehouse efficiency:
    - Join shipments → warehouses
    - Calculate: SUM(quantity) as total_handled
    - Calculate: ROUND(SUM(quantity) * 100.0 / w.capacity, 2) as utilisation_pct

    Example:
    SELECT
        w.warehouse_name,
        w.capacity,
        SUM(sh.quantity) AS total_quantity_handled,
        ROUND(SUM(sh.quantity) * 100.0 / w.capacity, 2) AS utilisation_pct
    FROM intern_c_supplychain.shipments sh
    JOIN intern_c_supplychain.warehouses w
        ON sh.warehouse_id = w.warehouse_id
    GROUP BY w.warehouse_name, w.capacity
    ORDER BY utilisation_pct DESC

29. YEAR-OVER-YEAR (YoY) COMPARISON:
    If user asks for YoY, year over year, yearly comparison,
    or annual trends:
    - Extract YEAR from shipment_date
    - Group by year AND the comparison dimension
    - Order by year and the dimension

    Example:
    SELECT
        EXTRACT(YEAR FROM sh.shipment_date) AS year,
        sp.supplier_name,
        COUNT(sh.shipment_id) AS shipment_count
    FROM intern_c_supplychain.shipments sh
    JOIN intern_c_supplychain.suppliers sp
        ON sh.supplier_id = sp.supplier_id
    GROUP BY year, sp.supplier_name
    ORDER BY sp.supplier_name, year

30. CORRELATION / SCATTER DATA:
    If user asks about correlation, relationship between,
    delay vs quantity, delay vs weight, or scatter analysis:
    - Return individual data points (not aggregated)
    - Include both numeric dimensions
    - Use LIMIT 200 for scatter data

    Example (delay vs quantity):
    SELECT
        sh.quantity,
        sb.delay_days,
        sp.supplier_name
    FROM intern_c_supplychain.sla_breaches sb
    JOIN intern_c_supplychain.shipments sh
        ON sb.shipment_id = sh.shipment_id
    JOIN intern_c_supplychain.suppliers sp
        ON sh.supplier_id = sp.supplier_id
    ORDER BY sh.quantity
    LIMIT 200

31. CRITICAL — DAY VALUES MUST BE WHOLE NUMBERS:
    Whenever the result represents a number of DAYS
    (delay_days, avg_delay_days, max_delay, min_delay,
    total_delay, delivery time, lead time, transit days,
    or ANY column with "day" or "days" in the name or alias):

    - ALWAYS wrap with: CAST(ROUND(..., 0) AS INT64)
    - Days are always whole numbers. Never return 5.0 or 4.3 days.
    - This applies to AVG, SUM, MAX, MIN, or any arithmetic on day columns.

    Correct:
      CAST(ROUND(AVG(sb.delay_days), 0) AS INT64) AS avg_delay_days

    Wrong:
      ROUND(AVG(sb.delay_days), 1) AS avg_delay_days
      AVG(sb.delay_days) AS avg_delay_days

    This rule overrides all other formatting rules for day-related columns.

USER QUESTION

{question}

Generate SQL:
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    sql = response.text.strip()
    sql = sql.replace("```sql", "")
    sql = sql.replace("```", "")
    sql = sql.strip()

    return sql
