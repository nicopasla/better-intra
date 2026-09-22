/**
 * A Date for a timestamp from the Intra / intrapy APIs.
 *
 * Those APIs return "YYYY-MM-DDTHH:MM:SS" without a timezone, meaning UTC.
 * Append "Z" only when the string has a time part and no offset, so every
 * card agrees on the day: parsing it bare treats it as local time (off by one
 * day around midnight), while appending "Z" blindly breaks strings that
 * already carry an offset. Date-only strings are already UTC per the
 * ECMAScript date format, so they are left untouched.
 */
export function parseIntraDate(dateStr: string): Date {
  const bare =
    dateStr.includes("T") && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateStr);
  return new Date(bare ? dateStr + "Z" : dateStr);
}
