const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export type InteractionType =
  | "VIEW"
  | "LIKE"
  | "DISLIKE"
  | "ADD_TO_CART"
  | "PURCHASE";

export interface InteractionPayload {
  product_id: number;
  variant_id?: number | null;
  interaction_type: InteractionType;
}

const TOKEN_KEY = "fashioniq-token";
const PENDING_INTERACTIONS_KEY = "fashioniq-pending-interactions";

/**
 * Track user interaction with a product.
 * If authenticated, sends immediately to backend API.
 * If not authenticated, queues in localStorage for sync upon login.
 */
export async function trackInteraction(
  productId: number | string,
  type: InteractionType,
  variantId?: number | null
): Promise<void> {
  if (typeof window === "undefined") return;

  const numProductId = Number(productId);
  if (!Number.isInteger(numProductId) || numProductId <= 0) return;

  const payload: InteractionPayload = {
    product_id: numProductId,
    variant_id: variantId ? Number(variantId) : null,
    interaction_type: type,
  };

  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/interactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Non-blocking background telemetry failure
      console.warn("Telemetry error recording interaction:", err);
    }
  } else {
    // Queue locally for later sync
    try {
      const existing = JSON.parse(
        localStorage.getItem(PENDING_INTERACTIONS_KEY) || "[]"
      );
      existing.push({ ...payload, timestamp: Date.now() });
      // Keep queue bounded
      if (existing.length > 50) existing.shift();
      localStorage.setItem(
        PENDING_INTERACTIONS_KEY,
        JSON.stringify(existing)
      );
    } catch {
      // Ignore localStorage errors
    }
  }
}

/**
 * Flush any queued guest interactions to the backend once authenticated.
 */
export async function flushPendingInteractions(): Promise<void> {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  try {
    const raw = localStorage.getItem(PENDING_INTERACTIONS_KEY);
    if (!raw) return;

    const queue: (InteractionPayload & { timestamp?: number })[] =
      JSON.parse(raw);
    if (!queue || queue.length === 0) return;

    localStorage.removeItem(PENDING_INTERACTIONS_KEY);

    for (const item of queue) {
      await fetch(`${API_BASE_URL}/api/interactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_id: item.product_id,
          variant_id: item.variant_id,
          interaction_type: item.interaction_type,
        }),
      });
    }
  } catch (err) {
    console.warn("Failed to flush pending interactions:", err);
  }
}
