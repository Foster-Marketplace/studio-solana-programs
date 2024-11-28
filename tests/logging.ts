export const DEBUG_LOGS = true;

export function log(...args: any[]): void {
  if (DEBUG_LOGS) console.log(...args);
}
