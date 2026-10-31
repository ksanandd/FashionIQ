import type { Product } from "@/data/products";

export type CartItem = {
  product: Product;
  quantity: number;
  size: string;
  color: string;
};

const CART_KEY = "fashioniq-cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCart(cart: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-updated"));
}

export function addToCart(product: Product, size: string, color: string) {
  const cart = getCart();
  const existing = cart.find(
    (item) =>
      item.product.id === product.id &&
      item.size === size &&
      item.color === color
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ product, quantity: 1, size, color });
  }

  saveCart(cart);
}
