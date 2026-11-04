"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import WishlistButton from "@/components/WishlistButton";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowDown,
  ArrowRight,
  Search,
  Sparkles,
} from "lucide-react";
import {
  getProducts,
  getCategories,
  getUserRecommendationsApi,
  type Product,
  type ApiCategory,
  type RecommendationProduct,
} from "@/lib/api";

const CATEGORY_IMAGES: Record<string, string> = {
  Tops: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=85",
  Bottoms: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=85",
  Outerwear: "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=800&q=85",
  Footwear: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=85",
  Accessories: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
  Clothing: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=85",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function Home() {
  const { token, isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<RecommendationProduct[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [productsData, categoriesData] = await Promise.all([
          getProducts(),
          getCategories(),
        ]);
        setProducts(productsData);

        // Deduplicate categories by category_name
        const seen = new Set<string>();
        const uniqueCategories = categoriesData.filter((cat) => {
          if (seen.has(cat.category_name)) return false;
          seen.add(cat.category_name);
          return true;
        });
        setCategories(uniqueCategories);
      } catch (err) {
        console.error("Failed to load homepage data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    let isMounted = true;
    setRecommendedLoading(true);

    getUserRecommendationsApi(token, 4)
      .then((data) => {
        if (isMounted) {
          setRecommendedProducts(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to load recommendations:", err);
      })
      .finally(() => {
        if (isMounted) {
          setRecommendedLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const term = search.toLowerCase();
    return products.filter((product) =>
      `${product.name} ${product.brand} ${product.category} ${product.description}`
        .toLowerCase()
        .includes(term)
    );
  }, [products, search]);

  return (
    <main>
      <div className="announcement">
        Discover your style. Find your fit. Welcome to FashionIQ.
      </div>

      <Navbar currentPath="/" />

      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">
            <Sparkles size={15} /> YOUR STYLE, REIMAGINED
          </span>
          <h1>
            Fashion that
            <br />
            feels <em>like you.</em>
          </h1>
          <p>
            Discover pieces that match your personality.
            Your next favorite outfit is just a little inspiration away.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/products" className="button button-dark">
              Explore collection <ArrowRight size={17} />
            </Link>
            <Link href="/outfits" className="button button-outline flex items-center gap-2">
              <Sparkles size={16} /> Outfit Studio
            </Link>
          </div>

          <div className="hero-note">
            <span className="hero-note-line" />
            Thoughtfully curated. Uniquely yours.
          </div>
        </div>

        <div className="hero-image">
          <div className="hero-image-overlay">
            <span>THE NEW SEASON</span>
            <strong>Effortless elegance</strong>
          </div>
          <div className="hero-image-index">01 / 03</div>
        </div>

        <a href="#categories" className="scroll-indicator">
          <ArrowDown size={16} /> SCROLL TO DISCOVER
        </a>
      </section>

      <section className="categories section" id="categories">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIND YOUR VIBE</span>
            <h2>Explore by category</h2>
          </div>
          <Link href="/products" className="text-link">
            View all <ArrowRight size={16} />
          </Link>
        </div>

        <div className="category-grid">
          {categories.slice(0, 4).map((category, index) => {
            const bgImage =
              CATEGORY_IMAGES[category.category_name] ||
              CATEGORY_IMAGES.Clothing;

            return (
              <Link
                href={`/products?category_id=${category.category_id}`}
                className="category-card"
                key={category.category_id}
              >
                <div
                  className="category-image"
                  style={{ backgroundImage: `url("${bgImage}")` }}
                />
                <div className="category-info">
                  <span>0{index + 1}</span>
                  <div>
                    <h3>{category.category_name}</h3>
                    <p>{category.description || "Explore collection"}</p>
                  </div>
                  <ArrowRight size={20} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* AI Recommendations Section */}
      {(recommendedProducts.length > 0 || recommendedLoading) && (
        <section className="recommendations section" id="recommendations">
          <div className="section-heading">
            <div>
              <span className="eyebrow flex items-center gap-1.5 text-[#c65b3b]">
                <Sparkles size={14} /> CURATED BY AI
              </span>
              <h2>Recommended For You</h2>
              <p className="section-description">
                {isAuthenticated
                  ? "Tailored to your style profile, recent interactions, and preferences."
                  : "Curated selections powered by AI embeddings and fashion intelligence."}
              </p>
            </div>
            <Link href="/products" className="text-link">
              Explore all <ArrowRight size={16} />
            </Link>
          </div>

          {recommendedLoading ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-black border-t-transparent" />
              <p className="mt-3 text-xs text-gray-500">
                Generating personalized recommendations...
              </p>
            </div>
          ) : (
            <div className="product-grid">
              {recommendedProducts.map((product) => (
                <article className="product-card" key={product.product_id}>
                  <div
                    className="product-image"
                    style={{ backgroundImage: `url("${product.image_url}")` }}
                  >
                    <span className="product-badge bg-black/80 backdrop-blur-xs text-white border-0 text-[10px] flex items-center gap-1">
                      <Sparkles size={11} className="text-amber-400" />
                      {product.reason || "AI Match"}
                    </span>
                    <div className="absolute right-3 top-3">
                      <WishlistButton productId={String(product.product_id)} />
                    </div>
                  </div>

                  <Link href={`/products/${product.product_id}`} className="block">
                    <div className="product-info">
                      <span className="product-brand">
                        {product.brand_name || "FashionIQ"}
                      </span>
                      <h3>{product.product_name}</h3>
                      <span className="product-price">
                        {formatPrice(Number(product.price))}
                      </span>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="trending section" id="trending">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE EDIT</span>
            <h2>Trending right now</h2>
            <p className="section-description">
              Pieces you'll love, picked just for your style.
            </p>
          </div>

          <label className="product-search">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search products..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
            <p className="mt-4 text-sm text-gray-500">Loading catalog pieces...</p>
          </div>
        ) : (
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div
                  className="product-image"
                  style={{ backgroundImage: `url("${product.image}")` }}
                >
                  {product.badge && (
                    <span className="product-badge">{product.badge}</span>
                  )}
                  <div className="absolute right-3 top-3">
                    <WishlistButton productId={product.id} />
                  </div>
                </div>

                <Link href={`/products/${product.id}`} className="block">
                  <div className="product-info">
                    <span className="product-brand">{product.brand}</span>
                    <h3>{product.name}</h3>
                    <span className="product-price">
                      {formatPrice(product.price)}
                    </span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}

        {!loading && filteredProducts.length === 0 && (
          <p className="empty-state">
            No products found. Try a different search.
          </p>
        )}

        <div className="center-action">
          <Link href="/products" className="button button-outline">
            Discover more <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <section className="personalized" id="about">
        <div className="personalized-icon">
          <Sparkles size={24} />
        </div>
        <span className="eyebrow">MEET YOUR PERSONAL STYLIST</span>
        <h2>
          Your taste.
          <br />
          Your trends. <em>Your FashionIQ.</em>
        </h2>
        <p>
          We're bringing intelligent recommendations and personal style
          together to make finding what you love feel effortless.
        </p>
        <Link href="/products" className="button button-dark">
          Find your style <ArrowRight size={17} />
        </Link>
      </section>

      <footer className="footer">
        <Link href="/" className="logo">
          fashion<span>IQ</span>
          <Sparkles size={14} className="logo-sparkle" />
        </Link>
        <p>Style, discovered differently.</p>
        <span>© 2026 FashionIQ. All rights reserved.</span>
      </footer>
    </main>
  );
}
