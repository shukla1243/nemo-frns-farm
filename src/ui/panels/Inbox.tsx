import { Icon } from "../Icon";
import { Panel, useG } from "../common";

const TONE_ICON = { good: "check", bad: "skull", epic: "star", info: "spark" } as const;

/** Every notification, newest first, so nothing is missed when toasts scroll by. */
export function InboxPanel({ onClose }: { onClose: () => void }) {
  const { s } = useG();
  return (
    <Panel title="Notifications" icon="board" onClose={onClose}>
      {s.log.length === 0 && <p className="muted">Nothing yet. Your adventures will show up here.</p>}
      <ul className="inbox">
        {s.log.map((l, i) => (
          <li key={`${l.t}-${i}`} className={`inbox-row ${l.tone}`}>
            <Icon id={TONE_ICON[l.tone]} size={20} />
            <span className="grow">{l.text}</span>
            <small className="muted">{new Date(l.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
