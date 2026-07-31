import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getDailyWordAndLength } from '../data/wordlist';

/**
 * Schedules daily reminder notifications for the next 7 days.
 * If the user has already completed the daily puzzle for today, today's notification is skipped.
 */
export async function scheduleDailyNotifications() {
  try {
    // 1. Check if we are running in a native Capacitor environment (Android/iOS)
    const isNative = Capacitor.isNativePlatform();
    
    // Check local storage setting first
    const savedSettings = localStorage.getItem('kelimesavasi_settings');
    let notificationEnabled = true;
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.notificationEnabled === false) {
          notificationEnabled = false;
        }
      } catch (e) {
        console.error('Error parsing settings for notifications:', e);
      }
    }

    if (!notificationEnabled) {
      console.log('[Notification Service] Notifications are disabled in settings. Clearing any pending notifications.');
      if (isNative) {
        await clearScheduledNotifications();
      }
      return;
    }

    // 2. Determine if today's daily puzzle is already completed
    const todayDateStr = getDailyWordAndLength().dateStr;
    const isCompletedToday = localStorage.getItem('kelimesavasi_daily_completed_date') === todayDateStr;

    if (isNative) {
      // Request permission if not already granted
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        const reqStatus = await LocalNotifications.requestPermissions();
        if (reqStatus.display !== 'granted') {
          console.warn('[Notification Service] Native notification permission denied.');
          return;
        }
      }

      // Create high importance notification channel for heads-up top banners
      try {
        await LocalNotifications.createChannel({
          id: 'kelimesavasi_daily_channel',
          name: 'Günün Kelimesi Bildirimleri',
          description: 'Günün kelimesi ve özel kelime oyunu hatırlatıcıları',
          importance: 5, // High importance for heads-up visible banner display
          visibility: 1, // Public lockscreen visibility
          vibration: true,
          lights: true,
          lightColor: '#10B981'
        });
      } catch (e) {
        console.warn('[Notification Service] Channel creation warning:', e);
      }

      // Clear any previously scheduled daily notifications
      await clearScheduledNotifications();

      const now = new Date();
      const notificationsToSchedule = [];

      // Schedule reminders for the next 7 days (day 0 to 6)
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date();
        targetDate.setDate(now.getDate() + i);
        targetDate.setHours(9, 0, 0, 0); // Scheduled for 09:00 AM

        // Skip if targetDate is in the past
        if (targetDate.getTime() <= now.getTime()) {
          continue;
        }

        // Conflict Management: Skip today's notification if today's daily puzzle is already completed
        if (i === 0 && isCompletedToday) {
          console.log('[Notification Service] Today\'s daily puzzle is already completed. Skipping 09:00 notification for today.');
          continue;
        }

        notificationsToSchedule.push({
          title: 'Günün Kelimesi Hazır! ☀️',
          body: 'Yeni gün, yeni bir kelime! Bakalım bugünkü günlük bulmacayı kaçıncı denemede bulacaksın? Hadi hemen oyna! 🧠',
          id: 9000 + i,
          channelId: 'kelimesavasi_daily_channel',
          schedule: {
            at: targetDate
          },
          sound: undefined,
          attachments: undefined,
          actionTypeId: '',
          extra: null
        });
      }

      if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({
          notifications: notificationsToSchedule
        });
        console.log(`[Notification Service] Successfully scheduled ${notificationsToSchedule.length} native notifications starting at 09:00 AM.`);
      }
    } else {
      // Web Fallback
      console.log('[Notification Service] Web platform detected. Standard web notifications will be triggered on app load if permitted.');
      
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          // Request permission non-intrusively
          Notification.requestPermission();
        }
        
        // Since background notifications on web are not durable without complex Push service,
        // we can schedule a browser timeout if the tab remains open, just as a bonus!
        const now = new Date();
        const targetToday = new Date();
        targetToday.setHours(9, 0, 0, 0);

        if (targetToday.getTime() > now.getTime() && !isCompletedToday) {
          const delay = targetToday.getTime() - now.getTime();
          // Maximum delay for setTimeout is 2147483647 (approx 24.8 days)
          if (delay < 2147483647) {
            console.log(`[Notification Service] Web reminder timer set for 09:00 AM today (in ${Math.round(delay / 60000)} minutes).`);
            setTimeout(() => {
              // Re-verify at trigger time
              const isStillCompletedToday = localStorage.getItem('kelimesavasi_daily_completed_date') === getDailyWordAndLength().dateStr;
              if (Notification.permission === 'granted' && !isStillCompletedToday) {
                new Notification('Günün Kelimesi Hazır! ☀️', {
                  body: 'Yeni gün, yeni bir kelime! Bakalım bugünkü günlük bulmacayı kaçıncı denemede bulacaksın? Hadi hemen oyna! 🧠',
                  icon: '/favicon.ico'
                });
              }
            }, delay);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Notification Service] Error scheduling notifications:', error);
  }
}

/**
 * Clears all daily puzzle notifications scheduled by this utility.
 */
export async function clearScheduledNotifications() {
  try {
    if (Capacitor.isNativePlatform()) {
      const pending = await LocalNotifications.getPending();
      const dailyPendingIds = pending.notifications
        .filter(n => n.id >= 9000 && n.id <= 9007)
        .map(n => ({ id: n.id }));

      if (dailyPendingIds.length > 0) {
        await LocalNotifications.cancel({
          notifications: dailyPendingIds
        });
        console.log(`[Notification Service] Cleared ${dailyPendingIds.length} pending native notifications.`);
      }
    }
  } catch (error) {
    console.error('[Notification Service] Error clearing notifications:', error);
  }
}
