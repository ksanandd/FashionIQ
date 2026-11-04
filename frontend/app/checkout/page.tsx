"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getCart, saveCart, type CartItem } from "@/lib/cart";
import {
  getUserProfileApi,
  updateUserAddressApi,
  createOrderApi,
  type UserAddressPayload,
} from "@/lib/api";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Truck,
  ShieldCheck,
  AlertCircle,
  ShoppingBag,
  MapPin,
  Lock,
} from "lucide-react";

export default function CheckoutPage() {
  return (
    <ProtectedRoute>
      <CheckoutContent />
    </ProtectedRoute>
  );
}

function CheckoutContent() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shipping Address Form State
  const [shippingAddress, setShippingAddress] = useState<UserAddressPayload>({
    street: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [saveAsDefault, setSaveAsDefault] = useState(true);

  // Payment Method: "COD" | "SIMULATED_CARD"
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "SIMULATED_CARD">("COD");

  // Load cart and user profile address
  useEffect(() => {
    const items = getCart();
    setCart(items);

    if (token) {
      getUserProfileApi(token)
        .then((res) => {
          if (res.profile) {
            setShippingAddress({
              street: res.profile.street || "",
              city: res.profile.city || "",
              state: res.profile.state || "",
              pincode: res.profile.pincode || "",
            });
          }
        })
        .catch((err) => {
          console.error("Failed to load profile address:", err);
        })
        .finally(() => {
          setLoadingProfile(false);
        });
    } else {
      setLoadingProfile(false);
    }
  }, [token]);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const total = subtotal; // Free delivery

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShippingAddress((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!token) {
      setError("Please sign in to complete your checkout.");
      return;
    }

    if (cart.length === 0) {
      setError("Your cart is empty. Add items before checking out.");
      return;
    }

    // Validation
    if (
      !shippingAddress.street.trim() ||
      !shippingAddress.city.trim() ||
      !shippingAddress.state.trim() ||
      !shippingAddress.pincode.trim()
    ) {
      setError("Please fill in all delivery address fields.");
      return;
    }

    // Check variants and include product_id for relationship integrity verification
    const orderItems = cart.map((item) => ({
      product_id: Number(item.product.id),
      variant_id: item.variantId,
      quantity: item.quantity,
    }));

    if (orderItems.some((i) => !i.variant_id || i.variant_id <= 0)) {
      setError(
        "One or more items in your cart do not have a valid variant selected. Please review your cart."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Submit order to atomic backend
      const res = await createOrderApi(token, {
        items: orderItems,
        payment_method: paymentMethod,
        shipping_address: shippingAddress,
      });

      if (!res.success) {
        throw new Error(res.message || "Failed to place order.");
      }

      // 2. Optionally update profile default address
      if (saveAsDefault) {
        try {
          await updateUserAddressApi(token, shippingAddress);
        } catch (addrErr) {
          console.warn("Failed to update default address:", addrErr);
        }
      }

      // 3. Clear cart in localStorage and dispatch update
      saveCart([]);

      // 4. Redirect to orders page with success notification
      router.push(`/orders?placed=true&order_id=${res.order_id}`);
    } catch (err: any) {
      console.error("Checkout order error:", err);
      setError(
        err.message || "Failed to place order. Please check stock and try again."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      <Navbar currentPath="/cart" />

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/cart"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black transition"
          >
            <ArrowLeft size={14} /> Back to Cart
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
            <Lock size={12} /> 256-bit Secure Checkout
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl mb-8">
          Complete Your Order
        </h1>

        {cart.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <ShoppingBag size={26} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Your cart is empty
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
              You do not have any items ready for checkout. Discover your next
              favorite piece from our curated catalog.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 transition"
            >
              Browse Catalog <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <form onSubmit={handlePlaceOrder}>
            <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
              {/* Left Column: Delivery Address & Payment Method */}
              <div className="space-y-6">
                {error && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <AlertCircle className="mt-0.5 shrink-0" size={18} />
                    <div>
                      <p className="font-semibold">Checkout Alert</p>
                      <p className="mt-0.5 text-xs leading-relaxed">{error}</p>
                    </div>
                  </div>
                )}

                {/* Shipping Address Card */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                  <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 mb-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">
                        1. Delivery Address
                      </h2>
                      <p className="text-xs text-gray-500">
                        Where should we deliver your fashion pieces?
                      </p>
                    </div>
                  </div>

                  {loadingProfile ? (
                    <div className="py-6 text-center text-xs text-gray-400">
                      Loading your saved address...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                          Street Address / House / Flat
                        </label>
                        <input
                          type="text"
                          name="street"
                          required
                          value={shippingAddress.street}
                          onChange={handleInputChange}
                          placeholder="e.g. 42 MG Road, Indiranagar"
                          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                            City
                          </label>
                          <input
                            type="text"
                            name="city"
                            required
                            value={shippingAddress.city}
                            onChange={handleInputChange}
                            placeholder="Bengaluru"
                            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                            State
                          </label>
                          <input
                            type="text"
                            name="state"
                            required
                            value={shippingAddress.state}
                            onChange={handleInputChange}
                            placeholder="Karnataka"
                            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                            Pincode
                          </label>
                          <input
                            type="text"
                            name="pincode"
                            required
                            value={shippingAddress.pincode}
                            onChange={handleInputChange}
                            placeholder="560038"
                            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                          />
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={saveAsDefault}
                            onChange={(e) => setSaveAsDefault(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                          />
                          Save this as my default delivery address
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Method Card */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                  <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 mb-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                      <CreditCard size={16} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">
                        2. Payment Method
                      </h2>
                      <p className="text-xs text-gray-500">
                        Choose how you would like to pay
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label
                      className={`flex items-start gap-3.5 rounded-xl border p-4 cursor-pointer transition ${
                        paymentMethod === "COD"
                          ? "border-black bg-stone-50/60 ring-1 ring-black"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="COD"
                        checked={paymentMethod === "COD"}
                        onChange={() => setPaymentMethod("COD")}
                        className="mt-1 h-4 w-4 text-black focus:ring-black"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-900">
                            Cash on Delivery (COD)
                          </span>
                          <span className="rounded bg-stone-200/60 px-2 py-0.5 text-[11px] font-medium text-stone-800">
                            Recommended
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Pay with cash or digital UPI upon receiving your
                          delivery at your doorstep.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-3.5 rounded-xl border p-4 cursor-pointer transition ${
                        paymentMethod === "SIMULATED_CARD"
                          ? "border-black bg-stone-50/60 ring-1 ring-black"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="SIMULATED_CARD"
                        checked={paymentMethod === "SIMULATED_CARD"}
                        onChange={() => setPaymentMethod("SIMULATED_CARD")}
                        className="mt-1 h-4 w-4 text-black focus:ring-black"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-900">
                            Simulated Online Payment (Sandbox Demo)
                          </span>
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                            Instant Confirmation
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Demonstration mode: instant simulated order authorization. No real money or payment credentials are collected or stored.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Order Review & Submit */}
              <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                  <h3 className="text-base font-semibold text-gray-900 pb-3 border-b border-gray-100 mb-4">
                    Order Summary ({cart.reduce((s, i) => s + i.quantity, 0)}{" "}
                    items)
                  </h3>

                  {/* Cart Items Quick List */}
                  <div className="max-h-72 overflow-y-auto space-y-3 pr-1 divide-y divide-gray-100">
                    {cart.map((item, idx) => (
                      <div
                        key={`${item.product.id}-${item.variantId}-${idx}`}
                        className="pt-3 first:pt-0 flex gap-3 text-xs"
                      >
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=600";
                          }}
                          className="h-14 w-12 rounded-lg object-cover bg-gray-50 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {item.product.name}
                          </p>
                          <p className="text-gray-500 text-[11px] mt-0.5">
                            {item.color} • Size {item.size} • Qty {item.quantity}
                          </p>
                          <p className="font-semibold text-gray-900 mt-1">
                            ₹
                            {(item.price * item.quantity).toLocaleString(
                              "en-IN"
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Price Calculations */}
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-medium text-gray-900">
                        ₹{subtotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Estimated Shipping</span>
                      <span className="font-medium text-emerald-700">Free</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-100 pt-3 text-sm font-semibold text-gray-900">
                      <span>Total Amount</span>
                      <span>₹{total.toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || cart.length === 0}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-black px-6 py-3.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Placing Order...
                      </>
                    ) : (
                      <>
                        Place Order • ₹{total.toLocaleString("en-IN")}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
                    <ShieldCheck size={14} className="text-gray-500" />
                    Verified atomic transaction with real-time stock lock
                  </div>
                </div>

                {/* Assurance box */}
                <div className="rounded-2xl border border-gray-200 bg-[#fdfcfb] p-4 text-xs text-gray-600 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-gray-900">
                    <Truck size={15} /> Free Express Delivery
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Orders are processed immediately and dispatched with tracked
                    couriers across all Indian pin codes.
                  </p>
                </div>
              </div>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
