import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { messageOf, type Ready } from "@rarefriends/friendsdk/react";
import type { Action } from "./engine/actions";
import type { GameEvent, GameState } from "./engine/types";
import type { ItemId, ZoneId } from "./engine/config";
import type { ActResult, LoadResult, Prefs, PrefsResult, SyncResult } from "../server/index";
import { World, type WorldApi } from "./world/World";
import type { Station } from "./world/map";
import { Hud, type Toast } from "./ui/Hud";
import { GameContext, systemReducedMotion, type ActOutcome, type Ctx, type PanelId, type PrefsPatch } from "./ui/common";
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
import { project } from "./game/projection";
import { STATIONS, UNLOCK_SIGNS, activeStations, type StationId } from "./world/map";
import { guide as guideFor } from "./world/guide";
import { portrait } from "./game/sprites";
import { sound } from "./game/sound";
import { Fx, type FxKind } from "./ui/Fx";

let toastSeq = 0;
/** How often the island is fetched from the server while the game is visible and not paused. */
const SYNC_MS = 20_000;
const TOAST_STEP_MS = 200;
type Shown = Toast & { left: number };

export function Game({ ready, paused }: { ready: Ready<LoadResult>; paused: boolean }) {
  const { game, server: loaded } = ready;
  const art = game.art!;
  // The server's island and the offset of the server clock (ctx.now, which follows the dev clock) from this device.
  const base = useRef<GameState>(loaded.view);
  const offset = useRef(loaded.now - Date.now());
  const clock = useCallback(() => Date.now() + offset.current, []);
  const stateRef = useRef(loaded.view);
  const [s, setS] = useState(loaded.view);
  const [now, setNow] = useState(loaded.now);
  const [panel, setPanel] = useState<PanelId | null>(loaded.welcome === "new" ? "story" : loaded.since ? "report" : null);
  const [near, setNear] = useState<Station | null>(null);
  const [toasts, setToasts] = useState<Shown[]>([]);
  const [fx, setFx] = useState<{ kind: FxKind; id: number } | null>(null);
  const portraitUrl = useMemo(() => portrait(art, 56), [art]);
  const [prefs, setPrefsState] = useState<Prefs>(loaded.prefs);
  const reducedMotion = prefs.reducedMotion ?? systemReducedMotion();
  const worldApi = useRef<WorldApi | null>(null);
  const rmRef = useRef(reducedMotion); rmRef.current = reducedMotion;
  const pausedRef = useRef(paused); pausedRef.current = paused;
  useEffect(() => { document.documentElement.dataset.rm = reducedMotion ? "1" : "0"; }, [reducedMotion]);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef(0);

  // Toasts show three at a time; their time on screen only counts down while the game runs.
  const queue = useRef<Toast[]>([]);
  const fill = useCallback((cur: Shown[]) => {
    const out = [...cur];
    while (out.length < 3 && queue.current.length) { const t = queue.current.shift()!; out.push({ ...t, left: t.tone === "epic" ? 4200 : 3000 }); }
    return out;
  }, []);
  const pushToast = useCallback((text: string, tone: string, icon?: string) => {
    queue.current.push({ id: ++toastSeq, text, tone, icon });
    if (queue.current.length > 12) queue.current.splice(0, queue.current.length - 12);
    setToasts(fill);
  }, [fill]);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setToasts(cur => (cur.length ? fill(cur.map(x => ({ ...x, left: x.left - TOAST_STEP_MS })).filter(x => x.left > 0)) : cur)), TOAST_STEP_MS);
    return () => clearInterval(t);
  }, [paused, fill]);

  const onEvents = useCallback((events: readonly GameEvent[]) => {
    for (const e of events) {
      if (!e.quiet) pushToast(e.text, e.tone, e.icon);
      if (e.cue) sound.play(e.cue);
      if (e.fx === "shake") {
        if (!rmRef.current) { setShaking(true); clearTimeout(shakeTimer.current); shakeTimer.current = window.setTimeout(() => setShaking(false), 450); }
      } else if (e.fx && !rmRef.current) setFx({ kind: e.fx, id: ++toastSeq });
    }
  }, [pushToast]);

  /** Show the projection of the server's island at the current server time. */
  const refresh = useCallback(() => {
    const t = clock();
    stateRef.current = project(base.current, t);
    setS(stateRef.current);
    setNow(t);
  }, [clock]);

  /** Take a fresh island from the server. */
  const receive = useCallback((r: Readonly<{ view: GameState; now: number; events: readonly GameEvent[] }>) => {
    base.current = r.view;
    offset.current = r.now - Date.now();
    refresh();
    onEvents(r.events);
  }, [refresh, onEvents]);

  // Server calls run one at a time, in order, so each answer is the island after every earlier action.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const busy = useRef(0);
  const serial = useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
    busy.current++;
    const next = chain.current.then(run, run).finally(() => { busy.current--; });
    chain.current = next.catch(() => undefined);
    return next;
  }, []);

  const act = useCallback(async (a: Action): Promise<ActOutcome> => {
    try {
      const r = await serial(() => game.call<ActResult>("act", { a }));
      receive(r);
      if (r.ok && a.type === "gather" && worldApi.current) {
        const found = r.data?.found as Partial<Record<ItemId, number>> | undefined;
        const p = worldApi.current.pos;
        Object.entries(found ?? {}).forEach(([id, n], i) => worldApi.current!.floaters.push({ x: p.x + (i - 0.5) * 34, y: p.y - 70 - i * 18, text: `+${n}`, icon: id, color: "#fff7c2", born: clock() + i * 120 }));
      }
      return { ok: r.ok, data: r.data ?? undefined, events: r.events };
    } catch (e) {
      const text = messageOf(e, "The island server did not answer. Try again.");
      pushToast(text, "bad");
      return { ok: false, data: undefined, events: [{ tone: "bad", text }] };
    }
  }, [game, serial, receive, clock, pushToast]);

  const sync = useCallback(() => {
    if (busy.current) return;
    serial(() => game.call<SyncResult>("sync")).then(receive, () => undefined);
  }, [game, serial, receive]);

  const setPrefs = useCallback((patch: PrefsPatch) => {
    const { inboxSeen, ...choices } = patch;
    setPrefsState(p => ({ ...p, ...choices, ...(inboxSeen && { inboxSeenAt: clock() }) }));
    game.call<PrefsResult>("prefs", patch).then(r => setPrefsState(r.prefs), e => pushToast(messageOf(e, "Could not save your settings."), "bad"));
  }, [game, clock, pushToast]);
  useEffect(() => { sound.setMuted(prefs.muted); }, [prefs.muted]);
  useEffect(() => { music.setOn(prefs.music); }, [prefs.music]);

  // Dev-only QA hook (friendsdk dev): open panels, send actions and read the server's island from Playwright.
  useEffect(() => {
    if (game.mode !== "dev") return;
    (window as unknown as Record<string, unknown>).__nff = { open: (p: PanelId | null) => setPanel(p), act, state: () => base.current };
  }, [game.mode, act]);

  // While the host pauses the game or the tab is hidden: no clock, no server polling, no audio.
  useEffect(() => {
    const apply = () => {
      const stopped = pausedRef.current || document.hidden;
      music.setSuspended(stopped);
      sound.setPaused(stopped);
      return stopped;
    };
    if (apply()) return;
    sync();
    const clockTimer = setInterval(refresh, 1000);
    const syncTimer = setInterval(sync, SYNC_MS);
    const vis = () => { if (!apply()) sync(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(clockTimer); clearInterval(syncTimer); document.removeEventListener("visibilitychange", vis); };
  }, [paused, refresh, sync]);

  // What happened while away, and the welcome for a new island (once).
  const welcomed = useRef(false);
  useEffect(() => {
    if (welcomed.current) return;
    welcomed.current = true;
    onEvents(loaded.events);
    if (loaded.welcome === "new") pushToast("Welcome to your island! Follow the story to get started.", "epic");
  }, [loaded, onEvents, pushToast]);

  // ---------- Interaction ----------
  const openStation = useCallback((st: Station) => {
    sound.unlock();
    music.start();
    if (st.id === "chop" || st.id === "quarry") { void act({ type: "gather", kind: st.id === "chop" ? "chop" : "quarry" }); return; }
    setPanel(st.id as PanelId);
  }, [act]);

  const ctx: Ctx = useMemo(() => ({
    s, now, clock, act, open: setPanel, paused, prefs, setPrefs, reducedMotion, setReducedMotion: (v: boolean) => setPrefs({ reducedMotion: v }),
  }), [s, now, clock, act, paused, prefs, setPrefs, reducedMotion]);

  const close = useCallback(() => setPanel(null), []);
  const goTo = useCallback((id: StationId) => {
    const st = [...STATIONS, ...UNLOCK_SIGNS, ...activeStations(stateRef.current.zones)].find(x => x.id === id);
    if (!st) return;
    worldApi.current?.teleport({ x: st.x, y: st.y + 40 });
    // Gathering spots only teleport: the player chops or quarries with the action button, never into the cooldown.
    if (st.id === "chop" || st.id === "quarry") setPanel(null); else openStation(st);
  }, [openStation]);
  const guide = guideFor(s);
  const onGuide = guide.kind === "claim" ? () => { void act({ type: "storyClaim" }); } : () => goTo(guide.station.id);
  const unread = s.log.filter(l => l.t > prefs.inboxSeenAt).length;
  useEffect(() => {
    if (panel === "inbox" && unread > 0) setPrefs({ inboxSeen: true });
  }, [panel, unread, setPrefs]);
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
      case "report": return <ReportPanel onClose={close} go={goTo} since={loaded.since ?? loaded.view.createdAt} />;
      case "play": return <PlayHub onClose={close} go={goTo} />;
      default: return null;
    }
  };

  return (
    <GameContext.Provider value={ctx}>
      <main className={`game ${shaking ? "shake" : ""}`}>
        <World stateRef={stateRef} art={art} clock={clock} blocked={!!panel || paused} paused={paused} reducedMotion={reducedMotion} apiRef={worldApi}
          onNear={setNear} onInteract={openStation} />
        <Hud portraitUrl={portraitUrl} near={near} onAction={() => near && openStation(near)} toasts={toasts} unread={unread} guide={guide} onGuide={onGuide} />
        {renderPanel()}
        {fx && !reducedMotion && <Fx kind={fx.kind} key={fx.id} onDone={() => setFx(null)} />}
      </main>
    </GameContext.Provider>
  );
}
