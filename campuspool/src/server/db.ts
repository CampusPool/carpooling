import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import type { ExecuteValues } from 'mysql2';
import { existsSync } from 'node:fs';
if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
let connectionPool:Pool|undefined;
export function pool():Pool {
  if (!connectionPool) {
    const value=process.env.DATABASE_URL;
    if (!value) throw new Error('DATABASE_URL is required');
    const url=new URL(value);
    connectionPool=mysql.createPool({host:url.hostname,port:Number(url.port||3306),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:url.pathname.slice(1),connectionLimit:10,charset:'utf8mb4',timezone:'Z',dateStrings:true,enableKeepAlive:true});
  }
  return connectionPool;
}
export async function rows<T>(cx:Pool|PoolConnection,sql:string,values:unknown[]=[]):Promise<T[]> {
  const [result]=await cx.execute<RowDataPacket[]>(sql,values as ExecuteValues);
  return result as unknown as T[];
}
export async function exec(cx:Pool|PoolConnection,sql:string,values:unknown[]=[]):Promise<ResultSetHeader> {
  const [result]=await cx.execute<ResultSetHeader>(sql,values as ExecuteValues); return result;
}
export async function transaction<T>(fn:(cx:PoolConnection)=>Promise<T>):Promise<T> {
  for (let attempt=0;attempt<3;attempt++) {
    const cx=await pool().getConnection();
    try {
      await cx.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED'); await cx.beginTransaction();
      const result=await fn(cx); await cx.commit(); return result;
    } catch (error) {
      await cx.rollback();
      const code=(error as {errno?:number}).errno;
      if ((code===1213||code===1205)&&attempt<2) { await new Promise(resolve=>setTimeout(resolve,20*(attempt+1))); continue; }
      throw error;
    } finally { cx.release(); }
  }
  throw new Error('Transaction retry exhausted');
}
