import {test, expect} from "bun:test";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../src/client/payroll-preview.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../src/client/index.html",import.meta.url),"utf8");

function boot(savedData){
 const handlers={},storage=new Map();
 let inputs=[];
 const setInputs=next=>{inputs=next;};
 if(savedData)storage.set("tablewise-payroll-demo-v3",JSON.stringify(savedData));
 const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,v)=>storage.set(key,v)};
 const document={
   createElement:()=>({textContent:"",id:"",style:{},appendChild:()=>{}}),
   head:{appendChild:()=>{}},
   addEventListener:(type,fn)=>{(handlers[type]??=[]).push(fn);},
   querySelectorAll:selector=>selector.includes("data-tp-field")?inputs:[],
   getElementById:()=>null
 };
 const window={addEventListener:()=>{}};
 const restaurants={restaurants:[{id:"r1",name:"Pritam Fast Food",active:true},{id:"r2",name:"Restaurant 02",active:true}]};
 const instrumented=source.replace(/^\/\*[\s\S]*?\*\/\s*/,"").replace(/\}\)\(\);\s*$/,
  'return {page:payroll,setPage:function(v){tpTab=v;},data:function(){return tpData;},compute:tpCompute,leaveEarned:tpLeaveEarned,rows:tpRows,totals:tpTotals,employeeForm:tpEmployeeForm,save:tpSave,settings:settings,handle:tpHandleAction,history:tpHistory};\n})();');
 if(!instrumented.includes("return {page:payroll"))throw Error("Payroll runtime instrumentation failed");
 const app=new Function("document","window","localStorage","data","dateIN","payroll","settings","confirm","draw","showToast","uxAlert",
 "return "+instrumented)(document,window,localStorage,restaurants,()=>"2026-11-25",()=>"",()=>"<div>Restaurant Settings</div>",()=>true,()=>{},()=>{},()=>{});
 return {app,storage,handlers,setInputs};
}

test("All eight payroll sections render without Paid checkboxes or scheduled 5th/15th labels",()=>{
 const {app}=boot();
 const tabs=["dashboard","employees","attendance","advances","salary","sheets","history","settings"];
 for(const tab of tabs){
  app.setPage(tab);
  const page=app.page();
  expect(page.length).toBeGreaterThan(1000);
  expect(page).not.toContain('type="checkbox"');
  expect(page).not.toContain("Advance Management · 5th");
  expect(page).not.toContain("Salary Calculator · 15th");
 }
 expect(source).not.toContain('data-tp-field="advancepaid"');
 expect(source).not.toContain('data-tp-field="salarypaid"');
 expect(app.settings()).toContain("Configure Payroll Leave Rule");
});

test("Employee create/edit form includes paid leave allowance per month",()=>{
 const {app}=boot();
 const employees=app.data().employees;
 expect(employees).toHaveLength(6);
 expect(employees[0].leaveAllowance).toBe(4);
 expect(employees[1].leaveAllowance).toBe(2);
 const form=app.employeeForm(null),edit=app.employeeForm(employees[0]);
 expect(form).toContain('id="tp-leaves"');
 expect(form).toContain('name="leaveAllowance"');
 expect(edit).toContain('value="4"');
});

test("27 worked days accrue 3 paid leave days with a 4-day cap",()=>{
 const {app}=boot(),emp={id:"e1",salary:3000000,method:"CASH",leaveAllowance:4};
 const p={days:{e1:"27"},advances:{},deductions:{}};
 const c=app.compute(emp,p);
 expect(c).toMatchObject({days:27,gross:2700000,leaveEarned:3,leavePay:300000,net:3000000});
});

test("27 worked days only earn 2 paid leave days with a 2-day employee cap",()=>{
 const {app}=boot(),emp={id:"e1",salary:3000000,method:"CHEQUE",leaveAllowance:2};
 const p={days:{e1:"27"},advances:{},deductions:{}};
 expect(app.compute(emp,p)).toMatchObject({gross:2700000,leaveEarned:2,leavePay:200000,net:2900000});
});

test("Leave earning interval in settings changes results while honoring caps",()=>{
 const {app}=boot(),emp={id:"e1",salary:3000000,method:"CASH",leaveAllowance:4};
 const p={days:{e1:"27"},advances:{},deductions:{}};
 app.data().settings.leaveEarnEveryDays=10;
 expect(app.compute(emp,p)).toMatchObject({leaveEarned:2,leavePay:200000});
 app.data().settings.leaveEarnEveryDays=5;
 expect(app.compute(emp,p)).toMatchObject({leaveEarned:4,leavePay:400000});
 expect(app.leaveEarned(28,4,7)).toBe(4);
 expect(app.leaveEarned(27,2,7)).toBe(2);
});

test("An entered advance is deducted without requiring a Paid checkbox",()=>{
 const {app}=boot(),emp={id:"e1",salary:3000000,method:"CASH",leaveAllowance:4};
 const p={days:{e1:"27"},advances:{e1:{amount:500000,paid:false}},deductions:{e1:{fine:20000,other:0}}};
 const c=app.compute(emp,p);
 expect(c).toMatchObject({gross:2700000,leavePay:300000,paidAdvance:500000,fine:20000,net:2480000});
});

test("Cash plus cheque amounts equal grand total with leave pay included",()=>{
 const {app}=boot(),rows=app.rows(),totals=app.totals(rows);
 expect(totals.ready).toBe(6);
 expect(totals.leavePay).toBeGreaterThan(0);
 expect(totals.cash+totals.cheque).toBe(totals.grand);
 expect(totals.advPaid).toBe(totals.adv);
});

test("Migrates pre-existing browser demo data without resetting employee information",()=>{
 const previous={version:3,employees:[{id:"old",name:"Existing employee",salary:2000000,method:"CASH",designation:"Cook",active:true}],
 periods:{},createdAt:"2026-01-01T00:00:00Z"};
 const {app}=boot(previous);
 expect(app.data().employees[0].name).toBe("Existing employee");
 expect(app.data().employees[0].leaveAllowance).toBe(2);
 expect(app.data().settings.leaveEarnEveryDays).toBe(7);
 expect(app.save()).toBe(true);
});

test("Half-days and excessive deductions remain safe",()=>{
 const {app}=boot(),emp={id:"e",salary:3000000,method:"CHEQUE",leaveAllowance:0};
 const valid=app.compute(emp,{days:{e:"22.5"},advances:{},deductions:{}});
 expect(valid).toMatchObject({days:22.5,gross:2250000,leaveEarned:0,net:2250000});
 const excess=app.compute(emp,{days:{e:"1"},advances:{e:{amount:800000}},deductions:{}});
 expect(excess).toMatchObject({gross:100000,net:0,shortfall:700000});
});

test("Restaurant archive and restore schema remains valid",()=>{
 const match=html.match(/function valid\(d\)\{[^\n]+\}/);
 if(!match)throw Error("Missing restaurant state validation");
 const valid=new Function(match[0]+"\nreturn valid;")();
 const s={schema:1,restaurants:[{id:"r1",active:true},{id:"r2",active:false}],menus:{},bills:[],employees:[],closings:[],seq:1};
 expect(valid(s)).toBe(true);
 expect(valid({...s,restaurants:s.restaurants.map(r=>({...r,active:false}))})).toBe(false);
});

test("Advance and cash/cheque print and CSV export remain available",()=>{
 expect(source).toContain('Print Distribution Sheet');
 expect(source).toContain('print-cash');
 expect(source).toContain('print-cheque');
 expect(source).toContain('window.print()');
 expect(source).toContain('localStorage.setItem(TP_KEY');
 expect(source).toContain('canvas.toDataURL("image/jpeg"');
 expect(source).toContain('tpHistory');
});


test("Attendance uses the exact salary days for the selected month, not extra leave money",()=>{
 const {app}=boot();
 app.setPage("attendance");
 const attendance=app.page();
 expect(attendance).toContain('Monthly Attendance');
 expect(attendance).toContain('Worked days only');
 expect(attendance).toContain('data-tp-field="days"');
 expect(attendance).toContain('enterkeyhint="next"');
 expect(attendance).not.toContain('Salary ÷ 30 × earned leave days');
 const period=app.data().periods["2026-11"];
 expect(period.days.demo1).toBe("26");
 period.days.demo1="27.5";
 app.setPage("salary");
 expect(app.page()).toContain('value="27.5"');
 expect(app.rows()[0].calc.days).toBe(27.5);
 app.setPage("attendance");
 expect(app.page()).toContain('value="27.5"');
});

test("Delete employee removes from active salary and attendance but keeps monthly history; Restore works",()=>{
 const {app,storage}=boot();
 const previousRows=app.rows().length;
 const historyBefore=app.history();
 expect(historyBefore).toContain("Aarav Patil");
 app.handle({dataset:{tpAction:"delete-employee",id:"demo1"}});
 expect(app.data().employees[0].active).toBe(false);
 expect(app.rows()).toHaveLength(previousRows-1);
 app.setPage("attendance");
 expect(app.page()).not.toContain('data-id="demo1"');
 app.setPage("employees");
 const page=app.page();
 expect(page).toContain("Deleted Employees (1)");
 expect(page).toContain('data-tp-action="restore-employee"');
 expect(app.history()).toContain("Aarav Patil");
 expect(storage.has("tablewise-payroll-demo-v3")).toBe(true);
 app.handle({dataset:{tpAction:"restore-employee",id:"demo1"}});
 expect(app.rows()).toHaveLength(previousRows);
 expect(app.data().employees[0].active).toBe(true);
});

test("Enter on salary/attendance saves monthly days and focuses the next employee",()=>{
 const {app,handlers,setInputs}=boot();
 expect(handlers.keydown).toHaveLength(1);
 expect(handlers.change?.length).toBeGreaterThan(0);
 let focusId=null,selectedId=null,scrollId=null;
 const ids=["demo1","demo2","demo3"];
 const fields=ids.map(id=>({
  value:id==="demo1"?"22.5":"25",
  dataset:{tpField:"days",id},
  matches:selector=>selector.includes("data-tp-field"),
  dispatchEvent:function(){handlers.change[0]({target:this});return true;},
  focus:()=>{focusId=id;},select:()=>{selectedId=id;},
  scrollIntoView:()=>{scrollId=id;}
 }));
 setInputs(fields);
 for(const section of ["attendance","salary"]){
  app.setPage(section);focusId=null;selectedId=null;scrollId=null;
  let prevented=false;
  handlers.keydown[0]({
   target:fields[0],key:"Enter",isComposing:false,
   preventDefault:()=>{prevented=true;},stopImmediatePropagation:()=>{}
  });
  expect(prevented).toBe(true);
  expect(app.data().periods["2026-11"].days.demo1).toBe("22.5");
  expect(focusId).toBe("demo2");
  expect(selectedId).toBe("demo2");
  expect(scrollId).toBe("demo2");
  expect(app.rows()[0].calc.days).toBe(22.5);
 }
});
