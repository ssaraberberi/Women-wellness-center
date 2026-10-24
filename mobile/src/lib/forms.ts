import type { FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * react-hook-form ⇄ zod, without @hookform/resolvers (its peer dependencies
 * do not resolve on this SDK). Messages are translation keys.
 */
export function zodResolver<S extends z.ZodType<FieldValues, FieldValues>>(schema: S): Resolver<z.input<S> & FieldValues, unknown, z.output<S>> {
  return (async (values: unknown) => {
    const r = schema.safeParse(values);
    if (r.success) return { values: r.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of r.error.issues) {
      const key = issue.path.join('.');
      errors[key] ??= { type: issue.code, message: issue.message };
    }
    return { values: {}, errors };
  }) as unknown as Resolver<z.input<S> & FieldValues, unknown, z.output<S>>;
}
