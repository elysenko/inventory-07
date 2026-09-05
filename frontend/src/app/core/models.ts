/** Shared payload types mirroring the REST surface under `/api`. */

export type Role = 'USER' | 'MANAGER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
}

export type MovementType = 'IN' | 'OUT' | 'TRANSFER';

export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  unit: string;
  reorderAt: number;
  qtyOnHand: number;
  isLow: boolean;
  createdAt?: string;
}

export interface ItemLocationQty {
  locationId: string;
  name: string;
  zone: string;
  qty: number;
}

export interface ItemDetail extends Item {
  locations: ItemLocationQty[];
}

export interface Location {
  id: string;
  name: string;
  zone: string;
  itemCount?: number;
  totalQty?: number;
}

export interface Movement {
  id: string;
  type: MovementType;
  itemId: string;
  itemSku: string;
  itemName: string;
  fromLocName?: string | null;
  toLocName?: string | null;
  qty: number;
  note?: string | null;
  userEmail: string;
  createdAt: string;
}

export interface MovementPage {
  entries: Movement[];
  total: number;
  page: number;
}

export interface LowStockRow {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  reorderAt: number;
  deficit: number;
}

export interface SettingsEntry {
  service: string;
  key: string;
  label: string;
  value: string;
  configured: boolean;
  secret: boolean;
}
