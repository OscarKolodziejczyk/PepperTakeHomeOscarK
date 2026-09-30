import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, X, Loader2 } from "lucide-react";
import { fetchProducts, fetchCategories } from "@/lib/api";
import type { Product, Category } from "@/types";
import ProductCard from "@/components/ProductCard";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // Retry button, counter, to trigger a re-fetch


  const hasFilters = Boolean(search || categoryId);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories()
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Fetch products when filters change
  useEffect(() => {
    let ignore = false; // guards against Simultaneous responses

    async function load() { // Effect callback cant be async, so we define an inner async function
      setLoading(true);
      setError(null);
    
    try {
      const res = await fetchProducts({ search: search || undefined, category_id: categoryId });
      if (!res.ok) {
        res.json().catch(() => null); // Attempt to parse error message, but ignore if it fails
        throw new Error(`Failed to fetch products: ${res.status}`);
      }
      const data = await res.json();
      if (!ignore) {
        setProducts(data);
      }
    } catch (err) {
      if (!ignore) {
        setError((err as Error).message);
      } 
    } finally {
      if (!ignore) {
        setLoading(false);
      }
    }
  }

    load();
    return () => {
      ignore = true; // Ignores previous request if new one is made before it completes
    }; 
  }, [search, categoryId, reloadKey]);

  const clearFilters = () => {
    setSearch("");
    setCategoryId(undefined);
  };

  return (
    <div>
      {/* Filters bar — matches CatalogFilters layout */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <label className="mb-1.5 block text-sm font-medium">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        {/* Category filter */}
        <div className="sm:min-w-[180px]">
          <label className="mb-1.5 block text-sm font-medium">Category</label>
          <select
            value={categoryId ?? ""}
            onChange={(e) =>
              setCategoryId(e.target.value ? Number(e.target.value) : undefined)
            }
            className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clear + New Product */}
        <div className="flex items-end gap-2">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}

          <Link
            to="/products/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[#2E3330] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3a3f3c]"
          >
            <Plus className="h-4 w-4" />
            New Product
          </Link>
        </div>
      </div>

      {/* Result count */}
      { ! loading && !error && (
        <p className="mb-4 text-sm text-muted-foreground">
          {products.length} result{products.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Product grid — 5 columns on xl like original CatalogGrid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-lg font-medium">Loading products...</p>
        </div>
      ) : error ? (
        <div 
            role="alert"
            className="mx-auto my-10 flex max-w-md flex-col items-center rounded-md border border-red-200 bg-red-50 p-6 text-center"
          >
          <p className="text-lg font-medium text-red-700">Error loading products</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            onClick={() => setReloadKey((prev) => prev + 1)}
            className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-md bg-[#2E3330] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3a3f3c]"
          >
            Retry
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">No products found</p>
          <p className="mt-1 text-sm">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
