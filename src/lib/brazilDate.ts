const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BRAZIL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dayHeadingFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BRAZIL_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const matchDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BRAZIL_TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const getBrazilDayKey = (date: string | Date) => dayKeyFormatter.format(new Date(date));

export const formatBrazilDayHeading = (dayKey: string) => {
  const [year, month, day] = dayKey.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 15, 0, 0));
  return capitalize(dayHeadingFormatter.format(noonUtc));
};

export const formatBrazilMatchDate = (date: string | Date) => {
  const parts = matchDateFormatter.formatToParts(new Date(date));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${capitalize(get("weekday"))}, ${get("day")}/${get("month")} · ${get("hour")}:${get("minute")}`;
};