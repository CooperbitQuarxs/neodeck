/**
 * Public entry point for the notification service. Producers (v1-runner,
 * route handlers, future bridges) import from here only:
 *
 *   import { notificationService } from "./notifications/index.ts";
 *   await notificationService.notify({ level: "error", title: "..." });
 *
 * Channel implementations live under `./channels/`. Boot wiring in
 * `index.ts` registers default channels once.
 */

export { notificationService, NotificationService } from "./service.ts";
export { BrowserNotificationChannel } from "./channels/browser.ts";
export type {
	NotificationChannel,
	NotificationEnvelope,
	NotificationLevel,
	NotificationPayload,
} from "./types.ts";
