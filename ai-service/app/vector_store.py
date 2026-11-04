import os
import logging
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)


class ChromaVectorStore:
    _instance: Optional["ChromaVectorStore"] = None

    def __init__(self):
        self.persist_directory = settings.CHROMA_PERSIST_DIRECTORY
        self.collection_name = settings.CHROMA_COLLECTION_NAME
        self.client = None
        self.collection = None
        self._is_ready = False

    @classmethod
    def get_instance(cls) -> "ChromaVectorStore":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self):
        """Initialize local persistent ChromaDB client and collection."""
        if self._is_ready and self.collection is not None:
            return

        logger.info(f"Initializing ChromaDB client at: {self.persist_directory}")
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            os.makedirs(self.persist_directory, exist_ok=True)

            self.client = chromadb.PersistentClient(
                path=self.persist_directory,
                settings=ChromaSettings(anonymized_telemetry=False, is_persistent=True),
            )

            # Cosine similarity is optimal for normalized sentence transformer vectors
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine", "description": "FashionIQ Product Catalog Embeddings"},
            )

            self._is_ready = True
            logger.info(
                f"ChromaDB initialized! Collection '{self.collection_name}' currently holds {self.collection.count()} items."
            )
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}")
            self._is_ready = False
            raise e

    def is_ready(self) -> bool:
        return self._is_ready and self.collection is not None

    def index_products(
        self, products: List[Dict[str, Any]], embeddings: List[List[float]], batch_size: int = 50
    ) -> Dict[str, int]:
        """
        Upsert products into ChromaDB in batches.
        Updates existing products without creating duplicates.
        """
        if not self.is_ready():
            self.initialize()

        if not products or not embeddings or len(products) != len(embeddings):
            return {"indexed": 0, "failed": 0}

        total = len(products)
        indexed_count = 0
        failed_count = 0

        for i in range(0, total, batch_size):
            batch_prods = products[i : i + batch_size]
            batch_embs = embeddings[i : i + batch_size]

            ids = [f"prod_{p['product_id']}" for p in batch_prods]
            documents = [p["document_text"] for p in batch_prods]

            # Flatten metadata into Chroma-compatible primitives (str, int, float, bool)
            metadatas = [
                {
                    "product_id": int(p["product_id"]),
                    "product_name": str(p["product_name"]),
                    "brand_id": int(p["brand_id"]),
                    "brand_name": str(p["brand_name"]),
                    "category_id": int(p["category_id"]),
                    "category_name": str(p["category_name"]),
                    "gender": str(p["gender"]),
                    "price": float(p["price"]),
                    "in_stock": bool(p["in_stock"]),
                    "colors": ",".join(p.get("colors", [])),
                    "sizes": ",".join(p.get("sizes", [])),
                }
                for p in batch_prods
            ]

            try:
                self.collection.upsert(
                    ids=ids,
                    embeddings=batch_embs,
                    metadatas=metadatas,
                    documents=documents,
                )
                indexed_count += len(batch_prods)
            except Exception as e:
                logger.error(f"Error indexing product batch: {e}")
                failed_count += len(batch_prods)

        return {"indexed": indexed_count, "failed": failed_count, "total": self.collection.count()}

    def query_similar(
        self,
        query_embedding: List[float],
        n_results: int = 10,
        where_filter: Optional[Dict[str, Any]] = None,
        exclude_product_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Query ChromaDB for most similar products using cosine vector similarity.
        Computes similarity score = 1.0 - cosine_distance.
        """
        if not self.is_ready():
            self.initialize()

        # Build where clause
        conditions = []
        if where_filter:
            for k, v in where_filter.items():
                conditions.append({k: {"$eq": v}})

        # Assemble final where filter
        final_where = None
        if len(conditions) == 1:
            final_where = conditions[0]
        elif len(conditions) > 1:
            final_where = {"$and": conditions}

        # Request extra candidates to account for exclusion of self
        fetch_limit = n_results + 3 if exclude_product_id else n_results

        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=min(fetch_limit, max(1, self.collection.count())),
                where=final_where,
                include=["metadatas", "distances", "documents"],
            )

            hits = []
            if results and results.get("ids") and results["ids"][0]:
                ids = results["ids"][0]
                metas = results["metadatas"][0] if results.get("metadatas") else []
                distances = results["distances"][0] if results.get("distances") else []

                for doc_id, meta, dist in zip(ids, metas, distances):
                    pid = meta.get("product_id")
                    if exclude_product_id and pid == exclude_product_id:
                        continue

                    # Filter out completely out of stock items if specified
                    if not meta.get("in_stock", True):
                        continue

                    # For cosine distance, similarity is 1.0 - distance
                    sim_score = max(0.0, min(1.0, 1.0 - dist))

                    hits.append({
                        "product_id": pid,
                        "similarity_score": round(sim_score, 4),
                        "metadata": meta
                    })

                    if len(hits) >= n_results:
                        break

            return hits
        except Exception as e:
            logger.error(f"Vector similarity query failed: {e}")
            return []

    def get_product_embedding(self, product_id: int) -> Optional[List[float]]:
        """Retrieve stored embedding vector for a given product."""
        if not self.is_ready():
            self.initialize()

        try:
            res = self.collection.get(
                ids=[f"prod_{product_id}"],
                include=["embeddings"],
            )
            embs = res.get("embeddings") if res is not None else None
            if embs is not None and len(embs) > 0:
                first = embs[0]
                return first.tolist() if hasattr(first, "tolist") else list(first)
            return None
        except Exception as e:
            logger.error(f"Error fetching embedding for product #{product_id}: {e}")
            return None

    def prune_stale_products(self, active_product_ids: List[int]) -> int:
        """Remove products from ChromaDB that no longer exist in MySQL."""
        if not self.is_ready():
            self.initialize()

        active_id_set = {f"prod_{pid}" for pid in active_product_ids}
        try:
            all_ids = self.collection.get()["ids"]
            stale_ids = [doc_id for doc_id in all_ids if doc_id not in active_id_set]

            if stale_ids:
                self.collection.delete(ids=stale_ids)
                logger.info(f"Pruned {len(stale_ids)} stale products from ChromaDB.")
            return len(stale_ids)
        except Exception as e:
            logger.error(f"Failed to prune stale products: {e}")
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """Return diagnostic statistics."""
        return {
            "ready": self.is_ready(),
            "collection_name": self.collection_name,
            "total_indexed": self.collection.count() if self.is_ready() else 0,
            "persist_directory": self.persist_directory,
        }

    def get_all_indexed_products(self) -> List[Dict[str, Any]]:
        """Retrieve all currently indexed product metadatas."""
        if not self.is_ready():
            self.initialize()
        try:
            res = self.collection.get(include=["metadatas"])
            return res.get("metadatas", []) or []
        except Exception as e:
            logger.error(f"Failed to fetch indexed products: {e}")
            return []



vector_store = ChromaVectorStore.get_instance()
