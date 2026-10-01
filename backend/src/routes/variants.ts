import { Router } from "express";
import db from "../db.js";
import {
  validateVariantUpdate, hasErrors, sendError, findTakenSkus,
  isUniqueViolation, DUPLICATE_SKU_STATUS,
} from "../validation.js";

const router = Router();

/**
 * GET /api/variants/:id
 * Get a single variant.
 */
router.get("/:id", (req, res) => {
  try {
    const variant = db
      .prepare("SELECT * FROM variants WHERE id = ?")
      .get(Number(req.params.id));

    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    res.json(variant);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/variants/:id
 * Update a variant's price and/or inventory.
 *
 * Expected body (all fields optional):
 * {
 *   "name": "Updated Name",
 *   "sku": "NEW-SKU",
 *   "price_cents": 1999,
 *   "inventory_count": 50
 * }
 */
router.put("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = Number.isInteger(id)
      ? (db.prepare("SELECT * FROM variants WHERE id = ?").get(id) as
          | Record<string, unknown>
          | undefined)
      : undefined;
    if (!existing) return res.status(404).json({ error: "Variant not found" });

    const { errors, data } = validateVariantUpdate(req.body);
    if (hasErrors(errors)) return sendError(res, errors, 400);

    if (data.sku !== undefined && data.sku !== existing.sku) {
      if (findTakenSkus([data.sku], id).length > 0)
        return sendError(res, { sku: `SKU already exists: ${data.sku}` }, DUPLICATE_SKU_STATUS);
    }

    // ?? (not ||) so that 0 is kept as a real value
    db.prepare(
      `UPDATE variants
       SET sku = COALESCE(?, sku),
           name = COALESCE(?, name),
           price_cents = COALESCE(?, price_cents),
           inventory_count = COALESCE(?, inventory_count),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(data.sku ?? null, data.name ?? null, data.price_cents ?? null, data.inventory_count ?? null, id);

    res.json(db.prepare("SELECT * FROM variants WHERE id = ?").get(id));
  } catch (err: unknown) {
    if (isUniqueViolation(err))
      return sendError(res, { sku: "SKU already exists" }, DUPLICATE_SKU_STATUS);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/variants/:id
 * Delete a variant permanently.
 */
router.delete("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    const variant = db
      .prepare("SELECT * FROM variants WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    // Prevent deleting the last variant of a product
    const siblingCount = db
      .prepare(
        "SELECT COUNT(*) AS count FROM variants WHERE product_id = ?"
      )
      .get(variant.product_id as number) as { count: number };

    if (siblingCount.count <= 1) {
      return res
        .status(400)
        .json({ error: "Cannot delete the last variant of a product" });
    }

    db.prepare("DELETE FROM variants WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
