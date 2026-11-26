import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";

const extension=readFileSync(new URL("../src/client/import-review-hide-action.js",import.meta.url),"utf8");
const server=readFileSync(new URL("../src/server.ts",import.meta.url),"utf8");

function classes(){
 const values=new Set<string>();
 return {add:(name:string)=>values.add(name),contains:(name:string)=>values.has(name)};
}
function cell(label:string,tagName="TD"){
 return {textContent:label,tagName,classList:classes()};
}
function fixture(showReview=true){
 const titles=["CODE NO","NAME","CATEGORY","NON-AC ₹","AC ₹","PARCEL ₹","ZOMATO ₹","ACTION"];
 const th=titles.map(x=>cell(x,"TH"));
 const td=titles.map(x=>cell(x));
 const headerRow={children:th},dataRow={children:td};
 const rows:any[]=[headerRow,dataRow];
 const table:any={
  classList:classes(),
  querySelectorAll:(s:string)=>s==="tr"?rows:th,
  querySelector:(s:string)=>s==="tr"?headerRow:null
 };
 const otherAction=cell("Add");
 const otherHeader=cell("ACTION","TH");
 const otherTable:any={
  classList:classes(),
  querySelectorAll:(s:string)=>s==="tr"?[{children:[otherHeader]},{children:[otherAction]}]:[otherHeader],
  querySelector:()=>null
 };
 const body:any={},panel:any={parentElement:body,querySelectorAll:()=>[table]};
 const heading:any={textContent:"Review import · 15 items",parentElement:panel};
 let notify:any;
 const document:any={
  body,head:{appendChild:()=>{}},
  createElement:()=>({id:"",textContent:""}),
  querySelectorAll:()=>showReview?[heading]:[],
  addEventListener:()=>{}
 };
 class Observer{
  constructor(callback:any){notify=callback;}
  observe(){}
 }
 new Function("document","MutationObserver",extension)(document,Observer);
 return {table,rows,header:th,data:td,otherTable,otherAction,otherHeader,notify,
  addRow:()=>{const newRow={children:titles.map(x=>cell(x))};rows.push(newRow);notify([{type:"childList",addedNodes:[newRow]}]);return newRow;}};
}

test("Excel import review hides only the ACTION header and row cell",()=>{
 const result=fixture();
 expect(result.table.classList.contains("tw-import-review-no-action")).toBe(true);
 expect(result.header[7].classList.contains("tw-import-review-action-cell")).toBe(true);
 expect(result.data[7].classList.contains("tw-import-review-action-cell")).toBe(true);
 for(let i=0;i<7;i++){
  expect(result.data[i].classList.contains("tw-import-review-action-cell")).toBe(false);
 }
 expect(result.otherHeader.classList.contains("tw-import-review-action-cell")).toBe(false);
 expect(result.otherAction.classList.contains("tw-import-review-action-cell")).toBe(false);
 expect(result.otherTable.classList.contains("tw-import-review-no-action")).toBe(false);
});

test("Import preview refresh still hides Action; non-import pages are unchanged",()=>{
 const active=fixture();
 const row=active.addRow();
 expect(row.children[7].classList.contains("tw-import-review-action-cell")).toBe(true);
 expect(row.children[6].classList.contains("tw-import-review-action-cell")).toBe(false);
 const absent=fixture(false);
 expect(absent.table.classList.contains("tw-import-review-no-action")).toBe(false);
 expect(absent.data[7].classList.contains("tw-import-review-action-cell")).toBe(false);
 expect(server).toContain('./client/import-review-hide-action.js');
 expect(extension).toContain("display:none!important");
});
