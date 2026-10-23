import type { Workspace } from './domain.ts';
import { zonedDate } from './planning.ts';
export function financialSummary(w:Workspace,month:string,timeZone:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Некорректный месяц');
 const period=(stamp:string)=>zonedDate(stamp,timeZone).slice(0,7);
 const rows=w.students.map(student=>{
  const lessons=w.lessons.filter(l=>l.studentId===student.id),payments=w.payments.filter(p=>p.studentId===student.id);
  const completed=lessons.filter(l=>l.status==='completed'&&period(l.startsAt)===month);
  const earned=completed.reduce((n,l)=>n+l.price,0),received=payments.filter(p=>period(p.paidAt)===month).reduce((n,p)=>n+p.amount,0);
  const balance=payments.filter(p=>period(p.paidAt)<=month).reduce((n,p)=>n+p.amount,0)-lessons.filter(l=>l.status==='completed'&&period(l.startsAt)<=month).reduce((n,l)=>n+l.price,0);
  const planned=lessons.filter(l=>l.status==='scheduled'&&period(l.startsAt)===month).reduce((n,l)=>n+l.price,0);
  return {student,earned,received,balance,planned,count:completed.length};
 });
 return {rows:rows.filter(r=>r.earned||r.received||r.balance||r.planned||r.count),earned:rows.reduce((n,r)=>n+r.earned,0),received:rows.reduce((n,r)=>n+r.received,0),debt:rows.reduce((n,r)=>n+Math.max(0,-r.balance),0),credit:rows.reduce((n,r)=>n+Math.max(0,r.balance),0),planned:rows.reduce((n,r)=>n+r.planned,0)};
}
