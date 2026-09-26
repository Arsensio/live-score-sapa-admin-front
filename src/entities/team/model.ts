export type PlayerInput = {
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  photoUrl: string | null;
};
export type TeamInput = {
  tournamentId: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  players: PlayerInput[];
};
export type Player = PlayerInput & {
  id: string;
  teamId: string;
  createdAt?: string;
  updatedAt?: string;
};
export type Team = Omit<TeamInput, "players"> & {
  id: string;
  players: Player[];
  createdAt?: string;
  updatedAt?: string;
};
