/** The API's rule: at least 8 characters, with a letter and a digit. */
export const strongPassword = (p: string) => p.length >= 8 && p.length <= 128 && /[A-Za-z]/.test(p) && /\d/.test(p);
