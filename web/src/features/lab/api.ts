// POST /api/lab/generate and the shapes it returns. The field names are the lab's own
// (planted, safe, twin), never the card's answer-key names, which the policy grep bans in web code.
import type { Action, Layout, PeopleRole, TellId, TraceEvent, TrickId } from '../../../../shared/types.ts';

export interface LabRequest {
  age: 'adult';
  country: string;
  trickId: TrickId;
  role?: PeopleRole;
  name?: string;
}

export interface LabPart {
  id: string;
  text: string;
  tellIds: TellId[];
}

export interface LabSender {
  displayName: string;
  maskedNumber: string;
}

export interface LabPreview {
  layout: Layout;
  difficulty: 1 | 2 | 3;
  sender: LabSender;
  setup: LabPart[];
  ask: LabPart[];
  planted: TellId[];
  safe: Action[];
  unsafe: Action[];
  usualEnding: string;
  neverAsks: string;
  twin: { sender: LabSender; parts: { id: string; text: string }[]; acceptable: Action[] };
}

export interface LabRule {
  id: string;
  text: string;
  passed: boolean;
}

export interface LabResult {
  verdict: 'pass' | 'repaired' | 'rejected' | 'errored';
  preview: LabPreview | null;
  rules: LabRule[]; // empty when the Guard never ran (errored)
  trace: TraceEvent[];
}

export class LabError extends Error {
  status: number;
  constructor(status: number, code: string) {
    super(code);
    this.name = 'LabError';
    this.status = status;
  }
}

export async function generateLive(body: LabRequest): Promise<LabResult> {
  const response = await fetch('/api/lab/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string };
    throw new LabError(response.status, error.error ?? 'request_failed');
  }
  return (await response.json()) as LabResult;
}
