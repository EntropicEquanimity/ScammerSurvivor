#!/usr/bin/env bash
# Policy grep. Run it with `npm run check`. Any hit fails the check.
# It scans code and copy. It skips docs/, which quote the rules and name real
# brands in plain text, and this file, which has to hold the banned words.
set -euo pipefail
cd "$(dirname "$0")/.."

DIRS=()
for dir in shared server web content; do
  if [ -d "$dir" ]; then DIRS+=("$dir"); fi
done
ALL=("${DIRS[@]}" package.json vite.config.ts scripts/run-check.mjs)

# Whole words only: the Tagalog word "mamaya" (later) must pass.
# When lesson copy starts naming real brands in plain text, exclude that one folder here.
# The Guard's list is server/guard/denylist.ts, the one file this grep skips. Keep the two in step.
BRANDS='whatsapp|zapzap|gcash|maya|paymaya|viber|telegram|wechat|imessage|gmail|facebook|instagram|tiktok|paypal|shopee|lazada|bdo|bpi|metrobank|landbank|unionbank|pesopay|dbs|posb|ocbc|uob|paynow|grabpay|paytm|phonepe|upi|sbi|hdfc|icici|paypay|rakuten|gopay|ovo|bca|mandiri|maybank|cimb|octopus|hsbc|payme|fps|commbank|anz|westpac|payid|google pay|line pay|touch .?n.? go'
# Brands that are also English words or names, in their own capitals only.
BRANDS_CASED='LINE|DANA|NAB'

# @google/genai and Google's ADK are the only AI SDKs allowed.
AI_SDKS='openai|@openai/[^"]*|anthropic|@anthropic-ai/[^"]*|cohere-ai|@mistralai/[^"]*|groq-sdk|ollama|replicate|@huggingface/[^"]*|together-ai|langchain|@langchain/[^"]*|llamaindex|ai|@ai-sdk/[^"]*'

EM_DASH=$'\xe2\x80\x94'
failed=0

# scan "<rule>" <grep arguments>: a match breaks the rule.
scan() {
  local rule="$1"
  shift
  local hits
  hits=$(grep -rnI --exclude-dir=node_modules --exclude-dir=dist "$@" || true)
  if [ -n "$hits" ]; then
    failed=1
    echo "FAIL  $rule"
    echo "$hits" | sed 's/^/        /'
  else
    echo "ok    $rule"
  fi
}

# One exception, ruled by the Builder on 16 Oct 2026 (AGENTS.md rule 3): the chat's typed reply,
# web/src/features/chat/TypedReply.tsx, may hold exactly one <input> and nothing else that types.
TYPED_FILE=web/src/features/chat/TypedReply.tsx
scan "no typed input anywhere" --exclude=TypedReply.tsx \
  -E '<(input|textarea|select)([^A-Za-z]|$)|contentEditable|createElement\(.(input|textarea)' web
if [ -f "$TYPED_FILE" ]; then
  typed_inputs=$(grep -cE '<input([^A-Za-z]|$)' "$TYPED_FILE" || true)
  typed_other=$(grep -cE '<(textarea|select)([^A-Za-z]|$)|contentEditable|createElement' "$TYPED_FILE" || true)
  if [ "$typed_inputs" -le 1 ] && [ "$typed_other" -eq 0 ]; then
    echo "ok    the typed reply holds one input only"
  else
    failed=1
    echo "FAIL  the typed reply holds one input only ($typed_inputs inputs, $typed_other other)"
  fi
fi
scan "no real brand names in code or copy" --exclude=denylist.ts -iwE "$BRANDS" "${ALL[@]}"
scan "no real brand names in their own capitals" --exclude=denylist.ts -wE "$BRANDS_CASED" "${ALL[@]}"
scan "no non-Google AI SDK in package.json" -E "\"($AI_SDKS)\"[[:space:]]*:" package.json
scan "no answer key in web code" -E 'plantedTells|safeReplies|unsafeReplies|callBeats|realTwin' web
scan "no copy, share or download control" -E 'navigator\.(clipboard|share)|execCommand|[[:space:]]download[=>[:space:]]' web
scan "no machine paths or keys" -E '[A-Za-z]:\\+(Users|workspace)|/Users/[A-Za-z]|/home/[a-z]|AIza[0-9A-Za-z_-]{20}' "${ALL[@]}" scripts
scan "no em dashes" -e "$EM_DASH" "${ALL[@]}" scripts

if [ "$failed" -ne 0 ]; then
  echo "Policy check failed."
  exit 1
fi
echo "Policy check passed."
