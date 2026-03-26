import { 
  bandwidthSnapshots, connections, alerts, alertThresholds, knownDevices,
  type InsertBandwidthSnapshot, type BandwidthSnapshot,
  type InsertConnection, type Connection,
  type InsertAlert, type Alert,
  type InsertAlertThreshold, type AlertThreshold,
  type InsertKnownDevice, type KnownDevice,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, gte, and } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
export const db = drizzle(sqlite);

export interface IStorage {
  // Bandwidth
  addBandwidthSnapshot(data: InsertBandwidthSnapshot): BandwidthSnapshot;
  getBandwidthSnapshots(since: number, iface?: string): BandwidthSnapshot[];
  getLatestBandwidth(): BandwidthSnapshot[];

  // Connections
  addConnection(data: InsertConnection): Connection;
  getConnections(limit?: number): Connection[];
  getActiveConnections(): Connection[];

  // Alerts
  addAlert(data: InsertAlert): Alert;
  getAlerts(limit?: number): Alert[];
  dismissAlert(id: number): void;
  dismissAllAlerts(): void;

  // Thresholds
  getThresholds(): AlertThreshold[];
  upsertThreshold(data: InsertAlertThreshold): AlertThreshold;
  deleteThreshold(id: number): void;

  // Known Devices
  getKnownDevices(): KnownDevice[];
  getKnownDeviceByIp(ip: string): KnownDevice | undefined;
  addKnownDevice(data: InsertKnownDevice): KnownDevice;
  updateDeviceLastSeen(ip: string, timestamp: number): void;
  trustDevice(id: number, trusted: boolean): void;
  labelDevice(id: number, label: string): void;
}

export class DatabaseStorage implements IStorage {
  addBandwidthSnapshot(data: InsertBandwidthSnapshot): BandwidthSnapshot {
    return db.insert(bandwidthSnapshots).values(data).returning().get();
  }

  getBandwidthSnapshots(since: number, iface?: string): BandwidthSnapshot[] {
    if (iface) {
      return db.select().from(bandwidthSnapshots)
        .where(and(gte(bandwidthSnapshots.timestamp, since), eq(bandwidthSnapshots.interface, iface)))
        .orderBy(bandwidthSnapshots.timestamp)
        .all();
    }
    return db.select().from(bandwidthSnapshots)
      .where(gte(bandwidthSnapshots.timestamp, since))
      .orderBy(bandwidthSnapshots.timestamp)
      .all();
  }

  getLatestBandwidth(): BandwidthSnapshot[] {
    return db.select().from(bandwidthSnapshots)
      .orderBy(desc(bandwidthSnapshots.timestamp))
      .limit(20)
      .all();
  }

  addConnection(data: InsertConnection): Connection {
    return db.insert(connections).values(data).returning().get();
  }

  getConnections(limit: number = 200): Connection[] {
    return db.select().from(connections)
      .orderBy(desc(connections.timestamp))
      .limit(limit)
      .all();
  }

  getActiveConnections(): Connection[] {
    return db.select().from(connections)
      .where(eq(connections.status, "ESTABLISHED"))
      .orderBy(desc(connections.timestamp))
      .limit(500)
      .all();
  }

  addAlert(data: InsertAlert): Alert {
    return db.insert(alerts).values(data).returning().get();
  }

  getAlerts(limit: number = 100): Alert[] {
    return db.select().from(alerts)
      .orderBy(desc(alerts.timestamp))
      .limit(limit)
      .all();
  }

  dismissAlert(id: number): void {
    db.update(alerts).set({ dismissed: 1 }).where(eq(alerts.id, id)).run();
  }

  dismissAllAlerts(): void {
    db.update(alerts).set({ dismissed: 1 }).run();
  }

  getThresholds(): AlertThreshold[] {
    return db.select().from(alertThresholds).all();
  }

  upsertThreshold(data: InsertAlertThreshold): AlertThreshold {
    return db.insert(alertThresholds).values(data).returning().get();
  }

  deleteThreshold(id: number): void {
    db.delete(alertThresholds).where(eq(alertThresholds.id, id)).run();
  }

  // --- Known Devices ---

  getKnownDevices(): KnownDevice[] {
    return db.select().from(knownDevices)
      .orderBy(desc(knownDevices.lastSeen))
      .all();
  }

  getKnownDeviceByIp(ip: string): KnownDevice | undefined {
    return db.select().from(knownDevices)
      .where(eq(knownDevices.ipAddress, ip))
      .get();
  }

  addKnownDevice(data: InsertKnownDevice): KnownDevice {
    return db.insert(knownDevices).values(data).returning().get();
  }

  updateDeviceLastSeen(ip: string, timestamp: number): void {
    db.update(knownDevices)
      .set({ lastSeen: timestamp })
      .where(eq(knownDevices.ipAddress, ip))
      .run();
  }

  trustDevice(id: number, trusted: boolean): void {
    db.update(knownDevices)
      .set({ trusted: trusted ? 1 : 0 })
      .where(eq(knownDevices.id, id))
      .run();
  }

  labelDevice(id: number, label: string): void {
    db.update(knownDevices)
      .set({ label })
      .where(eq(knownDevices.id, id))
      .run();
  }
}

export const storage = new DatabaseStorage();
