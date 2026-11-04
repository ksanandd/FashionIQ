const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export type ApiProduct = {
  product_id: number;
  category_id: number;
  brand_id: number;
  product_name: string;
  description: string;
  price: string | number;
  gender: string;
  image_url: string;
};

export type ApiBrand = {
  brand_id: number;
  brand_name: string;
  website?: string;
  country?: string;
};

export type ApiCategory = {
  category_id: number;
  category_name: string;
  parent_category_id: number | null;
  description?: string;
};

export type ApiVariant = {
  variant_id: number;
  product_id: number;
  color: string;
  size: string;
  stock_quantity: number;
  price: string | number;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  brandId?: number;
  category: string;
  categoryId?: number;
  price: number;
  gender?: string;
  image: string;
  badge?: string;
  description: string;
  colors: string[];
  sizes: string[];
};

export type ProductFilterParams = {
  category_id?: number | string;
  brand_id?: number | string;
  gender?: string;
  search?: string;
  min_price?: number | string;
  max_price?: number | string;
  sort?: "price_asc" | "price_desc" | "name_asc" | "name_desc" | "default";
  page?: number | string;
  limit?: number | string;
};

export type PaginationInfo = {
  currentPage: number;
  limit: number;
  totalProducts: number;
  totalPages: number;
};

export type PaginatedProductsResult = {
  products: Product[];
  pagination: PaginationInfo;
  count: number;
};

type ProductsResponse = {
  success: boolean;
  count: number;
  pagination?: PaginationInfo;
  products: ApiProduct[];
};

type ProductResponse = {
  success: boolean;
  product: ApiProduct;
};

type BrandsResponse = {
  success: boolean;
  brands: ApiBrand[];
};

type CategoriesResponse = {
  success: boolean;
  categories: ApiCategory[];
};

type VariantsResponse = {
  success: boolean;
  count: number;
  variants: ApiVariant[];
};

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `API request failed: ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      // keep fallback message
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

function buildQueryString(params?: ProductFilterParams): string {
  if (!params) return "";
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, String(value));
    }
  });

  const str = query.toString();
  return str ? `?${str}` : "";
}

export async function getBrands(): Promise<ApiBrand[]> {
  const data = await fetchApi<BrandsResponse>("/api/brands");
  return data.brands;
}

export async function getCategories(): Promise<ApiCategory[]> {
  const data = await fetchApi<CategoriesResponse>("/api/categories");
  return data.categories;
}

async function mapProduct(
  product: ApiProduct,
  brandMap?: Map<number, string>,
  categoryMap?: Map<number, string>
): Promise<Product> {
  let brandName = brandMap?.get(product.brand_id);
  let categoryName = categoryMap?.get(product.category_id);

  if (!brandName || !categoryName) {
    const [brands, categories] = await Promise.all([
      getBrands(),
      getCategories(),
    ]);
    const bMap = new Map(brands.map((b) => [b.brand_id, b.brand_name]));
    const cMap = new Map(categories.map((c) => [c.category_id, c.category_name]));
    brandName = bMap.get(product.brand_id) ?? "Unknown Brand";
    categoryName = cMap.get(product.category_id) ?? "Other";
  }

  return {
    id: String(product.product_id),
    name: product.product_name,
    brand: brandName ?? "Unknown Brand",
    brandId: product.brand_id,
    category: categoryName ?? "Other",
    categoryId: product.category_id,
    price: Number(product.price),
    gender: product.gender,
    image: product.image_url,
    description: product.description,
    colors: [],
    sizes: [],
  };
}

export async function getProducts(
  params?: ProductFilterParams
): Promise<Product[]> {
  const qs = buildQueryString(params);
  const [productData, brands, categories] = await Promise.all([
    fetchApi<ProductsResponse>(`/api/products${qs}`),
    getBrands(),
    getCategories(),
  ]);

  const brandMap = new Map(brands.map((b) => [b.brand_id, b.brand_name]));
  const categoryMap = new Map(categories.map((c) => [c.category_id, c.category_name]));

  return productData.products.map((product) => ({
    id: String(product.product_id),
    name: product.product_name,
    brand: brandMap.get(product.brand_id) ?? "Unknown Brand",
    brandId: product.brand_id,
    category: categoryMap.get(product.category_id) ?? "Other",
    categoryId: product.category_id,
    price: Number(product.price),
    gender: product.gender,
    image: product.image_url,
    description: product.description,
    colors: [],
    sizes: [],
  }));
}

export async function getProductsWithPagination(
  params?: ProductFilterParams
): Promise<PaginatedProductsResult> {
  const qs = buildQueryString(params);
  const [productData, brands, categories] = await Promise.all([
    fetchApi<ProductsResponse>(`/api/products${qs}`),
    getBrands(),
    getCategories(),
  ]);

  const brandMap = new Map(brands.map((b) => [b.brand_id, b.brand_name]));
  const categoryMap = new Map(categories.map((c) => [c.category_id, c.category_name]));

  const products: Product[] = productData.products.map((product) => ({
    id: String(product.product_id),
    name: product.product_name,
    brand: brandMap.get(product.brand_id) ?? "Unknown Brand",
    brandId: product.brand_id,
    category: categoryMap.get(product.category_id) ?? "Other",
    categoryId: product.category_id,
    price: Number(product.price),
    gender: product.gender,
    image: product.image_url,
    description: product.description,
    colors: [],
    sizes: [],
  }));

  return {
    products,
    pagination: productData.pagination || {
      currentPage: 1,
      limit: products.length,
      totalProducts: products.length,
      totalPages: 1,
    },
    count: productData.count || products.length,
  };
}

export async function getProductById(id: string): Promise<Product> {
  const productData = await fetchApi<ProductResponse>(
    `/api/products/${encodeURIComponent(id)}`
  );

  return mapProduct(productData.product);
}

export async function getProductVariants(
  id: string
): Promise<ApiVariant[]> {
  const variantData = await fetchApi<VariantsResponse>(
    `/api/products/${encodeURIComponent(id)}/variants`
  );

  return variantData.variants;
}

export async function getWishlistProducts(ids: string[]): Promise<Product[]> {
  if (!ids || ids.length === 0) return [];
  const results = await Promise.allSettled(
    ids.map((id) => getProductById(id))
  );

  return results
    .filter((res): res is PromiseFulfilledResult<Product> => res.status === "fulfilled")
    .map((res) => res.value);
}

export type AuthUser = {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: "USER" | "ADMIN";
};

export type LoginResponse = {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
};

export type RegisterResponse = {
  success: boolean;
  message: string;
  user: AuthUser;
};

export type MeResponse = {
  success: boolean;
  message: string;
  user: {
    user_id: number;
    email: string;
    role: "USER" | "ADMIN";
  };
};

export type UserProfileResponse = {
  success: boolean;
  message: string;
  profile: {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    role: "USER" | "ADMIN";
    street: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    profile_id: number | null;
    height: number | null;
    weight: number | null;
    body_type: string | null;
    style_preferences: string | null;
    budget_range_min: number | null;
    budget_range_max: number | null;
    preferred_brands: string | null;
  };
};

export async function loginUserApi(credentials: {
  email: string;
  password: string;
}): Promise<LoginResponse> {
  return fetchApi<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function registerUserApi(data: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}): Promise<RegisterResponse> {
  return fetchApi<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMeApi(token: string): Promise<MeResponse> {
  return fetchApi<MeResponse>("/api/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export type ForgotPasswordResponse = {
  success: boolean;
  message: string;
  dev_reset_url?: string;
};

export type VerifyResetTokenResponse = {
  success: boolean;
  valid: boolean;
  reason?: "invalid" | "expired" | "used";
  message: string;
};

export type ResetPasswordResponse = {
  success: boolean;
  message: string;
  reason?: string;
};

export async function forgotPasswordApi(email: string): Promise<ForgotPasswordResponse> {
  return fetchApi<ForgotPasswordResponse>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyResetTokenApi(token: string): Promise<VerifyResetTokenResponse> {
  const query = new URLSearchParams({ token }).toString();
  return fetchApi<VerifyResetTokenResponse>(`/api/auth/verify-reset-token?${query}`, {
    method: "GET",
  });
}

export async function resetPasswordApi(payload: {
  token: string;
  password: string;
  confirmPassword?: string;
}): Promise<ResetPasswordResponse> {
  return fetchApi<ResetPasswordResponse>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getUserProfileApi(token: string): Promise<UserProfileResponse> {
  return fetchApi<UserProfileResponse>("/api/users/profile", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export type FashionProfilePayload = {
  height?: number | null;
  weight?: number | null;
  body_type?: string | null;
  style_preferences?: string | null;
  budget_range_min?: number | null;
  budget_range_max?: number | null;
  preferred_brands?: string | null;
};

export type UserAddressPayload = {
  street: string;
  city: string;
  state: string;
  pincode: string;
};

export async function updateFashionProfileApi(
  token: string,
  data: FashionProfilePayload
): Promise<{ success: boolean; message: string }> {
  return fetchApi<{ success: boolean; message: string }>("/api/users/profile", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function updateUserAddressApi(
  token: string,
  data: UserAddressPayload
): Promise<{ success: boolean; message: string }> {
  return fetchApi<{ success: boolean; message: string }>("/api/users/address", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export type OrderItem = {
  order_item_id: number;
  order_id: number;
  product_id: number;
  variant_id: number;
  quantity: number;
  price_at_purchase: number | string;
  subtotal: number | string;
  product_name: string;
  image_url: string;
  brand_name?: string;
  color?: string;
  size?: string;
  description?: string;
};

export type Order = {
  order_id: number;
  user_id: number;
  total_amount: number | string;
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  payment_method: string;
  payment_status: "PAID" | "PENDING" | "FAILED";
  shipping_street: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
};

export type CreateOrderPayload = {
  items: Array<{
    product_id?: number;
    variant_id: number;
    quantity: number;
  }>;
  payment_method?: "COD" | "SIMULATED_CARD" | string;
  shipping_address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
};

export async function createOrderApi(
  token: string,
  payload: CreateOrderPayload
): Promise<{ success: boolean; message: string; order_id: number; total_amount: number }> {
  return fetchApi<{ success: boolean; message: string; order_id: number; total_amount: number }>(
    "/api/orders",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );
}
export async function getUserOrdersApi(
  token: string
): Promise<{ success: boolean; count: number; orders: Order[] }> {
  return fetchApi<{ success: boolean; count: number; orders: Order[] }>(
    "/api/orders",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}export async function getOrderByIdApi(
  token: string,
  orderId: number | string
): Promise<{ success: boolean; order: Order }> {
  return fetchApi<{ success: boolean; order: Order }>(
    `/api/orders/${orderId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}
export type Wardrobe = {
  wardrobe_id: number;
  wardrobe_name: string;
  created_at: string;
  item_count: number;
};

export type WardrobeItem = {
  wardrobe_item_id: number;
  wardrobe_id: number;
  variant_id: number;
  product_id: number;
  product_name: string;
  description?: string;
  image_url: string;
  brand_id?: number;
  brand_name?: string;
  category_id?: number;
  category_name?: string;
  color: string;
  size: string;
  price: number | string;
  stock_quantity?: number;
  quantity: number;
  season: "Summer" | "Winter" | "Monsoon" | "All Season";
  source_type: "PURCHASED" | "SAVED";
  date_added: string;
};

export type AddWardrobeItemPayload = {
  wardrobe_id?: number;
  variant_id: number;
  quantity?: number;
  season?: "Summer" | "Winter" | "Monsoon" | "All Season";
  source_type?: "PURCHASED" | "SAVED";
};

export type WardrobeFilterParams = {
  category_id?: number | string;
  season?: string;
  source_type?: string;
};

export async function getUserWardrobesApi(
  token: string
): Promise<{ success: boolean; count: number; wardrobes: Wardrobe[] }> {
  return fetchApi<{ success: boolean; count: number; wardrobes: Wardrobe[] }>(
    "/api/wardrobes",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}
export async function createWardrobeApi(
  token: string,
  wardrobeName: string
): Promise<{ success: boolean; message: string; wardrobe: Wardrobe }> {
  return fetchApi<{ success: boolean; message: string; wardrobe: Wardrobe }>(
    "/api/wardrobes",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ wardrobe_name: wardrobeName }),
    }
  );
}

export async function getWardrobeItemsApi(
  token: string,
  wardrobeId: number,
  filters?: WardrobeFilterParams
): Promise<{
  success: boolean;
  wardrobe: { wardrobe_id: number; wardrobe_name: string };
  count: number;
  items: WardrobeItem[];
}> {
  const query = new URLSearchParams();
  if (filters?.category_id) query.set("category_id", String(filters.category_id));
  if (filters?.season && filters.season !== "ALL") query.set("season", filters.season);
  if (filters?.source_type && filters.source_type !== "ALL") query.set("source_type", filters.source_type);

  const qs = query.toString();
  const endpoint = `/api/wardrobes/${wardrobeId}/items${qs ? `?${qs}` : ""}`;

  return fetchApi<{
    success: boolean;
    wardrobe: { wardrobe_id: number; wardrobe_name: string };
    count: number;
    items: WardrobeItem[];
  }>(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function addWardrobeItemApi(
  token: string,
  payload: AddWardrobeItemPayload
): Promise<{ success: boolean; message: string; wardrobe_item_id: number }> {
  return fetchApi<{ success: boolean; message: string; wardrobe_item_id: number }>(
    "/api/wardrobes/items",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );
}

export async function removeWardrobeItemApi(
  token: string,
  wardrobeItemId: number
): Promise<{ success: boolean; message: string }> {
  return fetchApi<{ success: boolean; message: string }>(
    `/api/wardrobes/items/${wardrobeItemId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}
export async function addOrderItemsToWardrobeApi(
  token: string,
  orderId: number,
  wardrobeId?: number
): Promise<{ success: boolean; message: string; added_count: number }> {
  return fetchApi<{ success: boolean; message: string; added_count: number }>(
    `/api/wardrobes/items/from-order/${orderId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(wardrobeId ? { wardrobe_id: wardrobeId } : {}),
    }
  );
}

export type RecommendationProduct = {
  product_id: number;
  product_name: string;
  description: string;
  price: number | string;
  gender: string;
  image_url: string;
  category_id?: number;
  category_name?: string;
  brand_id?: number;
  brand_name?: string;
  similarity_score?: number;
  recommendation_score?: number;
  reason?: string;
};

export type RecommendationsResponse = {
  success: boolean;
  source?: "ai" | "fallback" | "popular_fallback";
  type?: string;
  count: number;
  recommendations: RecommendationProduct[];
};

export async function getSimilarProductsApi(
  productId: number | string,
  limit: number = 8
): Promise<RecommendationProduct[]> {
  try {
    const data = await fetchApi<RecommendationsResponse>(
      `/api/recommendations/similar/${productId}?limit=${limit}`
    );
    return data.recommendations || [];
  } catch (error) {
    console.warn("Failed to fetch similar products:", error);
    return [];
  }
}

export async function getUserRecommendationsApi(
  token?: string | null,
  limit: number = 10
): Promise<RecommendationProduct[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const data = await fetchApi<RecommendationsResponse>(
      `/api/recommendations/user?limit=${limit}`,
      { headers }
    );
    return data.recommendations || [];
  } catch (error) {
    console.warn("Failed to fetch user recommendations:", error);
    return [];
  }
}

export async function getWardrobeRecommendationsApi(
  token: string,
  limit: number = 8
): Promise<RecommendationProduct[]> {
  try {
    const data = await fetchApi<RecommendationsResponse>(
      `/api/recommendations/wardrobe?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return data.recommendations || [];
  } catch (error) {
    console.warn("Failed to fetch wardrobe recommendations:", error);
    return [];
  }
}

export async function triggerReindexApi(
  token: string
): Promise<{ success: boolean; message: string; indexed_count?: number }> {
  return fetchApi<{ success: boolean; message: string; indexed_count?: number }>(
    "/api/recommendations/index",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}

// ==============================================================================
// Phase 7: Outfit Recommendation Engine Types & API Clients
// ==============================================================================

export type OutfitItem = {
  sequence?: number;
  role: "Top" | "Bottom" | "Outerwear" | "Shoes" | "Accessory" | "Other" | string;
  product_id: number;
  product_name: string;
  brand_name: string;
  category_name: string;
  gender?: string;
  variant_id: number;
  color: string;
  size: string;
  image_url?: string | null;
  price: number;
  is_owned: boolean;
};

export type Outfit = {
  outfit_id?: number | string;
  outfit_name: string;
  occasion: string;
  season: string;
  match_score?: number;
  color_score?: number;
  color_rationale?: string;
  description?: string;
  total_retail_price: number;
  purchase_price: number;
  owned_savings: number;
  owned_items_count: number;
  items_count: number;
  items: OutfitItem[];
  outfit_type?: string;
  outside_budget?: boolean;
  budget_note?: string;
  created_at?: string;
};

export type OutfitsResponse = {
  success: boolean;
  source?: "ai" | "fallback";
  count: number;
  outfits: Outfit[];
};

export type OutfitFilterParams = {
  occasion?: string;
  season?: string;
  budget_max?: number;
  limit?: number;
};

export async function getPersonalizedOutfitsApi(
  token: string,
  params?: OutfitFilterParams
): Promise<Outfit[]> {
  try {
    const query = new URLSearchParams();
    if (params?.occasion && params.occasion !== "All") query.set("occasion", params.occasion);
    if (params?.season && params.season !== "All") query.set("season", params.season);
    if (params?.budget_max) query.set("budget_max", params.budget_max.toString());
    if (params?.limit) query.set("limit", params.limit.toString());

    const qs = query.toString() ? `?${query.toString()}` : "";
    const data = await fetchApi<OutfitsResponse>(`/api/outfits/recommendations${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.outfits || [];
  } catch (error) {
    console.warn("Failed to fetch personalized outfits:", error);
    return [];
  }
}

export async function getWardrobeOutfitsApi(
  token: string,
  params?: OutfitFilterParams
): Promise<Outfit[]> {
  try {
    const query = new URLSearchParams();
    if (params?.occasion && params.occasion !== "All") query.set("occasion", params.occasion);
    if (params?.season && params.season !== "All") query.set("season", params.season);
    if (params?.budget_max) query.set("budget_max", params.budget_max.toString());
    if (params?.limit) query.set("limit", params.limit.toString());

    const qs = query.toString() ? `?${query.toString()}` : "";
    const data = await fetchApi<OutfitsResponse>(`/api/outfits/from-wardrobe${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.outfits || [];
  } catch (error) {
    console.warn("Failed to fetch wardrobe outfits:", error);
    return [];
  }
}

export async function getProductOutfitsApi(
  productId: number | string,
  limit: number = 4
): Promise<Outfit[]> {
  try {
    const data = await fetchApi<OutfitsResponse>(`/api/outfits/product/${productId}?limit=${limit}`);
    return data.outfits || [];
  } catch (error) {
    console.warn("Failed to fetch product outfits:", error);
    return [];
  }
}

export async function saveOutfitApi(
  token: string,
  payload: {
    outfit_name: string;
    occasion?: string;
    season?: string;
    total_price: number;
    description?: string;
    items: Array<{
      variant_id: number;
      role: string;
      price: number;
      is_owned: boolean;
    }>;
  }
): Promise<{ success: boolean; outfit_id?: number; message?: string }> {
  return fetchApi<{ success: boolean; outfit_id?: number; message?: string }>(
    "/api/outfits/save",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );
}

export async function getSavedOutfitsApi(token: string): Promise<Outfit[]> {
  try {
    const data = await fetchApi<{ success: boolean; outfits: Outfit[] }>(
      "/api/outfits/saved",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return data.outfits || [];
  } catch (error) {
    console.warn("Failed to fetch saved outfits:", error);
    return [];
  }
}

export async function deleteSavedOutfitApi(
  token: string,
  outfitId: number
): Promise<{ success: boolean; message: string }> {
  return fetchApi<{ success: boolean; message: string }>(
    `/api/outfits/saved/${outfitId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// ==============================================================================
// Admin Portal Interfaces & Client APIs (Phase 8)
// ==============================================================================

export interface AdminDashboardStats {
  success: boolean;
  users: {
    total: number;
    admins: number;
    customers: number;
  };
  products: {
    total: number;
    low_stock: number;
    out_of_stock_variants: number;
  };
  categories: {
    total: number;
  };
  brands: {
    total: number;
  };
  orders: {
    total: number;
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  };
  revenue: {
    recognized_revenue: number;
    total_paid_orders: number;
    pending_revenue: number;
    total_pending_orders: number;
    simulated_card_revenue: number;
    cod_pending_revenue: number;
    cod_paid_revenue: number;
    total_order_value: number;
    note: string;
    accounting_policy?: string;
  };
  recent_activity: {
    orders: Array<{
      order_id: number;
      customer_name: string;
      customer_email: string;
      total_amount: number;
      status: string;
      payment_method: string;
      payment_status: string;
      created_at: string;
    }>;
    registrations: Array<{
      user_id: number;
      first_name: string;
      last_name: string;
      email: string;
      role: string;
      created_at: string;
    }>;
  };
  accounting_policy: string;
}

export interface AdminAnalyticsData {
  success: boolean;
  analytics: {
    monthly_trends: Array<{
      month: string;
      total_orders: number;
      paid_revenue: number;
      total_order_value: number;
    }>;
    order_status_distribution: Array<{
      status: string;
      count: number;
    }>;
    payment_distribution: Array<{
      payment_method: string;
      payment_status: string;
      order_count: number;
      total_amount: number;
    }>;
    top_products: Array<{
      product_id: number;
      product_name: string;
      price: number;
      brand_name: string;
      category_name: string;
      total_units_sold: number;
      total_sold?: number;
      total_revenue: number;
    }>;
    category_distribution: Array<{
      category_id: number;
      category_name: string;
      product_count: number;
      units_sold: number;
      items_sold?: number;
      revenue: number;
    }>;
    stock_overview: Array<{
      stock_level: string;
      variant_count: number;
      total_stock?: number;
    }>;
  };
}

export interface AdminProductItem {
  product_id: number;
  product_name: string;
  description: string;
  price: number;
  gender: string;
  image_url: string;
  category_id: number;
  category_name: string;
  brand_id: number;
  brand_name: string;
  created_at: string;
  variant_count: number;
  total_stock: number;
}

export interface AdminVariantItem {
  variant_id: number;
  product_id: number;
  product_name: string;
  color: string;
  size: string;
  stock_quantity: number;
  price: number;
  brand_name: string;
  category_name: string;
}

export interface AdminCategoryItem {
  category_id: number;
  category_name: string;
  parent_category_id: number | null;
  description: string;
  product_count: number;
}

export interface AdminBrandItem {
  brand_id: number;
  brand_name: string;
  website: string | null;
  country: string | null;
  product_count: number;
}

export interface AdminOrderItem {
  order_id: number;
  user_id: number;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  status: string;
  payment_method: string;
  payment_status: string;
  created_at: string;
  item_count: number;
}

export interface AdminOrderDetail extends AdminOrderItem {
  shipping_address: string;
  items: Array<{
    order_item_id: number;
    product_id: number;
    variant_id: number;
    product_name: string;
    image_url: string;
    color: string;
    size: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
}

export interface AdminUserItem {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: "USER" | "ADMIN";
  phone_number: string | null;
  created_at: string;
  order_count: number;
  lifetime_spend: number;
}

export interface AdminUserDetail extends AdminUserItem {
  profile: {
    height?: number;
    weight?: number;
    body_shape?: string;
    preferred_fit?: string;
    skin_tone?: string;
    preferred_colors?: string[];
    preferred_styles?: string[];
    max_budget?: number;
    gender_preference?: string;
  } | null;
  orders: Array<{
    order_id: number;
    total_amount: number;
    status: string;
    payment_method: string;
    payment_status: string;
    created_at: string;
  }>;
}

// --- Admin Client API Functions ---

export async function getAdminDashboardStatsApi(token: string): Promise<AdminDashboardStats> {
  return fetchApi<AdminDashboardStats>("/api/admin/dashboard", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminAnalyticsApi(token: string): Promise<AdminAnalyticsData> {
  return fetchApi<AdminAnalyticsData>("/api/admin/analytics", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminProductsApi(
  token: string,
  params?: { search?: string; category_id?: number | string; brand_id?: number | string; page?: number; limit?: number }
): Promise<{ success: boolean; count: number; pagination: { total: number; page: number; limit: number; totalPages: number }; products: AdminProductItem[] }> {
  const query = new URLSearchParams();
  if (params?.search) query.append("search", params.search);
  if (params?.category_id) query.append("category_id", String(params.category_id));
  if (params?.brand_id) query.append("brand_id", String(params.brand_id));
  if (params?.page) query.append("page", String(params.page));
  if (params?.limit) query.append("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return fetchApi(`/api/admin/products${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminProductByIdApi(
  token: string,
  id: number
): Promise<{ success: boolean; product: AdminProductItem & { variants: AdminVariantItem[] } }> {
  return fetchApi(`/api/admin/products/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createAdminProductApi(
  token: string,
  data: {
    product_name: string;
    category_id: number;
    brand_id: number;
    price: number;
    gender?: string;
    description?: string;
    image_url?: string;
    variants?: Array<{
      color: string;
      size: string;
      stock_quantity: number;
      price?: number;
    }>;
  }
): Promise<{ success: boolean; message: string; product_id: number; variants_count?: number }> {
  return fetchApi("/api/admin/products", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateAdminProductApi(
  token: string,
  id: number,
  data: Partial<{
    product_name: string;
    category_id: number;
    brand_id: number;
    price: number;
    gender: string;
    description: string;
    image_url: string;
  }>
): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/api/admin/products/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteAdminProductApi(
  token: string,
  id: number
): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/api/admin/products/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminVariantsApi(
  token: string,
  params?: { product_id?: number | string; low_stock?: boolean; out_of_stock?: boolean }
): Promise<{ success: boolean; count: number; variants: AdminVariantItem[] }> {
  const query = new URLSearchParams();
  if (params?.product_id) query.append("product_id", String(params.product_id));
  if (params?.low_stock) query.append("low_stock", "true");
  if (params?.out_of_stock) query.append("out_of_stock", "true");
  const qs = query.toString() ? `?${query.toString()}` : "";
  return fetchApi(`/api/admin/variants${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createAdminVariantApi(
  token: string,
  data: {
    product_id: number;
    color: string;
    size: string;
    stock_quantity: number;
    price?: number;
  }
): Promise<{ success: boolean; message: string; variant_id: number }> {
  return fetchApi("/api/admin/variants", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateAdminVariantApi(
  token: string,
  id: number,
  data: Partial<{
    color: string;
    size: string;
    stock_quantity: number;
    price: number;
  }>
): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/api/admin/variants/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteAdminVariantApi(
  token: string,
  id: number
): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/api/admin/variants/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminCategoriesApi(
  token: string
): Promise<{ success: boolean; count: number; categories: AdminCategoryItem[] }> {
  return fetchApi("/api/admin/categories", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createAdminCategoryApi(
  token: string,
  data: { category_name: string; description?: string; parent_category_id?: number | null }
): Promise<{ success: boolean; message: string; category_id: number }> {
  return fetchApi("/api/admin/categories", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateAdminCategoryApi(
  token: string,
  id: number,
  data: { category_name: string; description?: string; parent_category_id?: number | null }
): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/api/admin/categories/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteAdminCategoryApi(
  token: string,
  id: number
): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/api/admin/categories/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminBrandsApi(
  token: string
): Promise<{ success: boolean; count: number; brands: AdminBrandItem[] }> {
  return fetchApi("/api/admin/brands", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createAdminBrandApi(
  token: string,
  data: { brand_name: string; website?: string; country?: string }
): Promise<{ success: boolean; message: string; brand_id: number }> {
  return fetchApi("/api/admin/brands", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateAdminBrandApi(
  token: string,
  id: number,
  data: { brand_name: string; website?: string; country?: string }
): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/api/admin/brands/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteAdminBrandApi(
  token: string,
  id: number
): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/api/admin/brands/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminOrdersApi(
  token: string,
  params?: { status?: string; search?: string; page?: number; limit?: number }
): Promise<{ success: boolean; count: number; pagination: { total: number; page: number; limit: number; totalPages: number }; orders: AdminOrderItem[] }> {
  const query = new URLSearchParams();
  if (params?.status) query.append("status", params.status);
  if (params?.search) query.append("search", params.search);
  if (params?.page) query.append("page", String(params.page));
  if (params?.limit) query.append("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return fetchApi(`/api/admin/orders${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminOrderByIdApi(
  token: string,
  id: number
): Promise<{ success: boolean; order: AdminOrderDetail }> {
  return fetchApi(`/api/admin/orders/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateAdminOrderStatusApi(
  token: string,
  id: number,
  data: { status?: string; payment_status?: string; confirm_cod_collection?: boolean }
): Promise<{ success: boolean; message: string; order: AdminOrderItem }> {
  return fetchApi(`/api/admin/orders/${id}/status`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function getAdminUsersApi(
  token: string,
  params?: { search?: string; role?: string; page?: number; limit?: number }
): Promise<{ success: boolean; count: number; pagination: { total: number; page: number; limit: number; totalPages: number }; users: AdminUserItem[] }> {
  const query = new URLSearchParams();
  if (params?.search) query.append("search", params.search);
  if (params?.role) query.append("role", params.role);
  if (params?.page) query.append("page", String(params.page));
  if (params?.limit) query.append("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return fetchApi(`/api/admin/users${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminUserByIdApi(
  token: string,
  id: number
): Promise<{ success: boolean; user: AdminUserDetail }> {
  return fetchApi(`/api/admin/users/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateAdminUserRoleApi(
  token: string,
  id: number,
  role: "USER" | "ADMIN"
): Promise<{ success: boolean; message: string; user: { user_id: number; email: string; role: "USER" | "ADMIN" } }> {
  return fetchApi(`/api/admin/users/${id}/role`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role }),
  });
}
