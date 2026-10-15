import { createRoot } from "react-dom/client";
import { FriendSession } from "@rarefriends/friendsdk/react";
import type { LoadResult } from "../server/index";

createRoot(document.getElementById("root")!).render(
  <FriendSession<LoadResult> title="NEMO FRNS FARM" loading="Rowing to your island..." closed="This session ended.">
    {(ready, paused) => (
      <main className="stub" data-paused={paused}>
        <h1>NEMO FRNS FARM</h1>
        <p>Friend #{ready.server.friendId}, generation {ready.game.friend.generation}</p>
      </main>
    )}
  </FriendSession>,
);
