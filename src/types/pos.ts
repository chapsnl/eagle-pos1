export interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  color: string;
  textColor: string;
}

export interface OrderItem {
  product: Product;
  quantity: number;
}

export interface OrderState {
  items: OrderItem[];
  total: number;
}

export type FeedbackType = 'success' | 'error' | null;

export type AppView = 'bar' | 'garderobe' | 'betaling' | 'arm-nummer' | 'admin' | 'admin2' | 'test';
