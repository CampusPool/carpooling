package com.mobility.demo.tracking;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

final class QueueStore {
    static final int MAX_ITEMS = 100;
    private final android.content.SharedPreferences prefs;
    QueueStore(Context c) { prefs = c.getSharedPreferences("private_tracking_queue", Context.MODE_PRIVATE); }
    synchronized void prepareContext(String server, String trip) { String next=server+"\n"+trip+"\n"; if(!next.equals(prefs.getString("scope", ""))) prefs.edit().clear().putString("scope", next).apply(); }
    synchronized void bindSession(String server, String trip, String session) { String next=server+"\n"+trip+"\n"+session; if(!next.equals(prefs.getString("scope", ""))) prefs.edit().clear().putString("scope", next).apply(); }
    synchronized void add(LocationPayload p) {
        JSONArray a = read(); if (a.length() >= MAX_ITEMS) a.remove(0);
        a.put(p.json()); prefs.edit().putString("items", a.toString()).apply();
    }
    synchronized List<LocationPayload> all() { JSONArray a = read(); List<LocationPayload> out = new ArrayList<>(); for (int i=0;i<a.length();i++) try { out.add(LocationPayload.from(a.getJSONObject(i))); } catch (Exception ignored) {} return out; }
    synchronized void remove(String idempotencyKey) { JSONArray a = read(), b = new JSONArray(); for (int i=0;i<a.length();i++) try { if (!idempotencyKey.equals(a.getJSONObject(i).getString("idempotency_key"))) b.put(a.getJSONObject(i)); } catch (Exception ignored) {} prefs.edit().putString("items", b.toString()).apply(); }
    synchronized void clear() { prefs.edit().remove("items").apply(); }
    private JSONArray read() { try { return new JSONArray(prefs.getString("items", "[]")); } catch (Exception e) { return new JSONArray(); } }
    static final class LocationPayload {
        final long sequence; final double lat,lng,accuracy; final String recordedAt,key;
        LocationPayload(long s,double la,double ln,double ac,String at) { sequence=s;lat=la;lng=ln;accuracy=ac;recordedAt=at;key=UUID.randomUUID().toString(); }
        JSONObject json() { JSONObject o=new JSONObject(); try { o.put("sequence",sequence).put("lat",lat).put("lng",lng).put("accuracy_meters",accuracy).put("recorded_at",recordedAt).put("idempotency_key",key); } catch(Exception ignored){} return o; }
        JSONObject body(String sessionId) { JSONObject o=new JSONObject(); try { o.put("session_id",sessionId).put("sequence",sequence).put("lat",lat).put("lng",lng).put("accuracy_meters",accuracy).put("recorded_at",recordedAt); } catch(Exception ignored){} return o; }
        static LocationPayload from(JSONObject o) throws Exception { LocationPayload p=new LocationPayload(o.getLong("sequence"),o.getDouble("lat"),o.getDouble("lng"),o.getDouble("accuracy_meters"),o.getString("recorded_at")); return new LocationPayload(p.sequence,p.lat,p.lng,p.accuracy,p.recordedAt,o.getString("idempotency_key")); }
        private LocationPayload(long s,double la,double ln,double ac,String at,String k) { sequence=s;lat=la;lng=ln;accuracy=ac;recordedAt=at;key=k; }
    }
}
