use serde_json::Value;
pub struct Reminder { pub id:String,pub starts_at:String,pub lead:i64,pub title:String,pub body:String }
pub fn due(workspace:&Value,now:i64)->Vec<Reminder>{
 let lead=workspace["profile"]["reminderMinutes"].as_i64().unwrap_or(0);
 if ![5,10,15,30,60].contains(&lead){return vec![];}
 let language=workspace["profile"]["language"].as_str().unwrap_or("ru");
 let title=match language {"en"=>"Lesson starting soon","uk"=>"Незабаром заняття",_=>"Скоро занятие"};
 let unit=match language {"en"=>"min","uk"=>"хв",_=>"мин"};
 let Some(lessons)=workspace["lessons"].as_array() else { return vec![]; };
 let mut result=Vec::new();
 for lesson in lessons {
  if lesson["status"]!="scheduled"{continue;}
  let Some(starts_at)=lesson["startsAt"].as_str() else {continue;};
  let Ok(starts)=chrono::DateTime::parse_from_rfc3339(starts_at) else {continue;};
  let remaining=starts.timestamp()-now;
  if remaining<=0||remaining>lead*60 {continue;}
  let id=lesson["id"].as_str().unwrap_or("");if id.is_empty(){continue;}
  let name=workspace["students"].as_array().and_then(|students|students.iter().find(|s|s["id"]==lesson["studentId"])).and_then(|s|s["name"].as_str()).unwrap_or("Lessavio");
  result.push(Reminder{id:id.into(),starts_at:starts_at.into(),lead,title:format!("Lessavio · {title}"),body:format!("{name} · {} {unit}",(remaining+59)/60)});
 }
 result
}
#[cfg(test)]
mod tests {
 use super::*;
 #[test]
 fn only_future_scheduled_lessons_in_the_window_are_due(){
  let now=chrono::DateTime::parse_from_rfc3339("2026-10-23T10:00:00Z").unwrap().timestamp();
  let mut w=serde_json::json!({"profile":{"reminderMinutes":15,"language":"en"},"students":[{"id":"s","name":"Anna"}],"lessons":[{"id":"a","studentId":"s","status":"scheduled","startsAt":"2026-10-23T10:10:00Z"},{"id":"b","status":"cancelled","startsAt":"2026-10-23T10:10:00Z"},{"id":"c","status":"completed","startsAt":"2026-10-23T10:10:00Z"},{"id":"d","status":"scheduled","startsAt":"2026-10-23T09:59:00Z"},{"id":"e","status":"scheduled","startsAt":"2026-10-23T10:16:00Z"}]});
  let result=due(&w,now);assert_eq!(result.len(),1);assert_eq!(result[0].id,"a");assert_eq!(result[0].body,"Anna · 10 min");
  w["profile"]["reminderMinutes"]=serde_json::json!(0);assert!(due(&w,now).is_empty());
 }
 #[test]
 fn changed_and_cancelled_lessons_use_current_data(){
  let now=chrono::Utc::now().timestamp();let mut w=serde_json::json!({"profile":{"reminderMinutes":5},"students":[],"lessons":[{"id":"a","status":"scheduled","startsAt":chrono::DateTime::from_timestamp(now+60,0).unwrap().to_rfc3339()}]});
  assert_eq!(due(&w,now).len(),1);w["lessons"][0]["status"]=serde_json::json!("cancelled");assert!(due(&w,now).is_empty());
 }
}
