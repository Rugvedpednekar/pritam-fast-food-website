import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/client/keyboard-billing.js",import.meta.url),"utf8");

function harness(popupAllowed=true){
 const inputs:Record<string,any>={},selects:string[]=[],toasts:string[]=[],listeners:Record<string,Function[]>={};
 const selectionNodes:Record<string,any[]>={search:[],order:[]};
 function selectedRows(which:string){
  const selector=which==="search"?'data-kba="choose"':'data-kba="line"';
  const count=content.innerHTML.split(selector).length-1;
  if(selectionNodes[which].length!==count){
   selectionNodes[which]=Array.from({length:count},()=>({
    current:false,ariaSelected:"false",scrolls:0,
    classList:{toggle:function(name:string,enabled:boolean){if(name==="kb-current")this.owner.current=enabled;}},
    setAttribute:function(name:string,val:string){if(name==="aria-selected")this.ariaSelected=val;},
    scrollIntoView:function(){this.scrolls++;}
   }));
   selectionNodes[which].forEach(n=>n.classList.owner=n);
  }
  return selectionNodes[which];
 }
 let activeId="",saved=0,printed=0;
 const content:any={innerHTML:"<div class='fl-billing'></div>"};
 const document:any={
  head:{appendChild:()=>{}},
  createElement:()=>({id:"",textContent:""}),
  addEventListener:(name:string,handler:Function)=>{(listeners[name]??=[]).push(handler);},
  querySelectorAll:(selector:string)=>selector.includes("kb-results")?selectedRows("search"):
                                   selector.includes("kb-lines")?selectedRows("order"):[],
  get activeElement(){return {id:activeId};},
  querySelector:(q:string)=>q==="#content .fl-billing"?content.innerHTML.includes("fl-billing")?{}:null:null,
  getElementById:(id:string)=>{
   if(id==="content")return content;
   if(id==="twkb")return content.innerHTML.includes('id="twkb"')?{}:null;
   if(!inputs[id])inputs[id]={
    id,value:id==="kb-qty"?"1":"",dataset:{},textContent:"",innerHTML:"",
    focus:()=>{activeId=id;},select:()=>{selects.push(id);},setSelectionRange:()=>{},selectionStart:0
   };
   return inputs[id];
  }
 };
 const menu=[
  {id:"m615",code:"615",name:"MINERAL WATER 500ML",category:"Drinks",active:true,available:true,price:1500,sectionPrices:{s1:1500}},
  {id:"m37",code:"37",name:"MASALA DOSA",category:"Meals",active:true,available:true,price:9900,sectionPrices:{s1:9900}},
  {id:"m10",code:"10",name:"SPL TEA",category:"Drinks",active:true,available:true,price:4500,sectionPrices:{s1:4500}}
 ];
 const data:any={seq:20,restaurants:[{id:"r1",name:"Pritam Fast Food"}],menus:{r1:menu},
  sections:{r1:[{id:"s1",name:"NON AC",kind:"dine-in"}]},
  tables:{r1:[{id:"t1",name:"Table 21",sectionId:"s1"}]},
  orders:[],bills:[],audit:[]};
 let cart:any[]=[],activeOrderId="",tableId="t1";
 const state:any={discountKind:"none",discountValue:"",discountReason:""};
 const window:any={
  addEventListener:()=>{},confirm:()=>true,
  open:()=>popupAllowed?{
   closed:false,document:{open:()=>{},write:()=>{},close:()=>{}},
   focus:()=>{},print:()=>{printed++;}
  }:null
 };
 const outer=source.replace(/\}\)\(\);\s*$/,
   "return {kb,screen,pick,paint,key,saveQty,openPreview,printAndComplete,enterView,enterAdd,lookup,"+
   "getDraw:function(){return draw;},getCart:function(){return cart;},getActiveOrder:function(){return activeOrderId;},getTable:function(){return tableId;}};})();");
 if(outer===source)throw Error("Could not instrument keyboard billing source");
 const params=["document","window","tab","selected","sectionId","tableId","activeOrderId","cart","data","draw","printBill",
  "sectionPrice","selSection","selectedName","money","e","showToast","calculatePreview","saveTheData","getOpenDay",
  "newInvoiceNumber","branchCfg","discountKind","discountValue","discountReason","cloudReady","cloudBusy","cloudPending",
  "cloudConflict","setTimeout"];
 const args:any[]=[document,window,"pos","r1","s1",tableId,activeOrderId,cart,data,
  ()=>{content.innerHTML="<div class='fl-billing'></div>";},()=>{},
  (m:any,id:string)=>m?.sectionPrices?.[id]??null,()=>data.sections.r1[0],
  ()=>"Pritam Fast Food",(n:number)=>"₹"+((n||0)/100).toFixed(2),
  (s:any)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;"),
  (s:string)=>toasts.push(s),
  // Totals are deliberately deterministic here; the production app performs its own GST calculation.
  ()=>{const lines=cart.map(x=>({...x,gross:x.qty*x.price,taxable:x.qty*x.price,discount:0,cgst:0,sgst:0,total:x.qty*x.price,priceType:"exclusive"}));
      const subtotal=lines.reduce((s,x)=>s+x.total,0);
      return {lines,subtotal,discount:0,taxable:subtotal,cgst:0,sgst:0,roundOff:0,grand:subtotal};},
  ()=>{saved++;return true;},
  ()=>({id:"day1",date:"2026-11-26"}),()=>String(data.bills.length+1),()=>({legalName:"Pritam Fast Food"}),
  state.discountKind,state.discountValue,state.discountReason,true,false,false,false,
  (fn:()=>void)=>{fn();return 0;}
 ];
 const obj:any=new Function(...params,"return "+outer.replace(/^\s*\/\*[\s\S]*?\*\/\s*/,""))(...args);
 function key(k:string){const ev:any={key:k,preventDefault:()=>{},stopImmediatePropagation:()=>{},
   ctrlKey:false,metaKey:false,altKey:false};obj.key(ev);}
 function set(id:string,value:string){document.getElementById(id).value=value;}
 function typeCode(value:string){set("kb-code",value);for(const handler of listeners.input||[])handler({target:document.getElementById("kb-code")});}
 function getText(id:string){return document.getElementById(id).textContent;}
 function draw(){obj.getDraw()();}
 draw();
 return {obj,data,draw,set,key,typeCode,getText,selects,toasts,selection:selectedRows,saved:()=>saved,printed:()=>printed,
    active:()=>activeId,cart:()=>obj.getCart(),currentTable:()=>obj.getTable()};
}

test("Typing an exact numeric code immediately previews the item and rate before Enter",()=>{
 const h=harness();
 h.typeCode("6");
 expect(h.getText("kb-live-name")).toBe("—");
 expect(h.getText("kb-live-price")).toContain("No exact item code");
 h.typeCode("615");
 expect(h.getText("kb-live-name")).toBe("MINERAL WATER 500ML");
 expect(h.getText("kb-live-price")).toBe("₹15.00");
 expect(h.obj.kb.step).toBe("code");
 expect(h.active()).toBe("kb-code");
 expect(h.cart()).toHaveLength(0);
 h.typeCode("61");
 expect(h.getText("kb-live-name")).toBe("—");
 h.typeCode("");
 expect(h.getText("kb-live-price")).toBe("Enter code to select");
 h.typeCode("615");
 h.key("Enter");
 expect(h.obj.kb.step).toBe("qty");
 expect(h.active()).toBe("kb-qty");
 expect(h.cart()).toHaveLength(0);
});

test("Numeric lookup selects Quantity, then Enter saves with the typed replacement",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");
 expect(h.obj.kb.step).toBe("qty");
 expect(h.active()).toBe("kb-qty");
 expect(h.selects).toContain("kb-qty");
 h.set("kb-qty","3");h.key("Enter");
 expect(h.cart()).toHaveLength(1);
 expect(h.cart()[0]).toMatchObject({code:"615",qty:3});
 expect(h.data.orders[0].cart[0].qty).toBe(3);
 expect(h.active()).toBe("kb-code");
});
test("Alphabetic search chooses an item with arrows and enters Quantity before saving",()=>{
 const h=harness();h.key("m");expect(h.obj.kb.step).toBe("search");
 expect(h.obj.kb.search).toBe("m");
 h.key("ArrowDown");h.key("Enter");expect(h.obj.kb.step).toBe("qty");expect(h.obj.kb.item.name).toBe("MASALA DOSA");
 h.set("kb-qty","2");h.key("Enter");
 expect(h.cart()[0].qty).toBe(2);
 expect(h.cart()[0].name).toBe("MASALA DOSA");
});
test("Viewing mode edits existing quantities and requires 0 to add a new item",()=>{
 const h=harness();h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("Escape");expect(h.obj.kb.mode).toBe("view");
 h.key("Enter");expect(h.obj.kb.step).toBe("qty");
 h.set("kb-qty","4");h.key("Enter");
 expect(h.obj.kb.mode).toBe("view");
 expect(h.active()).toBe("kb-code");
 expect(h.cart()).toHaveLength(1);
 expect(h.cart()[0].qty).toBe(4);
 h.key("0");expect(h.obj.kb.mode).toBe("add");
 expect(h.obj.kb.step).toBe("code");
});
test("Bill print steps Discount to Instruction to Print and frees table without confirmation",()=>{
 const h=harness();h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("Escape");h.key("5");expect(h.obj.kb.step).toBe("preview");
 expect(h.active()).toBe("kb-discount");
 h.key("Enter");expect(h.active()).toBe("kb-instruction");
 h.set("kb-instruction","Extra spoon");h.key("Enter");expect(h.active()).toBe("kb-print");
 h.key("Enter");
 expect(h.data.bills).toHaveLength(1);
 expect(h.data.bills[0].billInstruction).toBe("Extra spoon");
 expect(h.data.orders[0].status).toBe("billed");
 expect(h.cart()).toHaveLength(0);
 expect(h.currentTable()).toBe("");
 expect(h.printed()).toBe(1);
});
test("A blocked print popup keeps the table's open order and creates no bill",()=>{
 const h=harness(false);h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("Escape");h.key("5");h.key("Enter");h.key("Enter");h.key("Enter");
 expect(h.data.bills).toHaveLength(0);
 expect(h.data.orders[0].status).toBe("open");
 expect(h.currentTable()).toBe("t1");
 expect(h.cart()).toHaveLength(1);
});

test("Arrow keys visibly highlight Search Assistant rows and Enter chooses highlighted row",()=>{
 const h=harness();
 h.key("m");
 expect(h.obj.kb.step).toBe("search");
 expect(h.selection("search").map((x:any)=>x.ariaSelected)).toEqual(["true","false"]);
 h.key("ArrowDown");
 expect(h.obj.kb.cursor).toBe(1);
 expect(h.selection("search").map((x:any)=>x.ariaSelected)).toEqual(["false","true"]);
 expect(h.selection("search")[1].scrolls).toBeGreaterThan(0);
 h.key("Enter");
 expect(h.obj.kb.step).toBe("qty");
 expect(h.obj.kb.item.name).toBe("MASALA DOSA");
 expect(h.active()).toBe("kb-qty");
});
test("Viewing Mode arrows visibly highlight the existing order line",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.set("kb-code","37");h.key("Enter");h.key("Enter");
 expect(h.cart()).toHaveLength(2);
 h.key("Escape");
 expect(h.obj.kb.mode).toBe("view");
 expect(h.selection("order").map((x:any)=>x.ariaSelected)).toEqual(["true","false"]);
 h.key("ArrowDown");
 expect(h.obj.kb.selected).toBe(1);
 expect(h.selection("order").map((x:any)=>x.ariaSelected)).toEqual(["false","true"]);
 expect(h.selection("order")[1].scrolls).toBeGreaterThan(0);
 h.key("Enter");
 expect(h.obj.kb.item.name).toBe("MASALA DOSA");
});
test("Esc and minus close alphabetic Search Assistant without leaving the current table",()=>{
 for(const exitKey of ["Escape","-","Subtract"]){
  const h=harness();
  h.set("kb-code","615");h.key("Enter");h.key("Enter");
  const before=h.cart().map((row:any)=>({id:row.id,qty:row.qty}));
  const orderId=h.obj.getActiveOrder();
  h.key("m");
  expect(h.obj.kb.step).toBe("search");
  h.key(exitKey);
  expect(h.obj.kb.step).toBe("code");
  expect(h.obj.kb.mode).toBe("add");
  expect(h.active()).toBe("kb-code");
  expect(h.currentTable()).toBe("t1");
  expect(h.obj.getActiveOrder()).toBe(orderId);
  expect(h.cart().map((row:any)=>({id:row.id,qty:row.qty}))).toEqual(before);
  h.set("kb-code","37");h.key("Enter");
  expect(h.obj.kb.item.name).toBe("MASALA DOSA");
 }
});
