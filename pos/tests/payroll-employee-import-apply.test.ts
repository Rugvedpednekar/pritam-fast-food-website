import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";
const core=readFileSync(new URL("../src/client/payroll-employee-import-core.js",import.meta.url),"utf8");
const ui=readFileSync(new URL("../src/client/payroll-employee-import-ui.js",import.meta.url),"utf8");
function harness(saveAllowed=true){
 const selected="r1",month="2026-11";
 const data={restaurants:[{id:"r1",name:"Pritam Fast Food",active:true},{id:"r2",name:"Classic Veg",active:true}]};
 const tpData:any={version:3,employees:[
  {id:"existing",name:"Aarav Patil",joined:"2026-10-01",restaurantId:"r1",restaurant:"Pritam Fast Food",
   salary:2300000,designation:"Chef",employeeType:"salaried",active:true}],
  periods:{"2026-11":{serials:{existing:2},salaries:{existing:2300000}}},settings:{leaveEarnEveryDays:7}
 };
 let id=100,draws=0,saves=0,toasts:string[]=[];
 const document:any={
  addEventListener:()=>{},head:{appendChild:()=>{}},createElement:()=>({id:"",textContent:""})
 };
 const modified=ui.replace(/\}\)\(\);\s*$/, "return {impReview,impApply,impDetails,tpImportReadColumns,setPreview:function(v){impPreview=v;},getData:function(){return tpData;},page:function(){return tpEmployeesPage();}};})();");
 if(modified===ui)throw Error("Cannot expose employee importer for testing");
 const args=[
 "data","selected","tpData","tpPeriod","tpEmp","tpSerialValue","tpGetPeriod","tpId","tpSave",
 "tpEscape","tpMoney","tpMonthLabel","tpEmployeesPage","showToast","draw","document","tab","tpTab"
 ];
 const vals:any[]=[
 data,selected,tpData,month,(key:string)=>tpData.employees.find((e:any)=>e.id===key),
 (v:any)=>v==null?null:Number(v),
 (m:string)=>tpData.periods[m]|| (tpData.periods[m]={serials:{},salaries:{}}),
 ()=>"imported-"+(++id),()=>{saves++;return saveAllowed;},
 (s:any)=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;"),
 (p:any)=>"₹"+(p/100),()=>month,()=>"<section>Manual roster remains visible</section>",
 (s:string)=>toasts.push(s),()=>{draws++;},document,"payroll","employees"
 ];
 const api:any=new Function(...args,core+"\nreturn "+modified)(...vals);
 function raw(entries:any[]){
  const h=["Employee Name","Designation","Joining Date","Restaurant","Employee Type","Monthly Salary (INR)","Payment Method","Paid Leave Days","Commission GST (%)","Monthly ID"];
  const lines=entries.map((e:any)=>[
   e.name,e.designation??"Cashier",e.joined??"2026-11-01",e.restaurant??"Pritam Fast Food",
   e.type??"Salaried",e.salary??"25000",e.method??"CASH",e.leave??"2",e.gst??"",e.monthlyId??""
  ]);
  return api.tpImportReadColumns([h,...lines]);
 }
 function apply(rows:any[],target=month,outlet=selected){
  api.setPreview({month:target,restaurantId:outlet,raw:rows,name:"employees.xlsx"});api.impApply();
 }
 return {api,raw,apply,summary:()=>({saves,draws,toasts,data:api.getData()})};
}
test("Review and Apply add salaried and commission-only employees in a single saved transaction",()=>{
 const h=harness();
 const rows=h.raw([{name:"Aarav Patil",joined:"2026-10-01",monthlyId:"2"},
  {name:"Priya Shah",monthlyId:"7",salary:"28500",method:"CHEQUE"},
  {name:"Parcel Helper",type:"Parcel Boy",designation:"",salary:"",monthlyId:"8"}]);
 const preview=h.api.impReview(rows,"2026-11","r1");
 expect(preview.map((r:any)=>r.status)).toEqual(["skip","add","add"]);
 h.apply(rows);
 const summary=h.summary(),emps=summary.data.employees;
 expect(summary.saves).toBe(1);
 expect(emps).toHaveLength(3);
 expect(emps[0].salary).toBe(2300000); // unchanged
 expect(emps[1]).toMatchObject({name:"Priya Shah",salary:2850000,restaurantId:"r1",method:"CHEQUE"});
 expect(emps[2]).toMatchObject({designation:"Parcel Boy",employeeType:"parcel",salary:0});
 expect(summary.data.periods["2026-11"].serials[emps[1].id]).toBe(7);
 expect(summary.data.periods["2026-11"].serials[emps[2].id]).toBe(8);
 expect(summary.data.periods["2026-11"].salaries[emps[1].id]).toBe(2850000);
 expect(summary.toasts[0]).toContain("2 employees");
 expect(h.api.page()).toContain("Import Employees from Excel");
 expect(h.api.page()).toContain("Manual roster remains visible");
});
test("Conflicting monthly IDs block the entire import with no partial writes",()=>{
 const h=harness(),rows=h.raw([{name:"Priya",monthlyId:"5"},{name:"Sam",monthlyId:"5"}]);
 expect(h.api.impReview(rows,"2026-11","r1").map((r:any)=>r.status)).toEqual(["add","error"]);
 h.apply(rows);
 expect(h.summary().data.employees).toHaveLength(1);
 expect(h.summary().saves).toBe(0);
});
test("A failed browser save rolls back every new employee",()=>{
 const h=harness(false),rows=h.raw([{name:"Priya",monthlyId:"8"}]);
 h.apply(rows);
 expect(h.summary().data.employees).toHaveLength(1);
 expect(h.summary().saves).toBe(1);
 expect(h.summary().toasts).toHaveLength(0);
});
test("Import into another outlet uses outlet-scoped monthly IDs",()=>{
 const h=harness(),rows=h.raw([{name:"Another Outlet Employee",restaurant:"Classic Veg",monthlyId:"2"}]);
 expect(h.api.impReview(rows,"2026-11","r1")[0].status).toBe("add");
 h.apply(rows);
 expect(h.summary().data.employees[1].restaurantId).toBe("r2");
});
