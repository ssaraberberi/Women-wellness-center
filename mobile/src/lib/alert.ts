/**
 * The system dialog on phones. In the browser React Native's Alert does
 * nothing, so the web build uses alert.web.tsx: the same API, drawn by the app.
 */
export { Alert } from 'react-native';

/** Only the web build draws dialogs itself; on phones there is nothing to mount. */
export const AlertHost = () => null;
