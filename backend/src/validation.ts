import type { Response } from "express";
import db from "./db.js";

export type FieldErrors = Record<string, string>;

export interface VariantInput {
  sku: string;
  name: string;
  price_cents: number;
  inventory_count: number;
}

export interface ProductInput {
  name: string;
  description: string | null;
  category_id: number | null;
  status: string;
  variants: VariantInput[];
}

export const DUPLICATE_SKU_STATUS = 409;

const STATUSES = ["active", "draft", "archived"];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;
const isNonNegInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

export const hasErrors = (e: FieldErrors) => Object.keys(e).length > 0;

/** Sends { error: "<readable message>", fields: { field: message } } */
export function sendError(
  res: Response,
  errors: FieldErrors,
  status = 400
) {
  return res
    .status(status)
    .json({ error: Object.values(errors).join("; "), fields: errors });
}

/**
 * Validates variant fields. With partial=true (updates), only fields that are
 * present are checked. With partial=false (creation), sku is required.
 */
export function checkVariant(
  raw: unknown,
  prefix: string,
  errors: FieldErrors,
  partial: boolean
): Partial<VariantInput> {
  const out: Partial<VariantInput> = {};
  const key = (f: string) => (prefix ? `${prefix}.${f}` : f);

  if (!isRecord(raw)) {
    errors[prefix || "body"] = "must be an object";
    return out;
  }

  if (!partial || raw.sku !== undefined) {
    if (!isNonEmptyString(raw.sku)) errors[key("sku")] = "SKU is required";
    else out.sku = raw.sku.trim();
  }
  if (raw.name !== undefined) {
    if (!isNonEmptyString(raw.name))
      errors[key("name")] = "Variant name cannot be empty";
    else out.name = raw.name.trim();
  }
  if (raw.price_cents !== undefined) {
    if (!isNonNegInt(raw.price_cents))
      errors[key("price_cents")] =
        "Price must be a whole number of cents, 0 or greater";
    else out.price_cents = raw.price_cents;
  }
  if (raw.inventory_count !== undefined) {
    if (!isNonNegInt(raw.inventory_count))
      errors[key("inventory_count")] =
        "Inventory must be a whole number, 0 or greater";
    else out.inventory_count = raw.inventory_count;
  }
  return out;
}

export function validateNewProduct(body: unknown): {
  errors: FieldErrors;
  data: ProductInput;
} {
  const errors: FieldErrors = {};
  const b = isRecord(body) ? body : {};

  if (!isNonEmptyString(b.name)) errors.name = "Product name is required";

  if (b.description !== undefined && b.description !== null && typeof b.description !== "string")
    errors.description = "Description must be text";

  let category_id: number | null = null;
  if (b.category_id !== undefined && b.category_id !== null) {
    if (!Number.isInteger(b.category_id)) errors.category_id = "Invalid category";
    else category_id = b.category_id as number;
  }

  let status = "active";
  if (b.status !== undefined) {
    if (typeof b.status !== "string" || !STATUSES.includes(b.status))
      errors.status = `Status must be one of: ${STATUSES.join(", ")}`;
    else status = b.status;
  }

  const variants: VariantInput[] = [];
  if (!Array.isArray(b.variants) || b.variants.length === 0) {
    errors.variants = "At least one variant is required";
  } else {
    const seen = new Set<string>();
    b.variants.forEach((raw, i) => {
      const v = checkVariant(raw, `variants[${i}]`, errors, false);
      if (v.sku) {
        if (seen.has(v.sku))
          errors[`variants[${i}].sku`] = `Duplicate SKU in request: ${v.sku}`;
        seen.add(v.sku);
      }
      variants.push({
        sku: v.sku ?? "",
        name: v.name ?? "Default",
        price_cents: v.price_cents ?? 0,
        inventory_count: v.inventory_count ?? 0,
      });
    });
  }

  return {
    errors,
    data: {
      name: typeof b.name === "string" ? b.name.trim() : "",
      description: typeof b.description === "string" ? b.description : null,
      category_id,
      status,
      variants,
    },
  };
}

export function validateVariantUpdate(body: unknown): {
  errors: FieldErrors;
  data: Partial<VariantInput>;
} {
  const errors: FieldErrors = {};
  const data = checkVariant(body, "", errors, true);
  if (!hasErrors(errors) && Object.keys(data).length === 0)
    errors.body = "No fields to update";
  return { errors, data };
}

/** Returns which of the given SKUs already exist (optionally ignoring one variant). */
export function findTakenSkus(skus: string[], excludeVariantId?: number): string[] {
  if (skus.length === 0) return [];
  let sql = `SELECT sku FROM variants WHERE sku IN (${skus.map(() => "?").join(",")})`;
  const params: unknown[] = [...skus];
  if (excludeVariantId !== undefined) {
    sql += " AND id != ?";
    params.push(excludeVariantId);
  }
  return (db.prepare(sql).all(...params) as { sku: string }[]).map((r) => r.sku);
}

export const isUniqueViolation = (err: unknown) =>
  typeof err === "object" &&
  err !== null &&
  (err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE";