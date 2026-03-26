/**
 * Browser notification + audio alert system for critical alerts
 */

let notificationPermission: NotificationPermission = "default";

/** Request notification permission on first user interaction */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") {
    notificationPermission = "granted";
    return true;
  }
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  notificationPermission = result;
  return result === "granted";
}

/** Send a browser notification */
export function sendBrowserNotification(title: string, body: string, severity: string) {
  if (notificationPermission !== "granted") return;
  try {
    const icon = severity === "critical"
      ? "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔴</text></svg>"
      : "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚠️</text></svg>";
    
    new Notification(title, {
      body,
      icon,
      tag: `netwatch-${Date.now()}`,
      requireInteraction: severity === "critical",
    });
  } catch {
    // Notification API might not be available
  }
}

/** Play an alert tone using Web Audio API (no external files needed) */
export function playAlertTone(severity: string) {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (severity === "critical") {
      // Urgent two-tone siren
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.45);
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.6);
    } else {
      // Soft single chime for warnings
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Web Audio API might not be available
  }
}

/** Export alerts to CSV */
export function exportAlertsCsv(alerts: any[]) {
  const header = "ID,Timestamp,Type,Severity,Category,Title,Message,Source IP,Dismissed\n";
  const rows = alerts.map((a) => {
    const ts = new Date(a.timestamp).toISOString();
    const msg = `"${(a.message || "").replace(/"/g, '""')}"`;
    const title = `"${(a.title || "").replace(/"/g, '""')}"`;
    return `${a.id},${ts},${a.type},${a.severity},${a.category || ""},${title},${msg},${a.sourceIp || ""},${a.dismissed ? "yes" : "no"}`;
  });
  const csv = header + rows.join("\n");
  downloadFile(csv, "netwatch-alerts.csv", "text/csv");
}

/** Export alerts to JSON */
export function exportAlertsJson(alerts: any[]) {
  const json = JSON.stringify(alerts, null, 2);
  downloadFile(json, "netwatch-alerts.json", "application/json");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
