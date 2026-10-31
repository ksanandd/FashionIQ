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

export const products: Product[] = [
  {
    id: "linen-blazer",
    name: "Relaxed Linen Blazer",
    brand: "Mango",
    category: "Women",
    price: 5999,
    image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=85",
    badge: "Trending",
    description: "A relaxed linen blazer for effortless everyday sophistication.",
    colors: ["Beige", "Black"],
    sizes: ["XS", "S", "M", "L"],
  },
  {
    id: "cotton-shirt",
    name: "Classic Cotton Shirt",
    brand: "H&M",
    category: "Men",
    price: 2499,
    image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85",
    description: "A versatile cotton shirt that works for casual and smart looks.",
    colors: ["White", "Blue"],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    id: "wide-leg-jeans",
    name: "Wide-Leg Denim Jeans",
    brand: "Levi's",
    category: "Women",
    price: 3999,
    image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=85",
    badge: "Popular",
    description: "Comfortable wide-leg jeans with a timeless denim look.",
    colors: ["Blue", "Black"],
    sizes: ["XS", "S", "M", "L"],
  },
  {
    id: "crossbody-bag",
    name: "Minimal Crossbody Bag",
    brand: "Accessorize",
    category: "Accessories",
    price: 3299,
    image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85",
    description: "A compact crossbody bag for carrying everyday essentials.",
    colors: ["Brown", "Black"],
    sizes: ["One Size"],
  },
  {
    id: "knit-sweater",
    name: "Soft Knit Sweater",
    brand: "Zara",
    category: "Women",
    price: 2799,
    image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=85",
    badge: "New",
    description: "A soft knit sweater designed for comfortable layering.",
    colors: ["Cream", "Gray"],
    sizes: ["S", "M", "L"],
  },
  {
    id: "sneakers",
    name: "Everyday Sneakers",
    brand: "Nike",
    category: "Shoes",
    price: 6499,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85",
    description: "Clean, versatile sneakers for everyday outfits.",
    colors: ["White", "Black"],
    sizes: ["7", "8", "9", "10", "11"],
  },
];
