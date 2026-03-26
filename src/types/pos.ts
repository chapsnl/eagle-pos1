export interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  category: ProductCategory;
}

export type ProductCategory = 'beer' | 'spirits' | 'spirits-alt' | 'soft' | 'mix';

export interface OrderItem {
  product: Product;
  quantity: number;
}

export interface OrderState {
  items: OrderItem[];
  total: number;
}

export type FeedbackType = 'success' | 'error' | null;

export type AppView = 'bar' | 'garderobe' | 'arm-nummer' | 'admin';
