import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";

const base=readFileSync(new URL("../src/client/payroll-preview.js",import.meta.url),"utf8");
const archive=readFileSync(new URL("../src/client/payroll-archive-increments.js",import.meta.url),"utf8");
const bonus=readFileSync(new URL("../src/client/payroll-bonus-list.js",import.meta.url),"utf8");
const combinedArchive=archive.replace(/\}\)\(\);\s*$/,bonus+"\n})();");
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
  'return {render:tpRender,setPage:function(v){tpTab=v;},setMonth:function(v){tpPeriod=v;},data:function(){return tpData;},period:tpGetPeriod,active:tpEmployees,profile:tpEmployeeProfile,selectRestaurant:function(v){selected=v;}};\n})();');
 if(!instrumented.includes('return {render:tpRender'))throw new Error("Test instrumentation failed");
 const app=new Function("document","window","localStorage","data","dateIN","payroll","settings","confirm","draw","showToast","uxAlert","tab","selected","return "+instrumented)(
  document,{addEventListener:()=>{}},localStorage,restaurants,()=>"2026-11-25",
  ()=>"",()=>"<div>Restaurant settings</div>",()=>true,()=>{},(msg:string)=>toasts.push(msg),(msg:string)=>alerts.push(msg),"payroll","r1");
 function saveBonusBasis(n:string){
  const event={target:{id:"tp-bonus-basis-form",querySelector:(selector:string)=>selector==="#tp-bonus-days-month"?{value:n}:null},
   preventDefault:()=>{},stopImmediatePropagation:()=>{}};
  (handlers.submit||[]).forEach(fn=>fn(event));
 }
 return {app,handlers,storage,alerts,toasts,saveBonusBasis};
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
