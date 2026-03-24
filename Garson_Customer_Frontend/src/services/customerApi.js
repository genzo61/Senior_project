import { apiClient } from './apiClient';
import { enrichProduct, sortProducts } from '../utils/menuUtils';

export async function fetchProducts() {
  const response = await apiClient.get('/api/products');
  const rows = Array.isArray(response.data) ? response.data : [];
  return sortProducts(rows.map(enrichProduct));
}

export async function fetchTables() {
  const response = await apiClient.get('/api/tables');
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchTableById(tableId) {
  const tables = await fetchTables();
  const targetId = Number(tableId);
  return tables.find((table) => Number(table.id) === targetId) ?? null;
}

export async function createOrder(orderPayload) {
  const response = await apiClient.post('/api/orders', orderPayload);
  return response.data;
}

export async function fetchOrderById(orderId) {
  const response = await apiClient.get(`/api/orders/${orderId}`);
  return response.data;
}
