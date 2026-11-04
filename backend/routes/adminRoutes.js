const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Enforce authentication & ADMIN role authorization on ALL admin routes
router.use(authMiddleware);
router.use(roleMiddleware("ADMIN"));

// 1. Dashboard & Analytics
router.get("/dashboard", adminController.getDashboardStats);
router.get("/analytics", adminController.getAnalytics);

// 2. Product Management
router.get("/products", adminController.getProducts);
router.get("/products/:id", adminController.getProductById);
router.post("/products", adminController.createProduct);
router.put("/products/:id", adminController.updateProduct);
router.delete("/products/:id", adminController.deleteProduct);

// 3. Variant & Inventory Management
router.get("/variants", adminController.getVariants);
router.post("/variants", adminController.createVariant);
router.put("/variants/:id", adminController.updateVariant);
router.delete("/variants/:id", adminController.deleteVariant);

// 4. Category Management
router.get("/categories", adminController.getCategories);
router.post("/categories", adminController.createCategory);
router.put("/categories/:id", adminController.updateCategory);
router.delete("/categories/:id", adminController.deleteCategory);

// 5. Brand Management
router.get("/brands", adminController.getBrands);
router.post("/brands", adminController.createBrand);
router.put("/brands/:id", adminController.updateBrand);
router.delete("/brands/:id", adminController.deleteBrand);

// 6. Order Management
router.get("/orders", adminController.getOrders);
router.get("/orders/:id", adminController.getOrderById);
router.put("/orders/:id/status", adminController.updateOrderStatus);

// 7. User Management
router.get("/users", adminController.getUsers);
router.get("/users/:id", adminController.getUserById);
router.put("/users/:id/role", adminController.updateUserRole);

module.exports = router;
