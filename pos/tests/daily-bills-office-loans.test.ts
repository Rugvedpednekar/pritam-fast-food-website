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
 const app=new Function("navnames","data","selected","today","dayBills","header","e","pretty","selectedName","smallTable","newInvoiceNumber","bills","printBill","navigator","receiptPDF","setToday",script)(
  navnames,data,"r1",()=>date,
  (r:string,d:string)=>data.bills.filter(b=>b.restaurantId===r&&b.day===d),
  (title:string,sub:string)=>title+" | "+sub,(s:string)=>String(s),
  (s:string)=>s,()=>data.restaurants?"Restaurant":"Pritam Fast Food",
  (rows:any[])=>"rows="+rows.map(b=>b.number).join(","),
  ()=>"",()=>"",()=>{}, {userAgent:"Desktop"},undefined,(d:string)=>{date=d;}
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
  document,{addEventListener:()=>{}},localStorage,restaurants,()=>"2026-11-25",
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
 return {app,alerts,change,submit};
}

test("New office advances are interest-free loans and only Other deduction is taken from salary",()=>{
 const {app,change}=payrollApp(),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 const p=app.period("2026-11");
 change("demo1","advance","5000");
 expect(p.advances.demo1).toMatchObject({kind:"office-loan",amount:500000});
 expect(app.loan(emp)).toBe(500000);
 let calc=app.compute(emp,p);
 expect(calc.paidAdvance).toBe(0);
 change("demo1","other","1200");
 calc=app.compute(emp,p);
 expect(p.deductions.demo1).toMatchObject({other:120000,loanRepayment:120000});
 expect(calc.other).toBe(120000);
 expect(app.loan(emp)).toBe(380000);
 app.setPage("advances");
 const h=app.render();
 expect(h).toContain("Monthly ID");
 expect(h).toContain("Other deduction / loan recovery");
 expect(h).toContain("interest-free");
});

test("Resigning employee with office advance must choose salary deduction or waiver",()=>{
 const {app,submit,alerts}=payrollApp(),p=app.period("2026-11"),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 p.advances.demo1={amount:500000,kind:"office-loan"};
 p.deductions.demo1={fine:0,other:0};
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
 expect(alerts.some(s=>s.includes("Office advance pending"))).toBe(true);
 expect(emp.active).toBe(true);
 submit("tp-departure-form","demo1",{...fields,"#tp-departure-loan-choice":"deduct"});
 expect(emp.active).toBe(false);
 expect(emp.finalSettlement.officeLoan).toMatchObject({originalOutstanding:500000,deducted:500000,waived:0,remaining:0});
 expect(p.deductions.demo1.other).toBe(500000);
 expect(p.deductions.demo1.loanRepayment).toBe(500000);
 expect(app.loan(emp)).toBe(0);
});

test("Waived office loan is recorded but does not reduce final salary",()=>{
 const {app,submit}=payrollApp(),p=app.period("2026-11"),emp=app.data().employees.find((e:any)=>e.id==="demo1");
 p.advances.demo1={amount:200000,kind:"office-loan"};
 p.deductions.demo1={fine:0,other:0};
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
