import os
from pathlib import Path
from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve base directories
BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent
BACKEND_ENV = ROOT_DIR / "backend" / ".env"
LOCAL_ENV = BASE_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[str(LOCAL_ENV), str(BACKEND_ENV)],
        extra="ignore"
    )

    ENV: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # MySQL Configuration
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "fashioniq"

    # Internal Service Secret Authentication (Shared between Express and FastAPI)
    AI_SERVICE_SECRET_KEY: Optional[str] = None
    AI_SERVICE_KEY: Optional[str] = None

    @model_validator(mode="after")
    def sync_and_validate_service_keys(self):
        # Resolve from either environment variable name
        resolved = self.AI_SERVICE_SECRET_KEY or self.AI_SERVICE_KEY
        if resolved:
            self.AI_SERVICE_SECRET_KEY = resolved
            self.AI_SERVICE_KEY = resolved
        elif self.ENV == "production":
            raise ValueError(
                "CRITICAL SECURITY CONFIGURATION ERROR: AI_SERVICE_SECRET_KEY or AI_SERVICE_KEY must be configured in production."
            )
        return self

    # Embedding Model & ChromaDB Configuration
    # Model: all-MiniLM-L6-v2 (~80MB download, 384 dimensions, ultra-fast CPU inference)
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    CHROMA_PERSIST_DIRECTORY: str = str(BASE_DIR / "data" / "chroma_db")
    CHROMA_COLLECTION_NAME: str = "fashioniq_products"

    # Recommendation Weights for User Interaction
    INTERACTION_WEIGHTS: dict = {
        "PURCHASE": 5.0,
        "ADD_TO_CART": 4.0,
        "LIKE": 3.0,
        "VIEW": 1.0,
        "DISLIKE": -10.0,
    }


settings = Settings()
