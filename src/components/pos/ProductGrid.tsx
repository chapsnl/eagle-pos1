import { Product } from '@/types/pos';
import { products } from '@/data/products';

interface ProductGridProps {
  onAddProduct: (product: Product) => void;
}

export const ProductGrid = ({ onAddProduct }: ProductGridProps) => {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => onAddProduct(product)}
            style={{ backgroundColor: product.color, color: product.textColor }}
            className="pos-btn p-2 flex flex-col items-center justify-center min-h-[80px] border-[0.5px] border-black/10 hover:brightness-110 active:brightness-90"
          >
            <span className="text-sm font-extrabold leading-tight text-center">
              {product.name}
            </span>
            <span className="text-base font-extrabold mt-1">
              €{product.price.toFixed(2)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
