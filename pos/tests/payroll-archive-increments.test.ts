import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";

const payrollSource=readFileSync(new URL("../src/client/payroll-preview.js",import.meta.url),"utf8");
const archiveSource=readFileSync(new URL("../src/client/payroll-archive-increments.js",import.meta.url),"utf8");
const combined=payrollSource.replace(/\}\)\(\);\s*$/,archiveSource+"\n})();");

function boot(initialRestaurant){
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
  'return {render:tpRender,setPage:function(v){tpTab=v;},data:function(){return tpData;},period:tpGetPeriod,compute:tpCompute,monthSalary:tpMonthSalary,rows:tpRows,active:tpEmployees,profile:tpEmployeeProfile,handle:tpHandleAction,selectRestaurant:function(v){selected=v;},employeeForm:tpEmployeeForm};\n})();');
 if(!instrumented.includes("return {render:tpRender"))throw Error("Archive module insertion failed");
 const app=new Function("document","window","localStorage","data","dateIN","payroll","settings","confirm","draw","showToast","uxAlert","tab","selected","return "+instrumented)(
  document,{addEventListener:()=>{}},localStorage,restaurants,()=>"2026-11-25",
  ()=>"",()=>"<div>Restaurant Settings</div>",()=>true,()=>{},x=>toasts.push(x),x=>alerts.push(x),"payroll",initialRestaurant);
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
 expect(app.render()).toContain("Resigned Employees");
 expect(app.render()).not.toContain("Left Employees (Without Salary)");
 app.handle({dataset:{tpAction:"mark-left",id}});
 submit("tp-departure-form",id,{"#tp-departure-date":"2026-11-20","#tp-departure-days":"18","#tp-departure-payment":"DUE","#tp-departure-paid-date":"","#tp-departure-method":"CASH","#tp-departure-notes":""});
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
 submit("tp-departure-form",oldId,{"#tp-departure-date":"2026-11-20","#tp-departure-days":"18","#tp-departure-payment":"PAID","#tp-departure-paid-date":"2026-11-20","#tp-departure-method":"CASH","#tp-departure-notes":""});
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

test("Salary changes from employee profile take effect only on the 1st of next month",()=>{
 const {app,submit,alerts}=boot("r1"),emp=app.data().employees.find(e=>e.id==="demo1"),nov=app.period("2026-11");
 const initial=app.monthSalary(emp,"2026-11"),calcBefore=app.compute(emp,nov,27,"2026-11");
 app.setPage("settings");
 expect(app.render()).not.toContain("Salary Increases / Increments");
 app.setPage("employees");
 app.handle({dataset:{tpAction:"view-employee",id:emp.id}});
 const html=app.render();
 expect(html).toContain('id="tp-profile-salary-form"');
 expect(html).toContain("01 Dec 2026");
 expect(html).toContain("1st of next month");
 submit("tp-profile-salary-form",emp.id,{"#tp-profile-new-salary":"33000"});
 const history=app.data().salaryChanges.find(c=>c.employeeId===emp.id);
 expect(history).toMatchObject({
  effectiveMonth:"2026-12",effectiveDate:"2026-12-01",
  previousSalary:initial,newSalary:initial+100000,
  source:"Salary Revision",reason:"Updated from Employee Profile"
 });
 expect(app.monthSalary(emp,"2026-10")).toBe(initial);
 expect(app.monthSalary(emp,"2026-11")).toBe(initial);
 expect(app.monthSalary(emp,"2026-12")).toBe(initial+100000);
 expect(app.compute(emp,nov,27,"2026-11").gross).toBe(calcBefore.gross);
 expect(app.compute(emp,nov,27,"2026-11").proratedMonthly).toBeUndefined();
 const next=app.compute(emp,app.period("2026-12"),27,"2026-12");
 expect(next.gross).toBe(Math.round((initial+100000)*27/30));
 expect(next.proratedMonthly).toBeUndefined();
 expect(app.profile(emp)).toContain("Salary Change History");
 expect(alerts).toHaveLength(0);
});

test("Future salary revisions never recalculate or overwrite current and historic payroll",()=>{
 const {app,submit,alerts}=boot("r1"),emp=app.data().employees.find(e=>e.id==="demo1");
 const october=app.monthSalary(emp,"2026-10"),november=app.monthSalary(emp,"2026-11");
 const oldSnapshot=JSON.stringify(app.period("2026-10").snapshots[emp.id]);
 const novemberSnapshot=JSON.stringify(app.period("2026-11").snapshots[emp.id]);
 app.handle({dataset:{tpAction:"view-employee",id:emp.id}});
 submit("tp-profile-salary-form",emp.id,{"#tp-profile-new-salary":"31000"});
 expect(app.monthSalary(emp,"2026-10")).toBe(october);
 expect(app.monthSalary(emp,"2026-11")).toBe(november);
 expect(app.monthSalary(emp,"2026-12")).toBe(3100000);
 expect(JSON.stringify(app.period("2026-10").snapshots[emp.id])).toBe(oldSnapshot);
 expect(JSON.stringify(app.period("2026-11").snapshots[emp.id])).toBe(novemberSnapshot);
 expect(app.data().salaryChanges).toHaveLength(1);
 expect(alerts).toHaveLength(0);
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
  "#tp-departure-date":"2026-11-20",
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
 expect(app.render()).toContain("Resigned Employees");
 expect(app.render()).toContain("Record Paid");
 expect(app.render()).toContain("Final salary due");
 expect(app.profile(emp)).toContain("Final salary settlement history");
 expect(app.profile(emp)).toContain("Payment due");
});

test("owner can record final salary payment and rejoining preserves its receipt",()=>{
 const {app,submit}=boot(),emp=app.data().employees.find(e=>e.id==="demo1");
 app.handle({dataset:{tpAction:"mark-left",id:emp.id}});
 submit("tp-departure-form",emp.id,{
  "#tp-departure-date":"2026-11-20",
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

test("Legacy left-without-settlement records appear under Resigned and can complete Paid/Due settlement",()=>{
 const {app,submit}=boot("r1"),emp=app.data().employees.find(e=>e.id==="demo1");
 const savedAdvance=app.period("2026-11").advances[emp.id].amount;
 emp.left=true;emp.active=false;emp.leftAt="2026-11-20";emp.lastWorkingDate="2026-11-20";
 emp.exitType="without-salary";delete emp.finalSettlement;
 app.setPage("left");
 expect(app.render()).toContain("Resigned Employees");
 expect(app.render()).toContain("Record Final Salary");
 expect(app.render()).not.toContain("Left Employees (Without Salary)");
 app.handle({dataset:{tpAction:"complete-final-settlement",id:emp.id}});
 expect(app.render()).toContain("Complete Resignation Settlement");
 submit("tp-departure-form",emp.id,{"#tp-departure-date":"2026-11-20",
  "#tp-departure-days":"18","#tp-departure-payment":"PAID",
  "#tp-departure-paid-date":"2026-11-25","#tp-departure-method":"CASH",
  "#tp-departure-notes":"Prior employee"});
 expect(emp.exitType).toBe("resigned");
 expect(emp.finalSettlement).toMatchObject({status:"PAID",paidAt:"2026-11-25",workedDays:18});
 expect(app.period("2026-11").advances[emp.id].amount).toBe(savedAdvance);
 app.setPage("left");
 expect(app.render()).toContain("Resigned · Salary paid");
 expect(app.render()).not.toContain("Record Final Salary");
});

test("Resignation form has only Paid/Due final salary, no separate without-salary option",()=>{
 const {app}=boot("r1");
 app.handle({dataset:{tpAction:"mark-left",id:"demo1"}});
 const html=app.render();
 expect(html).toContain('id="tp-departure-payment"');
 expect(html).toContain('value="DUE"');
 expect(html).toContain('value="PAID"');
 expect(html).not.toContain('id="tp-departure-type"');
 expect(html).not.toContain('value="without-salary"');
});

test("Payroll employee roster, attendance, advances, and salary totals follow the selected restaurant",()=>{
 const {app}=boot("r1");
 expect(app.active().map(e=>e.id)).toEqual(["demo1","demo2","demo3","demo4","demo7"]);
 expect(app.rows().map(r=>r.emp.id).sort()).toEqual(["demo1","demo2","demo3","demo4","demo7"]);
 app.setPage("employees");
 expect(app.render()).toContain("Aarav Patil");
 expect(app.render()).not.toContain("Kabir Khan");
 expect(app.render()).not.toContain("Riya Kulkarni");
 app.setPage("attendance");
 expect(app.render()).not.toContain("Kabir Khan");
 expect(app.render()).not.toContain("Riya Kulkarni");
 app.setPage("advances");
 expect(app.render()).not.toContain("Kabir Khan");
 expect(app.render()).not.toContain("Riya Kulkarni");
 const r1Total=app.rows().reduce((sum,row)=>sum+(row.calc?row.calc.net:0),0);
 app.selectRestaurant("r2");
 expect(app.active().map(e=>e.id)).toEqual(["demo5","demo6"]);
 expect(app.rows().map(r=>r.emp.id)).toEqual(["demo5","demo6"]);
 app.setPage("employees");
 const roster=app.render();
 expect(roster).toContain("Kabir Khan");
 expect(roster).toContain("Riya Kulkarni");
 expect(roster).not.toContain("Aarav Patil");
 app.setPage("advances");
 expect(app.render()).toContain("Kabir Khan");
 expect(app.render()).not.toContain("Aarav Patil");
 app.setPage("sheets");
 expect(app.render()).toContain("Kabir Khan");
 expect(app.render()).not.toContain("Aarav Patil");
 const r2Total=app.rows().reduce((sum,row)=>sum+(row.calc?row.calc.net:0),0);
 expect(r1Total).toBeGreaterThan(r2Total);
 app.setPage("history");
 expect(app.render()).toContain("Kabir Khan");
 expect(app.render()).not.toContain("Aarav Patil");
 app.selectRestaurant("r1");
 app.setPage("history");
 expect(app.render()).toContain("Aarav Patil");
 expect(app.render()).not.toContain("Kabir Khan");
});

test("Adding an employee defaults to the currently selected restaurant",()=>{
 const {app}=boot("r2");
 const form=app.employeeForm(null);
 expect(form).toContain('value="Restaurant 02" selected');
 app.selectRestaurant("r1");
 expect(app.employeeForm(null)).toContain('value="Pritam Fast Food" selected');
});

test("Archived, resigned, and deleted employees stay inside their restaurant lists",()=>{
 const {app,submit}=boot("r1");
 app.handle({dataset:{tpAction:"mark-left",id:"demo1"}});
 submit("tp-departure-form","demo1",{
  "#tp-departure-date":"2026-11-20",
  "#tp-departure-days":"18","#tp-departure-payment":"DUE",
  "#tp-departure-paid-date":"","#tp-departure-method":"CASH","#tp-departure-notes":"Test"
 });
 app.setPage("left");
 expect(app.render()).toContain("Aarav Patil");
 app.selectRestaurant("r2");
 app.setPage("left");
 expect(app.render()).not.toContain("Aarav Patil");
 app.selectRestaurant("r1");
 app.setPage("left");
 expect(app.render()).toContain("Aarav Patil");
 // Directly verify that no records were erased while switching.
 expect(app.data().employees.find(e=>e.id==="demo1").finalSettlement.status).toBe("DUE");
 app.selectRestaurant("r2");
 app.handle({dataset:{tpAction:"delete-employee",id:"demo5"}});
 app.setPage("employees");
 expect(app.render()).toContain("Deleted Employees (1)");
 app.selectRestaurant("r1");
 app.setPage("employees");
 expect(app.render()).not.toContain("Deleted Employees (1)");
});

test("Payroll editing/viewing state does not leak across restaurant switches",()=>{
 const {app}=boot("r1");
 app.setPage("employees");
 app.handle({dataset:{tpAction:"view-employee",id:"demo1"}});
 expect(app.render()).toContain("EMPLOYEE PROFILE");
 app.selectRestaurant("r2");
 app.setPage("employees");
 expect(app.render()).not.toContain("EMPLOYEE PROFILE");
 expect(app.render()).not.toContain("Aarav Patil");
});


test("Resigned Employees tab appears after Payment Sheets and before Payroll History",()=>{
 const {app}=boot("r1");
 app.setPage("attendance");
 const nav=app.render().match(/<nav class="tp-nav"[\s\S]*?<\/nav>/)?.[0]||"";
 expect(nav).toContain('data-tp-section="left"');
 const sheets=nav.indexOf('data-tp-section="sheets"');
 const left=nav.indexOf('data-tp-section="left"');
 const history=nav.indexOf('data-tp-section="history"');
 expect(sheets).toBeGreaterThan(0);
 expect(left).toBeGreaterThan(sheets);
 expect(history).toBeGreaterThan(left);
});

test("Rejoined employee receives next free monthly ID in their new restaurant",()=>{
 const {app,submit}=boot("r1");
 const emp=app.data().employees.find(e=>e.id==="demo1");
 app.handle({dataset:{tpAction:"mark-left",id:emp.id}});
 submit("tp-departure-form",emp.id,{"#tp-departure-date":"2026-11-20",
  "#tp-departure-days":"18","#tp-departure-payment":"PAID",
  "#tp-departure-paid-date":"2026-11-20","#tp-departure-method":"CASH","#tp-departure-notes":""});
 app.handle({dataset:{tpAction:"rejoin-employee",id:emp.id}});
 submit("tp-rejoin-form",emp.id,{"#tp-rejoin-date":"2026-11-22",
  "#tp-rejoin-designation":"Cook","#tp-rejoin-restaurant":"Restaurant 02","#tp-rejoin-salary":"35000.00"});
 const renewed=app.data().employees.find(e=>e.previousEmploymentId==="demo1");
 expect(renewed).toBeDefined();
 expect(app.period("2026-11").serials[renewed.id]).toBe(3);
 // Its old ID belongs to Pritam Fast Food, so Restaurant 02 may have its own ID 1.
 expect(app.period("2026-11").serials.demo5).toBe(1);
 expect(app.period("2026-11").serials.demo1).toBe(1);
});
