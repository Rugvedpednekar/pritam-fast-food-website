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
  'return {data:()=>tpData,period:tpGetPeriod,compute:tpCompute,render:tpRender,setPage:function(s){tpTab=s;},handle:tpHandleAction};\n})();');
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

test("Salary advance and manually entered Other deductions remain independently editable",()=>{
 const {app,change}=payrollApp(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 const p=app.period("2026-11");
 change("demo1","advance","5000");
 expect(p.advances.demo1).toMatchObject({amount:500000});
 expect(p.advances.demo1.kind).toBeUndefined();
 change("demo1","other","300");
 change("demo1","fine","200");
 const calc=app.compute(emp,p);
 expect(calc.paidAdvance).toBe(500000);
 expect(calc.fine).toBe(20000);
 expect(calc.other).toBe(30000);
 expect(p.deductions.demo1).not.toHaveProperty("loanRepayment");
 app.setPage("advances");
 const html=app.render();
 expect(html).toContain("Monthly ID");
 expect(html).toContain("Advance (₹)");
 expect(html).toContain("Fine (₹)");
 expect(html).toContain("Other deduction (₹)");
 expect(html).not.toContain("Office loan remaining");
 expect(html).not.toContain("Office Loan");
});

test("Employee profiles no longer offer loans or recurring deductions",()=>{
 const {app}=payrollApp(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 app.setPage("employees");app.handle({dataset:{tpAction:"view-employee",id:emp.id}});
 const html=app.render();
 expect(html).toContain("EMPLOYEE PROFILE");
 expect(html).not.toContain("Optional Office Loan");
 expect(html).not.toContain("Loan remaining to repay");
 expect(html).not.toContain("tp-office-loan-issue-form");
 expect(html).not.toContain("tp-office-loan-repayment-form");
 expect(app.data().officeLoans).toBeUndefined();
});

test("Resignation settlement has no office loan deductions, warnings, or waiver options",()=>{
 const {app,submit,alerts}=payrollApp(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 app.handle({dataset:{tpAction:"mark-left",id:"demo1"}});
 const html=app.render();
 expect(html).toContain("Record Employee Resignation");
 expect(html).not.toContain("OFFICE ADVANCE PENDING");
 expect(html).not.toContain("tp-departure-loan-choice");
 const fields={
  "#tp-departure-date":"2026-11-20","#tp-departure-days":"18",
  "#tp-departure-payment":"DUE","#tp-departure-paid-date":"2026-11-20",
  "#tp-departure-method":"CASH","#tp-departure-notes":""
 };
 submit("tp-departure-form","demo1",fields);
 expect(alerts).toHaveLength(0);
 expect(emp.active).toBe(false);
 expect(emp.finalSettlement.officeLoan).toBeUndefined();
 const profile=app.render();
 expect(profile).not.toContain("Office loan");
});

test("Retired loan records are archived rather than silently transformed into salary advances",()=>{
 expect(payroll).toContain("retiredLoanRecords");
 expect(payroll).toContain("retired.historicalAdvances.push");
 expect(payroll).toContain("p.advances[id]={amount:0}");
 expect(payroll).not.toContain("tpOfficeLoanProfile(");
 expect(archive).not.toContain("tpLoanBalance(");
 expect(archive).not.toContain("tp-departure-loan-choice");
});

test("Photo input accepts images and prevents saving while compression is processing",()=>{
 const {app}=payrollApp();
 app.setPage("employees");app.handle({dataset:{tpAction:"new-employee"}});
 const html=app.render();
 expect(html).toContain('id="tp-photo" accept="image/*"');
 expect(html).toContain('id="tp-photo-status"');
 expect(payroll).toContain("reader.readAsDataURL(file)");
 expect(payroll).toContain("if(tpPhotoPending)return uxAlert");
 expect(payroll).toContain("tpPhoto=canvas.toDataURL");
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
