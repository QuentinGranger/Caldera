import assert from 'node:assert/strict';
import { base32 } from '@better-auth/utils/base32';
import { createOTP } from '@better-auth/utils/otp';
import { getAdminAuth } from '../../src/lib/admin/auth';

/** Enroll a fresh HTTP fixture account without bypassing Better Auth. */
export async function enrollAdminFixture(
  password: string,
  passwordSessionCookie: string,
): Promise<string> {
  const auth = getAdminAuth();
  const headers = new Headers({ Cookie: passwordSessionCookie });
  const enrollment = await auth.api.enableTwoFactor({
    body: { password, method: 'totp' },
    headers,
  });
  assert.equal(enrollment.method, 'totp');
  const encodedSecret = new URL(enrollment.totpURI).searchParams.get('secret');
  assert.ok(encodedSecret);
  const code = await createOTP(
    new TextDecoder().decode(base32.decode(encodedSecret)),
  ).totp();
  const verified = await auth.api.verifyTOTP({
    body: { code, trustDevice: false },
    headers,
    returnHeaders: true,
  });
  const session = verified.headers
    .getSetCookie()
    .find((value) => value.startsWith('caldera_admin.session_token='));
  assert.ok(session, 'Cookie de session après MFA absent');
  return session.split(';')[0]!;
}
