import type { Language } from './i18n';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { emptyWorkspace, validateWorkspace, type Workspace } from './domain';
export const native = isTauri();
// Browser preview remains in memory; account switching uses separate in-memory spaces.
const previews=new Map<string,Workspace>();
export interface WorkspaceRepository {
 load:()=>Promise<Workspace>;
 save:(workspace:Workspace)=>Promise<void>;
 exportBackup:(language:Language)=>Promise<boolean>;
 readBackup:(language:Language)=>Promise<Workspace|null>;
}
export function createRepository(scope:string):WorkspaceRepository {
 return {
  async load(){
   if(!native)return structuredClone(previews.get(scope)??emptyWorkspace());
   const raw=await invoke<string|null>('load_workspace',{scope});
   if(!raw)return emptyWorkspace();
   const result:unknown=JSON.parse(raw);validateWorkspace(result);return result;
  },
  async save(workspace){validateWorkspace(workspace);if(native)await invoke('save_workspace',{scope,payload:JSON.stringify(workspace)});else previews.set(scope,structuredClone(workspace));},
  async exportBackup(language){return invoke('export_backup',{scope,language});},
  async readBackup(language){const raw=await invoke<string|null>('read_backup',{language});if(!raw)return null;const workspace:unknown=JSON.parse(raw);validateWorkspace(workspace);return workspace;},
 };
}
export async function deactivateWorkspace(){if(native)await invoke('deactivate_workspace');}

export async function copyGuestWorkspace(scope:string){await invoke('copy_guest_workspace',{scope});}
