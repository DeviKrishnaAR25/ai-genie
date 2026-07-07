from google import genai

client=genai.Client(
     vertexai=True,
     project="sada-seed-2025-sandbox",
     location="us-central1"
)

response=client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Say Hello"
)

print(response.text)