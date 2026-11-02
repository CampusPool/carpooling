const origin = process.env.MOBILITY_API_ORIGIN || 'http://127.0.0.1:18080';
export default {
  async rewrites() {
    return [
      { source: '/api/login', destination: `${origin}/api/login` },
      { source: '/api/cars', destination: `${origin}/api/cars` },
      { source: '/api/car-colors', destination: `${origin}/api/car-colors` },
      { source: '/api/mobility/:path*', destination: `${origin}/api/mobility/:path*` },
      { source: '/api/admin/:path*', destination: `${origin}/api/admin/:path*` },
      { source: '/mobility-pilot/:path*', destination: `${origin}/mobility-pilot/:path*` },
    ];
  },
};
