import type { Team, TeamInput } from "../../entities/team/model";
import { isImagePath } from "../../shared/lib/validation";
import type { TeamForm } from "./schema";

// Existing responses contain absolute URLs, while uploads return storage suffixes.
export function imageValue(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (isImagePath(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (isImagePath(url.pathname)) return url.pathname;
  } catch {
    /* Validation handles malformed existing values. */
  }
  return trimmed;
}
export function teamToForm(team?: Team): TeamForm {
  if (!team) return { name: "", shortName: "", logoUrl: "", players: [] };
  return {
    name: team.name,
    shortName: team.shortName ?? "",
    logoUrl: imageValue(team.logoUrl),
    players: team.players.map((player) => ({
      key: crypto.randomUUID(),
      firstName: player.firstName,
      lastName: player.lastName,
      shirtNumber: player.shirtNumber == null ? "" : String(player.shirtNumber),
      photoUrl: imageValue(player.photoUrl),
    })),
  };
}
export function teamPayload(tournamentId: string, values: TeamForm): TeamInput {
  return {
    tournamentId,
    name: values.name.trim(),
    shortName: values.shortName.trim() || null,
    logoUrl: imageValue(values.logoUrl) || null,
    players: values.players.map((player) => ({
      firstName: player.firstName.trim(),
      lastName: player.lastName.trim(),
      shirtNumber: player.shirtNumber.trim()
        ? Number(player.shirtNumber)
        : null,
      photoUrl: imageValue(player.photoUrl) || null,
    })),
  };
}
