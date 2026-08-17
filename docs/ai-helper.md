# AI Helper

This document explains how the account-dashboard AI Helper talks to Emporix AI Service, how Showcase chooses streaming vs batch, and what shoppers see while a reply is in progress.

## Overview

The AI Helper is a card on the signed-in **account dashboard**. It is not a site-wide overlay.

Shoppers ask the Frontend Agent (`frontendAgent`) about their account and catalog context. Chat `language` is the header language switcher locale (`useLocale()`, `en` or `de`), not `NEXT_PUBLIC_DEFAULT_LANGUAGE`. The browser always `POST`s JSON to `/api/ai/chat`. When streaming is enabled, the BFF calls AI Service `chat-stream`, forwards a live chunk count to the browser as SSE (`progress` then `complete`), and still assembles one widget payload before the Helper renders it. When streaming is off, the BFF returns one JSON body as before. The browser never opens a connection to AI Service itself.

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

The card shows a thinking spinner while the reply is in progress. When streaming is on, `POST /api/ai/chat` is an SSE response: a `progress` event with `chunks` (count of upstream SSE data payloads, starting at 0) then a `complete` event with the assembled `AIChatResponse`. The thinking bubble updates to “AI is thinking [n]” as those events arrive. The Helper then parses that assembled `message` and renders text plus typed widgets. For `type: "text"`, the top-level `message` is the intro and `data.message` (when present) is the body — for example product highlights under a heading. For `quote_list`, Frontend Agent often embeds Quote Service resources (`id`, `status.value`, `metadata.createdAt`, `totalPrice`, `items`) rather than the flattened Helper DTO; the card maps those fields before render.

Live `frontendAgent` streams often concatenate more than one JSON document in token `content`: a markdown-fenced tool payload (for example a search `{ query, filter }`) and later a Frontend Agent envelope (`type` / `data`). The BFF assembler waits until the upstream stream ends, then keeps the last widget envelope and drops tool JSON so the shopper sees the order list (or other widget) instead of raw JSON.

Token frames are character fragments, not complete shopper messages. Painting that JSON as it is generated would look like raw code in a commerce UI, and widgets would be wrong until the object is complete. The live chunk count is only a wait-state signal.

When streaming is off, the spinner stays on the existing “AI is thinking…” copy until the JSON body returns.

## Empty stream and tenant dependency

Live `frontendAgent` streams send the reply as token `content` chunks. The BFF concatenates those strings server-side into one `message` before returning the `complete` SSE event (or a JSON body in batch mode). A trailing `done` frame without `message` is expected metadata; it is not the payload and is not by itself an empty stream.

If no token `content` reconstitutes a non-empty `message`, the BFF returns the existing chat error (`AI_SERVICE_ERROR`). The storefront shows the standard error notification (toast) and an AI chat bubble on that turn, both using the existing AI Helper error copy, so the shopper can see which question failed. The helper card stays usable so they can try again. An empty stream is not treated as a successful blank reply.

If a tenant’s `chat-stream` truly finishes with no token content (COP-6164 empty-stream cases), set `NEXT_AI_CHAT_STREAMING=false` to use batch.

## Session isolation (COP-6181)

The Helper persists the transcript, chat-mode flag, and a client-generated conversation id in `localStorage` so a refresh does not wipe the thread. Those keys are **not** the Emporix customer session.

Keys are namespaced with the authenticated Emporix `customerId`:

`ai-helper.v1:{customerId}:messages|chatMode|sessionId`

Only Helper keys are touched. Dashboard layout, history, checkout, and auth storage are left alone — we do not scan `localStorage` and delete every key that is not `app_${userId}_*`.

When the Helper knows the current customer it **adopts** that namespace: leftover unscoped keys (`ai-helper-chat-messages`, `ai-session-id`, …) and other shoppers’ `ai-helper.v1:` entries are removed. The current shopper’s namespace is kept, so the same user can refresh or log back in on this browser. A different shopper never reads the previous transcript.

Logout / login also drop unscoped keys immediately. Order links in any leftover UI still hit customer-scoped APIs and 403 for the new shopper — commerce auth was not bypassed. Reusing a leftover conversation id on `POST /api/ai/chat` is still unsafe, so unscoped ids are deleted and each shopper gets their own namespaced id.

“Clear chat” rotates the conversation id for the current shopper without logging them out.

## Quality examples

COP-5482 lists typical Frontend Agent prompts (open quotes, profile, pending or open orders, product-quality search). Use them as **manual quality examples**. They are not latency SLAs and not automated Definition of Done for this storefront mode switch.

## Related Documentation

- [Documentation index](./README.md)
- [Environment Variables](./environment-variables.md)
