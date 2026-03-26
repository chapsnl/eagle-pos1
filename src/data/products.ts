import { Product } from '@/types/pos';

const dark = (hex: string) => ['#12100e', '#357cff', '#497df7'].includes(hex);

const p = (id: number, code: string, name: string, price: number, hex: string): Product => ({
  id: String(id),
  code,
  name,
  price,
  color: hex,
  textColor: dark(hex) ? '#ffffff' : '#12100e',
});


// Sorted by popularity (1 = most used)
export const products: Product[] = [
  p(1, 'HEIN', 'Heineken', 5.50, '#f4b738'),
  p(2, 'GROL', 'Grolsch', 6.50, '#f4b738'),
  p(3, 'COAF', 'Corona/Affligem', 3.00, '#f4b738'),
  p(4, 'HE0%', 'Heineken 0%', 3.00, '#f4b738'),
  p(5, 'JUIC', 'Juices', 4.50, '#497df7'),
  p(6, 'SOFT', 'Soft\nDrinks', 4.00, '#497df7'),
  p(7, 'ABSO', 'Absolute', 6.00, '#bb706b'),
  p(8, 'BOMB', 'Bombay', 3.00, '#8f8255'),
  p(9, 'APPC', 'Apple Cider', 3.00, '#f4b738'),
  p(10, 'WHIB', 'White Beer', 3.00, '#f4b738'),
  p(11, 'JENE', 'Jenever', 3.00, '#e4e2e2'),
  p(12, 'WINE', 'Martini\nWine', 3.00, '#e4e2e2'),
  p(13, 'JAME', 'Jamesson', 3.00, '#ef5931'),
  p(14, 'JACD', 'Jack Daniels', 3.00, '#ef5931'),
  p(15, 'JIMB', 'Jim Beam', 3.00, '#ef5931'),
  p(16, 'BSPI', 'Black Spiced', 3.00, '#aacd6c'),
  p(17, 'BACA', 'Bacardi', 3.00, '#aacd6c'),
  p(18, 'REDB', 'Redbull', 3.00, '#497df7'),
  p(19, 'BAIL', 'Baileys', 3.00, '#e4e2e2'),
  p(20, 'MALI', 'Malibu', 3.00, '#e4e2e2'),
  p(21, 'TEQU', 'Tequila', 3.00, '#e4e2e2'),
  p(22, 'SAMB', 'Sambuca', 3.00, '#e4e2e2'),
  p(23, 'LICO', 'Licor 43', 3.00, '#e4e2e2'),
  p(24, 'STFF', 'Staff', 2.00, '#e4e2e2'),
  p(25, 'SHO', 'Shot', 4.00, '#aacd6c'),
  p(26, 'TTOP', 'Tank Top', 20.00, '#12100e'),
  p(27, 'AMAR', 'Amaretto', 3.00, '#e4e2e2'),
  p(28, 'TSHI', 'T-Shirt', 17.50, '#12100e'),
  p(29, 'JAEG', 'Jäger\nMeister', 3.00, '#e4e2e2'),
  p(30, 'SEXT', 'Sex\nToys', 3.00, '#12100e'),
  p(31, 'DIV9', 'DIV 9%', 3.00, '#12100e'),
  p(32, '18', '18', 18.00, '#e4e2e2'),
  p(33, '12.5', '12.5', 12.50, '#e4e2e2'),
  p(34, '10', '10', 10.00, '#e4e2e2'),
  p(35, '1', '1', 0.01, '#e4e2e2'),
  p(36, '20', '20', 20.00, '#e4e2e2'),
  p(37, '7', '7', 7.00, '#e4e2e2'),
  p(38, '8', '8', 8.00, '#e4e2e2'),
  p(39, 'COAT', '', 0, '#e4e2e2'),
  p(40, 'BAG', '', 0, '#e4e2e2'),
];
