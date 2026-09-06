// src/lib/providers/interfaces/items.ts

export type ItemType = 'Service' | 'NonInventory' | 'Inventory' | 'Bundle' | 'Category';

export interface Item {
  id: string;
  name: string;
  sku?: string;
  type: ItemType;
  active?: boolean;
  
  // Description
  description?: string;
  purchase_description?: string;
  
  // Pricing
  unit_price?: number;
  purchase_cost?: number;
  
  // Inventory (for Inventory type)
  qty_on_hand?: number;
  reorder_point?: number;
  
  // Accounts
  income_account_ref?: {
    value: string;
    name: string;
  };
  expense_account_ref?: {
    value: string;
    name: string;
  };
  asset_account_ref?: {
    value: string;
    name: string;
  };
  
  // Tax
  taxable?: boolean;
  sales_tax_included?: boolean;
  purchase_tax_included?: boolean;
  
  // Category
  category?: string;
  parent_ref?: {
    value: string;
    name: string;
  };
  
  // Tracking
  track_qty_on_hand?: boolean;
  inv_start_date?: string;
  
  // Metadata
  created_time?: string;
  last_modified_time?: string;
}

export interface ItemListOptions {
  type?: ItemType;
  active?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: 'name' | 'type' | 'price';
  sort_order?: 'asc' | 'desc';
}

export interface ItemStatistics {
  total_items: number;
  items_by_type: Record<ItemType, number>;
  active_items: number;
  inventory_value?: number;
  low_stock_items?: Array<{
    item_id: string;
    item_name: string;
    qty_on_hand: number;
    reorder_point: number;
  }>;
}

export interface ItemProvider {
  listItems(userOrgId: string, options?: ItemListOptions): Promise<Item[]>;
  getItem(userOrgId: string, itemId: string): Promise<Item>;
  createItem(userOrgId: string, item: Partial<Item>): Promise<Item>;
  updateItem(userOrgId: string, itemId: string, item: Partial<Item>): Promise<Item>;
  getItemStatistics(userOrgId: string): Promise<ItemStatistics>;
  searchItems(userOrgId: string, query: string): Promise<Item[]>;
  getLowStockItems(userOrgId: string): Promise<Item[]>;
}