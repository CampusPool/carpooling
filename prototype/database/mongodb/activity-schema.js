// Run with: mongosh "$MONGODB_URI" --file database/mongodb/activity-schema.js
// The relational MySQL database remains authoritative for rides, bookings and seats.
const campusPool = db.getSiblingDB("campuspool");

function ensureCollection(name, validator) {
  if (campusPool.getCollectionNames().includes(name)) {
    campusPool.runCommand({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
  } else {
    campusPool.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
  }
}

ensureCollection("activity_events", {
  $jsonSchema: {
    bsonType: "object",
    required: ["event_id", "event_type", "occurred_at", "trip_id", "actor_id", "payload"],
    properties: {
      event_id: { bsonType: "string", minLength: 1, maxLength: 100 },
      event_type: { bsonType: "string", minLength: 1, maxLength: 80 },
      occurred_at: { bsonType: "date" },
      trip_id: { bsonType: ["int", "long"] },
      actor_id: { bsonType: ["int", "long"] },
      payload: { bsonType: "object" },
    },
  },
});

ensureCollection("notifications", {
  $jsonSchema: {
    bsonType: "object",
    required: ["notification_id", "recipient_id", "kind", "created_at", "read_at"],
    properties: {
      notification_id: { bsonType: "string", minLength: 1, maxLength: 100 },
      recipient_id: { bsonType: ["int", "long"] },
      kind: { bsonType: "string", minLength: 1, maxLength: 80 },
      trip_id: { bsonType: ["int", "long"] },
      created_at: { bsonType: "date" },
      read_at: { bsonType: ["date", "null"] },
      data: { bsonType: "object" },
    },
  },
});

campusPool.activity_events.createIndex({ event_id: 1 }, { unique: true, name: "activity_event_identity" });
campusPool.activity_events.createIndex({ trip_id: 1, occurred_at: -1 }, { name: "activity_by_trip_time" });
campusPool.activity_events.createIndex({ event_type: 1, occurred_at: -1 }, { name: "activity_by_type_time" });
campusPool.notifications.createIndex({ notification_id: 1 }, { unique: true, name: "notification_identity" });
campusPool.notifications.createIndex({ recipient_id: 1, read_at: 1, created_at: -1 }, { name: "inbox_by_recipient_status_time" });

// Genuine daily activity aggregation. Empty databases return an empty array.
const dailyActivity = campusPool.activity_events.aggregate([
  { $match: { occurred_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
  {
    $group: {
      _id: {
        day: { $dateTrunc: { date: "$occurred_at", unit: "day", timezone: "Asia/Kolkata" } },
        event_type: "$event_type",
      },
      event_count: { $sum: 1 },
      trip_count: { $addToSet: "$trip_id" },
    },
  },
  { $project: { _id: 0, day: "$_id.day", event_type: "$_id.event_type", event_count: 1, trip_count: { $size: "$trip_count" } } },
  { $sort: { day: 1, event_type: 1 } },
]).toArray();

printjson(dailyActivity);
