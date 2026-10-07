# AI Helper

This document explains how the account-dashboard AI Helper talks to Emporix AI Service, how Showcase chooses streaming vs batch, and what shoppers see while a reply is in progress.

## Overview

The AI Helper is a card on the signed-in **account dashboard**. It is not a site-wide overlay.

Shoppers ask the Frontend Agent (`frontendAgent`) about their account and catalog context. Chat `language` is the header language switcher locale (`useLocale()`, `en` or `de`), not `NEXT_PUBLIC_DEFAULT_LANGUAGE`. The browser always `POST`s JSON to `/api/ai/chat`. When streaming is enabled, the BFF calls AI Service `chat-stream`, forwards live `progress` SSE events (chunk count plus a safe text/HTML preview when available), then a `complete` event with the assembled `AIChatResponse`. When streaming is off, the BFF returns one JSON body as before. The browser never opens a connection to AI Service itself.

## Streaming vs batch

Streaming is the default. Unset `NEXT_AI_CHAT_STREAMING`, `true`, or any value other than the string `false` uses `POST /ai-service/{tenant}/agentic/chat-stream`.

Set `NEXT_AI_CHAT_STREAMING=false` to fall back to batch `POST /ai-service/{tenant}/agentic/chat`.

| `NEXT_AI_CHAT_STREAMING` | Upstream call |
| --- | --- |
| Unset, `true`, or any value other than `false` | Streaming (`chat-stream`) |
| `false` | Batch (`chat`) |

The flag is **server-only**. Do not prefix it with `NEXT_PUBLIC_`. Restart the app after changing it.

AI Service also documents an async chat mode. Showcase does not use it. For the three API modes, see the [Agent Chat](https://developer.emporix.io/api-references/api-guides/artificial-intelligence/ai-service/api-reference/agent-chat) reference.

## Shopper experience

When streaming is on, `POST /api/ai/chat` is an SSE response. Each `progress` event includes `chunks` (count of upstream SSE data payloads processed so far) and, when safe, a `preview` payload:

- `{ kind: "text", content }` — plain text or a `type: "text"` body as the `"message"` string arrives
- `{ kind: "html", html }` — sanitized HTML from a `type: "html"` envelope as it arrives
- `{ kind: "widget", type, message, data }` — a storefront card, only once the agent's answer declares its widget `type`:
  - `tool_start` / `tool_result` frames paint nothing on their own. Agents often call lookup tools first (for example `get-customer-info` to read owned products or product rules before `get-products`), so painting each tool's card would flash the wrong widget.
  - When the token envelope names a `type`, the card is filled from the matching `tool_result` (`get-quotes` with two quotes → two cards; indexed hits from `results[].metadata`), or a skeleton is shown until it is. Tool-message wrappers (`name`/`type: tool`/`artifact`) are unwrapped first so a tool name like `get-customer-info` is never painted as the shopper's name.
- `thinking: "active"` — opaque presence flag only. The Helper shows translated “thinking” status; **raw model chain-of-thought is never forwarded to the browser or painted**. It is **not** written into `complete.message` or `localStorage`.

The thinking line stays visible for the whole in-flight turn. It uses “AI is thinking…” until the first processed payload, then “AI is thinking [n]” as `chunks` increments. A handshake `chunks: 0` is not shown. While Sending is disabled, the chat card and message log use `cursor-progress`. Incomplete widgets render `SkeletonFrame` bars (pulse plus two white/primary-blue cones circling the border).

Live captions also drop any markdown ATX heading (for example `## OBJECTIVE`, `## SESSION INTENT`) and are length-capped for streaming only. Completed shopper answers keep full length after the same planning filter.
While `preview` is present, the Helper paints a live assistant bubble under the thinking line: **card first**, model caption underneath. Partial replies are **not** persisted to `localStorage`; the final parsed message is stored only on `complete`.

When no preview is available yet — unnamed tools and no shopper `"message"` — the card shows only the thinking spinner (never live CoT text).

On `complete`, the Helper parses the assembled `message` and renders the final text plus typed widgets. Agent/SSE envelopes (`agentId` / `sessionId`, or `type: "complete"`) are unwrapped even when the nested `message` is a string or object — not only when `type` is `"complete"`. If the stream only contained a filled `tool_result` (no token JSON), the BFF synthesizes the widget envelope from that result. A later token envelope with richer `data` replaces a husk `tool_result` (for example a wrapper whose `name` is the tool id).

Shoppers never see raw JSON. If the final payload is incomplete, an unknown widget type, or a husk that cannot be rendered, the Helper commits a fallback: the shopper `message` as normal text, the first five lines of `data` (or of the envelope when `data` is empty), and a hint to open the browser console. The full parsed object is written to the browser console. Live widgets may still show a skeleton while the turn is in flight; unresolved husks are not committed, so the skeleton cannot remain after `complete`.

Live `frontendAgent` streams may still concatenate markdown-fenced tool payloads and a later Frontend Agent envelope in token `content`. That token path is fallback only: once `type` is known, Showcase shows the matching React widget (skeleton until `data` is parseable). Allowlisted `tool_result` JSON fills the card as soon as the tool returns; wrappers that only carry the tool name are dropped. Showcase never calls `ai-agentic` — only AI Service `chat-stream`. The BFF owns tool→widget mapping; AI Service only sanitizes JSON.

When streaming is off, the spinner stays on the existing “AI is thinking…” copy until the JSON body returns.

## Empty stream and tenant dependency

Live `frontendAgent` streams send the reply as token `content` chunks. The BFF concatenates those strings server-side into one `message` before returning the `complete` SSE event (or a JSON body in batch mode). A trailing `done` frame without `message` is expected metadata; it is not the payload and is not by itself an empty stream.

If no token `content` reconstitutes a non-empty `message` and no artifact items arrived, the BFF returns the existing chat error (`AI_SERVICE_ERROR`). The storefront shows the standard error notification (toast) and an AI chat bubble on that turn, both using the existing AI Helper error copy, so the shopper can see which question failed. The helper card stays usable so they can try again. An empty stream is not treated as a successful blank reply.

If a tenant’s `chat-stream` truly finishes with no token content (empty-stream cases), set `NEXT_AI_CHAT_STREAMING=false` to use batch.

## Session isolation

The Helper persists the transcript, chat-mode flag, and a client-generated conversation id in `localStorage` so a refresh does not wipe the thread. Those keys are **not** the Emporix customer session.

Keys are namespaced with the authenticated Emporix `customerId`:

`ai-helper.v1:{customerId}:messages|chatMode|sessionId`

Only Helper keys are touched. Dashboard layout, history, checkout, and auth storage are left alone — we do not scan `localStorage` and delete every key that is not `app_${userId}_*`.

When the Helper knows the current customer it **adopts** that namespace: leftover unscoped keys (`ai-helper-chat-messages`, `ai-session-id`, …) and other shoppers’ `ai-helper.v1:` entries are removed. The current shopper’s namespace is kept, so the same user can refresh or log back in on this browser. A different shopper never reads the previous transcript.

Logout / login also drop unscoped keys immediately. Order links in any leftover UI still hit customer-scoped APIs and 403 for the new shopper — commerce auth was not bypassed. Reusing a leftover conversation id on `POST /api/ai/chat` is still unsafe, so unscoped ids are deleted and each shopper gets their own namespaced id.

“Clear chat” rotates the conversation id for the current shopper without logging them out.

## Agent contract

Typed widgets should come from tool artifacts, not from the model re-serializing arrays. `frontendAgent` `outputFormat` can stay a small envelope (`message`, `type`, optional `data` for html/text). List payloads (`orders`, `products`, `quotes`, …) are projected in the Showcase BFF (`adaptToolResult`) from allowlisted tool results — MCP-style `get-*` tools and indexed search tools whose canonical name starts with `indexed` (hits from `results[].metadata`). For quotes, the BFF extracts list/singleton JSON shape; locale flattening happens in renderers (`mapAiQuote` / `mapAiQuoteList`), not in `adaptToolResult`. Do not ask the model to emit raw HTML for orders or products.

The model sets `data: null` for these widgets; the BFF fills them from the tool result. When a turn calls several tools (for example `get-customer-info` to read rules or owned products, then `get-products`), the widget type named in the agent's envelope wins over the last tool that ran. If no tool result matches that type, the agent's own envelope is used. An envelope that answers with `text` or `html` always wins over tool cards: reading `get-customer-info` to answer a rule or device question must not paint the account card.

The current `frontendAgent` prompt is kept in [`agents/frontendAgent.userPrompt.md`](./agents/frontendAgent.userPrompt.md). It is applied to the tenant through the AI Service `PATCH /ai-service/{tenant}/agentic/agents/frontendAgent` endpoint (scope `ai.agent_manage`, header `Content-Language: *`). Update the file whenever you change the prompt in the tenant.

Keep `maxRecursionLimit` at 20 or higher. Each tool call costs several agent steps, so flows that chain tools (owned products: `get-customer-info` then `get-products`; recommendations add `productsRagTool`) stop with an upstream `Recursion limit reached` error at 10, which the shopper sees as a failed request.

## Quality examples

Typical Frontend Agent prompts (open quotes, profile, pending or open orders, product-quality search) are **manual quality examples**. They are not latency SLAs and not automated Definition of Done for this storefront mode switch.

## Related Documentation

- [Documentation index](./README.md)
- [Environment Variables](./environment-variables.md)
