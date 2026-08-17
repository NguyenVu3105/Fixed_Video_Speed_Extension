import type { PopupToContentMessage, ContentState } from '../types/messages';
import { SPEED_MAX, SPEED_MIN } from '../config';
import { VideoController } from './VideoController';
import { OverlayService } from './OverlayService';
import { Integration } from './Integration';

// ─── Message handling ────────────────────────────────────────────────────────
// The popup talks to the content script directly via chrome.tabs.sendMessage;
// this module answers those requests. All handlers are synchronous, so
// sendResponse is called inline and the listener never returns true.

function clampSpeed(value: number): number {
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
}

function handleMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): undefined {
  if (
    typeof message !== 'object' ||
    message === null ||
    typeof (message as PopupToContentMessage).type !== 'string'
  ) {
    return undefined;
  }
  const msg = message as PopupToContentMessage;

  switch (msg.type) {
    case 'fvs:get-state': {
      const state: ContentState = {
        videoCount: VideoController.getAttachedCount(),
        running: Integration.isRunning(),
        speed: VideoController.getSpeed(),
      };
      sendResponse(state);
      break;
    }
    case 'fvs:apply': {
      if (typeof msg.speed === 'number' && Number.isFinite(msg.speed) && msg.speed > 0) {
        VideoController.setSpeed(clampSpeed(msg.speed));
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false });
      }
      break;
    }
    case 'fvs:preview': {
      sendResponse({ shown: OverlayService.preview() });
      break;
    }
  }
  return undefined;
}

// ─── Public API ──────────────────────────────────────────────────────────────

let initialized = false;

/** Registers the runtime message listener. Idempotent. */
function init(): void {
  if (initialized) return;
  initialized = true;
  chrome.runtime.onMessage.addListener(handleMessage);
}

/** Removes the runtime message listener. Idempotent. */
function stop(): void {
  if (!initialized) return;
  initialized = false;
  chrome.runtime.onMessage.removeListener(handleMessage);
}

export const MessageService = {
  init,
  stop,
} as const;
