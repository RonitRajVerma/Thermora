import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const telemetry = sqliteTable("telemetry", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: text("device_id").notNull(),
  timestamp: integer("timestamp", { mode: 'timestamp' }).notNull(),
  hotTemperature: real("hot_temperature"),
  coldTemperature: real("cold_temperature"),
  ambientTemperature: real("ambient_temperature"),
  humidity: real("humidity"),
  flowRate: real("flow_rate"),
  pumpState: integer("pump_state", { mode: 'boolean' }),
  firmwareVersion: text("firmware_version")
});

export const scenarios = sqliteTable("scenarios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  params: text("params").notNull(), // JSON
  results: text("results").notNull() // JSON
});
