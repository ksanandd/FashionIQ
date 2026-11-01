
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
};

export type ApiCategory = {
  category_id: number;
  category_name: string;
  parent_category_id: number | null;
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
  category: string;
  price: number;
  image: string;
  badge?: string;
  description: string;
  colors: string[];
  sizes: string[];
};

type ProductsResponse = {
  success: boolean;
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

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

async function mapProduct(product: ApiProduct): Promise<Product> {
  const [brandData, categoryData] = await Promise.all([
    fetchApi<BrandsResponse>("/api/brands"),
    fetchApi<CategoriesResponse>("/api/categories"),
  ]);

  const brand = brandData.brands.find(
    (item) => item.brand_id === product.brand_id
  );

  const category = categoryData.categories.find(
    (item) => item.category_id === product.category_id
  );

  return {
    id: String(product.product_id),
    name: product.product_name,
    brand: brand?.brand_name ?? "Unknown Brand",
    category: category?.category_name ?? "Other",
    price: Number(product.price),
    image: product.image_url,
    description: product.description,
    colors: [],
    sizes: [],
  };
}

export async function getProducts(): Promise<Product[]> {
  const [productData, brandData, categoryData] = await Promise.all([
    fetchApi<ProductsResponse>("/api/products"),
    fetchApi<BrandsResponse>("/api/brands"),
    fetchApi<CategoriesResponse>("/api/categories"),
  ]);

  const brands = new Map(
    brandData.brands.map((brand) => [
      brand.brand_id,
      brand.brand_name,
    ])
  );

  const categories = new Map(
    categoryData.categories.map((category) => [
      category.category_id,
      category.category_name,
    ])
  );

  return productData.products.map((product) => ({
    id: String(product.product_id),
    name: product.product_name,
    brand: brands.get(product.brand_id) ?? "Unknown Brand",
    category: categories.get(product.category_id) ?? "Other",
    price: Number(product.price),
    image: product.image_url,
    description: product.description,
    colors: [],
    sizes: [],
  }));
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
