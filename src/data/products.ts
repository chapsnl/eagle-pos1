import { Product } from '@/types/pos';

export const products: Product[] = [
  // BEER / TAPS - Yellow
  { id: '1', code: 'HEIN', name: 'HEINEKEN', price: 3.50, category: 'beer' },
  { id: '2', code: 'GROL', name: 'GROLSCH', price: 3.50, category: 'beer' },
  { id: '3', code: 'COAF', name: 'COAF BIER', price: 4.00, category: 'beer' },
  { id: '4', code: 'SPEC', name: 'SPECIAALBIER', price: 5.00, category: 'beer' },
  { id: '5', code: 'FLUI', name: 'FLUITJE', price: 2.50, category: 'beer' },
  { id: '6', code: 'PINT', name: 'PINT', price: 5.50, category: 'beer' },

  // SPIRITS - Red/Orange
  { id: '10', code: 'ABSO', name: 'ABSOLUT', price: 6.00, category: 'spirits' },
  { id: '11', code: 'JAME', name: 'JAMESON', price: 6.50, category: 'spirits' },
  { id: '12', code: 'JACD', name: 'JACK DANIELS', price: 6.50, category: 'spirits' },
  { id: '13', code: 'BACR', name: 'BACARDI', price: 6.00, category: 'spirits' },
  { id: '14', code: 'CAPT', name: 'CAPTAIN MORGAN', price: 6.00, category: 'spirits' },
  { id: '15', code: 'JÄGE', name: 'JÄGERMEISTER', price: 5.50, category: 'spirits' },
  { id: '16', code: 'TEQUI', name: 'TEQUILA', price: 5.50, category: 'spirits' },
  { id: '17', code: 'GINT', name: 'GIN TONIC', price: 7.00, category: 'spirits' },

  // SOFT / JUICES - Dark Blue/Teal
  { id: '20', code: 'JUIC', name: 'JUICE', price: 3.00, category: 'soft' },
  { id: '21', code: 'SOFT', name: 'SOFTDRINK', price: 3.00, category: 'soft' },
  { id: '22', code: 'REDB', name: 'RED BULL', price: 4.50, category: 'soft' },
  { id: '23', code: 'WATR', name: 'WATER', price: 2.50, category: 'soft' },
  { id: '24', code: 'SPA', name: 'SPA ROOD', price: 2.50, category: 'soft' },

  // MIX / WINE / OTHER - White/Grey
  { id: '30', code: 'WINE', name: 'WIJN', price: 5.00, category: 'mix' },
  { id: '31', code: 'BOMB', name: 'BOMB SHOT', price: 5.00, category: 'mix' },
  { id: '32', code: 'PROS', name: 'PROSECCO', price: 6.00, category: 'mix' },
  { id: '33', code: 'COCK', name: 'COCKTAIL', price: 8.00, category: 'mix' },
  { id: '34', code: 'SHTR', name: 'SHOTJE', price: 3.00, category: 'mix' },
];

export const categoryColors: Record<string, string> = {
  beer: 'bg-pos-beer text-primary-foreground',
  spirits: 'bg-pos-spirits text-accent-foreground',
  'spirits-alt': 'bg-pos-spirits-alt text-accent-foreground',
  soft: 'bg-pos-soft text-foreground',
  mix: 'bg-pos-mix text-background',
};
