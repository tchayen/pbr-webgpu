export function alignTo(value: number, multiply: number): number {
  return Math.ceil(value / multiply) * multiply;
}
