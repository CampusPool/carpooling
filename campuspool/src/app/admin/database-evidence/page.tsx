"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { ErrorState, Loading } from "@/components/ui";
type EvidenceData={sql?:{views?:unknown[];routines?:unknown[];triggers?:unknown[];indexes?:unknown[]};mongo?:{indexes?:unknown[];collection?:string;database?:string}};
export default function Evidence(){
 const [data,setData]=useState<EvidenceData|null>(null);const [error,setError]=useState("");
 useEffect(()=>{void apiFetch<EvidenceData>("/api/admin/database-evidence").then(setData).catch((e:unknown)=>setError(e instanceof Error?e.message:"Unable to load database evidence."))},[]);
 const count=(items?:unknown[])=>items?.length??0;
 return <><div className="section-head"><div><div className="eyebrow">ADMIN · DATABASE EVIDENCE</div><h1 className="page-title">Evidence, not decoration.</h1><p className="lede">A readable summary of the SQL structures and MongoDB indexes behind CampusPool.</p></div><span className="tag">Admin only</span></div>{error?<ErrorState message={error}/>:!data?<Loading/>:<><div className="grid evidence-grid">{[["SQL views",count(data.sql?.views)],["SQL routines",count(data.sql?.routines)],["SQL guards",count(data.sql?.triggers)],["SQL indexes",count(data.sql?.indexes)],["Mongo indexes",count(data.mongo?.indexes)]].map(([label,value])=><div className="card stat-card" key={String(label)}><div className="muted">{label}</div><div className="stat">{value}</div><span className="muted">verified structure</span></div>)}</div><div className="card evidence-detail"><div><strong>Mongo projection</strong><p className="muted">{data.mongo?.database??"campuspool"} · {data.mongo?.collection??"activity_events"}</p></div><details><summary>Show safe structure details</summary><pre>{JSON.stringify(data,null,2)}</pre></details></div></>}<div className="notice">Evidence is read-only and excludes SQL text, credentials, session tokens, and private activity payloads.</div></>
}
