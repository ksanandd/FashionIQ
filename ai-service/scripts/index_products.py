#!/usr/bin/env python3
"""
FashionIQ - Catalog Product Indexer Script
Extracts products and variant data from MySQL and builds dense vector embeddings in ChromaDB.
"""

import sys
import os
from pathlib import Path

# Add parent directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import logging
from app.database import fetch_all_products_for_indexing
from app.embeddings import embedding_service
from app.vector_store import vector_store

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("indexer")


def run_indexing():
    logger.info("Starting FashionIQ catalog vector indexing...")

    # 1. Fetch catalog from MySQL
    products = fetch_all_products_for_indexing()
    total_products = len(products)
    logger.info(f"Retrieved {total_products} products from MySQL database.")

    if total_products == 0:
        logger.warning("No products found in MySQL. Ensure database is populated.")
        return

    # 2. Extract document representations
    logger.info("Preparing textual descriptions for embedding...")
    documents = [p["document_text"] for p in products]

    # 3. Generate embeddings using SentenceTransformers (batch mode)
    logger.info("Computing dense 384-dimensional semantic embeddings (batch size: 32)...")
    embeddings = embedding_service.embed_texts(documents, batch_size=32)
    logger.info(f"Generated {len(embeddings)} normalized embedding vectors.")

    # 4. Upsert into ChromaDB
    logger.info("Upserting vectors and metadata into local persistent ChromaDB...")
    res = vector_store.index_products(products, embeddings, batch_size=50)

    # 5. Prune any stale documents
    active_ids = [p["product_id"] for p in products]
    pruned = vector_store.prune_stale_products(active_ids)

    logger.info("=" * 60)
    logger.info("PRODUCT INDEXING COMPLETED SUCCESSFULLY!")
    logger.info(f"  • Newly / Re-Indexed: {res['indexed']}")
    logger.info(f"  • Failed:             {res['failed']}")
    logger.info(f"  • Pruned Stale Items: {pruned}")
    logger.info(f"  • Total in ChromaDB:  {res['total']}")
    logger.info("=" * 60)


if __name__ == "__main__":
    run_indexing()
