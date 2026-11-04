from fastapi import APIRouter, Query, HTTPException, status
from typing import Optional
import logging

from app.recommender import recommender

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("/similar/{product_id}")
def get_similar_products(
    product_id: int,
    limit: int = Query(default=8, ge=1, le=50, description="Maximum recommendations to return"),
    category_id: Optional[int] = Query(default=None, description="Filter by category ID"),
    gender: Optional[str] = Query(default=None, description="Filter by gender (Men/Women/Unisex)"),
):
    """
    Retrieve products semantically and visually similar to a given product ID.
    Utilizes vector similarity search over ChromaDB embeddings.
    """
    if product_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid product ID provided. Must be a positive integer.",
        )

    try:
        recommendations = recommender.get_similar_products(
            product_id=product_id,
            limit=limit,
            category_id=category_id,
            gender=gender,
        )

        return {
            "success": True,
            "type": "SIMILAR_PRODUCTS",
            "query_product_id": product_id,
            "count": len(recommendations),
            "recommendations": recommendations,
        }
    except Exception as e:
        logger.error(f"Similar products recommendation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate similar product recommendations.",
        )


@router.get("/user/{user_id}")
def get_user_personalized_recommendations(
    user_id: int,
    limit: int = Query(default=10, ge=1, le=50, description="Maximum recommendations to return"),
):
    """
    Generate personalized recommendations for a user combining:
    - User style preferences and body profile
    - Weighted historical interactions (PURCHASE > CART > LIKE > VIEW)
    - Budget range constraints
    - Explicit exclusion of DISLIKED products
    - Graceful cold-start fallback
    """
    if user_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID provided. Must be a positive integer.",
        )

    try:
        recommendations = recommender.get_personalized_recommendations(
            user_id=user_id,
            limit=limit,
        )

        return {
            "success": True,
            "type": "PERSONALIZED_USER",
            "user_id": user_id,
            "count": len(recommendations),
            "recommendations": recommendations,
        }
    except Exception as e:
        logger.error(f"Personalized recommendation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate personalized recommendations.",
        )


@router.get("/wardrobe/{user_id}")
def get_wardrobe_recommendations(
    user_id: int,
    limit: int = Query(default=8, ge=1, le=50, description="Maximum recommendations to return"),
):
    """
    Generate complementary clothing recommendations based on pieces in user's Digital Wardrobe.
    Suggests items that pair with owned categories, colors, and seasons.
    """
    if user_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID provided. Must be a positive integer.",
        )

    try:
        recommendations = recommender.get_wardrobe_recommendations(
            user_id=user_id,
            limit=limit,
        )

        return {
            "success": True,
            "type": "WARDROBE_COMPLEMENTARY",
            "user_id": user_id,
            "count": len(recommendations),
            "recommendations": recommendations,
        }
    except Exception as e:
        logger.error(f"Wardrobe recommendation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate wardrobe-based recommendations.",
        )
