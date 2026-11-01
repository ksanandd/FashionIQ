# FashionIQ - An AI-Powered Personalized Fashion E-Commerce Platform

## 1. Project Overview

FashionIQ is an AI-powered personalized fashion e-commerce platform that combines conventional online shopping functionality with intelligent fashion recommendations.

The platform aims to recommend clothing products and complete outfits based on users' personal preferences, body profiles, shopping behavior, fashion style and budget.

Unlike conventional fashion e-commerce platforms, FashionIQ aims to provide personalized product discovery and intelligent outfit suggestions.

## 2. Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MySQL |
| Authentication | JWT |
| Password Security | bcryptjs |
| Database Driver | mysql2 |
| Vector Database | ChromaDB (planned) |
| AI/ML Recommendation Service | Python (planned) |
| Version Control | Git and GitHub |

## 3. Project Structure

```text
FashionIQ/
â”œâ”€â”€ frontend/
â”œâ”€â”€ backend/
â”œâ”€â”€ database/
â”‚   â”œâ”€â”€ FashionIQ_Complete_SQL_Documentation.sql
â”‚   â””â”€â”€ FashionIQ_DBMS_Explanation.docx
â”œâ”€â”€ .postman/
â”œâ”€â”€ postman/
â”œâ”€â”€ .gitignore
â””â”€â”€ README.md
```

## 4. Database Implementation - MySQL

The FashionIQ database currently contains 13 relational tables:

1. BRAND
2. CATEGORY
3. PRODUCT
4. PRODUCT_VARIANT
5. PRODUCT_PRICE_AUDIT
6. USER
7. USER_PROFILE
8. USER_INTERACTION
9. WARDROBE
10. WARDROBE_ITEM
11. OUTFIT
12. OUTFIT_ITEM
13. RECOMMENDATION

Implemented database features include:

- Primary keys and foreign keys.
- 18 foreign-key relationships.
- Referential integrity constraints.
- Product price audit trigger.
- Product engagement view.
- GetProductEngagement stored procedure.
- Indexing and query analysis.
- Transaction and rollback testing.

IMPORTANT: The current SQL documentation is a reference document, not a complete database recreation script. Obtain a fresh MySQL Workbench export before attempting a full database restoration.

## 5. Backend Implementation - Node.js and Express

The backend provides REST APIs for:

- Product listing and product details.
- Product variants.
- Categories and brands.
- User registration and login.
- JWT authentication.
- Role-based authorization.
- User profile and address management.
- Wardrobe management.
- User interactions.
- Basic product recommendations.

### API Routes

| Endpoint | Functionality |
|---|---|
| GET /api/products | Retrieve products |
| GET /api/products/:id | Retrieve product details |
| GET /api/products/:id/variants | Retrieve product variants |
| GET /api/categories | Retrieve categories |
| GET /api/brands | Retrieve brands |
| POST /api/auth/register | Register user |
| POST /api/auth/login | User login |
| GET /api/auth/me | Retrieve authenticated user |
| GET /api/users/profile | Retrieve user profile |
| PUT /api/users/profile | Update user profile |
| PUT /api/users/address | Update user address |
| GET /api/wardrobes | Retrieve wardrobes |
| POST /api/wardrobes | Create wardrobe |
| POST /api/interactions | Record user interaction |
| GET /api/recommendations/:userId | Retrieve basic recommendations |

Additional wardrobe, interaction and administrative endpoints are implemented in the backend routes.

Backend development server:

```powershell
cd backend
npm install
npm run dev
```

Default backend port: 5000.

## 6. Frontend Implementation - Next.js

The frontend uses the existing FashionIQ UI and integrates with the Express backend.

Implemented functionality includes:

- Homepage and product discovery UI.
- Product listing fetched from MySQL through backend APIs.
- Dynamic product detail pages.
- Product color and size selection.
- Variant-specific prices.
- Stock availability.
- Add to Cart.
- Variant-aware cart storage.
- Cart price calculation.
- Existing wishlist functionality.
- Login and registration UI.

The cart and wishlist currently use browser localStorage. Complete database-backed checkout and order management are still pending.

Frontend development server:

```powershell
cd frontend
npm install
npm run dev
```

Default frontend URL: http://localhost:3000.

## 7. Current Development Status

### Implemented

- MySQL database design and implementation.
- Backend REST APIs.
- JWT authentication.
- User profile and wardrobe APIs.
- Product, category and brand APIs.
- Product variant API.
- Frontend product listing integration.
- Frontend product detail integration.
- Variant-aware cart functionality.

### Partially implemented or requiring further integration

- Frontend authentication with backend.
- User profile integration.
- Wishlist integration and persistence.
- Homepage dynamic data.
- Complete shopping workflow.

### Planned development

- Complete checkout and order management.
- Payment integration, if required.
- Python-based recommendation service.
- ChromaDB vector database integration.
- Product embeddings and similarity search.
- Personalized product recommendations.
- Complete outfit recommendations.
- Wardrobe-based recommendations.
- Testing and deployment.

## 8. Environment Configuration

Backend configuration is stored in:

`backend/.env`

Frontend configuration is stored in:

`frontend/.env.local`

The frontend API URL is configured using:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

Backend configuration uses:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=fashioniq
DB_PORT=3306
JWT_SECRET=your_jwt_secret_here
```

Use the actual local credentials in environment files. Never commit secrets to GitHub.

## 9. Development Instructions

Run MySQL first.

Start the backend:

```powershell
cd backend
npm install
npm run dev
```

Start the frontend in a separate terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open:

http://localhost:3000

Backend health check:

http://localhost:5000/

Database connectivity check:

http://localhost:5000/api/db-test

## 10. Future Vision

FashionIQ aims to become an intelligent fashion shopping platform that understands user preferences and recommends suitable clothing and matching outfits.

The final system should combine e-commerce, user profiling, database analytics, vector similarity search and personalized fashion recommendations.