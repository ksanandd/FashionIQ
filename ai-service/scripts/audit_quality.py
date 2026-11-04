import json
import logging
from app.recommender import recommender
from app.vector_store import vector_store
from app.embeddings import embedding_service
from app.database import fetch_all_products_for_indexing, fetch_user_profile, fetch_user_interactions

logging.basicConfig(level=logging.INFO)

def run_quality_audit():
    print("======================================================================")
    print("FASHIONIQ PHASE 6: RECOMMENDATION QUALITY & RELEVANCE AUDIT")
    print("======================================================================\n")

    # 1. Catalog Inspection
    products = fetch_all_products_for_indexing()
    print(f"Loaded {len(products)} products from MySQL catalog:")
    for p in products:
        print(f"  ID: {p['product_id']:<2} | {p['product_name']:<25} | {p['category_name']:<10} | {p['brand_name']:<10} | Rs {p['price']}")
    print()

    # 2. Similar Products Test
    print("--- 1. SIMILAR PRODUCTS QUALITY TEST ---")
    # Reference: Product 1 (Nike Dri-FIT T-Shirt, Tops, Rs 1500)
    sim1 = recommender.get_similar_products(product_id=1, limit=5)
    print(f"\nAI Similar Products for Product #1 ('Nike Dri-FIT T-Shirt'):")
    assert all(r['product_id'] != 1 for r in sim1), "FAIL: Target product #1 was not excluded!"
    for r in sim1:
        print(f"  -> ID: {r['product_id']:<2} | {r['product_name']:<25} | Match: {r['similarity_score']:.2%} | Reason: {r['reason']}")

    # Reference: Product 3 (Zara Casual Shirt, Tops, Rs 2299)
    sim3 = recommender.get_similar_products(product_id=3, limit=5)
    print(f"\nAI Similar Products for Product #3 ('Zara Casual Shirt'):")
    assert all(r['product_id'] != 3 for r in sim3), "FAIL: Target product #3 was not excluded!"
    for r in sim3:
        print(f"  -> ID: {r['product_id']:<2} | {r['product_name']:<25} | Match: {r['similarity_score']:.2%} | Reason: {r['reason']}")

    # 3. User Personalized Recommendations Test
    print("\n--- 2. USER PERSONALIZED RECOMMENDATIONS TEST ---")
    user_id = 1
    profile = fetch_user_profile(user_id)
    interactions = fetch_user_interactions(user_id)
    print(f"User #{user_id} Profile: {profile}")
    print(f"User #{user_id} Interactions count: {len(interactions)}")

    recs_user1 = recommender.get_personalized_recommendations(user_id=1, limit=4)
    print(f"\nAI Personalized Recommendations for User #{user_id}:")
    for r in recs_user1:
        print(f"  -> ID: {r['product_id']:<2} | {r['product_name']:<25} | Score: {r['recommendation_score']:.2f} | Reason: {r['reason']}")

    # 4. Strict DISLIKE Exclusion Test
    print("\n--- 3. STRICT DISLIKE EXCLUSION TEST ---")
    import unittest.mock as mock
    # Mock user disliking product 1 and 2
    mock_dislike_interactions = [
        {"product_id": 1, "interaction_type": "DISLIKE", "interaction_date": "2026-01-01"},
        {"product_id": 2, "interaction_type": "DISLIKE", "interaction_date": "2026-01-01"},
        {"product_id": 3, "interaction_type": "LIKE", "interaction_date": "2026-01-01"},
    ]
    with mock.patch("app.recommender.fetch_user_interactions", return_value=mock_dislike_interactions):
        recs_dislike = recommender.get_personalized_recommendations(user_id=1, limit=5)
        disliked_ids = [r['product_id'] for r in recs_dislike]
        print(f"User disliked products [1, 2]. Recommended IDs: {disliked_ids}")
        assert 1 not in disliked_ids, "FAIL: Disliked product 1 appeared in recommendations!"
        assert 2 not in disliked_ids, "FAIL: Disliked product 2 appeared in recommendations!"
        print("  [SUCCESS] Disliked products 1 and 2 are strictly excluded.")

    # 5. Budget Constraints & Brand Affinity Test
    print("\n--- 4. BUDGET FILTERING & BRAND AFFINITY TEST ---")
    mock_profile_budget = {
        "user_id": 1,
        "style_preferences": "Casual, Sporty",
        "budget_range_min": 1000,
        "budget_range_max": 1800, # Below 1800 favors product 1 (Rs 1500)
        "preferred_brands": "Nike",
        "body_type": "Athletic",
    }
    with mock.patch("app.recommender.fetch_user_profile", return_value=mock_profile_budget):
        recs_budget = recommender.get_personalized_recommendations(user_id=1, limit=4)
        print("Personalized recommendations for user with budget max Rs 1800 and preferred brand 'Nike':")
        for r in recs_budget:
            print(f"  -> ID: {r['product_id']:<2} | {r['product_name']:<25} | Rs {r['price']} | Reason: {r['reason']}")
        assert recs_budget[0]['product_id'] == 1, "Expected Nike T-shirt to rank #1 due to brand affinity and budget match!"
        print("  [SUCCESS] Product #1 ranked first due to budget compliance (Rs 1500 <= 1800) and brand affinity (Nike).")

    # 6. Wardrobe Complementary Recommendations Test
    print("\n--- 5. WARDROBE COMPLEMENTARY TEST ---")
    recs_wardrobe = recommender.get_wardrobe_recommendations(user_id=1, limit=4)
    print(f"AI Wardrobe Complementary Recommendations for User #1:")
    for r in recs_wardrobe:
        print(f"  -> ID: {r['product_id']:<2} | {r['product_name']:<25} | Category: {r['category_name']:<10} | Reason: {r['reason']}")

    # 7. Cold-Start Test
    print("\n--- 6. COLD-START TEST (User with zero history) ---")
    recs_cold = recommender.get_personalized_recommendations(user_id=99999, limit=3)
    print(f"Cold-Start Recommendations for unknown User #99999:")
    for r in recs_cold:
        print(f"  -> ID: {r['product_id']:<2} | {r['product_name']:<25} | Reason: {r['reason']}")
    assert len(recs_cold) > 0, "Cold start failed to return recommendations"
    print("  [SUCCESS] Cold-start returns gracefully without crashing.")

    # 8. Comparison with SQL Fallback
    print("\n--- 7. COMPARISON: AI SIMILARITY VS SQL FALLBACK ---")
    from app.database import get_db_connection
    conn = get_db_connection()
    with conn.cursor() as cur:
        # SQL fallback logic for similar products to product 1
        cur.execute("""
            SELECT p.product_id, p.product_name, c.category_name, b.brand_name, p.price
            FROM product p
            JOIN category c ON p.category_id = c.category_id
            JOIN brand b ON p.brand_id = b.brand_id
            WHERE p.product_id != 1
            ORDER BY p.product_id DESC
        """)
        sql_similar = cur.fetchall()
    conn.close()

    print(f"SQL Fallback for Product #1 (Categorical / ID sort):")
    for r in sql_similar:
        print(f"  [SQL FALLBACK] ID: {r['product_id']} | {r['product_name']} | {r['category_name']} | Rs {r['price']}")

    print(f"\nAI ChromaDB Vector Results for Product #1 (Dense Cosine Similarity):")
    for r in sim1:
        print(f"  [AI CHROMADB]  ID: {r['product_id']} | {r['product_name']} | Similarity: {r['similarity_score']:.4f}")

    print("\n======================================================================")
    print("ALL RECOMMENDATION QUALITY AUDIT CHECKS COMPLETED SUCCESSFULLY")
    print("======================================================================")

if __name__ == "__main__":
    run_quality_audit()
