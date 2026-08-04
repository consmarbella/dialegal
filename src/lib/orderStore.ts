export interface Order {
  orderId: string;
  preferenceId: string;
  status: 'pending' | 'approved' | 'failed';
  amount: number;
  title: string;
  payerEmail?: string;
  mpPaymentId?: string;
  paidAt?: number;
  createdAt: number;
}

const ordersMap = new Map<string, Order>();

export function saveOrder(order: Order): void {
  ordersMap.set(order.orderId, order);
  if (order.preferenceId) {
    ordersMap.set(`pref:${order.preferenceId}`, order);
  }
}

export function getOrderByOrderId(orderId: string): Order | undefined {
  return ordersMap.get(orderId);
}

export function getOrderByPreferenceId(preferenceId: string): Order | undefined {
  return ordersMap.get(`pref:${preferenceId}`);
}

export function updateOrder(orderId: string, updates: Partial<Order>): Order | undefined {
  const existing = ordersMap.get(orderId);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates };
  ordersMap.set(orderId, updated);
  if (updated.preferenceId) {
    ordersMap.set(`pref:${updated.preferenceId}`, updated);
  }
  return updated;
}
