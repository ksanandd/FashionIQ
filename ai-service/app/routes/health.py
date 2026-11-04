from fastapi import APIRouter
from app.database import check_db_health
from app.vector_store import vector_store
from app.embeddings import embedding_service
from app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
def get_health_status():
    """
    Comprehensive health check verifying:
    - Service uptime
    - MySQL database connectivity
    - ChromaDB vector store readiness
    - SentenceTransformer embedding model status
    """
    mysql_ok = check_db_health()
    chroma_stats = vector_store.get_stats()
    model_ready = embedding_service.is_ready()

    overall_status = "healthy" if (mysql_ok and chroma_stats["ready"] and model_ready) else "degraded"

    return {
        "status": overall_status,
        "service": "FashionIQ AI Recommendation Microservice",
        "environment": settings.ENV,
        "mysql": {
            "status": "connected" if mysql_ok else "disconnected",
            "database": settings.DB_NAME,
        },
        "chromadb": {
            "status": "ready" if chroma_stats["ready"] else "not_ready",
            "collection": chroma_stats["collection_name"],
            "total_documents": chroma_stats["total_indexed"],
        },
        "embedding_model": {
            "status": "loaded" if model_ready else "pending_or_unloaded",
            "model_name": settings.EMBEDDING_MODEL_NAME,
            "dimension": embedding_service.dimension,
            "device": embedding_service.device,
        },
    }
