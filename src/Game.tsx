import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dispatch, type Action, type Result } from "./engine/actions";
import type { GameEvent } from "./engine/types";
import type { ItemId, ZoneId } from "./engine/config";
import { createState } from "./engine/state";
import type { Ready } from "@rarefriends/friendsdk/react";
import type { LoadResult } from "../server/index";
import { World, type WorldApi } from "./world/World";
import type { Station } from "./world/map";
import { Hud, type Toast } from "./ui/Hud";
import { GameContext, systemReducedMotion, type Ctx, type PanelId } from "./ui/common";
import { BagPanel, FarmPanel, HomePanel, ShrinePanel } from "./ui/panels/Life";
import { MarketPanel, PoolPanel, UnlockPanel, WheelPanel } from "./ui/panels/Economy";
import { AbyssPanel, DockPanel, MinesPanel } from "./ui/panels/Games";
import { CrabPanel } from "./ui/panels/Crab";
import { BoardPanel, HarborPanel, ReefPanel } from "./ui/panels/Social";
import { ForgePanel, StoryPanel } from "./ui/panels/Forge";
import { HelpPanel, SettingsPanel } from "./ui/panels/Settings";
import { MapPanel, NpcDialog } from "./ui/panels/Dialog";
import { VoyagePanel } from "./ui/panels/Voyage";
import { PlayHub } from "./ui/panels/PlayHub";
import { InboxPanel } from "./ui/panels/Inbox";
import { ReportPanel } from "./ui/panels/Report";
import { music } from "./game/music";
import { STATIONS, UNLOCK_SIGNS, activeStations, type StationId } from "./world/map";
import { guide as guideFor } from "./world/guide";
import { portrait } from "./game/sprites";
import { sound } from "./game/sound";
import { Fx, type FxKind } from "./ui/Fx";

let toastSeq = 0;

function randomSeed() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] || 1;
}

export function Game({ ready }: { ready: Ready<LoadResult> }) {
  const { game } = ready;
  const art = game.art!;
  const [initial] = useState(() => createState({ friendId: game.friend.id, name: game.friend.label, family: art.familyId, guest: false, now: Date.now(), seed: randomSeed() }));
  const stateRef = useRef(initial);
  const [s, setS] = useState(initial);
  const [now, setNow] = useState(Date.now());
  const [panel, setPanel] = useState<PanelId | null>("story");
  const [near, setNear] = useState<Station | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [fx, setFx] = useState<{ kind: FxKind; id: number } | null>(null);
  const portraitUrl = useMemo(() => portrait(art, 56), [art]);
  const [reducedMotion, setReducedMotion] = useState(systemReducedMotion);
  const worldApi = useRef<WorldApi | null>(null);
  const rmRef = useRef(reducedMotion); rmRef.current = reducedMotion;
  useEffect(() => { document.documentElement.dataset.rm = reducedMotion ? "1" : "0"; }, [reducedMotion]);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef(0);

  const queue = useRef<Toast[]>([]);
  const showNext = useCallback(() => {
    setToasts(cur => {
      if (cur.length >= 3 || !queue.current.length) return cur;
      const t = queue.current.shift()!;
      setTimeout(() => { setToasts(x => x.filter(y => y.id !== t.id)); showNext(); }, t.tone === "epic" ? 4200 : 3000);
      return [...cur, t];
    });
  }, []);
  const pushToast = useCallback((text: string, tone: string, icon?: string) => {
    queue.current.push({ id: ++toastSeq, text, tone, icon });
    if (queue.current.length > 12) queue.current.splice(0, queue.current.length - 12);
    showNext();
  }, [showNext]);

  const onEvents = useCallback((events: GameEvent[]) => {
    for (const e of events) {
      if (!e.quiet) pushToast(e.text, e.tone, e.icon);
      if (e.cue) sound.play(e.cue);
      if (e.fx === "shake") {
        if (!rmRef.current) { setShaking(true); clearTimeout(shakeTimer.current); shakeTimer.current = window.setTimeout(() => setShaking(false), 450); }
      } else if (e.fx && !rmRef.current) setFx({ kind: e.fx, id: ++toastSeq });
    }
  }, [pushToast]);

  const act = useCallback((a: Action): Result => {
    const r = dispatch(stateRef.current, a, Date.now());
    stateRef.current = r.state;
    setS(r.state);
    onEvents(r.events);
    if (r.ok && a.type === "gather" && worldApi.current) {
      const found = r.data?.found as Partial<Record<ItemId, number>>;
      const p = worldApi.current.pos;
      Object.entries(found ?? {}).forEach(([id, n], i) => worldApi.current!.floaters.push({ x: p.x + (i - 0.5) * 34, y: p.y - 70 - i * 18, text: `+${n}`, icon: id, color: "#fff7c2", born: Date.now() + i * 120 }));
    }
    return r;
  }, [onEvents]);

  // Dev-only QA hook (friendsdk dev): open panels and send actions from the browser console or Playwright.
  useEffect(() => {
    if (game.mode !== "dev") return;
    (window as unknown as Record<string, unknown>).__nff = { open: (p: PanelId | null) => setPanel(p), act };
  }, [game.mode, act]);

  // Clock + engine tick.
  useEffect(() => {
    const t = setInterval(() => { act({ type: "tick" }); setNow(Date.now()); }, 1000);
    return () => clearInterval(t);
  }, [act]);

  // Welcome (once).
  const welcomed = useRef(false);
  useEffect(() => {
    if (welcomed.current) return;
    welcomed.current = true;
    pushToast("Welcome to your island! Follow the story to get started.", "epic");
  }, [pushToast]);

  useEffect(() => {
    const hide = () => music.setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);

  // ---------- Interaction ----------
  const openStation = useCallback((st: Station) => {
    sound.unlock();
    music.start();
    if (st.id === "chop" || st.id === "quarry") { act({ type: "gather", kind: st.id === "chop" ? "chop" : "quarry" }); return; }
    setPanel(st.id as PanelId);
  }, [act]);

  const ctx: Ctx = useMemo(() => ({
    s, now, act, open: setPanel, reducedMotion, setReducedMotion,
  }), [s, now, act, reducedMotion]);

  const close = useCallback(() => setPanel(null), []);
  const goTo = useCallback((id: StationId) => {
    const st = [...STATIONS, ...UNLOCK_SIGNS, ...activeStations(stateRef.current.zones)].find(x => x.id === id);
    if (!st) return;
    worldApi.current?.teleport({ x: st.x, y: st.y + 40 });
    // Gathering spots only teleport: the player chops or quarries with the action button, never into the cooldown.
    if (st.id === "chop" || st.id === "quarry") setPanel(null); else openStation(st);
  }, [openStation]);
  const guide = guideFor(s);
  const onGuide = guide.kind === "claim" ? () => { act({ type: "storyClaim" }); } : () => goTo(guide.station.id);
  const [seenAt, setSeenAt] = useState(0);
  const unread = s.log.filter(l => l.t > seenAt).length;
  useEffect(() => {
    if (panel === "inbox") setSeenAt(Date.now());
  }, [panel, s.log.length]);
  useEffect(() => {
    const first = () => { sound.unlock(); music.start(); };
    window.addEventListener("pointerdown", first, { once: true });
    window.addEventListener("keydown", first, { once: true });
    return () => { window.removeEventListener("pointerdown", first); window.removeEventListener("keydown", first); };
  }, []);
  const renderPanel = () => {
    if (!panel) return null;
    if (panel.startsWith("unlock:")) return <UnlockPanel zone={panel.slice(7) as ZoneId} onClose={close} />;
    if (panel.startsWith("npc:")) return <NpcDialog id={panel.slice(4)} onClose={close} />;
    if (panel === "map") return <MapPanel onClose={close} travel={p => worldApi.current?.teleport(p)} pos={() => worldApi.current?.pos ?? { x: 0, y: 0 }} />;
    switch (panel) {
      case "home": return <HomePanel onClose={close} />;
      case "farm": return <FarmPanel onClose={close} />;
      case "bag": return <BagPanel onClose={close} />;
      case "shrine": return <ShrinePanel onClose={close} />;
      case "market": return <MarketPanel onClose={close} />;
      case "pool": return <PoolPanel onClose={close} />;
      case "wheel": return <WheelPanel onClose={close} />;
      case "dock": return <DockPanel onClose={close} />;
      case "crabs": return <CrabPanel onClose={close} />;
      case "mines": return <MinesPanel onClose={close} />;
      case "abyss": return <AbyssPanel onClose={close} />;
      case "forge": return <ForgePanel onClose={close} />;
      case "harbor": return <HarborPanel onClose={close} />;
      case "reef": return <ReefPanel onClose={close} />;
      case "board": return <BoardPanel onClose={close} />;
      case "settings": return <SettingsPanel onClose={close} />;
      case "help": return <HelpPanel onClose={close} />;
      case "story": return <StoryPanel onClose={close} />;
      case "pier": return <VoyagePanel onClose={close} />;
      case "inbox": return <InboxPanel onClose={close} />;
      case "report": return <ReportPanel onClose={close} go={goTo} since={initial.createdAt} />;
      case "play": return <PlayHub onClose={close} go={goTo} />;
      default: return null;
    }
  };

  return (
    <GameContext.Provider value={ctx}>
      <main className={`game ${shaking ? "shake" : ""}`}>
        <World stateRef={stateRef} art={art} blocked={!!panel} reducedMotion={reducedMotion} apiRef={worldApi}
          onNear={setNear} onInteract={openStation} />
        <Hud portraitUrl={portraitUrl} near={near} onAction={() => near && openStation(near)} toasts={toasts} unread={unread} guide={guide} onGuide={onGuide} />
        {renderPanel()}
        {fx && !reducedMotion && <Fx kind={fx.kind} key={fx.id} onDone={() => setFx(null)} />}
      </main>
    </GameContext.Provider>
  );
}
