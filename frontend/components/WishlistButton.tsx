"use client";

import { useEffect, useState } from "react";
import { getWishlist, toggleWishlist } from "@/lib/wishlist";

type WishlistButtonProps = {
  productId: string;
};

export default function WishlistButton({ productId }: WishlistButtonProps) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setIsSaved(getWishlist().includes(productId));

    function updateWishlist() {
      setIsSaved(getWishlist().includes(productId));
    }

    window.addEventListener("wishlist-updated", updateWishlist);

    return () => {
      window.removeEventListener("wishlist-updated", updateWishlist);
    };
  }, [productId]);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsSaved(toggleWishlist(productId));
  }

  return (
    <button
      onClick={handleClick}
      aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={isSaved}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow transition hover:scale-105"
    >
      {isSaved ? "♥" : "♡"}
    </button>
  );
}
