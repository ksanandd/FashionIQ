"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { products } from "@/data/products";
import { getWishlist } from "@/lib/wishlist";
import CartIcon from "@/components/CartIcon";
import WishlistButton from "@/components/WishlistButton";

export default function WishlistPage() {
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    function updateWishlist() {
      setSavedIds(getWishlist());
    }

    updateWishlist();
    window.addEventListener("wishlist-updated", updateWishlist);

    return () => {
      window.removeEventListener("wishlist-updated", updateWishlist);
    };
  }, []);

  const savedProducts = products.filter((product) =>
    savedIds.includes(product.id)
  );

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      <header className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            FashionIQ
          </Link>

          <div className="flex items-center gap-6">
            <CartIcon />
            <Link
              href="/products"
              className="text-sm text-gray-600 hover:text-black"
            >
              ← Continue Shopping
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="mb-3 text-3xl font-semibold">My Wishlist</h1>
        <p className="mb-8 text-gray-600">
          Your saved favorites, all in one place.
        </p>

        {savedProducts.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center">
            <p className="text-gray-600">Your wishlist is empty.</p>
            <Link
              href="/products"
              className="mt-4 inline-block rounded-full bg-black px-6 py-3 text-white"
            >
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {savedProducts.map((product) => (
              <div key={product.id} className="group">
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-100">
                  <Link
                    href={`/products/${product.id}`}
                    className="block h-full"
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </Link>

                  <div className="absolute right-3 top-3">
                    <WishlistButton productId={product.id} />
                  </div>
                </div>

                <Link href={`/products/${product.id}`}>
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500">
                        {product.brand}
                      </p>
                      <h2 className="mt-1 font-medium text-gray-900">
                        {product.name}
                      </h2>
                    </div>

                    <p className="whitespace-nowrap font-semibold text-gray-900">
                      ₹{product.price.toLocaleString("en-IN")}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
