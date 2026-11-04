# FashionIQ AI Recommendation Microservice

The **FashionIQ AI Recommendation Microservice** is a high-performance, lightweight Python service built with **FastAPI**, **ChromaDB**, and **Sentence-Transformers**. It powers the personalized fashion discovery, vector similarity search, and smart wardrobe styling features of FashionIQ.

---

## 1. Architecture Overview

```text
               +-----------------------------+
               |      Next.js Frontend       |
               | (Port 3000 / React 19 / TS) |
               +--------------+--------------+
                              |
                     REST (JWT Auth)
                              |
               +--------------v--------------+
               |    Express Backend Gateway  |
               |       (Port 5000 / Node)    |
               +-------+--------------+------+
                       |              |
          Direct MySQL |              | Internal Proxy / Auth Header
          (Fallback)   |              | (X-Internal-Service-Key)
                       |              |
                       |       +------v----------------------+
                       |       |   FastAPI AI Microservice   |
                       |       |   (Port 8000 / Python 3.11) |
                       |       +------+---------------+------+
                       |              |               |
                       |        Dense |               | Dense Vectors
                       |        Query |               | (384-dim Cosine)
                       |              |               |
              +--------v-------+  +---v-------+  +----v--------------------+
              |  MySQL DB      |  | ChromaDB  |  | Sentence-Transformers   |
              |  (fashioniq)   |  | Vector DB |  | all-MiniLM-L6-v2 (CPU)  |
              +----------------+  +-----------+  +-------------------------+
```

### Key Principles
1. **Express as Gateway**: The frontend never calls the AI microservice directly. All client requests route through the Express gateway (`/api/recommendations/*`), ensuring single-point JWT validation and centralized CORS policies.
2. **Graceful Fallback**: If the Python service is offline, cold-starting, or unreachable, Express automatically falls back to SQL queries without throwing 500 errors.
3. **Local & Lightweight**: Uses `sentence-transformers/all-MiniLM-L6-v2` (~80MB footprint, 384 dimensions, normalized cosine similarity) running entirely on CPU (<500MB RAM usage).
4. **Persistent Vector Store**: ChromaDB persistence at `ai-service/data/chroma_db` ensures embeddings persist across service restarts without re-computing.

---

## 2. Directory Structure

```text
ai-service/
├── app/
│   ├── __init__.py
│   ├── config.py           # Settings management with Pydantic v2
│   ├── database.py         # PyMySQL connection & queries for indexing/profiles
│   ├── embeddings.py       # Singleton EmbeddingService (CPU-only, normalized vectors)
│   ├── vector_store.py     # ChromaVectorStore wrapper with cosine similarity & pruning
│   ├── recommender.py      # Multi-strategy recommendation engine
│   ├── main.py             # FastAPI app with lifespan hooks & CORS
│   └── routes/
│       ├── __init__.py
│       ├── health.py       # Detailed diagnostic health endpoint
│       ├── indexing.py     # Secure product indexing into ChromaDB
│       └── recommendations.py # Similar, user, and wardrobe endpoints
├── data/
│   └── chroma_db/          # Persistent ChromaDB storage directory
├── scripts/
│   └── index_products.py   # Standalone CLI indexing script
├── tests/
│   └── test_recommender.py # Pytest test suite (100% pass rate)
├── .env.example
├── requirements.txt
└── README.md
```

---

## 3. Recommendation Strategies

The microservice implements four complementary recommendation algorithms in `app/recommender.py`:

### A. Similar Products (`GET /recommendations/similar/{product_id}`)
- Fetches pre-computed dense embedding vector from ChromaDB.
- Searches ChromaDB using cosine similarity ($1.0 - \text{cosine\_distance}$).
- Strictly excludes the query product itself.
- Supports optional category and gender filters.

### B. Hyper-Personalized User Recommendations (`GET /recommendations/user/{user_id}`)
- Analyzes user's interaction history with weighted importance:
  - `PURCHASE`: **+5.0**
  - `ADD_TO_CART`: **+4.0**
  - `LIKE`: **+3.0**
  - `VIEW`: **+1.0**
  - `DISLIKE`: **-10.0** (Strict filter: Disliked items are permanently excluded)
- Embeds explicit user fashion profile preferences (style keywords, preferred brands, body type) with high intent weighting (**+3.5**).
- Computes normalized composite user preference vector in 384-dimensional space.
- Re-ranks vector search candidates with user budget range and brand affinity.

### C. Digital Wardrobe Complements (`GET /recommendations/wardrobe/{user_id}`)
- Analyzes items currently in the user's Digital Wardrobe (categories, colors, and seasons).
- Identifies complementary categories (e.g., Tops $\leftrightarrow$ Bottoms/Jackets/Footwear; Dresses $\leftrightarrow$ Outerwear/Accessories).
- Synthesizes styling query embeddings to find pieces that pair naturally with owned items.
- Excludes products the user already owns in their wardrobe.

### D. Cold-Start Fallback
- For new users or users with zero interactions, gracefully serves top catalog pieces with transparent reason tags (`"Popular Style"`, `"Catalog Pick"`).

---

## 4. Security & Internal Authentication

- **Secured Indexing Endpoint**: `POST /index/products` requires the `X-Internal-Service-Key` HTTP header. Missing or invalid keys are immediately rejected with HTTP 401 Unauthorized.
- Express guards the client-facing indexing trigger (`POST /api/recommendations/index`) with `authMiddleware` and `roleMiddleware("ADMIN")`, forwarding the internal secret key server-to-server.

---

## 5. Setup & Running Locally

### Prerequisites
- Python 3.11+
- Running MySQL instance (`fashioniq` database)

### Installation
```powershell
cd C:\FashoinIQ\ai-service

# Create and activate virtual environment (optional)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### Environment Configuration
Copy `.env.example` to `.env` or inherit directly from `backend/.env`:
```ini
ENV=development
DEBUG=true
PORT=8000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=fashioniq
AI_SERVICE_SECRET_KEY=FashionIQ_Internal_AI_Secret_Key_2026
```

### Initial Product Indexing
Index your MySQL catalog into ChromaDB:
```powershell
$env:PYTHONPATH="ai-service"
python ai-service/scripts/index_products.py
```

### Run the FastAPI Development Server
```powershell
$env:PYTHONPATH="ai-service"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 6. API Reference

| Method | Endpoint | Description | Auth / Security |
|---|---|---|---|
| `GET` | `/health` | Health diagnostics (MySQL, ChromaDB, SentenceTransformer) | Public |
| `POST` | `/index/products` | Batch indexes/prunes MySQL catalog into ChromaDB | `X-Internal-Service-Key` |
| `GET` | `/recommendations/similar/{product_id}?limit=8` | Cosine vector similarity search | Public |
| `GET` | `/recommendations/user/{user_id}?limit=10` | Personalized weighted interaction recommendations | Public (Internal) |
| `GET` | `/recommendations/wardrobe/{user_id}?limit=8` | Wardrobe complementary outfit matching | Public (Internal) |

---

## 7. Automated Testing

Run the automated test suite covering all endpoints, security, exclusion logic, and fallbacks:
```powershell
$env:PYTHONPATH="ai-service"
python -m pytest ai-service/tests/test_recommender.py -v
```

All 9 test cases run in ~25 seconds on CPU with 100% pass rate.
