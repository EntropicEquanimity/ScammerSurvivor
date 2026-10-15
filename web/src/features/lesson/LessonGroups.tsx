import type { SlotResult } from '../../../../shared/types.ts';
import { Icon } from '../../shell/Icon.tsx';
import { haptic } from '../../shell/feel.ts';
import { InsetGroup } from '../layouts/InsetGroup.tsx';
import { PartView } from '../layouts/MessageView.tsx';
import type { Part } from '../layouts/MessageView.tsx';

type Sender = SlotResult['lesson']['real']['sender'];

interface MessageGroupProps {
  header: string;
  sender: Sender;
  parts: Part[];
  marks?: Record<string, string[]>;
}

// One message as a group: the sender row, then each part as a row, tells marked in place.
export function MessageGroup({ header, sender, parts, marks = {} }: MessageGroupProps) {
  return (
    <InsetGroup header={header}>
      <li className="inset-row inset-body lesson-sender">
        <strong>{sender.displayName}</strong>
        <span>{sender.maskedNumber}</span>
      </li>
      {parts.map((part) => (
        <li key={part.id} className="inset-row inset-body lesson-part">
          <PartView part={part} labels={marks[part.id]} />
        </li>
      ))}
    </InsetGroup>
  );
}

export function TellGroup({ result }: { result: SlotResult }) {
  return (
    <InsetGroup header="The tells">
      {result.lesson.tells.map((tell) => (
        <li key={tell.id} className="inset-row inset-body lesson-tell">
          <span className="tell-head">
            <strong>{tell.label}</strong>
            <span className="tell-tag">{result.caught.includes(tell.id) ? 'you found this' : 'look at this'}</span>
          </span>
          <span>{tell.why}</span>
        </li>
      ))}
      {result.falseTaps.length > 0 && (
        <li className="inset-row inset-body lesson-part">A few parts you tapped had nothing behind them. Checking is still the right habit.</li>
      )}
      <li className="inset-row inset-body lesson-line">{result.lesson.neverAsks}</li>
    </InsetGroup>
  );
}

export function HotlineGroup({ hotline }: { hotline: SlotResult['lesson']['hotline'] }) {
  return (
    <InsetGroup header="Report it">
      <li className="inset-row inset-body lesson-value">
        <span>{hotline.label}</span>
        <span className="lesson-detail">{hotline.number}</span>
      </li>
      <li>
        {/* The one real link in the exercise: the country's official reporting page. */}
        <a className="inset-row lesson-link pressable" href={hotline.reportUrl} target="_blank" rel="noopener noreferrer" onClick={() => haptic()}>
          Open the reporting page
          <span className="inset-chevron" aria-hidden="true"><Icon name="chevron" /></span>
        </a>
      </li>
    </InsetGroup>
  );
}
