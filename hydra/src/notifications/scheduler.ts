import * as Notifications from 'expo-notifications';
import {
  computeState,
  dailyNeedMl,
  HydrationEvent,
  UserProfile,
} from '../engine/hydrationEngine';
import { dayDrinkStats } from '../util/stats';
import { WidgetSettings } from '../store/widgetSettings';
// `t()` et non `useT()` : on est hors de React. Le texte est figé au moment où
// la notification est PROGRAMMÉE, ce qui est le bon instant — et changer de
// langue déclenche une reprogrammation complète (voir useHydration._sync).
import { t } from '../i18n';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Prochaine heure de coucher (aujourd'hui, ou demain si déjà passée) — même
// convention de repli sur 24h que awakeHoursFromSleep dans le moteur.
function nextSleepStart(profile: UserProfile, from: number): number {
  const d = new Date(from);
  d.setHours(profile.sleepStartHour, 0, 0, 0);
  if (d.getTime() <= from) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// Un rappel par verre encore nécessaire pour atteindre l'objectif du jour,
// étalé entre maintenant et le coucher. Recalculé à chaque appel (comme le
// reste de l'app, rien n'est stocké en dur) : si l'objectif est déjà atteint,
// ou qu'il n'y a plus de temps d'éveil, aucun rappel n'est programmé.
async function scheduleGlassReminders(
  events: HydrationEvent[],
  profile: UserProfile,
  widget: WidgetSettings,
  nowMs: number
): Promise<void> {
  if (widget.glassRemindersEnabled === false) return; // défaut : activé

  const target = dailyNeedMl(profile);
  const drunkToday = dayDrinkStats(events, nowMs).waterMl;
  const remainingMl = target - drunkToday;
  if (remainingMl <= 0) return;

  const glassMl = Math.max(50, widget.defaultWaterMl);
  const glassesLeft = Math.ceil(remainingMl / glassMl);

  const sleepAt = nextSleepStart(profile, nowMs);
  const windowMs = sleepAt - nowMs;
  if (windowMs <= 0) return;

  // +1 au dénominateur : évite qu'un rappel tombe collé à "maintenant".
  const stepMs = windowMs / (glassesLeft + 1);
  for (let i = 1; i <= glassesLeft; i++) {
    const left = glassesLeft - i + 1;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('notif.nextGlass.title'),
        body:
          left > 1
            ? t('notif.nextGlass.many', { n: left })
            : t('notif.nextGlass.last'),
      },
      trigger: { date: new Date(nowMs + stepMs * i) },
    });
  }
}

export async function rescheduleNotifications(
  events: HydrationEvent[],
  profile: UserProfile,
  widget: WidgetSettings
): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const state = computeState(events, Date.now(), profile);
    const nowMs = Date.now();
    if (state.ambleAt && state.ambleAt > nowMs) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('notif.amber.title'),
          body: t('notif.amber.body'),
        },
        trigger: { date: new Date(state.ambleAt) },
      });
    }
    if (state.redAt && state.redAt > nowMs) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('notif.red.title'),
          body: t('notif.red.body'),
        },
        trigger: { date: new Date(state.redAt) },
      });
    }
    await scheduleGlassReminders(events, profile, widget, nowMs);
  } catch {
    // Simulator / permission denied: swallow.
  }
}

export async function ensurePermissions(): Promise<boolean> {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}
