import { useState } from "react";
import { Gate, type Identity } from "./identity/Gate";
import { Game } from "./Game";
import { createState } from "./engine/state";
import { loadLocal } from "./engine/save";
import { dispatch } from "./engine/actions";
import type { GameState } from "./engine/types";

function randomSeed() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] || 1;
}

export default function App() {
  const [session, setSession] = useState<{ identity: Identity; state: GameState; welcome: string | null; since: number | null } | null>(null);

  if (!session) {
    return <Gate onEnter={identity => {
      const now = Date.now();
      const saved = loadLocal(identity.friendId, identity.guest);
      let state: GameState, welcome: string | null, since: number | null = null;
      if (saved) {
        const away = now - saved.lastTick;
        saved.name = identity.name; saved.guest = identity.guest; saved.family = identity.family;
        state = dispatch(saved, { type: "tick" }, now).state; // applies offline progress
        welcome = null;
        if (away > 120_000) since = saved.lastTick;
      } else {
        state = createState({ friendId: identity.friendId, name: identity.name, family: identity.family, guest: identity.guest, now, seed: randomSeed() });
        welcome = "new";
      }
      setSession({ identity, state, welcome, since });
    }} />;
  }
  return <Game identity={session.identity} initial={session.state} welcome={session.welcome} since={session.since} />;
}
