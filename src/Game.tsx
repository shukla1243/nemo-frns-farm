import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dispatch, type Action, type Result } from "./engine/actions";
import type { GameEvent, GameState } from "./engine/types";
import { AUTOSAVE_MS, type ItemId, type ZoneId } from "./engine/config";
import { exportSave, importSave, migrate, saveLocal } from "./engine/save";
import { World, type WorldApi } from "./world/World";
import type { Station } from "./world/map";
import { Hud, type Toast } from "./ui/Hud";
import { GameContext, type Ctx, type PanelId } from "./ui/common";
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
import { guideTarget } from "./world/guide";
import { useNet } from "./net/useNet";
import { CloudSave, cachedCloudKey, deriveCloudKey } from "./net/cloudsave";
import { loadSprites, portrait, type GenerationSprites } from "./game/sprites";
import { sound } from "./game/sound";
import type { Identity } from "./identity/Gate";
import { Fx, type FxKind } from "./ui/Fx";

let toastSeq = 0;

export function Game({ identity, initial, welcome, since }: { identity: Identity; initial: GameState; welcome: string | null; since: number | null }) {
  const stateRef = useRef(initial);
  const [s, setS] = useState(initial);
  const [now, setNow] = useState(Date.now());
  const [panel, setPanel] = useState<PanelId | null>(welcome === "new" ? "story" : since ? "report" : null);
  const [near, setNear] = useState<Station | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [fx, setFx] = useState<{ kind: FxKind; id: number } | null>(null);
  const spritesRef = useRef<GenerationSprites | null>(null);
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [reducedMotion, setReducedMotionState] = useState(() => {
    try { const v = localStorage.getItem("nemo-frns-farm:rm"); if (v !== null) return v === "1"; } catch { /* ignore */ }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const setReducedMotion = (v: boolean) => { setReducedMotionState(v); try { localStorage.setItem("nemo-frns-farm:rm", v ? "1" : "0"); } catch { /* ignore */ } };
  const worldApi = useRef<WorldApi | null>(null);
  const outboxRef = useRef<(o: Result["outbox"]) => void>(() => {});
  const bragRef = useRef<(t: string) => void>(() => {});
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
      pushToast(e.text, e.tone, e.icon);
      if (e.cue) sound.play(e.cue);
      if (e.fx === "shake") {
        if (!rmRef.current) { setShaking(true); clearTimeout(shakeTimer.current); shakeTimer.current = window.setTimeout(() => setShaking(false), 450); }
      } else if (e.fx && !rmRef.current) setFx({ kind: e.fx, id: ++toastSeq });
      if (e.fx === "levelup" || e.fx === "jackpot") bragRef.current(e.text.replace(/^[^\w]+/, "").slice(0, 110));
    }
  }, [pushToast]);

  const act = useCallback((a: Action): Result => {
    const r = dispatch(stateRef.current, a, Date.now());
    stateRef.current = r.state;
    setS(r.state);
    onEvents(r.events);
    if (r.outbox.length) outboxRef.current(r.outbox);
    if (r.ok && a.type === "gather" && worldApi.current) {
      const found = r.data?.found as Partial<Record<ItemId, number>>;
      const p = worldApi.current.pos;
      Object.entries(found ?? {}).forEach(([id, n], i) => worldApi.current!.floaters.push({ x: p.x + (i - 0.5) * 34, y: p.y - 70 - i * 18, text: `+${n}`, icon: id, color: "#fff7c2", born: Date.now() + i * 120 }));
    }
    return r;
  }, [onEvents]);

  const { net, peersRef, handleOutbox, brag, sendPos, emote, publishProfile } = useNet(identity, stateRef, act);
  outboxRef.current = handleOutbox;
  bragRef.current = brag;

  // Dev-only QA hook (stripped from production builds): open panels and grant resources for screenshots.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__nff = {
      open: (p: PanelId | null) => setPanel(p),
      act,
      grant: () => {
        const next = structuredClone(stateRef.current);
        for (const z of Object.keys(next.zones)) next.zones[z as ZoneId] = true;
        next.rf += 50_000; next.shell += 50_000; next.level = 12; next.home = 2;
        for (const k of Object.keys(next.inv)) next.inv[k as ItemId] += 30;
        stateRef.current = next; setS(next);
      },
    };
  }, [act]);

  // Clock + engine tick.
  useEffect(() => {
    const t = setInterval(() => { act({ type: "tick" }); setNow(Date.now()); }, 1000);
    return () => clearInterval(t);
  }, [act]);

  // Friend artwork.
  useEffect(() => {
    let live = true;
    loadSprites(identity.friendId).then(sp => { if (live) { spritesRef.current = sp; setPortraitUrl(portrait(sp, 56)); } }).catch(() => pushToast("Couldn't load your Friend's artwork. It will retry soon.", "bad"));
    return () => { live = false; };
  }, [identity.friendId, pushToast]);

  // Welcome back / offline summary (once, even under StrictMode double effects).
  const welcomed = useRef(false);
  useEffect(() => {
    if (welcomed.current) return;
    welcomed.current = true;
    if (welcome && welcome !== "new") pushToast(welcome, "info");
    if (welcome === "new") pushToast("Welcome to your island! Follow the story to get started.", "epic");
  }, [welcome, pushToast]);

  // ---------- Saves ----------
  const cloudRef = useRef<CloudSave | null>(null);
  const [cloud, setCloud] = useState<Ctx["cloud"]["status"]>("off");
  const [cloudMsg, setCloudMsg] = useState("");
  const replaceState = useCallback((code: string): string | null => {
    try {
      const next = migrate(importSave(code, stateRef.current.friendId));
      next.guest = identity.guest;
      const r = dispatch(next, { type: "tick" }, Date.now());
      stateRef.current = r.state; setS(r.state); saveLocal(r.state);
      return null;
    } catch (e) { return e instanceof Error ? e.message : "Could not restore."; }
  }, [identity.guest]);

  const cloudPush = useCallback(async () => {
    const c = cloudRef.current; if (!c) return;
    const snap = { ...stateRef.current, log: stateRef.current.log.slice(0, 10) };
    const ok = await c.push(snap.friendId, exportSave(snap), snap.lastActive);
    setCloud(ok ? "on" : "error"); setCloudMsg(ok ? `synced ${new Date().toLocaleTimeString()}` : "relays unreachable");
  }, []);
  const cloudPull = useCallback(async () => {
    const c = cloudRef.current; if (!c) return;
    setCloud("syncing");
    try {
      const got = await c.pull(stateRef.current.friendId);
      if (got && got.lastTick > stateRef.current.lastActive + 5000) {
        const err = replaceState(got.code);
        setCloudMsg(err ?? "loaded newer cloud save"); if (!err) pushToast("Loaded your newer cloud save.", "good");
      } else setCloudMsg("this device is up to date");
      setCloud("on");
    } catch { setCloud("error"); setCloudMsg("could not reach relays"); }
  }, [pushToast, replaceState]);
  const enableCloud = useCallback(async (silent = false) => {
    if (identity.guest || !identity.account) return;
    try {
      let key = cachedCloudKey(identity.account);
      if (!key) {
        if (silent || !identity.provider) return;
        setCloud("syncing"); setCloudMsg("sign the message in your wallet…");
        key = await deriveCloudKey(identity.provider, identity.account);
      }
      cloudRef.current?.close();
      cloudRef.current = new CloudSave(key);
      await cloudPull();
      await cloudPush();
    } catch (e) {
      setCloud("error"); setCloudMsg(e instanceof Error ? e.message.slice(0, 80) : "signature declined");
    }
  }, [identity, cloudPull, cloudPush]);

  useEffect(() => { void enableCloud(true); return () => cloudRef.current?.close(); }, [enableCloud]);
  useEffect(() => {
    const save = () => { saveLocal(stateRef.current); };
    const t = setInterval(save, AUTOSAVE_MS);
    const t2 = setInterval(() => { void cloudPush(); }, 60_000);
    const hide = () => { if (document.visibilityState === "hidden") { save(); void cloudPush(); publishProfile(); } };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", hide);
    return () => { clearInterval(t); clearInterval(t2); window.removeEventListener("pagehide", save); document.removeEventListener("visibilitychange", hide); save(); };
  }, [cloudPush, publishProfile]);

  // ---------- Interaction ----------
  const openStation = useCallback((st: Station) => {
    sound.unlock();
    music.start();
    if (st.id === "chop" || st.id === "quarry") { act({ type: "gather", kind: st.id === "chop" ? "chop" : "quarry" }); return; }
    setPanel(st.id as PanelId);
  }, [act]);

  const ctx: Ctx = useMemo(() => ({
    s, now, act, open: setPanel, net, identity, brag, reducedMotion, setReducedMotion,
    cloud: { status: cloud, message: cloudMsg, enable: () => enableCloud(false), pull: cloudPull },
  }), [s, now, act, net, identity, brag, reducedMotion, cloud, cloudMsg, enableCloud, cloudPull]);

  const close = useCallback(() => setPanel(null), []);
  const goTo = useCallback((id: StationId) => {
    const st = [...STATIONS, ...UNLOCK_SIGNS, ...activeStations(stateRef.current.zones)].find(x => x.id === id);
    if (!st) return;
    worldApi.current?.teleport({ x: st.x, y: st.y + 40 });
    openStation(st);
  }, [openStation]);
  const guide = s.voyage ? null : guideTarget(s);
  const [seenAt, setSeenAt] = useState(() => { try { return Number(localStorage.getItem("nemo-frns-farm:inbox-seen")) || 0; } catch { return 0; } });
  const unread = s.log.filter(l => l.t > seenAt).length;
  useEffect(() => {
    if (panel !== "inbox") return;
    const t = Date.now();
    setSeenAt(t);
    try { localStorage.setItem("nemo-frns-farm:inbox-seen", String(t)); } catch { /* ignore */ }
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
      case "settings": return <SettingsPanel onClose={close} onReplace={replaceState} />;
      case "help": return <HelpPanel onClose={close} />;
      case "story": return <StoryPanel onClose={close} />;
      case "pier": return <VoyagePanel onClose={close} />;
      case "inbox": return <InboxPanel onClose={close} />;
      case "report": return <ReportPanel onClose={close} go={goTo} since={since ?? Date.now()} />;
      case "play": return <PlayHub onClose={close} go={goTo} />;
      default: return null;
    }
  };

  return (
    <GameContext.Provider value={ctx}>
      <main className={`game ${shaking ? "shake" : ""}`}>
        <World stateRef={stateRef} spritesRef={spritesRef} peersRef={peersRef} blocked={!!panel} reducedMotion={reducedMotion} apiRef={worldApi}
          onNear={setNear} onInteract={openStation} onMove={(p, f) => sendPos(p.x, p.y, f)} />
        <Hud portraitUrl={portraitUrl} near={near} onAction={() => near && openStation(near)} toasts={toasts} unread={unread} onGuide={guide ? () => goTo(guide.id) : null}
          onEmote={e => { emote(e); const p = worldApi.current?.pos; if (p) worldApi.current!.floaters.push({ x: p.x, y: p.y - 95, text: e, color: "#fff", born: Date.now() }); }} />
        {renderPanel()}
        {fx && !reducedMotion && <Fx kind={fx.kind} key={fx.id} onDone={() => setFx(null)} />}
      </main>
    </GameContext.Provider>
  );
}
