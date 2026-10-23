import { moveLesson, inferSeriesDraft, editableSeries, replaceSeries, zonedDate, zonedTime } from './planning.ts';
import { financialSummary } from './finance.ts';
import { generateOccurrences, createSeriesLessons, seriesConflicts, cancelUpcomingSeries, type RecurrenceRule } from './recurrence.ts';
import { defaultLanguage, translator, locales } from './i18n.ts';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { balance, emptyWorkspace, hasConflict, moneyInput, validateWorkspace, type Lesson } from './domain.ts';
const lesson:Lesson={id:'l1',studentId:'s1',startsAt:'2026-10-23T10:00:00Z',duration:60,price:50000,status:'completed',notes:''};
test('money uses exact minor units and rejects invalid input',()=>{assert.equal(moneyInput('123,45'),12345);assert.equal(moneyInput('0.29'),29);for(const v of ['-1','1.234','NaN','1e5',''])assert.throws(()=>moneyInput(v));});
test('overlapping lessons blocked; adjacent and cancelled allowed',()=>{assert.equal(hasConflict([lesson],{...lesson,id:'l2',startsAt:'2026-10-23T10:30:00Z'}),true);assert.equal(hasConflict([lesson],{...lesson,id:'l2',startsAt:'2026-10-23T11:00:00Z'}),false);assert.equal(hasConflict([lesson],{...lesson,id:'l2',status:'cancelled'}),false);assert.equal(hasConflict([lesson],lesson),false);});
test('balance charges only completed lessons and includes prepayments',()=>{const w={...emptyWorkspace(),lessons:[lesson,{...lesson,id:'l2',status:'scheduled' as const},{...lesson,id:'l3',status:'cancelled' as const}],payments:[{id:'p',studentId:'s1',amount:30000,paidAt:lesson.startsAt}]};assert.equal(balance(w,'s1'),-20000);assert.equal(balance(w,'other'),0);});
test('backup validation rejects broken references, duplicates, currency and amounts',()=>{const w={...emptyWorkspace(),students:[{id:'s1',name:'Анна',subject:'English',phone:'',price:50000,notes:'',archived:false}],lessons:[lesson]};validateWorkspace(w);assert.throws(()=>validateWorkspace({...w,students:[]}));assert.throws(()=>validateWorkspace({...w,lessons:[lesson,lesson]}));assert.throws(()=>validateWorkspace({...w,students:[{...w.students[0],price:0.1}]}));assert.throws(()=>validateWorkspace({...w,profile:{name:'Tutor',currency:'BAD',timeZone:'Europe/Kyiv'}}));});


test('language preferences round-trip and legacy profiles remain valid',()=>{
 const profile={name:'Tutor',currency:'UAH' as const,timeZone:'Europe/Kyiv'};
 const legacy={...emptyWorkspace(),profile}; validateWorkspace(legacy);
 for(const language of ['ru','uk','en'] as const){
  const w=JSON.parse(JSON.stringify({...legacy,profile:{...profile,language}}));
  validateWorkspace(w); assert.equal(w.profile?.language,language);
 }
 assert.throws(()=>validateWorkspace({...legacy,profile:{...profile,language:'de'}}));
});

test('English first-run default, interpolation and localized date formatting',()=>{
 assert.equal(defaultLanguage,'en');
 assert.equal(translator('en')('Хорошего дня, {name}',{name:'Alex'}),'Have a good day, Alex');
 assert.equal(translator('uk')('Настройки'),'Налаштування');
 assert.equal(translator('ru')('Настройки'),'Настройки');
 assert.equal(translator('en')('Некорректный профиль'),'Invalid profile');
 assert.equal(translator('en')('Unexpected disk error'),'Unexpected disk error');
 const date=new Date('2026-10-23T12:00:00Z');
 assert.match(new Intl.DateTimeFormat(locales.en,{month:'long',timeZone:'UTC'}).format(date),/October/);
 assert.match(new Intl.DateTimeFormat(locales.uk,{month:'long',timeZone:'UTC'}).format(date),/жовтень/);
});
test('all dictionaries have matching keys and interpolation placeholders',()=>{
 const dictionaries=['ru','uk','en'].map(language=>JSON.parse(readFileSync(new URL(`./locales/${language}.json`,import.meta.url),'utf8')) as Record<string,string>);
 const placeholders=(text:string)=>[...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
 for(const dictionary of dictionaries){
  assert.deepEqual(Object.keys(dictionary).sort(),Object.keys(dictionaries[0]).sort());
  for(const [key,value] of Object.entries(dictionary)){
   assert.ok(value.trim()); assert.deepEqual(placeholders(value),placeholders(key),key);
  }
 }
});

// Recurrence uses the tutor's selected IANA time zone, independently of the test machine.

const weeklyRule:RecurrenceRule={startDate:'2026-10-19',endDate:'2026-11-01',intervalWeeks:1,timeZone:'Europe/Kyiv',slots:[{weekday:1,time:'16:00'},{weekday:5,time:'18:00'},{weekday:6,time:'12:30'}]};
test('weekly lessons preserve different weekday times, inclusive boundaries, and DST',()=>{
 const occurrences=generateOccurrences(weeklyRule);
 assert.deepEqual(occurrences.map(o=>[o.localDate,o.localTime]),[['2026-10-19','16:00'],['2026-10-23','18:00'],['2026-10-24','12:30'],['2026-10-26','16:00'],['2026-10-30','18:00'],['2026-10-31','12:30']]);
 assert.equal(occurrences[0].startsAt,'2026-10-19T13:00:00.000Z');
 assert.equal(occurrences[3].startsAt,'2026-10-26T14:00:00.000Z');
 assert.equal(generateOccurrences({...weeklyRule,startDate:'2026-10-23',endDate:'2026-10-23'}).length,1);
});
test('biweekly schedule anchors to Monday of the start week',()=>{
 const occurrences=generateOccurrences({...weeklyRule,startDate:'2026-10-23',endDate:'2026-11-13',intervalWeeks:2});
 assert.deepEqual(occurrences.map(o=>o.localDate),['2026-10-23','2026-10-24','2026-11-02','2026-11-06','2026-11-07']);
});
test('recurrence rejects empty slots, invalid dates, times, duplicates and unbounded ranges',()=>{
 for(const change of [{slots:[]},{startDate:'2026-02-30'},{endDate:'2026-01-01'},{endDate:'2028-01-01'},{slots:[{weekday:1,time:'25:00'}]},{slots:[{weekday:1,time:'16:00'},{weekday:1,time:'18:00'}]},{timeZone:'Invalid/Zone'}])assert.throws(()=>generateOccurrences({...weeklyRule,...change}));
 assert.throws(()=>generateOccurrences({...weeklyRule,startDate:'2026-10-20',endDate:'2026-10-20'}));
});
test('DST gaps and ambiguities are explicit errors instead of silently changing lesson times',()=>{
 assert.throws(()=>generateOccurrences({...weeklyRule,timeZone:'America/New_York',startDate:'2026-03-08',endDate:'2026-03-08',slots:[{weekday:7,time:'02:30'}]}),/не существует/);
 assert.throws(()=>generateOccurrences({...weeklyRule,timeZone:'America/New_York',startDate:'2026-11-01',endDate:'2026-11-01',slots:[{weekday:7,time:'01:30'}]}),/неоднозначно/);
});
test('a conflicting series creates nothing; cancelled conflicts and adjacent lessons are allowed',()=>{
 const draft={studentId:'s1',duration:60,price:50000,notes:'Weekly',rule:weeklyRule};
 const existing={...lesson,startsAt:'2026-10-19T13:30:00.000Z'};
 const original=[existing];
 assert.equal(seriesConflicts(generateOccurrences(weeklyRule),original,60).length,1);
 assert.throws(()=>createSeriesLessons(draft,original),/пересечения/);
 assert.deepEqual(original,[existing]);
 assert.throws(()=>createSeriesLessons(draft,[{...existing,id:'$series-preview$0'}]),/пересечения/);
 assert.equal(createSeriesLessons(draft,[{...existing,status:'cancelled'}]).length,6);
 assert.equal(createSeriesLessons(draft,[{...existing,startsAt:'2026-10-19T14:00:00.000Z'}]).length,6);
});
test('overnight lessons within a series cannot overlap each other',()=>{
 const rule={...weeklyRule,slots:[{weekday:1,time:'23:30'},{weekday:2,time:'00:00'}]};
 assert.throws(()=>createSeriesLessons({studentId:'s1',duration:60,price:100,notes:'',rule},[]),/пересечения/);
});
test('series IDs, history and backward-compatible backups round-trip',()=>{
 let i=0;const lessons=createSeriesLessons({studentId:'s1',duration:60,price:50000,notes:'Weekly',rule:weeklyRule},[],()=>`test-${i++}`);
 assert.equal(new Set(lessons.map(l=>l.seriesId)).size,1);assert.equal(new Set(lessons.map(l=>l.id)).size,6);
 const w={...emptyWorkspace(),students:[{id:'s1',name:'Anna',subject:'',phone:'',price:50000,notes:'',archived:false}],lessons};
 const restored=JSON.parse(JSON.stringify(w));validateWorkspace(restored);assert.equal(restored.lessons[0].seriesId,'test-0');
 validateWorkspace({...w,lessons:[lesson]});
 assert.throws(()=>validateWorkspace({...w,lessons:[{...lessons[0],seriesId:''}]}));
});

test('cancelling future occurrences keeps history, completed charges and other series intact',()=>{
 const lessons:Lesson[]=[
  {...lesson,id:'past',seriesId:'series',startsAt:'2026-10-01T10:00:00Z',status:'scheduled'},
  {...lesson,id:'future',seriesId:'series',startsAt:'2026-11-01T10:00:00Z',status:'scheduled'},
  {...lesson,id:'completed',seriesId:'series',startsAt:'2026-11-01T12:00:00Z',status:'completed'},
  {...lesson,id:'other',seriesId:'other',startsAt:'2026-11-02T10:00:00Z',status:'scheduled'}
 ];
 const result=cancelUpcomingSeries(lessons,'series',Date.parse('2026-10-23T00:00:00Z'));
 assert.deepEqual(result.map(l=>l.status),['scheduled','cancelled','completed','scheduled']);
 assert.equal(lessons[1].status,'scheduled');
 const w={...emptyWorkspace(),lessons};assert.equal(balance({...w,lessons:result},'s1'),balance(w,'s1'));
});


test('moving a lesson uses profile timezone, retains series membership, and protects completed lessons',()=>{
 const original={...lesson,status:'scheduled' as const,seriesId:'series',startsAt:'2026-10-23T13:00:00Z'};
 const moved=moveLesson([original],original.id,'2026-10-26','16:00','Europe/Kyiv');
 assert.equal(moved.startsAt,'2026-10-26T14:00:00.000Z');assert.equal(moved.seriesId,'series');assert.equal(original.startsAt,'2026-10-23T13:00:00Z');
 assert.throws(()=>moveLesson([lesson],lesson.id,'2026-10-26','16:00','Europe/Kyiv'),/только запланированные/);
 assert.throws(()=>moveLesson([original,{...original,id:'busy',startsAt:moved.startsAt}],original.id,'2026-10-26','16:00','Europe/Kyiv'),/уже есть/);
 assert.equal(zonedDate(moved.startsAt,'Europe/Kyiv'),'2026-10-26');assert.equal(zonedTime(moved.startsAt,'Europe/Kyiv'),'16:00');
});
test('series editing replaces only selected scheduled occurrences and preserves history and payments',()=>{
 let id=0;const created=createSeriesLessons({studentId:'s1',duration:60,price:50000,notes:'',rule:weeklyRule},[],()=>`edit-${id++}`);
 const now=Date.parse('2026-10-25T00:00:00Z');
 const original=created.map((l,i)=>i===0?{...l,status:'completed' as const}:i===4?{...l,status:'cancelled' as const}:l);
 const draft=inferSeriesDraft(original[0],original,'Europe/Kyiv','future',now);
 draft.rule.slots=draft.rule.slots.map(s=>({...s,time:s.weekday===1?'19:00':s.time}));
 const updated=replaceSeries(original,original[0].seriesId!,draft,'future',now,()=>`new-${id++}`);
 assert.deepEqual(updated.find(l=>l.id===original[0].id),original[0]);
 assert.deepEqual(updated.find(l=>l.id===original[1].id),original[1]);
 assert.deepEqual(updated.find(l=>l.id===original[4].id),original[4]);
 assert.equal(updated.filter(l=>l.status==='scheduled'&&Date.parse(l.startsAt)>=now).some(l=>zonedTime(l.startsAt,'Europe/Kyiv')==='19:00'),true);
 assert.equal(original[3].startsAt,created[3].startsAt);
});
test('editing all scheduled lessons still protects completed and cancelled records; conflicts are atomic',()=>{
 let id=0;const original=createSeriesLessons({studentId:'s1',duration:60,price:50000,notes:'',rule:weeklyRule},[],()=>`all-${id++}`);
 original[0].status='completed';original[1].status='cancelled';const now=Date.parse('2026-11-05T00:00:00Z');
 const draft=inferSeriesDraft(original[2],original,'Europe/Kyiv','scheduled',now);
 assert.equal(editableSeries(original,original[0].seriesId!,'future',now).length,0);
 const updated=replaceSeries(original,original[0].seriesId!,draft,'scheduled',now,()=>`allnew-${id++}`);
 assert.deepEqual(updated.find(l=>l.id===original[0].id),original[0]);assert.deepEqual(updated.find(l=>l.id===original[1].id),original[1]);
 const blocked=[...original,{...original[2],id:'outside',seriesId:undefined,startsAt:original[2].startsAt}];
 const snapshot=JSON.stringify(blocked);assert.throws(()=>replaceSeries(blocked,original[0].seriesId!,draft,'scheduled',now),/пересечения/);assert.equal(JSON.stringify(blocked),snapshot);
});
test('legacy biweekly series can be inferred without recurrence metadata',()=>{
 let id=0;const original=createSeriesLessons({studentId:'s1',duration:60,price:100,notes:'',rule:{...weeklyRule,endDate:'2026-12-01',intervalWeeks:2}},[],()=>`legacy-${id++}`).map(({seriesRule,...lesson})=>lesson);
 const draft=inferSeriesDraft(original[0],original,'Europe/Kyiv','scheduled',Date.parse('2026-10-20T00:00:00Z'));
 assert.equal(draft.rule.intervalWeeks,2);assert.deepEqual(draft.rule.slots,weeklyRule.slots);
});
test('financial summary separates month cash from lesson value and carries previous balances',()=>{
 const w={...emptyWorkspace(),students:[{id:'s1',name:'Anna',subject:'',phone:'',price:50000,notes:'',archived:false},{id:'s2',name:'Ben',subject:'',phone:'',price:50000,notes:'',archived:true}],lessons:[{...lesson,id:'sept',startsAt:'2026-09-10T12:00:00Z',price:50000},{...lesson,id:'oct',startsAt:'2026-10-10T12:00:00Z',price:30000},{...lesson,id:'future',startsAt:'2026-10-20T12:00:00Z',status:'scheduled' as const,price:20000},{...lesson,id:'cancel',status:'cancelled' as const,price:90000}],payments:[{id:'p1',studentId:'s1',amount:20000,paidAt:'2026-10-10T00:00:00Z'},{id:'p2',studentId:'s2',amount:40000,paidAt:'2026-09-01T00:00:00Z'},{id:'later',studentId:'s1',amount:100000,paidAt:'2026-11-01T12:00:00Z'}]};
 const summary=financialSummary(w,'2026-10','Europe/Kyiv');
 assert.equal(summary.received,20000);assert.equal(summary.earned,30000);assert.equal(summary.debt,60000);assert.equal(summary.credit,40000);assert.equal(summary.planned,20000);assert.equal(summary.rows.length,2);
 assert.equal(financialSummary(w,'2026-09','Europe/Kyiv').debt,50000);
});
test('finance month boundaries follow the profile time zone and reminder settings survive backups',()=>{
 const w={...emptyWorkspace(),profile:{name:'Tutor',currency:'UAH' as const,timeZone:'Europe/Kyiv',reminderMinutes:15},students:[{id:'s1',name:'Anna',subject:'',phone:'',price:50000,notes:'',archived:false}],lessons:[{...lesson,startsAt:'2026-09-30T22:30:00Z'}],payments:[]};
 assert.equal(financialSummary(w,'2026-10','Europe/Kyiv').earned,50000);assert.equal(financialSummary(w,'2026-09','Europe/Kyiv').earned,0);
 const backup=JSON.parse(JSON.stringify(w));validateWorkspace(backup);assert.equal(backup.profile!.reminderMinutes,15);
 assert.throws(()=>validateWorkspace({...w,profile:{...w.profile,reminderMinutes:7}}));
});

test('series edits do not recreate completed or cancelled dates inside the range',()=>{
 const rule:RecurrenceRule={startDate:'2026-11-02',endDate:'2026-11-23',intervalWeeks:1,timeZone:'UTC',slots:[{weekday:1,time:'16:00'}]};
 const draft={studentId:'s1',duration:60,price:50000,notes:'',rule};let sequence=0;
 const initial=createSeriesLessons(draft,[],()=>String(++sequence));
 initial[1].status='completed';initial[2].status='cancelled';
 const result=replaceSeries(initial,initial[0].seriesId!,{...draft,rule:{...rule,slots:[{weekday:1,time:'18:00'}]}},'scheduled',0,()=>String(++sequence));
 assert.equal(result.length,4);assert.equal(result.filter(l=>l.status==='scheduled').length,2);
 assert.equal(result.find(l=>l.id===initial[1].id)?.startsAt,initial[1].startsAt);
});
