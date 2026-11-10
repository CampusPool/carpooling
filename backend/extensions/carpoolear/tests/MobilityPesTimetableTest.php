<?php
namespace Tests\Feature\Mobility;
use Tests\TestCase;
use Illuminate\Support\Facades\DB;
use STS\Models\User;
final class MobilityPesTimetableTest extends TestCase {
 protected function beforeRefreshingDatabase():void {if(!preg_match('/^testing[a-zA-Z0-9_-]*$/',DB::connection()->getDatabaseName()))throw new \RuntimeException('Refusing non-test database');}
 public function test_save_read_isolation_invalid_update_and_delete():void {
  $a=User::findOrFail($this->postJson('/api/mobility/local-auth/register',['username'=>'tt_user_a','password'=>'local-test-123','role'=>'rider'])->assertCreated()->json('user.id'));
  $b=User::findOrFail($this->postJson('/api/mobility/local-auth/register',['username'=>'tt_user_b','password'=>'local-test-456','role'=>'rider'])->assertCreated()->json('user.id'));
  $path='/api/mobility/commute/pes-timetable';$entry=['day'=>1,'dayName'=>'Monday','slot'=>1,'option'=>1,'start'=>'08:00','end'=>'09:00','title'=>'Synthetic class'];
  $this->actingAsApiUser($a)->putJson($path,['entries'=>[$entry]])->assertOk()->assertJsonPath('count',1);
  $this->actingAsApiUser($b)->getJson($path)->assertOk()->assertJsonCount(0,'data');
  $this->actingAsApiUser($a)->putJson($path,['entries'=>[array_merge($entry,['end'=>'07:00'])]])->assertStatus(422);
  $this->actingAsApiUser($a)->getJson($path)->assertOk()->assertJsonPath('data.0.title','Synthetic class');
  $this->actingAsApiUser($b)->deleteJson($path)->assertOk();$this->actingAsApiUser($a)->getJson($path)->assertJsonCount(1,'data');
  $this->actingAsApiUser($a)->deleteJson($path)->assertOk();$this->actingAsApiUser($a)->getJson($path)->assertJsonCount(0,'data');
 }
}
