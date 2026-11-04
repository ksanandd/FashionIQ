import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, HTTPException, Header, status
from pydantic import BaseModel, Field

from app.config import settings
from app.outfit_engine import outfit_engine
from app.database import fetch_saved_outfits, save_user_outfit, delete_user_outfit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/outfits", tags=["Outfits"])


class GenerateOutfitRequest(BaseModel):
    user_id: Optional[int] = None
    anchor_product_ids: Optional[List[int]] = None
    occasion: Optional[str] = None
    season: Optional[str] = None
    budget_max: Optional[float] = None
    limit: int = Field(default=5, ge=1, le=20)


class OutfitItemPayload(BaseModel):
    variant_id: int
    role: str
    price: float = 0.0
    is_owned: bool = False


class SaveOutfitRequest(BaseModel):
    user_id: int
    outfit_name: str
    occasion: Optional[str] = "Casual"
    season: Optional[str] = "All Season"
    total_price: float = 0.0
    description: Optional[str] = None
    items: List[OutfitItemPayload]


def verify_internal_auth(x_internal_service_key: Optional[str] = Header(None)):
    """Enforce internal microservice security for mutation/service-to-service operations."""
    if not settings.AI_SERVICE_SECRET_KEY or not x_internal_service_key or x_internal_service_key != settings.AI_SERVICE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing internal service authentication key.",
        )


@router.get("/recommendations/{user_id}")
def get_personalized_outfits(
    user_id: int,
    occasion: Optional[str] = Query(default=None, description="Occasion filter (Casual, Sports, Formal, Party)"),
    season: Optional[str] = Query(default=None, description="Season filter (Summer, Winter, Monsoon, All Season)"),
    budget_max: Optional[float] = Query(default=None, ge=0, description="Maximum budget for the outfit"),
    limit: int = Query(default=5, ge=1, le=20),
    x_internal_service_key: Optional[str] = Header(None),
):
    """
    Generate complete, personalized outfit recommendations tailored to user profile,
    style preferences, color coordination, season, occasion, and budget.
    Requires internal service key authentication from Express gateway.
    """
    verify_internal_auth(x_internal_service_key)

    if user_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID provided.",
        )

    try:
        outfits = outfit_engine.generate_personalized_outfits(
            user_id=user_id,
            occasion=occasion,
            season=season,
            budget_max=budget_max,
            limit=limit,
        )
        return {
            "success": True,
            "type": "PERSONALIZED_OUTFITS",
            "user_id": user_id,
            "count": len(outfits),
            "outfits": outfits,
        }
    except Exception as e:
        logger.error(f"Personalized outfit generation error for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate personalized outfits.",
        )


@router.get("/from-wardrobe/{user_id}")
def get_wardrobe_outfits(
    user_id: int,
    occasion: Optional[str] = Query(default=None, description="Occasion filter"),
    season: Optional[str] = Query(default=None, description="Season filter"),
    budget_max: Optional[float] = Query(default=None, ge=0, description="Maximum purchase budget"),
    limit: int = Query(default=5, ge=1, le=20),
    x_internal_service_key: Optional[str] = Header(None),
):
    """
    Generate outfits anchored by clothing the user already owns in their Digital Wardrobe.
    Supports wardrobe-only looks as well as mixed looks (owned items + suggested catalog purchases).
    Requires internal service key authentication from Express gateway.
    """
    verify_internal_auth(x_internal_service_key)

    if user_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID provided.",
        )

    try:
        outfits = outfit_engine.generate_wardrobe_outfits(
            user_id=user_id,
            occasion=occasion,
            season=season,
            budget_max=budget_max,
            limit=limit,
        )
        return {
            "success": True,
            "type": "WARDROBE_FIRST_OUTFITS",
            "user_id": user_id,
            "count": len(outfits),
            "outfits": outfits,
        }
    except Exception as e:
        logger.error(f"Wardrobe outfit generation error for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate wardrobe-first outfits.",
        )


@router.get("/product/{product_id}")
def get_product_outfits(
    product_id: int,
    limit: int = Query(default=4, ge=1, le=10),
):
    """
    'Complete the Look': Generate outfits anchored by a specific catalog product.
    Ideal for product detail pages.
    """
    if product_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid product ID provided.",
        )

    try:
        outfits = outfit_engine.generate_product_outfits(
            product_id=product_id,
            limit=limit,
        )
        return {
            "success": True,
            "type": "PRODUCT_ANCHORED_OUTFITS",
            "query_product_id": product_id,
            "count": len(outfits),
            "outfits": outfits,
        }
    except Exception as e:
        logger.error(f"Product outfit generation error for product {product_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate product outfits.",
        )


@router.post("/generate")
def generate_custom_outfits(
    payload: GenerateOutfitRequest,
):
    """
    Generate custom outfits with dynamic criteria (occasion, season, budget, anchor products).
    """
    try:
        user_id = payload.user_id or 0
        outfits = outfit_engine.generate_personalized_outfits(
            user_id=user_id,
            occasion=payload.occasion,
            season=payload.season,
            budget_max=payload.budget_max,
            limit=payload.limit,
        )
        return {
            "success": True,
            "type": "CUSTOM_GENERATED_OUTFITS",
            "count": len(outfits),
            "outfits": outfits,
        }
    except Exception as e:
        logger.error(f"Custom outfit generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate custom outfits.",
        )


@router.post("/save")
def save_outfit(
    payload: SaveOutfitRequest,
    x_internal_service_key: Optional[str] = Header(None),
):
    """
    Save an outfit to the user's account in MySQL database.
    Requires internal service key authentication.
    """
    verify_internal_auth(x_internal_service_key)

    if not payload.items or len(payload.items) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An outfit must contain at least 2 clothing pieces.",
        )

    try:
        outfit_id = save_user_outfit(
            user_id=payload.user_id,
            outfit_name=payload.outfit_name,
            occasion=payload.occasion or "Casual",
            season=payload.season or "All Season",
            total_price=payload.total_price,
            description=payload.description or "",
            items=[it.model_dump() for it in payload.items],
        )
        return {
            "success": True,
            "message": "Outfit saved successfully.",
            "outfit_id": outfit_id,
        }
    except Exception as e:
        logger.error(f"Save outfit error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save outfit to database.",
        )


@router.get("/saved/{user_id}")
def get_user_saved_outfits(
    user_id: int,
    x_internal_service_key: Optional[str] = Header(None),
):
    """
    Retrieve all saved outfits for a specific user from MySQL.
    """
    verify_internal_auth(x_internal_service_key)

    if user_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID.",
        )

    try:
        outfits = fetch_saved_outfits(user_id)
        return {
            "success": True,
            "user_id": user_id,
            "count": len(outfits),
            "outfits": outfits,
        }
    except Exception as e:
        logger.error(f"Retrieve saved outfits error for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve saved outfits.",
        )


@router.delete("/saved/{user_id}/{outfit_id}")
def delete_saved_outfit(
    user_id: int,
    outfit_id: int,
    x_internal_service_key: Optional[str] = Header(None),
):
    """
    Delete a saved outfit belonging to the specified user.
    """
    verify_internal_auth(x_internal_service_key)

    try:
        deleted = delete_user_outfit(user_id=user_id, outfit_id=outfit_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Outfit not found or does not belong to the user.",
            )
        return {
            "success": True,
            "message": "Outfit deleted successfully.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete saved outfit error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete outfit.",
        )
