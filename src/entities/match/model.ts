export type MatchStatus = "CREATED" | "LIVE" | "FINISHED";
export type MatchEventType = "GOAL" | "OWN_GOAL" | "YELLOW_CARD" | "RED_CARD";

export type MatchEvent = {
  id: string;
  matchId: string;
  teamId: string;
  playerId: string | null;
  assistPlayerId?: string | null;
  linkedEventId?: string | null;
  type: MatchEventType;
  minute: number;
  createdAt: string;
  updatedAt: string;
};

export type MatchTeam = {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
};

export type Match = {
  id: string;
  tournamentId: string;
  groupId: string;
  teamId1: string;
  teamId2: string;
  team1?: MatchTeam | null;
  team2?: MatchTeam | null;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  scheduledAt: string;
  liveUrl?: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  events?: MatchEvent[];
};

export type MatchPage = {
  content: Match[];
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  pageSize: number;
  last: boolean;
  first: boolean;
  size: number;
  number: number;
  numberOfElements: number;
  empty: boolean;
};

export type MatchGroup = {
  groupId: string | null;
  groupName: string | null;
  groupOrder: number | null;
  isPlayOff: boolean | null;
  matches: Match[];
};

export type MatchTournament = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  maxTeams: number;
  type: string;
  createdAt: string;
  updatedAt: string;
};

export type MatchGroupsPageResponse = {
  tournament: MatchTournament;
  groups: MatchGroup[];
};

export type MatchGroupsPage = Omit<MatchPage, "content" | "pageNumber" | "pageSize"> & {
  content: MatchGroupsPageResponse[];
};

export type CreateMatchInput = {
  groupId: string;
  teamId1: string;
  teamId2: string;
  scheduledAt: string;
  liveUrl?: string;
};
