
from google.cloud import bigquery

client = bigquery.Client(
    project="sada-seed-2025-sandbox"
)

print("Connected!")
print(client.project)
