import pymysql
from pymysql.cursors import DictCursor
from typing import List, Dict, Any, Optional
from app.config import settings
import logging

logger = logging.getLogger(__name__)


def get_db_connection():
    """Create and return a MySQL connection using PyMySQL."""
    return pymysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
        cursorclass=DictCursor,
        autocommit=True,
        connect_timeout=5,
    )


def check_db_health() -> bool:
    """Verify MySQL connectivity."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 AS health_check")
            result = cursor.fetchone()
        conn.close()
        return result is not None and result.get("health_check") == 1
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False


def fetch_all_products_for_indexing() -> List[Dict[str, Any]]:
    """
    Fetch all active products joined with brands, categories, and variant aggregates.
    Builds rich metadata for embedding and filtering.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Fetch base product info with brand and category
            cursor.execute(
                """
                SELECT
                    p.product_id,
                    p.category_id,
                    c.category_name,
                    p.brand_id,
                    b.brand_name,
                    p.product_name,
                    p.description,
                    p.price,
                    p.gender,
                    p.image_url
                FROM product p
                JOIN category c ON p.category_id = c.category_id
                JOIN brand b ON p.brand_id = b.brand_id
                ORDER BY p.product_id ASC
                """
            )
            products = cursor.fetchall()

            if not products:
                return []

            # 2. Fetch variant details (colors, sizes, stock)
            cursor.execute(
                """
                SELECT
                    pv.product_id,
                    pv.variant_id,
                    pv.color,
                    pv.size,
                    pv.stock_quantity,
                    pv.price AS variant_price
                FROM product_variant pv
                ORDER BY pv.product_id ASC
                """
            )
            variants = cursor.fetchall()

            # Group variants by product_id
            variant_map: Dict[int, List[Dict[str, Any]]] = {}
            for v in variants:
                pid = v["product_id"]
                if pid not in variant_map:
                    variant_map[pid] = []
                variant_map[pid].append(v)

            # Build enriched product structures
            enriched_products = []
            for p in products:
                pid = p["product_id"]
                prod_variants = variant_map.get(pid, [])

                colors = sorted(list({v["color"] for v in prod_variants if v["color"]}))
                sizes = sorted(list({v["size"] for v in prod_variants if v["size"]}))
                total_stock = sum(v["stock_quantity"] for v in prod_variants)
                in_stock = total_stock > 0

                # Construct rich descriptive text for embedding representation
                # Captures semantic attributes: product name, brand, category, gender, color palette, sizes, and description
                doc_text = (
                    f"Product: {p['product_name']}. "
                    f"Brand: {p['brand_name']}. "
                    f"Category: {p['category_name']}. "
                    f"Gender: {p['gender']}. "
                    f"Colors: {', '.join(colors) if colors else 'Standard'}. "
                    f"Sizes: {', '.join(sizes) if sizes else 'Standard'}. "
                    f"Description: {p['description']}"
                )

                enriched_products.append({
                    "product_id": pid,
                    "product_name": p["product_name"],
                    "brand_id": p["brand_id"],
                    "brand_name": p["brand_name"],
                    "category_id": p["category_id"],
                    "category_name": p["category_name"],
                    "gender": p["gender"],
                    "price": float(p["price"]),
                    "image_url": p["image_url"],
                    "description": p["description"],
                    "colors": colors,
                    "sizes": sizes,
                    "total_stock": total_stock,
                    "in_stock": in_stock,
                    "document_text": doc_text
                })

            return enriched_products
    finally:
        conn.close()


def fetch_user_profile(user_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve user's style preferences, budget range, and preferred brands."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    user_id,
                    height,
                    weight,
                    body_type,
                    style_preferences,
                    budget_range_min,
                    budget_range_max,
                    preferred_brands
                FROM user_profile
                WHERE user_id = %s
                """,
                (user_id,)
            )
            return cursor.fetchone()
    finally:
        conn.close()


def fetch_user_interactions(user_id: int) -> List[Dict[str, Any]]:
    """Retrieve user interaction history with product metadata."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    ui.interaction_id,
                    ui.user_id,
                    ui.product_id,
                    ui.variant_id,
                    ui.interaction_type,
                    ui.interaction_date,
                    p.category_id,
                    p.brand_id,
                    p.gender,
                    p.price
                FROM user_interaction ui
                JOIN product p ON ui.product_id = p.product_id
                WHERE ui.user_id = %s
                ORDER BY ui.interaction_date DESC
                LIMIT 100
                """,
                (user_id,)
            )
            return cursor.fetchall()
    finally:
        conn.close()


def fetch_user_wardrobe_summary(user_id: int) -> List[Dict[str, Any]]:
    """Retrieve user wardrobe items with category, brand, color, season, and source type."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    wi.wardrobe_item_id,
                    wi.variant_id,
                    wi.season,
                    wi.source_type,
                    pv.product_id,
                    pv.color,
                    pv.size,
                    p.product_name,
                    p.category_id,
                    c.category_name,
                    p.brand_id,
                    b.brand_name,
                    p.gender,
                    p.price,
                    COALESCE(pv.price, p.price) AS variant_price,
                    p.image_url
                FROM wardrobe_item wi
                JOIN wardrobe w ON wi.wardrobe_id = w.wardrobe_id
                JOIN product_variant pv ON wi.variant_id = pv.variant_id
                JOIN product p ON pv.product_id = p.product_id
                JOIN category c ON p.category_id = c.category_id
                JOIN brand b ON p.brand_id = b.brand_id
                WHERE w.user_id = %s
                ORDER BY wi.date_added DESC
                """,
                (user_id,)
            )
            return cursor.fetchall()
    finally:
        conn.close()


def fetch_popular_products(limit: int = 10, exclude_ids: List[int] = None) -> List[Dict[str, Any]]:
    """Cold-start fallback: popular products based on interaction volume or high stock."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            exclude_clause = ""
            params: list = []
            if exclude_ids:
                placeholders = ",".join(["%s"] * len(exclude_ids))
                exclude_clause = f"AND p.product_id NOT IN ({placeholders})"
                params.extend(exclude_ids)

            params.append(limit)

            cursor.execute(
                f"""
                SELECT
                    p.product_id,
                    p.category_id,
                    c.category_name,
                    p.brand_id,
                    b.brand_name,
                    p.product_name,
                    p.description,
                    p.price,
                    p.gender,
                    p.image_url,
                    COUNT(ui.interaction_id) AS interaction_count
                FROM product p
                JOIN category c ON p.category_id = c.category_id
                JOIN brand b ON p.brand_id = b.brand_id
                LEFT JOIN user_interaction ui ON p.product_id = ui.product_id
                WHERE 1=1 {exclude_clause}
                GROUP BY p.product_id, c.category_name, b.brand_name
                ORDER BY interaction_count DESC, p.product_id ASC
                LIMIT %s
                """,
                tuple(params)
            )
            rows = cursor.fetchall()
            return [
                {
                    **r,
                    "price": float(r["price"]),
                    "interaction_count": int(r["interaction_count"])
                }
                for r in rows
            ]
    finally:
        conn.close()


def fetch_products_by_ids(product_ids: List[int]) -> List[Dict[str, Any]]:
    """Hydrate product IDs from MySQL into rich presentation objects."""
    if not product_ids:
        return []

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            placeholders = ",".join(["%s"] * len(product_ids))
            cursor.execute(
                f"""
                SELECT
                    p.product_id,
                    p.category_id,
                    c.category_name,
                    p.brand_id,
                    b.brand_name,
                    p.product_name,
                    p.description,
                    p.price,
                    p.gender,
                    p.image_url
                FROM product p
                JOIN category c ON p.category_id = c.category_id
                JOIN brand b ON p.brand_id = b.brand_id
                WHERE p.product_id IN ({placeholders})
                """,
                tuple(product_ids)
            )
            rows = cursor.fetchall()
            # Order to match original product_ids sequence
            row_map = {r["product_id"]: {**r, "price": float(r["price"])} for r in rows}
            return [row_map[pid] for pid in product_ids if pid in row_map]
    finally:
        conn.close()


def fetch_catalog_products_with_variants(in_stock_only: bool = True) -> List[Dict[str, Any]]:
    """
    Fetch all active catalog products with their variants, brands, and categories.
    Used for complete outfit generation.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Fetch base products
            cursor.execute(
                """
                SELECT
                    p.product_id,
                    p.category_id,
                    c.category_name,
                    p.brand_id,
                    b.brand_name,
                    p.product_name,
                    p.description,
                    p.price,
                    p.gender,
                    p.image_url
                FROM product p
                JOIN category c ON p.category_id = c.category_id
                JOIN brand b ON p.brand_id = b.brand_id
                ORDER BY p.product_id ASC
                """
            )
            products = cursor.fetchall()

            # 2. Fetch variants
            stock_filter = "WHERE pv.stock_quantity > 0" if in_stock_only else ""
            cursor.execute(
                f"""
                SELECT
                    pv.variant_id,
                    pv.product_id,
                    pv.color,
                    pv.size,
                    pv.stock_quantity,
                    COALESCE(pv.price, p.price) AS variant_price
                FROM product_variant pv
                JOIN product p ON pv.product_id = p.product_id
                {stock_filter}
                ORDER BY pv.variant_id ASC
                """
            )
            variants = cursor.fetchall()

            # Group variants by product
            variant_map: Dict[int, List[Dict[str, Any]]] = {}
            for v in variants:
                pid = v["product_id"]
                if pid not in variant_map:
                    variant_map[pid] = []
                variant_map[pid].append({
                    "variant_id": v["variant_id"],
                    "color": v["color"] or "Standard",
                    "size": v["size"] or "M",
                    "stock_quantity": v["stock_quantity"],
                    "price": float(v["variant_price"]),
                })

            result = []
            for p in products:
                pid = p["product_id"]
                prod_variants = variant_map.get(pid, [])
                if in_stock_only and not prod_variants:
                    continue

                result.append({
                    "product_id": pid,
                    "product_name": p["product_name"],
                    "category_id": p["category_id"],
                    "category_name": p["category_name"],
                    "brand_id": p["brand_id"],
                    "brand_name": p["brand_name"],
                    "description": p["description"],
                    "price": float(p["price"]),
                    "gender": p["gender"],
                    "image_url": p["image_url"],
                    "variants": prod_variants,
                })
            return result
    finally:
        conn.close()


def fetch_saved_outfits(user_id: int) -> List[Dict[str, Any]]:
    """Retrieve saved outfits for a specific user with full item details."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Fetch user outfits
            cursor.execute(
                """
                SELECT
                    o.outfit_id,
                    o.user_id,
                    o.outfit_name,
                    o.occasion,
                    o.season,
                    o.total_price,
                    o.description,
                    o.is_generated,
                    o.created_at
                FROM outfit o
                WHERE o.user_id = %s
                ORDER BY o.created_at DESC
                """,
                (user_id,)
            )
            outfits = cursor.fetchall()
            if not outfits:
                return []

            outfit_ids = [o["outfit_id"] for o in outfits]
            placeholders = ",".join(["%s"] * len(outfit_ids))

            # 2. Fetch outfit items joined with product and variant
            cursor.execute(
                f"""
                SELECT
                    oi.outfit_item_id,
                    oi.outfit_id,
                    oi.variant_id,
                    oi.role,
                    oi.sequence,
                    oi.is_owned,
                    oi.price,
                    pv.product_id,
                    pv.color,
                    pv.size,
                    p.product_name,
                    p.image_url,
                    b.brand_name,
                    c.category_name
                FROM outfit_item oi
                JOIN product_variant pv ON oi.variant_id = pv.variant_id
                JOIN product p ON pv.product_id = p.product_id
                JOIN brand b ON p.brand_id = b.brand_id
                JOIN category c ON p.category_id = c.category_id
                WHERE oi.outfit_id IN ({placeholders})
                ORDER BY oi.outfit_id, COALESCE(oi.sequence, 99)
                """,
                tuple(outfit_ids)
            )
            items = cursor.fetchall()

            # Group items by outfit
            items_by_outfit: Dict[int, List[Dict[str, Any]]] = {}
            for item in items:
                oid = item["outfit_id"]
                if oid not in items_by_outfit:
                    items_by_outfit[oid] = []
                items_by_outfit[oid].append({
                    "outfit_item_id": item["outfit_item_id"],
                    "variant_id": item["variant_id"],
                    "product_id": item["product_id"],
                    "product_name": item["product_name"],
                    "brand_name": item["brand_name"],
                    "category_name": item["category_name"],
                    "role": item["role"],
                    "color": item["color"],
                    "size": item["size"],
                    "image_url": item["image_url"],
                    "is_owned": bool(item["is_owned"]),
                    "price": float(item["price"]),
                })

            for o in outfits:
                oid = o["outfit_id"]
                o["total_price"] = float(o["total_price"])
                o["items"] = items_by_outfit.get(oid, [])

            return outfits
    finally:
        conn.close()


def save_user_outfit(
    user_id: int,
    outfit_name: str,
    occasion: str,
    season: str,
    total_price: float,
    description: str,
    items: List[Dict[str, Any]],
) -> int:
    """Save an outfit and its constituent items into the database."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Insert into outfit
            cursor.execute(
                """
                INSERT INTO outfit (user_id, outfit_name, occasion, season, total_price, description, is_generated)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, outfit_name, occasion, season, total_price, description, 1)
            )
            outfit_id = cursor.lastrowid

            # 2. Insert outfit items
            for idx, item in enumerate(items, start=1):
                cursor.execute(
                    """
                    INSERT INTO outfit_item (outfit_id, variant_id, role, sequence, is_owned, price)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        outfit_id,
                        int(item["variant_id"]),
                        item["role"],
                        idx,
                        1 if item.get("is_owned") else 0,
                        float(item.get("price", 0.0)),
                    )
                )
            return outfit_id
    finally:
        conn.close()


def delete_user_outfit(user_id: int, outfit_id: int) -> bool:
    """Delete a user-owned outfit record and cascade its items."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "DELETE FROM outfit WHERE outfit_id = %s AND user_id = %s",
                (outfit_id, user_id)
            )
            return cursor.rowcount > 0
    finally:
        conn.close()
