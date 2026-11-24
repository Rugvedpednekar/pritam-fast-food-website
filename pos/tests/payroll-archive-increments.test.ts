import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";

const payrollSource=readFileSync(new URL("../src/client/payroll-preview.js",import.meta.url),"utf8");
const archiveSource=readFileSync(new URL("../src/client/payroll-archive-increments.js",import.meta.url),"utf8");
const combined=payrollSource.replace(/\}\)\(\);\s*$/,archiveSource+"\n})();");

function boot(){
 const handlers={},storage=new Map(),alerts=[],toasts=[];
 const document={
  createElement:()=>({textContent:"",id:"",style:{},appendChild:()=>{}}),
  head:{appendChild:()=>{}},
  addEventListener:(name,fn)=>{(handlers[name]??=[]).push(fn);},
  querySelectorAll:()=>[],getElementById:()=>null
 };
 const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
 const restaurants={restaurants:[{id:"r1",name:"Pritam Fast Food",active:true},{id:"r2",name:"Restaurant 02",active:true}]};
 const instrumented=combined.replace(/^\/\*[\s\S]*?\*\/\s*/,"").replace(/\}\)\(\);\s*$/,
  'return {render:tpRender,setPage:function(v){tpTab=v;},data:function(){return tpData;},period:tpGetPeriod,compute:tpCompute,monthSalary:tpMonthSalary,rows:tpRows,active:tpEmployees,profile:tpEmployeeProfile,handle:tpHandleAction};\n})();');
 if(!instrumented.includes("return {render:tpRender"))throw Error("Archive module insertion failed");
 const app=new Function("document","window","localStorage","data","dateIN","payroll","settings","confirm","draw","showToast","uxAlert","tab","return "+instrumented)(
  document,{addEventListener:()=>{}},localStorage,restaurants,()=>"2026-11-25",
  ()=>"",()=>"<div>Restaurant Settings</div>",()=>true,()=>{},x=>toasts.push(x),x=>alerts.push(x),"payroll");
 const submit=(id,employeeId,fields)=>{
  const ev={target:{id,dataset:{id:employeeId},querySelector:s=>({value:fields[s]})},
   preventDefault:()=>{},stopImmediatePropagation:()=>{}};
  (handlers.submit||[]).forEach(fn=>fn(ev));
 };
 return {app,submit,alerts,toasts,storage};
}

test("LEFT archive is separate from active payroll without erasing prior monthly IDs",()=>{
 const {app,submit}=boot(),before=app.active().length,month="2026-11",id="demo1";
 const originalId=app.period(month).serials[id],beforeRows=app.rows(month,false).length;
 app.setPage("left");
 expect(app.render()).toContain("Left Employees (Without Salary)");
 app.handle({dataset:{tpAction:"mark-left",id}});
 submit("tp-left-form",id,{"#tp-left-date":"2026-11-20"});
 expect(app.active().length).toBe(before-1);
 expect(app.rows(month,false).length).toBe(beforeRows-1);
 expect(app.period(month).serials[id]).toBe(originalId);
 expect(app.rows(month,true).some(r=>r.emp.id===id)).toBe(true);
 app.setPage("left");expect(app.render()).toContain("Aarav Patil");
 expect(app.render()).toContain("Rejoin Employee");
 app.setPage("employees");expect(app.render()).not.toContain("Aarav Patil</h3>");
});

test("rejoining starts a distinct employment period but keeps one active profile and all archived records",()=>{
 const {app,submit}=boot(),oldId="demo1",month="2026-11",oldSerial=app.period(month).serials[oldId];
 app.handle({dataset:{tpAction:"mark-left",id:oldId}});
 submit("tp-left-form",oldId,{"#tp-left-date":"2026-11-20"});
 app.handle({dataset:{tpAction:"rejoin-employee",id:oldId}});
 submit("tp-rejoin-form",oldId,{"#tp-rejoin-date":"2026-11-22","#tp-rejoin-designation":"Supervisor","#tp-rejoin-restaurant":"Restaurant 02","#tp-rejoin-salary":"35000.00"});
 const employee=app.active().find(e=>e.personId===oldId);
 expect(employee).toBeDefined();
 expect(employee.id).not.toBe(oldId);
 expect(employee.joined).toBe("2026-11-22");
 expect(employee.salary).toBe(3500000);
 expect(app.period(month).serials[oldId]).toBe(oldSerial);
 expect(app.period(month).serials[employee.id]).not.toBe(oldSerial);
 expect(app.data().employees.filter(e=>e.id===oldId||e.personId===oldId)).toHaveLength(2);
 expect(app.data().employees.find(e=>e.id===oldId).rejoinedAs).toBe(employee.id);
 expect(app.profile(employee)).toContain("Employment periods");
 expect(app.profile(employee)).toContain("Previous monthly IDs");
 expect(app.profile(employee)).toContain("Advance history");
 app.setPage("left");
 expect(app.render()).not.toContain("Aarav Patil</h3>");
});

test("salary increments are recorded and mid-month changes prorate 30-day pay",()=>{
 const {app,submit,alerts}=boot(),emp=app.data().employees.find(e=>e.id==="demo1"),period=app.period("2026-11");
 const original=app.compute(emp,period,27,"2026-11"),oldSalary=app.monthSalary(emp,"2026-11");
 app.setPage("settings");
 expect(app.render()).toContain("Salary Increases / Increments");
 submit("tp-increment-form","",{"#tp-inc-employee":emp.id,"#tp-inc-date":"2026-11-16","#tp-inc-mode":"fixed","#tp-inc-value":"1000.00","#tp-inc-reason":"Annual increment"});
 const change=app.data().salaryChanges.find(c=>c.employeeId===emp.id);
 expect(change).toMatchObject({effectiveDate:"2026-11-16",previousSalary:oldSalary,newSalary:oldSalary+100000,
  source:"Salary Increment",reason:"Annual increment"});
 const after=app.compute(emp,period,27,"2026-11");
 expect(after.gross).toBe(Math.round((oldSalary+50000)*27/30));
 expect(after.gross).toBeGreaterThan(original.gross);
 expect(after.gross).toBeLessThan(Math.round((oldSalary+100000)*27/30));
 expect(app.profile(emp)).toContain("Annual increment");
 submit("tp-increment-form","",{"#tp-inc-employee":emp.id,"#tp-inc-date":"2026-11-16","#tp-inc-mode":"fixed","#tp-inc-value":"500.00","#tp-inc-reason":""});
 expect(app.data().salaryChanges.filter(c=>c.employeeId===emp.id)).toHaveLength(1);
 expect(alerts.some(x=>x.includes("already exists"))).toBe(true);
});

test("past months with payroll snapshots cannot be retroactively increased",()=>{
 const {app,submit,alerts}=boot();
 submit("tp-increment-form","",{"#tp-inc-employee":"demo1","#tp-inc-date":"2026-10-18",
  "#tp-inc-mode":"new","#tp-inc-value":"34000.00","#tp-inc-reason":"Retrospective"});
 expect(app.data().salaryChanges).toHaveLength(0);
 expect(alerts.some(x=>x.includes("Historical payroll cannot be revised"))).toBe(true);
});

test("legacy Delete/Restore remains separate from LEFT",()=>{
 const {app}=boot(),emp=app.data().employees.find(e=>e.id==="demo2");
 app.handle({dataset:{tpAction:"delete-employee",id:emp.id}});
 expect(emp.active).toBe(false);
 expect(emp.left).not.toBe(true);
 app.setPage("employees");
 expect(app.render()).toContain("Deleted Employees (1)");
 app.handle({dataset:{tpAction:"restore-employee",id:emp.id}});
 expect(emp.active).toBe(true);
});


test("resigning pays salary earned until the last day and keeps settlement out of active totals",()=>{
 const {app,submit}=boot(),emp=app.data().employees.find(e=>e.id==="demo1"),month="2026-11";
 const p=app.period(month),oldSerial=p.serials[emp.id],oldRows=app.rows(month).length;
 const expected=app.compute(emp,p,18,month);
 app.handle({dataset:{tpAction:"mark-left",id:emp.id}});
 app.setPage("employees");
 app.handle({dataset:{tpAction:"mark-left",id:emp.id}});
 expect(app.render()).toContain('id="tp-departure-form"');
 submit("tp-departure-form",emp.id,{
  "#tp-departure-date":"2026-11-20","#tp-departure-type":"resigned",
  "#tp-departure-days":"18","#tp-departure-payment":"DUE",
  "#tp-departure-paid-date":"","#tp-departure-method":"CASH",
  "#tp-departure-notes":"Resigned"
 });
 expect(emp.exitType).toBe("resigned");
 expect(emp.finalSettlement).toMatchObject({month,status:"DUE",net:expected.net,workedDays:18,method:"CASH"});
 expect(p.days[emp.id]).toBe("18");
 expect(p.serials[emp.id]).toBe(oldSerial);
 expect(app.rows(month).length).toBe(oldRows-1);
 app.setPage("left");
 expect(app.render()).toContain("Resigned Employees — With Final Salary");
 expect(app.render()).toContain("Record Paid");
 expect(app.render()).toContain("Final salary due");
 expect(app.profile(emp)).toContain("Final salary settlement history");
 expect(app.profile(emp)).toContain("Payment due");
});

test("owner can record final salary payment and rejoining preserves its receipt",()=>{
 const {app,submit}=boot(),emp=app.data().employees.find(e=>e.id==="demo1");
 app.handle({dataset:{tpAction:"mark-left",id:emp.id}});
 submit("tp-departure-form",emp.id,{
  "#tp-departure-date":"2026-11-20","#tp-departure-type":"resigned",
  "#tp-departure-days":"18","#tp-departure-payment":"DUE",
  "#tp-departure-paid-date":"","#tp-departure-method":"CASH",
  "#tp-departure-notes":"Family"
 });
 app.handle({dataset:{tpAction:"record-final-paid",id:emp.id}});
 submit("tp-settle-payment-form",emp.id,{"#tp-settle-date":"2026-11-25","#tp-settle-method":"CHEQUE"});
 expect(emp.finalSettlement).toMatchObject({status:"PAID",paidAt:"2026-11-25",method:"CHEQUE"});
 expect(app.profile(emp)).toContain("Paid on");
 app.handle({dataset:{tpAction:"rejoin-employee",id:emp.id}});
 submit("tp-rejoin-form",emp.id,{
  "#tp-rejoin-date":"2026-11-22","#tp-rejoin-designation":"Supervisor",
  "#tp-rejoin-restaurant":"Restaurant 02","#tp-rejoin-salary":"35000.00"
 });
 const rejoined=app.active().find(e=>e.personId===emp.id);
 expect(rejoined).toBeDefined();
 expect(rejoined.finalSettlement).toBeUndefined();
 expect(emp.finalSettlement.status).toBe("PAID");
 expect(app.profile(rejoined)).toContain("Final salary settlement history");
});

test("leaving without salary settlement preserves payroll but creates no final payment",()=>{
 const {app,submit}=boot(),emp=app.data().employees.find(e=>e.id==="demo1");
 const oldAmount=app.period("2026-11").advances[emp.id].amount;
 app.handle({dataset:{tpAction:"mark-left",id:emp.id}});
 submit("tp-departure-form",emp.id,{"#tp-departure-date":"2026-11-20","#tp-departure-type":"without-salary"});
 expect(emp.exitType).toBe("without-salary");
 expect(emp.finalSettlement).toBeUndefined();
 expect(app.period("2026-11").advances[emp.id].amount).toBe(oldAmount);
 app.setPage("left");
 expect(app.render()).toContain("Left Employees (Without Salary)");
 expect(app.render()).toContain("Aarav Patil");
});
