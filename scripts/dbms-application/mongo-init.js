// Only this disposable analytics database is writable by the app projection.
db = db.getSiblingDB('mobility_analytics');
db.createUser({user: 'activity_app', pwd: process.env.MOBILITY_MONGO_APP_PASSWORD,
  roles: [{role: 'readWrite', db: 'mobility_analytics'}, {role: 'dbAdmin', db: 'mobility_analytics'}]});
