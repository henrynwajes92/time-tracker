export function formatDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Convert a UTC ISO string to a datetime-local input value in the given timezone */
export function toLocalInputValue(iso: string, timezone: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hh = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hh}:${get("minute")}`;
}

/** Convert a datetime-local input value (in timezone) back to UTC ISO */
export function fromLocalInputValue(localValue: string, timezone: string): string {
  // Build a UTC date by treating the localValue as being in `timezone`
  const [datePart, timePart] = localValue.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);

  // Use Intl to figure out the UTC offset at this local time in the given timezone
  const approx = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const localParts = formatter.formatToParts(approx);
  const get = (type: string) => Number(localParts.find((p) => p.type === type)?.value ?? 0);
  const localHour = get("hour") === 24 ? 0 : get("hour");

  const diffMs =
    Date.UTC(year, month - 1, day, hour, minute) -
    Date.UTC(get("year"), get("month") - 1, get("day"), localHour, get("minute"));

  return new Date(approx.getTime() + diffMs).toISOString();
}
