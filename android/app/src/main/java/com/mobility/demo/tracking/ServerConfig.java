package com.mobility.demo.tracking;

import android.net.Uri;
import java.util.Locale;

final class ServerConfig {
    private ServerConfig() {}
    static String checkedBase(String value, boolean debug) {
        if (value == null || value.length() > 256) throw new IllegalArgumentException("missing server");
        Uri u = Uri.parse(value.trim()); String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.US);
        if (u.getUserInfo() != null || u.getQuery() != null || u.getFragment() != null || u.getHost() == null) throw new IllegalArgumentException("invalid server origin");
        if ("https".equals(scheme)) return value.replaceAll("/$", "");
        if (debug && "http".equals(scheme) && (u.getHost().equals("127.0.0.1") || u.getHost().equals("10.0.2.2") || u.getHost().startsWith("192.168."))) return value.replaceAll("/$", "");
        throw new IllegalArgumentException("HTTPS required (HTTP is LAN debug-only)");
    }
}
