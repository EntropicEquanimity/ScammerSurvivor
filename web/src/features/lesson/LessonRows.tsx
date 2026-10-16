import type { ReactNode } from 'react';
import type { SlotResult, TellId } from '../../../../shared/types.ts';
import { TELLS } from '../../../../shared/taxonomy.ts';
import { flagsOf, secondPerson } from './title.ts';
import { Icon } from '../../shell/Icon.tsx';
import type { IconName } from '../../shell/Icon.tsx';
import { haptic } from '../../shell/feel.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';

// The short rows under what made it suspicious: what the player flagged, what would have happened,
// the one move for next time, and where to report it. Each is one inset row with a small leading glyph, so the lesson reads top to bottom in a glance.

type Lesson = SlotResult['lesson'];

function GlyphRow({ glyph, children, className }: { glyph: IconName; children: ReactNode; className?: string }) {
  return (
    <li className={`inset-row inset-body lesson-glyph-row${className ? ` ${className}` : ''}`}>
      <span className="lesson-glyph" aria-hidden="true"><Icon name={glyph} /></span>
      <span className="lesson-glyph-text">{children}</span>
    </li>
  );
}

// What would have happened, in the second person, and the one move for next time. The real note
// shows only Next time, so the two are apart.
export function WouldHaveHappened({ lesson }: { lesson: Lesson }) {
  return (
    <InsetGroup header="What would have happened">
      <GlyphRow glyph="wallet">{secondPerson(lesson.usualEnding)}</GlyphRow>
    </InsetGroup>
  );
}

export function NextTime({ lesson }: { lesson: Lesson }) {
  return (
    <InsetGroup header="Next time">
      <GlyphRow glyph="privacy" className="lesson-strong">{secondPerson(lesson.neverAsks)}</GlyphRow>
    </InsetGroup>
  );
}

const labelOf = (lesson: Lesson, id: TellId): string => lesson.tells.find((tell) => tell.id === id)?.label ?? TELLS[id].label;

// What the player marked in the tell picker: each mark as caught (a tell) or not a tell, then the
// tells left unmarked. A mark carries a word as well as its glyph, so colour is never the only carrier.
export function FlaggedGroup({ result }: { result: SlotResult }) {
  const { flagged, missed } = flagsOf(result);
  const { lesson } = result;
  return (
    <InsetGroup header="What you flagged">
      {flagged.length === 0 && <li className="inset-row inset-body lesson-why">You didn't flag anything.</li>}
      {flagged.map((flag) => (
        <li key={flag.partId} className={`inset-row inset-body lesson-flag lesson-flag-${flag.tells.length > 0 ? 'good' : 'slip'}`}>
          <span className="lesson-flag-mark" aria-hidden="true">{flag.tells.length > 0 ? '✓' : '✗'}</span>
          <span className="lesson-glyph-text">
            {flag.quote && <q className="lesson-quote">{flag.quote}</q>}
            <span className="lesson-flag-word">{flag.tells.length > 0 ? `Caught: ${flag.tells.map((id) => labelOf(lesson, id).toLowerCase()).join(', ')}` : 'Not a tell'}</span>
          </span>
        </li>
      ))}
      {missed.length > 0 && (
        <li className="inset-row inset-body lesson-flag lesson-flag-missed">
          <span className="lesson-flag-mark" aria-hidden="true">{'•'}</span>
          <span className="lesson-glyph-text">You missed: {missed.map((id) => labelOf(lesson, id).toLowerCase()).join(', ')}.</span>
        </li>
      )}
    </InsetGroup>
  );
}

// The pack's hotline: the name and the number, or the name as a link to the reporting page when the
// pack has no number. Nothing shows when the pack has neither, so no row ever ends on an empty "on".
export function ReportIt({ hotline }: { hotline: Lesson['hotline'] | undefined }) {
  const label = hotline?.label.trim() ?? '';
  const number = hotline?.number.trim() ?? '';
  const url = hotline?.reportUrl.trim() ?? '';
  if (!label || (!number && !url)) return null;
  return (
    <InsetGroup header="Report it">
      {number ? (
        <li className="inset-row inset-body lesson-glyph-row lesson-value">
          <span className="lesson-glyph" aria-hidden="true"><Icon name="call" /></span>
          <span className="lesson-glyph-text">{label}</span>
          <span className="lesson-detail">{number}</span>
        </li>
      ) : (
        <li>
          {/* The one real link in the exercise: the country's official reporting page. */}
          <a className="inset-row lesson-glyph-row lesson-link pressable" href={url} target="_blank" rel="noopener noreferrer" onClick={() => haptic()}>
            <span className="lesson-glyph" aria-hidden="true"><Icon name="call" /></span>
            <span className="lesson-glyph-text">{label}</span>
            <span className="inset-chevron" aria-hidden="true"><Icon name="chevron" /></span>
          </a>
        </li>
      )}
    </InsetGroup>
  );
}
