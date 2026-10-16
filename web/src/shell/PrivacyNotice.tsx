import { CONTACT_PAGE } from '../strings.ts';
import type { Strings } from '../strings.ts';
import { Icon } from './Icon.tsx';
import { NavBar } from './PhoneTools.tsx';
import { haptic } from './feel.ts';

export function PrivacyNotice({ t }: { t: Strings }) {
  return (
    <section className="page settings">
      <NavBar title={t.privacy.title} />
      <section className="inset-group">
        <h2 className="inset-header">Your data</h2>
        <ul className="inset">
          {t.privacy.lines.map((line) => (
            <li key={line} className="inset-row inset-body"><p>{line}</p></li>
          ))}
        </ul>
      </section>
      <section className="inset-group">
        <h2 className="inset-header">About the apps here</h2>
        <ul className="inset">
          <li className="inset-row inset-body"><p>{t.notices.brand}</p></li>
          <li className="inset-row inset-body"><p>{t.notices.ai}</p></li>
          <li className="inset-row inset-body"><p>{t.notices.sites}</p></li>
        </ul>
      </section>
      <section className="inset-group">
        <h2 className="inset-header">Questions</h2>
        <ul className="inset">
          <li>
            <a className="inset-row pressable" href={`https://${CONTACT_PAGE}`} target="_blank" rel="noopener noreferrer" onClick={() => haptic()}>
              <p><strong>{t.notices.contact}</strong><span>{CONTACT_PAGE}</span></p>
              <Icon name="chevron" className="inset-chevron" />
            </a>
          </li>
        </ul>
      </section>
    </section>
  );
}
