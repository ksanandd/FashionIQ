"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import {
  getProductById,
  getProductVariants,
  type Product,
  type ApiVariant,
} from "@/lib/api";
import { addToCart } from "@/lib/cart";
import CartIcon from "@/components/CartIcon";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export default function ProductPage({ params }: ProductPageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#faf9f6] p-10 text-center">
          Loading product...
        </main>
      }
    >
      <ProductPageContent params={params} />
    </Suspense>
  );
}

function ProductPageContent({ params }: ProductPageProps) {
  const { id } = use(params);

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ApiVariant[]>([]);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        setError("");

        const [productData, variantData] = await Promise.all([
          getProductById(id),
          getProductVariants(id),
        ]);

        setProduct(productData);
        setVariants(variantData);
      } catch (err) {
        console.error("Failed to load product:", err);
        setError("Unable to load this product.");
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [id]);

  const colors = [...new Set(variants.map((variant) => variant.color))];

  const sizes = [
    ...new Set(
      variants
        .filter(
          (variant) =>
            !selectedColor || variant.color === selectedColor
        )
        .map((variant) => variant.size)
    ),
  ];

  const selectedVariant = variants.find(
    (variant) =>
      variant.color === selectedColor &&
      variant.size === selectedSize
  );

  function handleColorChange(color: string) {
    setSelectedColor(color);
    setSelectedSize("");
    setMessage("");
  }

  function handleAddToCart() {
    if (!product || !selectedVariant) {
      setMessage("Please select an available color and size.");
      return;
    }

    if (selectedVariant.stock_quantity <= 0) {
      setMessage("Sorry, this variant is out of stock.");
      return;
    }

    addToCart(
      product,
      selectedVariant.variant_id,
      selectedVariant.size,
      selectedVariant.color,
      Number(selectedVariant.price)
    );

    setMessage(`${product.name} added to cart!`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#faf9f6] p-10 text-center">
        Loading product...
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-screen bg-[#faf9f6] p-10">
        <h1 className="text-2xl font-semibold">
          {error || "Product not found"}
        </h1>
        <Link href="/products" className="mt-4 inline-block underline">
          Back to products
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      <header className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex items-center gap-6">
          <CartIcon />
          <Link
            href="/products"
            className="text-sm text-gray-600 hover:text-black"
          >
            ← Back to Products
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-12 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl bg-gray-100">
          <img
            src={product.image}
            alt={product.name}
            className="h-full max-h-[650px] w-full object-cover"
          />
        </div>

        <div className="py-6">
          <p className="text-sm uppercase tracking-widest text-gray-500">
            {product.brand}
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
            {product.name}
          </h1>

          <p className="mt-4 text-2xl font-semibold">
            ₹{Number(selectedVariant?.price ?? product.price).toLocaleString("en-IN")}
          </p>

          <p className="mt-6 leading-7 text-gray-600">
            {product.description}
          </p>

          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold">Color</h2>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
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
              {sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setSelectedSize(size);
                    setMessage("");
                  }}
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

          {selectedVariant && (
            <p className="mt-4 text-sm text-gray-600">
              {selectedVariant.stock_quantity} items available
            </p>
          )}

          <button
            onClick={handleAddToCart}
            disabled={!selectedVariant || selectedVariant.stock_quantity <= 0}
            className="mt-8 rounded-full bg-black px-6 py-4 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
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
