export const isArray = Array.isArray; // For symmetry with `isObject`

export const isObject = (x) =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
