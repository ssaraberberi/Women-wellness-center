/**
 * The system dialog on phones. In the browser React Native's Alert does
 * nothing, so the web build uses alert.web.tsx: the same API, drawn by the app.
 * This file must stay .tsx: Metro tries every .ts file before any .tsx, so an
 * alert.ts would win over alert.web.tsx and the web would get no dialogs.
 */
export { Alert } from 'react-native';

/** Only the web build draws dialogs itself; on phones there is nothing to mount. */
export const AlertHost = () => null;
