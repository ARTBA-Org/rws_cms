# PDF Extractor API (FastAPI)

Processes PDF uploads: splits into images, extracts structured details with OpenAI, and optionally creates an item in Payload CMS.

## Setup
1. Create and configure `.env` (see `.env.example`).
2. Create a venv and install deps:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. Run the server:
   ```bash
   uvicorn app.main:app --reload --port 8080
   ```

## API
- `GET /health` — health check
- `POST /ingest` — multipart form upload
  - form fields:
    - `file` (required): PDF file
    - `collection` (optional): Payload collection to create item in (defaults to `PAYLOAD_DEFAULT_COLLECTION`)
    - `fields` (optional): JSON array of field names to extract (string)
    - `max_pages` (optional): int, default 3
    - `create_in_payload` (optional): bool, default true
    - `instruction` (optional): custom extraction instruction sent to the model (Responses API). If omitted, a default instruction is built from `fields`.
    - `payload_draft` (optional): boolean, save as draft
    - `payload_depth` (optional): integer, relationship population depth
    - `payload_locale` (optional): locale code (e.g., `en`)
    - `payload_email` / `payload_password` (optional): alternative auth if no API token

### Example (curl) — invoice defaults
```bash
curl -X POST http://localhost:8080/ingest \
  -F "file=@/path/to/file.pdf" \
  -F 'fields=["title","date","total","vendor","items"]' \
  -F "collection=invoices" \
  -F "max_pages=3" \
  -F "create_in_payload=true"
```

### Example (curl) — slide extraction with custom instruction (no Payload create)
```bash
curl -X POST http://localhost:8080/ingest \
  -F "file=@/path/to/slide-deck.pdf" \
  -F "instruction=You are a slide extraction engine. Extract slide information and return only JSON with the keys Title, Description, and Type.\n\nRules:\n- Title: Copy the main heading exactly as shown on the slide.\n- Description: Copy the exact visible body text from the slide, preserving capitalization, punctuation, and paragraph breaks. Do not paraphrase or add any words. Exclude photo credits, page numbers, or decorative labels unless instructed otherwise.\n- Type: Select from {Regular, Video, Quiz, Reference, Resources}. If unclear, use Regular.\n- If a field is missing, use an empty string.\n- Do not include any other keys. Return a single JSON object only." \
  -F "max_pages=3" \
  -F "create_in_payload=false"
```

### Example (curl) — create draft item with email/password auth
```bash
curl -X POST http://localhost:8080/ingest \
  -F "file=@/path/to/file.pdf" \
  -F 'fields=["title","date","total","vendor","items"]' \
  -F "collection=invoices" \
  -F "payload_email=you@example.com" \
  -F "payload_password=yourpassword" \
  -F "payload_draft=true" \
  -F "payload_depth=1" \
  -F "payload_locale=en" \
  -F "create_in_payload=true"
```

## Notes
- Uses PyMuPDF to render PDF pages (no external system dependencies).
- Uses OpenAI Responses API for multimodal extraction. Use a vision-capable model (default: `gpt-4o-mini`). Ensure `OPENAI_API_KEY` is set.
- Payload CMS auth precedence: form `payload_email/password` -> env `PAYLOAD_EMAIL/PAYLOAD_PASSWORD` -> env `PAYLOAD_API_TOKEN`.
- You can set `PAYLOAD_AUTH_COLLECTION` if your auth collection differs from `users` (login route: `/api/{collection}/login`).
