import { Product } from '@/types/pos';
import { products } from '@/data/products';

interface ProductGridProps {
  onAddProduct: (product: Product) => void;
}

export const ProductGrid = ({ onAddProduct }: ProductGridProps) => {
  return (
    <div className="flex-1 overflow-hidden">
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 h-full">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => onAddProduct(product)}
            style={{ backgroundColor: product.color, color: product.textColor }}
            className="pos-btn pos-product-btn p-1 flex flex-col items-center justify-center border-[0.5px] border-black/10 active:brightness-75 active:shadow-[inset_0_0_0_2px_hsl(var(--destructive)),0_0_12px_hsl(var(--destructive)/0.5)]"
          >
            <span className="product-label font-extrabold leading-[1.1] text-center uppercase">
              {product.name}
            </span>
            <span className="product-price font-extrabold mt-0.5">
              €{product.price.toFixed(2)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
