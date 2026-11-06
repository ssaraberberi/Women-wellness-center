/**
 * The browser has no Keychain: the refresh token lives in localStorage, on
 * this origin only. Signing out (or "Sign out" on another device after a
 * password reset) revokes it on the server either way.
 */
const ls = () => (typeof localStorage === 'undefined' ? null : localStorage);

export const storage = {
  get: async (key: string) => ls()?.getItem(key) ?? null,
  set: async (key: string, value: string) => ls()?.setItem(key, value),
  remove: async (key: string) => ls()?.removeItem(key),
};
