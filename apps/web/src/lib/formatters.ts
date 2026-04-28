export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function shortenText(value: string, max = 44): string {
  if (value.length <= max) return value;
  const head = Math.max(10, Math.floor((max - 3) / 2));
  const tail = Math.max(8, max - head - 3);
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
