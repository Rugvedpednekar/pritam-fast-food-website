import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";

const index=readFileSync(new URL("../src/client/index.html",import.meta.url),"utf8");
const clearHelper=index.match(/function twClearFloorTableNumber\(ev\)\{[\s\S]*?\n\}/)?.[0];
const earlyHandler=index.match(/function twEarlyBillingEscape\(ev\)\{[\s\S]*?\n\}/)?.[0];

function testPage(options:{
 key?:string,placeholder?:string,aria?:string,label?:string,
 tab?:string,billing?:boolean,dialog?:boolean,floor?:boolean,target?:string
}={}){
 const changes:string[]=[],flags={prevent:0,stop:0,focused:0};
 const floor={};
 const input:any={
  tagName:options.target||"INPUT",disabled:false,readOnly:false,value:"21",
  getAttribute:(name:string)=>name==="placeholder"?options.placeholder??"1, 2, 3...":
    name==="aria-label"?options.aria??"":null,
  closest:(selector:string)=>selector.includes("fl-root:not(.fl-billing)")&&options.floor!==false?floor:null,
  parentElement:{
   textContent:options.label??"Table number",
   querySelectorAll:()=>[input]
  },
  dispatchEvent:(ev:{type:string})=>{changes.push(ev.type);return true;},
  focus:()=>{flags.focused++;}
 };
 const doc:any={
  getElementById:(id:string)=>id==="twkb"&&options.billing?{}:null,
  querySelector:()=>options.dialog?{}:null
 };
 const host={twBillingIsViewing:()=>false,twBillingHandleShortcut:()=>{},twBillingHandleEscape:()=>{}};
 const EventClass=class {type:string;constructor(type:string){this.type=type;}};
 if(!clearHelper||!earlyHandler)throw new Error("Table-number early handler missing");
 const handle=new Function("document","window","tab","Event",
  clearHelper+"\n"+earlyHandler+";return twEarlyBillingEscape;"
 )(doc,host,options.tab??"pos",EventClass);
 function press(key=options.key??"Escape"){
  handle({key,target:input,ctrlKey:false,altKey:false,metaKey:false,
   preventDefault:()=>flags.prevent++,stopImmediatePropagation:()=>flags.stop++});
 }
 return {press,input,flags,changes};
}
test("Escape clears a typed table number but stays on the Tables screen",()=>{
 const app=testPage();app.press("Escape");
 expect(app.input.value).toBe("");
 expect(app.flags).toEqual({prevent:1,stop:1,focused:1});
 expect(app.changes).toEqual(["input"]);
});
test("Minus on normal keyboard and numeric keypad clears the table number exactly like Escape",()=>{
 for(const key of ["-","Subtract","NumpadSubtract","Esc"]){
  const app=testPage();app.press(key);
  expect(app.input.value).toBe("");
  expect(app.flags.prevent).toBe(1);
  expect(app.flags.stop).toBe(1);
  expect(app.flags.focused).toBe(1);
 }
});
test("The table input can also be identified through its label or aria-label",()=>{
 const labelled=testPage({placeholder:"",aria:"",label:"Table number"});
 labelled.press();expect(labelled.input.value).toBe("");
 const aria=testPage({placeholder:"",aria:"Table number",label:""});
 aria.press();expect(aria.input.value).toBe("");
});
test("Escape does not erase unrelated inputs, leave other screens, or interfere with billing",()=>{
 for(const scenario of [
  {placeholder:"Search menu",label:"Search menu"},
  {tab:"menu"},
  {dialog:true},
  {floor:false},
  {target:"TEXTAREA"}
 ]){
  const app=testPage(scenario);app.press();
  expect(app.input.value).toBe("21");
  expect(app.flags.prevent).toBe(0);
  expect(app.changes).toEqual([]);
 }
 const billing=testPage({billing:true});
 billing.press("Escape");
 expect(billing.input.value).toBe("21");
 // Existing billing handler owns Escape; this floor-only guard does not clear it.
 expect(billing.flags.stop).toBe(1);
 expect(billing.changes).toEqual([]);
});
test("Enter still uses the original table lookup action",()=>{
 const app=testPage();app.press("Enter");
 expect(app.input.value).toBe("21");
 expect(app.flags.stop).toBe(0);
});
