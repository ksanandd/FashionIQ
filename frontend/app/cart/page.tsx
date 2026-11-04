"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getCart, saveCart, type CartItem } from "@/lib/cart";
import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    setCart(getCart());

    function handleCartUpdate() {
      setCart(getCart());
    }

    window.addEventListener("cart-updated", handleCartUpdate);
    window.addEventListener("storage", handleCartUpdate);

    return () => {
      window.removeEventListener("cart-updated", handleCartUpdate);
      window.removeEventListener("storage", handleCartUpdate);
    };
  }, []);

  function updateQuantity(index: number, quantity: number) {
    if (quantity < 1) return;

    const updated = [...cart];
    updated[index].quantity = quantity;
    setCart(updated);
    saveCart(updated);
  }

  function removeItem(index: number) {
    const updated = cart.filter((_, itemIndex) => itemIndex !== index);
    setCart(updated);
    saveCart(updated);
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      <Navbar currentPath="/cart" />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-8 text-3xl font-semibold text-gray-900">Your Cart</h1>

        {cart.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <ShoppingBag size={26} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Your cart is empty</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
              Looks like you haven't added any pieces to your cart yet. Discover your next favorite piece from our catalog.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Browse Products <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {cart.map((item, index) => (
                <div
                  key={`${item.product?.id || index}-${item.size}-${item.color}`}
                  className="flex gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-xs"
                >
                  <img
                    src={item.product?.image}
                    alt={item.product?.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=600";
                    }}
                    className="h-32 w-24 rounded-xl object-cover bg-gray-100"
                  />

                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#c65b3b]">
                        {item.product?.brand}
                      </p>
                      <h2 className="mt-1 font-medium text-gray-900">
                        {item.product?.name}
                      </h2>
                      <p className="mt-1 text-xs text-gray-500">
                        Color: <span className="font-medium text-gray-700">{item.color}</span> · Size: <span className="font-medium text-gray-700">{item.size}</span>
                      </p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">
                        ₹{item.price.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(index, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-xs font-medium hover:border-black disabled:opacity-40"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(index, item.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-xs font-medium hover:border-black"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(index)}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                        aria-label="Remove item"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <h2 className="text-base font-semibold text-gray-900">Order Summary</h2>
              <div className="mt-4 flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-gray-600">
                <span>Estimated Delivery</span>
                <span className="text-emerald-700 font-medium">Free</span>
              </div>
              <div className="mt-4 flex justify-between border-t border-gray-100 pt-4 text-base font-semibold text-gray-900">
                <span>Total</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
              <Link
                href="/checkout"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-black px-6 py-3.5 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                Proceed to Checkout <ArrowRight size={16} />
              </Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
