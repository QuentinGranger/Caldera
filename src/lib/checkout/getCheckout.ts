import 'server-only';
import { getCartCookie } from '@/lib/cart/cartCookie';
import { getCheckoutData } from './queries';
import { getCheckoutSummary } from './validation';
export async function getCheckout() {
  const data = await getCheckoutData(await getCartCookie());
  return data ? getCheckoutSummary(data) : null;
}
