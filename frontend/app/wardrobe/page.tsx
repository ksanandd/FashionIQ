"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  getUserWardrobesApi,
  createWardrobeApi,
  getWardrobeItemsApi,
  removeWardrobeItemApi,
  getWardrobeRecommendationsApi,
  type Wardrobe,
  type WardrobeItem,
  type RecommendationProduct,
} from "@/lib/api";
import {
  Layers,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Tag,
  ExternalLink,
  Sun,
  Snowflake,
  CloudRain,
  Compass,
} from "lucide-react";

export default function WardrobePage() {
  return (
    <ProtectedRoute>
      <WardrobeContent />
    </ProtectedRoute>
  );
}

function WardrobeContent() {
  const { token, user } = useAuth();

  const [wardrobes, setWardrobes] = useState<Wardrobe[]>([]);
  const [selectedWardrobeId, setSelectedWardrobeId] = useState<number | null>(null);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Wardrobe modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWardrobeName, setNewWardrobeName] = useState("");
  const [creatingWardrobe, setCreatingWardrobe] = useState(false);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "PURCHASED" | "SAVED">("ALL");
  const [seasonFilter, setSeasonFilter] = useState<"ALL" | "Summer" | "Winter" | "Monsoon" | "All Season">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // AI Wardrobe complementary recommendations
  const [recommendedComplements, setRecommendedComplements] = useState<RecommendationProduct[]>([]);
  const [complementsLoading, setComplementsLoading] = useState(false);

  // 1. Fetch user's wardrobes
  useEffect(() => {
    if (!token) return;

    getUserWardrobesApi(token)
      .then((res) => {
        if (res.success && res.wardrobes.length > 0) {
          setWardrobes(res.wardrobes);
          setSelectedWardrobeId(res.wardrobes[0].wardrobe_id);
        }
      })
      .catch((err) => {
        console.error("Failed to load wardrobes:", err);
        setError("Could not load your digital wardrobe collections.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  // 2. Fetch items for selected wardrobe
  const fetchWardrobeItems = (wId: number) => {
    if (!token) return;
    setItemsLoading(true);
    getWardrobeItemsApi(token, wId, {
      source_type: sourceFilter,
      season: seasonFilter,
      category_id: categoryFilter !== "ALL" ? categoryFilter : undefined,
    })
      .then((res) => {
        if (res.success) {
          setItems(res.items);
        }
      })
      .catch((err) => {
        console.error("Failed to load wardrobe items:", err);
      })
      .finally(() => {
        setItemsLoading(false);
      });
  };

  useEffect(() => {
    if (selectedWardrobeId) {
      fetchWardrobeItems(selectedWardrobeId);
    }
  }, [selectedWardrobeId, sourceFilter, seasonFilter, categoryFilter, token]);

  // Load complementary recommendations based on current wardrobe
  useEffect(() => {
    if (!token) return;
    let isMounted = true;
    setComplementsLoading(true);

    getWardrobeRecommendationsApi(token, 4)
      .then((data) => {
        if (isMounted) {
          setRecommendedComplements(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to load wardrobe recommendations:", err);
      })
      .finally(() => {
        if (isMounted) {
          setComplementsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, items.length]);

  // Distinct categories available in current items
  const availableCategories = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of items) {
      if (item.category_id && item.category_name) {
        map.set(item.category_id, item.category_name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  // Handle creating a new wardrobe
  const handleCreateWardrobe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newWardrobeName.trim()) return;

    setCreatingWardrobe(true);
    setError(null);

    try {
      const res = await createWardrobeApi(token, newWardrobeName.trim());
      if (res.success && res.wardrobe) {
        setWardrobes((prev) => [...prev, res.wardrobe]);
        setSelectedWardrobeId(res.wardrobe.wardrobe_id);
        setNewWardrobeName("");
        setShowCreateModal(false);
        setFeedback(`Created collection "${res.wardrobe.wardrobe_name}"!`);
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create collection.");
    } finally {
      setCreatingWardrobe(false);
    }
  };

  // Handle removing item
  const handleRemoveItem = async (wardrobeItemId: number, itemName: string) => {
    if (!token || !confirm(`Remove "${itemName}" from this wardrobe?`)) return;

    try {
      const res = await removeWardrobeItemApi(token, wardrobeItemId);
      if (res.success) {
        setItems((prev) => prev.filter((i) => i.wardrobe_item_id !== wardrobeItemId));
        setWardrobes((prev) =>
          prev.map((w) =>
            w.wardrobe_id === selectedWardrobeId
              ? { ...w, item_count: Math.max(0, w.item_count - 1) }
              : w
          )
        );
        setFeedback(`Removed "${itemName}" from wardrobe.`);
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to remove item.");
    }
  };

  const currentWardrobe = wardrobes.find((w) => w.wardrobe_id === selectedWardrobeId);

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      <Navbar currentPath="/wardrobe" />

      <section className="mx-auto max-w-7xl px-6 py-10">
        {/* Header with Title and Collection Switcher */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-gray-200/80 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              <Layers size={14} className="text-black" /> Personal Digital Closet
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
              Digital Wardrobe
            </h1>
            <p className="mt-1 text-xs text-gray-600 max-w-xl">
              Organize pieces you own or love. Filter by season, view purchased vs. saved items,
              and prepare your curated looks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Collection Dropdown */}
            {wardrobes.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600">Collection:</label>
                <select
                  value={selectedWardrobeId || ""}
                  onChange={(e) => setSelectedWardrobeId(Number(e.target.value))}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-xs focus:border-black focus:outline-none"
                >
                  {wardrobes.map((w) => (
                    <option key={w.wardrobe_id} value={w.wardrobe_id}>
                      {w.wardrobe_name} ({w.item_count} items)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-800 transition hover:border-black hover:text-black shadow-xs"
            >
              <Plus size={14} /> New Collection
            </button>

            <Link
              href="/outfits"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#c65b3b] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#b04f32]"
            >
              <Sparkles size={14} /> Style Outfits
            </Link>
          </div>
        </div>

        {/* Global Feedback & Error alerts */}
        {feedback && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
            <CheckCircle2 size={16} />
            <span>{feedback}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between text-xs">
            {/* Source Type Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-700 uppercase tracking-wider text-[11px]">
                Source:
              </span>
              <div className="flex rounded-lg bg-gray-100 p-1">
                {(["ALL", "PURCHASED", "SAVED"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSourceFilter(type)}
                    className={`rounded-md px-3 py-1 font-medium transition ${
                      sourceFilter === type
                        ? "bg-white text-gray-900 shadow-xs"
                        : "text-gray-600 hover:text-black"
                    }`}
                  >
                    {type === "ALL" ? "All Items" : type === "PURCHASED" ? "Purchased" : "Saved"}
                  </button>
                ))}
              </div>
            </div>

            {/* Season Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-700 uppercase tracking-wider text-[11px]">
                Season:
              </span>
              <div className="flex rounded-lg bg-gray-100 p-1">
                {(["ALL", "Summer", "Winter", "Monsoon", "All Season"] as const).map((season) => (
                  <button
                    key={season}
                    onClick={() => setSeasonFilter(season)}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      seasonFilter === season
                        ? "bg-white text-gray-900 shadow-xs"
                        : "text-gray-600 hover:text-black"
                    }`}
                  >
                    {season === "ALL" ? "Any" : season}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            {availableCategories.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 uppercase tracking-wider text-[11px]">
                  Category:
                </span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-black focus:outline-none"
                >
                  <option value="ALL">All Categories</option>
                  {availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        {loading || itemsLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
            <p className="mt-4 text-xs font-medium text-gray-500">
              Loading wardrobe pieces...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-600">
              <Layers size={26} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Your wardrobe collection is empty
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
              Save pieces you love from product pages or synchronize your verified purchases
              from your order history.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 transition"
              >
                Browse Catalog <ArrowRight size={16} />
              </Link>
              <Link
                href="/orders"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:border-black transition"
              >
                Order History <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div
                key={item.wardrobe_item_id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs transition hover:shadow-md"
              >
                {/* Product Image */}
                <div className="relative aspect-[3/4] w-full bg-gray-50 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={item.product_name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=600";
                    }}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
                    {/* Source Pill */}
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        item.source_type === "PURCHASED"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-indigo-100 text-indigo-800 border border-indigo-300"
                      }`}
                    >
                      {item.source_type === "PURCHASED" ? "✓ Owned" : "★ Saved"}
                    </span>

                    {/* Season Pill */}
                    <span className="inline-block rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-medium text-gray-700 shadow-xs border border-gray-100">
                      {item.season}
                    </span>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() =>
                      handleRemoveItem(item.wardrobe_item_id, item.product_name)
                    }
                    title="Remove from wardrobe"
                    className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow-xs transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Details */}
                <div className="flex flex-1 flex-col p-4 text-xs">
                  {item.brand_name && (
                    <p className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                      {item.brand_name}
                    </p>
                  )}
                  <h3 className="font-semibold text-gray-900 truncate mt-0.5 text-sm">
                    {item.product_name}
                  </h3>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-gray-600">
                    <span className="rounded bg-stone-100 px-2 py-0.5 font-medium text-stone-700">
                      {item.color}
                    </span>
                    <span className="rounded bg-stone-100 px-2 py-0.5 font-medium text-stone-700">
                      Size {item.size}
                    </span>
                    {item.category_name && (
                      <span className="text-gray-400 text-[11px]">
                        • {item.category_name}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100">
                    <span className="font-bold text-gray-900 text-sm">
                      ₹{Number(item.price).toLocaleString("en-IN")}
                    </span>

                    <Link
                      href={`/products/${item.product_id}`}
                      className="inline-flex items-center gap-1 font-medium text-gray-600 hover:text-black transition"
                    >
                      View <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Style Recommendations: Complete Your Wardrobe */}
        {(recommendedComplements.length > 0 || complementsLoading) && (
          <div className="mt-16 rounded-2xl border border-gray-200/80 bg-white p-8 shadow-xs">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#c65b3b]">
                  <Sparkles size={14} /> AI Wardrobe Pairing
                </div>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900 md:text-2xl">
                  Complete Your Wardrobe
                </h2>
                <p className="mt-1 text-xs text-gray-600">
                  Pieces recommended by our AI engine to complement your current wardrobe categories and colors.
                </p>
              </div>
              <Link
                href="/products"
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-black transition"
              >
                Explore catalog <ArrowRight size={14} />
              </Link>
            </div>

            {complementsLoading ? (
              <div className="py-10 text-center">
                <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-black border-t-transparent" />
                <p className="mt-3 text-xs text-gray-500">
                  Analyzing wardrobe complements...
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
                {recommendedComplements.map((item) => (
                  <div
                    key={item.product_id}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-[#faf9f6] transition hover:shadow-md"
                  >
                    <div className="relative aspect-[3/4] w-full bg-gray-100 overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.product_name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=600";
                        }}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <span className="absolute top-2 left-2 rounded-full bg-black/80 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-semibold text-white flex items-center gap-1">
                        <Sparkles size={10} className="text-amber-400" />
                        {item.reason || "Style Match"}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-3.5 text-xs">
                      <p className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                        {item.brand_name || "FashionIQ"}
                      </p>
                      <h4 className="font-semibold text-gray-900 truncate mt-0.5 text-sm">
                        {item.product_name}
                      </h4>
                      <div className="mt-auto pt-3 flex items-center justify-between border-t border-gray-200/60">
                        <span className="font-bold text-gray-900">
                          ₹{Number(item.price).toLocaleString("en-IN")}
                        </span>
                        <Link
                          href={`/products/${item.product_id}`}
                          className="rounded-full bg-white border border-gray-200 px-3 py-1 font-medium text-gray-800 transition hover:border-black hover:text-black"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal: Create New Collection */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900">
                New Wardrobe Collection
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Organize your clothing into custom seasonal or thematic closets
                (e.g., "Summer Essentials", "Formal Office", "Vacation Looks").
              </p>

              <form onSubmit={handleCreateWardrobe} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                    Collection Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={newWardrobeName}
                    onChange={(e) => setNewWardrobeName(e.target.value)}
                    placeholder="e.g. Summer Resortwear"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-full border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 hover:border-black transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingWardrobe || !newWardrobeName.trim()}
                    className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-40 transition"
                  >
                    {creatingWardrobe ? "Creating..." : "Create Collection"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
