const assert = require('node:assert/strict');

async function main() {
  // mongosh returns BSON/VM wrapper prototypes; compare their JSON values.
  const plain = value => JSON.parse(JSON.stringify(value));
  // Isolated course read model; this does not test the application projector.
  const d = db.getSiblingDB('dbms_evidence_level3');
  assert.equal((await d.createCollection('activity', {
    validator: {$jsonSchema: {
      bsonType: 'object', required: ['sourceEventId', 'action'],
      properties: {sourceEventId: {bsonType: 'int'}, action: {bsonType: 'string'}}
    }}, validationLevel: 'strict', validationAction: 'error'
  })).ok, 1);
  const c = d.activity;
  assert.equal(await c.createIndex({sourceEventId: 1}, {unique: true}), 'sourceEventId_1');
  const index = (await c.getIndexes()).find(x => x.name === 'sourceEventId_1');
  assert.equal(index.unique, true);
  assert.deepEqual(plain(index.key), {sourceEventId: 1});
  const reject = async (label, fn, code) => {
    await assert.rejects(async () => await fn(), e => e.code === code, label);
    print(`PASS: Mongo ${label}`);
  };
  await reject('validator rejects missing action', () => c.insertOne({sourceEventId: 9}), 121);
  await reject('validator rejects wrong type', () => c.insertOne({sourceEventId: '9', action: 'publish'}), 121);
  assert.equal(await c.countDocuments(), 0);
  assert.equal((await c.insertMany([
    {sourceEventId: 1, action: 'publish', tripId: 10},
    {sourceEventId: 2, action: 'accept', tripId: 10},
    {sourceEventId: 3, action: 'publish', tripId: 11}
  ])).acknowledged, true);
  await reject('unique index rejects duplicate event', () => c.insertOne({sourceEventId: 1, action: 'publish'}), 11000);
  assert.equal(await c.countDocuments(), 3);
  assert.deepEqual(plain(await c.find({tripId: 10}, {_id: 0, sourceEventId: 1, action: 1})
    .sort({sourceEventId: 1}).toArray()), [
      {sourceEventId: 1, action: 'publish'}, {sourceEventId: 2, action: 'accept'}
    ]);
  const update = await c.updateOne({sourceEventId: 2}, {$set: {reviewed: true}});
  assert.equal(update.matchedCount, 1);
  assert.equal(update.modifiedCount, 1);
  assert.equal((await c.findOne({sourceEventId: 2})).reviewed, true);
  await reject('validator rejects invalid update', () => c.updateOne({sourceEventId: 2}, {$unset: {action: ''}}), 121);
  assert.equal((await c.findOne({sourceEventId: 2})).action, 'accept');
  assert.deepEqual(plain(await c.aggregate([
    {$group: {_id: '$action', count: {$sum: 1}}}, {$sort: {_id: 1}}
  ]).toArray()), [{_id: 'accept', count: 1}, {_id: 'publish', count: 2}]);
  assert.equal((await c.deleteOne({sourceEventId: 2})).deletedCount, 1);
  assert.equal(await c.countDocuments({sourceEventId: 2}), 0);
  assert.equal(await c.countDocuments(), 2);
  assert.equal((await c.findOne({sourceEventId: 1})).action, 'publish');
  print('PASS: Mongo collection, validator, unique index, create/read/update/delete and aggregation assertions');
}

// Explicit completion/exit prevents an unhandled Promise from appearing green.
main().then(() => quit(0), error => {
  print(`FAIL: Mongo ${error.message}`);
  quit(1);
});
