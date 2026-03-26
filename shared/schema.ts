import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Bandwidth snapshots (aggregated per interval)
export const bandwidthSnapshots = sqliteTable("bandwidth_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp").notNull(), // unix ms
  interface: text("interface").notNull(),
  bytesIn: real("bytes_in").notNull(),
  bytesOut: real("bytes_out").notNull(),
  rateIn: real("rate_in").notNull(), // bytes/sec
  rateOut: real("rate_out").notNull(),
  protocol: text("protocol").notNull(), // "ipv4" | "ipv6" | "total"
});

export const insertBandwidthSnapshotSchema = createInsertSchema(bandwidthSnapshots).omit({ id: true });
export type InsertBandwidthSnapshot = z.infer<typeof insertBandwidthSnapshotSchema>;
export type BandwidthSnapshot = typeof bandwidthSnapshots.$inferSelect;

// Active connections log
export const connections = sqliteTable("connections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp").notNull(),
  protocol: text("protocol").notNull(), // "tcp" | "udp"
  family: text("family").notNull(), // "ipv4" | "ipv6"
  localAddr: text("local_addr").notNull(),
  localPort: integer("local_port").notNull(),
  remoteAddr: text("remote_addr").notNull(),
  remotePort: integer("remote_port").notNull(),
  status: text("status").notNull(),
  pid: integer("pid"),
  process: text("process"),
});

export const insertConnectionSchema = createInsertSchema(connections).omit({ id: true });
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;

// Alerts
export const alerts = sqliteTable("alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp").notNull(),
  type: text("type").notNull(), // "spike" | "new_device" | "threshold"
  severity: text("severity").notNull(), // "info" | "warning" | "critical"
  title: text("title").notNull(),
  message: text("message").notNull(),
  dismissed: integer("dismissed").notNull().default(0),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Alert thresholds (user configurable)
export const alertThresholds = sqliteTable("alert_thresholds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  metric: text("metric").notNull(), // "bandwidth_in" | "bandwidth_out" | "connections"
  thresholdValue: real("threshold_value").notNull(),
  enabled: integer("enabled").notNull().default(1),
});

export const insertAlertThresholdSchema = createInsertSchema(alertThresholds).omit({ id: true });
export type InsertAlertThreshold = z.infer<typeof insertAlertThresholdSchema>;
export type AlertThreshold = typeof alertThresholds.$inferSelect;
