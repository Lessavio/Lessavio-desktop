import type { Language } from './i18n';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { emptyWorkspace, validateWorkspace, type Workspace } from './domain';
export const native = isTauri();
export async function load(): Promise<Workspace> {
  if (!native) return emptyWorkspace();
  const raw = await invoke<string | null>('load_workspace');
  if (!raw) return emptyWorkspace();
  const result: unknown = JSON.parse(raw); validateWorkspace(result); return result;
}
export async function save(w: Workspace): Promise<void> {
  validateWorkspace(w);
  if (native) await invoke('save_workspace', { payload: JSON.stringify(w) });
}
export async function exportBackup(language: Language): Promise<boolean> { return invoke('export_backup', {language}); }
export async function readBackup(language: Language): Promise<Workspace | null> {
  const raw = await invoke<string | null>('read_backup', {language});
  if (!raw) return null;
  const w: unknown = JSON.parse(raw); validateWorkspace(w); return w;
}
