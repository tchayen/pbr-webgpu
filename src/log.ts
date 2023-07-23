const timeSteps: number[] = [performance.now()];

export function logTime(message: string) {
  const now = performance.now();
  const last = timeSteps[timeSteps.length - 1];
  const delta = now - last;
  timeSteps.push(now);
  console.log(message, `(${delta.toFixed(2)}ms)`);
}
