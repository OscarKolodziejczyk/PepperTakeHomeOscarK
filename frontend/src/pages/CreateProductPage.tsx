import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { createProduct, fetchCategories } from "@/lib/api";
import {
  parsePriceToCents,
  parseInventory,
  readApiError,
  PRICE_ERROR,
  INVENTORY_ERROR,
} from "@/lib/validation";
import type { Category } from "@/types";

interface VariantForm {
  key: number; // stable React key (index would break when removing rows)
  sku: string;
  name: string;
  price: string; // dollars, as typed
  inventory: string;
}

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{label}</span>
        {children}
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function CreateProductPage() {
  const navigate = useNavigate();
  const nextKey = useRef(2);

  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"active" | "draft">("active");
  const [variants, setVariants] = useState<VariantForm[]>([
    { key: 1, sku: "", name: "Default", price: "0.00", inventory: "0" },
  ]);

  // Keys match the server's: "name", "variants[0].sku", "variants[0].price_cents", ...
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories()
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategories)
      .catch(() => {}); // dropdown just stays empty; category is optional
  }, []);

  const updateVariant = (key: number, patch: Partial<VariantForm>) =>
    setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  const addVariant = () =>
    setVariants((vs) => [
      ...vs,
      { key: nextKey.current++, sku: "", name: "", price: "0.00", inventory: "0" },
    ]);

  const removeVariant = (key: number) => {
    setVariants((vs) => (vs.length > 1 ? vs.filter((v) => v.key !== key) : vs));
    setErrors({}); // indices shift, so old errors would point at the wrong rows
  };

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Product name is required";

    const seen = new Set<string>();
    variants.forEach((v, i) => {
      const k = `variants[${i}]`;
      const sku = v.sku.trim();
      if (!sku) e[`${k}.sku`] = "SKU is required";
      else if (seen.has(sku)) e[`${k}.sku`] = "Duplicate SKU in this form";
      seen.add(sku);
      if (!v.name.trim()) e[`${k}.name`] = "Variant name is required";
      if (parsePriceToCents(v.price) === null) e[`${k}.price_cents`] = PRICE_ERROR;
      if (parseInventory(v.inventory) === null)
        e[`${k}.inventory_count`] = INVENTORY_ERROR;
    });
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (submitting) return;

    const clientErrors = validate();
    setErrors(clientErrors);
    setFormError(null);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await createProduct({
        name: name.trim(),
        description: description.trim() || null,
        category_id: categoryId ? Number(categoryId) : null,
        status,
        variants: variants.map((v) => ({
          sku: v.sku.trim(),
          name: v.name.trim(),
          price_cents: parsePriceToCents(v.price)!,
          inventory_count: parseInventory(v.inventory)!,
        })),
      });

      if (!res.ok) {
        const { message, fields } = await readApiError(res);
        setErrors(fields); // server-side field errors (e.g. taken SKU)
        setFormError(message);
        return;
      }

      const created = await res.json();
      navigate(`/products/${created.id}`);
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link
        to="/products"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to products
      </Link>

      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        Create New Product
      </h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {formError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {formError}
          </div>
        )}

        {/* Product details */}
        <section className="rounded-lg border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold">Product details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *" error={errors.name} className="sm:col-span-2">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
              />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <textarea
                className={`${inputClass} h-24`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label="Category" error={errors.category_id}>
              <select
                className={inputClass}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status" error={errors.status}>
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "draft")}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </Field>
          </div>
        </section>

        {/* Variants */}
        <section className="rounded-lg border bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Variants ({variants.length})</h2>
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              Add variant
            </button>
          </div>
          {errors.variants && <p className="mb-3 text-sm text-red-600">{errors.variants}</p>}

          <div className="space-y-4">
            {variants.map((v, i) => {
              const k = `variants[${i}]`;
              return (
                <div key={v.key} className="rounded-md border p-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="SKU *" error={errors[`${k}.sku`]}>
                      <input
                        className={`${inputClass} font-mono`}
                        value={v.sku}
                        onChange={(e) => updateVariant(v.key, { sku: e.target.value })}
                        aria-invalid={!!errors[`${k}.sku`]}
                      />
                    </Field>
                    <Field label="Variant name *" error={errors[`${k}.name`]}>
                      <input
                        className={inputClass}
                        value={v.name}
                        onChange={(e) => updateVariant(v.key, { name: e.target.value })}
                      />
                    </Field>
                    <Field label="Price ($) *" error={errors[`${k}.price_cents`]}>
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={v.price}
                        onChange={(e) => updateVariant(v.key, { price: e.target.value })}
                      />
                    </Field>
                    <Field label="Inventory *" error={errors[`${k}.inventory_count`]}>
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={v.inventory}
                        onChange={(e) => updateVariant(v.key, { inventory: e.target.value })}
                      />
                    </Field>
                  </div>
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(v.key)}
                      className="mt-3 inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove variant
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Link to="/products" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2E3330] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3a3f3c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Creating…" : "Create product"}
          </button>
        </div>
      </form>
    </div>
  );
}