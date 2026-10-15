import type { SlotResult } from '../../../../shared/types.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';
import { HotlineGroup, MessageGroup, TellGroup } from './LessonGroups.tsx';
import './lesson.css';

interface Props {
  result: SlotResult;
  busy: boolean;
  failed: boolean;
  onNext: () => void;
}

// Never shames. The headline names what happened, not what the player did wrong.
function headline(result: SlotResult): string {
  if (!result.isScam) {
    if (result.falseAlarm) return 'That one was real. Blocking it would have cost you.';
    if (!result.actionCorrect) return 'This one was real. Checking first would still have been the safer move.';
    return 'Nothing to find here. This one was real.';
  }
  return result.actionCorrect ? 'You caught it.' : 'Most people would have hesitated here.';
}

// A Settings-style page: the large title, then the real one, the scam with its tells marked in
// place, the tells, the usual ending, the hotline. Next stays pinned at the bottom.
export function Lesson({ result, busy, failed, onNext }: Props) {
  const { lesson } = result;
  const labelOf = Object.fromEntries(lesson.tells.map((tell) => [tell.id, tell.label]));
  const marks = Object.fromEntries(
    lesson.scam.parts.filter((part) => part.tellIds.length > 0).map((part) => [part.id, part.tellIds.map((id) => labelOf[id] ?? id)]),
  );
  const next = () => {
    haptic();
    onNext();
  };
  return (
    <section className="page-full lesson anim-sheet">
      <div className="page-body scroll">
        <ScreenTitle className="large-title">{headline(result)}</ScreenTitle>
        <MessageGroup header="Real" sender={lesson.real.sender} parts={lesson.real.parts} />
        <MessageGroup header="Scam" sender={lesson.scam.sender} parts={lesson.scam.parts} marks={marks} />
        <TellGroup result={result} />
        <InsetGroup header="If you had complied">
          <li className="inset-row inset-body lesson-part">{lesson.usualEnding}</li>
        </InsetGroup>
        <HotlineGroup hotline={lesson.hotline} />
        {failed && (
          <p className="plain-note on-wall" role="alert">
            The day did not finish. Tap Next again.
          </p>
        )}
      </div>
      <div className="page-end">
        <button type="button" className="btn btn-primary pressable" disabled={busy} onClick={next}>
          Next
        </button>
      </div>
    </section>
  );
}
