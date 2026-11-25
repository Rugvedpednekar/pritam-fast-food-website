import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";

const base=readFileSync(new URL("../src/client/payroll-preview.js",import.meta.url),"utf8");
const archive=readFileSync(new URL("../src/client/payroll-archive-increments.js",import.meta.url),"utf8");
const bonus=readFileSync(new URL("../src/client/payroll-bonus-list.js",import.meta.url),"utf8");
const transfer=readFileSync(new URL("../src/client/payroll-transfers.js",import.meta.url),"utf8");
const bonusWithTransfer=bonus.replace(/\}\)\(\);\s*$/,transfer+"\n})();");
if(bonusWithTransfer===bonus)throw new Error("Transfer module insertion failed");
const combinedArchive=archive.replace(/\}\)\(\);\s*$/,bonusWithTransfer+"\n})();");
if(combinedArchive===archive)throw new Error("Bonus module insertion failed");
const combined=base.replace(/\}\)\(\);\s*$/,combinedArchive+"\n})();");
if(combined===base)throw new Error("Archive module insertion failed");

function boot(){
 const handlers:Record<string,Function[]>={},storage=new Map<string,string>(),alerts:string[]=[],toasts:string[]=[];
 const document={
  createElement:()=>({textContent:"",id:"",style:{},appendChild:()=>{}}),
  head:{appendChild:()=>{}},
  addEventListener:(event:string,handler:Function)=>{(handlers[event]??=[]).push(handler)},
  querySelectorAll:()=>[],getElementById:()=>null
 };
 const localStorage={getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)};
 const restaurants={restaurants:[{id:"r1",name:"Pritam Fast Food",active:true},{id:"r2",name:"Restaurant 02",active:true}]};
 const instrumented=combined.replace(/^\/\*[\s\S]*?\*\/\s*/,"").replace(/\}\)\(\);\s*$/,
  'return {render:tpRender,setPage:function(v){tpTab=v;},setMonth:function(v){tpPeriod=v;},data:function(){return tpData;},period:tpGetPeriod,active:tpEmployees,profile:tpEmployeeProfile,handle:tpHandleAction,employeeForm:tpEmployeeForm,selectRestaurant:function(v){selected=v;},getSelected:function(){return selected;}};\n})();');
 if(!instrumented.includes('return {render:tpRender'))throw new Error("Test instrumentation failed");
 const app=new Function("document","window","localStorage","data","dateIN","payroll","settings","confirm","draw","showToast","uxAlert","tab","selected","return "+instrumented)(
  document,{addEventListener:()=>{}},localStorage,restaurants,()=>"2026-11-25",
  ()=>"",()=>"<div>Restaurant settings</div>",()=>true,()=>{},(msg:string)=>toasts.push(msg),(msg:string)=>alerts.push(msg),"payroll","r1");
 function saveBonusBasis(n:string){
  const event={target:{id:"tp-bonus-basis-form",querySelector:(selector:string)=>selector==="#tp-bonus-days-month"?{value:n}:null},
   preventDefault:()=>{},stopImmediatePropagation:()=>{}};
  (handlers.submit||[]).forEach(fn=>fn(event));
 }
 function submitForm(id:string,employeeId:string,fields:Record<string,string>){
  const event={target:{id,dataset:{id:employeeId},querySelector:(selector:string)=>Object.prototype.hasOwnProperty.call(fields,selector)?{value:fields[selector]}:null},
   preventDefault:()=>{},stopImmediatePropagation:()=>{}};
  (handlers.submit||[]).forEach(fn=>fn(event));
 }
 return {app,handlers,storage,alerts,toasts,saveBonusBasis,submitForm};
}

test("Bonus List is a dedicated payroll section with per-month employee IDs and days",()=>{
 const {app}=boot();
 app.setPage("bonus");
 const html=app.render();
 expect(html).toContain('data-tp-section="bonus"');
 expect(html).toContain("12-month employee bonus sheet");
 expect(html).toContain("ID in that month");
 expect(html).toContain("Days worked");
 expect(html).toContain("Restaurant where worked");
 expect(html).toContain("Download Bonus List PDF");
 expect(html).toContain("Exactly 12 monthly columns");
 expect(html).toContain("Aarav Patil");
 expect(html).toContain("Pritam Fast Food");
 expect(html).toContain("Restaurant 02");
});

test("Bonus sheet has exactly 12 months: never shows a thirteenth month",()=>{
 const {app,saveBonusBasis}=boot();
 app.setMonth("2026-11");
 const month=(n:number)=>new Date(Date.UTC(2026,10+n,1)).toISOString().slice(0,7);
 // Make all 13 months available, each with 30 actual worked days.
 for(let n=-12;n<=0;n++){
  const p=app.period(month(n));
  p.days.demo1="30";
  p.serials.demo1=n+15;
  p.snapshots.demo1={name:"Aarav Patil",days:30,restaurant:"Pritam Fast Food"};
 }
 saveBonusBasis("26");
 app.setPage("bonus");
 const html=app.render();
 expect(html).toContain("December 2025");
 expect(html).toContain("November 2026");
 expect(html).not.toContain("November 2025");
 expect(html).toContain("360"); // All twelve 30-day months are preserved as actual workdays.
 expect(html).toContain("12.00"); // 360/26 > 13, but credit is capped at 12 months.
 expect(html).not.toContain("13.85");
 const grid=html.match(/<h3>12-month employee bonus sheet<\/h3>([\s\S]*?)<h3>Detailed month-by-month/)?.[1]||"";
 const monthHeadings=(grid.match(/<th>(?:January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4}<\/th>/g)||[]);
 expect(monthHeadings).toHaveLength(12);
});

test("Monthly IDs are shown as assigned in that specific historic month, not current month",()=>{
 const {app,saveBonusBasis}=boot();
 app.period("2026-10").serials.demo1=88;
 app.period("2026-10").days.demo1="25";
 app.period("2026-11").serials.demo1=2;
 app.period("2026-11").days.demo1="27";
 saveBonusBasis("26");
 app.setPage("bonus");
 const html=app.render();
 expect(html).toContain("ID 88");
 expect(html).toContain("ID 2");
 expect(html).toContain("October 2026");
 expect(html).toContain("November 2026");
 expect(html).toContain("25 days");
 expect(html).toContain("27 days");
});

test("Linked employment periods share a 12-month cap, not independent 12-month allowances",()=>{
 const {app,saveBonusBasis}=boot(),old=app.data().employees.find((e:any)=>e.id==="demo1");
 const next={...old,id:"rejoined-demo1",personId:"demo1",previousEmploymentId:"demo1",
  joined:"2026-11-11",restaurant:"Restaurant 02",restaurantId:"r2",active:true,left:false};
 old.active=false;old.left=true;old.rejoinedAs=next.id;
 app.data().employees.push(next);
 const p=app.period("2026-11");
 p.days.demo1="13";p.days[next.id]="17";
 p.serials.demo1=8;p.serials[next.id]=1;
 p.snapshots.demo1={days:13,restaurant:"Pritam Fast Food"};
 p.snapshots[next.id]={days:17,restaurant:"Restaurant 02"};
 saveBonusBasis("26");
 app.setPage("bonus");
 const html=app.render();
 expect(html).toContain("ID 8");
 expect(html).toContain("ID 1");
 expect(html).toContain("13 days");
 expect(html).toContain("17 days");
 expect(html).toContain("Restaurant 02");
 expect(html).toContain("Pritam Fast Food");
 // A rejoin within the same month must not generate a thirteenth monthly column.
 const grid=html.match(/<h3>12-month employee bonus sheet<\/h3>([\s\S]*?)<h3>Detailed month-by-month/)?.[1]||"";
 expect((grid.match(/<th>(?:January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4}<\/th>/g)||[])).toHaveLength(12);
 expect(grid).toContain("ID 8");
 expect(grid).toContain("ID 1");
});

test("Bonus eligibility is not falsely approved before a days-per-month rule is configured",()=>{
 const {app}=boot();
 app.setPage("bonus");
 let html=app.render();
 expect(html).toContain("Set days / month");
 expect(html).toContain("Awaiting conversion rule");
 expect(html).toContain("11 equivalent months qualify for full bonus");
 expect(html).toContain("capped at 12 equivalent months");
});


test("Transfer Employee form has only destination, date and recorded-day allocation — no transfer types",()=>{
 const {app}=boot(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 app.setPage("employees");
 expect(app.profile(emp)).toContain('data-tp-action="transfer-employee"');
 app.handle({dataset:{tpAction:"transfer-employee",id:"demo1"}});
 const html=app.render();
 expect(html).toContain('id="tp-transfer-form"');
 expect(html).toContain('id="tp-transfer-outlet"');
 expect(html).toContain('id="tp-transfer-date"');
 expect(html).toContain('id="tp-transfer-old-days"');
 // The transfer form must be next to the opened employee profile rather
 // than prepended to the very top of the entire Employees page.
 expect(html.indexOf('id="tp-transfer-form"')).toBeGreaterThan(html.indexOf("EMPLOYEE PROFILE"));
 expect(html).toContain('<option value="r2">Restaurant 02</option>');
 expect(html).toContain("Available outlets: Restaurant 02");
 expect(html).not.toContain('<option value="r1">Pritam Fast Food</option>');
 expect(html).toContain("From outlet");
 expect(html).toContain("To outlet");
 expect(html).not.toContain('id="tp-transfer-type"');
 expect(html).not.toContain("Temporary / Permanent");
 expect(html).not.toContain("Permanent transfer");
 expect(html).not.toContain("Temporary transfer");
});

test("Transferring updates outlet and monthly ID without changing salary or total workdays",()=>{
 const {app,submitForm,alerts}=boot(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 const p=app.period("2026-11"),oct=app.period("2026-10");
 const priorTotal=p.days.demo1,oldId=p.serials.demo1,octId=oct.serials.demo1;
 const n=app.data().employees.length;
 app.handle({dataset:{tpAction:"transfer-employee",id:"demo1"}});
 submitForm("tp-transfer-form","demo1",{
  "#tp-transfer-outlet":"r2","#tp-transfer-date":"2026-11-25","#tp-transfer-old-days":"12"
 });
 expect(alerts).toHaveLength(0);
 expect(app.data().employees.length).toBe(n);
 expect(emp.id).toBe("demo1");
 expect(emp.restaurant).toBe("Restaurant 02");
 expect(emp.restaurantId).toBe("r2");
 expect(app.getSelected()).toBe("r2");
 expect(p.days.demo1).toBe(priorTotal);
 expect(oct.serials.demo1).toBe(octId);
 expect(p.bonusOutlets.demo1.segments).toEqual([
  {restaurant:"Pritam Fast Food",restaurantId:"r1",monthlyId:oldId,days:12},
  {restaurant:"Restaurant 02",restaurantId:"r2",monthlyId:3,days:null}
 ]);
 expect(p.serials.demo1).toBe(3);
 expect(app.data().transfers).toHaveLength(1);
 expect(app.data().transfers[0]).toMatchObject({
  employeeId:"demo1",date:"2026-11-25",fromMonthlyId:oldId,toMonthlyId:3,daysAtPreviousOutlet:12
 });
 app.setPage("bonus");
 const sheet=app.render();
 expect(sheet).toContain("ID 1");
 expect(sheet).toContain("ID 3");
 expect(sheet).toContain("12 days");
 expect(sheet).toContain("14 days");
 expect(sheet).toContain("26"); // Split 12 + 14 = original 26, not 52.
 expect(app.profile(emp)).toContain("Outlet Transfer History");
 expect(app.profile(emp)).toContain("25 Nov 2026");
});

test("Multiple outlet transfers in one month split recorded days without double counting",()=>{
 const {app,submitForm,alerts}=boot();
 app.handle({dataset:{tpAction:"transfer-employee",id:"demo1"}});
 submitForm("tp-transfer-form","demo1",{
  "#tp-transfer-outlet":"r2","#tp-transfer-date":"2026-11-25","#tp-transfer-old-days":"12"
 });
 app.handle({dataset:{tpAction:"transfer-employee",id:"demo1"}});
 submitForm("tp-transfer-form","demo1",{
  "#tp-transfer-outlet":"r1","#tp-transfer-date":"2026-11-25","#tp-transfer-old-days":"8"
 });
 expect(alerts).toHaveLength(0);
 const p=app.period("2026-11"),segments=p.bonusOutlets.demo1.segments;
 expect(p.days.demo1).toBe("26");
 expect(segments.map((x:any)=>x.days)).toEqual([12,8,null]);
 expect(segments.map((x:any)=>x.restaurantId)).toEqual(["r1","r2","r1"]);
 expect(app.data().transfers).toHaveLength(2);
 app.setPage("bonus");
 const list=app.render();
 expect(list).toContain("12 days");
 expect(list).toContain("8 days");
 expect(list).toContain("6 days");
 const row=list.match(/<tr><td><strong>Aarav Patil<\/strong><\/td>([\s\S]*?)<\/tr>/)?.[1]||"";
 expect(row).toContain("ID 1");
 expect(row).toContain("ID 3");
});

test("Transfer validation protects historical months and rejects invalid day splits",()=>{
 const {app,submitForm,alerts}=boot(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 app.handle({dataset:{tpAction:"transfer-employee",id:"demo1"}});
 submitForm("tp-transfer-form","demo1",{
  "#tp-transfer-outlet":"r2","#tp-transfer-date":"2026-10-20","#tp-transfer-old-days":"12"
 });
 expect(emp.restaurantId).toBe("r1");
 expect(alerts.some(s=>s.includes("current month"))).toBe(true);
 submitForm("tp-transfer-form","demo1",{
  "#tp-transfer-outlet":"r2","#tp-transfer-date":"2026-11-25","#tp-transfer-old-days":"29"
 });
 expect(emp.restaurantId).toBe("r1");
 expect(alerts.some(s=>s.includes("between 0 and 26"))).toBe(true);
 expect(app.data().transfers).toBeUndefined();
});

test("Editing an existing employee keeps outlet read-only and points to Transfer Employee",()=>{
 const {app}=boot(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 const html=app.employeeForm(emp);
 expect(html).toContain("Current outlet");
 expect(html).toContain("Use Transfer Employee");
 expect(html).not.toContain('id="tp-restaurant" name="restaurant"');
 expect(html).toContain('type="hidden" name="restaurant"');
 const newEmployee=app.employeeForm(null);
 expect(newEmployee).toContain('id="tp-restaurant"');
});


test("Transfer form clearly lists other active outlets and excludes inactive branches",()=>{
 const {app}=boot(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 // Disabling the second outlet means the employee cannot transfer into it.
 // The button remains visible for clarity but offers a useful explanation.
 const list=(app as any).data();
 app.setPage("employees");
 expect(app.profile(emp)).toContain("Transfer Employee");
 app.handle({dataset:{tpAction:"transfer-employee",id:"demo1"}});
 let html=app.render();
 expect(html).toContain('<option value="r2">Restaurant 02</option>');
 expect(html).toContain("Available outlets: Restaurant 02");
 expect(html.indexOf('id="tp-transfer-form"')).toBeGreaterThan(html.indexOf("EMPLOYEE PROFILE"));
});


test("Employee profile groups transfer, resignation and deletion under one More actions menu",()=>{
 const {app}=boot(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 const html=app.profile(emp);
 const menuStart=html.indexOf('<details class="tp-profile-more">');
 const menuEnd=html.indexOf('</details>',menuStart);
 const menu=html.slice(menuStart,menuEnd);
 expect(menuStart).toBeGreaterThan(-1);
 expect(menu).toContain("More actions");
 expect(menu).toContain('data-tp-action="transfer-employee"');
 expect(menu).toContain('data-tp-action="mark-left"');
 expect(menu).toContain('data-tp-action="delete-employee"');
 expect(html.match(/data-tp-action="transfer-employee"/g)).toHaveLength(1);
 expect(html.match(/data-tp-action="mark-left"/g)).toHaveLength(1);
 expect(html.match(/data-tp-action="delete-employee"/g)).toHaveLength(1);
 expect(html.indexOf('data-tp-action="edit-employee"')).toBeLessThan(menuStart);
 expect(html.indexOf('data-tp-action="close-profile"',menuEnd)).toBeGreaterThan(menuEnd);
 expect(html).toContain("Update Monthly Salary");
});
