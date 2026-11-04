"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  getPersonalizedOutfitsApi,
  getWardrobeOutfitsApi,
  getSavedOutfitsApi,
  saveOutfitApi,
  deleteSavedOutfitApi,
  type Outfit,
  type OutfitItem,
  type Product,
} from "@/lib/api";
import { addToCart } from "@/lib/cart";
import {
  Sparkles,
  Layers,
  Bookmark,
  ShoppingBag,
  Trash2,
  Check,
  Filter,
  DollarSign,
  Palette,
  Sun,
  Snowflake,
  CloudRain,
  Compass,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Clock,
} from "lucide-react";

export default function OutfitsPage() {
  return (
    <ProtectedRoute>
      <OutfitsContent />
    </ProtectedRoute>
  );
}

function OutfitsContent() {
  const { token, user } = useAuth();

  // Active view: "RECOMMENDED" | "WARDROBE" | "SAVED"
  const [activeTab, setActiveTab] = useState<"RECOMMENDED" | "WARDROBE" | "SAVED">("RECOMMENDED");

  // Data states
  const [recommendedOutfits, setRecommendedOutfits] = useState<Outfit[]>([]);
  const [wardrobeOutfits, setWardrobeOutfits] = useState<Outfit[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<Outfit[]>([]);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Saving state
  const [savingOutfitId, setSavingOutfitId] = useState<string | number | null>(null);
  const [savedSuccessIds, setSavedSuccessIds] = useState<Set<string | number>>(new Set());

  // Filter states
  const [occasionFilter, setOccasionFilter] = useState<string>("All");
  const [seasonFilter, setSeasonFilter] = useState<string>("All");
  const [budgetFilter, setBudgetFilter] = useState<string>("All");

  // Load Outfits based on Active Tab & Filters
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const budgetMax =
      budgetFilter === "All"
        ? undefined
        : budgetFilter === "3000"
        ? 3000
        : budgetFilter === "4500"
        ? 4500
        : budgetFilter === "6000"
        ? 6000
        : undefined;

    const filterParams = {
      occasion: occasionFilter,
      season: seasonFilter,
      budget_max: budgetMax,
      limit: 6,
    };

    if (activeTab === "RECOMMENDED") {
      getPersonalizedOutfitsApi(token, filterParams)
        .then((outfits) => {
          if (isMounted) {
            setRecommendedOutfits(outfits);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error("Failed to load recommended outfits:", err);
            setError("Unable to load recommended outfits at this time.");
            setLoading(false);
          }
        });
    } else if (activeTab === "WARDROBE") {
      getWardrobeOutfitsApi(token, filterParams)
        .then((outfits) => {
          if (isMounted) {
            setWardrobeOutfits(outfits);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error("Failed to load wardrobe outfits:", err);
            setError("Unable to load wardrobe-anchored outfits.");
            setLoading(false);
          }
        });
    } else if (activeTab === "SAVED") {
      getSavedOutfitsApi(token)
        .then((outfits) => {
          if (isMounted) {
            setSavedOutfits(outfits);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error("Failed to load saved outfits:", err);
            setError("Unable to load your saved outfits.");
            setLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [token, activeTab, occasionFilter, seasonFilter, budgetFilter]);

  // Handle Save Outfit
  const handleSaveOutfit = async (outfit: Outfit, index: number) => {
    if (!token) return;
    const outfitKey = outfit.outfit_id ?? index;
    setSavingOutfitId(outfitKey);

    try {
      const payload = {
        outfit_name: outfit.outfit_name,
        occasion: outfit.occasion,
        season: outfit.season,
        total_price: outfit.total_retail_price,
        description: outfit.description || outfit.color_rationale,
        items: outfit.items.map((it) => ({
          variant_id: it.variant_id,
          role: it.role,
          price: it.price,
          is_owned: it.is_owned,
        })),
      };

      const res = await saveOutfitApi(token, payload);
      if (res.success) {
        setSavedSuccessIds((prev) => new Set(prev).add(outfitKey));
        setFeedback(`"${outfit.outfit_name}" has been saved to your collection!`);
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      console.error("Failed to save outfit:", err);
      setFeedback("Failed to save outfit. Please try again.");
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setSavingOutfitId(null);
    }
  };

  // Handle Delete Saved Outfit
  const handleDeleteSavedOutfit = async (outfitId: number) => {
    if (!token) return;
    try {
      const res = await deleteSavedOutfitApi(token, outfitId);
      if (res.success) {
        setSavedOutfits((prev) => prev.filter((o) => Number(o.outfit_id) !== outfitId));
        setFeedback("Outfit removed from your saved collection.");
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err) {
      console.error("Failed to delete saved outfit:", err);
      setFeedback("Failed to delete outfit.");
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // Handle Add Unowned Outfit Items to Cart
  const handleAddOutfitToCart = (outfit: Outfit) => {
    const unownedItems = outfit.items.filter((it) => !it.is_owned);
    if (!unownedItems.length) {
      setFeedback("You already own all items in this outfit!");
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    let addedCount = 0;
    unownedItems.forEach((it) => {
      const productObj: Product = {
        id: String(it.product_id),
        name: it.product_name,
        brand: it.brand_name,
        category: it.category_name,
        price: it.price,
        gender: it.gender || "Unisex",
        image: it.image_url || "/placeholder-product.png",
        description: "",
        colors: [it.color],
        sizes: [it.size],
      };
      addToCart(productObj, it.variant_id, it.size, it.color, it.price);
      addedCount++;
    });

    setFeedback(`Added ${addedCount} unowned piece(s) from "${outfit.outfit_name}" to your cart!`);
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <Navbar currentPath="/outfits" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#faece7] px-3 py-1 text-xs font-semibold text-[#c65b3b]">
              <Sparkles size={13} />
              AI Outfit Recommendation Studio
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Coordinated Outfits
            </h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base">
              Explore complete ensembles styled by AI using your Digital Wardrobe, color harmony, and budget.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/wardrobe"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <Layers size={16} />
              My Digital Wardrobe
            </Link>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="mb-6 flex items-center justify-between rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-emerald-400" />
              <span>{feedback}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap border-b border-gray-200">
          <button
            onClick={() => setActiveTab("RECOMMENDED")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "RECOMMENDED"
                ? "border-[#c65b3b] text-[#c65b3b]"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            <Sparkles size={16} />
            Curated For You
          </button>
          <button
            onClick={() => setActiveTab("WARDROBE")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "WARDROBE"
                ? "border-[#c65b3b] text-[#c65b3b]"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            <Layers size={16} />
            Style From My Wardrobe
          </button>
          <button
            onClick={() => setActiveTab("SAVED")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "SAVED"
                ? "border-[#c65b3b] text-[#c65b3b]"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            <Bookmark size={16} />
            Saved Outfits
            {savedOutfits.length > 0 && (
              <span className="ml-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                {savedOutfits.length}
              </span>
            )}
          </button>
        </div>

        {/* Filters Bar (Only for Recommended & Wardrobe tabs) */}
        {activeTab !== "SAVED" && (
          <div className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            {/* Occasion Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Occasion:</span>
              <select
                value={occasionFilter}
                onChange={(e) => setOccasionFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm focus:border-[#c65b3b] focus:outline-none"
              >
                <option value="All">All Occasions</option>
                <option value="Casual">Casual</option>
                <option value="Sports">Sports / Active</option>
                <option value="Formal">Formal / Smart</option>
                <option value="Party">Party / Evening</option>
                <option value="College">College / Campus</option>
              </select>
            </div>

            {/* Season Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Season:</span>
              <select
                value={seasonFilter}
                onChange={(e) => setSeasonFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm focus:border-[#c65b3b] focus:outline-none"
              >
                <option value="All">All Seasons</option>
                <option value="Summer">Summer</option>
                <option value="Winter">Winter</option>
                <option value="Monsoon">Monsoon</option>
                <option value="All Season">Year-Round</option>
              </select>
            </div>

            {/* Budget Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Max Budget:</span>
              <select
                value={budgetFilter}
                onChange={(e) => setBudgetFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm focus:border-[#c65b3b] focus:outline-none"
              >
                <option value="All">No Budget Cap</option>
                <option value="3000">Under ₹3,000</option>
                <option value="4500">Under ₹4,500</option>
                <option value="6000">Under ₹6,000</option>
              </select>
            </div>
          </div>
        )}

        {/* Content Body */}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="mb-4 h-6 w-1/3 rounded bg-gray-200"></div>
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="h-44 rounded-xl bg-gray-200"></div>
                  <div className="h-44 rounded-xl bg-gray-200"></div>
                </div>
                <div className="h-4 w-2/3 rounded bg-gray-200"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <AlertCircle size={28} className="mx-auto mb-2 text-red-500" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : activeTab === "SAVED" ? (
          // SAVED OUTFITS LIST
          savedOutfits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
              <Bookmark size={40} className="mx-auto mb-3 text-gray-300" />
              <h3 className="text-lg font-bold text-gray-900">No saved outfits yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Browse Curated Outfits or Style From Your Wardrobe, then click "Save Outfit" to build your collection.
              </p>
              <button
                onClick={() => setActiveTab("RECOMMENDED")}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#c65b3b] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#b04f32]"
              >
                <Sparkles size={15} />
                Explore Recommended Outfits
              </button>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-2">
              {savedOutfits.map((outfit) => (
                <SavedOutfitCard
                  key={outfit.outfit_id}
                  outfit={outfit}
                  onDelete={handleDeleteSavedOutfit}
                  onAddToCart={handleAddOutfitToCart}
                />
              ))}
            </div>
          )
        ) : (
          // RECOMMENDED & WARDROBE OUTFITS LIST
          (() => {
            const currentOutfits = activeTab === "RECOMMENDED" ? recommendedOutfits : wardrobeOutfits;
            if (currentOutfits.length === 0) {
              return (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
                  <Compass size={40} className="mx-auto mb-3 text-gray-300" />
                  <h3 className="text-lg font-bold text-gray-900">No outfits matched your criteria</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your occasion, season, or budget filter to see more combinations.
                  </p>
                  <button
                    onClick={() => {
                      setOccasionFilter("All");
                      setSeasonFilter("All");
                      setBudgetFilter("All");
                    }}
                    className="mt-4 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Reset Filters
                  </button>
                </div>
              );
            }

            return (
              <div className="grid gap-8 lg:grid-cols-2">
                {currentOutfits.map((outfit, idx) => {
                  const outfitKey = outfit.outfit_id ?? idx;
                  const isSaved = savedSuccessIds.has(outfitKey);
                  const isSaving = savingOutfitId === outfitKey;

                  return (
                    <OutfitCard
                      key={outfitKey}
                      outfit={outfit}
                      isSaved={isSaved}
                      isSaving={isSaving}
                      onSave={() => handleSaveOutfit(outfit, idx)}
                      onAddToCart={() => handleAddOutfitToCart(outfit)}
                    />
                  );
                })}
              </div>
            );
          })()
        )}
      </main>
    </div>
  );
}

// ==============================================================================
// Subcomponents
// ==============================================================================

function OutfitCard({
  outfit,
  isSaved,
  isSaving,
  onSave,
  onAddToCart,
}: {
  outfit: Outfit;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
  onAddToCart: () => void;
}) {
  const hasOwnedItems = outfit.owned_items_count > 0;
  const allOwned = outfit.owned_items_count === outfit.items.length;

  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                {outfit.occasion}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {outfit.season}
              </span>
              {outfit.match_score && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {Math.round(outfit.match_score * 100)}% Match
                </span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-bold text-gray-900">{outfit.outfit_name}</h2>
          </div>

          {/* Save Outfit Button */}
          <button
            onClick={onSave}
            disabled={isSaved || isSaving}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              isSaved
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            {isSaved ? (
              <>
                <Check size={14} className="text-emerald-600" /> Saved
              </>
            ) : isSaving ? (
              "Saving..."
            ) : (
              <>
                <Bookmark size={14} /> Save Look
              </>
            )}
          </button>
        </div>

        {/* Color Coordination & Style Note */}
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#faf8f5] p-3 text-xs text-gray-600">
          <Palette size={15} className="mt-0.5 shrink-0 text-[#c65b3b]" />
          <div>
            <span className="font-semibold text-gray-800">
              {outfit.color_rationale || "Color Harmony"}:
            </span>{" "}
            {outfit.description}
          </div>
        </div>

        {/* Coordinated Product Pieces */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {outfit.items.map((it, idx) => (
            <div
              key={`${it.product_id}-${it.variant_id}-${idx}`}
              className={`flex flex-col justify-between overflow-hidden rounded-xl border p-3 transition ${
                it.is_owned ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white"
              }`}
            >
              <div>
                {/* Role & Ownership Badge */}
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                    {it.role}
                  </span>
                  {it.is_owned ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      <Check size={10} /> Owned
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-gray-900">
                      ₹{it.price.toLocaleString("en-IN")}
                    </span>
                  )}
                </div>

                {/* Product Image */}
                <div className="relative mb-2.5 flex h-28 w-full items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                  {it.image_url ? (
                    <img
                      src={it.image_url}
                      alt={it.product_name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=600";
                      }}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-[10px] text-gray-400">
                      {it.color} • {it.role}
                    </div>
                  )}
                </div>

                {/* Details */}
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  {it.brand_name}
                </p>
                <h4 className="line-clamp-1 text-xs font-bold text-gray-900">
                  {it.product_name}
                </h4>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  Color: <span className="font-medium text-gray-800">{it.color}</span>
                  {it.size && ` • Size: ${it.size}`}
                </p>
              </div>

              {/* View product link */}
              <Link
                href={`/products/${it.product_id}`}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#c65b3b] hover:underline"
              >
                View details <ExternalLink size={10} />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Card Footer: Budget & Action */}
      <div className="mt-6 border-t border-gray-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500">Total Purchase Cost:</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-gray-900">
                {allOwned ? "₹0 (All Owned)" : `₹${outfit.purchase_price.toLocaleString("en-IN")}`}
              </span>
              {hasOwnedItems && outfit.owned_savings > 0 && (
                <span className="text-xs font-semibold text-emerald-600">
                  (Saved ₹{outfit.owned_savings.toLocaleString("en-IN")} from wardrobe)
                </span>
              )}
            </div>
          </div>

          {!allOwned && (
            <button
              onClick={onAddToCart}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-black"
            >
              <ShoppingBag size={14} />
              Buy Needed Pieces
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SavedOutfitCard({
  outfit,
  onDelete,
  onAddToCart,
}: {
  outfit: Outfit;
  onDelete: (id: number) => void;
  onAddToCart: (outfit: Outfit) => void;
}) {
  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                {outfit.occasion}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {outfit.season}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-gray-900">{outfit.outfit_name}</h2>
          </div>

          <button
            onClick={() => outfit.outfit_id && onDelete(Number(outfit.outfit_id))}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete saved outfit"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {outfit.description && (
          <p className="mt-2 text-xs text-gray-600">{outfit.description}</p>
        )}

        {/* Pieces list */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
          {outfit.items.map((it, idx) => (
            <div
              key={`${it.product_id}-${it.variant_id}-${idx}`}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-[#faf8f5] p-2.5"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-200">
                {it.image_url ? (
                  <img
                    src={it.image_url}
                    alt={it.product_name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=600";
                    }}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                    {it.role}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase">{it.role}</span>
                <p className="truncate text-xs font-bold text-gray-900">{it.product_name}</p>
                <p className="text-[11px] text-gray-500">
                  {it.color} • ₹{it.price.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
        <div>
          <span className="text-xs text-gray-500">Outfit Value:</span>
          <p className="text-xl font-black text-gray-900">
            ₹{outfit.total_retail_price?.toLocaleString("en-IN") || 0}
          </p>
        </div>

        <button
          onClick={() => onAddToCart(outfit)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black"
        >
          <ShoppingBag size={14} /> Add Pieces to Cart
        </button>
      </div>
    </div>
  );
}
