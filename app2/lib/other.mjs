export function compute(a, b) {
  if (typeof a === "number" && typeof b === "number") {
    return (a + b) * (a - b);
  }

  return NaN;
}
