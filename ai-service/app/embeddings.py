import logging
from typing import List, Optional
from app.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    _instance: Optional["EmbeddingService"] = None

    def __init__(self):
        self.model_name = settings.EMBEDDING_MODEL_NAME
        self.model = None
        self.dimension = 384
        self.device = "cpu"
        self._is_ready = False

    @classmethod
    def get_instance(cls) -> "EmbeddingService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_model(self):
        """Load the SentenceTransformer embedding model once and keep it in memory."""
        if self._is_ready and self.model is not None:
            return

        logger.info(f"Loading embedding model: {self.model_name} (CPU optimized)...")
        try:
            from sentence_transformers import SentenceTransformer

            # Force CPU usage for maximum predictability on laptop hardware
            # Prefer local cached files to eliminate external network roundtrips
            try:
                self.model = SentenceTransformer(self.model_name, device="cpu", local_files_only=True)
            except Exception:
                self.model = SentenceTransformer(self.model_name, device="cpu")

            if hasattr(self.model, "get_embedding_dimension"):
                self.dimension = self.model.get_embedding_dimension()
            else:
                self.dimension = self.model.get_sentence_embedding_dimension()
            self._is_ready = True
            logger.info(
                f"Embedding model loaded successfully! Embedding dimension: {self.dimension}"
            )
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            self._is_ready = False
            raise e

    def is_ready(self) -> bool:
        return self._is_ready and self.model is not None

    def embed_text(self, text: str) -> List[float]:
        """Generate embedding vector for a single string."""
        if not self.is_ready():
            self.load_model()
        embedding = self.model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
        return embedding.tolist()

    def embed_texts(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """Generate normalized embedding vectors for a list of strings in batches."""
        if not self.is_ready():
            self.load_model()
        if not texts:
            return []
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return embeddings.tolist()


embedding_service = EmbeddingService.get_instance()
