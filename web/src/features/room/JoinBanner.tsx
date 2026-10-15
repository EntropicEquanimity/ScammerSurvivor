// One line above the day when this phone joined a room: the code, and a way out.
import { useState } from 'react';
import { haptic } from '../../shell/feel.ts';
import { clearRoom, getRoom } from './api.ts';
import './room.css';

export function JoinBanner() {
  const [roomId, setRoomId] = useState<string | null>(getRoom);
  if (!roomId) return null;
  const leave = () => {
    haptic();
    clearRoom();
    setRoomId(null);
  };
  return (
    <div className="join-banner" role="status">
      <p>Playing in room <span className="join-code">{roomId}</span></p>
      <button type="button" className="btn btn-quiet join-leave" onClick={leave}>Leave</button>
    </div>
  );
}
