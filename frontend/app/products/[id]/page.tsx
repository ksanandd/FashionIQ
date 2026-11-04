"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  getProductById,
  getProductVariants,
  addWardrobeItemApi,
  getSimilarProductsApi,
  getProductOutfitsApi,
  type Product,
  type ApiVariant,
  type RecommendationProduct,
  type Outfit,
} from "@/lib/api";
import { addToCart } from "@/lib/cart";
import { trackInteraction } from "@/lib/interactions";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import WishlistButton from "@/components/WishlistButton";
import { ArrowLeft, ArrowRight, Check, ShoppingBag, Layers, AlertCircle, Sun, CloudRain, Snowflake, Sparkles } from "lucide-react";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export default function ProductPage({ params }: ProductPageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#faf9f6] p-10 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Loading product...</p>
        </main>
      }
    >
      <ProductPageContent params={params} />
    </Suspense>
  );
}

function ProductPageContent({ params }: ProductPageProps) {
  const { id } = use(params);
  const { token, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ApiVariant[]>([]);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Similar products recommendations state
  const [similarProducts, setSimilarProducts] = useState<RecommendationProduct[]>([]);
  const [similarLoading, setSimilarLoading] = useState(true);

  // Complete the look outfits state
  const [lookOutfits, setLookOutfits] = useState<Outfit[]>([]);
  const [lookLoading, setLookLoading] = useState(true);

  // Wardrobe addition state
  const [selectedSeason, setSelectedSeason] = useState<"All Season" | "Summer" | "Winter" | "Monsoon">("All Season");
  const [wardrobeLoading, setWardrobeLoading] = useState(false);
  const [wardrobeSuccess, setWardrobeSuccess] = useState<string | null>(null);
  const [wardrobeError, setWardrobeError] = useState<string | null>(null);

  async function handleAddToWardrobe() {
    setWardrobeSuccess(null);
    setWardrobeError(null);

    if (!isAuthenticated || !token) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!selectedVariant) {
      setWardrobeError("Please choose a color and size first.");
      return;
    }

    setWardrobeLoading(true);
    try {
      const res = await addWardrobeItemApi(token, {
        variant_id: selectedVariant.variant_id,
        season: selectedSeason,
        source_type: "SAVED",
      });

      if (res.success) {
        setWardrobeSuccess(`Added to your Digital Wardrobe (${selectedSeason})!`);
      } else {
        setWardrobeError(res.message || "Could not add to wardrobe.");
      }
    } catch (err: any) {
      setWardrobeError(err.message || "Failed to add to wardrobe.");
    } finally {
      setWardrobeLoading(false);
    }
  }

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

        // Pre-select first available in-stock color & size
        if (variantData.length > 0) {
          const firstInStock = variantData.find((v) => v.stock_quantity > 0) || variantData[0];
          setSelectedColor(firstInStock.color);
          setSelectedSize(firstInStock.size);
        }

        // Track VIEW interaction
        trackInteraction(id, "VIEW");
      } catch (err) {
        console.error("Failed to load product:", err);
        setError("Unable to load this product.");
      } finally {
        setLoading(false);
      }
    }

    loadProduct();

    let isMounted = true;
    setSimilarLoading(true);
    getSimilarProductsApi(id, 4)
      .then((data) => {
        if (isMounted) {
          setSimilarProducts(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to load similar products:", err);
      })
      .finally(() => {
        if (isMounted) {
          setSimilarLoading(false);
        }
      });

    setLookLoading(true);
    getProductOutfitsApi(id, 2)
      .then((data) => {
        if (isMounted) {
          setLookOutfits(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to load product outfits:", err);
      })
      .finally(() => {
        if (isMounted) {
          setLookLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const colors = [...new Set(variants.map((variant) => variant.color))];

  const allSizes = [...new Set(variants.map((variant) => variant.size))];

  const selectedVariant = variants.find(
    (variant) =>
      variant.color === selectedColor &&
      variant.size === selectedSize
  );

  function handleColorChange(color: string) {
    setSelectedColor(color);
    const colorVariants = variants.filter((v) => v.color === color);
    const hasCurrentSize = colorVariants.some((v) => v.size === selectedSize);
    if (!hasCurrentSize) {
      const inStock = colorVariants.find((v) => v.stock_quantity > 0) || colorVariants[0];
      setSelectedSize(inStock?.size || "");
    }
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

    // Track ADD_TO_CART interaction
    trackInteraction(product.id, "ADD_TO_CART", selectedVariant.variant_id);

    setMessage(`${product.name} (${selectedVariant.color}, Size ${selectedVariant.size}) added to cart!`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#faf9f6] p-20 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
        <p className="mt-4 text-sm text-gray-500">Loading piece details...</p>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-screen bg-[#faf9f6] p-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900">
            {error || "Product not found"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            This item may be unavailable or moved.
          </p>
          <Link
            href="/products"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-6 py-2.5 text-xs font-medium text-white hover:bg-gray-800"
          >
            <ArrowLeft size={14} /> Back to Products
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      {/* Header */}
      <Navbar />

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-12 md:grid-cols-2">
        {/* Product Image */}
        <div className="relative overflow-hidden rounded-2xl bg-gray-100 shadow-xs">
          <img
            src={product.image}
            alt={product.name}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=600";
            }}
            className="h-full max-h-[650px] w-full object-cover"
          />
          <div className="absolute right-4 top-4">
            <WishlistButton productId={product.id} />
          </div>
        </div>

        {/* Product Info & Variant Selection */}
        <div className="flex flex-col justify-center py-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-[#c65b3b]">
            <span>{product.brand}</span>
            {product.gender && (
              <span className="rounded-full bg-gray-100 px-3 py-1 font-normal text-gray-600">
                {product.gender}
              </span>
            )}
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
            {product.name}
          </h1>

          <p className="mt-4 text-3xl font-semibold text-gray-900">
            ₹{Number(selectedVariant?.price ?? product.price).toLocaleString("en-IN")}
          </p>

          <p className="mt-4 leading-relaxed text-gray-600">
            {product.description}
          </p>

          {/* Color Selection */}
          <div className="mt-8 border-t border-gray-200 pt-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                Color: <span className="font-normal text-gray-900">{selectedColor || "Select"}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                    selectedColor === color
                      ? "border-black bg-black text-white"
                      : "border-gray-300 bg-white text-gray-800 hover:border-black"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                Size: <span className="font-normal text-gray-900">{selectedSize || "Select"}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {allSizes.map((size) => {
                const variantForSize = variants.find(
                  (v) => v.color === selectedColor && v.size === size
                );
                const isOfferedInColor = Boolean(variantForSize);
                const isOutOfStock = isOfferedInColor && variantForSize!.stock_quantity <= 0;
                const isSelected = selectedSize === size && isOfferedInColor;

                return (
                  <button
                    key={size}
                    type="button"
                    disabled={!isOfferedInColor}
                    onClick={() => {
                      setSelectedSize(size);
                      setMessage("");
                    }}
                    title={
                      !isOfferedInColor
                        ? `Size ${size} is not available in ${selectedColor || "this color"}`
                        : isOutOfStock
                        ? `Size ${size} is out of stock`
                        : `Size ${size} (${variantForSize!.stock_quantity} available)`
                    }
                    className={`min-w-12 rounded-lg border px-4 py-2 text-xs font-medium transition ${
                      !isOfferedInColor
                        ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed line-through opacity-50"
                        : isSelected
                        ? isOutOfStock
                          ? "border-red-500 bg-red-600 text-white"
                          : "border-black bg-black text-white"
                        : isOutOfStock
                        ? "border-red-200 bg-red-50/50 text-red-600 hover:border-red-400"
                        : "border-gray-300 bg-white text-gray-800 hover:border-black"
                    }`}
                  >
                    <span>{size}</span>
                    {isOutOfStock && <span className="block text-[9px] font-normal">Out</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stock Availability Indicator */}
          {selectedVariant ? (
            <p className="mt-4 text-xs font-medium">
              {selectedVariant.stock_quantity > 0 ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  ✓ In Stock ({selectedVariant.stock_quantity} available)
                </span>
              ) : (
                <span className="text-red-600 font-semibold flex items-center gap-1">
                  ✕ Out of Stock (0 available)
                </span>
              )}
            </p>
          ) : (
            selectedColor && selectedSize && (
              <p className="mt-4 text-xs font-medium text-amber-600">
                ⚠ Selected combination ({selectedColor} / {selectedSize}) is not available.
              </p>
            )
          )}

          {/* Add to Cart & Wardrobe Actions */}
          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleAddToCart}
              disabled={!selectedVariant || selectedVariant.stock_quantity <= 0}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-black px-6 py-3.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShoppingBag size={18} />
              {!selectedVariant
                ? "Select Available Variant"
                : selectedVariant.stock_quantity <= 0
                ? "Out of Stock"
                : "Add to Cart"}
            </button>
            <button
              onClick={handleAddToWardrobe}
              disabled={!selectedVariant || wardrobeLoading}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-5 py-3.5 text-sm font-medium text-gray-800 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Layers size={18} />
              {wardrobeLoading ? "Saving..." : "Add to Wardrobe"}
            </button>
          </div>

          {/* Season Selector for Wardrobe */}
          <div className="mt-4 rounded-xl border border-gray-100 bg-[#faf9f6] p-3 text-xs text-gray-600">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-gray-700">Digital Wardrobe Season:</span>
              <div className="flex flex-wrap gap-1">
                {(["All Season", "Summer", "Winter", "Monsoon"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSeason(s)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      selectedSeason === s
                        ? "bg-black text-white"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Confirmation Message */}
          {message && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
              <Check size={16} />
              <span>{message}</span>
            </div>
          )}

          {/* Wardrobe Success Message */}
          {wardrobeSuccess && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800 border border-emerald-200">
              <Check size={16} />
              <span>{wardrobeSuccess}</span>
            </div>
          )}

          {/* Wardrobe Error Message */}
          {wardrobeError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800 border border-amber-200">
              <AlertCircle size={16} />
              <span>{wardrobeError}</span>
            </div>
          )}
        </div>
      </section>

      {/* Complete the Look Section */}
      {lookOutfits.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-12 border-t border-gray-200/80">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#c65b3b]">
                <Sparkles size={14} /> Complete The Look
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
                Curated Outfits With This Piece
              </h2>
              <p className="mt-1 text-xs text-gray-600">
                Stylist-approved ensembles designed around this product with color coordination and category balance.
              </p>
            </div>
            <Link
              href="/outfits"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#c65b3b] hover:underline transition"
            >
              Explore all outfits <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {lookOutfits.map((outfit, oIdx) => (
              <div
                key={oIdx}
                className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      {outfit.match_score ? `${Math.round(outfit.match_score * 100)}% Coordinated` : "Coordinated"}
                    </span>
                    <span className="text-xs font-semibold text-gray-500">
                      {outfit.occasion} • {outfit.season}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-bold text-gray-900">{outfit.outfit_name}</h3>
                  <p className="mt-1 text-xs text-gray-600">{outfit.description}</p>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {outfit.items.map((it, itIdx) => (
                      <Link
                        key={itIdx}
                        href={`/products/${it.product_id}`}
                        className="group flex flex-col rounded-xl border border-gray-100 bg-gray-50/50 p-2 text-center transition hover:border-gray-300 hover:bg-white"
                      >
                        <span className="text-[9px] font-bold text-gray-400 uppercase">{it.role}</span>
                        <div className="my-1.5 h-16 w-full overflow-hidden rounded-md bg-white">
                          {it.image_url ? (
                            <img src={it.image_url} alt={it.product_name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                              {it.color}
                            </div>
                          )}
                        </div>
                        <p className="line-clamp-1 text-[11px] font-bold text-gray-900 group-hover:text-[#c65b3b]">
                          {it.product_name}
                        </p>
                        <p className="text-[10px] text-gray-500">₹{it.price.toLocaleString("en-IN")}</p>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs">
                  <div>
                    <span className="text-gray-500">Outfit Total:</span>{" "}
                    <span className="font-bold text-gray-900">₹{outfit.purchase_price.toLocaleString("en-IN")}</span>
                  </div>
                  <Link
                    href="/outfits"
                    className="font-semibold text-[#c65b3b] hover:underline"
                  >
                    View in Outfit Studio →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Similar Products Section */}
      {(similarProducts.length > 0 || similarLoading) && (
        <section className="mx-auto max-w-7xl px-6 py-16 border-t border-gray-200/80">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#c65b3b]">
                <Sparkles size={14} /> AI Recommendation Engine
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
                Similar Products You May Like
              </h2>
              <p className="mt-1 text-xs text-gray-600">
                Semantically and visually aligned with this piece using deep vector embeddings.
              </p>
            </div>
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-black transition"
            >
              View catalog <ArrowRight size={14} />
            </Link>
          </div>

          {similarLoading ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-black border-t-transparent" />
              <p className="mt-3 text-xs text-gray-500">
                Searching vector space for similar pieces...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {similarProducts.map((simProduct) => (
                <div
                  key={simProduct.product_id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs transition hover:shadow-md"
                >
                  <div className="relative aspect-[3/4] w-full bg-gray-50 overflow-hidden">
                    <img
                      src={simProduct.image_url}
                      alt={simProduct.product_name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=600";
                      }}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    {simProduct.similarity_score !== undefined && (
                      <span className="absolute top-2.5 left-2.5 rounded-full bg-black/75 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-semibold text-white">
                        {Math.round(simProduct.similarity_score * 100)}% Match
                      </span>
                    )}
                    <div className="absolute top-2.5 right-2.5">
                      <WishlistButton productId={String(simProduct.product_id)} />
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4 text-xs">
                    <p className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                      {simProduct.brand_name || "FashionIQ"}
                    </p>
                    <h3 className="font-semibold text-gray-900 truncate mt-0.5 text-sm">
                      {simProduct.product_name}
                    </h3>
                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100">
                      <span className="font-bold text-gray-900 text-sm">
                        ₹{Number(simProduct.price).toLocaleString("en-IN")}
                      </span>
                      <Link
                        href={`/products/${simProduct.product_id}`}
                        className="rounded-full bg-stone-100 px-3 py-1 font-medium text-stone-800 transition hover:bg-black hover:text-white"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
