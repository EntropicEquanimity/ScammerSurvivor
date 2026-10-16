// The lesson's spot-the-difference: which words of the real twin differ from the scam, by an
// ordered word diff (longest common subsequence). Pure, so the lesson and its test read the same.

export interface Segment {
  text: string;
  changed: boolean;
}

// A word compares without case or the punctuation around it, so "Friday." and "friday" match.
const norm = (word: string): string => word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
const wordsOf = (text: string): string[] => text.split(/\s+/).filter(Boolean);

// Which words of `to` sit in the longest common subsequence with `from`. Messages are short (about
// 15 words a part), so the plain table is fine.
function kept(from: string[], to: string[]): boolean[] {
  const a = from.map(norm);
  const b = to.map(norm);
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const out = new Array<boolean>(b.length).fill(false);
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      out[j] = true;
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return out;
}

// The text of `to` as segments, spaces kept, neighbouring changed words joined into one mark.
export function diffWords(from: string, to: string): Segment[] {
  const tokens = to.split(/(\s+)/).filter((token) => token.length > 0);
  const same = kept(wordsOf(from), wordsOf(to));
  let index = -1;
  const flags = tokens.map((token) => (/^\s+$/.test(token) ? null : !same[(index += 1)]));
  return tokens.reduce<Segment[]>((segments, token, i) => {
    // A space joins a mark only when the words on both sides of it are changed.
    const changed = flags[i] ?? (flags[i - 1] === true && flags[i + 1] === true);
    const last = segments[segments.length - 1];
    return last && last.changed === changed
      ? [...segments.slice(0, -1), { text: last.text + token, changed }]
      : [...segments, { text: token, changed }];
  }, []);
}

export interface TwinDiff {
  id: string;
  segments: Segment[];
  wholeLine: boolean; // most of the line differs: mark the line, not a scatter of words
}

const WHOLE_LINE_SHARE = 0.6;

// Each real twin part against the scam part in the same place (the Director writes as many twin
// parts as scam parts).
export function twinDiffs(scam: readonly { text: string }[], twin: readonly { id: string; text: string }[]): TwinDiff[] {
  return twin.map((part, index) => {
    const segments = diffWords(scam[index]?.text ?? '', part.text);
    const words = wordsOf(part.text).length;
    const changedWords = segments.filter((s) => s.changed).reduce((sum, s) => sum + wordsOf(s.text).length, 0);
    return { id: part.id, segments, wholeLine: words > 0 && changedWords / words > WHOLE_LINE_SHARE };
  });
}
