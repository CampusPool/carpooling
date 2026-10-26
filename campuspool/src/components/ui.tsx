"use client";
import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/client";
export function Loading(){return <div className="empty" role="status">Loading your campus data…</div>}
export function Empty({children="Nothing here yet."}:{children?:React.ReactNode}){return <div className="empty">{children}</div>}
export function ErrorState({message}:{message:string}){return <div className="notice error" role="alert">{message}</div>}
export function FormButton({children,disabled,onClick}:{children:React.ReactNode;disabled?:boolean;onClick?:()=>void}){return <button type={onClick?"button":"submit"} className="button" disabled={disabled} onClick={onClick}>{disabled?"Saving…":children}</button>}
export function useSubmit<T>(url:string, method="POST") { const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const submit=async(body:T|Record<string,unknown>)=>{setSaving(true);setError("");try{return await apiFetch(url,{method,body:JSON.stringify(body)})}catch(e: unknown){setError(e instanceof ApiError?e.message:"Please check your connection and try again.");throw e}finally{setSaving(false)}};return {submit,saving,error}; }
