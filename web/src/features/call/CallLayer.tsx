import { CallScreen } from './CallScreen.tsx';
import { NoCallView, RingingView } from './CallViews.tsx';
import type { Hotline } from './CallViews.tsx';
import { IncomingBanner, RingPulse } from './IncomingBanner.tsx';
import { transcriptOf } from './ring.ts';
import { Voicemail, VoicemailBanner } from './Voicemail.tsx';
import type { Interrupt } from './useInterrupt.ts';
import './banner.css';

interface Props {
  dayId: string;
  hotline?: Hotline;
  call: Interrupt;
  atDayEnd: boolean; // the day's own screens are done; the call or its absence is the last step
  onNoCall: () => void; // the day had no call at all: Next ends the day
}

// Everything the call puts over the day, in one layer above the open screen. The screen under it
// stays mounted, so after the call or the voicemail the player is exactly where they were.
export function CallLayer({ dayId, hotline, call, atDayEnd, onNoCall }: Props) {
  const { ring, send, voicemailBanner } = call;
  const { start } = ring;
  if (ring.stage === 'none' && atDayEnd && ring.noBeats) {
    return <div className="call-layer"><NoCallView onNext={onNoCall} /></div>;
  }
  if (!start) return null;
  if (ring.stage === 'ringing' && !ring.lock) {
    return (
      <>
        <RingPulse />
        <IncomingBanner caller={start.caller} onAccept={() => send({ type: 'accept' })} onDecline={() => send({ type: 'decline' })} />
      </>
    );
  }
  if (voicemailBanner) return <VoicemailBanner caller={start.caller} onOpen={() => send({ type: 'open' })} />;
  const screen = () => {
    if (ring.stage === 'ringing') return <RingingView caller={start.caller} onAnswer={() => send({ type: 'accept' })} onDecline={() => send({ type: 'decline' })} />;
    if (ring.stage === 'call' && ring.via) return <CallScreen dayId={dayId} start={start} via={ring.via} hotline={hotline} onDone={() => send({ type: 'done' })} />;
    if (ring.stage === 'voicemail') {
      return (
        <Voicemail
          caller={start.caller}
          transcript={transcriptOf(ring)}
          onCallBack={() => send({ type: 'callBack' })}
          onCallKnown={() => send({ type: 'callKnown' })}
        />
      );
    }
    return null;
  };
  const shown = screen();
  return shown && <div className="call-layer">{shown}</div>;
}
