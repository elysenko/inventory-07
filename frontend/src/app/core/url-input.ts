/**
 * Transform for router-bound component inputs.
 *
 * `withComponentInputBinding()` pushes `undefined` for a route or query
 * parameter that is absent — which overrides the input's declared default and
 * blows up any `.trim()` downstream. Normalising to an empty string here keeps
 * every deep link (with or without the parameter) rendering the same screen.
 */
export const urlParam = (value: string | null | undefined): string => value ?? '';
