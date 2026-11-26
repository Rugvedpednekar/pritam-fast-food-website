import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";

const code=readFileSync(new URL("../src/client/tables-dark-contrast.js",import.meta.url),"utf8");
const server=readFileSync(new URL("../src/server.ts",import.meta.url),"utf8");

function setup(placeholder="1, 2, 3..."){
 const classes=new Set<string>();
 const parent:any={
  textContent:"Table number      Type table number + Enter. Press P for Parcel",
  parentElement:null,
  querySelectorAll:(selector:string)=>selector==="input"?[input]:[],
  classList:{add:(cls:string)=>classes.add(cls)}
 };
 const input:any={
  parentElement:parent,
  getAttribute:(key:string)=>key==="placeholder"?placeholder:key==="aria-label"?"Table number":null,
  closest:()=>null
 };
 const floor:any={querySelectorAll:(selector:string)=>selector==="input"?[input]:[]};
 let styleText="";
 const doc:any={
  head:{appendChild:(node:any)=>{styleText=node.textContent}},
  createElement:()=>({id:"",textContent:""}),
  querySelector:(selector:string)=>selector==="#content .fl-root:not(.fl-billing)"?floor:null
 };
 const runtime=new Function("document","draw","tab",code+"; return draw;")(doc,()=>42,"pos");
 return {classes,styleText,runtime};
}

test("Tables & Orders counters become dark while New Parcel and Zomato stay colored",()=>{
 const {styleText}=setup();
 expect(styleText).toContain(".fl-stats > :not(.tw-pos-quick-actions)");
 expect(styleText).toContain("background:#233942!important");
 expect(styleText).toContain("color:#ffffff!important");
 expect(styleText).toContain(":not(.tw-pos-action-btn)");
 expect(styleText).toContain(":not(.tw-new-zomato)");
 expect(styleText).toContain(".tw-table-jump-dark");
 expect(styleText).toContain("background:#1b2d35!important");
 expect(styleText).toContain("color:#f2fff8!important");
 expect(styleText).toContain("::placeholder");
 expect(server).toContain("./client/tables-dark-contrast.js");
});

test("Table-number shortcut row is tagged without changing the input or event handlers",()=>{
 const {classes,runtime}=setup();
 expect(classes.has("tw-table-jump-dark")).toBe(true);
 expect(runtime()).toBe(42);
 expect(classes.size).toBe(1);
});


test("Occupied table turns green, free table stays neutral and only requested helper lines disappear",()=>{
 const set=()=>{const values=new Set<string>();return{
  add:(s:string)=>values.add(s),contains:(s:string)=>values.has(s),
  toggle:(s:string,on:boolean)=>{if(on)values.add(s);else values.delete(s);},values
 };};
 const open:any={textContent:"21 AC · 1 items · Occupied ₹130.00",classList:set(),getAttribute:()=>null};
 const free:any={textContent:"1 NON AC · Free",classList:set(),getAttribute:()=>null};
 const grid={querySelectorAll:(s:string)=>s==="button"?[open,free]:[]};
 const message=(t:string)=>({textContent:t,classList:set(),querySelector:()=>null});
 const dineHint=message("White = available · Green = open order");
 const parcelHint=message("Resume any saved parcel");
 const tableHint=message("Type table number + Enter · Press P for Parcel");
 const dineHeading=message("DINE-IN");
 const parcelHeading=message("OPEN PARCEL ORDERS");
 const floor={
  querySelector:(s:string)=>s===".fl-table-grid"?grid:null,
  querySelectorAll:(s:string)=>s==="small,p,span,div,label"?[dineHint,parcelHint,tableHint,dineHeading,parcelHeading]:[]
 };
 let stylesheet="";
 const document={
  head:{appendChild:(node:any)=>{stylesheet=node.textContent}},
  createElement:()=>({id:"",textContent:""}),
  querySelector:(s:string)=>s==="#content .fl-root:not(.fl-billing)"?floor:null
 };
 const rerender=new Function("document","draw","tab",code+";return draw;")(document,()=>true,"pos");
 expect(open.classList.contains("tw-table-occupied")).toBe(true);
 expect(free.classList.contains("tw-table-occupied")).toBe(false);
 expect(stylesheet).toContain("background:#17684f!important");
 for(const hint of [dineHint,parcelHint,tableHint])
  expect(hint.classList.contains("tw-unwanted-pos-hint")).toBe(true);
 expect(dineHeading.classList.contains("tw-unwanted-pos-hint")).toBe(false);
 expect(parcelHeading.classList.contains("tw-unwanted-pos-hint")).toBe(false);
 expect(stylesheet).toContain(".tw-unwanted-pos-hint");
 // Simulate paying and closing an occupied order: after re-render it becomes neutral.
 open.textContent="21 AC · Free";
 expect(rerender()).toBe(true);
 expect(open.classList.contains("tw-table-occupied")).toBe(false);
});
