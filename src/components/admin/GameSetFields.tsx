'use client';
import { useId, useState } from 'react';
type GameOption = { id: string; name: string; isActive: boolean };
type SetOption = GameOption & { gameId: string | null };
export function GameSetFields({
  games,
  sets,
  tcgSetId = '',
  gameId = '',
}: {
  games: GameOption[];
  sets: SetOption[];
  tcgSetId?: string;
  gameId?: string;
}) {
  const [setValue, setSetValue] = useState(tcgSetId);
  const [gameValue, setGameValue] = useState(gameId);
  const hintId = useId();
  const gameNames = new Map(games.map((game) => [game.id, game.name]));
  // The server forces the game of the set; the form shows it instead of letting it diverge.
  const imposed = sets.find((set) => set.id === setValue)?.gameId ?? null;
  return (
    <>
      <label>
        Extension
        <select
          name="tcgSetId"
          value={setValue}
          onChange={(event) => setSetValue(event.target.value)}
        >
          <option value="">Aucune extension</option>
          {sets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
              {set.gameId && gameNames.has(set.gameId)
                ? ` · ${gameNames.get(set.gameId)}`
                : ''}
              {!set.isActive ? ' (inactive)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        Jeu
        <select
          name={imposed ? undefined : 'gameId'}
          value={imposed ?? gameValue}
          disabled={Boolean(imposed)}
          aria-describedby={hintId}
          onChange={(event) => setGameValue(event.target.value)}
        >
          <option value="">Aucun jeu (produit multi-jeux)</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
              {!game.isActive ? ' (inactif)' : ''}
            </option>
          ))}
        </select>
        <small id={hintId}>
          {imposed
            ? `Imposé par l’extension : ${gameNames.get(imposed) ?? 'jeu inconnu'}.`
            : 'Sans jeu, le produit reste hors des pages de jeu (accessoire générique).'}
        </small>
      </label>
      {imposed && <input type="hidden" name="gameId" value={imposed} />}
    </>
  );
}
