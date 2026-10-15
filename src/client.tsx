import { createRoot } from "react-dom/client";
import { FriendSession } from "@rarefriends/friendsdk/react";
import type { LoadResult } from "../server/index";
import { installUiFrames } from "./art/ui";
import { Game } from "./Game";
import "./styles.css";

installUiFrames();
createRoot(document.getElementById("root")!).render(
  <FriendSession<LoadResult> title="NEMO FRNS FARM" loading="Rowing to your island..." closed="This session ended."
    check={game => { if (!game.art) throw new Error("The host could not read this Friend's artwork."); }}>
    {(ready, paused) => <Game ready={ready} paused={paused} />}
  </FriendSession>,
);
