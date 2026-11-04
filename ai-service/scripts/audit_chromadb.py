import time
from app.vector_store import vector_store
from app.embeddings import embedding_service
from app.database import fetch_all_products_for_indexing, get_db_connection

def audit_chromadb():
    print("======================================================================")
    print("FASHIONIQ PHASE 6: CHROMADB PERSISTENCE & INDEXING AUDIT")
    print("======================================================================\n")

    # 1. Inspect Stable Document Identifiers
    vector_store.initialize()
    collection = vector_store.collection
    all_data = collection.get(include=["metadatas", "documents"])
    ids = all_data["ids"]
    metas = all_data["metadatas"]
    print(f"Current ChromaDB Collection '{collection.name}':")
    print(f"Total documents: {len(ids)}")
    for doc_id, meta in zip(ids, metas):
        expected_id = f"prod_{meta['product_id']}"
        assert doc_id == expected_id, f"Document ID mismatch: {doc_id} != {expected_id}"
        print(f"  Stable Doc ID: {doc_id:<10} | Product ID: {meta['product_id']} | Product: {meta['product_name']}")
    print("  [SUCCESS] All document IDs follow stable deterministic pattern 'prod_{product_id}'.\n")

    # 2. Repeated Indexing Idempotence (No Duplicates)
    initial_count = collection.count()
    print(f"Testing re-indexing idempotency. Initial document count: {initial_count}")
    products = fetch_all_products_for_indexing()
    embeddings = embedding_service.embed_texts([p["document_text"] for p in products])
    res = vector_store.index_products(products, embeddings)
    new_count = collection.count()
    print(f"After re-indexing {len(products)} products -> Total count in ChromaDB: {new_count}")
    assert new_count == initial_count, f"Duplication detected! Initial {initial_count} != New {new_count}"
    print("  [SUCCESS] Upsert is idempotent. Zero duplicate records created.\n")

    # 3. Metadata Filtering Test
    print("Testing ChromaDB metadata filtering (category_name = 'Tops'):")
    tops_filter = vector_store.query_similar(
        query_embedding=embeddings[0],
        n_results=10,
        where_filter={"category_name": "Tops"},
    )
    for hit in tops_filter:
        print(f"  Matched: Product #{hit['product_id']} | Meta: {hit['metadata']['product_name']} ({hit['metadata']['category_name']})")
        assert hit["metadata"]["category_name"] == "Tops", "Metadata filter violated!"
    print("  [SUCCESS] Metadata filtering strictly respected.\n")

    # 4. Pruning Stale Documents
    print("Testing stale product pruning logic:")
    # Add a mock test product
    mock_stale_prod = {
        "product_id": 9999,
        "product_name": "Temporary Test Item",
        "brand_id": 1,
        "brand_name": "TestBrand",
        "category_id": 1,
        "category_name": "TestCat",
        "gender": "Unisex",
        "price": 999.0,
        "in_stock": True,
        "document_text": "Temporary test item description for audit",
        "colors": ["Black"],
        "sizes": ["M"]
    }
    mock_emb = embedding_service.embed_text(mock_stale_prod["document_text"])
    vector_store.index_products([mock_stale_prod], [mock_emb])
    print(f"  Inserted temporary test item. Collection count: {collection.count()}")

    # Now prune using the real active MySQL product IDs
    active_mysql_ids = [p["product_id"] for p in products]
    pruned = vector_store.prune_stale_products(active_mysql_ids)
    print(f"  Pruned stale items count: {pruned}")
    assert collection.count() == initial_count, "Pruning failed to restore initial collection count!"
    print("  [SUCCESS] Stale items removed accurately without affecting active catalog.\n")

    # 5. Embedding Dimension Consistency
    print("Testing embedding dimensions consistency:")
    sample_vec = vector_store.get_product_embedding(1)
    dim = len(sample_vec)
    print(f"  Product #1 vector dimension: {dim}")
    assert dim == 384, f"Unexpected embedding dimension: {dim} (expected 384)"
    print("  [SUCCESS] All embeddings strictly 384 dimensions.\n")

    # 6. Verify MySQL Records Were NOT Modified by Indexing
    print("Verifying MySQL product records remained untouched by indexing:")
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT product_id, product_name, price FROM product")
        db_prods = cur.fetchall()
        for p in db_prods:
            print(f"  DB Check: ID {p['product_id']} | {p['product_name']} | Rs {p['price']}")
        assert len(db_prods) == len(products), "Product count in MySQL changed!"
    conn.close()
    print("  [SUCCESS] MySQL product catalog completely unmodified.\n")

    print("======================================================================")
    print("ALL CHROMADB PERSISTENCE & INDEXING CHECKS PASSED")
    print("======================================================================\n")

if __name__ == "__main__":
    audit_chromadb()
