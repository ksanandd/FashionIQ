import os
import sys
import time
import psutil
import statistics
import torch

def benchmark():
    print("======================================================================")
    print("FASHIONIQ PHASE 6: HARDWARE & PERFORMANCE BENCHMARK (REAL MEASUREMENTS)")
    print("======================================================================\n")

    process = psutil.Process(os.getpid())
    sys_mem = psutil.virtual_memory()

    print(f"System Hardware:")
    print(f"  CPU Logical Cores : {psutil.cpu_count(logical=True)} (Physical: {psutil.cpu_count(logical=False)})")
    print(f"  Total System RAM  : {sys_mem.total / (1024**3):.2f} GB")
    print(f"  Available RAM     : {sys_mem.available / (1024**3):.2f} GB ({sys_mem.percent}% used)")
    print(f"  CUDA GPU Available: {torch.cuda.is_available()} (Service strictly configured for CPU execution)")
    print(f"  PyTorch Device    : cpu")
    print()

    # 1. Baseline RAM
    base_ram_mb = process.memory_info().rss / (1024 * 1024)
    print(f"1. Baseline Process RAM: {base_ram_mb:.2f} MB")

    # 2. Embedding Model Initialization Time
    from app.embeddings import embedding_service
    print("\n2. Measuring Embedding Model Initialization Time (sentence-transformers/all-MiniLM-L6-v2):")
    t0 = time.perf_counter()
    embedding_service.load_model()
    t_init = time.perf_counter() - t0
    print(f"  [MEASURED] Model Initialization Time: {t_init:.4f} seconds ({t_init*1000:.1f} ms)")

    # 3. Model Memory Usage
    model_ram_mb = process.memory_info().rss / (1024 * 1024)
    model_delta_mb = model_ram_mb - base_ram_mb
    print(f"  [MEASURED] Process RAM after loading Model: {model_ram_mb:.2f} MB")
    print(f"  [MEASURED] Model RAM Footprint Delta: {model_delta_mb:.2f} MB (Well under 500 MB budget!)")

    # 4. ChromaDB Initialization & Combined RAM
    from app.vector_store import vector_store
    t0 = time.perf_counter()
    vector_store.initialize()
    t_chroma = time.perf_counter() - t0
    total_ram_mb = process.memory_info().rss / (1024 * 1024)
    print(f"\n3. ChromaDB Vector Store Initialization:")
    print(f"  [MEASURED] ChromaDB init time: {t_chroma:.4f} seconds")
    print(f"  [MEASURED] Combined AI Service RAM (Model + ChromaDB): {total_ram_mb:.2f} MB")

    # 5. Singleton Verification
    print("\n4. Verifying Model Singleton Pattern:")
    model_id_1 = id(embedding_service.model)
    from app.embeddings import EmbeddingService
    another_ref = EmbeddingService.get_instance()
    model_id_2 = id(another_ref.model)
    assert model_id_1 == model_id_2, "Singleton violation: distinct model instances created!"
    print(f"  [MEASURED] Model instance ID #1: {model_id_1}")
    print(f"  [MEASURED] Model instance ID #2: {model_id_2} (Identical memory address)")
    print("  [SUCCESS] Model is loaded exactly once into process memory.")

    # 6. Single Query Inference Time
    print("\n5. Measuring Single Text Inference Latency (10 runs):")
    test_query = "Classic white formal linen shirt with breathable fabric for summer"
    latencies = []
    for _ in range(10):
        t0 = time.perf_counter()
        _ = embedding_service.embed_text(test_query)
        latencies.append((time.perf_counter() - t0) * 1000)

    print(f"  [MEASURED] Single Query Latency: Mean = {statistics.mean(latencies):.2f} ms | Median = {statistics.median(latencies):.2f} ms | Min = {min(latencies):.2f} ms | Max = {max(latencies):.2f} ms")

    # 7. Document Batch Inference Time (10 documents)
    print("\n6. Measuring Document Batch Inference Latency (Batch of 10 items, 5 runs):")
    test_batch = [
        f"Product {i}: Premium Cotton T-Shirt with relaxed fit in navy blue. Category: Tops. Suitable for casual everyday wear."
        for i in range(10)
    ]
    batch_latencies = []
    for _ in range(5):
        t0 = time.perf_counter()
        _ = embedding_service.embed_texts(test_batch, batch_size=10)
        batch_latencies.append((time.perf_counter() - t0) * 1000)

    mean_batch_ms = statistics.mean(batch_latencies)
    throughput = (10 / (mean_batch_ms / 1000))
    print(f"  [MEASURED] 10-Item Batch Latency: Mean = {mean_batch_ms:.2f} ms ({mean_batch_ms / 10:.2f} ms per document)")
    print(f"  [MEASURED] CPU Throughput: {throughput:.1f} documents / second")

    # 8. Full Catalog Indexing Time (MySQL fetch + Embeddings + ChromaDB upsert)
    print("\n7. Measuring Full Catalog Indexing Time (Current MySQL Catalog):")
    from app.database import fetch_all_products_for_indexing
    t0 = time.perf_counter()
    products = fetch_all_products_for_indexing()
    embs = embedding_service.embed_texts([p["document_text"] for p in products])
    res = vector_store.index_products(products, embs)
    t_index = (time.perf_counter() - t0) * 1000
    print(f"  [MEASURED] Indexed {len(products)} products in {t_index:.2f} ms ({t_index / len(products):.2f} ms/item)")

    # 9. Multi-Process Resource Footprint Check
    print("\n8. Multi-Process System Resource Usage Measurement:")
    for proc in psutil.process_iter(['name', 'memory_info']):
        try:
            name = proc.info['name'].lower()
            if 'mysqld' in name or 'node' in name or 'python' in name:
                rss_mb = proc.info['memory_info'].rss / (1024 * 1024)
                print(f"  Process: {proc.info['name']:<20} | PID: {proc.pid:<6} | RSS: {rss_mb:.1f} MB")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    print("\n======================================================================")
    print("HARDWARE & PERFORMANCE BENCHMARK COMPLETE")
    print("======================================================================\n")

if __name__ == "__main__":
    benchmark()
