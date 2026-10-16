import { useEffect, useRef, useState } from 'react';
import { ScreenTitle } from './PhoneShell.tsx';
import { Icon } from './Icon.tsx';
import { haptic } from './feel.ts';

interface NavProps {
  title: string;
  back?: string;  // the word next to the chevron
  href?: string;  // where the chevron goes
}

// The bar gets its glass and title as soon as the large title starts to slide under it, the way Settings does.
function useCollapse(large: { current: HTMLElement | null }): boolean {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const el = large.current;
    if (!el) return undefined;
    const root = el.closest('.scroll');
    const watcher = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { root, rootMargin: '-44px 0px 0px 0px', threshold: 1 }, // the bar fills in as soon as the title slides under it
    );
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [large]);
  return collapsed;
}

// iOS navigation for the phone's own pages: the 44px bar with the back chevron alone in a glass circle
// (the word is the label for screen readers, the way the phone's bar carries no Back text), then the large title.
export function NavBar({ title, back = 'Home', href = '#/' }: NavProps) {
  const large = useRef<HTMLHeadingElement>(null);
  const collapsed = useCollapse(large);
  return (
    <>
      <header className={collapsed ? 'nav nav-collapsed' : 'nav'}>
        <a className="nav-back pressable" href={href} aria-label={back} onClick={() => haptic()}><Icon name="back" /></a>
        <span className="nav-title" aria-hidden="true">{title}</span>
      </header>
      <ScreenTitle ref={large} className="large-title">{title}</ScreenTitle>
    </>
  );
}

export function PracticeProgress() {
  return (
    <section className="page settings">
      <NavBar title="My practice" />
      <p className="settings-lead">Your practice in this visit. Every choice is a chance to learn.</p>
      <section className="inset-group">
        <h2 className="inset-header">This visit</h2>
        <ul className="inset">
          <li className="inset-row inset-body">
            <Icon name="notes" />
            <p><strong>Your day is waiting.</strong><span>Play a full day or a quick day from your home screen.</span></p>
          </li>
        </ul>
      </section>
      <ul className="inset">
        <li>
          <a className="inset-row pressable" href="#/" onClick={() => haptic()}>
            Go to my phone<Icon name="chevron" className="inset-chevron" />
          </a>
        </li>
      </ul>
    </section>
  );
}
