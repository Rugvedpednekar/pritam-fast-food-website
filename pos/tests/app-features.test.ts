import {test, expect} from "bun:test";
import {readFileSync} from "node:fs";
const payrollSource=readFileSync(new URL("../src/client/payroll-preview.js",import.meta.url),"utf8");
const htmlSource=readFileSync(new URL("../src/client/index.html",import.meta.url),"utf8");

function extract(name){
 const r=new RegExp("function "+name+"\\([^\\n]*?\\)\\{[\\s\\S]*?\\n\\}");
 const m=payrollSource.match(r);
 if(!m)throw Error("Missing payroll calculation in shipped source: "+name);
 return m[0];
}
const functions=["parsePaise","tpInputDays","tpRound","tpCompute","tpSnapshot","tpTotals","tpDefaultPeriod","tpSample","tpMonth","tpStamp"];
const evaluator="var TP_BASIS=30; var data={restaurants:[{name:'Pritam Fast Food'},{name:'Restaurant 02'}]}; function dateIN(){return '2026-11-24';}\n"+
 functions.map(extract).join("\n")+
 "\nreturn {parsePaise,tpInputDays,tpCompute,tpSnapshot,tpTotals,tpDefaultPeriod,tpSample,tpMonth};";
const calc=new Function(evaluator)();
const validator=htmlSource.match(/function valid\(d\)\{[^\n]+\}/)?.[0];
if(!validator)throw Error("Missing restaurant state validation");
const valid=new Function(validator+"\nreturn valid;")();

test("Demo payroll can calculate half days on a 30-day salary basis",()=>{
 const employee={id:"e1",salary:3000000,method:"CASH"};
 const month=calc.tpDefaultPeriod();month.days.e1="22.5";
 const result=calc.tpCompute(employee,month);
 expect(result.gross).toBe(2250000);
 expect(result.net).toBe(2250000);
 expect(calc.tpInputDays("25.5")).toBe(25.5);
 expect(calc.tpInputDays("22.25")).toBe(null);
 expect(calc.tpInputDays("31")).toBe(null);
});
test("Only advances marked paid are deducted from salary",()=>{
 const emp={id:"e1",salary:3000000,method:"CASH"};
 const month=calc.tpDefaultPeriod();
 month.days.e1="22.5";
 month.advances.e1={amount:500000,paid:false};
 month.deductions.e1={fine:15000,other:25000};
 expect(calc.tpCompute(emp,month)).toMatchObject({gross:2250000,paidAdvance:0,net:2210000});
 month.advances.e1.paid=true;
 expect(calc.tpCompute(emp,month)).toMatchObject({gross:2250000,paidAdvance:500000,fine:15000,other:25000,net:1710000});
});
test("Excess deductions cannot generate a negative payment",()=>{
 const emp={id:"e",salary:1500000,method:"CHEQUE"};
 const month=calc.tpDefaultPeriod();month.days.e="1";
 month.advances.e={amount:800000,paid:true};
 expect(calc.tpCompute(emp,month)).toMatchObject({gross:50000,net:0,shortfall:750000});
});
test("Demo contains connected employee, advance, payroll and prior payment history examples",()=>{
 const state=calc.tpSample(),months=Object.keys(state.periods);
 expect(state.employees.length).toBe(6);
 expect(months).toHaveLength(3);
 expect(state.employees.some(e=>e.method==="CASH")).toBe(true);
 expect(state.employees.some(e=>e.method==="CHEQUE")).toBe(true);
 const lastMonth=calc.tpMonth(-1),period=state.periods[lastMonth];
 expect(period.advances.demo1.paid).toBe(true);
 expect(period.days.demo1).toBe("26");
 expect(period.payments.demo1.paid).toBe(true);
 expect(period.payments.demo1.snapshot).toHaveProperty("net");
});
test("Cash and cheque totals add to the payroll grand total",()=>{
 const state=calc.tpSample(),period=state.periods[calc.tpMonth(0)];
 const rows=state.employees.map(emp=>({emp,advance:period.advances[emp.id],calc:calc.tpCompute(emp,period),payment:period.payments[emp.id]||null}));
 const totals=calc.tpTotals(rows);
 expect(totals.ready).toBe(state.employees.length);
 expect(totals.cash+totals.cheque).toBe(totals.grand);
 expect(totals.advPaid).toBeLessThanOrEqual(totals.adv);
});
test("CSV export, separate print sheets, photo uploads and browser persistence are present",()=>{
 expect(payrollSource).toContain("Print Distribution Sheet");
 expect(payrollSource).toContain("print-cash");
 expect(payrollSource).toContain("print-cheque");
 expect(payrollSource).toContain('window.print()');
 expect(payrollSource).toContain('localStorage.setItem(TP_KEY');
 expect(payrollSource).toContain('canvas.toDataURL("image/jpeg"');
 expect(payrollSource).toContain("tpHistory");
});
test("Restaurant archive and restore state remains valid",()=>{
 const state={schema:1,restaurants:[{id:"r1",active:true},{id:"r2",active:false}],menus:{},bills:[],employees:[],closings:[],seq:1};
 expect(valid(state)).toBe(true);
 expect(valid({...state,restaurants:state.restaurants.map(r=>({...r,active:false}))})).toBe(false);
 expect(valid({...state,restaurants:Array.from({length:51},(_,i)=>({id:"r"+i,active:true}))})).toBe(false);
});
