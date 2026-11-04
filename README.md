# FashionIQ - AI-Powered Personalized Fashion E-Commerce Platform

[![Platform](https://img.shields.io/badge/FashionIQ-v1.0.0--Phase9-orange.svg)](https://github.com/ksanandd/FashionIQ)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016%20%7C%20React%2019-black)](https://nextjs.org/)
[![Backend](https://img.shields.io/badge/Backend-Express%205%20%7C%20Node.js-green)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/Database-MySQL%208.0-blue)](https://www.mysql.com/)
[![AI-Microservice](https://img.shields.io/badge/AI%20Microservice-FastAPI%20%7C%20ChromaDB-purple)](https://fastapi.tiangolo.com/)

---

## 1. Project Overview

**FashionIQ** is a full-stack, AI-powered personalized fashion e-commerce platform designed to transform conventional clothing shopping into an intelligent, style-aware discovery experience.

Unlike static online catalogs, FashionIQ coordinates apparel through:
- **Personalized Recommendations**: Machine learning embeddings capturing semantic product style, color, cut, and brand preferences.
- **Digital Wardrobe**: Virtual closet tracking owned and saved garments, distinguishing verified customer purchases from manually saved inspirations.
- **Outfit Studio**: Complete 2-to-4-piece coordinated outfit generation (Tops, Bottoms, Shoes, Outerwear) based on color harmony rules, occasion, season, and budget constraints.
- **"Buy Needed Pieces"**: Intelligent outfit purchasing that automatically identifies unowned items and adds only necessary pieces to the cart.
- **Administrative Portal & Analytics**: Real-time management of products, inventory variants, categories, brands, orders, state machine transitions, and revenue accounting.

---

## 2. Feature List

### Customer Experience
- **Interactive Storefront**: Modern homepage with curated collections, trending products, and AI recommendation shelves.
- **Advanced Catalog Discovery**: Search, multiple category filters, brand filters, gender filters, price ranges, and sorting.
- **Product Details & Sizing**: Real-time color and size variant selector, stock quantity tracking, and instant add-to-cart.
- **Interactive Wishlist**: Persistent client-side wishlist with live heart icon counters and instant toggling.
- **Shopping Cart**: Client-side cart with quantity adjustment, subtotal calculations, and free delivery estimation.
- **Transactional Checkout**: Atomic stock validation, shipping address management, and support for Cash on Delivery (COD) and Simulated Card payments.
- **Order Tracking & History**: User-isolated order history displaying line items, prices at purchase, payment status, and delivery tracking.
- **Digital Wardrobe**: Virtual wardrobe categorized by season and source (`PURCHASED` vs `SAVED`), with automated synchronization upon order completion.
- **Outfit Studio (`/outfits`)**:
  - *Personalized Outfits*: Complete coordinated ensembles generated from AI recommendations and style profiles.
  - *Style From My Wardrobe*: Wardrobe-anchored outfit suggestions maximizing the use of already-owned pieces.
  - *Complete the Look*: Product-anchored outfit coordination from any product detail page.
  - *Custom Outfit Studio*: Interactive outfit generation with real-time Occasion, Season, and Maximum Budget sliders.
  - *Save & Manage Outfits*: Save coordinated outfits to personal profiles with ownership authorization.
  - *Buy Needed Pieces*: One-click cart addition of only unowned pieces in an outfit.

### Administrative Capabilities (`/admin`)
- **Dashboard KPIs**: Real-time counts for Users, Products, Categories, Brands, and Orders.
- **Revenue Accounting Policy**: Strict segregation between Genuine Recognized Revenue (settled online payments and confirmed collected COD cash), Pending Collections (COD awaiting delivery), and Simulated Card Test Volume.
- **Catalog Management**: Full CRUD operations for Products, Categories, and Brands with duplicate prevention and relationship protection.
- **Variant & Inventory Management**: Sizing, color variations, price overrides, and stock level controls with low-stock warnings.
- **Order State Machine**: Enforces valid transitions (`PENDING` -> `PROCESSING` -> `SHIPPED` -> `DELIVERED`). Pessimistic row locking (`SELECT ... FOR UPDATE`) prevents concurrent cancellation races, restoring stock exactly once.
- **Customer Privacy & Management**: User account oversight, style profile inspection, and role assignment (`USER` vs `ADMIN`) with protection against demoting the last administrator. User password hashes are never exposed.

---

## 3. Technology Stack

| Tier | Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Framework | Next.js (App Router) | 16.4.3 | SSR/Static page generation |
| | Library | React | 19.3.0 | Modern UI rendering |
| | Language | TypeScript | 5.x | Strict static type safety |
| | Styling | Tailwind CSS | v4.0 | Utility-first responsive design |
| | Icons | Lucide React | 1.66.0 | Modern scalable UI icons |
| **Backend** | Server | Node.js / Express | 5.3.0 | API Gateway & business logic |
| | Database Driver | mysql2/promise | 3.24.6 | High-performance connection pool |
| | Security | jsonwebtoken | 9.0.3 | Stateless JWT authentication (24h) |
| | Encryption | bcryptjs | 3.0.3 | Salted password hashing (10 rounds) |
| **Database** | Relational Store | MySQL | 8.0+ | ACID source of truth (15 tables, 1 view) |
| **AI Microservice**| ML API Server | Python FastAPI / Uvicorn| 0.110+ | Asynchronous recommendation endpoints |
| | Embeddings | Sentence Transformers | 2.5.0+ | `all-MiniLM-L6-v2` (384-dimensional vectors) |
| | Vector Database | ChromaDB | 0.4.24+ | Local persistent vector index (`data/chroma_db`)|

---

## 4. Architecture Overview

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                         Next.js Frontend                               │
 │                 (React 19, TypeScript, Tailwind CSS)                   │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP (JSON) / JWT Bearer
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Express Backend Gateway                           │
 │                (Authentication, RBAC, Business Logic)                  │
 └─────────────────┬────────────────────────────────────┬─────────────────┘
                   │                                    │
    MySQL Protocol │                     Internal HTTP  │ Header:
    (Connection    │                     Service Key    │ X-Internal-Service-Key
    Pool: 10)      │                                    │
                   ▼                                    ▼
 ┌────────────────────────────────────┐ ┌─────────────────────────────────┐
 │          MySQL Database            │ │       FastAPI AI Service        │
 │             (fashioniq)            │ │   (Embeddings & Recommendations)│
 │                                    │ └────────────────┬────────────────┘
 │ • 15 Relational Base Tables        │                  │
 │ • 1 Analytical Engagement View     │                  ▼
 │ • ACID Transactions & Locks        │ ┌─────────────────────────────────┐
 │ • Strict Foreign Key Integrity     │ │       ChromaDB Vector Store     │
 └────────────────────────────────────┘ │      (Local Persistent Disk)    │
                                        └─────────────────────────────────┘
```

### Architectural Principles:
1. **MySQL is the Single Source of Truth**: All transactional records (users, inventory, orders, wardrobes, outfits) reside in MySQL.
2. **Express is the API Gateway**: The frontend communicates exclusively with Express. Express acts as the security boundary and authorizes all user actions.
3. **Internal Microservice Authentication**: The FastAPI AI service is internal. Direct calls require the `X-Internal-Service-Key` header.
4. **Transparent Offline Fallback**: If the Python AI service is unavailable or cold-starting, Express automatically falls back to deterministic SQL algorithms within 3.5 seconds without exposing stack traces.

---

## 5. Project Directory Structure

```text
FashionIQ/
├── .env.example                     # Platform-wide environment template
├── README.md                        # Master project documentation
├── package.json                     # Root metadata
│
├── frontend/                        # Next.js 16 Web Application
│   ├── .env.example                 # Frontend environment template
│   ├── .env.local                   # Local frontend environment (ignored)
│   ├── package.json                 # Next.js dependencies
│   ├── tsconfig.json                # TypeScript compiler configuration
│   ├── app/                         # App Router Pages
│   │   ├── layout.tsx               # Root layout & AuthProvider wrapper
│   │   ├── page.tsx                 # Storefront homepage
│   │   ├── admin/page.tsx           # Administrative management portal
│   │   ├── cart/page.tsx            # Shopping cart management
│   │   ├── checkout/page.tsx        # Transactional checkout & payment
│   │   ├── login/page.tsx           # User authentication
│   │   ├── register/page.tsx        # New customer registration
│   │   ├── orders/page.tsx          # Customer order history & tracking
│   │   ├── outfits/page.tsx         # Outfit Studio & style generator
│   │   ├── products/page.tsx        # Product catalog & filters
│   │   ├── products/[id]/page.tsx   # Product detail & options
│   │   ├── profile/page.tsx         # User style profile & address
│   │   ├── wardrobe/page.tsx        # Digital wardrobe interface
│   │   └── wishlist/page.tsx        # Saved wishlist pieces
│   ├── components/                  # Reusable UI components (Navbar, CartIcon, etc.)
│   ├── context/                     # Client state contexts (AuthContext.tsx)
│   └── lib/                         # API client utilities (api.ts, cart.ts, etc.)
│
├── backend/                         # Node.js Express Backend
│   ├── .env.example                 # Backend environment template
│   ├── .env                         # Local backend environment (ignored)
│   ├── package.json                 # Express dependencies
│   ├── server.js                    # Express application entrypoint
│   ├── config/                      # Database pool configuration (db.js)
│   ├── controllers/                 # Request controllers (admin, order, outfit, etc.)
│   ├── middleware/                  # Auth verification (authMiddleware, roleMiddleware)
│   ├── routes/                      # REST API routing definitions
│   ├── services/                    # Business & fallback services
│   └── tests/                       # Automated backend integration test suites
│       ├── test_admin.js            # Admin portal & accounting tests (67 tests)
│       ├── test_outfits.js          # Outfit engine integration tests (37 tests)
│       ├── test_recommendations.js  # Recommendation integration tests (30 tests)
│       ├── test_system_journey.js   # 26-step customer journey test (59 tests)
│       └── audit_customer_journey.js# Phase 7 journey simulation (17 tests)
│
├── ai-service/                      # Python FastAPI AI Microservice
│   ├── .env.example                 # AI service environment template
│   ├── requirements.txt             # Python dependencies
│   ├── app/                         # Application modules
│   │   ├── main.py                  # FastAPI application entrypoint
│   │   ├── config.py                # Environment configuration
│   │   ├── database.py              # PyMySQL connection utilities
│   │   ├── embeddings.py            # SentenceTransformer model wrapper
│   │   ├── vector_store.py          # ChromaDB persistence & indexing
│   │   ├── recommender.py           # Product recommendation engine
│   │   ├── outfit_engine.py         # Complete outfit coordination engine
│   │   └── routes/                  # FastAPI router definitions
│   ├── data/                        # Persistent storage (chroma_db/)
│   └── tests/                       # Pytest test suites (24 tests)
│
└── database/                        # Database Schemas & Migrations
    ├── FashionIQ_Full_Database.sql  # Master baseline schema & seed data
    ├── migration_orders.sql         # Phase 5 checkout & orders migration
    ├── migration_wardrobe.sql       # Phase 4 digital wardrobe migration
    └── migration_outfit.sql         # Phase 7 outfit engine migration
```

---

## 6. Database Setup (MySQL)

### Prerequisites
- MySQL Community Server 8.0+ running on `localhost:3306`.
- A database named `fashioniq`.

### Initialization
1. Start your local MySQL service.
2. Create the database:
   ```sql
   CREATE DATABASE IF NOT EXISTS fashioniq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Import the master SQL schema:
   ```powershell
   mysql -u root -p fashioniq < database/FashionIQ_Full_Database.sql
   ```
4. Apply historical migration scripts (if not already applied):
   ```powershell
   mysql -u root -p fashioniq < database/migration_orders.sql
   mysql -u root -p fashioniq < database/migration_wardrobe.sql
   mysql -u root -p fashioniq < database/migration_outfit.sql
   ```

### Relational Schema Summary (15 Base Tables, 1 View)
- `user`: Customer and administrator accounts, credentials, and delivery addresses.
- `user_profile`: Sizing (height, weight, body type), fashion styles, brand preferences, and budget ranges.
- `brand`: Fashion labels and metadata.
- `category`: Hierarchical product taxonomy (Tops, Bottoms, Shoes, Accessories, Outerwear).
- `product`: Base apparel catalog, descriptions, gender, and base pricing.
- `product_variant`: Physical SKUs with specific sizes, colors, and stock quantities.
- `product_price_audit`: Trigger-backed audit log capturing price changes.
- `user_interaction`: Behavioral telemetry (`VIEW`, `LIKE`, `DISLIKE`, `ADD_TO_CART`, `PURCHASE`).
- `wardrobe`: User wardrobe collections.
- `wardrobe_item`: Items stored in user wardrobes, flagged as `PURCHASED` or `SAVED`.
- `orders`: Transactional customer orders with payment methods, status, and shipping addresses.
- `order_item`: Line items associated with orders, capturing price-at-purchase.
- `outfit`: Coordinated outfit definitions with season, occasion, and total retail pricing.
- `outfit_item`: Individual variant roles (`Top`, `Bottom`, `Shoes`, `Outerwear`) in an outfit.
- `recommendation`: Cached user recommendation scores.
- `product_engagement_view` (VIEW): Aggregated product interaction statistics.

---

## 7. Backend Setup (Node.js & Express)

1. Open a terminal and navigate to the backend directory:
   ```powershell
   cd backend
   ```
2. Install npm dependencies:
   ```powershell
   npm install
   ```
3. Configure environment variables:
   ```powershell
   Copy-Item .env.example .env
   ```
   Edit `.env` to configure your MySQL password and JWT secret:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=fashioniq
   JWT_SECRET=your_secure_random_jwt_secret_key_minimum_32_characters
   AI_SERVICE_URL=http://localhost:8000
   AI_SERVICE_KEY=FashionIQ_Internal_AI_Secret_Key_2026
   ```
4. Start the Express backend:
   ```powershell
   npm run dev
   ```
   The backend will start at `http://localhost:5000`. Verify with `http://localhost:5000/api/db-test`.

---

## 8. Frontend Setup (Next.js 16)

1. Open a separate terminal and navigate to the frontend directory:
   ```powershell
   cd frontend
   ```
2. Install frontend dependencies:
   ```powershell
   npm install
   ```
3. Configure environment variables:
   ```powershell
   Copy-Item .env.example .env.local
   ```
   Ensure `frontend/.env.local` contains:
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
   ```
4. Start the Next.js development server:
   ```powershell
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

---

## 9. AI Microservice Setup (Python FastAPI & ChromaDB)

1. Open a third terminal and navigate to `ai-service`:
   ```powershell
   cd ai-service
   ```
2. Create and activate a Python virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. Install Python requirements:
   ```powershell
   pip install -r requirements.txt
   ```
4. Start the FastAPI microservice:
   ```powershell
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   FastAPI will initialize the `all-MiniLM-L6-v2` embedding model and ChromaDB at `ai-service/data/chroma_db`. Verify with `http://localhost:8000/health`.

---

## 10. Environment Variable Reference

### Root Template (`.env.example`)
Contains reference documentation for all microservices.

### Backend (`backend/.env`)
| Variable | Required | Default | Purpose |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `5000` | Port for Express HTTP listener |
| `DB_HOST` | Yes | `localhost` | MySQL hostname |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_USER` | Yes | `root` | Database username |
| `DB_PASSWORD` | Yes | `""` | Database password |
| `DB_NAME` | Yes | `fashioniq` | Target database name |
| `JWT_SECRET` | Yes | — | Secret key used to sign and verify JWT tokens |
| `AI_SERVICE_URL` | No | `http://localhost:8000`| Base URL of FastAPI AI microservice |
| `AI_SERVICE_KEY` | Yes | — | Shared secret passed in `X-Internal-Service-Key` |
| `CORS_ORIGIN` | No | `*` (dev) | Whitelist for allowed frontend domains |

### Frontend (`frontend/.env.local`)
| Variable | Required | Default | Purpose |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `http://localhost:5000` | Gateway endpoint for Express API |

### AI Microservice (`ai-service/.env`)
| Variable | Required | Default | Purpose |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `8000` | FastAPI server port |
| `AI_SERVICE_SECRET_KEY` | Yes | — | Shared secret matching backend `AI_SERVICE_KEY` |
| `EMBEDDING_MODEL_NAME` | No | `sentence-transformers/all-MiniLM-L6-v2` | Hugging Face model |
| `CHROMA_PERSIST_DIRECTORY` | No | `data/chroma_db` | Local persistent directory for ChromaDB |

---

## 11. Test Execution Commands

The platform features an automated regression suite across Express, FastAPI, and Next.js:

| Suite | Command | Coverage |
| :--- | :--- | :--- |
| **System Journey Suite** | `node backend/tests/test_system_journey.js` | Full 26-step customer journey & cleanup |
| **Admin Portal Suite** | `node backend/tests/test_admin.js` | Role security, accounting, concurrency |
| **Outfit Engine Suite** | `node backend/tests/test_outfits.js` | Outfits, styling, and cart integration |
| **Recommendation Suite** | `node backend/tests/test_recommendations.js` | Vector search, budget caps, fallback |
| **Customer Journey Simulation** | `node backend/tests/audit_customer_journey.js` | E2E customer journey verification |
| **AI Pytest Suite** | `python -m pytest -o pythonpath=ai-service ai-service/tests/ -v` | Unit tests for ML recommender & outfits |
| **AI Live Recovery Test**| `python backend/tests/run_recovery_test.py` | Graceful offline fallback & recovery |
| **TypeScript Typecheck** | `node ./frontend/node_modules/typescript/bin/tsc --noEmit --project frontend/tsconfig.json` | Complete static type check |
| **Next.js Production Build** | `npm run --prefix frontend build` | Production bundle build (`next build --webpack`) |

---

## 12. Development Startup Instructions

To launch the full FashionIQ development environment, start each service in its own terminal window:

```powershell
# Terminal 1: MySQL Database Service
net start MySQL80 # (or start through MySQL Workbench / XAMPP)

# Terminal 2: Node.js Express Backend (Port 5000)
cd C:\FashoinIQ\backend
npm run dev

# Terminal 3: Python FastAPI AI Microservice (Port 8000)
cd C:\FashoinIQ\ai-service
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --port 8000 --reload

# Terminal 4: Next.js Frontend (Port 3000)
cd C:\FashoinIQ\frontend
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 13. Admin Portal Overview (`/admin`)

The Administrative Portal is restricted to accounts with `role = 'ADMIN'`.

### Key Dashboard Modules:
1. **Overview & Analytics**:
   - Total registered users, total products, active categories, brands, and total orders.
   - Genuine Recognized Revenue vs. Pending Collections vs. Simulated Card Volume.
   - Monthly revenue growth trends, order status distribution, top-selling products, and stock health.
2. **Product & Inventory Management**:
   - Create, edit, and safely delete products.
   - Manage size and color variants, per-variant price overrides, and stock quantities.
3. **Category & Brand Management**:
   - Full CRUD operations with duplicate name prevention and foreign-key safeguards.
4. **Order Management & State Machine**:
   - Status updates with strict transitions (`PENDING` -> `PROCESSING` -> `SHIPPED` -> `DELIVERED`).
   - Explicit COD Cash Collection confirmation: requires status to be `DELIVERED` before cash collection can be confirmed.
   - Concurrency-safe cancellation with atomic inventory restoration via `SELECT ... FOR UPDATE`.
5. **Customer Management**:
   - Inspect customer profile information, fashion sizing, and lifetime spend.
   - Role updates (`USER` / `ADMIN`) with protection preventing the demotion of the last administrator.
   - Passwords and password hashes are never exposed.

---

## 14. Security Considerations

- **Stateless JWT Authentication**: Tokens are signed with HMAC-SHA256 and expire in 24 hours. Tokens store user ID, email, and role.
- **Strict Role-Based Access Control (RBAC)**: All `/api/admin/*` endpoints strictly require `role === 'ADMIN'`. Normal users attempting access receive `403 Forbidden`.
- **Pessimistic Concurrency Locking**: Order placement and cancellation utilize `SELECT ... FOR UPDATE` transactions to eliminate race conditions and double stock decrements or restorations.
- **Ownership Verification**: All user-scoped endpoints (orders, wardrobes, outfits) verify that the authenticated token ID matches the record owner in MySQL.
- **No Client Price Trust**: Order amounts and prices are computed exclusively on the server from database records. Client-submitted prices are ignored.
- **SQL Injection Prevention**: All queries use parameterized SQL (`?` placeholders) with the `mysql2` driver.
- **Internal AI Service Guard**: Direct calls to FastAPI require `X-Internal-Service-Key`.
- **Password Protection**: Passwords are saved as bcrypt hashes (cost factor 10) and are explicitly omitted from all API responses.

---

## 15. Current Limitations

- **Simulated Payment Gateway**: Card payments are processed in simulation mode (`SIMULATED_CARD`). Integration with a real gateway (Stripe, Razorpay, or PayPal) is required for production credit card processing.
- **Single-Node Persistent Storage**: ChromaDB vectors are stored on the local filesystem (`data/chroma_db`). Multi-region deployment would benefit from a hosted vector database (e.g. Pinecone or Chroma Cloud).
- **Email Dispatch**: Order confirmations and password resets are logged rather than dispatched via SMTP/SES.

---

## 16. Future Deployment Preparation

When moving to production hosting:
1. **Database**: Use a managed MySQL instance (AWS RDS, Google Cloud SQL, or DigitalOcean Managed Databases) with automatic backups.
2. **Backend**: Containerize using Docker and deploy to AWS ECS, Google Cloud Run, or a dedicated Node.js VPS.
3. **Frontend**: Deploy to Vercel or a dedicated Next.js Node.js server. Configure `NEXT_PUBLIC_API_BASE_URL` to point to the production backend domain.
4. **AI Microservice**: Deploy FastAPI container with CPU inference optimizations on Google Cloud Run or AWS ECS. Mount persistent volume storage for `data/chroma_db`.
5. **Environment Secrets**: Use a cloud secrets manager (e.g. AWS Secrets Manager or GCP Secret Manager) to manage database credentials and JWT keys.
6. **HTTPS & CORS**: Enforce TLS/SSL certificates and configure `CORS_ORIGIN` in `backend/.env` with production frontend origins.
