"use client";

import { Suspense, useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getProductsWithPagination,
  getBrands,
  getCategories,
  type Product,
  type ApiBrand,
  type ApiCategory,
  type PaginationInfo,
} from "@/lib/api";
import Navbar from "@/components/Navbar";
import WishlistButton from "@/components/WishlistButton";
import { Search, SlidersHorizontal, X, ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#faf9f6] py-20 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Loading catalog...</p>
        </main>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters state initialized from URL
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [categoryId, setCategoryId] = useState(searchParams.get("category_id") || "");
  const [brandId, setBrandId] = useState(searchParams.get("brand_id") || "");
  const [gender, setGender] = useState(searchParams.get("gender") || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("min_price") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("max_price") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "default");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    limit: 12,
    totalProducts: 0,
    totalPages: 1,
  });
  const [brands, setBrands] = useState<ApiBrand[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [, startTransition] = useTransition();

  // Load brands and categories once
  useEffect(() => {
    async function loadMeta() {
      try {
        const [bData, cData] = await Promise.all([getBrands(), getCategories()]);
        setBrands(bData);

        // Deduplicate categories by category_name
        const seen = new Set<string>();
        const uniqueCategories = cData.filter((cat) => {
          if (seen.has(cat.category_name)) return false;
          seen.add(cat.category_name);
          return true;
        });
        setCategories(uniqueCategories);
      } catch (err) {
        console.error("Failed to load filter metadata:", err);
      }
    }
    loadMeta();
  }, []);

  // Fetch products whenever filters change
  const fetchFilteredProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params: Record<string, string | number> = {
        page,
        limit: 12,
      };

      if (search.trim()) params.search = search.trim();
      if (categoryId) params.category_id = categoryId;
      if (brandId) params.brand_id = brandId;
      if (gender) params.gender = gender;
      if (minPrice && Number(minPrice) >= 0) params.min_price = minPrice;
      if (maxPrice && Number(maxPrice) > 0) params.max_price = maxPrice;
      if (sort && sort !== "default") params.sort = sort as any;

      const result = await getProductsWithPagination(params as any);
      setProducts(result.products);
      setPagination(result.pagination);
    } catch (err: any) {
      console.error("Failed to load products:", err);
      setError(err.message || "Unable to load products with selected filters.");
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, brandId, gender, minPrice, maxPrice, sort, page]);

  useEffect(() => {
    fetchFilteredProducts();
  }, [fetchFilteredProducts]);

  // Sync state to URL for shareable filtered links
  const updateUrl = useCallback(() => {
    startTransition(() => {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (categoryId) q.set("category_id", categoryId);
      if (brandId) q.set("brand_id", brandId);
      if (gender) q.set("gender", gender);
      if (minPrice) q.set("min_price", minPrice);
      if (maxPrice) q.set("max_price", maxPrice);
      if (sort && sort !== "default") q.set("sort", sort);
      if (page > 1) q.set("page", String(page));

      const queryStr = q.toString();
      router.replace(queryStr ? `/products?${queryStr}` : "/products", { scroll: false });
    });
  }, [search, categoryId, brandId, gender, minPrice, maxPrice, sort, page, router]);

  useEffect(() => {
    updateUrl();
  }, [updateUrl]);

  function handleResetFilters() {
    setSearch("");
    setCategoryId("");
    setBrandId("");
    setGender("");
    setMinPrice("");
    setMaxPrice("");
    setSort("default");
    setPage(1);
  }

  const hasActiveFilters = Boolean(
    search || categoryId || brandId || gender || minPrice || maxPrice || (sort && sort !== "default")
  );

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      {/* Header */}
      <Navbar currentPath="/products" />

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Title & Top Bar */}
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#c65b3b]">
              Discover your style
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
              All Products
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {pagination.totalProducts} pieces available from our fashion catalog.
            </p>
          </div>

          {/* Quick Sort & Mobile Filter Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
              className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-800 md:hidden"
            >
              <SlidersHorizontal size={14} />
              Filters {hasActiveFilters && "•"}
            </button>

            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span className="hidden sm:inline font-medium">Sort by:</span>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="rounded-full border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 focus:border-black focus:outline-none"
              >
                <option value="default">Featured / Default</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name_asc">Name: A to Z</option>
                <option value="name_desc">Name: Z to A</option>
              </select>
            </label>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div
          className={`mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-all ${
            showFiltersMobile ? "block" : "hidden md:block"
          }`}
        >
          {/* Row 1: Search & Categories */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Search */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Search
              </label>
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="e.g. T-Shirt, Jacket..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-8 text-xs text-gray-900 focus:border-black focus:outline-none"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-black focus:outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.category_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Brand
              </label>
              <select
                value={brandId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-black focus:outline-none"
              >
                <option value="">All Brands</option>
                {brands.map((b) => (
                  <option key={b.brand_id} value={b.brand_id}>
                    {b.brand_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-black focus:outline-none"
              >
                <option value="">All Genders</option>
                <option value="Men">Men</option>
                <option value="Women">Women</option>
                <option value="Unisex">Unisex</option>
              </select>
            </div>
          </div>

          {/* Row 2: Price Range & Clear Filters */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-gray-700">Price (₹):</span>
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPage(1);
                }}
                className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-black focus:outline-none"
              />
              <span className="text-gray-400 text-xs">—</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
                className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-black focus:outline-none"
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#c65b3b] hover:underline"
              >
                <RotateCcw size={13} /> Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-20 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
            <p className="mt-4 text-sm text-gray-500">Searching catalog pieces...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="my-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => fetchFilteredProducts()}
              className="mt-3 rounded-full bg-black px-4 py-2 text-xs font-medium text-white hover:bg-gray-800"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <div className="my-12 rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <h2 className="text-xl font-semibold text-gray-900">No matching products found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
              We couldn't find any products matching your current filters. Try relaxing your search or price criteria.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-xs font-medium text-white hover:bg-gray-800"
            >
              <RotateCcw size={14} /> Clear All Filters
            </button>
          </div>
        )}

        {/* Product Grid */}
        {!loading && !error && products.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <div key={product.id} className="group flex flex-col">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-100">
                    <Link
                      href={`/products/${product.id}`}
                      className="block h-full w-full"
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=600";
                        }}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    </Link>

                    {product.badge && (
                      <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-800 shadow-xs">
                        {product.badge}
                      </span>
                    )}

                    <div className="absolute right-3 top-3">
                      <WishlistButton productId={product.id} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-1 flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="font-medium uppercase tracking-wider">
                          {product.brand}
                        </span>
                        {product.gender && (
                          <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-[10px]">
                            {product.gender}
                          </span>
                        )}
                      </div>

                      <Link href={`/products/${product.id}`}>
                        <h2 className="mt-1 font-medium text-gray-900 group-hover:underline">
                          {product.name}
                        </h2>
                      </Link>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <p className="whitespace-nowrap font-semibold text-gray-900">
                        ₹{product.price.toLocaleString("en-IN")}
                      </p>
                      <Link
                        href={`/products/${product.id}`}
                        className="text-xs font-medium text-black underline hover:text-[#c65b3b]"
                      >
                        Select Options
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-3 border-t border-gray-200 pt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.currentPage <= 1}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ArrowLeft size={14} /> Previous
                </button>

                <span className="text-xs font-medium text-gray-600">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.currentPage >= pagination.totalPages}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next <ArrowRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
