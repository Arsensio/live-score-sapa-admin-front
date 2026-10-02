import { imageSrc } from "../../shared/api/images";
import { ApiError } from "../../shared/api/client";
import { ErrorNotice } from "../../shared/ui";
import { Link } from "react-router-dom";
import { awardError } from "../../entities/player-award/api";

export function AwardPlayer({ player }: { player: { firstName: string; lastName: string; shirtNumber: number | null; photoUrl: string | null } }) {
  return <span className="award-player">
    <span className="award-photo">
      <span aria-hidden="true">{player.firstName.slice(0, 1)}{player.lastName.slice(0, 1)}</span>
      {player.photoUrl && <img key={player.photoUrl} src={imageSrc(player.photoUrl)} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
    </span>
    <span>{player.shirtNumber != null && `№${player.shirtNumber} `}{player.firstName} {player.lastName}</span>
  </span>;
}

export function AwardError({ error, retry }: { error: unknown; retry?: () => void }) {
  return <><ErrorNotice error={awardError(error)} retry={retry} />
    {error instanceof ApiError && error.status === 401 && <Link className="button secondary" to="/login">Войти</Link>}
  </>;
}
