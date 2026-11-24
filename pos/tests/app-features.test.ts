import {test, expect} from "bun:test";
import {readFileSync} from "node:fs";
const payrollSource=readFileSync(new URL("../src/client/payroll-preview.js",import.meta.url),"utf8");
const htmlSource=readFileSync(new URL("../src/client/index.html",import.meta.url),"utf8");
const parse=payrollSource.match(/function parsePaise\(value\)\{[\s\S]*?\n\}/)?.[0];
const calc=payrollSource.match(/function calculate\(row,days\)\{[\s\S]*?\n\}/)?.[0];
const validSource=htmlSource.match(/function valid\(d\)\{[^\n]+\}/)?.[0];
if(!parse||!calc||!validSource)throw new Error("Could not locate live payroll/schema logic");
const calculate=new Function(parse+"\n"+calc+"\nreturn calculate;")();
const valid=new Function(validSource+"\nreturn valid;")();

test("Payroll preview: no unpaid days if leave is within allowance",()=>{
 expect(calculate({salary:"30000",leave:"2",allowance:"2"},30).net).toBe(3000000);
});
test("Payroll preview: two unpaid days in a 30-day month",()=>{
 const result=calculate({salary:"30000",leave:"4",allowance:"2"},30);
 expect(result).toMatchObject({gross:3000000,unpaidDays:2,deduction:200000,net:2800000});
});
test("Payroll preview rejects invalid inputs",()=>{
 expect(()=>calculate({salary:"-3",leave:"0",allowance:"0"},30)).toThrow();
 expect(()=>calculate({salary:"30000",leave:"31",allowance:"0"},30)).toThrow();
});
test("A restaurant can be archived while one active restaurant remains",()=>{
 const state={schema:1,restaurants:[{id:"r1",active:true},{id:"r2",active:false}],
 menus:{},bills:[],employees:[],closings:[],seq:1};
 expect(valid(state)).toBe(true);
 expect(valid({...state,restaurants:[{id:"r1",active:false},{id:"r2",active:false}]})).toBe(false);
 expect(valid({...state,restaurants:Array.from({length:51},(_,i)=>({id:"r"+i,active:true}))})).toBe(false);
});
