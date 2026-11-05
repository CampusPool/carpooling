-- Motorbike profile for the pinned OSRM v26.10.0 ARM64 image.
--
-- This is deliberately a small wrapper around the exact pinned car profile.
-- The car profile is mounted at /opt/car.lua by the bounded verifier/build
-- workflow; keeping it external prevents this file from drifting from the
-- engine's bundled profile.
-- The pinned upstream profile returns its callback table.  Reuse those exact
-- callbacks and replace only setup's mode-specific tables.
local car = dofile('/opt/car.lua')

function setup()
  local profile = car.setup()

  -- Preserve the car profile's mode, handler order, road classes, speeds,
  -- dimensions, barriers, surfaces, penalties, and oneway behavior.  Only
  -- the access/restriction hierarchy is mode-specific here.
  profile.access_tags_hierarchy = Sequence {
    'motorcycle',
    'motor_vehicle',
    'vehicle',
    'access'
  }
  profile.restrictions = Sequence {
    'motorcycle',
    'motor_vehicle',
    'vehicle'
  }

  -- WayHandlers.speed uses this set when a way has no highway-derived speed.
  -- Keeping motorcycle in the whitelist makes an explicit motorcycle=yes
  -- access override usable without adding bicycle shortcuts or speeds.
  profile.access_tag_whitelist['motorcycle'] = true

  return profile
end

return {
  setup = setup,
  process_way = car.process_way,
  process_node = car.process_node,
  process_turn = car.process_turn
}

