"use client";

import Link from "next/link";
import { products } from "@/data/products";
import CartIcon from "@/components/CartIcon";
import WishlistButton from "@/components/WishlistButton";

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-[#faf9f6]">
      <header className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            FashionIQ
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/wishlist"
              className="text-sm text-gray-700 hover:text-black"
            >
              Wishlist
            </Link>

            <CartIcon />

            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-black"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
            Discover your style
          </p>

          <h1 className="text-4xl font-semibold tracking-tight text-gray-900">
            All Products
          </h1>

          <p className="mt-3 text-gray-600">
            Explore pieces selected to fit your style.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
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

                {product.badge && (
                  <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-800">
                    {product.badge}
                  </span>
                )}

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
      </section>
    </main>
  );
}
