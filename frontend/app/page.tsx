"use client";

import Link from "next/link";
import CartIcon from "@/components/CartIcon";
import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

const categories = [
  {
    name: "Women's Wear",
    count: "Explore collection",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=85",
  },
  {
    name: "Men's Wear",
    count: "Explore collection",
    image:
      "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=800&q=85",
  },
  {
    name: "Accessories",
    count: "Explore collection",
    image:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
  },
];

const products = [
  {
    id: 1,
    name: "Relaxed Linen Shirt",
    brand: "MANGO",
    price: 2499,
    category: "Men",
    image:
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=700&q=85",
    badge: "Bestseller",
  },
  {
    id: 2,
    name: "Everyday Denim Jacket",
    brand: "LEVI'S",
    price: 3999,
    category: "Women",
    image:
      "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=700&q=85",
    badge: "Trending",
  },
  {
    id: 3,
    name: "Classic White Sneakers",
    brand: "PUMA",
    price: 3299,
    category: "Unisex",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85",
    badge: "New arrival",
  },
  {
    id: 4,
    name: "Minimal Everyday Tote",
    brand: "ZARA",
    price: 1899,
    category: "Accessories",
    image:
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=700&q=85",
    badge: "",
  },
];

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.brand} ${product.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function toggleFavorite(id: number) {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((favorite) => favorite !== id)
        : [...current, id],
    );
  }

  return (
    <main>
      <div className="announcement">
        Discover your style. Find your fit. Welcome to FashionIQ.
      </div>

      <header className="navbar">
        <a href="#" className="logo" aria-label="FashionIQ home">
          fashion<span>IQ</span>
          <Sparkles size={15} className="logo-sparkle" />
        </a>

        <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
          <a href="#categories" onClick={() => setMenuOpen(false)}>
            Discover
          </a>
          <a href="#trending" onClick={() => setMenuOpen(false)}>
            Trending
          </a>
          <a href="#about" onClick={() => setMenuOpen(false)}>
            Our story
          </a>
	<Link
  href="/wishlist"
  className="text-sm text-gray-700 hover:text-black"
>
  Wishlist
</Link>

<CartIcon />
        </nav>

        <div className="nav-actions">
          <a href="#trending" aria-label="Search products">
            <Search size={20} />
          </a>
          <a href="#trending" aria-label="Your wishlist">
            <Heart size={20} />
            {favorites.length > 0 && (
              <span className="nav-count">{favorites.length}</span>
            )}
          </a>
          <a href="#trending" aria-label="Shopping bag">
            <ShoppingBag size={20} />
          </a>
          <a href="/login" aria-label="Your account">
            <UserRound size={20} />
          </a>
        </div>

        <button
          className="mobile-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </header>

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
          <a href="#trending" className="button button-dark">
            Explore collection <ArrowRight size={17} />
          </a>

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
          <a href="#trending" className="text-link">
            View all <ArrowRight size={16} />
          </a>
        </div>

        <div className="category-grid">
          {categories.map((category, index) => (
            <a
              href="#trending"
              className="category-card"
              key={category.name}
            >
              <div
                className="category-image"
                style={{ backgroundImage: `url("${category.image}")` }}
              />
              <div className="category-info">
                <span>0{index + 1}</span>
                <div>
                  <h3>{category.name}</h3>
                  <p>{category.count}</p>
                </div>
                <ArrowRight size={20} />
              </div>
            </a>
          ))}
        </div>
      </section>

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
                <button
                  className={`favorite-button ${
                    favorites.includes(product.id) ? "is-favorite" : ""
                  }`}
                  onClick={() => toggleFavorite(product.id)}
                  aria-label={
                    favorites.includes(product.id)
                      ? "Remove from wishlist"
                      : "Add to wishlist"
                  }
                >
                  <Heart
                    size={19}
                    fill={favorites.includes(product.id) ? "currentColor" : "none"}
                  />
                </button>
              </div>

              <div className="product-info">
                <span className="product-brand">{product.brand}</span>
                <h3>{product.name}</h3>
                <span className="product-price">
                  {formatPrice(product.price)}
                </span>
              </div>
            </article>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <p className="empty-state">
            No products found. Try a different search.
          </p>
        )}

        <div className="center-action">
          <a href="#categories" className="button button-outline">
            Discover more <ArrowRight size={17} />
          </a>
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
        <a href="#trending" className="button button-dark">
          Find your style <ArrowRight size={17} />
        </a>
      </section>

      <footer className="footer">
        <a href="#" className="logo">
          fashion<span>IQ</span>
          <Sparkles size={14} className="logo-sparkle" />
        </a>
        <p>Style, discovered differently.</p>
        <span>© 2026 FashionIQ. All rights reserved.</span>
      </footer>
    </main>
  );
}
