/**
 * Single-file household customization!
 * Edit the names, shift presets, and vacation windows below for your own family.
 */
export const HOUSEHOLD = {
  appName: "FamilyCalendar",
  subtitle: "Alex & Maya · Demo Household",
  timezone: "Europe/Paris",

  // Partner A: regular / hybrid / travel schedule
  partnerA: {
    id: "partner_a",
    name: "Alex",
    shortPrefix: "A",
  },

  // Partner B: irregular shift schedule with variable work hours
  partnerB: {
    id: "partner_b",
    name: "Maya",
    shortPrefix: "M",
    shiftPresets: ["08:30-16:30", "09:45-17:45", "10:00-18:00", "11:45-19:45", "12:00-20:00"],
  },

  // Child A: middle school / A-B week timetable
  childA: {
    id: "child_a",
    name: "Noah",
    timetableLabel: "Noah 固定课表",
  },

  // Child B: primary school / strike alerts
  childB: {
    id: "child_b",
    name: "Emma",
    schoolLabel: "Emma 学校状态",
  },

  // Default school year end date for batch recurring events
  defaultTermEndDate: "2027-07-02",

  // Example school vacation windows (French Zone C 2026-2027 — replace with your own region)
  vacations: [
    { start: "2026-10-17", end: "2026-11-01", name: "Autumn Break / Toussaint" },
    { start: "2026-12-19", end: "2027-01-03", name: "Winter Holidays / Noël" },
    { start: "2027-02-13", end: "2027-02-28", name: "February Break / Hiver" },
    { start: "2027-04-10", end: "2027-04-25", name: "Spring Break / Printemps" },
    { start: "2027-07-03", end: "2027-08-31", name: "Summer Holidays / Été" },
  ],
};
