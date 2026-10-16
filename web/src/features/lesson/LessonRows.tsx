import type { ReactNode } from 'react';
import type { SlotResult } from '../../../../shared/types.ts';
import { Icon } from '../../shell/Icon.tsx';
import type { IconName } from '../../shell/Icon.tsx';
import { haptic } from '../../shell/feel.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';

// The short rows under the stamped scam: what happens next, the one move for next time, and where to
// report it. Each is one inset row with a small leading glyph, so the lesson reads top to bottom in a glance.

type Lesson = SlotResult['lesson'];

// One sentence under the title on what the player did. Read from the scored result alone.
export function didLine(result: SlotResult): string {
  if ((result.leaked ?? []).length > 0) return 'You sent your details to a fake page.';
  if (result.actionCorrect) return 'You did not give it what it asked for.';
  if ((result.recovered ?? 0) > 0) return 'You went along with it, then acted fast.';
  return 'You did what the message wanted.';
}

function GlyphRow({ glyph, children, className }: { glyph: IconName; children: ReactNode; className?: string }) {
  return (
    <li className={`inset-row inset-body lesson-glyph-row${className ? ` ${className}` : ''}`}>
      <span className="lesson-glyph" aria-hidden="true"><Icon name={glyph} /></span>
      <span className="lesson-glyph-text">{children}</span>
    </li>
  );
}

export function NextSteps({ lesson }: { lesson: Lesson }) {
  return (
    <>
      <InsetGroup header="What happens next">
        <GlyphRow glyph="wallet">{lesson.usualEnding}</GlyphRow>
      </InsetGroup>
      <InsetGroup header="Next time">
        <GlyphRow glyph="privacy" className="lesson-strong">{lesson.neverAsks}</GlyphRow>
      </InsetGroup>
    </>
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
