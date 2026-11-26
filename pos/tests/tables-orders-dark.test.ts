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
