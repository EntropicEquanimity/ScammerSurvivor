import type { CSSProperties } from 'react';
import type { Layout } from '../../../shared/types.ts';
import { AppIcon } from '../features/day/AppIcon.tsx';
import { appLookFor } from '../features/day/appNames.ts';
import { NavBar } from './PhoneTools.tsx';
import { haptic } from './feel.ts';
import '../features/day.css';
import '../features/card/card.css';
import './empty-app.css';

const LAYOUTS: readonly Layout[] = ['green-chat', 'blue-chat', 'sticker-chat', 'cloud-chat', 'purple-chat', 'sms', 'email', 'wallet', 'call'];

export const isLayout = (value: string): value is Layout => (LAYOUTS as readonly string[]).includes(value);

// What an app holds before the day starts, in that app's own words.
const EMPTY_LINE: Partial<Record<Layout, string>> = {
  call: 'No recent calls',
  email: 'No mail yet',
  wallet: 'No activity yet',
};

// A home tile opens its app, as on the phone. Before a day starts the app is empty: its name as the
// large title, its icon, one quiet line, and Play, which starts the day in which messages land here.
// ponytail: the day screen has no "open this app" entry yet, so a tap during a day cannot jump to that
// app's unopened slot; DayScreen would need an openLayout prop for that.
export function EmptyApp({ layout, onPlay }: { layout: Layout; onPlay: () => void }) {
  const look = appLookFor(layout);
  const play = () => {
    haptic();
    onPlay();
  };
  return (
    <section className="app empty-app anim-zoom" data-look={layout} style={{ '--app-colour': look.colour } as CSSProperties}>
      <div className="app-body scroll">
        <NavBar title={look.name} />
        <div className="empty-app-state">
          <AppIcon layout={layout} size={64} />
          <p className="empty-app-title">{EMPTY_LINE[layout] ?? 'No messages yet'}</p>
          <p className="empty-app-line">They arrive here during your practice day.</p>
        </div>
      </div>
      <div className="page-end">
        <button type="button" className="btn btn-primary pressable" onClick={play}>Play</button>
      </div>
    </section>
  );
}
