"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  getUserProfileApi,
  updateFashionProfileApi,
  updateUserAddressApi,
  getBrands,
  type ApiBrand,
} from "@/lib/api";
import {
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  MapPin,
  Sliders,
  User,
  ShieldCheck,
} from "lucide-react";

const BODY_TYPES = [
  { id: "Athletic", label: "Athletic", desc: "Toned & proportionate" },
  { id: "Regular", label: "Regular", desc: "Standard everyday build" },
  { id: "Slim", label: "Slim", desc: "Lean & slender silhouette" },
  { id: "Plus Size", label: "Plus Size", desc: "Full-figured & curve-conscious" },
  { id: "Hourglass", label: "Hourglass", desc: "Balanced bust & hips" },
  { id: "Inverted Triangle", label: "Inverted Triangle", desc: "Broader shoulders" },
  { id: "Rectangle", label: "Rectangle", desc: "Straight uniform frame" },
];

const STYLE_OPTIONS = [
  "Casual",
  "Streetwear",
  "Formal",
  "Ethnic",
  "Sporty",
  "Minimalist",
  "Smart Casual",
  "Party Wear",
];

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}

function ProfileContent() {
  const { user, token, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<ApiBrand[]>([]);

  // Fashion Profile state
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [bodyType, setBodyType] = useState<string>("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  // Address state
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  // Feedback states
  const [savingFashion, setSavingFashion] = useState(false);
  const [fashionSuccess, setFashionSuccess] = useState("");
  const [fashionError, setFashionError] = useState("");

  const [savingAddress, setSavingAddress] = useState(false);
  const [addressSuccess, setAddressSuccess] = useState("");
  const [addressError, setAddressError] = useState("");

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [profileRes, brandsData] = await Promise.all([
        getUserProfileApi(token),
        getBrands(),
      ]);

      setBrands(brandsData);

      if (profileRes.success && profileRes.profile) {
        const p = profileRes.profile;
        setHeight(p.height != null ? String(p.height) : "");
        setWeight(p.weight != null ? String(p.weight) : "");
        setBodyType(p.body_type || "");

        if (p.style_preferences) {
          const styles = p.style_preferences
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          setSelectedStyles(styles);
        }

        setBudgetMin(p.budget_range_min != null ? String(p.budget_range_min) : "");
        setBudgetMax(p.budget_range_max != null ? String(p.budget_range_max) : "");

        if (p.preferred_brands) {
          const bList = p.preferred_brands
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          setSelectedBrands(bList);
        }

        setStreet(p.street || "");
        setCity(p.city || "");
        setState(p.state || "");
        setPincode(p.pincode || "");
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle helpers
  function toggleStyle(style: string) {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  }

  function toggleBrand(brandName: string) {
    setSelectedBrands((prev) =>
      prev.includes(brandName)
        ? prev.filter((b) => b !== brandName)
        : [...prev, brandName]
    );
  }

  // Save Fashion Profile
  async function handleSaveFashion(e: React.FormEvent) {
    e.preventDefault();
    setFashionError("");
    setFashionSuccess("");

    if (!token) return;

    const minNum = budgetMin ? Number(budgetMin) : null;
    const maxNum = budgetMax ? Number(budgetMax) : null;

    if (minNum != null && minNum < 0) {
      setFashionError("Minimum budget cannot be negative.");
      return;
    }

    if (maxNum != null && maxNum < 0) {
      setFashionError("Maximum budget cannot be negative.");
      return;
    }

    if (minNum != null && maxNum != null && minNum > maxNum) {
      setFashionError("Minimum budget cannot exceed maximum budget.");
      return;
    }

    const heightNum = height ? Number(height) : null;
    if (heightNum != null && (heightNum <= 0 || heightNum > 260)) {
      setFashionError("Please provide a valid height between 50 and 260 cm.");
      return;
    }

    const weightNum = weight ? Number(weight) : null;
    if (weightNum != null && (weightNum <= 0 || weightNum > 300)) {
      setFashionError("Please provide a valid weight between 20 and 300 kg.");
      return;
    }

    try {
      setSavingFashion(true);
      const res = await updateFashionProfileApi(token, {
        height: heightNum,
        weight: weightNum,
        body_type: bodyType || null,
        style_preferences: selectedStyles.length > 0 ? selectedStyles.join(", ") : null,
        budget_range_min: minNum,
        budget_range_max: maxNum,
        preferred_brands: selectedBrands.length > 0 ? selectedBrands.join(", ") : null,
      });

      if (!res.success) {
        throw new Error(res.message || "Failed to update profile");
      }

      setFashionSuccess("Fashion personalization profile saved successfully!");
      await refreshUser();
    } catch (err: any) {
      console.error("Save fashion profile error:", err);
      setFashionError(err.message || "Failed to save fashion profile.");
    } finally {
      setSavingFashion(false);
    }
  }

  // Save Address
  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddressError("");
    setAddressSuccess("");

    if (!token) return;

    if (!street.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      setAddressError("All address fields are required.");
      return;
    }

    if (!/^\d{5,6}$/.test(pincode.trim())) {
      setAddressError("Please enter a valid postal pincode (e.g. 560001).");
      return;
    }

    try {
      setSavingAddress(true);
      const res = await updateUserAddressApi(token, {
        street: street.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
      });

      if (!res.success) {
        throw new Error(res.message || "Failed to update address");
      }

      setAddressSuccess("Shipping address updated successfully!");
      await refreshUser();
    } catch (err: any) {
      console.error("Save address error:", err);
      setAddressError(err.message || "Failed to save shipping address.");
    } finally {
      setSavingAddress(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#faf9f6]">
        <Navbar currentPath="/profile" />
        <div className="mx-auto max-w-4xl py-24 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Loading your fashion profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      <Navbar currentPath="/profile" />

      <section className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <span className="eyebrow inline-flex items-center gap-1.5 text-[#c65b3b]">
            <Sparkles size={14} /> AI PERSONALIZATION ENGINE
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
            My Fashion Profile
          </h1>
          <p className="mt-2 text-sm text-gray-600 max-w-2xl">
            Configure your personal fit metrics, aesthetic styles, preferred brands, and budget range.
            FashionIQ combines these parameters with vector similarity to recommend pieces and complete outfits suited to your body and taste.
          </p>
        </div>

        {/* User Summary Card */}
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-xl font-bold text-white uppercase">
              {user?.first_name?.[0] || "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  {user?.first_name} {user?.last_name}
                </h2>
                {user?.role === "ADMIN" && (
                  <span className="rounded-full bg-[#c65b3b] px-2.5 py-0.5 text-[10px] font-bold text-white uppercase">
                    ADMIN
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800 font-medium">
              <ShieldCheck size={14} /> Profile Secured
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* Section 1: Fashion Styling Profile (2 Cols) */}
          <div className="lg:col-span-2 space-y-8">
            <form onSubmit={handleSaveFashion} className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xs">
              <div className="mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
                <Sliders size={18} className="text-[#c65b3b]" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Personal Fashion Preferences
                </h2>
              </div>

              {/* Physical Fit & Measurements */}
              <div className="mb-8">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-700">
                  Physical Silhouette & Measurements
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="height" className="mb-1 block text-xs font-medium text-gray-600">
                      Height (cm)
                    </label>
                    <input
                      id="height"
                      type="number"
                      step="0.1"
                      min="50"
                      max="260"
                      placeholder="e.g. 175"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-black focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="weight" className="mb-1 block text-xs font-medium text-gray-600">
                      Weight (kg)
                    </label>
                    <input
                      id="weight"
                      type="number"
                      step="0.1"
                      min="20"
                      max="300"
                      placeholder="e.g. 70"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-black focus:outline-none"
                    />
                  </div>
                </div>

                {/* Body Type Selection */}
                <div className="mt-4">
                  <label className="mb-2 block text-xs font-medium text-gray-600">
                    Body Type
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {BODY_TYPES.map((bt) => (
                      <button
                        type="button"
                        key={bt.id}
                        onClick={() => setBodyType(bodyType === bt.id ? "" : bt.id)}
                        className={`rounded-xl border p-2.5 text-left transition ${
                          bodyType === bt.id
                            ? "border-black bg-black text-white"
                            : "border-gray-200 bg-white text-gray-800 hover:border-gray-400"
                        }`}
                      >
                        <p className="text-xs font-semibold">{bt.label}</p>
                        <p className={`text-[10px] ${bodyType === bt.id ? "text-gray-300" : "text-gray-500"}`}>
                          {bt.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Style Preferences */}
              <div className="mb-8 border-t border-gray-100 pt-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Style Preferences
                  </h3>
                  <span className="text-[11px] text-gray-500">Select multiple</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map((style) => {
                    const isSelected = selectedStyles.includes(style);
                    return (
                      <button
                        type="button"
                        key={style}
                        onClick={() => toggleStyle(style)}
                        className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                          isSelected
                            ? "border-black bg-black text-white"
                            : "border-gray-300 bg-white text-gray-800 hover:border-black"
                        }`}
                      >
                        {isSelected && <span className="mr-1.5 font-bold">✓</span>}
                        {style}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Budget Range */}
              <div className="mb-8 border-t border-gray-100 pt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Budget Range (₹ INR)
                  </h3>
                  <span className="text-[11px] text-gray-500">For apparel recommendations</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="budgetMin" className="mb-1 block text-xs font-medium text-gray-600">
                      Minimum Budget (₹)
                    </label>
                    <input
                      id="budgetMin"
                      type="number"
                      min="0"
                      placeholder="e.g. 1000"
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="budgetMax" className="mb-1 block text-xs font-medium text-gray-600">
                      Maximum Budget (₹)
                    </label>
                    <input
                      id="budgetMax"
                      type="number"
                      min="0"
                      placeholder="e.g. 5000"
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-black focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Preferred Brands */}
              <div className="mb-8 border-t border-gray-100 pt-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Preferred Brands
                  </h3>
                  <span className="text-[11px] text-gray-500">From catalog</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {brands.map((b) => {
                    const isSelected = selectedBrands.includes(b.brand_name);
                    return (
                      <button
                        type="button"
                        key={b.brand_id}
                        onClick={() => toggleBrand(b.brand_name)}
                        className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                          isSelected
                            ? "border-[#c65b3b] bg-[#c65b3b] text-white"
                            : "border-gray-300 bg-white text-gray-800 hover:border-[#c65b3b]"
                        }`}
                      >
                        {isSelected && <span className="mr-1.5 font-bold">✓</span>}
                        {b.brand_name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {fashionError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle size={15} />
                  <span>{fashionError}</span>
                </div>
              )}

              {fashionSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 font-medium">
                  <Check size={15} />
                  <span>{fashionSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingFashion}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-6 py-3 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
              >
                {savingFashion ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving Preferences...
                  </>
                ) : (
                  "Save Fashion Profile"
                )}
              </button>
            </form>
          </div>

          {/* Section 2: Shipping Address & Account Details (1 Col) */}
          <div className="space-y-8">
            {/* Delivery Address Card */}
            <form onSubmit={handleSaveAddress} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                <MapPin size={18} className="text-[#c65b3b]" />
                <h2 className="text-base font-semibold text-gray-900">
                  Delivery Address
                </h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="street" className="mb-1 block text-xs font-medium text-gray-600">
                    Street Address
                  </label>
                  <input
                    id="street"
                    type="text"
                    placeholder="e.g. 123 Fashion Blvd"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-black focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="city" className="mb-1 block text-xs font-medium text-gray-600">
                    City
                  </label>
                  <input
                    id="city"
                    type="text"
                    placeholder="e.g. Bengaluru"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-black focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="state" className="mb-1 block text-xs font-medium text-gray-600">
                      State
                    </label>
                    <input
                      id="state"
                      type="text"
                      placeholder="e.g. Karnataka"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      required
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-black focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="pincode" className="mb-1 block text-xs font-medium text-gray-600">
                      Pincode
                    </label>
                    <input
                      id="pincode"
                      type="text"
                      placeholder="e.g. 560001"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      required
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-black focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {addressError && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle size={15} />
                  <span>{addressError}</span>
                </div>
              )}

              {addressSuccess && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 font-medium">
                  <Check size={15} />
                  <span>{addressSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingAddress}
                className="mt-5 w-full rounded-full bg-black py-2.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
              >
                {savingAddress ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={13} className="animate-spin" /> Saving...
                  </span>
                ) : (
                  "Save Address"
                )}
              </button>
            </form>

            {/* Quick Tips Card */}
            <div className="rounded-2xl border border-gray-200 bg-[#f4f2ee] p-6 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                Why configure this?
              </h3>
              <ul className="mt-3 space-y-2 text-xs text-gray-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-[#c65b3b] font-bold">•</span>
                  <span><strong>AI Fitting:</strong> We recommend cuts and silhouettes optimal for your shape.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#c65b3b] font-bold">•</span>
                  <span><strong>Budget Guardrails:</strong> Outfit bundles are calculated respecting your spending limits.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#c65b3b] font-bold">•</span>
                  <span><strong>1-Click Checkout:</strong> Your address pre-fills seamlessly during order placement.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
