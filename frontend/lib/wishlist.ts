const WISHLIST_KEY = "fashioniq-wishlist";

export function getWishlist(): string[] {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveWishlist(ids: string[]) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("wishlist-updated"));
}

export function toggleWishlist(id: string): boolean {
  const wishlist = getWishlist();
  const exists = wishlist.includes(id);

  const updated = exists
    ? wishlist.filter((item) => item !== id)
    : [...wishlist, id];

  saveWishlist(updated);
  return !exists;
}
