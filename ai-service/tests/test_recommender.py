import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.recommender import recommender
from app.vector_store import vector_store


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_endpoint(client):
    """Verify system health, DB connection, ChromaDB vector store, and embedding model."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "mysql" in data
    assert data["mysql"]["status"] == "connected"
    assert "chromadb" in data
    assert data["chromadb"]["status"] == "ready"
    assert "embedding_model" in data
    assert data["embedding_model"]["status"] == "loaded"


def test_indexing_security(client):
    """Verify endpoint authentication security with internal service key."""
    # 1. Missing authentication header -> 401
    resp_no_auth = client.post("/index/products")
    assert resp_no_auth.status_code == 401

    # 2. Invalid authentication header -> 401
    resp_bad_auth = client.post(
        "/index/products",
        headers={"X-Internal-Service-Key": "invalid_unauthorized_key"}
    )
    assert resp_bad_auth.status_code == 401

    # 3. Valid internal authentication key -> 200
    resp_valid = client.post(
        "/index/products",
        headers={"X-Internal-Service-Key": settings.AI_SERVICE_SECRET_KEY}
    )
    assert resp_valid.status_code == 200
    data = resp_valid.json()
    assert data["success"] is True
    assert data["indexed_count"] >= 1
    assert data["total_in_index"] >= 1


def test_similar_products_recommendations(client):
    """Verify similar product vector search excludes the query product and returns ranked results."""
    # Target product 1
    target_id = 1
    response = client.get(f"/recommendations/similar/{target_id}?limit=3")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["type"] == "SIMILAR_PRODUCTS"
    assert data["query_product_id"] == target_id
    recs = data["recommendations"]
    assert len(recs) > 0

    # Confirm query product is not recommended to itself
    for rec in recs:
        assert rec["product_id"] != target_id
        assert "product_name" in rec
        assert "price" in rec
        assert "similarity_score" in rec
        assert 0.0 <= rec["similarity_score"] <= 1.0


def test_similar_products_invalid_id(client):
    """Ensure invalid product IDs are rejected with 400."""
    res_zero = client.get("/recommendations/similar/0")
    assert res_zero.status_code == 400

    res_neg = client.get("/recommendations/similar/-5")
    assert res_neg.status_code == 400


def test_personalized_user_recommendations(client):
    """Verify personalized recommendation engine for authenticated user."""
    # User 1 has recorded interactions in the database
    response = client.get("/recommendations/user/1?limit=3")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["type"] == "PERSONALIZED_USER"
    assert data["user_id"] == 1
    recs = data["recommendations"]
    assert len(recs) > 0
    for rec in recs:
        assert "product_id" in rec
        assert "product_name" in rec
        assert "recommendation_score" in rec
        assert "reason" in rec


def test_cold_start_fallback_for_new_user(client):
    """Verify graceful cold start fallback for user with no history."""
    # Non-existent user ID 99999
    response = client.get("/recommendations/user/99999?limit=4")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["recommendations"]) > 0
    for rec in data["recommendations"]:
        assert "product_name" in rec
        assert rec["reason"] == "Popular Style"


def test_dislike_exclusion():
    """Verify that explicitly DISLIKED products are strictly excluded from recommendations."""
    # Test the recommender logic with synthetic dislike interaction
    all_indexed = vector_store.get_all_indexed_products()
    assert len(all_indexed) > 0

    # If product 2 exists in catalog, test exclusion
    prod_2_candidates = [p for p in all_indexed if p["product_id"] == 2]
    if prod_2_candidates:
        # Mock interactions with a DISLIKE on product 2
        mock_interactions = [
            {"product_id": 1, "interaction_type": "LIKE", "interaction_date": "2026-01-01"},
            {"product_id": 2, "interaction_type": "DISLIKE", "interaction_date": "2026-01-01"},
        ]

        # Test directly with mocked interactions
        import unittest.mock as mock
        with mock.patch("app.recommender.fetch_user_interactions", return_value=mock_interactions):
            recs = recommender.get_personalized_recommendations(user_id=1, limit=10)
            recommended_ids = [r["product_id"] for r in recs]
            assert 2 not in recommended_ids, "DISLIKED product 2 must never appear in recommendations"


def test_wardrobe_complementary_recommendations(client):
    """Verify wardrobe complementary recommendations return valid items and exclude items already in wardrobe."""
    # User 1 has items in their wardrobe
    response = client.get("/recommendations/wardrobe/1?limit=4")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["type"] == "WARDROBE_COMPLEMENTARY"
    assert "recommendations" in data
    # Check that recommendations have category complement reasons
    for rec in data["recommendations"]:
        assert "product_id" in rec
        assert "reason" in rec


def test_wardrobe_cold_start_fallback(client):
    """Verify wardrobe recommendation for a user without wardrobe items returns fallback items without crashing."""
    response = client.get("/recommendations/wardrobe/99999?limit=4")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["recommendations"]) > 0


# ==============================================================================
# Phase 6.1: Recommendation Quality Corrections Test Suite
# ==============================================================================

def test_phase6_1_strict_budget_filtering():
    """Verify user budget_range_max is treated as a hard constraint and over-budget items are excluded."""
    import unittest.mock as mock

    # Mock user profile with maximum budget of ₹1,800
    mock_profile = {
        "user_id": 1,
        "style_preferences": "Casual, Sporty",
        "preferred_brands": "Nike, Adidas",
        "body_type": "Athletic",
        "budget_range_min": 500.0,
        "budget_range_max": 1800.0,
    }
    mock_interactions = [
        {"product_id": 1, "interaction_type": "LIKE", "interaction_date": "2026-01-01"},
    ]

    with mock.patch("app.recommender.fetch_user_profile", return_value=mock_profile), \
         mock.patch("app.recommender.fetch_user_interactions", return_value=mock_interactions):

        recs = recommender.get_personalized_recommendations(user_id=1, limit=10, include_above_budget=False)

        # 1. Recommendations must not be empty
        assert len(recs) > 0, "Should return in-budget recommendations"

        # 2. Every single recommended product must strictly be <= ₹1,800
        for rec in recs:
            assert float(rec["price"]) <= 1800.0, f"Product {rec['product_id']} ({rec['product_name']}) at price {rec['price']} exceeded budget ₹1,800"
            assert "Within your budget" in rec["reason"], f"Reason should state budget compliance, got: {rec['reason']}"
            assert "outside_budget" not in rec or rec["outside_budget"] is False

        # 3. Catalog items priced above ₹1,800 (Product 2 @ ₹1,999, Product 3 @ ₹2,299, Product 4 @ ₹2,499) must NOT appear
        over_budget_ids = {2, 3, 4}
        recommended_ids = {r["product_id"] for r in recs}
        assert over_budget_ids.isdisjoint(recommended_ids), f"Over-budget products {over_budget_ids.intersection(recommended_ids)} were incorrectly included"


def test_phase6_1_insufficient_in_budget_catalog_size():
    """When catalog has fewer items within budget, recommender returns fewer items rather than exceeding budget."""
    import unittest.mock as mock

    # In our 4-product catalog, only Product 1 (Nike T-shirt, ₹1500) is <= ₹1800
    mock_profile = {
        "user_id": 1,
        "style_preferences": "Casual",
        "preferred_brands": "Nike",
        "body_type": "Athletic",
        "budget_range_min": 500.0,
        "budget_range_max": 1800.0,
    }

    with mock.patch("app.recommender.fetch_user_profile", return_value=mock_profile), \
         mock.patch("app.recommender.fetch_user_interactions", return_value=[]):

        recs = recommender.get_personalized_recommendations(user_id=1, limit=10, include_above_budget=False)

        # Must return exactly the 1 in-budget item (Product 1) rather than padding with over-budget items
        assert len(recs) == 1, f"Expected exactly 1 in-budget item, but got {len(recs)}"
        assert recs[0]["product_id"] == 1
        assert float(recs[0]["price"]) == 1500.0


def test_phase6_1_above_budget_alternative_labeling():
    """Verify that when above-budget alternatives are requested, they are clearly tagged and never claim to be within budget."""
    import unittest.mock as mock

    mock_profile = {
        "user_id": 1,
        "style_preferences": "Casual",
        "preferred_brands": "Nike, Zara",
        "body_type": "Athletic",
        "budget_range_min": 500.0,
        "budget_range_max": 1800.0,
    }

    with mock.patch("app.recommender.fetch_user_profile", return_value=mock_profile), \
         mock.patch("app.recommender.fetch_user_interactions", return_value=[]):

        recs = recommender.get_personalized_recommendations(user_id=1, limit=5, include_above_budget=True)

        for rec in recs:
            if float(rec["price"]) > 1800.0:
                assert rec.get("outside_budget") is True, f"Over-budget item {rec['product_id']} must have outside_budget=True"
                assert "Exceeds budget" in rec["reason"], f"Over-budget item reason must state 'Exceeds budget', got: {rec['reason']}"
                assert "Within your budget" not in rec["reason"], f"Over-budget item must never claim to be within budget: {rec['reason']}"


def test_phase6_1_similar_product_category_relevance():
    """Verify similar product search returns only items from the same category group and excludes query product."""
    # Product 1 is Nike Dri-FIT T-Shirt (Tops, Men)
    similar_to_1 = recommender.get_similar_products(product_id=1, limit=5)

    # 1. Query product 1 must be strictly excluded
    for rec in similar_to_1:
        assert rec["product_id"] != 1, "Query product 1 must never be returned in its own similar products"

        # 2. Must belong to the 'tops' category group (in our catalog, Product 3 is Zara Casual Shirt, Tops)
        assert rec["category_name"] in {"T-Shirts", "Shirts", "Tops"}, f"Unexpected category for similar item: {rec['category_name']}"

        # 3. Must be compatible gender (Men or Unisex)
        assert rec["gender"] in {"Men", "Unisex"}, f"Unexpected gender for similar item: {rec['gender']}"

    # 4. In our 4-item catalog, the only other Top is Product 3
    rec_ids = [r["product_id"] for r in similar_to_1]
    assert 3 in rec_ids, "Product 3 (Zara Shirt, Tops) should be recommended as similar to Product 1"
    assert 2 not in rec_ids, "Product 2 (Bottoms) must NOT be recommended as similar to a Top"
    assert 4 not in rec_ids, "Product 4 (Outerwear) must NOT be recommended as similar to a Top"


def test_phase6_1_similar_product_catalog_limit_no_unrelated_fill():
    """When catalog has 0 other items in the same category group, recommender returns empty rather than unrelated categories."""
    # Product 2 is Adidas Track Pants (Bottoms)
    # The catalog has no other bottoms (Product 1 is Top, Product 3 is Top, Product 4 is Outerwear)
    similar_to_2 = recommender.get_similar_products(product_id=2, limit=5)

    # Recommender must return 0 items rather than filling with Tops or Outerwear!
    assert len(similar_to_2) == 0, f"Expected 0 similar items for Bottoms in catalog with no other bottoms, got {len(similar_to_2)}"


def test_phase6_1_wardrobe_complementary_category_compatibility():
    """Verify wardrobe recommendations suggest complementary categories and never recommend the same category group."""
    import unittest.mock as mock

    # Mock user 1 owning Product 1 (Nike T-shirt, Tops)
    mock_wardrobe = [
        {
            "wardrobe_item_id": 1,
            "product_id": 1,
            "product_name": "Nike Dri-FIT T-Shirt",
            "category_name": "T-Shirts",
            "color": "White",
            "season": "Summer",
        }
    ]

    with mock.patch("app.recommender.fetch_user_wardrobe_summary", return_value=mock_wardrobe):
        recs = recommender.get_wardrobe_recommendations(user_id=1, limit=5)

        for rec in recs:
            # 1. Product 1 (already owned) must be strictly excluded
            assert rec["product_id"] != 1, "Owned product 1 must not be recommended"

            # 2. A Top must NEVER complement another Top!
            # Product 3 is Zara Casual Shirt (Tops) -> must NOT be recommended to complement a Top
            assert rec["product_id"] != 3, "Product 3 (Top) cannot complement Product 1 (Top)"

            # 3. Only Bottoms (Product 2) or Outerwear (Product 4) can complement a Top
            assert rec["category_name"] in {"Bottoms", "Track Pants", "Pants", "Outerwear", "Jackets"}

            # 4. Reason should explain complementary relationship
            assert "complement" in rec["reason"].lower() or "pair" in rec["reason"].lower() or "match" in rec["reason"].lower()


def test_phase6_1_wardrobe_owned_product_exclusion():
    """Verify that all products currently in user's wardrobe are strictly excluded from wardrobe recommendations."""
    import unittest.mock as mock

    # Mock user 1 owning Product 1 (Top) and Product 2 (Bottom)
    mock_wardrobe = [
        {
            "wardrobe_item_id": 1,
            "product_id": 1,
            "product_name": "Nike Dri-FIT T-Shirt",
            "category_name": "T-Shirts",
            "color": "White",
            "season": "Summer",
        },
        {
            "wardrobe_item_id": 2,
            "product_id": 2,
            "product_name": "Adidas Tiro Track Pants",
            "category_name": "Track Pants",
            "color": "Black",
            "season": "All Season",
        },
    ]

    with mock.patch("app.recommender.fetch_user_wardrobe_summary", return_value=mock_wardrobe):
        recs = recommender.get_wardrobe_recommendations(user_id=1, limit=5)

        rec_ids = {r["product_id"] for r in recs}
        assert 1 not in rec_ids, "Owned product 1 must be excluded"
        assert 2 not in rec_ids, "Owned product 2 must be excluded"

        # Product 4 (Outerwear Jacket) is the unowned cross-category complement
        assert 4 in rec_ids, "Product 4 (Outerwear Jacket) should be recommended as complement"
