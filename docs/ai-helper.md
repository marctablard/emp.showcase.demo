# AI Helper

This document explains how the account-dashboard AI Helper talks to Emporix AI Service, how Showcase chooses streaming vs batch, and what shoppers see while a reply is in progress.

## Overview

The AI Helper is a card on the signed-in **account dashboard**. It is not a site-wide overlay.

Shoppers ask the Frontend Agent (`frontendAgent`) about their account and catalog context. The browser always sends JSON to `POST /api/ai/chat` and waits for one JSON response. When streaming is enabled, the BFF calls AI Service `chat-stream` and assembles a complete reply on the server before that JSON is returned. The browser does not open an SSE connection.

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

The card keeps the existing thinking spinner until `POST /api/ai/chat` returns a complete JSON body. The Helper then parses that `message` and renders text plus typed widgets. It does not render tokens, partial JSON, or widgets from an incomplete object.

Tokens are not shown because the Frontend Agent replies with structured JSON, not free-text chat. Painting that JSON as it is generated would look like raw code in a commerce UI, and widgets would be wrong until the object is complete.

Shopper-visible wait is therefore similar to batch. COP-5795 measured earlier time-to-first-token on the wire for streaming; that gain is not shown as tokens in Showcase. What this storefront delivers is the released stream endpoint, correct widgets, and a documented batch fallback.

## Empty stream and tenant dependency

If the assembled stream has no non-empty `message`, the BFF returns the existing chat error (`AI_SERVICE_ERROR`) and the card shows the usual error copy. An empty stream is not treated as a successful blank reply.

Streaming still depends on the platform empty-stream fix (COP-6164) being present on the tenant. Without that fix, `chat-stream` can finish with no usable message. In that environment, set `NEXT_AI_CHAT_STREAMING=false` to use batch.

## Quality examples

COP-5482 lists typical Frontend Agent prompts (open quotes, profile, pending or open orders, product-quality search). Use them as **manual quality examples**. They are not latency SLAs and not automated Definition of Done for this storefront mode switch.

## Related Documentation

- [Documentation index](./README.md)
- [Environment Variables](./environment-variables.md)
