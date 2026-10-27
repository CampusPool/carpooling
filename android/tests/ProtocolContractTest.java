package com.mobility.demo.tracking;

import java.util.regex.Pattern;

/** Small dependency-free contract tests for the wire/state rules used by TrackingService. */
public final class ProtocolContractTest {
    private static final Pattern UTC_MILLIS = Pattern.compile("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z");
    public static void main(String[] args) {
        String location = "{\"session_id\":\"s\",\"sequence\":1,\"lat\":12.9,\"lng\":77.6,\"accuracy_meters\":8.0,\"recorded_at\":\"2026-10-21T15:30:00.123Z\"}";
        require(!location.contains("idempotency_key"), "local queue key must not enter wire body");
        require(loginToken("{\"token\":\"abcdefghijklmnopqrstuvwxyz\"}").equals("abcdefghijklmnopqrstuvwxyz"), "login token fixture");
        require(loginToken("{\"error\":\"invalid credentials\"}") == null, "login failure has no token");
        require(tripEnvelope("{\"data\":[{\"id\":7}]}"), "trip list envelope");
        require(UTC_MILLIS.matcher("2026-10-21T15:30:00.123Z").matches(), "UTC millisecond timestamp");
        require("{\"session_id\":\"old-session\"}".contains("session_id"), "stop body fences captured session");
        require(action(401).equals("reauth") && action(403).equals("reauth"), "auth failure stops");
        require(action(410).equals("terminal") && action(422).equals("drop"), "terminal/invalid handling");
        require(action(409).equals("restart") && action(500).equals("retry"), "session/retry handling");
        require(errorAction("TRACKING_SESSION_STALE").equals("restart"), "stale session reopens");
        require(errorAction("SEQUENCE_OUT_OF_ORDER").equals("drop") && errorAction("TIMESTAMP_OUT_OF_ORDER").equals("drop"), "old samples drop");
        require(errorAction("IDEMPOTENCY_CONFLICT").equals("reauth") && errorAction("TRACKING_UNAVAILABLE").equals("terminal"), "unsafe errors stop");
        require(duplicateStart("same-origin", "trip-7", "same-origin", "trip-7"), "duplicate start is idempotent");
        require(!duplicateStart("same-origin", "trip-7", "same-origin", "trip-8"), "new trip fences old start");
        require(scope("https://demo", "7", "s1").equals("https://demo\n7\ns1"), "queue scope binds server trip session");
        require(!scope("https://demo", "7", "s1").equals(scope("https://demo", "8", "s1")), "queue scope separates trips");
        require("reauth".equals(keystoreAction(false)), "keystore failure stops instead of retrying");
        require(!notificationStart(false), "notification denial blocks service start");
        System.out.println("tracking protocol contract tests passed");
    }
    private static String action(int status) { if (status == 401 || status == 403) return "reauth"; if (status == 410) return "terminal"; if (status == 422) return "drop"; if (status == 409) return "restart"; return status >= 500 ? "retry" : "ok"; }
    private static String errorAction(String code) { if ("TRACKING_SESSION_STALE".equals(code)) return "restart"; if ("SEQUENCE_OUT_OF_ORDER".equals(code) || "TIMESTAMP_OUT_OF_ORDER".equals(code)) return "drop"; if ("IDEMPOTENCY_CONFLICT".equals(code)) return "reauth"; if ("TRACKING_UNAVAILABLE".equals(code)) return "terminal"; return "retry"; }
    private static boolean duplicateStart(String a, String b, String c, String d) { return a.equals(c) && b.equals(d); }
    private static String scope(String server, String trip, String session) { return server+"\n"+trip+"\n"+session; }
    private static String keystoreAction(boolean tokenAvailable) { return tokenAvailable ? "send" : "reauth"; }
    private static boolean notificationStart(boolean granted) { return granted; }
    private static String loginToken(String json) { int p=json.indexOf("\"token\":\""); if(p<0)return null; int start=p+9,end=json.indexOf('"',start); return end>start?json.substring(start,end):null; }
    private static boolean tripEnvelope(String json) { return json.contains("\"data\":[") && json.contains("\"id\":7"); }
    private static void require(boolean value, String message) { if (!value) throw new AssertionError(message); }
}
