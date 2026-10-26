export type Role = 'RIDER' | 'DRIVER' | 'ADMIN';
export type UserStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED';
export interface User { id:number; name:string; email:string; role:Role; status:UserStatus; credits:number }
export interface VehicleRow { id:number; owner_id:number; kind:'CAR'|'BIKE'; registration:string; model:string; passenger_capacity:number; status:'PENDING'|'APPROVED'|'REJECTED'; reviewed_by?:number|null; review_note?:string|null; owner_name?:string; created_at?:string }
export interface RideRow { id:number; driver_id:number; vehicle_id:number; origin_stop_id:number; destination_stop_id:number; departure_at:string; total_seats:number; seats_available:number; credit_price:number; status:'PUBLISHED'|'CANCELLED'|'COMPLETED'; driver_name?:string; driver_status?:string; vehicle_kind?:'CAR'|'BIKE'; vehicle_registration?:string; vehicle_model?:string; vehicle_capacity?:number; vehicle_status?:string; origin_name?:string; destination_name?:string }
export type BookingStatus = 'REQUESTED'|'ACCEPTED'|'REJECTED'|'CANCELLED';
export interface BookingRow { id:number; ride_id:number; rider_id:number; status:BookingStatus; cancelled_by:number|null; cancellation_reason:string|null; created_at:string; updated_at:string }
export interface EventInput { type:string; actorId:number; audienceIds:number[]; rideId?:number; bookingId?:number; data:Record<string,unknown> }
