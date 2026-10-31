"use client";

import { use, useState } from "react";
import Link from "next/link";
import { products } from "@/data/products";
import { addToCart } from "@/lib/cart";
import CartIcon from "@/components/CartIcon";


type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export default function ProductPage({ params }: ProductPageProps) {
  const { id } = use(params);
  const product = products.find((item) => item.id === id);

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [message, setMessage] = useState("");

  if (!product) {
    return (
      <main className="min-h-screen bg-[#faf9f6] p-10">
        <h1 className="text-2xl font-semibold">Product not found</h1>
        <Link href="/products" className="mt-4 inline-block underline">
          Back to products
        </Link>
      </main>
    );
  }

  function handleAddToCart() {
  if (!selectedSize || !selectedColor) {
    setMessage("Please select a size and color first.");
    return;
  }

  addToCart(product, selectedSize, selectedColor);
  setMessage(`${product.name} added to cart!`);
}

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      <header className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex items-center gap-6">
  <CartIcon />
  <Link href="/products" className="text-sm text-gray-600 hover:text-black">
    ← All Products
  </Link>
</div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl bg-gray-100">
          <img
            src={product.image}
            alt={product.name}
            className="h-full max-h-[750px] w-full object-cover"
          />
        </div>

        <div className="flex flex-col justify-center">
          <p className="text-sm uppercase tracking-widest text-gray-500">
            {product.brand} · {product.category}
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
            {product.name}
          </h1>

          <p className="mt-4 text-2xl font-semibold">
            ₹{product.price.toLocaleString("en-IN")}
          </p>

          <p className="mt-6 leading-7 text-gray-600">{product.description}</p>

          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold">Color</h2>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    selectedColor === color
                      ? "border-black bg-black text-white"
                      : "border-gray-300 bg-white text-gray-800"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold">Size</h2>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`min-w-12 rounded-md border px-4 py-2 text-sm ${
                    selectedSize === size
                      ? "border-black bg-black text-white"
                      : "border-gray-300 bg-white text-gray-800"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            className="mt-8 rounded-full bg-black px-6 py-4 font-medium text-white transition hover:bg-gray-800"
          >
            Add to Cart
          </button>

          {message && (
            <p className="mt-4 text-sm text-gray-700" role="status">
              {message}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
