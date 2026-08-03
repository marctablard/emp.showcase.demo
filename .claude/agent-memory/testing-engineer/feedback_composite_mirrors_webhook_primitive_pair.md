---
name: composite-mirrors-webhook-primitive-pair
description: FallbackCmsAdapter-Tests müssen validateWebhookSignature+mapWebhookPayload mirroring pinnen, nicht nur handleWebhook — sonst stiller 405.
metadata:
  type: feedback
---

Bei Composite-/Wrapper-CmsAdaptern (z.B. `FallbackCmsAdapter`) reicht es NICHT, nur `handleWebhook` der optionalen Webhook-Surface zu testen. Das Primitiv-Paar `validateWebhookSignature` + `mapWebhookPayload` muss separat auf mirroring + primary-only-delegation gepinnt werden.

**Why:** `StoryblokCmsAdapter` (der kanonische Primary, der gewrappt wird) implementiert das Primitiv-Paar und NICHT `handleWebhook`. `DelegatingCmsServiceSSR` wählt die Webhook-Strategie danach: nur wenn BEIDE Primitive present sind, läuft verify→map→invalidate; sonst → 405. Lässt der Composite eines der Member fallen, degradiert die Webhook-Route still auf 405 und die Phase-E-Cache-Invalidierung bricht ohne Test-Signal. Bei EMP-16 Phase G war genau das ungetestet (impl korrekt, Test fehlte) — als major eingestuft + behoben.

**How to apply:** Bei jedem neuen oder geänderten Composite/Decorator über die CmsAdapter-SPI prüfen, ob alle 5 optionalen Member (getEditableProps, BridgeScript, handleWebhook, validateWebhookSignature, mapWebhookPayload) gespiegelt UND getestet sind — pro Member ein "mirror + fallback-never-invoked" und ein "undefined when primary omits". WebhookEvent-Discriminante ist `kind`, nicht `type` (sonst TS2353 im tsc-Gate).
