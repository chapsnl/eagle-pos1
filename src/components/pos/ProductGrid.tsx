import { useProducts, getTextColor, DbProduct } from '@/hooks/useProducts';

/**
 * Unified 6x7 product grid used by both NR (TestPage) and DIRECT (DirectPage).
 *
 * Layout = 6 rows × 7 columns of flex (4 narrow span-1 + 3 wide span-2).
 *
 * Action slots (overrides on specific cells):
 *   - row 3, col 0 → Entree button (label "8") — calls onEntree
 *   - row 4, col 0 → PAY button — calls onPay
 *   - row 4, col 1 → RETOUR toggle — calls onToggleRetour, highlights when retourMode
 *   - row 5, col 0 → NEXT button — calls onNext
 *   - row 5, col 1 → blind cell
 *
 * All other cells map to a product via shorthand.
 */

const gridLayout: { code: string; span: number; hideLabel?: boolean; label?: string }[][] = [
  [
    { code: '1', span: 1 }, { code: '6', span: 1 }, { code: 'SHO', span: 1 }, { code: 'BAIL', span: 1 },
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
    { code: 'ENTR', span: 1, label: '8' }, { code: '10', span: 1 }, { code: 'TSHI', span: 1 }, { code: 'SAMB', span: 1 },
    { code: 'BSPI', span: 2 }, { code: 'WHIB', span: 2 }, { code: 'HE0%', span: 2 },
  ],
  [
    { code: 'ENTR', span: 1, hideLabel: true }, { code: '10', span: 1, hideLabel: true }, { code: 'JAEG', span: 1 }, { code: 'LICO', span: 1 },
    { code: 'BACA', span: 2 }, { code: 'JENE', span: 2 }, { code: 'JUIC', span: 2 },
  ],
  [
    { code: 'ENTR', span: 1, hideLabel: true }, { code: '10', span: 1, hideLabel: true }, { code: 'SEXT', span: 1 }, { code: 'STFF', span: 1 },
    { code: 'REDB', span: 2 }, { code: 'WINE', span: 2 }, { code: 'SOFT', span: 2 },
  ],
];

const pointerHandlers = {
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(0.93)';
    e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.5)';
  },
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = 'none';
  },
  onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = 'none';
  },
};

interface ProductGridProps {
  onAddProduct: (product: DbProduct) => void;
  onEntree?: (product: DbProduct) => void;
  onPay?: () => void;
  onToggleRetour?: () => void;
  onNext?: () => void;
  retourMode?: boolean;
}

export const ProductGrid = ({
  onAddProduct,
  onEntree,
  onPay,
  onToggleRetour,
  onNext,
  retourMode = false,
}: ProductGridProps) => {
  const { data: products, isLoading } = useProducts();
  const productMap = new Map((products ?? []).map((p) => [p.shorthand, p]));

  const smallFont = 'clamp(0.48rem, 1.62vw, 1.24rem)';
  const wideFont = 'clamp(0.96rem, 3.04vw, 2.48rem)';

  return (
    <div className="flex-1 flex flex-col overflow-hidden gap-[1px]" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
      {isLoading ? (
        gridLayout.map((row, ri) => (
          <div key={ri} className="flex-1 flex gap-[1px]" style={{ minHeight: 0 }}>
            {row.map((cell, ci) => (
              <div key={ci} className="animate-pulse" style={{ flex: cell.span, backgroundColor: '#2a2a2a' }} />
            ))}
          </div>
        ))
      ) : (
        gridLayout.map((row, ri) => (
          <div key={ri} className="flex-1 flex gap-[1px]" style={{ minHeight: 0 }}>
            {row.map((cell, ci) => {
              // Entree button (row 3 col 0)
              if (ri === 3 && ci === 0) {
                const entrProduct = productMap.get('ENTR');
                const entBg = entrProduct?.category_color || '#e4e2e2';
                const entTextColor = entrProduct ? getTextColor(entrProduct.category_color) : '#000';
                return (
                  <button
                    key={ci}
                    onClick={() => { if (entrProduct) (onEntree ?? onAddProduct)(entrProduct); }}
                    style={{ flex: cell.span, backgroundColor: entBg, color: entTextColor }}
                    className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75"
                    {...pointerHandlers}
                  >
                    <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: smallFont }}>8</span>
                  </button>
                );
              }
              // PAY (row 4 col 0)
              if (ri === 4 && ci === 0) {
                return (
                  <button
                    key={ci}
                    onClick={onPay}
                    style={{ flex: cell.span, backgroundColor: '#ef4444', color: '#fff' }}
                    className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75"
                    {...pointerHandlers}
                  >
                    <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: smallFont }}>PAY</span>
                  </button>
                );
              }
              // RETOUR (row 4 col 1)
              if (ri === 4 && ci === 1) {
                return (
                  <button
                    key={ci}
                    onClick={onToggleRetour}
                    style={{ flex: cell.span, backgroundColor: retourMode ? '#ef4444' : '#7c3aed', color: '#fff', transition: 'background-color 0.2s ease' }}
                    className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75"
                    {...pointerHandlers}
                  >
                    <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: smallFont }}>RETOUR</span>
                  </button>
                );
              }
              // NEXT (row 5 col 0)
              if (ri === 5 && ci === 0) {
                return (
                  <button
                    key={ci}
                    onClick={onNext}
                    style={{ flex: cell.span, backgroundColor: '#1a3a6a', color: '#fff' }}
                    className="pos-btn flex items-center justify-center p-1 min-w-0 transition-all duration-75"
                    {...pointerHandlers}
                  >
                    <span className="font-extrabold leading-[1.05] text-center uppercase" style={{ fontSize: smallFont }}>NEXT</span>
                  </button>
                );
              }
              // Blind cell (row 5 col 1)
              if (ri === 5 && ci === 1) {
                return (
                  <div key={ci} style={{ flex: cell.span, backgroundColor: '#2a2a2a' }} className="flex items-center justify-center p-1 min-w-0" />
                );
              }
              // Regular product cells
              const product = productMap.get(cell.code);
              if (!product) return <div key={ci} style={{ flex: cell.span }} />;
              const textColor = getTextColor(product.category_color);
              return (
                <button
                  key={ci}
                  onClick={() => onAddProduct(product)}
                  style={{ flex: cell.span, backgroundColor: product.category_color, color: textColor }}
                  className="pos-btn flex items-center justify-center active:brightness-[0.6] p-1 min-w-0 transition-all duration-75"
                  {...pointerHandlers}
                >
                  <span
                    className="font-extrabold leading-[1.05] text-center uppercase whitespace-pre-line"
                    style={{ fontSize: cell.span === 2 ? wideFont : smallFont }}
                  >
                    {cell.hideLabel ? '' : (cell.label || product.full_name)}
                  </span>
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
};
