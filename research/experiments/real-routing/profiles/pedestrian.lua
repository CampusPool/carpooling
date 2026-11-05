-- Distance-optimizing pedestrian profile for the pinned OSRM image.
--
-- The upstream foot profile remains the source of access, barrier, oneway,
-- surface, and duration semantics.  Only the routing objective changes:
-- WayHandlers.weights sets rates to one for distance, while this wrapper keeps
-- the upstream turn duration/access processing and removes turn weight from
-- the distance objective.
local foot = dofile('/opt/foot.lua')

function setup()
  local profile = foot.setup()
  profile.properties.weight_name = 'distance'
  return profile
end

function process_way(profile, way, result, relations)
  return foot.process_way(profile, way, result, relations)
end

function process_node(profile, node, result, relations)
  return foot.process_node(profile, node, result, relations)
end

function process_relation(profile, relation)
  return foot.process_relation(profile, relation)
end

function process_turn(profile, turn)
  foot.process_turn(profile, turn)
  -- Turn duration, access and barrier decisions above remain upstream.  A
  -- distance graph must not add a duration penalty to its edge weight.
  turn.weight = 0
end

return {
  setup = setup,
  process_way = process_way,
  process_node = process_node,
  process_relation = process_relation,
  process_turn = process_turn,
}
