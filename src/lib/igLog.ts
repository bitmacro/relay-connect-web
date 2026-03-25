/** Single prefix for filtering browser or Next.js terminal logs. */
const P = "[relay-connect]";

export function igLog(...args: unknown[]) {
  console.log(P, ...args);
}

export function igWarn(...args: unknown[]) {
  console.warn(P, ...args);
}

export function igError(...args: unknown[]) {
  console.error(P, ...args);
}
