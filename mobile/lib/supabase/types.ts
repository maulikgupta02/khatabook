export type ShopCategory = 'milk' | 'kirana' | 'tiffin' | 'newspaper' | 'other';
export type DeliveryStatus = 'delivered' | 'changed' | 'skipped' | 'extra';
export type FlagStatus = 'open' | 'resolved' | 'dismissed';

export type Shop = {
  id: string;
  name: string;
  category: ShopCategory;
  owner_user_id: string;
  created_at: string;
};

export type ShopOwnerProfile = {
  user_id: string;
  shop_id: string;
  full_name: string;
  phone: string | null;
};

export type Item = {
  id: string;
  shop_id: string;
  name: string;
  unit: string;
  is_active: boolean;
  created_at: string;
};

export type ItemPriceHistory = {
  id: string;
  item_id: string;
  price: number;
  effective_from: string;
  effective_to: string | null;
};

export type Customer = {
  id: string;
  shop_id: string;
  name: string;
  mobile: string;
  address: string;
  delivery_notes: string | null;
  auth_user_id: string | null;
  internal_auth_email: string | null;
  is_active: boolean;
  created_at: string;
  deleted_at: string | null;
};

export type RecurringRule = {
  id: string;
  customer_id: string;
  item_id: string;
  days_of_week: number[];
  quantity: number;
  is_active: boolean;
  start_date: string;
};

export type DeliveryRecord = {
  id: string;
  shop_id: string;
  customer_id: string;
  item_id: string;
  delivery_date: string;
  quantity: number;
  unit_price: number;
  status: DeliveryStatus;
  is_extra: boolean;
  client_mutation_id: string;
  created_by: string | null;
  created_at: string;
  synced_at: string | null;
};

export type DeliveryFlag = {
  id: string;
  delivery_record_id: string;
  customer_id: string;
  raised_by: string;
  reason_text: string;
  status: FlagStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

export type Payment = {
  id: string;
  shop_id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
};

export type PaymentAudit = {
  id: string;
  payment_id: string;
  shop_id: string;
  edited_by: string | null;
  edited_at: string;
  old_amount: number;
  new_amount: number;
  old_payment_date: string;
  new_payment_date: string;
  old_note: string | null;
  new_note: string | null;
};

export type ExpectedDelivery = {
  customer_id: string;
  item_id: string;
  expected_quantity: number;
  record_id: string | null;
  actual_quantity: number | null;
  unit_price: number;
  status: DeliveryStatus | null;
};
