import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Package } from "lucide-react";
import { fetchProduct, deleteProduct, updateVariant } from "@/lib/api";
import type { ProductDetail, Variant } from "@/types";
import { formatPrice, cn } from "@/lib/utils";
import {
  parsePriceToCents, parseInventory, readApiError, PRICE_ERROR, INVENTORY_ERROR,
} from "@/lib/validation";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetail | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

useEffect(() => {
  if (!id) return;
  let ignore = false;
  setLoadError(null);
  fetchProduct(Number(id))
    .then(async (r) => {
      if (!r.ok) throw new Error((await readApiError(r)).message);
      return r.json();
    })
    .then((data) => { if (!ignore) setProduct(data); })
    .catch((err) => { if (!ignore) setLoadError(err instanceof Error ? err.message : "Failed to load product"); });
  return () => { ignore = true; };
}, [id]);

  // Delete handler — sends soft-delete request.
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteInFlight = useRef(false); // sync guard: state updates are async, so fast double-clicks could slip past `deleting`

  const handleDelete = async () => {
    if (!id || deleteInFlight.current) return;
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    deleteInFlight.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteProduct(Number(id));
      if (!res.ok) throw new Error((await readApiError(res)).message);
      navigate("/products");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
      deleteInFlight.current = false; // allow a retry
      setDeleting(false);
    }
  };

  const handleVariantUpdated = (updated: Variant) =>
    setProduct((p) =>
      p && { ...p, variants: p.variants.map((v) => (v.id === updated.id ? updated : v)) }
    );

    if (loadError) {
      return (
        <div role="alert" className="py-20 text-center">
          <p className="text-lg font-medium text-red-600">Could not load product</p>
          <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          <Link to="/products" className="mt-4 inline-block text-sm underline">Back to products</Link>
        </div>
      );
    }

    if (!product) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      );
    }

  return (
    <div>
      {/* Back link */}
      <Link
        to="/products"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to products
      </Link>

      {/* Product header — card style */}
      <div className="mb-6 rounded-lg border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {product.name}
            </h1>
            {product.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {product.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  product.status === "active"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : product.status === "draft"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-gray-100 text-gray-600"
                )}
              >
                {product.status}
              </span>
              {product.category_name && (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {product.category_name}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
        {deleteError && (
          <p role="alert" className="mt-3 text-sm text-red-600">{deleteError}</p>
        )}
      </div>

      {/* Variants table — card wrapped like CatalogList */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Variants ({product.variants.length})
        </h2>

        <div className="overflow-hidden rounded-lg border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b bg-muted/50 transition-colors">
                  <th className="h-12 px-4 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    SKU
                  </th>
                  <th className="h-12 px-4 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="h-12 px-4 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Price
                  </th>
                  <th className="h-12 px-4 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Inventory
                  </th>
                  <th className="h-12 px-4 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {product.variants.map((v) => (
                  <VariantRow key={v.id} variant={v} onUpdated={handleVariantUpdated} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function VariantRow({
  variant,
  onUpdated,
}: {
  variant: Variant;
  onUpdated: (v: Variant) => void;
}) {
  const lowStock = variant.inventory_count > 0 && variant.inventory_count <= 10;
  const outOfStock = variant.inventory_count === 0;

  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState("");
  const [inventory, setInventory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setPrice((variant.price_cents / 100).toFixed(2));
    setInventory(String(variant.inventory_count));
    setError(null);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    if (saving) return;
    const price_cents = parsePriceToCents(price);
    const inventory_count = parseInventory(inventory);
    if (price_cents === null) { setError(PRICE_ERROR); return; }
    if (inventory_count === null) { setError(INVENTORY_ERROR); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await updateVariant(variant.id, { price_cents, inventory_count });
      if (!res.ok) {
        setError((await readApiError(res)).message);
        return;
      }
      onUpdated(await res.json());
      setEditing(false);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  };

  const editInput =
    "h-8 w-24 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <tr className="border-b transition-colors hover:bg-muted/50">
      <td className="p-4 align-middle font-mono text-xs">{variant.sku}</td>
      <td className="p-4 align-middle font-medium">{variant.name}</td>

      <td className="p-4 text-right align-middle tabular-nums">
        {editing ? (
          <input
            className={editInput}
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Price in dollars"
            autoFocus
          />
        ) : (
          formatPrice(variant.price_cents)
        )}
      </td>

      <td className="p-4 text-right align-middle tabular-nums">
        {editing ? (
          <input
            className={editInput}
            inputMode="numeric"
            value={inventory}
            onChange={(e) => setInventory(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Inventory count"
          />
        ) : (
          <span className={cn(outOfStock && "text-destructive", lowStock && "text-amber-600")}>
            {variant.inventory_count}
            {outOfStock && <Package className="ml-1 inline h-3.5 w-3.5 text-destructive/60" />}
          </span>
        )}
      </td>

      <td className="p-4 text-right align-middle">
        {editing ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-[#2E3330] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#3a3f3c] disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={cancel}
                disabled={saving}
                className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
            {error && <p role="alert" className="max-w-[16rem] text-xs text-red-600">{error}</p>}
          </div>
        ) : (
          <button
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={startEdit}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}
