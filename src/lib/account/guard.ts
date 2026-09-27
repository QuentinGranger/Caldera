import 'server-only';
import { redirect } from 'next/navigation';
import { currentCustomer } from './auth';
import { ACCOUNT_PATH, SIGN_IN_PATH } from './validation';

/** The signed-in customer, or a redirect to sign-in that comes back here. */
export async function requireCustomer(returnTo = ACCOUNT_PATH) {
  const customer = await currentCustomer();
  if (!customer)
    redirect(`${SIGN_IN_PATH}?retour=${encodeURIComponent(returnTo)}`);
  return customer;
}
