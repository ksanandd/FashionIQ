"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getWishlistProducts, type Product } from "@/lib/api";
import { getWishlist } from "@/lib/wishlist";
import Navbar from "@/components/Navbar";
import WishlistButton from "@/components/WishlistButton";
import { Heart, ArrowRight } from "lucide-react";

export default function WishlistPage() {
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWishlistItems = useCallback(async () => {
    const ids = getWishlist();
    if (ids.length === 0) {
      setSavedProducts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const items = await getWishlistProducts(ids);
      setSavedProducts(items);
    } catch (err) {
      console.error("Failed to load wishlist products:", err);
      setError("Unable to load some wishlist items.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWishlistItems();

    function handleWishlistUpdate() {
      loadWishlistItems();
    }

    window.addEventListener("wishlist-updated", handleWishlistUpdate);
    window.addEventListener("storage", handleWishlistUpdate);

    return () => {
      window.removeEventListener("wishlist-updated", handleWishlistUpdate);
      window.removeEventListener("storage", handleWishlistUpdate);
    };
  }, [loadWishlistItems]);

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      <Navbar currentPath="/wishlist" />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
            Curated by you
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-gray-900">My Wishlist</h1>
            {!loading && savedProducts.length > 0 && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {savedProducts.length} {savedProducts.length === 1 ? "item" : "items"}
              </span>
            )}
          </div>
          <p className="mt-2 text-gray-600">
            Your saved pieces from the FashionIQ collection, ready when you are.
          </p>
        </div>

        {loading && (
          <div className="py-20 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
            <p className="mt-4 text-sm text-gray-600">Loading your saved items...</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <p>{error}</p>
            <button
              onClick={() => loadWishlistItems()}
              className="mt-3 rounded-full bg-black px-4 py-2 text-xs font-medium text-white hover:bg-gray-800"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && savedProducts.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Heart size={26} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Your wishlist is empty</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
              Explore our collection of curated styles and tap the heart icon on any piece you love to save it here.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Explore Products <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {!loading && savedProducts.length > 0 && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {savedProducts.map((product) => (
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
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      {product.brand}
                    </p>
                    <Link href={`/products/${product.id}`}>
                      <h2 className="mt-1 font-medium text-gray-900 hover:underline">
                        {product.name}
                      </h2>
                    </Link>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="font-semibold text-gray-900">
                      ₹{product.price.toLocaleString("en-IN")}
                    </p>
                    <Link
                      href={`/products/${product.id}`}
                      className="text-xs font-medium text-black underline hover:text-[#c65b3b]"
                    >
                      View Options
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
