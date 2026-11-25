import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";

const billing=readFileSync(new URL("../src/client/daily-bills-mobile.js",import.meta.url),"utf8");
const payroll=readFileSync(new URL("../src/client/payroll-preview.js",import.meta.url),"utf8");
const archive=readFileSync(new URL("../src/client/payroll-archive-increments.js",import.meta.url),"utf8");

function billingApp(){
 let date="2026-11-26";
 const data={
  invoiceCounters:{"r1:2627":217},
  openDays:{},
  bills:[{number:"INV/2627/000217",restaurantId:"r1",day:"2026-11-25",businessDate:"2026-11-25"}]
 };
 const navnames={reports:"Reports & Day-End"};
 const script=billing+"\nreturn {number:newInvoiceNumber,history:bills,navnames,setOutlet:function(r){selected=r;},setDate:function(d){setToday(d);},data};";
 const app=new Function("navnames","data","selected","today","dayBills","header","e","pretty","selectedName","smallTable","newInvoiceNumber","bills","printBill","navigator","receiptPDF","setToday","document",script)(
  navnames,data,"r1",()=>date,
  (r:string,d:string)=>data.bills.filter(b=>b.restaurantId===r&&b.day===d),
  (title:string,sub:string)=>title+" | "+sub,(s:string)=>String(s),
  (s:string)=>s,()=>data.restaurants?"Restaurant":"Pritam Fast Food",
  (rows:any[])=>"rows="+rows.map(b=>b.number).join(","),
  ()=>"",()=>"",()=>{}, {userAgent:"Desktop"},undefined,(d:string)=>{date=d;},
  {createElement:()=>({textContent:""}),head:{appendChild:()=>{}}}
 );
 return app as any;
}

test("Daily bill numbering starts at 1, increases, resets tomorrow, and is independent per outlet",()=>{
 const app=billingApp();
 expect(app.navnames.reports).toBe("Reports");
 expect(app.number({date:"2026-11-26"})).toBe("1");
 app.data.bills.push({number:"1",restaurantId:"r1",day:"2026-11-26",businessDate:"2026-11-26"});
 expect(app.number({date:"2026-11-26"})).toBe("2");
 app.setOutlet("r2");
 expect(app.number({date:"2026-11-26"})).toBe("1");
 app.setOutlet("r1");app.setDate("2026-11-27");
 expect(app.number({date:"2026-11-27"})).toBe("1");
 expect(app.data.bills).toHaveLength(2); // No historical invoices were erased.
});

test("Bill History displays today's records, retaining older invoices for reports",()=>{
 const app=billingApp();
 app.data.bills.push({number:"1",restaurantId:"r1",day:"2026-11-26"});
 let h=app.history();
 expect(h).toContain("Today's");
 expect(h).toContain("rows=1");
 expect(h).not.toContain("000217");
 app.setDate("2026-11-27");h=app.history();
 expect(h).toContain("rows=");
 expect(h).not.toContain("rows=1");
 expect(app.data.bills).toHaveLength(2);
});

function payrollApp(){
 let fakeToday="2026-11-25";
 const combined=payroll.replace(/\}\)\(\);\s*$/,archive+"\n})();");
 const handlers:Record<string,Function[]>={},alerts:string[]=[];
 const storage=new Map<string,string>();
 const document={
  createElement:()=>({textContent:"",id:"",style:{},appendChild:()=>{}}),
  head:{appendChild:()=>{}},
  addEventListener:(event:string,fn:Function)=>{(handlers[event]??=[]).push(fn)},
  querySelectorAll:()=>[],getElementById:()=>null
 };
 const localStorage={
  getItem:(k:string)=>storage.get(k)||null,
  setItem:(k:string,v:string)=>storage.set(k,v)
 };
 const restaurants={restaurants:[
  {id:"r1",name:"Pritam Fast Food",active:true},
  {id:"r2",name:"Restaurant 02",active:true}
 ]};
 const src=combined.replace(/^\/\*[\s\S]*?\*\/\s*/,"").replace(/\}\)\(\);\s*$/,
  'return {data:()=>tpData,period:tpGetPeriod,compute:tpCompute,loan:tpLoanBalance,render:tpRender,setPage:function(s){tpTab=s;},handle:tpHandleAction};\n})();');
 const app=new Function("document","window","localStorage","data","dateIN","payroll","settings","confirm","draw","showToast","uxAlert","tab","selected","return "+src)(
  document,{addEventListener:()=>{}},localStorage,restaurants,()=>fakeToday,
  ()=>"",()=>"",()=>true,()=>{},()=>{},(v:string)=>alerts.push(v),"payroll","r1"
 ) as any;
 function change(id:string,name:string,value:string){
  const event={target:{dataset:{tpField:name,id},value}};
  (handlers.change||[]).forEach(fn=>fn(event));
 }
 function submit(id:string,employeeId:string,fields:Record<string,string>){
  const event={target:{id,dataset:{id:employeeId},querySelector:(selector:string)=>
   Object.prototype.hasOwnProperty.call(fields,selector)?{value:fields[selector]}:null},
   preventDefault:()=>{},stopImmediatePropagation:()=>{}};
  (handlers.submit||[]).forEach(fn=>fn(event));
 }
 return {app,alerts,change,submit,setToday:(v:string)=>{fakeToday=v;}};
}

test("Monthly advance immediately reduces salary; optional profile loan is separate and recovers a custom amount",()=>{
 const {app,change,submit}=payrollApp(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 const p=app.period("2026-11");
 change("demo1","advance","5000");
 expect(p.advances.demo1).toMatchObject({amount:500000});
 expect(p.advances.demo1.kind).toBeUndefined();
 let calc=app.compute(emp,p);
 expect(calc.paidAdvance).toBe(500000);
 expect(app.loan(emp)).toBe(0);
 submit("tp-office-loan-issue-form","demo1",{
  "#tp-office-loan-amount":"20000","#tp-office-loan-note":"Emergency help"
 });
 expect(app.data().officeLoans).toHaveLength(1);
 expect(app.loan(emp)).toBe(2000000);
 submit("tp-office-loan-repayment-form","demo1",{"#tp-office-loan-deduction":"1200"});
 calc=app.compute(emp,p);
 expect(emp.officeLoanMonthlyDeduction).toBe(120000);
 expect(p.deductions.demo1.loanRepayment).toBe(120000);
 expect(p.deductions.demo1.other).toBe(120000);
 expect(calc.paidAdvance).toBe(500000);
 expect(app.loan(emp)).toBe(1880000);
 change("demo1","other","300");
 expect(p.deductions.demo1.other).toBe(150000);
 expect(p.deductions.demo1.loanRepayment).toBe(120000);
 expect(app.loan(emp)).toBe(1880000);
 app.setPage("advances");
 const html=app.render();
 expect(html).toContain("Monthly ID");
 expect(html).toContain("Advance (₹)");
 expect(html).toContain("Other deduction (₹)");
 expect(html).toContain("Office loan remaining");
 expect(html).toContain("₹18,800");
});


test("Office loan repayment repeats each month, stops at zero, and never creates an advance",()=>{
 const {app,submit,setToday}=payrollApp(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 const current=app.period("2026-11");
 current.advances.demo1={amount:0};
 current.deductions.demo1={fine:0,other:0};
 submit("tp-office-loan-issue-form","demo1",{"#tp-office-loan-amount":"3000","#tp-office-loan-note":"Travel help"});
 submit("tp-office-loan-repayment-form","demo1",{"#tp-office-loan-deduction":"1000"});
 expect(current.deductions.demo1.loanRepayment).toBe(100000);
 expect(app.loan(emp)).toBe(200000);
 setToday("2026-12-02");
 const dec=app.period("2026-12");
 dec.days.demo1="24";
 const calc=app.compute(emp,dec,undefined,"2026-12");
 expect(calc).toBeTruthy();
 expect(dec.deductions.demo1.loanRepayment).toBe(100000);
 expect(dec.deductions.demo1.other).toBe(100000);
 expect(dec.advances.demo1).toBeUndefined();
 expect(app.loan(emp)).toBe(100000);
 setToday("2027-01-02");
 const jan=app.period("2027-01");
 jan.days.demo1="24";
 app.compute(emp,jan,undefined,"2027-01");
 expect(jan.deductions.demo1.loanRepayment).toBe(100000);
 expect(app.loan(emp)).toBe(0);
 setToday("2027-02-02");
 const feb=app.period("2027-02");
 feb.days.demo1="24";
 app.compute(emp,feb,undefined,"2027-02");
 expect(feb.deductions.demo1).toBeUndefined();
 expect(app.loan(emp)).toBe(0);
});

test("Employee profile keeps a visible balance note and optional loan/repayment controls",()=>{
 const {app,submit}=payrollApp(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 let html=app.render();
 expect(html).toContain("Restaurant Payroll");
 app.setPage("employees");
 // The profile renderer is exposed through Employee Management after viewing.
 app.handle({dataset:{tpAction:"view-employee",id:emp.id}});
 html=app.render();
 expect(html).toContain("Optional Office Loan");
 expect(html).toContain('id="tp-office-loan-issue-form"');
 expect(html).toContain('id="tp-office-loan-repayment-form"');
 expect(html).toContain("Loan remaining to repay:");
 submit("tp-office-loan-issue-form","demo1",{"#tp-office-loan-amount":"7000","#tp-office-loan-note":"No interest"});
 html=app.render();
 expect(html).toContain("₹7,000");
 expect(html).toContain("No interest");
});

test("Resigning employee with office loan must deduct outstanding balance or waive it",()=>{
 const {app,submit,alerts}=payrollApp(),p=app.period("2026-11"),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 p.advances.demo1={amount:0};p.deductions.demo1={fine:0,other:0};
 submit("tp-office-loan-issue-form","demo1",{"#tp-office-loan-amount":"5000","#tp-office-loan-note":""});
 app.handle({dataset:{tpAction:"mark-left",id:"demo1"}});
 expect(app.render()).toContain("OFFICE ADVANCE PENDING");
 const fields={
  "#tp-departure-date":"2026-11-20",
  "#tp-departure-days":"18",
  "#tp-departure-payment":"DUE",
  "#tp-departure-paid-date":"2026-11-20",
  "#tp-departure-method":"CASH",
  "#tp-departure-notes":""
 };
 submit("tp-departure-form","demo1",fields);
 expect(alerts.some(v=>v.includes("Office advance pending"))).toBe(true);
 expect(emp.active).toBe(true);
 submit("tp-departure-form","demo1",{...fields,"#tp-departure-loan-choice":"deduct"});
 expect(emp.active).toBe(false);
 expect(emp.finalSettlement.officeLoan).toMatchObject({originalOutstanding:500000,deducted:500000,waived:0,remaining:0});
 expect(p.deductions.demo1.other).toBe(500000);
 expect(p.deductions.demo1.loanRepayment).toBe(500000);
 expect(app.loan(emp)).toBe(0);
});

test("Waived optional loan is recorded without reducing final salary",()=>{
 const {app,submit}=payrollApp(),p=app.period("2026-11"),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 p.advances.demo1={amount:0};p.deductions.demo1={fine:0,other:0};
 submit("tp-office-loan-issue-form","demo1",{"#tp-office-loan-amount":"2000","#tp-office-loan-note":"Waivable"});
 app.handle({dataset:{tpAction:"mark-left",id:"demo1"}});
 submit("tp-departure-form","demo1",{
  "#tp-departure-date":"2026-11-20","#tp-departure-days":"18",
  "#tp-departure-payment":"DUE","#tp-departure-paid-date":"2026-11-20",
  "#tp-departure-method":"CASH","#tp-departure-notes":"",
  "#tp-departure-loan-choice":"waive"
 });
 expect(emp.finalSettlement.officeLoan).toMatchObject({originalOutstanding:200000,deducted:0,waived:200000,remaining:0});
 expect(app.data().officeLoanWaivers).toHaveLength(1);
 expect(p.deductions.demo1.other).toBe(0);
 expect(app.loan(emp)).toBe(0);
});

test("Mobile PDFs use an explicit tap-to-open viewer and salary sheets have restaurant heading",()=>{
 expect(payroll).toContain("Your PDF is ready");
 expect(payroll).toContain('open.textContent="Open PDF"');
 expect(payroll).toContain('share.textContent="Share / Print"');
 expect(payroll).toContain("selectedName()");
 expect(payroll).toContain('label:"MONTH ID"');
});

test("Mobile receipt print flow shows a tap-to-print receipt rather than opening a popup",()=>{
 expect(billing).toContain('id="tw-mobile-receipt-preview"');
 expect(billing).toContain('id="tw-mobile-receipt-print"');
 expect(billing).toContain("window.print()");
 expect(billing).toContain("Get Receipt PDF");
 expect(billing).toContain("tw-mobile-receipt-paper");
});
