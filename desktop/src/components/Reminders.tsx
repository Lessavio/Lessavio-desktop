import { useState } from 'react';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { native } from '../storage';
import { Select } from './Select';
import { translator, type Language } from '../i18n';
export function Reminders({language,minutes,busy,onChange}:{language:Language;minutes:number;busy:boolean;onChange:(minutes:number)=>Promise<boolean>}){
 const t=translator(language),[working,setWorking]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function change(value:number){setWorking(true);setError('');setMessage('');try{
  if(value>0){let granted=await isPermissionGranted();if(!granted)granted=await requestPermission()==='granted';if(!granted){setError(t('Разрешите уведомления Lessavio в настройках системы'));return;}}
  if(await onChange(value))setMessage(t('Настройки сохранены'));
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setWorking(false);}}
 async function test(){setWorking(true);setError('');try{if(!await isPermissionGranted()){setError(t('Разрешите уведомления Lessavio в настройках системы'));return;}sendNotification({title:'Lessavio',body:t('Напоминания о занятиях работают')});setMessage(t('Тестовое уведомление отправлено'));}catch(e){setError(String(e));}finally{setWorking(false);}}
 return <section className="card settings-card reminder-card"><h2>{t('Локальные напоминания')}</h2><p className="muted">{t('Работают пока приложение запущено, в том числе свёрнуто. После выхода напоминания не отправляются.')}</p><label className="field"><span>{t('Напомнить до начала')}</span><Select label={t('Напомнить до начала')} value={String(minutes)} disabled={!native||busy||working} emptyLabel={t('Ничего не найдено')} options={[{value:'0',label:t('Выключено')},...[5,10,15,30,60].map(n=>({value:String(n),label:t('За {minutes} мин',{minutes:n})}))]} onChange={value=>void change(Number(value))}/></label><button disabled={!native||busy||working||!minutes} onClick={()=>void test()}>{t('Отправить тестовое уведомление')}</button>{!native&&<p className="muted">{t('Уведомления доступны в установленном приложении')}</p>}{error&&<div className="error" role="alert">{error}</div>}{message&&<p role="status" className="muted">{message}</p>}<p className="muted">{t('Разрешения и режим «Не беспокоить» управляются в настройках системы. После сна напоминание придёт только если занятие ещё не началось.')}</p></section>;
}
