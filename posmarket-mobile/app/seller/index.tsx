import { Redirect } from 'expo-router';

/** `/seller` → `/seller/dashboard` (comme le redirect du web). */
export default function SellerIndex() {
  return <Redirect href="/seller/dashboard" />;
}
