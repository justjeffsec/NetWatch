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
  type: text("type").notNull(),
  // Types: "threshold" | "spike" | "new_device" | "suspicious_port"
  //        "connection_spike" | "port_scan" | "dns_anomaly" | "geo_anomaly"
  //        "rapid_reconnect" | "unusual_protocol" | "large_transfer" | "unusual_outbound"
  severity: text("severity").notNull(), // "info" | "warning" | "critical"
  title: text("title").notNull(),
  message: text("message").notNull(),
  dismissed: integer("dismissed").notNull().default(0),
  sourceIp: text("source_ip"), // optional: the IP that triggered the alert
  category: text("category"), // "security" | "performance" | "network"
});

export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Alert thresholds (user configurable)
export const alertThresholds = sqliteTable("alert_thresholds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  metric: text("metric").notNull().unique(), // "bandwidth_in" | "bandwidth_out" | "connections" | "connections_per_min"
  thresholdValue: real("threshold_value").notNull(),
  enabled: integer("enabled").notNull().default(1),
});

export const insertAlertThresholdSchema = createInsertSchema(alertThresholds).omit({ id: true });
export type InsertAlertThreshold = z.infer<typeof insertAlertThresholdSchema>;
export type AlertThreshold = typeof alertThresholds.$inferSelect;

// Known devices — tracks IPs that have been seen on the network
export const knownDevices = sqliteTable("known_devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ipAddress: text("ip_address").notNull().unique(),
  firstSeen: integer("first_seen").notNull(), // unix ms
  lastSeen: integer("last_seen").notNull(), // unix ms
  label: text("label"), // user-assigned friendly name
  trusted: integer("trusted").notNull().default(0), // 0 = unknown, 1 = trusted
  // GeoIP fields
  country: text("country"),       // e.g. "US"
  countryName: text("country_name"), // e.g. "United States"
  city: text("city"),             // e.g. "Mountain View"
  lat: real("lat"),               // latitude
  lon: real("lon"),               // longitude
  org: text("org"),               // ISP/org name
  // Threat intel
  threatLevel: text("threat_level"), // "safe" | "suspicious" | "malicious" | null
  threatSource: text("threat_source"), // which blocklist flagged it
});

export const insertKnownDeviceSchema = createInsertSchema(knownDevices).omit({ id: true });
export type InsertKnownDevice = z.infer<typeof insertKnownDeviceSchema>;
export type KnownDevice = typeof knownDevices.$inferSelect;

// Flow records — per-connection traffic tracking for analysis
export const flowRecords = sqliteTable("flow_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp").notNull(),    // unix ms (bucket start)
  remoteAddr: text("remote_addr").notNull(),
  remotePort: integer("remote_port").notNull(),
  protocol: text("protocol").notNull(),           // "tcp" | "udp"
  family: text("family").notNull(),                // "ipv4" | "ipv6"
  service: text("service").notNull(),              // classified: "HTTPS", "DNS", "SSH", etc.
  process: text("process"),                        // process name if known
  bytesIn: real("bytes_in").notNull().default(0),
  bytesOut: real("bytes_out").notNull().default(0),
  connectionCount: integer("connection_count").notNull().default(1),
});

export const insertFlowRecordSchema = createInsertSchema(flowRecords).omit({ id: true });
export type InsertFlowRecord = z.infer<typeof insertFlowRecordSchema>;
export type FlowRecord = typeof flowRecords.$inferSelect;
