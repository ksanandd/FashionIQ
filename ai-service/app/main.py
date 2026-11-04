import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.embeddings import embedding_service
from app.vector_store import vector_store
from app.routes.health import router as health_router
from app.routes.indexing import router as indexing_router
from app.routes.recommendations import router as recommendations_router
from app.routes.outfits import router as outfits_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("fashioniq-ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application Lifespan:
    Initializes vector store and loads embedding model once on startup.
    Ensures memory efficiency and fast subsequent requests on laptop CPU.
    """
    logger.info("Initializing FashionIQ AI Microservice...")
    try:
        # 1. Initialize persistent ChromaDB vector store
        vector_store.initialize()

        # 2. Pre-load SentenceTransformer model into memory
        embedding_service.load_model()
        logger.info("FashionIQ AI Microservice ready to serve recommendation requests.")
    except Exception as e:
        logger.error(f"Startup initialization encountered error: {e}")

    yield

    logger.info("Shutting down FashionIQ AI Microservice.")


# Instantiate FastAPI application
app = FastAPI(
    title="FashionIQ AI Recommendation Microservice",
    description="Vector similarity and personalized fashion recommendations powered by FastAPI, ChromaDB, and SentenceTransformers.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: configured for local development and Express backend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(health_router)
app.include_router(indexing_router)
app.include_router(recommendations_router)
app.include_router(outfits_router)


@app.get("/")
def root():
    return {
        "service": "FashionIQ AI Recommendation Microservice",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
