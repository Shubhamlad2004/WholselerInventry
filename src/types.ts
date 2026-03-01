export interface Product {
  id: number;
  brand_name: string;
  type: string;
  name: string;
  base_price: number;
  stock: number;
}

export interface Customer {
  id: number;
  name: string;
  address: string;
  phone: string;
  route_order: number;
  balance: number;
  delivery_status?: 'delivered' | null;
  delivery_id?: number | null;
}

export interface CustomPricing {
  id: number;
  customer_id: number;
  product_id: number;
  price: number;
  product_name?: string;
}

export interface RegularOrder {
  id: number;
  customer_id: number;
  product_id: number;
  quantity: number;
  product_name?: string;
  base_price?: number;
}

export interface Delivery {
  id: number;
  customer_id: number;
  customer_name?: string;
  delivery_date: string;
  status: 'pending' | 'delivered';
  payment_status: 'unpaid' | 'paid';
  total_amount: number;
}

export interface DeliveryItem {
  product_id: number;
  quantity: number;
  price_per_unit: number;
}
