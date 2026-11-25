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
   querySelectorAll:selector=>{
    const kind=selector.match(/data-tp-field="([^"]+)"/)?.[1];
    return kind?inputs.filter(x=>x.dataset.tpField===kind):[];
   },
   getElementById:()=>null
 };
 const window={addEventListener:()=>{}};
 const restaurants={restaurants:[{id:"r1",name:"Pritam Fast Food",active:true},{id:"r2",name:"Restaurant 02",active:true}]};
 const instrumented=source.replace(/^\/\*[\s\S]*?\*\/\s*/,"").replace(/\}\)\(\);\s*$/,
  'return {page:payroll,setPage:function(v){tpTab=v;},setMonth:function(v){tpPeriod=v;},data:function(){return tpData;},period:tpGetPeriod,compute:tpCompute,leaveEarned:tpLeaveEarned,monthSalary:tpMonthSalary,changeSalary:tpSetMonthSalary,serial:tpSerialValue,rows:tpRows,totals:tpTotals,employeeForm:tpEmployeeForm,save:tpSave,settings:settings,navigate:tpSetTab,handle:tpHandleAction,money:tpMoney,parseMoney:parsePaise,history:tpHistory,pdfBuild:tpPdfBuild,pdfPages:tpGeneralPdfPages,parcelPdfPages:tpParcelPdfPages,downloadPDF:tpDownloadPDF,doPrint:tpDoPrint,commission:tpCommissionCalculate,commissionEditor:tpCommissionEditor,isParcel:tpIsParcel,openCommission:function(id){tpCommissionOpen=id;}};\n})();');
 if(!instrumented.includes("return {page:payroll"))throw Error("Payroll runtime instrumentation failed");
 const app=new Function("document","window","localStorage","data","dateIN","payroll","settings","confirm","draw","showToast","uxAlert","tab",
 "return "+instrumented)(document,window,localStorage,restaurants,()=>"2026-11-25",()=>"",()=>"<div>Restaurant Settings</div>",()=>true,()=>{},()=>{},()=>{},"payroll");
 return {app,storage,handlers,setInputs};
}

test("Payroll sections render with Payment Sheets instead of a separate Salary Calculator",()=>{
 const {app}=boot();
 const tabs=["dashboard","employees","attendance","advances","sheets","history","settings"];
 expect(source).not.toContain('data-tp-section="salary"');
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
 expect(employees).toHaveLength(7);
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
 expect(totals.ready).toBe(7);
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

test("Advance, attendance, cash, cheque and parcel PDF downloads remain available",()=>{
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
 app.setPage("sheets");
 app.handle({dataset:{tpAction:"view-calculation",id:"demo1"}});
 expect(app.page()).toContain("27.5");
 expect(app.page()).toContain("View Calculation");
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

test("Enter on attendance saves monthly days and focuses the next employee",()=>{
 const {app,handlers,setInputs}=boot();
 expect(handlers.keydown).toHaveLength(2);
 expect(handlers.change?.length).toBeGreaterThan(0);
 let focusId=null,selectedId=null,scrollId=null;
 const ids=["demo1","demo2","demo3"];
 const fields=ids.map(id=>({
  value:id==="demo1"?"22.5":"25",
  dataset:{tpField:"days",id},
  matches:selector=>selector.includes("data-tp-field"),
  dispatchEvent:function(){handlers.change[handlers.change.length-1]({target:this});return true;},
  focus:()=>{focusId=id;},select:()=>{selectedId=id;},
  scrollIntoView:()=>{scrollId=id;}
 }));
 setInputs(fields);
 for(const section of ["attendance"]){
  app.setPage(section);focusId=null;selectedId=null;scrollId=null;
  let prevented=false;
  handlers.keydown.find(fn=>fn.toString().includes('nextField="days"'))({
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


test("Attendance does not show the total worked-days summary card",()=>{
 const {app}=boot();
 app.setPage("attendance");
 const html=app.page();
 expect(html).not.toContain("Total worked days");
 expect(html).toContain("Attendance recorded");
 expect(html).toContain("Days worked");
});
test("Enter on Advances saves current amount and moves directly to next employee Advance",()=>{
 const {app,handlers,setInputs}=boot();
 app.setPage("advances");
 const html=app.page();
 expect(html).toContain('data-tp-field="advance"');
 expect(html).toContain('enterkeyhint="next"');
 let focusId=null,selectedId=null,scrollId=null,prevented=false;
 const inputs=["demo1","demo2","demo3"].map(id=>({
  value:id==="demo1"?"1235":"0",
  dataset:{tpField:"advance",id},
  matches:selector=>selector.includes('data-tp-field="advance"'),
  dispatchEvent:function(){handlers.change[handlers.change.length-1]({target:this});return true;},
  focus:()=>{focusId=id;},select:()=>{selectedId=id;},
  scrollIntoView:()=>{scrollId=id;}
 }));
 setInputs(inputs);
 const key=handlers.keydown.find(fn=>fn.toString().includes('nextField="days"'));
 key({target:inputs[0],key:"Enter",isComposing:false,
  preventDefault:()=>{prevented=true;},stopImmediatePropagation:()=>{}});
 expect(prevented).toBe(true);
 expect(app.period("2026-11").advances.demo1.amount).toBe(123500);
 expect(focusId).toBe("demo2");
 expect(selectedId).toBe("demo2");
 expect(scrollId).toBe("demo2");
 inputs[1].value="250";
 key({target:inputs[1],key:"Enter",isComposing:false,
  preventDefault:()=>{},stopImmediatePropagation:()=>{}});
 expect(app.period("2026-11").advances.demo2.amount).toBe(25000);
 expect(focusId).toBe("demo3");
 inputs[2].value="0";
 focusId=null;
 key({target:inputs[2],key:"Enter",isComposing:false,
  preventDefault:()=>{},stopImmediatePropagation:()=>{}});
 expect(app.period("2026-11").advances.demo3.amount).toBe(0);
 expect(focusId).toBe(null);
});


test("Payroll currency and entry fields use whole rupees rather than paise",()=>{
 const {app}=boot();
 expect(app.money(2000000)).toContain("20,000");
 expect(app.money(2000000)).not.toContain(".00");
 expect(app.money(0)).not.toContain(".00");
 expect(app.parseMoney("125")).toBe(12500);
 expect(app.parseMoney("125.00")).toBe(12500); // legacy typed amount is tolerated
 expect(app.parseMoney("125.50")).toBeNull();  // no paise for employees
 app.setPage("advances");
 const page=app.page();
 expect(page).toContain("Other deduction (₹)");
 expect(page).not.toContain('value="0.00"');
 expect(page).toContain('value="0"');
 const salaryForm=app.employeeForm(null);
 expect(salaryForm).not.toContain('value="0.00"');
});

test("Empty advance, fine, and Other deduction fields save zero without warnings",()=>{
 const {app,handlers}=boot();
 app.setPage("advances");
 const change=handlers.change[handlers.change.length-1];
 const fields=["advance","fine","other"];
 for(const name of fields){
  const target={id:"",dataset:{tpField:name,id:"demo1"},value:""};
  change({target});
  expect(target.value).toBe("0");
 }
 const p=app.period("2026-11");
 expect(p.advances.demo1.amount).toBe(0);
 expect(p.advances.demo1.kind).toBeUndefined();
 expect(p.deductions.demo1.fine).toBe(0);
 expect(p.deductions.demo1.other).toBe(0);
});

test("Monthly IDs support values over 100 and are unique only within each restaurant",()=>{
 const {app,handlers}=boot();
 const p=app.period("2026-11");
 p.serials.demo1=99;p.serials.demo2=3;p.serials.demo3=2;
 expect(app.rows().slice(0,3).map(r=>r.emp.id)).toEqual(["demo5","demo3","demo6"]);
 app.setPage("attendance");
 const page=app.page();
 expect(page).toContain('id="tp-id-filter"');
 expect(page).toContain('data-tp-field="serial"');
 expect(page).not.toContain('data-tp-field="monthlySalary"');
 expect(page).toContain('data-tp-field="days"');
 expect(app.serial("1")).toBe(1);
 expect(app.serial("100")).toBe(100);
 expect(app.serial("101")).toBe(101);
 expect(app.serial("10000")).toBe(10000);
 expect(app.serial("0")).toBe(null);
 let warning="";
 const fake={dataset:{tpField:"serial",id:"demo1"},value:"4"};
 const previous=app.data().periods["2026-11"].serials.demo1;
 // Existing UI change handler uses the standard payroll route.
 const originalAlert=console.warn;
 handlers.change[handlers.change.length-1]({target:fake});
 expect(p.serials.demo1).toBe(previous);
 // ID 99 in November is not a permanent employee ID or October's serial.
 expect(app.period("2026-10").serials.demo1).toBe(1);
 app.setPage("sheets");
 expect(app.page()).toContain("Monthly ID");
});

test("Salary change is recorded from its effective month without overwriting prior month salaries",()=>{
 const {app}=boot(),emp=app.data().employees[0];
 const oct=app.monthSalary(emp,"2026-10");
 expect(app.changeSalary(emp,"2026-11",3600000,"Employee profile")).toBe(true);
 expect(app.monthSalary(emp,"2026-11")).toBe(3600000);
 expect(app.monthSalary(emp,"2026-10")).toBe(oct);
 const rec=app.data().salaryChanges[0];
 expect(rec).toMatchObject({employeeId:"demo1",effectiveMonth:"2026-11",previousSalary:3200000,newSalary:3600000});
 app.setPage("employees");
 // Change log is in employee profile source even if not selected in the UI.
 expect(source).toContain("Salary Change History");
 const november=app.rows("2026-11").find(r=>r.emp.id==="demo1");
 const october=app.rows("2026-10").find(r=>r.emp.id==="demo1");
 expect(november.salary).toBe(3600000);
 expect(october.salary).toBe(3200000);
});

test("February and January use fixed 30-day divisor regardless of calendar length",()=>{
 const {app}=boot(),emp=app.data().employees[0];
 emp.leaveAllowance=0;
 for(const month of ["2027-01","2027-02"]){
  const p=app.period(month);p.days.demo1="28";
  const r=app.compute(emp,p,undefined,month);
  expect(r.gross).toBe(Math.round(app.monthSalary(emp,month)*28/30));
 }
});

test("Payroll History has only one combined Print Salary Sheet action per month",()=>{
 const {app}=boot();
 app.setPage("history");
 const h=app.page();
 expect(h).toContain('data-tp-action="print-history-salary"');
 expect(h).toContain("Print Salary Sheet");
 expect(h).not.toContain('data-tp-action="pdf-history-cash"');
 expect(h).not.toContain('data-tp-action="print-history-parcel"');
 expect(h).not.toContain('data-tp-action="pdf-increments"');
 expect(h).toContain("Monthly ID");
 expect(h).toContain("Monthly salary");
 expect(h).toContain("October 2026");
 expect(source).toContain("function tpUnifiedSalaryData(");
 expect(source).toContain("function tpUnifiedSalaryPDF(");
 expect(source).toContain("function tpUnifiedSalaryHTML(");
 expect(source).toContain("tpDeliverPdf(tpPdfBuild(tpUnifiedSalaryPDF");
});
test("Cash and cheque lists remain separated and sorted by monthly ID",()=>{
 const {app}=boot(),p=app.period("2026-11");
 p.serials.demo1=98;p.serials.demo3=1;p.serials.demo5=5;
 const rows=app.rows();
 const cash=rows.filter(r=>r.emp.method==="CASH");
 const cheque=rows.filter(r=>r.emp.method==="CHEQUE");
 expect(cash.map(r=>r.serial)).toEqual([1,2,5,5,98]);
 expect(cheque.map(r=>r.serial)).toEqual([2,4]);
 app.setPage("sheets");
 const html=app.page();
 expect(html).toContain("CASH SHEET");
 expect(html).toContain("CHEQUE SHEET");
 expect(html).toContain('tp-sheet');
});

test("Old demo data migrates salary snapshots without inventing employee monthly serial IDs",()=>{
 const previous={version:3,employees:[{id:"old",name:"Former staff",salary:2000000,method:"CASH",designation:"Cook",active:true}],
 periods:{"2026-10":{advances:{},deductions:{},days:{old:"24"},payments:{},
  snapshots:{old:{monthly:1800000,days:"24",net:1440000}}}},createdAt:"2026-01-01T00:00:00Z"};
 const {app}=boot(previous);
 expect(app.period("2026-10").salaries.old).toBe(1800000);
 expect(app.rows("2026-10")[0].salary).toBe(1800000);
 expect(app.rows("2026-10")[0].serial).toBe(null);
 expect(app.data().salaryChanges).toEqual([]);
});


test("Parcel boy sample reproduces Mukesh commission sheet, GST and net payout",()=>{
 const {app}=boot(),emp=app.data().employees.find(e=>e.name==="Mukesh"),p=app.period("2026-11");
 expect(emp.employeeType).toBe("parcel");
 expect(emp.commissionGstRate).toBe(5);
 const c=app.commission(emp,p);
 expect(p.commissions[emp.id].daily).toHaveLength(30);
 expect(c).toMatchObject({commissionTotal:3120200,gst:156010,gstRate:5,net:2964190,leavePay:0,paidAdvance:0,fine:0});
 expect(app.rows().find(r=>r.emp.id===emp.id).calc.net).toBe(2964190);
});
test("Adding employees defaults to Salaried, with a Parcel Boy and editable GST option",()=>{
 const {app}=boot(),form=app.employeeForm(null),parcel=app.employeeForm(app.data().employees.find(e=>e.name==="Mukesh"));
 expect(form).toContain('<option value="salaried" selected');
 expect(form).toContain('<option value="parcel"');
 expect(form).toContain('name="employeeType"');
 expect(form).toContain('name="commissionGstRate"');
 expect(parcel).toContain('data-employee-type="parcel"');
 expect(parcel).toContain('value="5"');
});
test("Salaried attendance excludes parcel boys until explicitly opened and payment sheets show their breakdown",()=>{
 const {app}=boot();
 app.setPage("attendance");const attendance=app.page();
 expect(attendance).toContain("Parcel Boys · Commission");
 expect(attendance).toContain('data-tp-action="open-commission"');
 expect((attendance.match(/data-tp-field="days"/g)||[])).toHaveLength(6);
 expect(attendance).not.toContain('data-tp-field="commissionDaily"');
 const mukesh=app.data().employees.find(e=>e.name==="Mukesh");
 app.openCommission(mukesh.id);
 const expanded=app.page();
 expect((expanded.match(/data-tp-field="commissionDaily"/g)||[])).toHaveLength(0);
 expect(expanded).toContain("Total commission");
 expect(expanded).toContain("Payable amount");
 expect(expanded).toContain('id="tp-commission-mode"');
 expect(expanded).toContain('data-tp-field="commissionTotal"');
 expect(expanded).toContain("Monthly commission total (default)");
 expect(app.period("2026-11").commissions[mukesh.id].mode).toBe("total");
 app.setPage("sheets");
 expect((app.page().match(/data-tp-field="days"/g)||[])).toHaveLength(0);
 expect(app.page()).toContain("Parcel Boy Payment Sheet");
 expect(app.page()).toContain("View Calculation");
});
test("Switching between daily and one-total commission changes only the calculation method",()=>{
 const {app}=boot(),emp=app.data().employees.find(e=>e.name==="Mukesh"),p=app.period("2026-11");
 const original=p.commissions[emp.id].daily.slice();
 p.commissions[emp.id].mode="total";p.commissions[emp.id].total=3120200;
 expect(app.commission(emp,p)).toMatchObject({commissionMode:"total",commissionTotal:3120200,gst:156010,net:2964190});
 p.commissions[emp.id].gstRate=0;
 expect(app.commission(emp,p)).toMatchObject({gst:0,net:3120200});
 p.commissions[emp.id].gstRate=5;
 p.commissions[emp.id].mode="daily";
 expect(p.commissions[emp.id].daily).toEqual(original);
 expect(app.commission(emp,p).commissionTotal).toBe(3120200);
});
test("Parcel commissions ignore advances, fines, worked days and leave money",()=>{
 const {app}=boot(),emp=app.data().employees.find(e=>e.name==="Mukesh"),p=app.period("2026-11");
 p.days[emp.id]="30";
 p.advances[emp.id]={amount:500000,paid:true};
 p.deductions[emp.id]={fine:80000,other:90000};
 const c=app.compute(emp,p);
 expect(c).toMatchObject({days:null,commissionTotal:3120200,gst:156010,paidAdvance:0,fine:0,other:0,leavePay:0,net:2964190});
 const r=app.rows().find(r=>r.emp.id===emp.id);
 expect(r.advance).toEqual({});
 expect(r.deductions).toEqual({});
});
test("Cash/cheque sheets include parcel boy net pay and history prints everything together",()=>{
 const {app}=boot();
 app.setPage("sheets");
 const sheet=app.page();
 expect(sheet).toContain("Parcel Boy");
 expect(sheet).toContain("GST");
 expect(sheet).toContain("Mukesh");
 app.setPage("history");
 const h=app.page();
 expect(h).toContain('data-tp-action="print-history-salary"');
 expect(h).not.toContain('data-tp-action="pdf-history-parcel"');
 expect(source).toContain('function tpParcelPdfPages(');
 expect(source).toContain('function tpPdfBuild(');
});
test("Existing local payroll data loads with no parcel changes or new fields required",()=>{
 const old={version:3,employees:[{id:"old",name:"Old cook",salary:2500000,method:"CASH",designation:"Cook",active:true}],
 periods:{"2026-10":{days:{old:"22.5"},advances:{},deductions:{},serials:{old:3},salaries:{old:2500000},snapshots:{}}}};
 const {app}=boot(old);
 expect(app.data().employees[0].employeeType).toBeUndefined();
 expect(app.isParcel(app.data().employees[0])).toBe(false);
 expect(app.period("2026-10").commissions).toEqual({});
 expect(app.compute(app.data().employees[0],app.period("2026-10"),undefined,"2026-10").gross).toBe(1875000);
});


test("Daily commission, GST and monthly-total fields save through change events in the selected month",()=>{
 const {app,handlers,storage}=boot(),emp=app.data().employees.find(e=>e.name==="Mukesh");
 const change=handlers.change[handlers.change.length-1];
 app.setPage("attendance");
 change({target:{id:"",dataset:{tpField:"commissionMode",id:emp.id},value:"daily"}});
 change({target:{id:"",dataset:{tpField:"commissionDaily",id:emp.id,day:"1"},value:"2000.00"}});
 expect(app.period("2026-11").commissions[emp.id].daily[0]).toBe(200000);
 expect(storage.has("tablewise-payroll-demo-v3")).toBe(true);
 expect(app.commission(emp,app.period("2026-11")).commissionTotal).toBe(3220200);
 change({target:{id:"",dataset:{tpField:"commissionMode",id:emp.id},value:"total"}});
 change({target:{id:"",dataset:{tpField:"commissionTotal",id:emp.id},value:"31202"}});
 expect(app.commission(emp,app.period("2026-11")).net).toBe(2964190);
 change({target:{id:"",dataset:{tpField:"commissionGST",id:emp.id},value:"10"}});
 expect(app.commission(emp,app.period("2026-11")).gst).toBe(312020);
 expect(app.commission(emp,app.period("2026-11")).net).toBe(2808180);
 app.setMonth("2026-10");
 expect(app.commission(emp,app.period("2026-10"))).toBe(null);
});


test("Add Employee form has no default type helper or salaried formula callout",()=>{
 const {app}=boot();
 const form=app.employeeForm(null);
 expect(form).not.toContain("Defaults to Salaried employee.");
 expect(form).not.toContain("Salaried: salary ÷ 30 × days worked");
 expect(form).not.toContain("tp-note tp-salaried-only");
 expect(form).toContain('<option value="salaried" selected');
 expect(form).toContain('<option value="parcel"');
});

test("Sections & Tables shortcut is absent from Workspace sidebar, while section management remains available",()=>{
 expect(html).not.toContain('navnames.sections="Sections & Tables"');
 expect(html).toContain('function sectionsView()');
 expect(html).toContain('sections:sectionsView');
});


test("Employee forms do not display explanatory salary or type banners",()=>{
 const {app}=boot();
 const salaried=app.employeeForm(null);
 const parcel=app.employeeForm(app.data().employees.find(e=>e.employeeType==="parcel"));
 for(const form of [salaried,parcel]){
  expect(form).not.toContain("Defaults to Salaried employee.");
  expect(form).not.toContain("Salaried: salary ÷ 30 × days worked");
  expect(form).not.toContain("Salaried employees use attendance and salary.");
  expect(form).not.toContain("Parcel Boy: no standard salary");
  expect(form).not.toContain("tp-note tp-salaried-only");
  expect(form).not.toContain("tp-note tp-parcel-only");
 }
});
test("Designation is a plain manually entered field without shortcuts or quick select",()=>{
 const {app}=boot();
 const form=app.employeeForm(null);
 expect(form).toContain('id="tp-role" name="designation"');
 expect(form).toContain('placeholder="Enter designation manually"');
 expect(form).not.toContain("tp-role-pick");
 expect(form).not.toContain("tp-role-suggestions");
 expect(form).not.toContain("ek ch");
 expect(app.data()).not.toHaveProperty("designations");
 app.setPage("settings");
 const settings=app.page();
 expect(settings).toContain('id="tp-leave-interval"');
 expect(settings).not.toContain('id="tp-designation-settings"');
 expect(settings).not.toContain("Designation Shortcuts");
});
test("Legacy shortcut definitions are discarded but actual employee titles remain",()=>{
 const previous={version:3,employees:[{id:"one",name:"Demo",designation:"Chinese Cook",salary:2400000,method:"CASH",active:true}],periods:{},
  designations:[{code:"ek ch",title:"Chinese Helper"}]};
 const {app,storage}=boot(previous);
 expect(app.data().employees[0].designation).toBe("Chinese Cook");
 expect(app.data()).not.toHaveProperty("designations");
 const written=JSON.parse(storage.get("tablewise-payroll-demo-v3"));
 expect(written.employees[0].designation).toBe("Chinese Cook");
 expect(written).not.toHaveProperty("designations");
});
test("Sections & Tables has Delete and Restore controls with open-order protection",()=>{
 expect(html).toContain('data-ad="deleteSection"');
 expect(html).toContain('data-ad="restoreSection"');
 expect(html).toContain('if(a==="deleteSection")');
 expect(html).toContain('if(a==="restoreSection")');
 expect(html).toContain('Keep at least one active section');
 expect(html).toContain('status==="open"');
 expect(html).toContain('section_deleted');
 expect(html).toContain('section_restored');
 expect(html).toContain('archivedWithSection');
 expect(html).toContain('data-route="sections"');
 expect(html).not.toContain('navnames.sections="Sections & Tables"');
});


test("Parcel Boy designation remains automatic and manual salaried designation is required",()=>{
 const {app}=boot();
 const salaried=app.employeeForm(null);
 const parcel=app.employeeForm(app.data().employees.find(e=>e.employeeType==="parcel"));
 expect(salaried).toContain('<div class="tp-field tp-salaried-only"><label for="tp-role">');
 expect(salaried).toContain('id="tp-role" name="designation"');
 expect(salaried).toContain('autocomplete="off" required maxlength="90"');
 expect(parcel).toContain('data-employee-type="parcel"');
 expect(parcel).toContain('id="tp-role" name="designation"');
 expect(parcel).toContain('autocomplete="off" disabled maxlength="90"');
 expect(parcel).not.toContain('id="tp-role-pick"');
 expect(parcel).not.toContain('tp-role-suggestions');
 expect(source).toContain('if(parcel)designation=tpTrim(');
});

test("New Parcel Boy automatically saves the Parcel Boy designation without typing it",()=>{
 const {app,handlers,storage}=boot();
 app.handle({dataset:{tpAction:"new-employee"}});
 const submitted={
  id:"tp-employee-form",
  elements:{
   name:{value:"New Delivery Worker"},
   designation:{value:""},
   joined:{value:"2026-11-20"},
   restaurant:{value:"Pritam Fast Food"},
   method:{value:"CASH"},
   employeeType:{value:"parcel"},
   salary:{value:""},
   leaveAllowance:{value:""},
   salaryEffectiveMonth:{value:""},
   commissionGstRate:{value:"5"}
  }
 };
 handlers.submit[handlers.submit.length-1]({
  target:submitted,
  preventDefault:()=>{},
  stopImmediatePropagation:()=>{}
 });
 const created=app.data().employees.find(e=>e.name==="New Delivery Worker");
 expect(created).toBeDefined();
 expect(created).toMatchObject({designation:"Parcel Boy",employeeType:"parcel",salary:0,leaveAllowance:0,commissionGstRate:5});
 expect(storage.has("tablewise-payroll-demo-v3")).toBe(true);
});


test("Every current and historical payroll download uses PDF rather than CSV",()=>{
 const {app}=boot();
 const tabs=["advances","attendance","sheets","history"];
 for(const tab of tabs){
  app.setPage(tab);
  const page=app.page();
  expect(page).not.toContain('data-tp-action="csv-');
  expect(page).not.toContain("Download CSV");
 }
 app.setPage("history");
 const history=app.page();
 expect(history).toContain('data-tp-action="print-history-salary"');
 expect(history).not.toContain('data-tp-action="pdf-history-');
 expect(history).not.toContain('data-tp-action="print-history-parcel"');
 app.setPage("sheets");
 const sheets=app.page();
 expect(sheets).toContain('data-tp-action="pdf-cash"');
 expect(sheets).toContain('data-tp-action="pdf-cheque"');
 expect(sheets).toContain('data-tp-action="pdf-parcel"');
 app.setPage("advances");
 expect(app.page()).toContain('data-tp-action="pdf-advance"');
 app.setPage("attendance");
 expect(app.page()).toContain('data-tp-action="pdf-attendance"');
 expect(source).not.toContain("text/csv");
 expect(source).not.toContain("function tpDoCSV(");
});

test("PDF builder produces a PDF Blob with cross-reference and pages",async()=>{
 const {app}=boot();
 const pdf=app.pdfBuild([{width:1,height:1,bytes:new Uint8Array([255,216,255,217])}]);
 expect(pdf.type).toBe("application/pdf");
 expect(pdf.size).toBeGreaterThan(200);
 const content=await pdf.text();
 expect(content.startsWith("%PDF-1.4")).toBe(true);
 expect(content).toContain("/Type /Catalog");
 expect(content).toContain("/Type /Pages");
 expect(content).toContain("/Type /Page ");
 expect(content).toContain("xref");
 expect(content).toContain("%%EOF");
});

test("New parcel-boy commission forms default to Monthly Total; prior daily entries stay daily",()=>{
 const {app}=boot();
 const existing=app.data().employees.find(e=>e.employeeType==="parcel");
 const another={...existing,id:"brandnew",name:"Another Parcel Boy"};
 app.data().employees.push(another);
 app.setPage("attendance");
 app.openCommission(another.id);
 const first=app.page();
 expect(first).toContain('value="total" selected');
 expect(first).toContain('data-tp-field="commissionTotal"');
 expect(first).not.toContain('data-tp-field="commissionDaily"');
 // A worker who explicitly chose daily entry keeps that choice.
 app.period("2026-11").commissions[existing.id].mode="daily";
 app.openCommission(existing.id);
 const old=app.page();
 expect(old).toContain('value="daily" selected');
 expect(old).toContain('data-tp-field="commissionDaily"');
});

test("Pressing Enter in a monthly ID goes to next employee's monthly ID, not days",()=>{
 const {app,handlers,setInputs}=boot();
 let focus=null,select=null;
 const ids=["demo1","demo2","demo3"];
 const serials=ids.map(id=>({
   value:id==="demo1"?"15":id==="demo2"?"16":"17",
   dataset:{tpField:"serial",id},
   matches:()=>true,
   dispatchEvent(){handlers.change[handlers.change.length-1]({target:this});},
   focus(){focus=id;},
   select(){select=id;},
   scrollIntoView(){}
 }));
 const days=ids.map(id=>({
  value:"26",dataset:{tpField:"days",id},matches:()=>true,
  focus(){focus="DAYS-"+id;},select(){select="DAYS-"+id;},scrollIntoView(){}
 }));
 setInputs([...serials,...days]);
 app.setPage("attendance");
 const handler=handlers.keydown.find(fn=>fn.toString().includes('serialInputs'));
 expect(handler).toBeDefined();
 let prevented=false;
 handler({target:serials[0],key:"Enter",isComposing:false,preventDefault:()=>{prevented=true;},stopImmediatePropagation:()=>{}});
 expect(prevented).toBe(true);
 expect(app.period("2026-11").serials.demo1).toBe(15);
 expect(focus).toBe("demo2");
 expect(select).toBe("demo2");
});

test("Legacy Employees link is hidden from the Workspace sidebar but Payroll Employees remains",()=>{
 expect(html).not.toContain('employees:"Employees"');
 expect(html).toContain('payroll:"Payroll"');
 expect(html).toContain('employees:employees');
 const {app}=boot();
 app.setPage("employees");
 expect(app.page()).toContain("Employee Management");
});


test("Employee designation is stored exactly as manually entered",()=>{
 const {app,handlers}=boot();
 app.handle({dataset:{tpAction:"new-employee"}});
 const submitted={
  id:"tp-employee-form",
  elements:{
   name:{value:"New Chinese Helper"},designation:{value:"Chinese Helper"},
   joined:{value:"2026-11-20"},restaurant:{value:"Pritam Fast Food"},
   method:{value:"CASH"},employeeType:{value:"salaried"},
   salary:{value:"20000"},leaveAllowance:{value:"2"},
   salaryEffectiveMonth:{value:""},commissionGstRate:{value:"5"}
  }
 };
 handlers.submit[handlers.submit.length-1]({
  target:submitted,preventDefault:()=>{},stopImmediatePropagation:()=>{}
 });
 const employee=app.data().employees.find(e=>e.name==="New Chinese Helper");
 expect(employee).toBeDefined();
 expect(employee.designation).toBe("Chinese Helper");
 expect(app.employeeForm(employee)).toContain('value="Chinese Helper"');
});
test("A monthly ID can be shared between restaurants but not duplicated inside one restaurant",()=>{
 const {app,handlers}=boot();
 app.setPage("attendance");
 const p=app.period("2026-11"),change=handlers.change[handlers.change.length-1];
 // Samples intentionally start each restaurant at monthly ID 1.
 expect(p.serials.demo1).toBe(1);
 expect(p.serials.demo5).toBe(1);
 // Restaurant 1 can use 150; Restaurant 2 may also use 150.
 change({target:{dataset:{tpField:"serial",id:"demo1"},value:"150"}});
 change({target:{dataset:{tpField:"serial",id:"demo5"},value:"150"}});
 expect(p.serials.demo1).toBe(150);
 expect(p.serials.demo5).toBe(150);
 // Another employee in Restaurant 1 cannot use the same 150.
 change({target:{dataset:{tpField:"serial",id:"demo2"},value:"150"}});
 expect(p.serials.demo2).not.toBe(150);
 // The parcel boy in Restaurant 1 must follow the same uniqueness rule.
 change({target:{dataset:{tpField:"parcelSerial",id:"demo7"},value:"150"}});
 expect(p.serials.demo7).not.toBe(150);
 change({target:{dataset:{tpField:"parcelSerial",id:"demo7"},value:"101"}});
 expect(p.serials.demo7).toBe(101);
});

test("Payment Sheets expand employee salary and commission calculations without a second salary entry",()=>{
 const {app}=boot();
 app.setPage("sheets");
 let html=app.page();
 expect(html).toContain('data-tp-action="view-calculation"');
 expect(html).not.toContain('data-tp-field="days"');
 app.handle({dataset:{tpAction:"view-calculation",id:"demo1"}});
 html=app.page();
 expect(html).toContain("Calculation for Aarav Patil");
 expect(html).toContain("Working salary");
 expect(html).toContain("Leave pay");
 expect(html).toContain("Salary advance deducted");
 expect(html).toContain("Net salary payable");
 expect(html).toContain("Hide Calculation");
 app.handle({dataset:{tpAction:"view-calculation",id:"demo1"}});
 expect(app.page()).not.toContain("Calculation for Aarav Patil");
 app.handle({dataset:{tpAction:"view-calculation",id:"demo7"}});
 html=app.page();
 expect(html).toContain("Calculation for Mukesh");
 expect(html).toContain("GST deducted");
 expect(html).toContain("Net payable");
});


test("Aadhaar identifiers are masked and only last 4 digits persist in browser-local payroll",()=>{
 const {app,handlers,storage}=boot();
 expect(app.employeeForm(null)).toContain('id="tp-aadhaar"');
 app.handle({dataset:{tpAction:"new-employee"}});
 const fullAadhaar="123456789012";
 const submitted={id:"tp-employee-form",elements:{
   name:{value:"Aadhaar Test Employee"},designation:{value:"Cook"},
   joined:{value:"2026-11-20"},restaurant:{value:"Pritam Fast Food"},
   method:{value:"CASH"},employeeType:{value:"salaried"},salary:{value:"22000.00"},
   leaveAllowance:{value:"2"},commissionGstRate:{value:"5"},
   aadhaar:{value:fullAadhaar}
 }};
 handlers.submit[handlers.submit.length-1]({
  target:submitted,preventDefault:()=>{},stopImmediatePropagation:()=>{}
 });
 const employee=app.data().employees.find(e=>e.name==="Aadhaar Test Employee");
 expect(employee).toBeDefined();
 expect(employee.aadhaarLast4).toBe("9012");
 expect(employee.aadhaar).toBeUndefined();
 expect(storage.get("tablewise-payroll-demo-v3")).not.toContain(fullAadhaar);
 const edit=app.employeeForm(employee);
 expect(edit).toContain('value="9012"');
 expect(edit).not.toContain('id="tp-effective-month"');
 expect(edit).not.toContain('id="tp-salary"');
 app.handle({dataset:{tpAction:"view-employee",id:employee.id}});
 expect(app.page()).toContain("XXXX XXXX 9012");
 expect(app.page()).not.toContain(fullAadhaar);
});

test("Monthly IDs can be reused after departure and across distinct restaurant branches",()=>{
 const {app,handlers}=boot();
 app.setPage("attendance");
 const p=app.period("2026-11"),change=handlers.change[handlers.change.length-1];
 // An inactive employee's historical month ID is retained but does not block an active employee.
 app.data().employees.find(e=>e.id==="demo2").active=false;
 change({target:{dataset:{tpField:"serial",id:"demo1"},value:"2"}});
 expect(p.serials.demo1).toBe(2);
 expect(p.serials.demo2).toBe(2);
 // Different branches may use ID 3 even if the display name happens to match.
 app.data().employees.find(e=>e.id==="demo5").restaurant="Pritam Fast Food";
 change({target:{dataset:{tpField:"serial",id:"demo5"},value:"3"}});
 expect(p.serials.demo5).toBe(3);
 // Two active employees at the SAME branch may not use ID 3.
 change({target:{dataset:{tpField:"serial",id:"demo4"},value:"3"}});
 expect(p.serials.demo4).toBe(4);
});
