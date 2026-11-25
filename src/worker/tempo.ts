import type { TempoColor } from "../shared/types";

interface TempoApiResponse {
  dateJour?: string;
  codeJour?: number;
  libCouleur?: string;
}

function mapCodeJour(code?: number): TempoColor {
  if (code === 1) return "BLEU";
  if (code === 2) return "BLANC";
  if (code === 3) return "ROUGE";
  return "UNKNOWN";
}

export interface TempoSyncResult {
  updated: Array<{ date: string; color: TempoColor }>;
  errors: string[];
}

export async function syncEdfTempo(db: D1Database): Promise<TempoSyncResult> {
  const endpoints = [
    "https://www.api-couleur-tempo.fr/api/jourTempo/today",
    "https://www.api-couleur-tempo.fr/api/jourTempo/tomorrow",
  ];

  const updated: Array<{ date: string; color: TempoColor }> = [];
  const errors: string[] = [];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "FamilyCalendar-OSS/1.0" },
      });
      if (!res.ok) {
        errors.push(`${url} -> HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as TempoApiResponse;
      const color = mapCodeJour(data.codeJour);
      if (!data.dateJour || color === "UNKNOWN") continue;

      await db
        .prepare(
          `INSERT INTO daily_status (date, tempo_color, tempo_source, updated_at)
           VALUES (?, ?, 'auto', datetime('now'))
           ON CONFLICT(date) DO UPDATE SET
             tempo_color = excluded.tempo_color,
             tempo_source = 'auto',
             updated_at = datetime('now')`
        )
        .bind(data.dateJour, color)
        .run();

      updated.push({ date: data.dateJour, color });
    } catch (err) {
      errors.push(`${url} -> ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { updated, errors };
}
