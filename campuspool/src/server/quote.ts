import { createHmac, timingSafeEqual } from 'node:crypto';
import { canonical, hash, HttpError } from './core';
import type { RideRow } from './types';
function secret():string {const value=process.env.SESSION_SECRET;if(!value||value.length<32)throw new Error('SESSION_SECRET must contain at least 32 characters');return value;}
export function rideDigest(r:RideRow):string {
  return hash(canonical([r.id,r.driver_id,r.vehicle_id,r.origin_stop_id,r.destination_stop_id,r.departure_at,r.total_seats,r.credit_price,r.status,r.vehicle_registration,r.vehicle_model,r.vehicle_kind,r.vehicle_capacity,r.vehicle_status,r.driver_status]));
}
export function issueQuote(userId:number,ride:RideRow):string {
  const value=Buffer.from(JSON.stringify({userId,rideId:ride.id,digest:rideDigest(ride),expires:Date.now()+300000})).toString('base64url');
  return value+'.'+createHmac('sha256',secret()).update(value).digest('hex');
}
export function verifyQuote(token:string,userId:number,ride:RideRow):void {
  try {
    if(token.length>2048)throw new Error();
    const [value,signature,...rest]=token.split('.');
    if(rest.length||!/^[a-f0-9]{64}$/.test(signature||''))throw new Error();
    const expected=createHmac('sha256',secret()).update(value).digest();
    if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))throw new Error();
    const decoded=JSON.parse(Buffer.from(value,'base64url').toString());
    if(decoded.userId!==userId||decoded.rideId!==ride.id||decoded.expires<=Date.now()||decoded.digest!==rideDigest(ride))throw new Error();
  } catch {throw new HttpError(409,'STALE_QUOTE','Search again to get the current ride terms.');}
}
export function utcDate(value:string):Date{return new Date(value.includes('T')?value:value.replace(' ','T')+'Z');}
export function publicRide(r:RideRow):Record<string,unknown> {
  const plate=r.vehicle_registration||'';
  return {id:r.id,driverId:r.driver_id,driverName:r.driver_name||'Ride host',vehicleId:r.vehicle_id,originStopId:r.origin_stop_id,destinationStopId:r.destination_stop_id,originName:r.origin_name,destinationName:r.destination_name,departureAt:utcDate(r.departure_at).toISOString(),totalSeats:r.total_seats,seatsAvailable:r.seats_available,creditPrice:r.credit_price,status:r.status,vehicle:{kind:r.vehicle_kind,registration:plate?'••••'+plate.slice(-4):null,model:r.vehicle_model,passengerCapacity:r.vehicle_capacity,approved:r.vehicle_status==='APPROVED'}};
}
export const RIDE_SELECT="SELECT r.*,u.name AS driver_name,u.status AS driver_status,v.kind AS vehicle_kind,v.registration AS vehicle_registration,v.model AS vehicle_model,v.passenger_capacity AS vehicle_capacity,v.status AS vehicle_status,o.name AS origin_name,d.name AS destination_name FROM rides r JOIN users u ON u.id=r.driver_id JOIN vehicles v ON v.id=r.vehicle_id JOIN stops o ON o.id=r.origin_stop_id JOIN stops d ON d.id=r.destination_stop_id";
