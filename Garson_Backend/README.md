# Garson Backend - QR Mobile Customer Flow Extensions

This backend supports the new QR-based customer web flow while keeping admin/kitchen and robot delivery flow intact.

## Added capabilities

- Product metadata fields:
  - `category`
  - `description`
  - `tags` (stored as comma-separated text)
- Order item `specialNote` persistence
- AI customer endpoint:
  - `POST /api/ai/customer-chat`
  - Local Ollama only (no cloud LLM)
  - Embedding + retrieval assisted generation (RAG)
  - Structured JSON response (no free-form output)

## Environment variables

- `OLLAMA_BASE_URL` (default: `http://127.0.0.1:11434`)
- `OLLAMA_MODEL` (default: `llama3.2:3b`)
- `OLLAMA_EMBEDDING_MODEL` (default: `nomic-embed-text`)
- `OLLAMA_TIMEOUT_MS` (default: `8000`)
- `OLLAMA_TEMPERATURE` (default: `0.0`)

## Local run

1. Ensure PostgreSQL is running and `application.properties` DB values are valid.
2. Ensure Ollama is running locally.
3. Pull model once if needed:
   ```bash
   ollama pull llama3.2:3b
   ollama pull nomic-embed-text
   ```
4. Start backend:
   ```bash
   mvn spring-boot:run
   ```

## Docker run

Run backend + PostgreSQL with fixed container names:

```bash
cd Garson_Backend
docker compose up --build -d
```

Container names:
- `garson-backend-api`
- `garson-backend-db`

Stop:

```bash
docker compose down
```

If you also run Ollama on host machine, backend container uses:
- `OLLAMA_BASE_URL=http://host.docker.internal:11434`

## Ngrok public URLs

If you want to expose backend and customer web publicly:

1. Set your token in terminal:
   ```powershell
   $env:NGROK_AUTHTOKEN="YOUR_TOKEN"
   ```
2. Start your app stack (backend on `8085`, customer web on `5174`).
3. Start ngrok:
   ```powershell
   powershell -ExecutionPolicy Bypass -File ..\scripts\start-ngrok.ps1
   ```
4. Stop ngrok:
   ```powershell
   powershell -ExecutionPolicy Bypass -File ..\scripts\stop-ngrok.ps1
   ```

Notes:
- Script auto-downloads ngrok to `tools/ngrok/ngrok.exe` if missing.
- If your environment blocks outbound `443`, ngrok cannot connect.

## Flyway behavior (important)

- Flyway is enabled with `baseline-on-migrate=true`.
- This branch keeps `spring.jpa.hibernate.ddl-auto=update` for backward compatibility because a full initial schema migration does not exist yet.
- In an existing local DB:
  - Flyway records baseline and applies additive migration(s) safely.
  - JPA update can still create missing base tables/columns if needed.
- In a fresh DB:
  - JPA can bootstrap base tables.
  - Flyway migration adds customer-flow extension columns.

## AI endpoint example

Request:

```json
{
  "tableId": 4,
  "message": "acili patates ve bir kola ekle",
  "cart": [
    {
      "productId": 17,
      "quantity": 1,
      "specialNote": ""
    }
  ]
}
```

Response (example):

```json
{
  "intent": "cart_update",
  "assistantMessage": "1 x Patates Kizartmasi, 1 x Kola sepete eklenebilir. Patates Kizartmasi notu: Acili olsun",
  "items": [
    {
      "productId": 17,
      "productName": "Patates Kizartmasi",
      "quantity": 1,
      "specialNote": "Acili olsun"
    },
    {
      "productId": 8,
      "productName": "Kola",
      "quantity": 1,
      "specialNote": ""
    }
  ],
  "suggestedProducts": []
}
```

### cURL quick tests

Create order (legacy-compatible + specialNote):

```bash
curl -X POST http://localhost:8085/api/orders ^
  -H "Content-Type: application/json" ^
  -d "{\"tableNo\":\"4\",\"items\":[{\"productName\":\"Patates Kizartmasi\",\"quantity\":1,\"specialNote\":\"Acili olsun\"},{\"productId\":8,\"quantity\":1}]}"
```

Get order detail:

```bash
curl http://localhost:8085/api/orders/1
```

AI customer chat:

```bash
curl -X POST http://localhost:8085/api/ai/customer-chat ^
  -H "Content-Type: application/json" ^
  -d "{\"tableId\":4,\"message\":\"sogansiz burger\",\"cart\":[]}"
```

## Notes / known limitations

- Item-level `specialNote` is now persisted in `order_items.special_note`.
- `tags` are stored as text for pragmatic compatibility.
- AI endpoint is draft-oriented only; it never creates/finalizes orders.
- If Ollama is unavailable or invalid JSON is returned, backend falls back to deterministic parser logic.
- Future improvement: richer modifier/variant modeling and stronger product matching strategy.
