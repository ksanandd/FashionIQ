"use client";

import React, { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  getAdminDashboardStatsApi,
  getAdminAnalyticsApi,
  getAdminProductsApi,
  createAdminProductApi,
  updateAdminProductApi,
  deleteAdminProductApi,
  getAdminVariantsApi,
  createAdminVariantApi,
  updateAdminVariantApi,
  deleteAdminVariantApi,
  getAdminCategoriesApi,
  createAdminCategoryApi,
  updateAdminCategoryApi,
  deleteAdminCategoryApi,
  getAdminBrandsApi,
  createAdminBrandApi,
  updateAdminBrandApi,
  deleteAdminBrandApi,
  getAdminOrdersApi,
  getAdminOrderByIdApi,
  updateAdminOrderStatusApi,
  getAdminUsersApi,
  getAdminUserByIdApi,
  updateAdminUserRoleApi,
  type AdminDashboardStats,
  type AdminAnalyticsData,
  type AdminProductItem,
  type AdminVariantItem,
  type AdminCategoryItem,
  type AdminBrandItem,
  type AdminOrderItem,
  type AdminOrderDetail,
  type AdminUserItem,
  type AdminUserDetail,
} from "@/lib/api";
import {
  LayoutDashboard,
  Package,
  Layers,
  FolderTree,
  Tag,
  ShoppingBag,
  Users,
  BarChart3,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  Shield,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Eye,
  Edit2,
  Trash2,
  X,
} from "lucide-react";

type TabType =
  | "overview"
  | "products"
  | "inventory"
  | "categories"
  | "brands"
  | "orders"
  | "users"
  | "analytics";

export default function AdminPage() {
  return (
    <ProtectedRoute requireAdmin={true}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}

function AdminDashboardContent() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Data States
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsData | null>(null);
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [variants, setVariants] = useState<AdminVariantItem[]>([]);
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [brands, setBrands] = useState<AdminBrandItem[]>([]);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);

  // Filter States
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>("");
  const [productBrandFilter, setProductBrandFilter] = useState<string>("");
  const [inventoryStockFilter, setInventoryStockFilter] = useState<"all" | "low" | "out">("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("");
  const [orderSearch, setOrderSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("");

  // Modal / Detail States
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetail | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [productModal, setProductModal] = useState<{
    mode: "create" | "edit";
    product?: AdminProductItem;
  } | null>(null);
  const [variantModal, setVariantModal] = useState<{
    mode: "create" | "edit";
    variant?: AdminVariantItem;
    productId?: number;
  } | null>(null);
  const [categoryModal, setCategoryModal] = useState<{
    mode: "create" | "edit";
    category?: AdminCategoryItem;
  } | null>(null);
  const [brandModal, setBrandModal] = useState<{
    mode: "create" | "edit";
    brand?: AdminBrandItem;
  } | null>(null);

  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // ----------------------------------------------------------------------------
  // Data Loaders
  // ----------------------------------------------------------------------------

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getAdminDashboardStatsApi(token);
      setStats(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard statistics.";
      console.error(err);
      showNotification("error", msg);
    }
  }, [token]);

  const loadAnalytics = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getAdminAnalyticsApi(token);
      setAnalytics(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load analytics data.";
      console.error(err);
      showNotification("error", msg);
    }
  }, [token]);

  const loadProducts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getAdminProductsApi(token, {
        search: productSearch,
        category_id: productCategoryFilter || undefined,
        brand_id: productBrandFilter || undefined,
        limit: 50,
      });
      setProducts(res.products || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load products.";
      console.error(err);
      showNotification("error", msg);
    }
  }, [token, productSearch, productCategoryFilter, productBrandFilter]);

  const loadVariants = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getAdminVariantsApi(token, {
        low_stock: inventoryStockFilter === "low",
        out_of_stock: inventoryStockFilter === "out",
      });
      setVariants(res.variants || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load variants.";
      console.error(err);
      showNotification("error", msg);
    }
  }, [token, inventoryStockFilter]);

  const loadCategories = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getAdminCategoriesApi(token);
      setCategories(res.categories || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load categories.";
      console.error(err);
      showNotification("error", msg);
    }
  }, [token]);

  const loadBrands = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getAdminBrandsApi(token);
      setBrands(res.brands || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load brands.";
      console.error(err);
      showNotification("error", msg);
    }
  }, [token]);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getAdminOrdersApi(token, {
        status: orderStatusFilter || undefined,
        search: orderSearch || undefined,
        limit: 50,
      });
      setOrders(res.orders || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load orders.";
      console.error(err);
      showNotification("error", msg);
    }
  }, [token, orderStatusFilter, orderSearch]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getAdminUsersApi(token, {
        search: userSearch || undefined,
        role: userRoleFilter || undefined,
        limit: 50,
      });
      setUsersList(res.users || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load users.";
      console.error(err);
      showNotification("error", msg);
    }
  }, [token, userSearch, userRoleFilter]);

  // Initial load
  useEffect(() => {
    if (token) {
      setLoading(true);
      Promise.all([loadStats(), loadCategories(), loadBrands()])
        .finally(() => setLoading(false));
    }
  }, [token, loadStats, loadCategories, loadBrands]);

  // Tab switch effect
  useEffect(() => {
    if (!token) return;
    if (activeTab === "overview") {
      loadStats();
    } else if (activeTab === "products") {
      loadProducts();
    } else if (activeTab === "inventory") {
      loadVariants();
    } else if (activeTab === "categories") {
      loadCategories();
    } else if (activeTab === "brands") {
      loadBrands();
    } else if (activeTab === "orders") {
      loadOrders();
    } else if (activeTab === "users") {
      loadUsers();
    } else if (activeTab === "analytics") {
      loadAnalytics();
    }
  }, [
    token,
    activeTab,
    loadStats,
    loadProducts,
    loadVariants,
    loadCategories,
    loadBrands,
    loadOrders,
    loadUsers,
    loadAnalytics,
  ]);

  // ----------------------------------------------------------------------------
  // Action Handlers
  // ----------------------------------------------------------------------------

  const handleRefreshCurrent = () => {
    if (activeTab === "overview") loadStats();
    else if (activeTab === "products") loadProducts();
    else if (activeTab === "inventory") loadVariants();
    else if (activeTab === "categories") loadCategories();
    else if (activeTab === "brands") loadBrands();
    else if (activeTab === "orders") loadOrders();
    else if (activeTab === "users") loadUsers();
    else if (activeTab === "analytics") loadAnalytics();
    showNotification("info", "Data refreshed.");
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to delete product "${name}" (ID: ${id})?`)) return;
    try {
      await deleteAdminProductApi(token, id);
      showNotification("success", `Product "${name}" deleted.`);
      loadProducts();
      loadStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete product.";
      showNotification("error", msg);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      await deleteAdminCategoryApi(token, id);
      showNotification("success", `Category "${name}" deleted.`);
      loadCategories();
      loadStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete category.";
      showNotification("error", msg);
    }
  };

  const handleDeleteBrand = async (id: number, name: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to delete brand "${name}"?`)) return;
    try {
      await deleteAdminBrandApi(token, id);
      showNotification("success", `Brand "${name}" deleted.`);
      loadBrands();
      loadStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete brand.";
      showNotification("error", msg);
    }
  };

  const handleViewOrder = async (orderId: number) => {
    if (!token) return;
    try {
      const res = await getAdminOrderByIdApi(token, orderId);
      setSelectedOrder(res.order);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load order details.";
      showNotification("error", msg);
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: number,
    newStatus?: string,
    newPaymentStatus?: string,
    confirmCodCollection?: boolean
  ) => {
    if (!token) return;
    try {
      await updateAdminOrderStatusApi(token, orderId, {
        status: newStatus,
        payment_status: newPaymentStatus,
        confirm_cod_collection: confirmCodCollection,
      });
      showNotification("success", `Order #${orderId} updated successfully.`);
      loadOrders();
      loadStats();
      if (selectedOrder && selectedOrder.order_id === orderId) {
        handleViewOrder(orderId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update order status.";
      showNotification("error", msg);
    }
  };

  const handleViewUser = async (userId: number) => {
    if (!token) return;
    try {
      const res = await getAdminUserByIdApi(token, userId);
      setSelectedUser(res.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load user profile.";
      showNotification("error", msg);
    }
  };

  const handleUpdateUserRole = async (userId: number, currentRole: string) => {
    if (!token) return;
    const targetRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
    if (
      !confirm(
        `Are you sure you want to change user #${userId}'s role to ${targetRole}?`
      )
    ) {
      return;
    }
    try {
      await updateAdminUserRoleApi(token, userId, targetRole);
      showNotification("success", `User #${userId} role changed to ${targetRole}.`);
      loadUsers();
      loadStats();
      if (selectedUser && selectedUser.user_id === userId) {
        handleViewUser(userId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change user role.";
      showNotification("error", msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#111827]">
      {/* Top Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#c65b3b] text-white flex items-center justify-center font-bold shadow-sm">
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">FashionIQ Management Portal</h1>
                <span className="rounded-full bg-red-100 text-red-800 text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
                  Live Admin
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Connected as {user?.first_name} {user?.last_name} ({user?.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshCurrent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
              title="Refresh active view"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <div className="h-4 w-px bg-gray-200 mx-1" />
            <span className="text-xs text-gray-400 font-mono">Phase 8</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto gap-1 border-t border-gray-100 scrollbar-none">
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            icon={<LayoutDashboard size={15} />}
            label="Overview"
          />
          <TabButton
            active={activeTab === "products"}
            onClick={() => setActiveTab("products")}
            icon={<Package size={15} />}
            label="Products"
            badge={stats ? stats.products.total : undefined}
          />
          <TabButton
            active={activeTab === "inventory"}
            onClick={() => setActiveTab("inventory")}
            icon={<Layers size={15} />}
            label="Inventory"
            badge={stats && stats.products.low_stock > 0 ? stats.products.low_stock : undefined}
            badgeColor="bg-amber-100 text-amber-800"
          />
          <TabButton
            active={activeTab === "categories"}
            onClick={() => setActiveTab("categories")}
            icon={<FolderTree size={15} />}
            label="Categories"
            badge={stats ? stats.categories.total : undefined}
          />
          <TabButton
            active={activeTab === "brands"}
            onClick={() => setActiveTab("brands")}
            icon={<Tag size={15} />}
            label="Brands"
            badge={stats ? stats.brands.total : undefined}
          />
          <TabButton
            active={activeTab === "orders"}
            onClick={() => setActiveTab("orders")}
            icon={<ShoppingBag size={15} />}
            label="Orders"
            badge={stats && stats.orders.pending > 0 ? stats.orders.pending : undefined}
            badgeColor="bg-blue-100 text-blue-800"
          />
          <TabButton
            active={activeTab === "users"}
            onClick={() => setActiveTab("users")}
            icon={<Users size={15} />}
            label="Users"
            badge={stats ? stats.users.total : undefined}
          />
          <TabButton
            active={activeTab === "analytics"}
            onClick={() => setActiveTab("analytics")}
            icon={<BarChart3 size={15} />}
            label="Analytics"
          />
        </div>
      </div>

      {/* Global Notifications */}
      {notification && (
        <div
          className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 transition-all duration-300`}
        >
          <div
            className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium shadow-sm ${
              notification.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : notification.type === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" && <CheckCircle2 size={16} />}
              {notification.type === "error" && <XCircle size={16} />}
              {notification.type === "info" && <AlertCircle size={16} />}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-400 hover:text-gray-700"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <OverviewTab
            stats={stats}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenAddProduct={() => {
              loadBrands();
              loadCategories();
              setProductModal({ mode: "create" });
            }}
            onOpenAddCategory={() => setCategoryModal({ mode: "create" })}
            onOpenAddBrand={() => setBrandModal({ mode: "create" })}
            onViewOrder={handleViewOrder}
          />
        )}

        {/* TAB 2: PRODUCTS */}
        {activeTab === "products" && (
          <ProductsTab
            products={products}
            categories={categories}
            brands={brands}
            search={productSearch}
            setSearch={setProductSearch}
            categoryFilter={productCategoryFilter}
            setCategoryFilter={setProductCategoryFilter}
            brandFilter={productBrandFilter}
            setBrandFilter={setProductBrandFilter}
            onOpenAddProduct={() => {
              loadBrands();
              loadCategories();
              setProductModal({ mode: "create" });
            }}
            onEditProduct={(p) => {
              loadBrands();
              loadCategories();
              setProductModal({ mode: "edit", product: p });
            }}
            onDeleteProduct={handleDeleteProduct}
            onAddVariant={(productId) => setVariantModal({ mode: "create", productId })}
          />
        )}

        {/* TAB 3: INVENTORY */}
        {activeTab === "inventory" && (
          <InventoryTab
            variants={variants}
            filter={inventoryStockFilter}
            setFilter={setInventoryStockFilter}
            onUpdateVariant={(v) => setVariantModal({ mode: "edit", variant: v })}
            onAddVariant={() => setVariantModal({ mode: "create" })}
            onDeleteVariant={async (id) => {
              if (!token || !confirm("Are you sure you want to delete this variant?")) return;
              try {
                await deleteAdminVariantApi(token, id);
                showNotification("success", "Variant deleted.");
                loadVariants();
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Failed to delete variant.";
                showNotification("error", msg);
              }
            }}
          />
        )}

        {/* TAB 4: CATEGORIES */}
        {activeTab === "categories" && (
          <CategoriesTab
            categories={categories}
            onOpenAddCategory={() => setCategoryModal({ mode: "create" })}
            onEditCategory={(c) => setCategoryModal({ mode: "edit", category: c })}
            onDeleteCategory={handleDeleteCategory}
          />
        )}

        {/* TAB 5: BRANDS */}
        {activeTab === "brands" && (
          <BrandsTab
            brands={brands}
            onOpenAddBrand={() => setBrandModal({ mode: "create" })}
            onEditBrand={(b) => setBrandModal({ mode: "edit", brand: b })}
            onDeleteBrand={handleDeleteBrand}
          />
        )}

        {/* TAB 6: ORDERS */}
        {activeTab === "orders" && (
          <OrdersTab
            orders={orders}
            statusFilter={orderStatusFilter}
            setStatusFilter={setOrderStatusFilter}
            search={orderSearch}
            setSearch={setOrderSearch}
            onViewOrder={handleViewOrder}
            onUpdateStatus={handleUpdateOrderStatus}
          />
        )}

        {/* TAB 7: USERS */}
        {activeTab === "users" && (
          <UsersTab
            users={usersList}
            search={userSearch}
            setSearch={setUserSearch}
            roleFilter={userRoleFilter}
            setRoleFilter={setUserRoleFilter}
            onViewUser={handleViewUser}
            onToggleRole={handleUpdateUserRole}
          />
        )}

        {/* TAB 8: ANALYTICS */}
        {activeTab === "analytics" && <AnalyticsTab analytics={analytics} />}
      </main>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={handleUpdateOrderStatus}
        />
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onToggleRole={handleUpdateUserRole}
        />
      )}

      {/* Product Create/Edit Modal */}
      {productModal && (
        <ProductFormModal
          mode={productModal.mode}
          product={productModal.product}
          categories={categories}
          brands={brands}
          onClose={() => setProductModal(null)}
          onSaved={() => {
            setProductModal(null);
            showNotification(
              "success",
              `Product ${productModal.mode === "create" ? "created" : "updated"} successfully.`
            );
            loadProducts();
            loadStats();
          }}
          onError={(msg) => showNotification("error", msg)}
          token={token!}
        />
      )}

      {/* Variant Create/Edit Modal */}
      {variantModal && (
        <VariantFormModal
          mode={variantModal.mode}
          variant={variantModal.variant}
          productId={variantModal.productId}
          products={products}
          onClose={() => setVariantModal(null)}
          onSaved={() => {
            setVariantModal(null);
            showNotification(
              "success",
              `Variant ${variantModal.mode === "create" ? "created" : "updated"} successfully.`
            );
            loadVariants();
            loadStats();
          }}
          onError={(msg) => showNotification("error", msg)}
          token={token!}
        />
      )}

      {/* Category Create/Edit Modal */}
      {categoryModal && (
        <CategoryFormModal
          mode={categoryModal.mode}
          category={categoryModal.category}
          categories={categories}
          onClose={() => setCategoryModal(null)}
          onSaved={() => {
            setCategoryModal(null);
            showNotification(
              "success",
              `Category ${categoryModal.mode === "create" ? "created" : "updated"} successfully.`
            );
            loadCategories();
            loadStats();
          }}
          onError={(msg) => showNotification("error", msg)}
          token={token!}
        />
      )}

      {/* Brand Create/Edit Modal */}
      {brandModal && (
        <BrandFormModal
          mode={brandModal.mode}
          brand={brandModal.brand}
          onClose={() => setBrandModal(null)}
          onSaved={() => {
            setBrandModal(null);
            showNotification(
              "success",
              `Brand ${brandModal.mode === "create" ? "created" : "updated"} successfully.`
            );
            loadBrands();
            loadStats();
          }}
          onError={(msg) => showNotification("error", msg)}
          token={token!}
        />
      )}
    </div>
  );
}

// ==============================================================================
// Sub-components: Tab Button
// ==============================================================================

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeColor = "bg-gray-100 text-gray-700",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-3 text-xs font-medium border-b-2 transition whitespace-nowrap ${
        active
          ? "border-[#c65b3b] text-[#c65b3b] font-semibold"
          : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && (
        <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${badgeColor}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ==============================================================================
// TAB: OVERVIEW
// ==============================================================================

function OverviewTab({
  stats,
  onNavigate,
  onOpenAddProduct,
  onOpenAddCategory,
  onOpenAddBrand,
  onViewOrder,
}: {
  stats: AdminDashboardStats | null;
  onNavigate: (tab: TabType) => void;
  onOpenAddProduct: () => void;
  onOpenAddCategory: () => void;
  onOpenAddBrand: () => void;
  onViewOrder: (id: number) => void;
}) {
  if (!stats) {
    return (
      <div className="py-20 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent mx-auto" />
        <p className="mt-3 text-xs text-gray-500">Loading live operational statistics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Accounting Policy Banner */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-amber-700 mt-0.5 shrink-0" size={18} />
          <div>
            <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              FashionIQ Revenue Recognition Policy
            </h3>
            <p className="text-xs text-amber-800 mt-1">
              {stats.accounting_policy}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Recognized Revenue"
          value={`₹${stats.revenue.recognized_revenue.toLocaleString("en-IN")}`}
          subtext={`${stats.revenue.total_paid_orders} paid orders (Genuine)`}
          icon={<DollarSign size={20} className="text-green-600" />}
          accent="border-green-200"
        />
        <StatCard
          label="Pending Collections"
          value={`₹${stats.revenue.cod_pending_revenue.toLocaleString("en-IN")}`}
          subtext={`${stats.revenue.total_pending_orders} pending COD orders`}
          icon={<TrendingUp size={20} className="text-amber-600" />}
          accent="border-amber-200"
        />
        <StatCard
          label="Simulated Card Volume"
          value={`₹${stats.revenue.simulated_card_revenue.toLocaleString("en-IN")}`}
          subtext="Test gateway (Not recognized)"
          icon={<Shield size={20} className="text-purple-600" />}
          accent="border-purple-200 bg-purple-50/20"
        />
        <StatCard
          label="Total Orders"
          value={stats.orders.total}
          subtext={`${stats.orders.delivered} delivered • ${stats.orders.pending} pending`}
          icon={<ShoppingBag size={20} className="text-blue-600" />}
          accent="border-blue-200"
          onClick={() => onNavigate("orders")}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        <StatCard
          label="Registered Users"
          value={stats.users.total}
          subtext={`${stats.users.customers} customers • ${stats.users.admins} admin(s)`}
          icon={<Users size={20} className="text-purple-600" />}
          accent="border-purple-200"
          onClick={() => onNavigate("users")}
        />
        <StatCard
          label="Active Products"
          value={stats.products.total}
          subtext={`${stats.categories.total} categories • ${stats.brands.total} brands`}
          icon={<Package size={20} className="text-[#c65b3b]" />}
          onClick={() => onNavigate("products")}
        />
        <StatCard
          label="Low Stock Items"
          value={stats.products.low_stock}
          subtext="Stock quantity < 10 units"
          icon={<AlertTriangle size={20} className="text-amber-500" />}
          accent={stats.products.low_stock > 0 ? "border-amber-300 bg-amber-50/30" : ""}
          onClick={() => onNavigate("inventory")}
        />
        <StatCard
          label="Out of Stock Variants"
          value={stats.products.out_of_stock_variants}
          subtext="Requires restocking"
          icon={<XCircle size={20} className="text-red-500" />}
          accent={stats.products.out_of_stock_variants > 0 ? "border-red-300 bg-red-50/30" : ""}
          onClick={() => onNavigate("inventory")}
        />
        <StatCard
          label="Catalog Categories"
          value={stats.categories.total}
          subtext={`${stats.brands.total} partnered brands`}
          icon={<FolderTree size={20} className="text-indigo-600" />}
          onClick={() => onNavigate("categories")}
        />
      </div>

      {/* Quick Action Bar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          Quick Management Actions
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onOpenAddProduct}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition"
          >
            <Plus size={14} /> Add New Product
          </button>
          <button
            onClick={onOpenAddCategory}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-800 hover:bg-gray-50 transition"
          >
            <Plus size={14} /> Add Category
          </button>
          <button
            onClick={onOpenAddBrand}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-800 hover:bg-gray-50 transition"
          >
            <Plus size={14} /> Add Partner Brand
          </button>
          <button
            onClick={() => onNavigate("inventory")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
          >
            <AlertTriangle size={14} /> Audit Stock Levels
          </button>
          <button
            onClick={() => onNavigate("analytics")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-800 hover:bg-gray-50 transition"
          >
            <BarChart3 size={14} /> View Analytics Breakdown
          </button>
        </div>
      </div>

      {/* Live Recent Activity: Orders & Registrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Recent Customer Orders</h3>
              <p className="text-xs text-gray-500">Live order flow from MySQL</p>
            </div>
            <button
              onClick={() => onNavigate("orders")}
              className="text-xs font-semibold text-[#c65b3b] hover:underline flex items-center gap-1"
            >
              View all <ChevronRight size={13} />
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {stats.recent_activity.orders.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">No orders recorded yet.</p>
            ) : (
              stats.recent_activity.orders.map((order) => (
                <div
                  key={order.order_id}
                  onClick={() => onViewOrder(order.order_id)}
                  className="py-3 flex items-center justify-between hover:bg-gray-50 px-2 rounded-lg cursor-pointer transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900">#{order.order_id}</span>
                      <span className="text-xs font-medium text-gray-700">
                        {order.customer_name}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {new Date(order.created_at).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-900">
                      ₹{Number(order.total_amount).toLocaleString("en-IN")}
                    </p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Customer Registrations */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Recent Registrations</h3>
              <p className="text-xs text-gray-500">New customer accounts</p>
            </div>
            <button
              onClick={() => onNavigate("users")}
              className="text-xs font-semibold text-[#c65b3b] hover:underline flex items-center gap-1"
            >
              View all <ChevronRight size={13} />
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {stats.recent_activity.registrations.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">No registrations found.</p>
            ) : (
              stats.recent_activity.registrations.map((u) => (
                <div key={u.user_id} className="py-3 flex items-center justify-between px-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900">
                        {u.first_name} {u.last_name}
                      </span>
                      {u.role === "ADMIN" && (
                        <span className="rounded-full bg-red-100 text-red-800 text-[10px] font-bold px-1.5">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {new Date(u.created_at).toLocaleDateString("en-IN")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  icon,
  accent = "",
  onClick,
}: {
  label: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
        onClick ? "cursor-pointer hover:shadow-md hover:border-gray-300" : ""
      } ${accent}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div className="p-2 rounded-xl bg-gray-50">{icon}</div>
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold tracking-tight text-gray-900">{value}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{subtext}</p>
      </div>
    </div>
  );
}

// ==============================================================================
// TAB: PRODUCTS
// ==============================================================================

function ProductsTab({
  products,
  categories,
  brands,
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  brandFilter,
  setBrandFilter,
  onOpenAddProduct,
  onEditProduct,
  onDeleteProduct,
  onAddVariant,
}: {
  products: AdminProductItem[];
  categories: AdminCategoryItem[];
  brands: AdminBrandItem[];
  search: string;
  setSearch: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  brandFilter: string;
  setBrandFilter: (v: string) => void;
  onOpenAddProduct: () => void;
  onEditProduct: (p: AdminProductItem) => void;
  onDeleteProduct: (id: number, name: string) => void;
  onAddVariant: (productId: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Search & Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search products by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>
                {c.category_name}
              </option>
            ))}
          </select>

          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.brand_id} value={b.brand_id}>
                {b.brand_name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onOpenAddProduct}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition"
        >
          <Plus size={14} /> Add Product
        </button>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-3">Brand</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Price</th>
                <th className="py-3 px-3">Gender</th>
                <th className="py-3 px-3">Variants</th>
                <th className="py-3 px-3">Total Stock</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.product_id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image_url || "/placeholder.png"}
                          alt={p.product_name}
                          className="h-10 w-10 rounded-lg object-cover bg-gray-100 border border-gray-200 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=200";
                          }}
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{p.product_name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">ID: #{p.product_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-medium text-gray-700">{p.brand_name}</td>
                    <td className="py-3 px-3 text-gray-600">{p.category_name}</td>
                    <td className="py-3 px-3 font-bold text-gray-900">
                      ₹{Number(p.price).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3 capitalize text-gray-600">{p.gender}</td>
                    <td className="py-3 px-3">
                      <span className="rounded-full bg-gray-100 text-gray-800 px-2 py-0.5 text-[10px] font-semibold">
                        {p.variant_count} variant(s)
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          p.total_stock === 0
                            ? "bg-red-100 text-red-800"
                            : p.total_stock < 10
                            ? "bg-amber-100 text-amber-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {p.total_stock} units
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => onAddVariant(p.product_id)}
                          className="p-1.5 rounded-lg text-gray-600 hover:text-black hover:bg-gray-100"
                          title="Add Variant"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => onEditProduct(p)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                          title="Edit Product"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteProduct(p.product_id, p.product_name)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                          title="Delete Product"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// TAB: INVENTORY (VARIANTS)
// ==============================================================================

function InventoryTab({
  variants,
  filter,
  setFilter,
  onUpdateVariant,
  onAddVariant,
  onDeleteVariant,
}: {
  variants: AdminVariantItem[];
  filter: "all" | "low" | "out";
  setFilter: (f: "all" | "low" | "out") => void;
  onUpdateVariant: (v: AdminVariantItem) => void;
  onAddVariant: () => void;
  onDeleteVariant: (id: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === "all" ? "bg-black text-white" : "bg-white border text-gray-700"
            }`}
          >
            All Variants
          </button>
          <button
            onClick={() => setFilter("low")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === "low"
                ? "bg-amber-600 text-white"
                : "bg-white border text-amber-800 border-amber-200"
            }`}
          >
            Low Stock (&lt; 10)
          </button>
          <button
            onClick={() => setFilter("out")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === "out" ? "bg-red-600 text-white" : "bg-white border text-red-800 border-red-200"
            }`}
          >
            Out of Stock (= 0)
          </button>
        </div>

        <button
          onClick={onAddVariant}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition"
        >
          <Plus size={14} /> Add Product Variant
        </button>
      </div>

      {/* Variants Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Variant ID</th>
                <th className="py-3 px-3">Product Name</th>
                <th className="py-3 px-3">Brand</th>
                <th className="py-3 px-3">Color</th>
                <th className="py-3 px-3">Size</th>
                <th className="py-3 px-3">Stock Quantity</th>
                <th className="py-3 px-3">Unit Price</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {variants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    No variants found matching criteria.
                  </td>
                </tr>
              ) : (
                variants.map((v) => (
                  <tr key={v.variant_id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                      #{v.variant_id}
                    </td>
                    <td className="py-3 px-3 font-medium text-gray-900">
                      {v.product_name}
                      <span className="text-[10px] text-gray-400 block font-mono">
                        Prod ID: #{v.product_id}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{v.brand_name}</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-200 text-[11px] font-medium bg-gray-50">
                        {v.color}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-gray-800">{v.size}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          v.stock_quantity === 0
                            ? "bg-red-100 text-red-800"
                            : v.stock_quantity < 10
                            ? "bg-amber-100 text-amber-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {v.stock_quantity} units
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-gray-900">
                      ₹{Number(v.price).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => onUpdateVariant(v)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                          title="Quick Edit Stock / Price"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteVariant(v.variant_id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                          title="Delete Variant"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// TAB: CATEGORIES
// ==============================================================================

function CategoriesTab({
  categories,
  onOpenAddCategory,
  onEditCategory,
  onDeleteCategory,
}: {
  categories: AdminCategoryItem[];
  onOpenAddCategory: () => void;
  onEditCategory: (c: AdminCategoryItem) => void;
  onDeleteCategory: (id: number, name: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Category Catalog</h2>
          <p className="text-xs text-gray-500">
            Categories cannot be deleted while assigned to active products.
          </p>
        </div>
        <button
          onClick={onOpenAddCategory}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition"
        >
          <Plus size={14} /> Add Category
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-3">Category Name</th>
              <th className="py-3 px-3">Parent ID</th>
              <th className="py-3 px-3">Description</th>
              <th className="py-3 px-3">Product Count</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((c) => (
              <tr key={c.category_id} className="hover:bg-gray-50/70 transition">
                <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                  #{c.category_id}
                </td>
                <td className="py-3 px-3 font-bold text-gray-900">{c.category_name}</td>
                <td className="py-3 px-3 text-gray-500 font-mono">
                  {c.parent_category_id ? `#${c.parent_category_id}` : "Root (None)"}
                </td>
                <td className="py-3 px-3 text-gray-600 max-w-xs truncate">
                  {c.description || "—"}
                </td>
                <td className="py-3 px-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.product_count > 0 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {c.product_count} products
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => onEditCategory(c)}
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                      title="Edit Category"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteCategory(c.category_id, c.category_name)}
                      disabled={c.product_count > 0}
                      className={`p-1.5 rounded-lg ${
                        c.product_count > 0
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-red-600 hover:bg-red-50"
                      }`}
                      title={
                        c.product_count > 0
                          ? "Cannot delete category containing active products"
                          : "Delete Category"
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==============================================================================
// TAB: BRANDS
// ==============================================================================

function BrandsTab({
  brands,
  onOpenAddBrand,
  onEditBrand,
  onDeleteBrand,
}: {
  brands: AdminBrandItem[];
  onOpenAddBrand: () => void;
  onEditBrand: (b: AdminBrandItem) => void;
  onDeleteBrand: (id: number, name: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Partner Brands</h2>
          <p className="text-xs text-gray-500">
            Brands cannot be deleted while associated with catalog products.
          </p>
        </div>
        <button
          onClick={onOpenAddBrand}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition"
        >
          <Plus size={14} /> Add Brand
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-3">Brand Name</th>
              <th className="py-3 px-3">Country</th>
              <th className="py-3 px-3">Website</th>
              <th className="py-3 px-3">Products</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {brands.map((b) => (
              <tr key={b.brand_id} className="hover:bg-gray-50/70 transition">
                <td className="py-3 px-4 font-mono font-semibold text-gray-900">#{b.brand_id}</td>
                <td className="py-3 px-3 font-bold text-gray-900">{b.brand_name}</td>
                <td className="py-3 px-3 text-gray-600">{b.country || "—"}</td>
                <td className="py-3 px-3">
                  {b.website ? (
                    <a
                      href={b.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#c65b3b] hover:underline inline-flex items-center gap-1"
                    >
                      {b.website.replace(/^https?:\/\//, "")} <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="py-3 px-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      b.product_count > 0 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {b.product_count} products
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => onEditBrand(b)}
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                      title="Edit Brand"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteBrand(b.brand_id, b.brand_name)}
                      disabled={b.product_count > 0}
                      className={`p-1.5 rounded-lg ${
                        b.product_count > 0
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-red-600 hover:bg-red-50"
                      }`}
                      title={
                        b.product_count > 0
                          ? "Cannot delete brand containing active products"
                          : "Delete Brand"
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==============================================================================
// TAB: ORDERS
// ==============================================================================

function OrdersTab({
  orders,
  statusFilter,
  setStatusFilter,
  search,
  setSearch,
  onViewOrder,
  onUpdateStatus,
}: {
  orders: AdminOrderItem[];
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  search: string;
  setSearch: (s: string) => void;
  onViewOrder: (id: number) => void;
  onUpdateStatus: (id: number, status: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search by order ID, customer name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Total Amount</th>
                <th className="py-3 px-3">Payment</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    No orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.order_id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-gray-900">
                      #{o.order_id}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-gray-900">{o.customer_name}</p>
                      <p className="text-[11px] text-gray-400">{o.customer_email}</p>
                    </td>
                    <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-3 px-3 font-bold text-gray-900">
                      ₹{Number(o.total_amount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3">
                      <div>
                        <span className="text-[11px] font-semibold text-gray-800">
                          {o.payment_method}
                        </span>
                        <span
                          className={`ml-1.5 rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                            o.payment_status === "PAID"
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {o.payment_status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => onViewOrder(o.order_id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          <Eye size={12} /> Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// TAB: USERS
// ==============================================================================

function UsersTab({
  users,
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  onViewUser,
  onToggleRole,
}: {
  users: AdminUserItem[];
  search: string;
  setSearch: (s: string) => void;
  roleFilter: string;
  setRoleFilter: (r: string) => void;
  onViewUser: (id: number) => void;
  onToggleRole: (id: number, currentRole: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search users by name, email or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none"
          >
            <option value="">All Roles</option>
            <option value="USER">USER (Customer)</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-4">User ID</th>
              <th className="py-3 px-3">Name</th>
              <th className="py-3 px-3">Email</th>
              <th className="py-3 px-3">Role</th>
              <th className="py-3 px-3">Registered</th>
              <th className="py-3 px-3">Orders</th>
              <th className="py-3 px-3">Lifetime Spend</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400">
                  No users found matching filters.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.user_id} className="hover:bg-gray-50/70 transition">
                  <td className="py-3 px-4 font-mono font-semibold text-gray-900">#{u.user_id}</td>
                  <td className="py-3 px-3 font-bold text-gray-900">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="py-3 px-3 text-gray-600">{u.email}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        u.role === "ADMIN"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="py-3 px-3 font-semibold text-gray-800">
                    {u.order_count} order(s)
                  </td>
                  <td className="py-3 px-3 font-bold text-gray-900">
                    ₹{Number(u.lifetime_spend).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => onViewUser(u.user_id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <Eye size={12} /> Profile
                      </button>
                      <button
                        onClick={() => onToggleRole(u.user_id, u.role)}
                        className="p-1 rounded-lg text-gray-500 hover:text-black hover:bg-gray-100"
                        title={u.role === "ADMIN" ? "Demote to USER" : "Promote to ADMIN"}
                      >
                        <Shield size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==============================================================================
// TAB: ANALYTICS
// ==============================================================================

function AnalyticsTab({ analytics }: { analytics: AdminAnalyticsData | null }) {
  if (!analytics) {
    return (
      <div className="py-20 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent mx-auto" />
        <p className="mt-3 text-xs text-gray-500">Loading comprehensive analytics data...</p>
      </div>
    );
  }

  const {
    monthly_trends = [],
    order_status_distribution = [],
    payment_distribution = [],
    top_products = [],
    category_distribution = [],
    stock_overview = [],
  } = analytics.analytics || {};

  const safeTrends = monthly_trends || [];
  const maxRevenue = Math.max(
    ...safeTrends.map((m) => Number(m?.paid_revenue || 0)),
    1000
  );

  return (
    <div className="space-y-6">
      {/* Monthly Sales & Orders Chart */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Monthly Recognized Revenue Trends</h3>
            <p className="text-xs text-gray-500">
              Only orders marked PAID are recognized in this revenue metric
            </p>
          </div>
        </div>

        {safeTrends.length === 0 ? (
          <p className="py-12 text-center text-xs text-gray-400">
            No historical monthly revenue recorded yet.
          </p>
        ) : (
          <div className="space-y-3 pt-2">
            {safeTrends.map((item, idx) => {
              const paidRev = Number(item?.paid_revenue || 0);
              const ordersCount = Number(item?.total_orders || 0);
              const percent = Math.min(
                100,
                Math.max(0, Math.round((paidRev / (maxRevenue || 1)) * 100))
              );
              return (
                <div key={item?.month || idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-gray-800">{item?.month || "Unknown"}</span>
                    <span className="font-bold text-gray-900">
                      ₹{paidRev.toLocaleString("en-IN")}{" "}
                      <span className="text-[11px] font-normal text-gray-500">
                        ({ordersCount} orders)
                      </span>
                    </span>
                  </div>
                  <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${percent}%` }}
                      className="bg-[#c65b3b] h-full rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid: Order Status & Payment Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Status Distribution */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Order Status Distribution</h3>
          {(!order_status_distribution || order_status_distribution.length === 0) ? (
            <p className="py-6 text-center text-xs text-gray-400">
              No orders recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {order_status_distribution.map((item, idx) => (
                <div key={item?.status || idx} className="py-2.5 flex items-center justify-between">
                  <OrderStatusBadge status={item?.status || "PENDING"} />
                  <span className="text-xs font-bold text-gray-900">
                    {Number(item?.count || 0)} order(s)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Breakdown */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Payment Method Breakdown</h3>
          {(!payment_distribution || payment_distribution.length === 0) ? (
            <p className="py-6 text-center text-xs text-gray-400">
              No payment transactions recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {payment_distribution.map((p, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-gray-900">
                      {p?.payment_method || "Unknown"}
                    </span>
                    <span
                      className={`ml-2 rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                        p?.payment_status === "PAID"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {p?.payment_status || "PENDING"}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      ₹{Number(p?.total_amount || 0).toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-gray-400">{Number(p?.order_count || 0)} order(s)</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid: Top Selling Products & Category Popularity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Top-Selling Products Leaderboard</h3>
          <div className="divide-y divide-gray-100">
            {(!top_products || top_products.length === 0) ? (
              <p className="py-6 text-center text-xs text-gray-400">
                No orders completed yet to calculate sales leaderboard.
              </p>
            ) : (
              top_products.map((p, idx) => {
                const unitsSold = Number(p?.total_units_sold ?? p?.total_sold ?? 0);
                const revenue = Number(p?.total_revenue || 0);
                return (
                  <div key={p?.product_id || idx} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-gray-900">{p?.product_name || "Unknown Product"}</p>
                      <p className="text-[11px] text-gray-500">
                        {p?.brand_name || "FashionIQ"} • {p?.category_name || "General"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        {unitsSold} units sold
                      </p>
                      <p className="text-[11px] text-gray-500">
                        ₹{revenue.toLocaleString("en-IN")} rev
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Category Performance */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Popular Product Categories</h3>
          <div className="divide-y divide-gray-100">
            {(!category_distribution || category_distribution.length === 0) ? (
              <p className="py-6 text-center text-xs text-gray-400">
                No category data recorded yet.
              </p>
            ) : (
              category_distribution.slice(0, 8).map((c, idx) => {
                const productCount = Number(c?.product_count || 0);
                const unitsSold = Number(c?.units_sold ?? c?.items_sold ?? 0);
                const revenue = Number(c?.revenue || 0);
                return (
                  <div key={c?.category_id || idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-gray-900">{c?.category_name || "Category"}</p>
                      <p className="text-[11px] text-gray-400">{productCount} catalog items</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-900">{unitsSold} units</span>
                      {revenue > 0 && (
                        <span className="text-[11px] text-gray-500 block">
                          ₹{revenue.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Inventory Stock Health Breakdown */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Inventory Health Overview</h3>
        {(!stock_overview || stock_overview.length === 0) ? (
          <p className="py-6 text-center text-xs text-gray-400">
            No inventory stock data recorded yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stock_overview.map((s, idx) => {
              const rawLevel = String(s?.stock_level || "").trim();
              const count = Number(s?.variant_count) || 0;
              const isOut =
                rawLevel.toLowerCase().includes("out of stock") ||
                (rawLevel === "" && count === 0);
              const isLow = rawLevel.toLowerCase().includes("low stock");
              const displayLevel =
                rawLevel || (isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock");

              const cardStyle = isOut
                ? "bg-red-50 border-red-200"
                : isLow
                ? "bg-amber-50 border-amber-200"
                : "bg-green-50 border-green-200";

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border text-center ${cardStyle}`}
                >
                  <p className="text-xs font-semibold text-gray-600">{displayLevel}</p>
                  <p className="text-2xl font-bold mt-1 text-gray-900">{count}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Product Variants</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: ORDER DETAILS & STATUS UPDATE
// ==============================================================================

function OrderDetailModal({
  order,
  onClose,
  onUpdateStatus,
}: {
  order: AdminOrderDetail;
  onClose: () => void;
  onUpdateStatus: (
    id: number,
    status?: string,
    payment_status?: string,
    confirm_cod_collection?: boolean
  ) => void;
}) {
  const [selectedStatus, setSelectedStatus] = useState(order.status);
  const [confirmCod, setConfirmCod] = useState(false);

  const isCod = order.payment_method === "COD";
  const isDelivered = selectedStatus === "DELIVERED" || order.status === "DELIVERED";
  const canConfirmCod = isCod && isDelivered && order.payment_status !== "PAID";

  const hasStatusChanged = selectedStatus !== order.status;
  const canSave = hasStatusChanged || (canConfirmCod && confirmCod);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-base font-bold text-gray-900">Order #{order.order_id}</h2>
            <p className="text-xs text-gray-500">
              Placed on {new Date(order.created_at).toLocaleString("en-IN")}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Customer & Shipping Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 border text-xs">
            <div>
              <p className="font-bold text-gray-900 mb-1">Customer Information</p>
              <p className="text-gray-700 font-semibold">{order.customer_name}</p>
              <p className="text-gray-500">{order.customer_email}</p>
              <p className="text-[11px] text-gray-400 font-mono mt-1">User ID: #{order.user_id}</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 mb-1">Shipping Snapshot</p>
              <p className="text-gray-700 whitespace-pre-wrap">{order.shipping_address}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-medium text-gray-700">
                  Payment: {order.payment_method}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    order.payment_status === "PAID"
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {order.payment_status}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Purchased Items ({order.items.length})
            </h3>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden text-xs">
              {order.items.map((item) => (
                <div key={item.order_item_id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.image_url || "/placeholder.png"}
                      alt={item.product_name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=200";
                      }}
                      className="h-10 w-10 rounded-lg object-cover bg-gray-100 border shrink-0"
                    />
                    <div>
                      <p className="font-bold text-gray-900">{item.product_name}</p>
                      <p className="text-[11px] text-gray-500">
                        Color: {item.color} • Size: {item.size} • Qty: {item.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      ₹{Number(item.subtotal).toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      ₹{Number(item.unit_price).toLocaleString("en-IN")} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50 border text-xs">
            <span className="font-bold text-gray-700">Order Grand Total:</span>
            <span className="text-base font-bold text-gray-900">
              ₹{Number(order.total_amount).toLocaleString("en-IN")}
            </span>
          </div>

          {/* Status Update Control */}
          <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Update Order Status & Transition
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-gray-600 font-medium mb-1">Fulfillment Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  disabled={order.status === "DELIVERED" || order.status === "CANCELLED"}
                  className="w-full p-2 rounded-xl border border-gray-200 bg-white focus:outline-none"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="PROCESSING">PROCESSING</option>
                  <option value="SHIPPED">SHIPPED</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="CANCELLED">CANCELLED (Restore Stock)</option>
                </select>
                {order.status === "DELIVERED" && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Delivered orders are final and cannot be reverted.
                  </p>
                )}
                {order.status === "CANCELLED" && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Cancelled orders are terminal. Stock has been restored.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">
                  Payment Status ({order.payment_method})
                </label>
                {isCod ? (
                  <div className="p-2.5 rounded-xl border border-gray-200 bg-gray-50">
                    {order.payment_status === "PAID" ? (
                      <span className="text-green-700 font-bold flex items-center gap-1">
                        <CheckCircle2 size={13} /> Cash Collection Confirmed (PAID)
                      </span>
                    ) : canConfirmCod ? (
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmCod}
                          onChange={(e) => setConfirmCod(e.target.checked)}
                          className="mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                        />
                        <span className="text-[11px] text-gray-800 leading-tight">
                          <strong>Confirm COD Cash Collection</strong>
                          <br />
                          <span className="text-gray-500 text-[10px]">
                            Check only after cash has been received. Sets payment to PAID and recognizes revenue.
                          </span>
                        </span>
                      </label>
                    ) : (
                      <p className="text-[11px] text-amber-800 font-medium">
                        PENDING — Cash on Delivery. Cash collection can only be confirmed once the order is DELIVERED.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl border border-gray-200 bg-gray-50">
                    <span className="text-gray-800 font-semibold">{order.payment_status}</span>
                    <span className="text-gray-400 text-[10px] block mt-0.5">
                      {order.payment_method === "SIMULATED_CARD"
                        ? "Test card simulation gateway (not genuine revenue)."
                        : "Payment processed via gateway."}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                disabled={!canSave}
                onClick={() =>
                  onUpdateStatus(
                    order.order_id,
                    hasStatusChanged ? selectedStatus : undefined,
                    undefined,
                    canConfirmCod && confirmCod ? true : undefined
                  )
                }
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  canSave
                    ? "bg-black text-white hover:bg-gray-800"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                Save Status Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: USER DETAILS & STYLE PROFILE
// ==============================================================================

function UserDetailModal({
  user,
  onClose,
  onToggleRole,
}: {
  user: AdminUserDetail;
  onClose: () => void;
  onToggleRole: (id: number, currentRole: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">
                {user.first_name} {user.last_name}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  user.role === "ADMIN" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"
                }`}
              >
                {user.role}
              </span>
            </div>
            <p className="text-xs text-gray-500">Registered {user.created_at}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Contact Details */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 border">
            <div>
              <p className="text-gray-500">Email Address</p>
              <p className="font-semibold text-gray-900 mt-0.5">{user.email}</p>
            </div>
            <div>
              <p className="text-gray-500">Phone Number</p>
              <p className="font-semibold text-gray-900 mt-0.5">{user.phone_number || "Not set"}</p>
            </div>
            <div>
              <p className="text-gray-500">Total Orders Placed</p>
              <p className="font-bold text-gray-900 mt-0.5">{user.order_count}</p>
            </div>
            <div>
              <p className="text-gray-500">Total Lifetime Spend</p>
              <p className="font-bold text-gray-900 mt-0.5">
                ₹{Number(user.lifetime_spend).toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* AI Style Profile */}
          <div className="p-4 rounded-xl border border-gray-200 space-y-3">
            <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">
              AI Style Profile & Sizing Preferences
            </h4>
            {user.profile ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <span className="text-gray-400 block text-[10px]">Height / Weight</span>
                  <span className="font-medium text-gray-800">
                    {user.profile.height ? `${user.profile.height} cm` : "—"} /{" "}
                    {user.profile.weight ? `${user.profile.weight} kg` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Body Shape</span>
                  <span className="font-medium text-gray-800 capitalize">
                    {user.profile.body_shape || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Preferred Fit</span>
                  <span className="font-medium text-gray-800 capitalize">
                    {user.profile.preferred_fit || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Max Budget</span>
                  <span className="font-medium text-gray-800">
                    {user.profile.max_budget
                      ? `₹${Number(user.profile.max_budget).toLocaleString("en-IN")}`
                      : "—"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 block text-[10px]">Preferred Styles</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.profile.preferred_styles && user.profile.preferred_styles.length > 0 ? (
                      user.profile.preferred_styles.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-medium"
                        >
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 italic">No AI style profile completed by user yet.</p>
            )}
          </div>

          {/* Past Orders */}
          <div>
            <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-2">
              Customer Order History ({user.orders.length})
            </h4>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {user.orders.length === 0 ? (
                <p className="p-4 text-center text-gray-400">No orders recorded for this user.</p>
              ) : (
                user.orders.map((o) => (
                  <div key={o.order_id} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-gray-900">Order #{o.order_id}</span>
                      <span className="text-gray-400 ml-2 font-mono text-[11px]">
                        {new Date(o.created_at).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">
                        ₹{Number(o.total_amount).toLocaleString("en-IN")}
                      </span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Role Action */}
          <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50 border">
            <div>
              <p className="font-bold text-gray-900">Account Role Permissions</p>
              <p className="text-gray-500 text-[11px]">
                Admins have full access to manage catalog, orders, and users.
              </p>
            </div>
            <button
              onClick={() => onToggleRole(user.user_id, user.role)}
              className="px-3 py-1.5 rounded-xl border border-gray-300 bg-white font-semibold text-gray-800 hover:bg-gray-100 transition"
            >
              {user.role === "ADMIN" ? "Demote to Customer (USER)" : "Promote to ADMIN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: PRODUCT FORM (CREATE / EDIT)
// ==============================================================================

function ProductFormModal({
  mode,
  product,
  categories,
  brands,
  onClose,
  onSaved,
  onError,
  token,
}: {
  mode: "create" | "edit";
  product?: AdminProductItem;
  categories: AdminCategoryItem[];
  brands: AdminBrandItem[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
  token: string;
}) {
  const [name, setName] = useState(product?.product_name || "");
  const [categoryId, setCategoryId] = useState<number>(
    product?.category_id || (categories[0]?.category_id ?? 1)
  );
  const [brandId, setBrandId] = useState<number>(
    product?.brand_id || (brands[0]?.brand_id ?? 1)
  );
  const [price, setPrice] = useState<string>(product ? String(product.price) : "");
  const [gender, setGender] = useState<string>(
    product?.gender
      ? product.gender.charAt(0).toUpperCase() + product.gender.slice(1).toLowerCase()
      : "Men"
  );
  const [description, setDescription] = useState(product?.description || "");
  const [imageUrl, setImageUrl] = useState(product?.image_url || "");
  const [submitting, setSubmitting] = useState(false);

  // Variant rows for product creation
  const [variantRows, setVariantRows] = useState<
    Array<{
      id: string;
      color: string;
      size: string;
      stock_quantity: string;
      price: string;
    }>
  >([
    { id: "1", color: "Sky Blue", size: "M", stock_quantity: "15", price: "" },
  ]);

  const handleAddVariantRow = () => {
    const lastColor = variantRows[variantRows.length - 1]?.color || "Sky Blue";
    setVariantRows((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        color: lastColor,
        size: "",
        stock_quantity: "10",
        price: "",
      },
    ]);
  };

  const handleRemoveVariantRow = (id: string) => {
    if (variantRows.length <= 1) return;
    setVariantRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateVariantRow = (
    id: string,
    field: "color" | "size" | "stock_quantity" | "price",
    value: string
  ) => {
    setVariantRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  useEffect(() => {
    if (!product && brands.length > 0 && !brands.some((b) => b.brand_id === brandId)) {
      setBrandId(brands[0].brand_id);
    }
  }, [brands, brandId, product]);

  useEffect(() => {
    if (!product && categories.length > 0 && !categories.some((c) => c.category_id === categoryId)) {
      setCategoryId(categories[0].category_id);
    }
  }, [categories, categoryId, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return onError("Product name is required.");
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) return onError("Price must be a positive number.");

    const normalizedGender = gender
      ? gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase()
      : "Men";

    let formattedVariants:
      | Array<{ color: string; size: string; stock_quantity: number; price?: number }>
      | undefined = undefined;

    if (mode === "create") {
      if (variantRows.length === 0) {
        return onError("At least one product variant (color, size, stock) is required.");
      }

      const seenCombos = new Set<string>();
      for (let i = 0; i < variantRows.length; i++) {
        const v = variantRows[i];
        if (!v.color.trim()) return onError(`Variant #${i + 1}: Color is required.`);
        if (!v.size.trim()) return onError(`Variant #${i + 1}: Size is required.`);
        const numStock = parseInt(v.stock_quantity, 10);
        if (isNaN(numStock) || numStock < 0) {
          return onError(
            `Variant #${i + 1} (${v.color} - ${v.size}): Stock quantity must be a non-negative integer.`
          );
        }
        const comboKey = `${v.color.trim().toLowerCase()}:::${v.size.trim().toLowerCase()}`;
        if (seenCombos.has(comboKey)) {
          return onError(
            `Duplicate variant detected: Color '${v.color.trim()}' with size '${v.size.trim()}' appears more than once. Each variant row must have a unique color/size combination.`
          );
        }
        seenCombos.add(comboKey);
      }

      formattedVariants = variantRows.map((v) => ({
        color: v.color.trim(),
        size: v.size.trim(),
        stock_quantity: parseInt(v.stock_quantity, 10),
        price: v.price && Number(v.price) > 0 ? Number(v.price) : undefined,
      }));
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        await createAdminProductApi(token, {
          product_name: name.trim(),
          category_id: categoryId,
          brand_id: brandId,
          price: numPrice,
          gender: normalizedGender,
          description: description.trim(),
          image_url: imageUrl.trim(),
          variants: formattedVariants,
        });
      } else if (product) {
        await updateAdminProductApi(token, product.product_id, {
          product_name: name.trim(),
          category_id: categoryId,
          brand_id: brandId,
          price: numPrice,
          gender: normalizedGender,
          description: description.trim(),
          image_url: imageUrl.trim(),
        });
      }
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save product.";
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h2 className="text-base font-bold text-gray-900">
            {mode === "create" ? "Add New Product" : `Edit Product #${product?.product_id}`}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Product Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Classic Oxford Cotton Shirt"
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Brand *</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none"
              >
                {brands.map((b) => (
                  <option key={b.brand_id} value={b.brand_id}>
                    {b.brand_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Price (₹) *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 1499"
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Target Gender *</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none"
              >
                <option value="Men">Men</option>
                <option value="Women">Women</option>
                <option value="Unisex">Unisex</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Product fabric, fit, detailing and care instructions..."
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          {/* Individual Variant Entry Section for Product Creation */}
          {mode === "create" && (
            <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-xs">
                    Product Variants (Individual Sizes, Colors & Stock)
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Each row creates a separate PRODUCT_VARIANT record with its own stock.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddVariantRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black text-white text-[11px] font-semibold hover:bg-gray-800 transition"
                >
                  <Plus size={12} /> Add Variant
                </button>
              </div>

              <div className="space-y-2.5">
                {variantRows.map((row, idx) => (
                  <div
                    key={row.id}
                    className="p-2.5 rounded-lg border border-gray-200 bg-white space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600">
                      <span>Variant #{idx + 1}</span>
                      {variantRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariantRow(row.id)}
                          className="text-red-500 hover:text-red-700 flex items-center gap-0.5 text-[10px]"
                        >
                          <Trash2 size={11} /> Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-gray-600 font-medium text-[10px] mb-0.5">
                          Color *
                        </label>
                        <input
                          type="text"
                          required
                          value={row.color}
                          onChange={(e) =>
                            handleUpdateVariantRow(row.id, "color", e.target.value)
                          }
                          placeholder="e.g. Sky Blue"
                          className="w-full p-1.5 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>

                      <div>
                        <label className="block text-gray-600 font-medium text-[10px] mb-0.5">
                          Size *
                        </label>
                        <input
                          type="text"
                          required
                          value={row.size}
                          onChange={(e) =>
                            handleUpdateVariantRow(row.id, "size", e.target.value)
                          }
                          placeholder="e.g. M, L, 32"
                          className="w-full p-1.5 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>

                      <div>
                        <label className="block text-gray-600 font-medium text-[10px] mb-0.5">
                          Stock Quantity *
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={row.stock_quantity}
                          onChange={(e) =>
                            handleUpdateVariantRow(row.id, "stock_quantity", e.target.value)
                          }
                          className="w-full p-1.5 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>

                      <div>
                        <label className="block text-gray-600 font-medium text-[10px] mb-0.5">
                          Price (₹, opt)
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={row.price}
                          onChange={(e) =>
                            handleUpdateVariantRow(row.id, "price", e.target.value)
                          }
                          placeholder="Base price"
                          className="w-full p-1.5 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>
                    </div>

                    {/* Quick Size Chips */}
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      <span className="text-[10px] text-gray-400">Quick Size:</span>
                      {["XS", "S", "M", "L", "XL", "XXL", "28", "30", "32", "34"].map(
                        (sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => handleUpdateVariantRow(row.id, "size", sz)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                              row.size === sz
                                ? "bg-black text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {sz}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? "Saving..." : mode === "create" ? "Create Product" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: VARIANT FORM (CREATE / EDIT)
// ==============================================================================

function VariantFormModal({
  mode,
  variant,
  productId,
  products,
  onClose,
  onSaved,
  onError,
  token,
}: {
  mode: "create" | "edit";
  variant?: AdminVariantItem;
  productId?: number;
  products: AdminProductItem[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
  token: string;
}) {
  const [selectedProdId, setSelectedProdId] = useState<number>(
    variant?.product_id || productId || (products[0]?.product_id ?? 1)
  );
  const [color, setColor] = useState(variant?.color || "");
  const [size, setSize] = useState(variant?.size || "");
  const [stock, setStock] = useState<string>(
    variant !== undefined ? String(variant.stock_quantity) : "10"
  );
  const [price, setPrice] = useState<string>(variant ? String(variant.price) : "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!color.trim()) return onError("Color is required.");
    if (!size.trim()) return onError("Size is required.");
    const numStock = parseInt(stock, 10);
    if (isNaN(numStock) || numStock < 0) {
      return onError("Stock quantity must be a non-negative integer.");
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        await createAdminVariantApi(token, {
          product_id: selectedProdId,
          color: color.trim(),
          size: size.trim(),
          stock_quantity: numStock,
          price: price ? Number(price) : undefined,
        });
      } else if (variant) {
        await updateAdminVariantApi(token, variant.variant_id, {
          color: color.trim(),
          size: size.trim(),
          stock_quantity: numStock,
          price: price ? Number(price) : undefined,
        });
      }
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save variant.";
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h2 className="text-base font-bold text-gray-900">
            {mode === "create" ? "Add Product Variant" : `Edit Variant #${variant?.variant_id}`}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {mode === "create" && (
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Target Product *</label>
              <select
                value={selectedProdId}
                onChange={(e) => setSelectedProdId(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none"
              >
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    #{p.product_id} - {p.product_name} ({p.brand_name})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Color *</label>
              <input
                type="text"
                required
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. Navy Blue"
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Size *</label>
              <input
                type="text"
                required
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. M, L, XL, 32"
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
              />
              <div className="flex flex-wrap items-center gap-1 pt-1.5">
                {["XS", "S", "M", "L", "XL", "XXL", "28", "30", "32", "34"].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSize(sz)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                      size === sz ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Stock Quantity *</label>
              <input
                type="number"
                min="0"
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Variant Price (₹, optional)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Defaults to base"
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? "Saving..." : mode === "create" ? "Add Variant" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: CATEGORY FORM
// ==============================================================================

function CategoryFormModal({
  mode,
  category,
  categories,
  onClose,
  onSaved,
  onError,
  token,
}: {
  mode: "create" | "edit";
  category?: AdminCategoryItem;
  categories: AdminCategoryItem[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
  token: string;
}) {
  const [name, setName] = useState(category?.category_name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [parentId, setParentId] = useState<string>(
    category?.parent_category_id ? String(category.parent_category_id) : ""
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return onError("Category name is required.");

    setSubmitting(true);
    try {
      if (mode === "create") {
        await createAdminCategoryApi(token, {
          category_name: name.trim(),
          description: description.trim(),
          parent_category_id: parentId ? Number(parentId) : null,
        });
      } else if (category) {
        await updateAdminCategoryApi(token, category.category_id, {
          category_name: name.trim(),
          description: description.trim(),
          parent_category_id: parentId ? Number(parentId) : null,
        });
      }
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save category.";
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h2 className="text-base font-bold text-gray-900">
            {mode === "create" ? "Add New Category" : `Edit Category #${category?.category_id}`}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Category Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Loungewear"
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Parent Category</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none"
            >
              <option value="">None (Top-level Category)</option>
              {categories
                .filter((c) => !category || c.category_id !== category.category_id)
                .map((c) => (
                  <option key={c.category_id} value={c.category_id}>
                    {c.category_name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Category details..."
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? "Saving..." : mode === "create" ? "Add Category" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: BRAND FORM
// ==============================================================================

function BrandFormModal({
  mode,
  brand,
  onClose,
  onSaved,
  onError,
  token,
}: {
  mode: "create" | "edit";
  brand?: AdminBrandItem;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
  token: string;
}) {
  const [name, setName] = useState(brand?.brand_name || "");
  const [website, setWebsite] = useState(brand?.website || "");
  const [country, setCountry] = useState(brand?.country || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return onError("Brand name is required.");

    setSubmitting(true);
    try {
      if (mode === "create") {
        await createAdminBrandApi(token, {
          brand_name: name.trim(),
          website: website.trim(),
          country: country.trim(),
        });
      } else if (brand) {
        await updateAdminBrandApi(token, brand.brand_id, {
          brand_name: name.trim(),
          website: website.trim(),
          country: country.trim(),
        });
      }
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save brand.";
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h2 className="text-base font-bold text-gray-900">
            {mode === "create" ? "Add New Brand" : `Edit Brand #${brand?.brand_id}`}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Brand Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Uniqlo"
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Official Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.brand.com"
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Country of Origin</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Japan"
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? "Saving..." : mode === "create" ? "Add Brand" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==============================================================================
// HELPERS
// ==============================================================================

function OrderStatusBadge({ status }: { status: string }) {
  let badgeColor = "bg-gray-100 text-gray-700";
  if (status === "PENDING") badgeColor = "bg-yellow-100 text-yellow-800";
  else if (status === "PROCESSING") badgeColor = "bg-blue-100 text-blue-800";
  else if (status === "SHIPPED") badgeColor = "bg-purple-100 text-purple-800";
  else if (status === "DELIVERED") badgeColor = "bg-green-100 text-green-800";
  else if (status === "CANCELLED") badgeColor = "bg-red-100 text-red-800";

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}
    >
      {status}
    </span>
  );
}
