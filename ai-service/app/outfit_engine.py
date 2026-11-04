import logging
from typing import List, Dict, Any, Optional, Set, Tuple
from app.config import settings
from app.database import (
    fetch_user_profile,
    fetch_user_interactions,
    fetch_user_wardrobe_summary,
    fetch_catalog_products_with_variants,
    fetch_products_by_ids,
)

logger = logging.getLogger(__name__)

# ==============================================================================
# 1. Clothing Role Taxonomy
# ==============================================================================
ROLE_TAXONOMY: Dict[str, Set[str]] = {
    "Top": {"tops", "t-shirts", "t-shirt", "shirts", "shirt", "polos", "polo", "tanks", "tank", "tee", "crop top"},
    "Bottom": {"bottoms", "pants", "track pants", "jeans", "trousers", "shorts", "skirts", "skirt", "leggings", "joggers"},
    "Outerwear": {"outerwear", "jackets", "jacket", "coats", "coat", "hoodies", "hoodie", "blazers", "blazer", "sweaters", "cardigan"},
    "Shoes": {"footwear", "shoes", "sneakers", "boots", "sandals", "heels", "flats", "loafers"},
    "Accessory": {"accessories", "bags", "belts", "caps", "hats", "watches", "scarves", "sunglasses"},
}

def get_clothing_role(category_name: str) -> str:
    """Map category label to its standard outfit role (Top, Bottom, Outerwear, Shoes, Accessory)."""
    cat = (category_name or "").lower().strip()
    for role, keywords in ROLE_TAXONOMY.items():
        if cat in keywords or any(kw in cat for kw in keywords):
            return role
    return "Other"


# ==============================================================================
# 2. Grounded Color Coordination Rules
# ==============================================================================
NEUTRAL_COLORS: Set[str] = {
    "black", "white", "grey", "gray", "navy", "beige", "khaki", "cream", "denim", "charcoal", "silver"
}

# Real-world fashion color harmonies
COLOR_AFFINITIES: Dict[str, Set[str]] = {
    "white": {"black", "navy", "grey", "gray", "blue", "beige", "khaki", "red", "green", "denim", "olive"},
    "black": {"white", "grey", "gray", "red", "blue", "navy", "khaki", "beige", "yellow", "silver", "denim"},
    "grey": {"black", "white", "navy", "blue", "red", "pink", "burgundy", "charcoal"},
    "gray": {"black", "white", "navy", "blue", "red", "pink", "burgundy", "charcoal"},
    "blue": {"white", "black", "grey", "gray", "beige", "khaki", "navy", "brown", "denim"},
    "navy": {"white", "grey", "gray", "beige", "khaki", "black", "red", "light blue", "denim"},
    "beige": {"navy", "black", "white", "brown", "blue", "green", "olive", "khaki"},
    "khaki": {"white", "black", "navy", "blue", "grey", "gray", "burgundy", "beige"},
}

def evaluate_color_harmony(colors: List[str]) -> Tuple[float, str]:
    """
    Evaluate color harmony across an outfit's selected piece colors.
    Returns: (harmony_score between 0.0 and 1.0, human-readable rationale)
    """
    clean_colors = [c.lower().strip() for c in colors if c]
    if not clean_colors:
        return 0.70, "Standard color balance"

    if len(clean_colors) == 1:
        return 0.85, f"Monochrome {clean_colors[0].capitalize()}"

    # Check if all colors are neutral
    all_neutral = all(c in NEUTRAL_COLORS for c in clean_colors)
    if all_neutral:
        has_black = "black" in clean_colors
        has_white = "white" in clean_colors
        if has_black and has_white:
            return 0.95, "Classic high-contrast monochrome (White & Black)"
        if "grey" in clean_colors or "gray" in clean_colors:
            return 0.92, "Balanced neutral palette with versatile grey tones"
        if "navy" in clean_colors:
            return 0.90, "Sophisticated dark neutral pairing with navy"
        return 0.88, "Harmonious neutral color palette"

    # Check pair-wise color compatibility
    harmonious_pairs = 0
    total_pairs = 0
    for i in range(len(clean_colors)):
        for j in range(i + 1, len(clean_colors)):
            c1, c2 = clean_colors[i], clean_colors[j]
            total_pairs += 1
            if c1 == c2:
                harmonious_pairs += 1
            elif c1 in COLOR_AFFINITIES and c2 in COLOR_AFFINITIES.get(c1, set()):
                harmonious_pairs += 1
            elif c2 in COLOR_AFFINITIES and c1 in COLOR_AFFINITIES.get(c2, set()):
                harmonious_pairs += 1
            elif c1 in NEUTRAL_COLORS or c2 in NEUTRAL_COLORS:
                harmonious_pairs += 0.85

    score = round(harmonious_pairs / max(total_pairs, 1), 2)
    score = min(1.0, max(0.5, score))

    if score >= 0.9:
        rationale = f"Excellent color coordination across {', '.join(c.capitalize() for c in clean_colors)}"
    elif score >= 0.75:
        rationale = f"Complementary color harmony with neutral grounding"
    else:
        rationale = f"Eclectic color mix"

    return score, rationale


# ==============================================================================
# 3. Occasion and Season Heuristics
# ==============================================================================
OCCASION_MAPPINGS = {
    "Casual": {"T-Shirts", "Shirts", "Track Pants", "Jeans", "Trousers", "Jackets", "Hoodies"},
    "Sports": {"T-Shirts", "Track Pants", "Shorts", "Hoodies"},
    "College": {"T-Shirts", "Shirts", "Track Pants", "Jeans", "Jackets"},
    "Party": {"Shirts", "Jackets", "Blazers", "Trousers", "Jeans"},
    "Formal": {"Shirts", "Trousers", "Blazers"},
}

SEASON_MAPPINGS = {
    "Summer": {"T-Shirts", "Shirts", "Shorts", "Tops"},
    "Winter": {"Jackets", "Coats", "Hoodies", "Sweaters", "Track Pants", "Pants"},
    "Monsoon": {"Jackets", "Track Pants", "T-Shirts"},
    "All Season": {"T-Shirts", "Track Pants", "Shirts", "Jackets", "Pants"},
}


class OutfitRecommendationEngine:
    def __init__(self):
        pass

    def _get_user_context(self, user_id: int) -> Dict[str, Any]:
        """Fetch user profile, preferences, budget, interactions, and wardrobe summary."""
        profile = fetch_user_profile(user_id) if user_id else None
        interactions = fetch_user_interactions(user_id) if user_id else []
        wardrobe = fetch_user_wardrobe_summary(user_id) if user_id else []

        disliked_product_ids = {
            int(i["product_id"]) for i in interactions if i.get("interaction_type") == "DISLIKE"
        }

        preferred_brands = []
        preferred_styles = []
        budget_max = None
        gender = None

        if profile:
            if profile.get("preferred_brands"):
                preferred_brands = [
                    b.strip().lower() for b in profile["preferred_brands"].split(",") if b.strip()
                ]
            if profile.get("style_preferences"):
                preferred_styles = [
                    s.strip().lower() for s in profile["style_preferences"].split(",") if s.strip()
                ]
            if profile.get("budget_range_max") is not None:
                budget_max = float(profile["budget_range_max"])
            if profile.get("gender"):
                gender = profile["gender"]

        return {
            "profile": profile,
            "disliked_product_ids": disliked_product_ids,
            "preferred_brands": preferred_brands,
            "preferred_styles": preferred_styles,
            "budget_max": budget_max,
            "gender": gender,
            "wardrobe": wardrobe,
        }

    def generate_personalized_outfits(
        self,
        user_id: int,
        occasion: Optional[str] = None,
        season: Optional[str] = None,
        budget_max: Optional[float] = None,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Generate complete, coordinated outfits tailored to user profile, budget, season, and occasion.
        Strict Rules:
        - Combines Tops + Bottoms, or Tops + Bottoms + Outerwear.
        - Hard Budget Constraint: Outfit purchase price <= budget_max.
        - Excludes DISLIKED products and out-of-stock items.
        - Prioritizes harmonious color coordination and preferred brands.
        """
        ctx = self._get_user_context(user_id)
        effective_budget = budget_max if budget_max is not None else ctx["budget_max"]

        # Fetch active catalog items with available variants
        catalog_products = fetch_catalog_products_with_variants(in_stock_only=True)

        # Filter out disliked products
        eligible_products = [
            p for p in catalog_products if p["product_id"] not in ctx["disliked_product_ids"]
        ]

        # Partition products by clothing role
        products_by_role: Dict[str, List[Dict[str, Any]]] = {
            "Top": [],
            "Bottom": [],
            "Outerwear": [],
            "Shoes": [],
            "Accessory": [],
        }

        for p in eligible_products:
            role = get_clothing_role(p["category_name"])
            if role in products_by_role:
                products_by_role[role].append(p)

        tops = products_by_role["Top"]
        bottoms = products_by_role["Bottom"]
        outerwear = products_by_role["Outerwear"]

        # If catalog lacks tops or bottoms, complete outfit cannot be formed
        if not tops or not bottoms:
            return []

        outfit_candidates = []

        # 1. Generate Top + Bottom Combinations
        for top in tops:
            for top_var in top["variants"]:
                for bot in bottoms:
                    for bot_var in bot["variants"]:
                        cand = self._build_candidate_outfit(
                            items=[
                                {"product": top, "variant": top_var, "role": "Top", "is_owned": False},
                                {"product": bot, "variant": bot_var, "role": "Bottom", "is_owned": False},
                            ],
                            ctx=ctx,
                            target_occasion=occasion,
                            target_season=season,
                        )
                        if cand:
                            outfit_candidates.append(cand)

        # 2. Generate Top + Bottom + Outerwear Combinations (Layered Outfits)
        if outerwear:
            for top in tops:
                for top_var in top["variants"]:
                    for bot in bottoms:
                        for bot_var in bot["variants"]:
                            for out in outerwear:
                                for out_var in out["variants"]:
                                    cand = self._build_candidate_outfit(
                                        items=[
                                            {"product": top, "variant": top_var, "role": "Top", "is_owned": False},
                                            {"product": bot, "variant": bot_var, "role": "Bottom", "is_owned": False},
                                            {"product": out, "variant": out_var, "role": "Outerwear", "is_owned": False},
                                        ],
                                        ctx=ctx,
                                        target_occasion=occasion,
                                        target_season=season,
                                    )
                                    if cand:
                                        outfit_candidates.append(cand)

        # Apply strict budget filtering
        in_budget_outfits = []
        above_budget_outfits = []

        for o in outfit_candidates:
            if effective_budget and effective_budget > 0:
                if o["purchase_price"] <= effective_budget:
                    in_budget_outfits.append(o)
                else:
                    o["outside_budget"] = True
                    o["budget_note"] = f"Exceeds budget of ₹{effective_budget:,.0f}"
                    above_budget_outfits.append(o)
            else:
                in_budget_outfits.append(o)

        # Sort by match score descending
        in_budget_outfits.sort(key=lambda x: x["match_score"], reverse=True)

        # Return unique outfits up to limit
        return in_budget_outfits[:limit]

    def generate_wardrobe_outfits(
        self,
        user_id: int,
        occasion: Optional[str] = None,
        season: Optional[str] = None,
        budget_max: Optional[float] = None,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Generate complete outfits anchored by items the user already owns in their Digital Wardrobe.
        Supports:
        - Mode 1: Wardrobe-only outfits (Owned Top + Owned Bottom, cost: ₹0)
        - Mode 2: Mixed outfits (Owned piece(s) + Suggested complementary catalog piece)
        - Excludes owned pieces from being suggested as new purchases.
        - Calculates total savings and purchase price.
        """
        ctx = self._get_user_context(user_id)
        wardrobe = ctx["wardrobe"]
        effective_budget = budget_max if budget_max is not None else ctx["budget_max"]

        if not wardrobe:
            # Cold start: User has no wardrobe items -> return general personalized outfits
            return self.generate_personalized_outfits(
                user_id=user_id, occasion=occasion, season=season, budget_max=budget_max, limit=limit
            )

        # Identify owned variant and product IDs
        owned_variant_ids = {int(w["variant_id"]) for w in wardrobe}
        owned_product_ids = {int(w["product_id"]) for w in wardrobe}

        # Partition owned items by role
        owned_by_role: Dict[str, List[Dict[str, Any]]] = {
            "Top": [],
            "Bottom": [],
            "Outerwear": [],
            "Shoes": [],
            "Accessory": [],
        }

        for w in wardrobe:
            role = get_clothing_role(w["category_name"])
            retail_price = float(w.get("variant_price") or w.get("price") or 0.0)
            if role in owned_by_role:
                owned_by_role[role].append({
                    "product": {
                        "product_id": w["product_id"],
                        "product_name": w["product_name"],
                        "brand_name": w["brand_name"],
                        "category_name": w["category_name"],
                        "gender": w.get("gender", "Unisex"),
                        "price": retail_price,
                        "image_url": w.get("image_url"),
                    },
                    "variant": {
                        "variant_id": w["variant_id"],
                        "color": w["color"] or "Standard",
                        "size": w["size"] or "M",
                        "stock_quantity": 999,
                        "price": retail_price,
                    },
                    "role": role,
                    "is_owned": True,
                })

        # Fetch in-stock catalog products for completion (excluding already owned variants)
        catalog = fetch_catalog_products_with_variants(in_stock_only=True)
        catalog_by_role: Dict[str, List[Dict[str, Any]]] = {
            "Top": [],
            "Bottom": [],
            "Outerwear": [],
            "Shoes": [],
            "Accessory": [],
        }

        for p in catalog:
            # Keep only variants not owned by user
            unowned_vars = [v for v in p["variants"] if v["variant_id"] not in owned_variant_ids]
            if not unowned_vars:
                continue
            role = get_clothing_role(p["category_name"])
            if role in catalog_by_role:
                p_copy = {**p, "variants": unowned_vars}
                catalog_by_role[role].append(p_copy)

        wardrobe_outfits = []

        # ----------------------------------------------------------------------
        # Strategy A: Wardrobe Complete (Owned Top + Owned Bottom)
        # ----------------------------------------------------------------------
        for o_top in owned_by_role["Top"]:
            for o_bot in owned_by_role["Bottom"]:
                cand = self._build_candidate_outfit(
                    items=[o_top, o_bot],
                    ctx=ctx,
                    target_occasion=occasion,
                    target_season=season,
                )
                if cand:
                    cand["outfit_type"] = "WARDROBE_ONLY"
                    cand["outfit_name"] = f"Wardrobe Look: {cand['outfit_name']}"
                    cand["description"] = f"Complete outfit styled entirely from your Digital Wardrobe (₹0 new purchase)."
                    wardrobe_outfits.append(cand)

        # ----------------------------------------------------------------------
        # Strategy B: Owned Top + Owned Bottom + Suggested Catalog Outerwear
        # ----------------------------------------------------------------------
        for o_top in owned_by_role["Top"]:
            for o_bot in owned_by_role["Bottom"]:
                for cat_out in catalog_by_role["Outerwear"]:
                    for out_var in cat_out["variants"]:
                        cand = self._build_candidate_outfit(
                            items=[
                                o_top,
                                o_bot,
                                {"product": cat_out, "variant": out_var, "role": "Outerwear", "is_owned": False},
                            ],
                            ctx=ctx,
                            target_occasion=occasion,
                            target_season=season,
                        )
                        if cand:
                            cand["outfit_type"] = "WARDROBE_PLUS_LAYER"
                            cand["description"] = (
                                f"Layer your owned {o_top['product']['product_name']} & {o_bot['product']['product_name']} "
                                f"with a {cat_out['brand_name']} {cat_out['product_name']}."
                            )
                            wardrobe_outfits.append(cand)

        # ----------------------------------------------------------------------
        # Strategy C: Owned Top + Suggested Catalog Bottom
        # ----------------------------------------------------------------------
        for o_top in owned_by_role["Top"]:
            for cat_bot in catalog_by_role["Bottom"]:
                for bot_var in cat_bot["variants"]:
                    cand = self._build_candidate_outfit(
                        items=[
                            o_top,
                            {"product": cat_bot, "variant": bot_var, "role": "Bottom", "is_owned": False},
                        ],
                        ctx=ctx,
                        target_occasion=occasion,
                        target_season=season,
                    )
                    if cand:
                        cand["outfit_type"] = "WARDROBE_ANCHORED_TOP"
                        cand["description"] = f"Pair your owned {o_top['product']['product_name']} with matching {cat_bot['brand_name']} {cat_bot['product_name']}."
                        wardrobe_outfits.append(cand)

        # ----------------------------------------------------------------------
        # Strategy D: Owned Bottom + Suggested Catalog Top
        # ----------------------------------------------------------------------
        for o_bot in owned_by_role["Bottom"]:
            for cat_top in catalog_by_role["Top"]:
                for top_var in cat_top["variants"]:
                    cand = self._build_candidate_outfit(
                        items=[
                            {"product": cat_top, "variant": top_var, "role": "Top", "is_owned": False},
                            o_bot,
                        ],
                        ctx=ctx,
                        target_occasion=occasion,
                        target_season=season,
                    )
                    if cand:
                        cand["outfit_type"] = "WARDROBE_ANCHORED_BOTTOM"
                        cand["description"] = f"Pair your owned {o_bot['product']['product_name']} with a fresh {cat_top['brand_name']} {cat_top['product_name']}."
                        wardrobe_outfits.append(cand)

        # Apply strict budget filtering on purchase_price
        in_budget_wardrobe = []
        for o in wardrobe_outfits:
            if effective_budget and effective_budget > 0:
                if o["purchase_price"] <= effective_budget:
                    in_budget_wardrobe.append(o)
            else:
                in_budget_wardrobe.append(o)

        # Sort by match score descending
        in_budget_wardrobe.sort(key=lambda x: (x["owned_items_count"], x["match_score"]), reverse=True)

        return in_budget_wardrobe[:limit]

    def generate_product_outfits(
        self,
        product_id: int,
        limit: int = 4,
    ) -> List[Dict[str, Any]]:
        """
        'Complete the Look': Generate outfits anchored by a specific catalog product.
        Used on product detail pages.
        """
        target_prods = fetch_products_by_ids([product_id])
        if not target_prods:
            return []
        target = target_prods[0]

        catalog = fetch_catalog_products_with_variants(in_stock_only=True)
        target_full = next((p for p in catalog if p["product_id"] == product_id), None)
        if not target_full or not target_full["variants"]:
            return []

        anchor_role = get_clothing_role(target["category_name"])
        anchor_var = target_full["variants"][0]

        catalog_by_role: Dict[str, List[Dict[str, Any]]] = {
            "Top": [], "Bottom": [], "Outerwear": [], "Shoes": []
        }
        for p in catalog:
            if p["product_id"] == product_id:
                continue
            r = get_clothing_role(p["category_name"])
            if r in catalog_by_role:
                catalog_by_role[r].append(p)

        outfits = []
        anchor_item = {
            "product": target_full,
            "variant": anchor_var,
            "role": anchor_role,
            "is_owned": False,
        }

        if anchor_role == "Top":
            for bot in catalog_by_role["Bottom"]:
                for bot_var in bot["variants"]:
                    cand = self._build_candidate_outfit(
                        items=[anchor_item, {"product": bot, "variant": bot_var, "role": "Bottom", "is_owned": False}],
                        ctx={"preferred_brands": [], "preferred_styles": [], "budget_max": None},
                    )
                    if cand:
                        cand["outfit_name"] = f"Complete the Look with {bot['product_name']}"
                        outfits.append(cand)
                    # Also try layered with outerwear
                    for out in catalog_by_role["Outerwear"]:
                        for out_var in out["variants"]:
                            cand_layered = self._build_candidate_outfit(
                                items=[
                                    anchor_item,
                                    {"product": bot, "variant": bot_var, "role": "Bottom", "is_owned": False},
                                    {"product": out, "variant": out_var, "role": "Outerwear", "is_owned": False},
                                ],
                                ctx={"preferred_brands": [], "preferred_styles": [], "budget_max": None},
                            )
                            if cand_layered:
                                cand_layered["outfit_name"] = f"Layered Look with {out['product_name']}"
                                outfits.append(cand_layered)

        elif anchor_role == "Bottom":
            for top in catalog_by_role["Top"]:
                for top_var in top["variants"]:
                    cand = self._build_candidate_outfit(
                        items=[{"product": top, "variant": top_var, "role": "Top", "is_owned": False}, anchor_item],
                        ctx={"preferred_brands": [], "preferred_styles": [], "budget_max": None},
                    )
                    if cand:
                        cand["outfit_name"] = f"Style with {top['product_name']}"
                        outfits.append(cand)

        elif anchor_role == "Outerwear":
            for top in catalog_by_role["Top"]:
                for top_var in top["variants"]:
                    for bot in catalog_by_role["Bottom"]:
                        for bot_var in bot["variants"]:
                            cand = self._build_candidate_outfit(
                                items=[
                                    {"product": top, "variant": top_var, "role": "Top", "is_owned": False},
                                    {"product": bot, "variant": bot_var, "role": "Bottom", "is_owned": False},
                                    anchor_item,
                                ],
                                ctx={"preferred_brands": [], "preferred_styles": [], "budget_max": None},
                            )
                            if cand:
                                cand["outfit_name"] = f"Underlayer Look with {top['product_name']}"
                                outfits.append(cand)

        outfits.sort(key=lambda x: x["match_score"], reverse=True)
        return outfits[:limit]

    def _build_candidate_outfit(
        self,
        items: List[Dict[str, Any]],
        ctx: Dict[str, Any],
        target_occasion: Optional[str] = None,
        target_season: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Score, validate, and construct a cohesive outfit structure from selected item variants.
        """
        # Ensure we have at least Top and Bottom
        roles = {item["role"] for item in items}
        if "Top" not in roles or "Bottom" not in roles:
            return None

        # Extract item colors and calculate harmony
        colors = [item["variant"]["color"] for item in items]
        color_score, color_rationale = evaluate_color_harmony(colors)

        # Compute prices
        total_retail_price = 0.0
        purchase_price = 0.0
        owned_savings = 0.0
        owned_count = 0

        for it in items:
            p_price = float(it["variant"].get("price", it["product"].get("price", 0.0)))
            total_retail_price += p_price
            if it.get("is_owned"):
                owned_savings += p_price
                owned_count += 1
            else:
                purchase_price += p_price

        # Base scoring
        base_score = 0.75 + (color_score * 0.15)

        # Brand alignment bonus
        preferred_brands = ctx.get("preferred_brands", [])
        brand_bonus = 0.0
        for it in items:
            bname = (it["product"].get("brand_name") or "").lower()
            if preferred_brands and any(pb in bname for pb in preferred_brands):
                brand_bonus += 0.04
        base_score += min(0.08, brand_bonus)

        # Style alignment
        preferred_styles = ctx.get("preferred_styles", [])
        style_tags = []
        is_sporty = any("nike" in it["product"]["brand_name"].lower() or "adidas" in it["product"]["brand_name"].lower() for it in items)
        if is_sporty:
            style_tags.append("Sporty")
            style_tags.append("Casual")
        else:
            style_tags.append("Smart Casual")

        # Determine Occasion
        outfit_occasion = target_occasion if target_occasion else ("Sports" if is_sporty else "Casual")

        # Determine Season
        has_outerwear = "Outerwear" in roles
        outfit_season = target_season if target_season else ("Winter" if has_outerwear else "All Season")

        # Filter by requested occasion/season if strictly requested
        if target_occasion and target_occasion != "All" and target_occasion.lower() != outfit_occasion.lower():
            # Apply slight penalty rather than dropping if reasonable match
            base_score -= 0.05

        match_score = round(min(0.99, max(0.65, base_score)), 2)

        # Generate descriptive outfit name
        top_item = next(it for it in items if it["role"] == "Top")
        bot_item = next(it for it in items if it["role"] == "Bottom")
        out_item = next((it for it in items if it["role"] == "Outerwear"), None)

        if out_item:
            outfit_name = f"Layered {outfit_occasion} Look"
        elif is_sporty:
            outfit_name = f"Athletic {color_rationale.split('(')[0].strip()}"
        else:
            outfit_name = f"Smart {outfit_occasion} Duo"

        # Format items payload
        formatted_items = []
        for idx, it in enumerate(items, start=1):
            p = it["product"]
            v = it["variant"]
            formatted_items.append({
                "sequence": idx,
                "role": it["role"],
                "product_id": p["product_id"],
                "product_name": p["product_name"],
                "brand_name": p["brand_name"],
                "category_name": p["category_name"],
                "gender": p.get("gender", "Unisex"),
                "variant_id": v["variant_id"],
                "color": v["color"],
                "size": v["size"],
                "image_url": p.get("image_url"),
                "price": float(v.get("price", p.get("price", 0.0))),
                "is_owned": bool(it.get("is_owned", False)),
            })

        return {
            "outfit_name": outfit_name,
            "occasion": outfit_occasion,
            "season": outfit_season,
            "match_score": match_score,
            "color_score": color_score,
            "color_rationale": color_rationale,
            "description": f"{outfit_name} combining {top_item['product']['product_name']} ({top_item['variant']['color']}) and {bot_item['product']['product_name']} ({bot_item['variant']['color']}). {color_rationale}.",
            "total_retail_price": round(total_retail_price, 2),
            "purchase_price": round(purchase_price, 2),
            "owned_savings": round(owned_savings, 2),
            "owned_items_count": owned_count,
            "items_count": len(items),
            "items": formatted_items,
        }


outfit_engine = OutfitRecommendationEngine()
