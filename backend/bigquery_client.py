from google.cloud import bigquery

PROJECT_ID = "sada-seed-2025-sandbox"

client = bigquery.Client(
    project=PROJECT_ID
)

def execute_query(sql):

    query_job = client.query(sql)

    results = query_job.result()

    rows = []

    for row in results:
        rows.append(dict(row))

    return rows
