import type { ReactNode } from 'react';

// One Settings-style group: a sentence-case header, then a block of rows. The classes are the
// shared iOS ones from shell.css; the children are the rows (each an li with .inset-row).
export function InsetGroup({ header, children }: { header: string; children: ReactNode }) {
  return (
    <section className="inset-group">
      <h2 className="inset-header">{header}</h2>
      <ul className="inset">{children}</ul>
    </section>
  );
}
