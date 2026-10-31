"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCart, saveCart, type CartItem } from "@/lib/cart";

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    setCart(getCart());
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
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      <header className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            FashionIQ
          </Link>
          <Link href="/products" className="text-sm text-gray-600 hover:text-black">
            ← Continue Shopping
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-8 text-3xl font-semibold">Your Cart</h1>

        {cart.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center">
            <p className="text-gray-600">Your cart is empty.</p>
            <Link
              href="/products"
              className="mt-4 inline-block rounded-full bg-black px-6 py-3 text-white"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-[1fr_300px]">
            <div className="space-y-4">
              {cart.map((item, index) => (
                <div
                  key={`${item.product.id}-${item.size}-${item.color}`}
                  className="flex gap-4 rounded-xl bg-white p-4"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="h-32 w-24 rounded-lg object-cover"
                  />

                  <div className="flex flex-1 flex-col">
                    <h2 className="font-medium">{item.product.name}</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {item.color} · Size {item.size}
                    </p>
                    <p className="mt-2 font-semibold">
                      ₹{item.product.price.toLocaleString("en-IN")}
                    </p>

                    <div className="mt-auto flex items-center gap-3 pt-3">
                      <button
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="rounded border px-3 py-1 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                        className="rounded border px-3 py-1"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(index)}
                        className="ml-2 text-sm text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="h-fit rounded-xl bg-white p-6">
              <h2 className="text-lg font-semibold">Order Summary</h2>
              <div className="mt-4 flex justify-between">
                <span>Subtotal</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-4 flex justify-between border-t pt-4 font-semibold">
                <span>Total</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
              <button
                disabled
                className="mt-6 w-full rounded-full bg-black px-6 py-3 text-white opacity-50"
              >
                Checkout (Coming Soon)
              </button>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
