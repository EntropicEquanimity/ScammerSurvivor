import type { PublicPage } from '../../../../shared/page.ts';
import type { FieldId } from '../../../../shared/profile.ts';
import { ScreenTitle } from '../../shell/PhoneShell.tsx';
import { haptic } from '../../shell/feel.ts';
import { PartView } from '../layouts/MessageView.tsx';
import type { TapMode } from '../layouts/MessageView.tsx';
import { ROW_LABEL, rowValue, sendLabel, siteName } from './fill.ts';
import { isNoLink } from './template.ts';

export { siteName } from './fill.ts';
import type { FormState } from './fill.ts';

// The practice page as a plain web page inside the in-app browser: the site's own header, its title
// and lines, a static countdown line when it has one, then its form. Rows are buttons, never inputs:
// tapping one raises the autofill bar for it (Autofill.tsx). The page's own button sends what is filled.

// An invented ID card drawn in CSS: a face shape and three grey bars. No real document's layout.
export const IdThumb = () => (
  <span className="id-thumb" aria-hidden="true"><i /><b /><b /><b /></span>
);

function SiteHeader({ host }: { host: string }) {
  const name = siteName(host);
  return (
    <p className="web-site">
      <span className="web-mark" aria-hidden="true">{name[0] ?? ''}</span>
      {name}
    </p>
  );
}

interface RowProps {
  id: FieldId;
  filled: boolean;
  focused: boolean;
  onFocus: (id: FieldId) => void;
}

function Row({ id, filled, focused, onFocus }: RowProps) {
  const tap = () => {
    haptic();
    onFocus(id);
  };
  return (
    <li>
      <button type="button" className="web-row pressable" data-focus={focused || undefined} aria-expanded={focused} onClick={tap}>
        <span className="web-row-label">{ROW_LABEL[id]}</span>
        <span className={filled ? 'web-row-value' : 'web-row-value web-row-empty'}>
          {filled && id === 'id_photo' && <IdThumb />}
          {filled ? rowValue(id) : 'Tap to fill'}
        </span>
      </button>
    </li>
  );
}

interface FormProps {
  page: PublicPage;
  form: FormState;
  sending: boolean;
  failed: boolean;
  onFocus: (id: FieldId) => void;
  onSend: () => void;
}

function PageForm({ page, form, sending, failed, onFocus, onSend }: FormProps) {
  const send = () => {
    haptic();
    onSend();
  };
  return (
    <>
      <ul className="web-form">
        {page.fields.map((id) => (
          <Row key={id} id={id} filled={form.filled.includes(id)} focused={form.focus === id} onFocus={onFocus} />
        ))}
      </ul>
      {failed && <p className="web-failed" role="alert">We couldn't send that. Check your connection, then tap {sendLabel(page.kind)} again.</p>}
      <button type="button" className="web-send pressable" disabled={sending || form.filled.length === 0} onClick={send}>
        {sendLabel(page.kind)}
      </button>
    </>
  );
}

// After the send: the page says what it now has, so the player sees exactly what left the phone.
const listOf = (words: string[]): string =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;

function Sent({ given }: { given: FieldId[] }) {
  return (
    <div className="web-sent" role="status">
      <p className="web-sent-title">Sent</p>
      <p>This page now has your {listOf(given.map((id) => ROW_LABEL[id].replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())))}.</p>
    </div>
  );
}

interface Props extends Omit<FormProps, 'page'> {
  page: PublicPage;
  sent: FieldId[] | null; // what the send button sent, once it landed
  preview?: string; // the line a code-built page shows instead of its form: its rows are not buttons
}

// A preview page's rows: what the site asks for, drawn flat, with no fill and no send.
function PreviewRows({ page, line }: { page: PublicPage; line: string }) {
  return (
    <>
      {page.fields.length > 0 && (
        <ul className="web-form">
          {page.fields.map((id) => (
            <li key={id} className="web-row web-row-static">
              <span className="web-row-label">{ROW_LABEL[id]}</span>
            </li>
          ))}
        </ul>
      )}
      {!isNoLink(page) && <p className="web-preview" role="note">{line}</p>}
    </>
  );
}

export function PageView({ page, sent, preview, ...form }: Props) {
  if (preview) {
    return (
      <article className="web">
        {!isNoLink(page) && <SiteHeader host={page.host} />}
        <ScreenTitle className="web-title">{page.title}</ScreenTitle>
        {page.lines.map((line) => <p key={line.id} className="web-line">{line.text}</p>)}
        <PreviewRows page={page} line={preview} />
      </article>
    );
  }
  return (
    <article className="web">
      <SiteHeader host={page.host} />
      <ScreenTitle className="web-title">{page.title}</ScreenTitle>
      {page.lines.map((line) => <p key={line.id} className="web-line">{line.text}</p>)}
      {page.minutes !== undefined && <p className="web-timer">This page expires in {page.minutes} minutes.</p>}
      {sent ? <Sent given={sent} /> : page.fields.length > 0 && <PageForm page={page} {...form} />}
    </article>
  );
}

// The page's lines on the tell picker, in the same web look, each a tappable part like the message's.
export function PageTells({ page, tap }: { page: PublicPage; tap: TapMode }) {
  return (
    <section className="web web-tells" aria-label={`The page at ${page.host}`}>
      <p className="web-tells-host">{page.host}</p>
      <p className="web-title">{page.title}</p>
      {page.lines.map((line) => (
        <p key={line.id} className="web-line">
          <PartView part={line} tap={tap} />
        </p>
      ))}
    </section>
  );
}
