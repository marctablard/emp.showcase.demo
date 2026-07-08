import type { ComponentSelectedMessage, InlineEditCommitMessage, InlineEditRequestMessage } from '../types';

/**
 * Outbound inline-editing messages (storefront → CMS editor).
 *
 * These mirror the way `useCMSLiveEditor` posts `IFRAME_READY` and request
 * responses: fire-and-forget `window.parent.postMessage` to `'*'`. They are
 * only meaningful when the storefront is framed by the editor; callers gate
 * on editor mode before invoking.
 *
 * Neither message expects a dedicated reply — the editor mutates its own
 * model (the single source of truth) and loops the result back through the
 * existing `UPDATE_SLOT` message, which re-renders the preview.
 */

function postToEditor(message: InlineEditCommitMessage | InlineEditRequestMessage | ComponentSelectedMessage): void {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage(message, '*');
}

/** The user edited a value in place (text / textarea / url / select). */
export function postInlineEditCommit(payload: Omit<InlineEditCommitMessage, 'type'>): void {
  postToEditor({ type: 'INLINE_EDIT_COMMIT', ...payload });
}

/** The user clicked a field that needs one of the editor's selector dialogs. */
export function postInlineEditRequest(payload: Omit<InlineEditRequestMessage, 'type'>): void {
  postToEditor({ type: 'INLINE_EDIT_REQUEST', ...payload });
}

/** The user clicked a component in the preview — select it in the editor. */
export function postComponentSelected(payload: Omit<ComponentSelectedMessage, 'type'>): void {
  postToEditor({ type: 'COMPONENT_SELECTED', ...payload });
}
