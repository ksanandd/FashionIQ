
import type { Product } from "@/lib/api";

export type CartItem = {
  product: Product;
  variantId: number;
  quantity: number;
  size: string;
  color: string;
  price: number;
};

const CART_KEY = "fashioniq-cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = JSON.parse(localStorage.getItem(CART_KEY) || "[]");

    // Safely migrate older cart items to the new structure.
    return stored.map((item: any) => ({
      ...item,
      variantId: item.variantId ?? 0,
      price: Number(item.price ?? item.product.price),
    }));
  } catch {
    return [];
  }
}

export function saveCart(cart: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-updated"));
}

export function addToCart(
  product: Product,
  variantId: number,
  size: string,
  color: string,
  price: number
) {
  const cart = getCart();

  const existing = cart.find(
    (item) =>
      item.variantId === variantId &&
      item.product.id === product.id
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      product,
      variantId,
      quantity: 1,
      size,
      color,
      price,
    });
  }

  saveCart(cart);
}
