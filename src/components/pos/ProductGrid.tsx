import { Product, ProductCategory } from '@/types/pos';
import { products, categoryColors } from '@/data/products';

interface ProductGridProps {
  onAddProduct: (product: Product) => void;
}

const categoryOrder: ProductCategory[] = ['beer', 'spirits', 'soft', 'mix'];
const categoryLabels: Record<ProductCategory, string> = {
  beer: 'BIER / TAPS',
  spirits: 'STERKE DRANK',
  'spirits-alt': 'SPIRITS',
  soft: 'FRIS / JUICE',
  mix: 'MIX / WIJN',
};

export const ProductGrid = ({ onAddProduct }: ProductGridProps) => {
  const grouped = categoryOrder.map((cat) => ({
    category: cat,
    label: categoryLabels[cat],
    items: products.filter((p) => p.category === cat),
  }));

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      {grouped.map(({ category, label, items }) => (
        <div key={category}>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2 px-1">
            {label}
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {items.map((product) => (
              <button
                key={product.id}
                onClick={() => onAddProduct(product)}
                className={`${categoryColors[category]} pos-btn rounded-lg p-3 flex flex-col items-center justify-center min-h-[72px] shadow-md hover:brightness-110 active:brightness-90`}
              >
                <span className="text-xs font-extrabold leading-tight text-center">{product.code}</span>
                <span className="text-[10px] font-semibold mt-0.5 opacity-80">{product.name}</span>
                <span className="text-sm font-extrabold mt-1">€{product.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
