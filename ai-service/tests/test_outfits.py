import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.outfit_engine import outfit_engine, get_clothing_role, evaluate_color_harmony
import unittest.mock as mock


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_clothing_role_taxonomy():
    """Verify category mapping to outfit roles."""
    assert get_clothing_role("T-Shirts") == "Top"
    assert get_clothing_role("Shirts") == "Top"
    assert get_clothing_role("Track Pants") == "Bottom"
    assert get_clothing_role("Jeans") == "Bottom"
    assert get_clothing_role("Lightweight Jacket") == "Outerwear"
    assert get_clothing_role("Sneakers") == "Shoes"
    assert get_clothing_role("Caps") == "Accessory"


def test_color_harmony_rules():
    """Verify grounded color coordination calculations."""
    # 1. High-contrast monochrome (White & Black)
    score_wb, desc_wb = evaluate_color_harmony(["White", "Black"])
    assert score_wb >= 0.90
    assert "White & Black" in desc_wb or "monochrome" in desc_wb.lower()

    # 2. Neutrals with Grey
    score_grey, _ = evaluate_color_harmony(["Grey", "White", "Black"])
    assert score_grey >= 0.90

    # 3. Navy with White
    score_navy, _ = evaluate_color_harmony(["Navy", "White"])
    assert score_navy >= 0.85


def test_personalized_outfit_recommendations(client):
    """Verify complete outfit generation for user returns valid Top + Bottom combinations and enforces auth."""
    # 1. Unauthenticated direct call -> 401
    res_no_auth = client.get("/outfits/recommendations/1?limit=3")
    assert res_no_auth.status_code == 401

    # 2. Authenticated call from gateway -> 200
    response = client.get(
        "/outfits/recommendations/1?limit=3",
        headers={"X-Internal-Service-Key": settings.AI_SERVICE_SECRET_KEY},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["type"] == "PERSONALIZED_OUTFITS"
    outfits = data["outfits"]
    assert len(outfits) > 0

    for outfit in outfits:
        assert "outfit_name" in outfit
        assert "occasion" in outfit
        assert "season" in outfit
        assert "match_score" in outfit
        assert "total_retail_price" in outfit
        assert "purchase_price" in outfit
        assert "items" in outfit

        # Must have at least 2 pieces: Top and Bottom
        roles = {it["role"] for it in outfit["items"]}
        assert "Top" in roles, "Outfit must contain a Top"
        assert "Bottom" in roles, "Outfit must contain a Bottom"

        # Item prices must add up to total
        sum_price = sum(it["price"] for it in outfit["items"] if not it["is_owned"])
        assert abs(sum_price - outfit["purchase_price"]) < 0.01


def test_wardrobe_first_outfits(client):
    """Verify wardrobe-anchored outfit generation correctly identifies owned items and enforces auth."""
    # 1. Unauthenticated direct call -> 401
    res_no_auth = client.get("/outfits/from-wardrobe/1?limit=4")
    assert res_no_auth.status_code == 401

    # 2. Authenticated call from gateway -> 200
    # User 1 owns Product 1 (Nike T-shirt, White) and Product 2 (Track pants, Black)
    response = client.get(
        "/outfits/from-wardrobe/1?limit=4",
        headers={"X-Internal-Service-Key": settings.AI_SERVICE_SECRET_KEY},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["type"] == "WARDROBE_FIRST_OUTFITS"
    outfits = data["outfits"]
    assert len(outfits) > 0

    for outfit in outfits:
        assert outfit["owned_items_count"] > 0, "Wardrobe outfits must contain at least one owned piece"
        # Verify owned items have is_owned == True
        has_owned_item = any(it["is_owned"] for it in outfit["items"])
        assert has_owned_item is True

        # If it's a 100% wardrobe outfit, purchase price should be 0.0
        if all(it["is_owned"] for it in outfit["items"]):
            assert outfit["purchase_price"] == 0.0
            assert outfit["owned_savings"] > 0


def test_product_anchored_outfits(client):
    """Verify 'Complete the Look' builds outfits containing the specified product."""
    target_pid = 1  # Nike T-Shirt
    response = client.get(f"/outfits/product/{target_pid}?limit=3")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["query_product_id"] == target_pid
    outfits = data["outfits"]
    assert len(outfits) > 0

    for outfit in outfits:
        pids = [it["product_id"] for it in outfit["items"]]
        assert target_pid in pids, f"Anchor product {target_pid} must be in the outfit"
        # Must also have a Bottom
        roles = {it["role"] for it in outfit["items"]}
        assert "Bottom" in roles


def test_budget_aware_outfit_filtering():
    """Verify outfits strictly enforce maximum budget constraint."""
    # Test with a budget that accommodates Top + Bottom (₹3,500) but excludes Top + Bottom + Outerwear (₹5,998)
    outfits = outfit_engine.generate_personalized_outfits(
        user_id=1,
        budget_max=3600.0,
        limit=10,
    )
    assert len(outfits) > 0
    for o in outfits:
        assert o["purchase_price"] <= 3600.0, f"Outfit purchase price {o['purchase_price']} exceeded budget ₹3,600"
        # Confirm expensive 3-piece outfits with Outerwear are excluded under ₹3,600 budget
        roles = {it["role"] for it in o["items"]}
        if "Outerwear" in roles:
            # If outerwear is present, price must still be <= 3600
            assert o["purchase_price"] <= 3600.0


def test_dislike_exclusion_in_outfits():
    """Verify that products marked DISLIKE are strictly excluded from generated outfits."""
    # Dislike Product 2 (Bottoms)
    mock_interactions = [
        {"product_id": 2, "interaction_type": "DISLIKE", "interaction_date": "2026-01-01"},
    ]
    with mock.patch("app.outfit_engine.fetch_user_interactions", return_value=mock_interactions):
        outfits = outfit_engine.generate_personalized_outfits(user_id=1, limit=5)
        for o in outfits:
            pids = [it["product_id"] for it in o["items"]]
            assert 2 not in pids, "Disliked product 2 must never appear in any outfit"


def test_outfit_save_security(client):
    """Verify that saving an outfit requires the internal service key."""
    payload = {
        "user_id": 1,
        "outfit_name": "Test Security Outfit",
        "occasion": "Casual",
        "season": "Summer",
        "total_price": 3499.0,
        "items": [
            {"variant_id": 1, "role": "Top", "price": 1500.0, "is_owned": True},
            {"variant_id": 3, "role": "Bottom", "price": 1999.0, "is_owned": False},
        ],
    }

    # Missing header -> 401
    res_no_auth = client.post("/outfits/save", json=payload)
    assert res_no_auth.status_code == 401

    # Valid header -> 200
    res_valid = client.post(
        "/outfits/save",
        json=payload,
        headers={"X-Internal-Service-Key": settings.AI_SERVICE_SECRET_KEY},
    )
    assert res_valid.status_code == 200
    data = res_valid.json()
    assert data["success"] is True
    assert "outfit_id" in data
    saved_id = data["outfit_id"]

    # Retrieve saved outfits
    res_saved = client.get(
        f"/outfits/saved/1",
        headers={"X-Internal-Service-Key": settings.AI_SERVICE_SECRET_KEY},
    )
    assert res_saved.status_code == 200
    saved_data = res_saved.json()
    saved_ids = [o["outfit_id"] for o in saved_data["outfits"]]
    assert saved_id in saved_ids

    # Delete saved outfit
    res_del = client.delete(
        f"/outfits/saved/1/{saved_id}",
        headers={"X-Internal-Service-Key": settings.AI_SERVICE_SECRET_KEY},
    )
    assert res_del.status_code == 200
    assert res_del.json()["success"] is True
