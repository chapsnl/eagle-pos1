import { useState, useRef, useCallback } from 'react';
import { useProducts, getTextColor, DbProduct } from '@/hooks/useProducts';

// Wide columns (span-2 items) - 3 columns per row
const wideLayout: { code: string; hideLabel?: boolean }[][] = [
  [{ code: 'JAME' }, { code: 'ABSO' }, { code: 'HEIN' }],
  [{ code: 'JACD' }, { code: 'BOMB' }, { code: 'GROL' }],
  [{ code: 'JIMB' }, { code: 'APPC' }, { code: 'COAF' }],
  [{ code: 'BSPI' }, { code: 'WHIB' }, { code: 'HE0%' }],
  [{ code: 'BACA' }, { code: 'JENE' }, { code: 'JUIC' }],
  [{ code: 'REDB' }, { code: 'WINE' }, { code: 'SOFT' }],
];

// Narrow columns (span-1 items) - 4 columns per row
const narrowLayout: { code: string; hideLabel?: boolean }[][] = [
  [{ code: '1' }, { code: 'DIV9' }, { code: 'SHO' }, { code: 'BAIL' }],
  [{ code: '20' }, { code: '18' }, { code: 'TTOP' }, { code: 'MALI' }],
  [{ code: '7' }, { code: '12.5' }, { code: 'AMAR' }, { code: 'TEQU' }],
  [{ code: '8' }, { code: '10' }, { code: 'TSHI' }, { code: 'SAMB' }],
  [{ code: '8', hideLabel: true }, { code: '10', hideLabel: true }, { code: 'JAEG' }, { code: 'LICO' }],
  [{ code: '8', hideLabel: true }, { code: '10', hideLabel: true }, { code: 'SEXT' }, { code: 'STFF' }],
];

interface ProductGridProps {
  onAddProduct: (product: DbProduct) => void;
}

export const ProductGrid = ({ onAddProduct }: ProductGridProps) => {
  const { data: products, isLoading } = useProducts();
  const [page, setPage] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (Math.abs(touchDeltaX.current) > 50) {
      if (touchDeltaX.current < 0) setPage((p) => Math.min(p + 1, 1));
      if (touchDeltaX.current > 0) setPage((p) => Math.max(p - 1, 0));
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  }, [page]);

  if (isLoading || !products) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const productMap = new Map(products.map((p) => [p.shorthand, p]));

  const renderGrid = (layout: { code: string; hideLabel?: boolean }[][]) => (
    <div className="h-full flex flex-col">
      {layout.map((row, ri) => (
        <div key={ri} className="flex-1 flex" style={{ minHeight: 0 }}>
          {row.map((cell, ci) => {
            const product = productMap.get(cell.code);
            if (!product) return <div key={ci} className="flex-1" />;
            const textColor = getTextColor(product.category_color);
            return (
              <button
                key={ci}
                onClick={() => onAddProduct(product)}
                className="pos-btn flex-1 flex items-center justify-center border-[0.5px] border-black/10 active:brightness-[0.6] p-1 min-w-0 transition-all duration-75"
                style={{
                  backgroundColor: product.category_color,
                  color: textColor,
                }}
                onPointerDown={(e) => {
                  e.currentTarget.style.boxShadow = 'inset 0 0 0 3px #00cc13, 0 0 15px #00cc1380';
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
                  style={{ fontSize: layout === wideLayout ? 'clamp(1.01rem, 3.2vw, 2.61rem)' : 'clamp(0.63rem, 1.85vw, 1.43rem)' }}
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

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${page * 100}%)` }}
      >
        <div className="w-full h-full shrink-0">{renderGrid(wideLayout)}</div>
        <div className="w-full h-full shrink-0">{renderGrid(narrowLayout)}</div>
      </div>
      {/* Page indicator */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1.5">
        <div className={`w-2 h-2 rounded-full transition-colors ${page === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
        <div className={`w-2 h-2 rounded-full transition-colors ${page === 1 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
      </div>
    </div>
  );
};
