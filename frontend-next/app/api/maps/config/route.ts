const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export function GET() {
  const key = process.env.MOBILITY_GOOGLE_MAPS_BROWSER_KEY?.trim();
  if (!key || !/^AIza[0-9A-Za-z_-]{35}$/.test(key)) {
    return Response.json({ error: "MAPS_NOT_CONFIGURED" }, { status: 404, headers });
  }

  return Response.json({ browser_key: key }, { headers });
}
