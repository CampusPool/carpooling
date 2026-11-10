<?php
namespace STS\Mobility\Commute;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
final class PesTimetableController {
 public function show(Request $r) {
  $row=DB::table('mobility_pes_timetables')->where('user_id',$r->user()->id)->first();
  return response()->json(['data'=>$row?json_decode($row->entries,true,512,JSON_THROW_ON_ERROR):[]])->header('Cache-Control','no-store');
 }
 public function save(Request $r) {
  $v=$r->validate(['entries'=>'required|array|min:1|max:300','entries.*'=>'required|array:day,dayName,slot,option,start,end,title','entries.*.day'=>'required|integer|between:1,7','entries.*.dayName'=>'required|string|max:20','entries.*.slot'=>'required|integer|between:1,100','entries.*.option'=>'required|integer|between:1,100','entries.*.start'=>'required|date_format:H:i','entries.*.end'=>'required|date_format:H:i','entries.*.title'=>'required|string|max:300']);
  $seen=[];foreach($v['entries'] as $e){$key=$e['day'].':'.$e['slot'].':'.$e['option'];if($e['start'] >= $e['end']||isset($seen[$key]))throw ValidationException::withMessages(['entries'=>'Invalid timetable.']);$seen[$key]=true;}
  $userId=$r->user()->id;$json=json_encode(array_values($v['entries']),JSON_THROW_ON_ERROR);$now=now();
  DB::table('mobility_pes_timetables')->upsert([['user_id'=>$userId,'entries'=>$json,'created_at'=>$now,'updated_at'=>$now]],['user_id'],['entries','updated_at']);
  return response()->json(['saved'=>true,'count'=>count($v['entries'])])->header('Cache-Control','no-store');
 }
 public function destroy(Request $r) {DB::table('mobility_pes_timetables')->where('user_id',$r->user()->id)->delete();return response()->json(['deleted'=>true])->header('Cache-Control','no-store');}
}
