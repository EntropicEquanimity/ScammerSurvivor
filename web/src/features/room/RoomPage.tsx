// Room mode: #room starts a room (eight country chips, Create); #room=ABCDEF is the facilitator
// view: the code big, the join link, the players count, the board as two bar lists, the debrief.
// No input anywhere: the code is shown, the link is selected on tap, never typed or copied by code.
import { useEffect, useRef, useState } from 'react';
import { TELLS, TRICKS } from '../../../../shared/taxonomy.ts';
import type { AgeGroup, TellId, TrickId } from '../../../../shared/types.ts';
import { fetchPacks } from '../../api.ts';
import type { PackSummary } from '../../api.ts';
import { NavBar } from '../../shell/PhoneTools.tsx';
import { haptic } from '../../shell/feel.ts';
import { createRoom, fetchBoard, fetchRoom, joinLink, streamDebrief } from './api.ts';
import type { RoomBoard, RoomInfo } from './api.ts';
import './room.css';

const POLL_MS = 5000;

interface Props {
  country: string | null; // the facilitator's own country, the chip picked first
  age: AgeGroup;
  roomId: string | null; // null opens the start view
}

function useReadyPacks(): PackSummary[] {
  const [packs, setPacks] = useState<PackSummary[]>([]);
  useEffect(() => {
    let current = true;
    fetchPacks().then((list) => current && setPacks(list.filter((pack) => pack.ready)), () => current && setPacks([]));
    return () => {
      current = false;
    };
  }, []);
  return packs;
}

function StartRoom({ country }: { country: string | null }) {
  const packs = useReadyPacks();
  const [picked, setPicked] = useState<string | null>(country);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const chosen = picked && packs.some((pack) => pack.code === picked) ? picked : (packs[0]?.code ?? null);
  const create = () => {
    if (!chosen || busy) return;
    haptic();
    setBusy(true);
    setFailed(false);
    createRoom(chosen).then(
      ({ roomId }) => {
        window.location.hash = `#room=${roomId}`;
      },
      () => {
        setBusy(false);
        setFailed(true);
      },
    );
  };
  return (
    <section className="page settings room">
      <NavBar title="Start a room" back="About" href="#/about" />
      <p className="settings-lead">Everyone plays the same practice day on their own phone. You see who fell for which tell. Nobody is named.</p>
      <div className="room-row" role="radiogroup" aria-labelledby="room-country">
        <p id="room-country" className="room-role">Country pack</p>
        <div className="room-chips">
          {packs.map((pack) => (
            <button
              key={pack.code}
              type="button"
              role="radio"
              aria-checked={pack.code === chosen}
              className="btn room-chip"
              onClick={() => {
                haptic();
                setPicked(pack.code);
              }}
            >
              {pack.name}
            </button>
          ))}
        </div>
      </div>
      <div className="room-actions">
        <button type="button" className="btn btn-primary" disabled={!chosen || busy} onClick={create}>
          {busy ? 'Opening the room' : 'Create the room'}
        </button>
        {failed && <p className="room-honest">The room did not open. Try again.</p>}
      </div>
    </section>
  );
}

// The link selects on tap so the facilitator can copy it with the phone's own menu.
// Rule 4 bans copy and share controls, so nothing here touches the clipboard.
function LinkBlock({ info }: { info: RoomInfo }) {
  const link = joinLink(info);
  const box = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(false);
  const select = () => {
    haptic();
    const selection = window.getSelection();
    if (box.current && selection) {
      selection.selectAllChildren(box.current);
      setSelected(true);
    }
  };
  return (
    <div className="room-row">
      <p className="room-role">Join link</p>
      <code ref={box} className="room-link">{link}</code>
      <button type="button" className="btn room-select" onClick={select}>
        {selected ? 'Selected. Copy it from the menu.' : 'Select the link'}
      </button>
    </div>
  );
}

interface BarRow {
  id: string;
  label: string;
  value: number;
  note: string;
}

function BarList({ title, rows, empty }: { title: string; rows: BarRow[]; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="room-row">
      <p className="room-role">{title}</p>
      {rows.length === 0 ? (
        <p className="room-honest">{empty}</p>
      ) : (
        <ul className="room-bars">
          {rows.map((row) => (
            <li key={row.id}>
              <span className="room-bar-label">{row.label}</span>
              <span className="room-bar-note">{row.note}</span>
              <span className="room-bar-track" aria-hidden="true">
                <span className="room-bar-fill" style={{ width: `${Math.round((row.value / max) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const tellRows = (board: RoomBoard): BarRow[] =>
  (Object.entries(board.byTell) as [TellId, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => ({ id, label: TELLS[id]?.label ?? id, value: n, note: `missed ${n}` }));

const trickRows = (board: RoomBoard): BarRow[] =>
  (Object.entries(board.byTrick) as [TrickId, { caught: number; fell: number }][])
    .sort((a, b) => b[1].fell - a[1].fell)
    .map(([id, row]) => ({
      id,
      label: TRICKS.find((trick) => trick.id === id)?.name ?? id,
      value: row.fell,
      note: `caught ${row.caught}, fell ${row.fell}`,
    }));

function useBoard(roomId: string): { info: RoomInfo | null; board: RoomBoard | null; missing: boolean } {
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [board, setBoard] = useState<RoomBoard | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let current = true;
    const poll = () => {
      fetchRoom(roomId).then((next) => current && setInfo(next), () => current && setMissing(true));
      fetchBoard(roomId).then((next) => current && setBoard(next), () => undefined);
    };
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [roomId]);
  return { info, board, missing };
}

interface DebriefState {
  text: string;
  busy: boolean;
  failed: boolean;
}

function Debrief({ roomId, age, ready }: { roomId: string; age: AgeGroup; ready: boolean }) {
  const [state, setState] = useState<DebriefState>({ text: '', busy: false, failed: false });
  const run = () => {
    if (state.busy) return;
    haptic();
    setState({ text: '', busy: true, failed: false });
    streamDebrief(roomId, age, (chunk) => setState((s) => ({ ...s, text: s.text + chunk }))).then(
      () => setState((s) => ({ ...s, busy: false })),
      () => setState((s) => ({ ...s, busy: false, failed: true })),
    );
  };
  return (
    <div className="room-actions">
      <button type="button" className="btn btn-primary" disabled={!ready || state.busy} onClick={run}>
        {state.busy ? 'Writing the debrief' : 'Write the group debrief'}
      </button>
      {!ready && <p className="room-honest">The debrief needs at least one finished day.</p>}
      {state.failed && <p className="room-honest">The debrief did not arrive. Try again.</p>}
      {state.text && (
        <div className="room-row room-debrief" aria-live="polite">
          <p className="room-role">Group debrief, written by Gemini from the counts above</p>
          <p className="room-debrief-text">{state.text}</p>
        </div>
      )}
    </div>
  );
}

function Facilitator({ roomId, age }: { roomId: string; age: AgeGroup }) {
  const { info, board, missing } = useBoard(roomId);
  const finished = (board?.reports ?? 0) > 0;
  return (
    <section className="page settings room">
      <NavBar title="Your room" back="About" href="#/about" />
      <p className="room-code" aria-label={`Room code ${roomId.split('').join(' ')}`}>{roomId}</p>
      {missing && <p className="settings-lead">This room is not open. Rooms live while the server does; start a new one.</p>}
      {info && <LinkBlock info={info} />}
      <div className="room-row room-counts">
        <p><strong>{info?.players ?? 0}</strong><span>joined</span></p>
        <p><strong>{board?.reports ?? 0}</strong><span>finished</span></p>
        <p><strong>{board ? `${board.rates.caught.handled} of ${board.rates.caught.total}` : '0 of 0'}</strong><span>scams caught</span></p>
        <p><strong>{board ? `${board.rates.trusted.handled} of ${board.rates.trusted.total}` : '0 of 0'}</strong><span>real trusted</span></p>
      </div>
      <BarList title="Tells missed most" rows={board ? tellRows(board) : []} empty={finished ? 'Nothing missed so far.' : 'No day finished yet.'} />
      <BarList title="Tricks, caught against fell" rows={board ? trickRows(board) : []} empty={finished ? 'No scam scored so far.' : 'No day finished yet.'} />
      <Debrief roomId={roomId} age={age} ready={finished} />
    </section>
  );
}

export function RoomPage({ country, age, roomId }: Props) {
  return roomId ? <Facilitator roomId={roomId} age={age} /> : <StartRoom country={country} />;
}
