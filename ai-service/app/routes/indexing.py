from fastapi import APIRouter, HTTPException, Header, status
from typing import Optional
import logging

from app.config import settings
from app.database import fetch_all_products_for_indexing
from app.embeddings import embedding_service
from app.vector_store import vector_store

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Indexing"])


def verify_internal_auth(x_internal_service_key: Optional[str] = Header(None)):
    """Enforce internal microservice security for indexing operations."""
    if not settings.AI_SERVICE_SECRET_KEY or not x_internal_service_key or x_internal_service_key != settings.AI_SERVICE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing internal service authentication key.",
        )


@router.post("/index/products")
def index_catalog_products(x_internal_service_key: Optional[str] = Header(None)):
    """
    Index or re-index products from MySQL into ChromaDB.
    - Extracts product details and variant aggregates from MySQL.
    - Generates 384-dimensional dense semantic vectors using all-MiniLM-L6-v2.
    - Upserts vectors and metadata into persistent ChromaDB storage in batches.
    - Prunes products deleted from MySQL.
    - Requires internal service secret key authentication.
    """
    verify_internal_auth(x_internal_service_key)

    try:
        # 1. Fetch products from MySQL
        products = fetch_all_products_for_indexing()
        if not products:
            return {
                "success": True,
                "message": "No products found in MySQL to index.",
                "indexed_count": 0,
                "pruned_count": 0,
                "total_in_index": vector_store.collection.count() if vector_store.is_ready() else 0,
            }

        # 2. Extract document texts and compute embeddings in batch
        documents = [p["document_text"] for p in products]
        embeddings = embedding_service.embed_texts(documents, batch_size=32)

        # 3. Upsert into ChromaDB
        res = vector_store.index_products(products, embeddings, batch_size=50)

        # 4. Prune stale documents
        active_ids = [p["product_id"] for p in products]
        pruned_count = vector_store.prune_stale_products(active_ids)

        return {
            "success": True,
            "message": f"Successfully indexed {res['indexed']} products into ChromaDB vector store.",
            "indexed_count": res["indexed"],
            "failed_count": res["failed"],
            "pruned_count": pruned_count,
            "total_in_index": res["total"],
        }
    except Exception as e:
        logger.error(f"Catalog indexing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Catalog indexing failed: {str(e)}",
        )
