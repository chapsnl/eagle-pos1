import { useProducts, getTextColor, DbProduct } from '@/hooks/useProducts';

// Grid layout referencing products by shorthand
const gridLayout: { code: string; span: number; hideLabel?: boolean }[][] = [
  [
    { code: '1', span: 1 }, { code: 'DIV9', span: 1 }, { code: 'SHO', span: 1 }, { code: 'BAIL', span: 1 },
    { code: 'JAME', span: 2 }, { code: 'ABSO', span: 2 }, { code: 'HEIN', span: 2 },
  ],
  [
    { code: '20', span: 1 }, { code: '18', span: 1 }, { code: 'TTOP', span: 1 }, { code: 'MALI', span: 1 },
    { code: 'JACD', span: 2 }, { code: 'BOMB', span: 2 }, { code: 'GROL', span: 2 },
  ],
  [
    { code: '7', span: 1 }, { code: '12.5', span: 1 }, { code: 'AMAR', span: 1 }, { code: 'TEQU', span: 1 },
    { code: 'JIMB', span: 2 }, { code: 'APPC', span: 2 }, { code: 'COAF', span: 2 },
  ],
  [
    { code: '8', span: 1 }, { code: '10', span: 1 }, { code: 'TSHI', span: 1 }, { code: 'SAMB', span: 1 },
    { code: 'BSPI', span: 2 }, { code: 'WHIB', span: 2 }, { code: 'HE0%', span: 2 },
  ],
  [
    { code: '8', span: 1, hideLabel: true }, { code: '10', span: 1, hideLabel: true }, { code: 'JAEG', span: 1 }, { code: 'LICO', span: 1 },
    { code: 'BACA', span: 2 }, { code: 'JENE', span: 2 }, { code: 'JUIC', span: 2 },
  ],
  [
    { code: '8', span: 1, hideLabel: true }, { code: '10', span: 1, hideLabel: true }, { code: 'SEXT', span: 1 }, { code: 'STFF', span: 1 },
    { code: 'REDB', span: 2 }, { code: 'WINE', span: 2 }, { code: 'SOFT', span: 2 },
  ],
];

interface ProductGridProps {
  onAddProduct: (product: DbProduct) => void;
}

export const ProductGrid = ({ onAddProduct }: ProductGridProps) => {
  const { data: products, isLoading } = useProducts();

  if (isLoading || !products) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const productMap = new Map(products.map((p) => [p.shorthand, p]));

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {gridLayout.map((row, ri) => (
        <div key={ri} className="flex-1 flex" style={{ minHeight: 0 }}>
          {row.map((cell, ci) => {
            const product = productMap.get(cell.code);
            if (!product) return <div key={ci} style={{ flex: cell.span }} />;
            const textColor = getTextColor(product.category_color);
            return (
              <button
                key={ci}
                onClick={() => onAddProduct(product)}
                className="pos-btn flex items-center justify-center border-[0.5px] border-black/10 active:brightness-[0.6] p-1 min-w-0 transition-all duration-75"
                style={{
                  flex: cell.span,
                  backgroundColor: product.category_color,
                  color: textColor,
                }}
                onPointerDown={(e) => {
                  e.currentTarget.style.boxShadow = 'inset 0 0 0 3px #ff0000, 0 0 15px #ff0000';
                }}
                onPointerUp={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onPointerLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span
                  className="font-extrabold leading-[1.05] text-center uppercase whitespace-pre-line"
                  style={{ fontSize: cell.span === 2 ? 'clamp(1.2rem, 3.5vw, 2.8rem)' : 'clamp(0.7rem, 2vw, 1.5rem)' }}
                >
                  {cell.hideLabel ? '' : product.full_name}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
