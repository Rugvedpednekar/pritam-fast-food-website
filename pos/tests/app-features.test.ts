import {test, expect} from "bun:test";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../src/client/payroll-preview.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../src/client/index.html",import.meta.url),"utf8");

function boot(savedData){
 const storage=new Map();
 if(savedData)storage.set("tablewise-payroll-demo-v3",JSON.stringify(savedData));
 const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,v)=>storage.set(key,v)};
 const document={
   createElement:()=>({textContent:"",id:"",style:{},appendChild:()=>{}}),
   head:{appendChild:()=>{}},
   addEventListener:()=>{}
 };
 const window={addEventListener:()=>{}};
 const restaurants={restaurants:[{id:"r1",name:"Pritam Fast Food",active:true},{id:"r2",name:"Restaurant 02",active:true}]};
 const instrumented=source.replace(/^\/\*[\s\S]*?\*\/\s*/,"").replace(/\}\)\(\);\s*$/,
  'return {page:payroll,setPage:function(v){tpTab=v;},data:function(){return tpData;},compute:tpCompute,leaveEarned:tpLeaveEarned,rows:tpRows,totals:tpTotals,employeeForm:tpEmployeeForm,save:tpSave,settings:settings};\n})();');
 if(!instrumented.includes("return {page:payroll"))throw Error("Payroll runtime instrumentation failed");
 const app=new Function("document","window","localStorage","data","dateIN","payroll","settings",
 "return "+instrumented)(document,window,localStorage,restaurants,()=>"2026-11-25",()=>"",()=>"<div>Restaurant Settings</div>");
 return {app,storage};
}

test("All seven payroll sections render without Paid checkboxes or scheduled 5th/15th labels",()=>{
 const {app}=boot();
 const tabs=["dashboard","employees","advances","salary","sheets","history","settings"];
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
