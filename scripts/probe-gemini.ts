// One tiny model call on whichever route the environment selects. Prints the
// route, model, latency and token counts, or the error's short reason and the
// underlying status. Never prints a key or a prompt. Used to prove a deploy.
import { MODELS, generateJson, route } from '../server/gemini.ts';

const schema = { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } }, required: ['ok'] } as const;

try {
  const { json, trace } = await generateJson<{ ok: boolean }>({
    system: 'Reply with JSON only.',
    contents: 'Return {"ok": true}.',
    schema: schema as never,
    temperature: 0,
  });
  console.log(`probe ok route=${route()} model=${trace.model ?? MODELS.director} ms=${trace.ms} json=${JSON.stringify(json)} tokens=${JSON.stringify(trace.tokens ?? null)}`);
} catch (err) {
  const cause = (err as { cause?: { status?: unknown; message?: string } }).cause;
  const detail = cause ? `status=${String(cause.status ?? '')} cause=${String(cause.message ?? '').slice(0, 400)}` : '';
  console.log(`probe failed route=${route()} reason=${err instanceof Error ? err.message : String(err)} ${detail}`);
  process.exitCode = 1;
}
