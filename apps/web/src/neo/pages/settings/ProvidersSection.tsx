import { useCallback, useEffect, useState } from "react";
import type { EnvEntry, ProviderInfo } from "@npi-deck/protocol";
import { Card, NeoBadge, NeoButton, Notice, SectionLabel, Table, type Column } from "@/components/neo";
import { settings } from "../../client/settings";
import { ExposureTable } from "../UsagePage";
import { OAuthFlow } from "./OAuthFlow";
interface ProviderRow {id:string;name:string;oauth?:ProviderInfo;env?:EnvEntry}
const ENV_PROVIDER:Record<string,string>={ANTHROPIC_API_KEY:"anthropic",OPENAI_API_KEY:"openai",OPENROUTER_API_KEY:"openrouter",GROQ_API_KEY:"groq",GOOGLE_API_KEY:"google",XAI_API_KEY:"xai"};
export function ProvidersSection({admin}:{admin:boolean}){
 const [rows,setRows]=useState<ProviderRow[]>([]);const [notice,setNotice]=useState("");const [oauth,setOauth]=useState<{id:string;name:string}|null>(null);const [editing,setEditing]=useState("");const [key,setKey]=useState("");const [busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{try{const [providers,env]=await Promise.all([settings.auth.listProviders(),settings.engine.listEnv()]);const merged:ProviderRow[]=providers.providers.map(p=>({id:p.id,name:p.name,oauth:p}));for(const entry of env.entries){const id=ENV_PROVIDER[entry.key];if(!id)continue;const found=merged.find(p=>p.id===id);if(found)found.env=entry;else merged.push({id,name:{xai:"xAI",openai:"OpenAI",openrouter:"OpenRouter",groq:"Groq",google:"Google"}[id]??id,env:entry});}setRows(merged);}catch(e){setNotice(String(e));}},[]);
 useEffect(()=>{void refresh();},[refresh]);useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(""),4000);return()=>clearTimeout(t);},[notice]);
 async function save(row:ProviderRow){
  if(!row.env)return;
  setBusy(true);
  try{
   await settings.engine.patchEnv({[row.env.key]:key});
   setEditing("");setKey("");
   setNotice(row.env.source==="process-env" ? "Saved in the managed env file. Remove the launching process's value and restart to use it." : "Saved. Restart the server to apply this API key.");
   await refresh();
  }catch(e){setNotice(String(e));}finally{setBusy(false);}
 }
 async function signOut(row:ProviderRow){
  setBusy(true);
  try{
   if(row.oauth?.state==="oauth"){await settings.auth.revoke(row.id);setNotice("Signed out.");}
   else if(row.env){
    await settings.engine.patchEnv({[row.env.key]:null});
    setNotice(row.env.source==="process-env" ? "Managed value removed. The launching process still supplies this key; remove it there and restart." : "Saved. Restart the server to stop using this API key.");
   }
   await refresh();
  }catch(e){setNotice(String(e));}finally{setBusy(false);}
 }
 const columns:Column<ProviderRow>[]=[{key:"name",header:"Provider",render:p=>p.name},{key:"kind",header:"Auth",render:p=><NeoBadge>{p.oauth?.state==="oauth"?"OAuth":p.env?"API key":"OAuth"}</NeoBadge>},{key:"status",header:"Status",render:p=><span className="neo-settings-description">{p.oauth?.state==="oauth"?`Signed in${p.oauth.count>1?` · ${p.oauth.count} accounts`:""}`:p.env?.isSet||p.oauth?.state==="api-key"?"Key set":"Not configured"}</span>},{key:"actions",header:"",align:"right",render:p=>editing===p.id?<div className="neo-settings-actions"><input aria-label={`API key for ${p.name}`} className="neo-input" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)}/><NeoButton size="sm" disabled={busy||!key.trim()} onClick={()=>void save(p)}>Save</NeoButton><NeoButton size="sm" variant="ghost" onClick={()=>{setEditing("");setKey("");}}>Cancel</NeoButton></div>:<div className="neo-settings-actions">{p.oauth&&<NeoButton size="sm" disabled={busy} onClick={()=>setOauth(p)}>Sign in</NeoButton>}{p.env&&<NeoButton size="sm" variant="ghost" disabled={busy} onClick={()=>{setEditing(p.id);setKey("");}}>Set key</NeoButton>}{(p.oauth?.state==="oauth"||p.env?.isSet)&&<NeoButton variant="ghost" size="sm" disabled={busy} onClick={()=>void signOut(p)}>Sign out</NeoButton>}</div>}];
 return <Card id="providers" title="Providers" description="Sign in to a provider or save an API key." flush><div className="neo-settings-stack">{notice&&<Notice>{notice}</Notice>}<Table columns={columns} rows={rows} rowKey={p=>p.id}/>{admin&&<div className="neo-settings-inset"><SectionLabel>Exposure</SectionLabel><ExposureTable/></div>}</div><OAuthFlow provider={oauth} onClose={()=>setOauth(null)} onComplete={()=>{setNotice("Saved. Provider signed in.");void refresh();}}/></Card>;
}
