export function checkFreeUsage(
  isRegistered: boolean,
  generateCount: number,
  maxFree: number,
) {
  return isRegistered || generateCount < maxFree;
}
