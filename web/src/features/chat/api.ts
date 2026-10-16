import type { ChatReplyBody, ChatReplyResult } from '../../../../shared/types.ts';

// The server answers within 6 s, with its own fixed line when the model is slow. This is the
// browser's own cap for a lost connection: past it the send fails and the chip can be tapped again.
export const CHAT_CLIENT_TIMEOUT_MS = 9000;

const replyUrl = (dayId: string, slotId: string) =>
  `/api/day/${encodeURIComponent(dayId)}/slot/${encodeURIComponent(slotId)}/reply`;

export async function postReply(dayId: string, slotId: string, body: ChatReplyBody, timeoutMs = CHAT_CLIENT_TIMEOUT_MS): Promise<ChatReplyResult> {
  const response = await fetch(replyUrl(dayId, slotId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as ChatReplyResult;
}
