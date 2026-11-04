import logging
import numpy as np
from typing import List, Dict, Any, Optional

from app.config import settings
from app.embeddings import embedding_service
from app.vector_store import vector_store
from app.database import (
    fetch_user_profile,
    fetch_user_interactions,
    fetch_user_wardrobe_summary,
    fetch_popular_products,
    fetch_products_by_ids,
)

logger = logging.getLogger(__name__)

# Category Groups Taxonomy
CATEGORY_GROUPS: Dict[str, set] = {
    "tops": {"tops", "t-shirts", "t-shirt", "shirts", "shirt", "polos", "polo", "tanks", "tank", "tee"},
    "bottoms": {"bottoms", "pants", "track pants", "jeans", "trousers", "shorts", "skirts", "skirt", "leggings"},
    "outerwear": {"outerwear", "jackets", "jacket", "coats", "coat", "hoodies", "hoodie", "blazers", "blazer", "sweaters", "cardigan"},
    "footwear": {"footwear", "shoes", "sneakers", "boots", "sandals", "heels", "flats"},
    "accessories": {"accessories", "bags", "belts", "caps", "hats", "watches", "scarves"},
}

# Bi-directional Complementary Category Mappings
COMPLEMENTARY_MAPPINGS: Dict[str, List[str]] = {
    # Tops pair with Bottoms, Outerwear layers, and Footwear (NEVER with another Top)
    "tops": ["bottoms", "outerwear", "footwear"],
    # Bottoms pair with Tops, Outerwear, and Footwear (NEVER with another Bottom)
    "bottoms": ["tops", "outerwear", "footwear"],
    # Outerwear pairs with underlying Tops and Bottoms (NEVER with another Outerwear)
    "outerwear": ["tops", "bottoms"],
    # Footwear pairs with Bottoms and Tops
    "footwear": ["bottoms", "tops"],
    "accessories": ["tops", "outerwear", "bottoms"],
}


def get_category_group(category_name: str) -> str:
    """Map arbitrary category label to its canonical group."""
    cat = (category_name or "").lower().strip()
    for group, synonyms in CATEGORY_GROUPS.items():
        if cat in synonyms or any(s in cat for s in synonyms):
            return group
    return "other"


class RecommendationEngine:
    def __init__(self):
        pass

    def get_similar_products(
        self,
        product_id: int,
        limit: int = 8,
        category_id: Optional[int] = None,
        gender: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Find genuine product substitutes/alternatives that share category, gender, and style.
        Strict Rules:
        - Must belong to the same or closely related category group (Tops -> Tops, not Bottoms).
        - Excludes query product itself.
        - Respects gender compatibility (Men/Women/Unisex).
        - If catalog has few in-category items, returns fewer items rather than filling with unrelated categories.
        """
        # 1. Fetch query product details from MySQL
        target_prods = fetch_products_by_ids([product_id])
        if not target_prods:
            return []

        target = target_prods[0]
        target_group = get_category_group(target["category_name"])
        target_gender = (target.get("gender") or "").capitalize()
        target_brand = (target.get("brand_name") or "").lower()

        # 2. Retrieve query product embedding
        query_embedding = vector_store.get_product_embedding(product_id)
        if not query_embedding:
            doc_text = f"Product: {target['product_name']}. Brand: {target['brand_name']}. Category: {target['category_name']}. Description: {target['description']}"
            query_embedding = embedding_service.embed_text(doc_text)

        # 3. Query ChromaDB for candidate vectors
        where_filter = {}
        if category_id:
            where_filter["category_id"] = int(category_id)
        if gender:
            where_filter["gender"] = str(gender)

        hits = vector_store.query_similar(
            query_embedding=query_embedding,
            n_results=limit * 3,
            where_filter=where_filter if where_filter else None,
            exclude_product_id=product_id,
        )

        if not hits:
            return []

        # 4. Hydrate candidate products from MySQL
        hit_ids = [h["product_id"] for h in hits if h["product_id"] != product_id]
        mysql_prods = {p["product_id"]: p for p in fetch_products_by_ids(hit_ids)}

        results = []
        for h in hits:
            pid = h["product_id"]
            if pid not in mysql_prods or pid == product_id:
                continue

            p = mysql_prods[pid]
            cand_group = get_category_group(p["category_name"])
            cand_gender = (p.get("gender") or "").capitalize()
            cand_brand = (p.get("brand_name") or "").lower()

            # STRICT CATEGORY RELEVANCE:
            # A T-shirt/shirt must ONLY return other Tops. Unrelated categories (Bottoms, Outerwear) are excluded.
            if cand_group != target_group:
                continue

            # GENDER COMPATIBILITY:
            # Men matches Men or Unisex; Women matches Women or Unisex
            if target_gender == "Men" and cand_gender not in ("Men", "Unisex"):
                continue
            if target_gender == "Women" and cand_gender not in ("Women", "Unisex"):
                continue

            # Calculate enriched similarity score
            base_sim = float(h["similarity_score"])
            brand_bonus = 0.05 if cand_brand == target_brand else 0.0
            gender_bonus = 0.03 if cand_gender == target_gender else 0.0
            final_sim = round(min(1.0, base_sim + brand_bonus + gender_bonus), 4)

            # Informative similarity reason
            reason_parts = [f"Alternative in {p['category_name']}"]
            if cand_brand == target_brand:
                reason_parts.append(f"From {p['brand_name']}")
            if cand_gender == target_gender:
                reason_parts.append(f"{cand_gender}'s fit")
            reason_parts.append("Similar aesthetic")

            results.append({
                **p,
                "similarity_score": final_sim,
                "recommendation_score": final_sim,
                "reason": " • ".join(reason_parts),
                "recommendation_reason": " • ".join(reason_parts),
            })

            if len(results) >= limit:
                break

        # Sort by similarity score descending
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results

    def get_personalized_recommendations(
        self,
        user_id: int,
        limit: int = 10,
        include_above_budget: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Generate hyper-personalized recommendations combining:
        - Weighted interaction vectors (PURCHASE > CART > LIKE > VIEW)
        - Profile style and brand preferences
        - Strict DISLIKE exclusion
        - Strict Budget Enforcement (excludes over-budget items by default)
        - Cold-start graceful fallback
        """
        profile = fetch_user_profile(user_id)
        interactions = fetch_user_interactions(user_id)

        # 1. Identify strictly disliked products
        disliked_product_ids = {
            int(i["product_id"])
            for i in interactions
            if i.get("interaction_type") == "DISLIKE"
        }

        # 2. Extract profile attributes & budget constraints
        profile_text_parts = []
        preferred_brands = []
        budget_min = None
        budget_max = None

        if profile:
            if profile.get("style_preferences"):
                styles = profile["style_preferences"].replace(",", " ")
                profile_text_parts.append(f"Style: {styles}")
            if profile.get("preferred_brands"):
                preferred_brands = [
                    b.strip().lower() for b in profile["preferred_brands"].split(",") if b.strip()
                ]
                profile_text_parts.append(f"Brands: {', '.join(preferred_brands)}")
            if profile.get("body_type"):
                profile_text_parts.append(f"Body type: {profile['body_type']}")
            if profile.get("budget_range_min") is not None:
                budget_min = float(profile["budget_range_min"])
            if profile.get("budget_range_max") is not None:
                budget_max = float(profile["budget_range_max"])

        # 3. Collect positive interactions
        weighted_vectors: List[np.ndarray] = []
        weights: List[float] = []

        for inter in interactions:
            itype = inter.get("interaction_type", "VIEW")
            if itype == "DISLIKE":
                continue

            pid = int(inter["product_id"])
            emb = vector_store.get_product_embedding(pid)
            if emb:
                w = settings.INTERACTION_WEIGHTS.get(itype, 1.0)
                weighted_vectors.append(np.array(emb, dtype=np.float32))
                weights.append(w)

        # Incorporate profile preferences into vector space
        if profile_text_parts:
            profile_summary_text = "Fashion preference: " + ". ".join(profile_text_parts)
            profile_vec = np.array(
                embedding_service.embed_text(profile_summary_text), dtype=np.float32
            )
            weighted_vectors.append(profile_vec)
            weights.append(3.5)

        # 4. COLD START (User has no interactions and no profile text)
        if not weighted_vectors:
            popular = fetch_popular_products(
                limit=limit * 2, exclude_ids=list(disliked_product_ids)
            )
            # Apply budget filtering if budget_max specified
            if budget_max and budget_max > 0:
                popular = [p for p in popular if float(p["price"]) <= budget_max]

            return [
                {
                    **p,
                    "similarity_score": 0.5,
                    "recommendation_score": 0.5,
                    "reason": "Popular Style",
                    "recommendation_reason": "Trending fashion favorite across FashionIQ",
                }
                for p in popular[:limit]
            ]

        # 5. Compute normalized composite user preference vector
        normalized_weights = np.array(weights) / sum(weights)
        user_vector = np.zeros(embedding_service.dimension, dtype=np.float32)
        for vec, w in zip(weighted_vectors, normalized_weights):
            user_vector += vec * w

        norm = np.linalg.norm(user_vector)
        if norm > 0:
            user_vector = user_vector / norm

        # 6. Query ChromaDB with user's composite preference vector
        hits = vector_store.query_similar(
            query_embedding=user_vector.tolist(),
            n_results=limit * 4,
        )

        candidate_pids = [
            h["product_id"]
            for h in hits
            if h["product_id"] not in disliked_product_ids
        ]

        if not candidate_pids:
            return []

        # 7. Hydrate candidates from MySQL
        mysql_prods = {p["product_id"]: p for p in fetch_products_by_ids(candidate_pids)}

        # 8. Score, Filter by Budget, and Formulate Honest Reasons
        in_budget_ranked = []
        above_budget_alternatives = []

        for h in hits:
            pid = h["product_id"]
            if pid not in mysql_prods or pid in disliked_product_ids:
                continue

            p = mysql_prods[pid]
            base_score = float(h["similarity_score"])
            price = float(p["price"])
            brand_name = (p["brand_name"] or "").lower()

            reason_tags = []

            # Check strict budget constraints
            is_in_budget = True
            if budget_max and budget_max > 0:
                if price <= budget_max:
                    base_score += 0.10
                    reason_tags.append(f"Within your budget (₹{price:,.0f} ≤ ₹{budget_max:,.0f})")
                else:
                    is_in_budget = False

            # Brand affinity
            if preferred_brands and any(b in brand_name for b in preferred_brands):
                base_score += 0.15
                reason_tags.append(f"From your preferred brand {p['brand_name']}")

            # Style alignment
            if not reason_tags and is_in_budget:
                reason_tags.append("Matches your style preferences")

            final_score = round(min(1.0, max(0.0, base_score)), 4)
            reason_text = " • ".join(reason_tags)

            item = {
                **p,
                "similarity_score": final_score,
                "recommendation_score": final_score,
                "reason": reason_text if reason_text else "Recommended piece",
                "recommendation_reason": reason_text if reason_text else "Recommended piece",
            }

            if is_in_budget:
                in_budget_ranked.append(item)
            else:
                # Label clearly as an over-budget alternative
                item["outside_budget"] = True
                item["reason"] = f"Style alternative (Exceeds budget of ₹{budget_max:,.0f})"
                item["recommendation_reason"] = item["reason"]
                above_budget_alternatives.append(item)

        # Sort in-budget items by recommendation score descending
        in_budget_ranked.sort(key=lambda x: x["recommendation_score"], reverse=True)

        # STRICT BUDGET GUARANTEE:
        # By default, return ONLY items that strictly comply with the user's budget.
        # If there are fewer products within budget (e.g. 1 item), return only those items!
        if budget_max and budget_max > 0:
            if include_above_budget and len(in_budget_ranked) < limit:
                # Expose above-budget alternatives only if explicitly requested, clearly labeled
                above_budget_alternatives.sort(key=lambda x: x["recommendation_score"], reverse=True)
                combined = in_budget_ranked + above_budget_alternatives
                return combined[:limit]
            return in_budget_ranked[:limit]

        return in_budget_ranked[:limit]

    def get_wardrobe_recommendations(
        self, user_id: int, limit: int = 8
    ) -> List[Dict[str, Any]]:
        """
        Recommend pieces that complement items already in the user's Digital Wardrobe.
        Strict Rules:
        - Tops pair with Bottoms, Outerwear, Footwear (NEVER with another Top).
        - Bottoms pair with Tops, Outerwear, Footwear (NEVER with another Bottom).
        - Outerwear pairs with underlying Tops, Bottoms (NEVER with another Outerwear).
        - Products already owned in user's wardrobe are strictly excluded.
        - Returns fewer items if catalog has limited cross-category complements.
        """
        wardrobe_items = fetch_user_wardrobe_summary(user_id)

        # Cold Start: Wardrobe is empty
        if not wardrobe_items:
            popular = fetch_popular_products(limit=limit)
            return [
                {
                    **p,
                    "similarity_score": 0.5,
                    "recommendation_score": 0.5,
                    "reason": "Wardrobe Essential",
                    "recommendation_reason": "Essential wardrobe foundation piece to start your collection",
                }
                for p in popular
            ]

        owned_product_ids = {int(item["product_id"]) for item in wardrobe_items}

        # Analyze categories of owned pieces
        owned_pieces_info = []
        for item in wardrobe_items[:6]:
            cat = item.get("category_name", "")
            cat_group = get_category_group(cat)
            pname = item.get("product_name", "")
            color = item.get("color", "")
            season = item.get("season", "All Season")
            owned_pieces_info.append({
                "product_name": pname,
                "color": color,
                "category_name": cat,
                "category_group": cat_group,
                "season": season,
                "complementary_groups": COMPLEMENTARY_MAPPINGS.get(cat_group, ["bottoms", "tops", "outerwear"]),
            })

        # All allowed complement groups across owned pieces
        all_allowed_complement_groups = set()
        for piece in owned_pieces_info:
            all_allowed_complement_groups.update(piece["complementary_groups"])

        # Construct styling query targeting needed complement categories
        query_parts = []
        for p_info in owned_pieces_info:
            comp_str = ", ".join(p_info["complementary_groups"])
            query_parts.append(
                f"Style complement for {p_info['color']} {p_info['product_name']} ({p_info['category_name']}). "
                f"Needs matching: {comp_str}."
            )

        query_text = " ".join(query_parts)
        query_emb = embedding_service.embed_text(query_text)

        # Query ChromaDB for candidate items
        hits = vector_store.query_similar(
            query_embedding=query_emb,
            n_results=limit * 4,
        )

        # 1. Filter out already-owned products
        eligible_hits = [h for h in hits if h["product_id"] not in owned_product_ids]
        if not eligible_hits:
            return []

        # 2. Hydrate candidates from MySQL
        candidate_pids = [h["product_id"] for h in eligible_hits]
        mysql_prods = {p["product_id"]: p for p in fetch_products_by_ids(candidate_pids)}

        # 3. Apply Strict Category Compatibility:
        # A candidate is valid ONLY if its category group complements an anchor piece
        # AND is NOT the same category group as the anchor piece!
        results = []
        for h in eligible_hits:
            pid = h["product_id"]
            if pid not in mysql_prods or pid in owned_product_ids:
                continue

            p = mysql_prods[pid]
            cand_group = get_category_group(p["category_name"])

            # Check compatibility against each owned piece
            matched_anchor = None
            for p_info in owned_pieces_info:
                # Cannot complement the same category group (e.g. Tops cannot complement Tops)
                if cand_group == p_info["category_group"]:
                    continue

                if cand_group in p_info["complementary_groups"]:
                    matched_anchor = p_info
                    break

            # If this candidate does not complement any owned piece's category, EXCLUDE it
            if not matched_anchor:
                continue

            # Formulate explicit, honest recommendation reason
            anchor_desc = f"{matched_anchor['color']} {matched_anchor['product_name']}" if matched_anchor['color'] else matched_anchor['product_name']
            if cand_group == "outerwear":
                reason_str = f"Outerwear layer to complement your {anchor_desc} ({matched_anchor['category_name']})"
            elif cand_group == "bottoms":
                reason_str = f"Bottoms piece to pair with your {anchor_desc} ({matched_anchor['category_name']})"
            elif cand_group == "tops":
                reason_str = f"Top piece to match with your {anchor_desc} ({matched_anchor['category_name']})"
            else:
                reason_str = f"Complements your {anchor_desc} in Digital Wardrobe"

            results.append({
                **p,
                "similarity_score": h["similarity_score"],
                "recommendation_score": h["similarity_score"],
                "reason": reason_str,
                "recommendation_reason": reason_str,
            })

            if len(results) >= limit:
                break

        # Sort by similarity score
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results


recommender = RecommendationEngine()
