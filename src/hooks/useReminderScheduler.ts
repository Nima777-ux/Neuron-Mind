import { useCallback, useEffect, useRef, useState } from 'react';
import { sendLocalNotification } from '../lib/platform';
import type {
  CalendarEvent,
  CornerNotificationItem,
  ReminderItem,
  ReminderRecurrence,
  ScheduledEventAction,
} from '../types/assistant';

export interface ActiveEventAlert {
  event: CalendarEvent;
  action?: ScheduledEventAction;
  actionOutcome?: string;
}

function computeNextRecurrence(dueIso: string, recurrence: ReminderRecurrence): string {
  const base = new Date(dueIso);
  if (Number.isNaN(base.getTime())) return dueIso;
  if (recurrence === 'daily') base.setDate(base.getDate() + 1);
  else if (recurrence === 'weekly') base.setDate(base.getDate() + 7);
  else if (recurrence === 'monthly') base.setMonth(base.getMonth() + 1);
  return base.toISOString().slice(0, 16);
}

const NOTIFIED_EVENTS_KEY = 'neuron_mind_notified_calendar_events_v1';

function loadNotifiedEventsSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(NOTIFIED_EVENTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? new Set(arr.filter((x): x is string => typeof x === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function saveNotifiedEventsSet(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      NOTIFIED_EVENTS_KEY,
      JSON.stringify(Array.from(ids).slice(-250))
    );
  } catch {
    // ignore storage errors
  }
}

function makeNotifId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useReminderScheduler(
  reminders: ReminderItem[],
  onMarkNotified: (id: string, nextDueAt?: string) => void,
  onLogTriggered: (reminder: ReminderItem) => void,
  events: CalendarEvent[] = [],
  scheduledActions: ScheduledEventAction[] = [],
  onExecuteScheduledEvent?: (
    event: CalendarEvent,
    action?: ScheduledEventAction
  ) => Promise<{ outcome?: string; failed?: boolean } | undefined>
) {
  const [activeDueAlert, setActiveDueAlert] = useState<ReminderItem | null>(null);
  const [activeEventAlert, setActiveEventAlert] = useState<ActiveEventAlert | null>(null);
  const [cornerNotifications, setCornerNotifications] = useState<CornerNotificationItem[]>(
    []
  );
  const notifiedEventsRef = useRef<Set<string>>(loadNotifiedEventsSet());
  const inFlightEventsRef = useRef<Set<string>>(new Set());

  const pushCornerNotification = useCallback(
    (item: Omit<CornerNotificationItem, 'id' | 'createdAt'>) => {
      const entry: CornerNotificationItem = {
        ...item,
        id: makeNotifId(),
        createdAt: new Date().toISOString(),
      };
      setCornerNotifications((prev) => [entry, ...prev].slice(0, 5));
    },
    []
  );

  const dismissCornerNotification = useCallback((id: string) => {
    setCornerNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const checkDueItems = async () => {
      const nowMs = Date.now();

      // 1. Check Reminders
      for (const rem of reminders) {
        if (rem.completed) continue;
        const dueMs = new Date(rem.dueAt).getTime();
        if (Number.isNaN(dueMs) || dueMs > nowMs) continue;

        if (rem.recurrence === 'none' && rem.notifiedAt) {
          continue;
        }

        if (rem.notifiedAt && nowMs - new Date(rem.notifiedAt).getTime() < 45000) {
          continue;
        }

        setActiveDueAlert(rem);
        pushCornerNotification({
          kind: 'reminder',
          title: rem.title,
          body: rem.dueAt,
          statusLabel: rem.recurrence !== 'none' ? rem.recurrence : undefined,
          statusTone: 'warning',
          actionSection: 'tasks',
        });
        await sendLocalNotification('Neuron Mind Reminder', rem.title);
        onLogTriggered(rem);

        if (rem.recurrence !== 'none') {
          const next = computeNextRecurrence(rem.dueAt, rem.recurrence);
          onMarkNotified(rem.id, next);
        } else {
          onMarkNotified(rem.id);
        }
      }

      // 2. Check Calendar Events (fire once startTime arrives)
      for (const ev of events) {
        const startMs = new Date(ev.startTime).getTime();
        if (Number.isNaN(startMs) || startMs > nowMs) continue;

        const ageMs = nowMs - startMs;
        const eventKey = `${ev.id}::${ev.startTime}`;
        const linkedAction = scheduledActions.find((a) => a.eventId === ev.id);

        if (
          notifiedEventsRef.current.has(eventKey) ||
          inFlightEventsRef.current.has(eventKey)
        ) {
          continue;
        }

        if (
          ageMs > 12 * 60 * 60 * 1000 &&
          (!linkedAction || linkedAction.actionStatus !== 'pending')
        ) {
          notifiedEventsRef.current.add(eventKey);
          saveNotifiedEventsSet(notifiedEventsRef.current);
          continue;
        }

        inFlightEventsRef.current.add(eventKey);
        notifiedEventsRef.current.add(eventKey);
        saveNotifiedEventsSet(notifiedEventsRef.current);

        try {
          const bodyParts = [ev.title];
          if (ev.location) bodyParts.push(ev.location);
          await sendLocalNotification('Neuron Mind Calendar Event', bodyParts.join(' · '));

          let actionOutcome: string | undefined;
          let actionFailed = false;
          if (onExecuteScheduledEvent) {
            const res = await onExecuteScheduledEvent(ev, linkedAction);
            actionOutcome = res?.outcome;
            actionFailed = Boolean(res?.failed);
          }

          setActiveEventAlert({
            event: ev,
            action: linkedAction,
            actionOutcome,
          });

          pushCornerNotification({
            kind: 'calendar',
            title: ev.title,
            body: ev.location ? `${ev.startTime} · ${ev.location}` : ev.startTime,
            meta: actionOutcome,
            statusTone: actionFailed ? 'error' : 'info',
            actionSection: 'calendar',
          });
        } finally {
          inFlightEventsRef.current.delete(eventKey);
        }
      }
    };

    void checkDueItems();
    const timer = window.setInterval(() => {
      void checkDueItems();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    reminders,
    onMarkNotified,
    onLogTriggered,
    events,
    scheduledActions,
    onExecuteScheduledEvent,
    pushCornerNotification,
  ]);

  return {
    activeDueAlert,
    dismissDueAlert: () => setActiveDueAlert(null),
    activeEventAlert,
    dismissEventAlert: () => setActiveEventAlert(null),
    cornerNotifications,
    pushCornerNotification,
    dismissCornerNotification,
  };
}
