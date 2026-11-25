import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";

const base=readFileSync(new URL("../src/client/payroll-preview.js",import.meta.url),"utf8");
const archive=readFileSync(new URL("../src/client/payroll-archive-increments.js",import.meta.url),"utf8");
const bonus=readFileSync(new URL("../src/client/payroll-bonus-list.js",import.meta.url),"utf8");
const transfers=readFileSync(new URL("../src/client/payroll-transfers.js",import.meta.url),"utf8");
const bonusWithTransfers=bonus.replace(/\}\)\(\);\s*$/,transfers+"\n})();");
if(bonusWithTransfers===bonus)throw Error("Transfer module insertion failed");
const archiveWithBonus=archive.replace(/\}\)\(\);\s*$/,bonusWithTransfers+"\n})();");
if(archiveWithBonus===archive)throw Error("Bonus module insertion failed");
const combined=base.replace(/\}\)\(\);\s*$/,archiveWithBonus+"\n})();");
if(combined===base)throw Error("Archive insertion failed");

function boot(){
 let today="2026-11-25";
 const handlers:Record<string,Function[]>={},storage=new Map<string,string>(),alerts:string[]=[],toasts:string[]=[];
 const document={
  createElement:()=>({textContent:"",id:"",style:{},appendChild:()=>{}}),
  head:{appendChild:()=>{}},
  addEventListener:(event:string,fn:Function)=>{(handlers[event]??=[]).push(fn)},
  querySelectorAll:()=>[],getElementById:()=>null
 };
 const localStorage={
  getItem:(key:string)=>storage.get(key)||null,
  setItem:(key:string,value:string)=>storage.set(key,value)
 };
 const data={restaurants:[
  {id:"r1",name:"Pritam Fast Food",active:true},
  {id:"r2",name:"Restaurant 02",active:true}
 ]};
 const instrumented=combined.replace(/^\/\*[\s\S]*?\*\/\s*/,"").replace(/\}\)\(\);\s*$/,
  'return {render:tpRender,setPage:function(v){tpTab=v;},setMonth:function(v){tpPeriod=v;},data:function(){return tpData;},period:tpGetPeriod,active:tpEmployees,profile:tpEmployeeProfile,handle:tpHandleAction,employeeForm:tpEmployeeForm,selectRestaurant:function(v){selected=v;},getSelected:function(){return selected;}};\n})();');
 const app=new Function("document","window","localStorage","data","dateIN","payroll","settings","confirm","draw","showToast","uxAlert","tab","selected","return "+instrumented)(
  document,{addEventListener:()=>{}},localStorage,data,()=>today,
  ()=>"",()=>"<div>Restaurant settings</div>",()=>true,()=>{},(msg:string)=>toasts.push(msg),(msg:string)=>alerts.push(msg),"payroll","r1"
 );
 function submitForm(id:string,employeeId:string,fields:Record<string,string>){
  const event={target:{id,dataset:{id:employeeId},querySelector:(q:string)=>Object.prototype.hasOwnProperty.call(fields,q)?{value:fields[q]}:null},
   preventDefault:()=>{},stopImmediatePropagation:()=>{}};
  (handlers.submit||[]).forEach(fn=>fn(event));
 }
 function saveBasis(n:string){submitForm("tp-bonus-basis-form","",{"#tp-bonus-days-month":n})}
 return {app,alerts,toasts,handlers,submitForm,saveBasis,setToday:(v:string)=>today=v};
}
test("Bonus List has editable period and only the compact month matrix",()=>{
 const {app}=boot();app.setPage("bonus");
 const h=app.render();
 expect(h).toContain('id="tp-bonus-period-from"');
 expect(h).toContain('id="tp-bonus-period-through"');
 expect(h).toContain('id="tp-bonus-period-form"');
 expect(h).toContain('class="tp-bonus-mini"');
 expect(h).toContain('data-tp-action="pdf-bonus-list"');
 expect(h).not.toContain("Detailed month-by-month bonus list");
 expect(h).not.toContain("ID in that month");
});
test("Custom period supports 1 to 12 months and rejects 13 months",()=>{
 const {app,submitForm,alerts}=boot();
 app.setPage("bonus");
 submitForm("tp-bonus-period-form","",{"#tp-bonus-period-from":"2026-04","#tp-bonus-period-through":"2026-11"});
 let h=app.render();
 expect(h).toContain('value="2026-04"');
 expect(h).toContain('value="2026-11"');
 expect(h).not.toContain("<th>March 2026</th>");
 expect(h).toContain("<th>April 2026</th>");
 submitForm("tp-bonus-period-form","",{"#tp-bonus-period-from":"2025-11","#tp-bonus-period-through":"2026-11"});
 expect(alerts.some(a=>a.includes("1 to 12"))).toBe(true);
 expect(app.render()).not.toContain("<th>November 2025</th>");
});
test("Bonus months remain capped at 12 even when actual days exceed that threshold",()=>{
 const {app,saveBasis}=boot();
 for(let i=-12;i<=0;i++){
  const month=new Date(Date.UTC(2026,10+i,1)).toISOString().slice(0,7);
  const p=app.period(month);p.days.demo1="30";p.serials.demo1=i+15;
  p.snapshots.demo1={days:30,restaurant:"Pritam Fast Food"};
 }
 saveBasis("26");app.setPage("bonus");
 const h=app.render();
 expect(h).toContain("<th>December 2025</th>");
 expect(h).not.toContain("<th>November 2025</th>");
 expect(h).toContain("12.00");
 expect(h).not.toContain("13.85");
});
test("Compact cells show numeric monthly ID, worked days, and restaurant acronym",()=>{
 const {app}=boot();
 const p=app.period("2026-11");p.days.demo1="25";p.serials.demo1=31;
 app.setPage("bonus");const h=app.render();
 expect(h).toContain("<strong>31</strong><span>25</span><small>PFF</small>");
 expect(h).not.toContain("<strong>ID 31</strong>");
});
test("Legacy duplicate attendance for a person is consolidated to one entry per month",()=>{
 const {app}=boot(),person=app.data().employees.find((e:any)=>e.id==="demo1");
 const duplicate={...person,id:"rejoined-demo1",personId:"demo1",previousEmploymentId:"demo1",
  restaurant:"Restaurant 02",restaurantId:"r2",active:true,left:false};
 app.data().employees.push(duplicate);
 const p=app.period("2026-11");p.days.demo1="13";p.days[duplicate.id]="17";
 p.serials.demo1=8;p.serials[duplicate.id]=1;
 p.snapshots.demo1={days:13,restaurant:"Pritam Fast Food"};
 p.snapshots[duplicate.id]={days:17,restaurant:"Restaurant 02"};
 app.setPage("bonus");const h=app.render();
 expect(h).toContain("<strong>1</strong><span>30</span><small>R0</small>");
 const row=h.match(/<tr><td class="tp-bonus-employee"><strong>Aarav Patil<\/strong><\/td>([\s\S]*?)<\/tr>/)?.[1]||"";
 expect(row).not.toContain("<span>13</span>");
 expect(row).not.toContain("<span>17</span>");
 expect(row).toContain("<span>30</span>");
});
test("Transfer form is beside profile and offers only destination and month-boundary date",()=>{
 const {app}=boot();
 app.setPage("employees");app.handle({dataset:{tpAction:"transfer-employee",id:"demo1"}});
 const h=app.render();
 expect(h).toContain('id="tp-transfer-outlet"');
 expect(h).toContain('<option value="r2">Restaurant 02</option>');
 expect(h).toContain("First day of the next calendar month");
 expect(h).toContain("01 Dec 2026");
 expect(h.indexOf('id="tp-transfer-form"')).toBeGreaterThan(h.indexOf("EMPLOYEE PROFILE"));
 expect(h).not.toContain("Temporary");
 expect(h).not.toContain('id="tp-transfer-old-days"');
});
test("Transfer schedule preserves this month's outlet, attendance and ID until next month",()=>{
 const {app,submitForm,setToday,alerts}=boot(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 const current=app.period("2026-11"),oldId=current.serials.demo1,oldDays=current.days.demo1,oldSalary=emp.salary;
 app.handle({dataset:{tpAction:"transfer-employee",id:"demo1"}});
 submitForm("tp-transfer-form","demo1",{"#tp-transfer-outlet":"r2"});
 expect(alerts).toHaveLength(0);
 expect(emp.restaurantId).toBe("r1");
 expect(emp.pendingTransfer).toMatchObject({date:"2026-12-01",toRestaurantId:"r2"});
 expect(current.serials.demo1).toBe(oldId);expect(current.days.demo1).toBe(oldDays);
 expect(emp.salary).toBe(oldSalary);
 expect(app.data().transfers[0].status).toBe("Scheduled");
 setToday("2026-12-01");app.setPage("employees");app.render();
 expect(emp.restaurantId).toBe("r2");
 expect(emp.pendingTransfer).toBeUndefined();
 expect(app.period("2026-12").serials.demo1).toBe(1);
 expect(app.period("2026-11").serials.demo1).toBe(oldId);
 expect(app.period("2026-11").days.demo1).toBe(oldDays);
 expect(app.data().transfers[0].status).toBe("Completed");
});
test("Scheduled transfer can be cancelled",()=>{
 const {app,submitForm,setToday}=boot(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 app.handle({dataset:{tpAction:"transfer-employee",id:"demo1"}});
 submitForm("tp-transfer-form","demo1",{"#tp-transfer-outlet":"r2"});
 expect(emp.pendingTransfer).toBeDefined();
 app.handle({dataset:{tpAction:"cancel-scheduled-transfer",id:"demo1"}});
 expect(emp.pendingTransfer).toBeUndefined();
 expect(app.data().transfers).toHaveLength(0);
 setToday("2026-12-01");app.render();
 expect(emp.restaurantId).toBe("r1");
});
test("Transfer validation rejects choosing the current outlet",()=>{
 const {app,submitForm,alerts}=boot();
 app.handle({dataset:{tpAction:"transfer-employee",id:"demo1"}});
 submitForm("tp-transfer-form","demo1",{"#tp-transfer-outlet":"r1"});
 expect(alerts.some(m=>m.includes("destination"))).toBe(true);
 expect(app.data().employees.find((e:any)=>e.id==="demo1").pendingTransfer).toBeUndefined();
});
test("Employee profile has one compact More actions menu with transfer",()=>{
 const {app}=boot(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 const h=app.profile(emp),a=h.indexOf('<details class="tp-profile-more">'),b=h.indexOf("</details>",a);
 const menu=h.slice(a,b);
 expect(menu).toContain('data-tp-action="transfer-employee"');
 expect(menu).toContain('data-tp-action="mark-left"');
 expect(menu).toContain('data-tp-action="delete-employee"');
 expect(h.match(/data-tp-action="transfer-employee"/g)).toHaveLength(1);
 expect(h).toContain("Update Monthly Salary");
});
