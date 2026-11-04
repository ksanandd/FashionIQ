"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getUserOrdersApi, addOrderItemsToWardrobeApi, type Order } from "@/lib/api";
import {
  PackageCheck,
  Package,
  Calendar,
  MapPin,
  CreditCard,
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";

export default function OrdersPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <main className="min-h-screen bg-[#faf9f6] flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
          </main>
        }
      >
        <OrdersContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function OrdersContent() {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();

  const isNewlyPlaced = searchParams.get("placed") === "true";
  const newOrderId = searchParams.get("order_id");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [syncingOrderId, setSyncingOrderId] = useState<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ [id: number]: string }>({});

  const handleSyncToWardrobe = async (orderId: number) => {
    if (!token) return;
    setSyncingOrderId(orderId);
    try {
      const res = await addOrderItemsToWardrobeApi(token, orderId);
      if (res.success) {
        setSyncStatus((prev) => ({
          ...prev,
          [orderId]: `✓ Synced to Digital Wardrobe (${res.added_count} items)`,
        }));
      } else {
        setSyncStatus((prev) => ({
          ...prev,
          [orderId]: res.message || "Failed to add items.",
        }));
      }
    } catch (err: any) {
      setSyncStatus((prev) => ({
        ...prev,
        [orderId]: err.message || "Failed to add to wardrobe.",
      }));
    } finally {
      setSyncingOrderId(null);
    }
  };

  useEffect(() => {
    if (!token) return;

    getUserOrdersApi(token)
      .then((res) => {
        if (res.success) {
          setOrders(res.orders);
        } else {
          setError("Failed to load your orders.");
        }
      })
      .catch((err) => {
        console.error("Error fetching orders:", err);
        setError("Could not retrieve order history. Please try again.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const getStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={12} /> Delivered
          </span>
        );
      case "SHIPPED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-800 border border-purple-200">
            <Truck size={12} /> Shipped
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 border border-blue-200">
            <Clock size={12} /> Processing
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800 border border-red-200">
            Cancelled
          </span>
        );
      case "PENDING":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 border border-amber-200">
            <Clock size={12} /> Confirmed / Pending
          </span>
        );
    }
  };

  return (
    <main className="min-h-screen bg-[#faf9f6]">
      <Navbar currentPath="/orders" />

      <section className="mx-auto max-w-5xl px-6 py-10">
        {/* Newly Placed Banner */}
        {isNewlyPlaced && (
          <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-emerald-900 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <PackageCheck size={22} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">
                  Order Successfully Placed!
                </h2>
                <p className="mt-1 text-sm text-emerald-800/90 leading-relaxed">
                  Thank you for shopping with FashionIQ. Your order{" "}
                  {newOrderId ? (
                    <span className="font-semibold">#{newOrderId}</span>
                  ) : (
                    ""
                  )}{" "}
                  has been confirmed and inventory has been reserved. You can
                  track the status below.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
              My Orders
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Track and review your past purchases and verified deliveries
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:border-black hover:text-black transition"
          >
            Explore Catalog <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
            <p className="mt-4 text-xs font-medium text-gray-500">
              Loading your orders...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Package size={26} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              No orders placed yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
              When you purchase pieces from FashionIQ, your order details,
              historical pricing, and shipping snapshots will appear here.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 transition"
            >
              Start Shopping <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const formattedDate = new Date(order.created_at).toLocaleDateString(
                "en-IN",
                {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }
              );

              return (
                <div
                  key={order.order_id}
                  className="rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden transition hover:shadow-sm"
                >
                  {/* Order Header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 bg-[#fdfcfb] px-6 py-4 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                          Order Number
                        </span>
                        <span className="font-semibold text-gray-900 text-sm">
                          #FASH-{order.order_id}
                        </span>
                      </div>
                      <div className="border-l border-gray-200 pl-4">
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                          Placed On
                        </span>
                        <span className="text-gray-700 flex items-center gap-1 font-medium">
                          <Calendar size={12} /> {formattedDate}
                        </span>
                      </div>
                      <div className="border-l border-gray-200 pl-4">
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                          Total Amount
                        </span>
                        <span className="font-bold text-gray-900 text-sm">
                          ₹{Number(order.total_amount).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(order.status)}
                    </div>
                  </div>

                  {/* Order Body: Items & Details */}
                  <div className="p-6">
                    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
                      {/* Items list */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Purchased Items ({order.items?.length || 0})
                        </h3>

                        <div className="divide-y divide-gray-100">
                          {order.items?.map((item) => (
                            <div
                              key={item.order_item_id}
                              className="flex gap-4 py-3 first:pt-0 last:pb-0"
                            >
                              <img
                                src={item.image_url}
                                alt={item.product_name}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=600";
                                }}
                                className="h-20 w-16 rounded-xl object-cover bg-gray-50 shrink-0 border border-gray-100"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                                      {item.product_name}
                                    </h4>
                                    {item.brand_name && (
                                      <p className="text-xs font-medium text-gray-500">
                                        {item.brand_name}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-sm font-bold text-gray-900">
                                    ₹
                                    {Number(item.subtotal).toLocaleString(
                                      "en-IN"
                                    )}
                                  </span>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                  <span className="inline-block rounded bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
                                    Color: {item.color || "Standard"}
                                  </span>
                                  <span className="inline-block rounded bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
                                    Size: {item.size || "Standard"}
                                  </span>
                                  <span className="text-gray-400">•</span>
                                  <span>Qty: {item.quantity}</span>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-gray-500 text-[11px]">
                                    (₹
                                    {Number(
                                      item.price_at_purchase
                                    ).toLocaleString("en-IN")}{" "}
                                    each)
                                  </span>
                                </div>

                                <div className="mt-3">
                                  <Link
                                    href={`/products/${item.product_id}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-black transition"
                                  >
                                    View Product Details <ExternalLink size={11} />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Delivery & Payment Snapshot */}
                      <div className="rounded-xl border border-gray-100 bg-[#faf9f6] p-4 text-xs space-y-4 h-fit">
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold text-gray-800 mb-1.5">
                            <MapPin size={13} className="text-gray-500" />
                            Shipping Snapshot
                          </div>
                          <p className="text-gray-600 leading-relaxed text-[11px]">
                            {order.shipping_street}
                            <br />
                            {order.shipping_city}, {order.shipping_state} -{" "}
                            {order.shipping_pincode}
                          </p>
                        </div>

                        <div className="border-t border-gray-200/60 pt-3">
                          <div className="flex items-center gap-1.5 font-semibold text-gray-800 mb-1.5">
                            <CreditCard size={13} className="text-gray-500" />
                            Payment Details
                          </div>
                          <div className="space-y-1 text-[11px] text-gray-600">
                            <div className="flex justify-between">
                              <span>Method:</span>
                              <span className="font-medium text-gray-900">
                                {order.payment_method === "COD"
                                  ? "Cash on Delivery"
                                  : order.payment_method === "SIMULATED_CARD"
                                  ? "Simulated Online Payment"
                                  : "Online Payment"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Status:</span>
                              <span
                                className={`font-medium ${
                                  order.payment_status === "PAID"
                                    ? "text-emerald-700"
                                    : "text-amber-700"
                                }`}
                              >
                                {order.payment_status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Digital Wardrobe Action */}
                        <div className="border-t border-gray-200/60 pt-3">
                          <button
                            type="button"
                            onClick={() => handleSyncToWardrobe(order.order_id)}
                            disabled={syncingOrderId === order.order_id}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-medium text-gray-800 transition hover:border-black hover:text-black disabled:opacity-50"
                          >
                            <Layers size={13} />
                            {syncingOrderId === order.order_id
                              ? "Syncing to Wardrobe..."
                              : "Save Items to Wardrobe"}
                          </button>
                          {syncStatus[order.order_id] && (
                            <p className="mt-1.5 text-center text-[10px] font-medium text-emerald-800">
                              {syncStatus[order.order_id]}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
