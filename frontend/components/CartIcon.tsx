"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCart, type CartItem } from "@/lib/cart";

export default function CartIcon() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function updateCount() {
      const cart = getCart();
      setCount(cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0));
    }

    updateCount();

    window.addEventListener("cart-updated", updateCount);
    window.addEventListener("storage", updateCount);

    return () => {
      window.removeEventListener("cart-updated", updateCount);
      window.removeEventListener("storage", updateCount);
    };
  }, []);

  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-black"
      aria-label={`Shopping cart, ${count} items`}
    >
      <span>Cart</span>
      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-1 text-xs text-white">
        {count}
      </span>
    </Link>
  );
}
