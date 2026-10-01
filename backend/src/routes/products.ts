import { Router } from "express";
import db from "../db.js";
import {
  validateNewProduct, hasErrors, sendError, findTakenSkus,
  isUniqueViolation, DUPLICATE_SKU_STATUS,
} from "../validation.js";

const router = Router();

/**
 * GET /api/products
 * List all products with category name, variant count, and price/inventory aggregates.
 * Supports optional query params: ?search=term&category_id=1
 */
router.get("/", (req, res) => {
  try {
    const { search, category_id } = req.query;

    let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.category_id,
        c.name AS category_name,
        p.status,
        p.deleted_at,
        p.created_at,
        p.updated_at,
        COUNT(v.id) AS variant_count,
        MIN(v.price_cents) AS min_price_cents,
        MAX(v.price_cents) AS max_price_cents,
        COALESCE(SUM(v.inventory_count), 0) AS total_inventory
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN variants v ON v.product_id = p.id
    `;

    const conditions: string[] = ["p.deleted_at IS NULL"]; // Exclude soft-deleted products from list
    const params: unknown[] = [];

    if (search) {
      conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category_id) {
      conditions.push("p.category_id = ?");
      params.push(Number(category_id));
    }

    // Condition deleted b/c deleted_at always present. So the join always runs:
    query += " WHERE " + conditions.join(" AND ");
    
    query += " GROUP BY p.id ORDER BY p.created_at DESC";

    const products = db.prepare(query).all(...params);
    res.json(products);
  } catch (err: unknown) {
    // Fixed, now returns json like all other errors
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/products/:id
 * Get a single product with its variants.
 */
router.get("/:id", (req, res) => {
  try {
    const product = db
      .prepare(
        `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`
      )
      .get(Number(req.params.id)) as Record<string, unknown> | undefined;

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const variants = db
      .prepare(
        `SELECT * FROM variants WHERE product_id = ? ORDER BY created_at ASC`
      )
      .all(Number(req.params.id));

    res.json({ ...product, variants });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/products
 * Create a new product with at least one variant.
 *
 * Expected body:
 * {
 *   "name": "Product Name",
 *   "description": "Optional description",
 *   "category_id": 1,
 *   "status": "active",
 *   "variants": [
 *     { "sku": "SKU-001", "name": "Default", "price_cents": 999, "inventory_count": 10 }
 *   ]
 * }
 */
router.post("/", (req, res) => {
  try {
    const { errors, data } = validateNewProduct(req.body);
    if (hasErrors(errors)) return sendError(res, errors, 400);

    if (data.category_id !== null) {
      const cat = db.prepare("SELECT id FROM categories WHERE id = ?").get(data.category_id);
      if (!cat) return sendError(res, { category_id: "Category does not exist" }, 400);
    }

    const taken = findTakenSkus(data.variants.map((v) => v.sku));
    if (taken.length > 0)
      return sendError(res, { sku: `SKU already exists: ${taken.join(", ")}` }, DUPLICATE_SKU_STATUS);

    const insertProduct = db.prepare(
      `INSERT INTO products (name, description, category_id, status) VALUES (?, ?, ?, ?)`
    );
    const insertVariant = db.prepare(
      `INSERT INTO variants (product_id, sku, name, price_cents, inventory_count) VALUES (?, ?, ?, ?, ?)`
    );

    // Product + variants succeed or fail together
    const create = db.transaction(() => {
      const info = insertProduct.run(data.name, data.description, data.category_id, data.status);
      const productId = Number(info.lastInsertRowid);
      for (const v of data.variants) {
        insertVariant.run(productId, v.sku, v.name, v.price_cents, v.inventory_count);
      }
      return productId;
    });
    const productId = create();

    const product = db
      .prepare(
        `SELECT p.*, c.name AS category_name
         FROM products p LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`
      )
      .get(productId) as Record<string, unknown>;
    const variants = db
      .prepare("SELECT * FROM variants WHERE product_id = ? ORDER BY created_at ASC, id ASC")
      .all(productId);

    res.status(201).json({ ...product, variants });
  } catch (err: unknown) {
    // Backstop: a race between the SKU check and the insert
    if (isUniqueViolation(err))
      return sendError(res, { sku: "SKU already exists" }, DUPLICATE_SKU_STATUS);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/products/:id
 * Update a product's basic information.
 */
router.put("/:id", (req, res) => {
  try {
    const { name, description, category_id, status } = req.body;
    const id = Number(req.params.id);

    const existing = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }

    db.prepare(
      `UPDATE products
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           category_id = COALESCE(?, category_id),
           status = COALESCE(?, status),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(name ?? null, description ?? null, category_id ?? null, status ?? null, id);

    const updated = db
      .prepare(
        `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`
      )
      .get(id);

    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/products/:id
 * Soft-delete a product (sets deleted_at timestamp).
 */
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);

  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  

  if (!product) {
    // Fixed, now returns json like all other errors
    return res.status(404).json({ error: "Product not found" });
  }

  if (product.deleted_at) {
    return res.status(404).json({ error: "Product already deleted" });
  }

  db.prepare(
    `UPDATE products SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(id);

  res.json({ success: true });
});

export default router;
