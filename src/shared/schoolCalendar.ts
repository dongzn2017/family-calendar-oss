import { HOUSEHOLD } from "./household";

export interface SchoolWeekInfo {
  isVacation: boolean;
  vacationName: string;
  weekType: "A" | "B" | null;
}

function getMondayIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const offset = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - offset);
  return dt.toISOString().slice(0, 10);
}

export function getSchoolWeekInfo(iso: string): SchoolWeekInfo {
  for (const v of HOUSEHOLD.vacations) {
    if (iso >= v.start && iso <= v.end) {
      return { isVacation: true, vacationName: v.name, weekType: null };
    }
  }
  const mon = getMondayIso(iso);
  const anchorMs = Date.parse("2026-11-23T00:00:00Z");
  const curMs = Date.parse(`${mon}T00:00:00Z`);
  const diffWeeks = Math.round((curMs - anchorMs) / (7 * 86_400_000));
  const weekType = Math.abs(diffWeeks) % 2 === 0 ? "A" : "B";
  return { isVacation: false, vacationName: "", weekType };
}
