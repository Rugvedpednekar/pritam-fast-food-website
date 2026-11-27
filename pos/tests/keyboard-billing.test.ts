import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/client/keyboard-billing.js",import.meta.url),"utf8");

function harness(popupAllowed=true,opts:{parcel?:boolean}={}){
 const inputs:Record<string,any>={},selects:string[]=[],toasts:string[]=[],listeners:Record<string,Function[]>={};
 const selectionNodes:Record<string,any[]>={search:[],order:[],shift:[]};
 function selectedRows(which:string){
  const selector=which==="search"?'data-kba="choose"':which==="shift"?'data-kba="shift-to"':'data-kba="line"';
  const count=content.innerHTML.split(selector).length-1;
  if(selectionNodes[which].length!==count){
   selectionNodes[which]=Array.from({length:count},(_,index)=>({
    current:false,ariaSelected:"false",scrolls:0,
    classList:{toggle:function(name:string,enabled:boolean){if(name==="kb-current")this.owner.current=enabled;}},
    setAttribute:function(name:string,val:string){if(name==="aria-selected")this.ariaSelected=val;},
    focus:function(){activeId=which==="order"?"kb-line-"+index:which==="shift"?"kb-shift-"+index:"kb-search-result-"+index;},
    scrollIntoView:function(){this.scrolls++;}
   }));
   selectionNodes[which].forEach(n=>n.classList.owner=n);
  }
  return selectionNodes[which];
 }
 let activeId="",saved=0,printed=0,backCalls=0,confirmCalls=0,confirmAnswer=true,legacyConfirmCalls=0;
 let fixtureApi:any=null;
 const backSnapshots:any[]=[];
 const content:any={innerHTML:"<div class='fl-billing'></div>"};
 const document:any={
  head:{appendChild:()=>{}},
  createElement:()=>({id:"",textContent:""}),
  addEventListener:(name:string,handler:Function)=>{(listeners[name]??=[]).push(handler);},
  querySelectorAll:(selector:string)=>selector.includes("kb-results")?selectedRows("search"):
                                   selector.includes("kb-shift-results")?selectedRows("shift"):
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
  sections:{r1:[{id:"s1",name:"NON AC",kind:"dine-in"},{id:"parcel",name:"Parcel",kind:"takeaway"}]},
  tables:{r1:[{id:"t1",name:"Table 21",sectionId:"s1"}]},
  orders:[],bills:[],audit:[]};
 let cart:any[]=[],activeOrderId="",tableId=opts.parcel?"":"t1";
 const state:any={discountKind:"none",discountValue:"",discountReason:""};
 const window:any={
  addEventListener:()=>{},confirm:()=>{confirmCalls++;return confirmAnswer;},
  open:()=>popupAllowed?{
   closed:false,document:{open:()=>{},write:()=>{},close:()=>{}},
   focus:()=>{},print:()=>{printed++;}
  }:null
 };
 const outer=source.replace(/\}\)\(\);\s*$/,
   "return {kb,screen,pick,paint,key,action,saveQty,openPreview,printAndComplete,enterView,enterAdd,lookup,"+
   "getDraw:function(){return draw;},getSaveBill:function(){return saveBill;},getCart:function(){return cart;},getActiveOrder:function(){return activeOrderId;},getTable:function(){return tableId;}};})();");
 if(outer===source)throw Error("Could not instrument keyboard billing source");
 const params=["document","window","tab","selected","sectionId","tableId","activeOrderId","cart","data","draw","printBill","saveBill",
  "sectionPrice","selSection","selectedName","money","e","showToast","calculatePreview","saveTheData","getOpenDay",
  "newInvoiceNumber","branchCfg","discountKind","discountValue","discountReason","cloudReady","cloudBusy","cloudPending",
  "cloudConflict","setTimeout","flBack"];
 const args:any[]=[document,window,"pos","r1",opts.parcel?"parcel":"s1",tableId,activeOrderId,cart,data,
  ()=>{content.innerHTML="<div class='fl-billing'></div>";},()=>{},()=>{legacyConfirmCalls++;},
  (m:any,id:string)=>id==="parcel"?(m?.sectionPrices?.s1??null):(m?.sectionPrices?.[id]??null),()=>opts.parcel?data.sections.r1[1]:data.sections.r1[0],
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
  (fn:()=>void)=>{fn();return 0;},()=>{
  backCalls++;
  backSnapshots.push(fixtureApi?{cartLength:fixtureApi.getCart().length,
    tableId:fixtureApi.getTable(),activeOrderId:fixtureApi.getActiveOrder()}:null);
 }
 ];
 const obj:any=new Function(...params,"return "+outer.replace(/^\s*\/\*[\s\S]*?\*\/\s*/,""))(...args);
 fixtureApi=obj;
 function key(k:string){const ev:any={key:k,preventDefault:()=>{},stopImmediatePropagation:()=>{},
   ctrlKey:false,metaKey:false,altKey:false};obj.key(ev);}
 function set(id:string,value:string){document.getElementById(id).value=value;}
 function typeCode(value:string){set("kb-code",value);for(const handler of listeners.input||[])handler({target:document.getElementById("kb-code")});}
 function getText(id:string){return document.getElementById(id).textContent;}
 function draw(){obj.getDraw()();}
 draw();
 return {obj,data,draw,set,key,window,escape:()=>window.twBillingHandleEscape(),shortcut:(k:string)=>window.twBillingHandleShortcut(k),
  setConfirm:(v:boolean)=>confirmAnswer=v,confirmCalls:()=>confirmCalls,backCalls:()=>backCalls,backSnapshots,
  typeCode,getText,selects,toasts,selection:selectedRows,saved:()=>saved,printed:()=>printed,
  legacyConfirmCalls:()=>legacyConfirmCalls,
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
 expect(h.active()).toBe("kb-line-0");
 expect(h.cart()).toHaveLength(1);
 expect(h.cart()[0].qty).toBe(4);
 h.key("0");expect(h.obj.kb.mode).toBe("add");
 expect(h.obj.kb.step).toBe("code");
});
test("Bill print steps Instruction to Percent Discount to Print and frees table without confirmation",()=>{
 const h=harness();h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("Escape");h.key("5");expect(h.obj.kb.step).toBe("preview");
 expect(h.obj.kb.discountType).toBe("percent");
 expect(h.active()).toBe("kb-instruction");
 h.set("kb-instruction","Extra spoon");h.key("Enter");expect(h.active()).toBe("kb-discount");
 h.key("Enter");expect(h.active()).toBe("kb-print");
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


test("Viewing Mode hides the right-hand editor; 0 reveals it while retaining the same table",()=>{
 const h=harness();
 expect(h.obj.screen()).not.toContain('kb-grid kb-view-only');
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 const originalOrder=h.obj.getActiveOrder();
 h.key("Escape");
 expect(h.obj.kb.mode).toBe("view");
 expect(h.obj.kb.step).toBe("list");
 expect(h.obj.screen()).toContain('kb-grid kb-view-only');
 expect(h.active()).toBe("kb-line-0");
 expect(h.currentTable()).toBe("t1");
 h.key("0");
 expect(h.obj.kb.mode).toBe("add");
 expect(h.obj.screen()).not.toContain('kb-grid kb-view-only');
 expect(h.active()).toBe("kb-code");
 expect(h.obj.getActiveOrder()).toBe(originalOrder);
 expect(h.cart()).toHaveLength(1);
});
test("Editing a saved line temporarily reveals the right editor, then hides it after Enter",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("Escape");
 expect(h.obj.screen()).toContain('kb-grid kb-view-only');
 h.key("Enter");
 expect(h.obj.kb.step).toBe("qty");
 expect(h.obj.screen()).not.toContain('kb-grid kb-view-only');
 expect(h.active()).toBe("kb-qty");
 h.set("kb-qty","6");h.key("Enter");
 expect(h.obj.kb.mode).toBe("view");
 expect(h.obj.screen()).toContain('kb-grid kb-view-only');
 expect(h.cart()[0].qty).toBe(6);
 expect(h.active()).toBe("kb-line-0");
 h.key("5");
 expect(h.obj.kb.step).toBe("preview");
 expect(h.obj.screen()).toContain('Bill Preview');
 expect(h.cart()[0].qty).toBe(6);
});


test("Hiding the right panel preserves the original left-column grid track",()=>{
 expect(source).toContain("grid-template-columns:minmax(0,1.55fr) minmax(310px,.85fr)");
 expect(source).toContain("#twkb .kb-grid.kb-view-only .kb-edit{display:none!important}");
 expect(source).not.toContain("#twkb .kb-grid.kb-view-only{grid-template-columns:");
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("-");
 expect(h.obj.screen()).toContain('kb-grid kb-view-only');
 h.key("0");
 expect(h.obj.screen()).not.toContain('kb-grid kb-view-only');
});

test("Physical Escape routes through exactly the same shortcut as minus",()=>{
 for(const mode of ["entry","search","quantity","view"]){
  function setup(){
   const h=harness();
   if(mode==="search"){h.key("m");}
   if(mode==="quantity"){h.set("kb-code","615");h.key("Enter");}
   if(mode==="view"){h.set("kb-code","615");h.key("Enter");h.key("Enter");h.key("-");}
   return h;
  }
  const minus=setup(),esc=setup();
  minus.key("-");
  esc.escape();
  expect(esc.obj.kb.step).toBe(minus.obj.kb.step);
  expect(esc.obj.kb.mode).toBe(minus.obj.kb.mode);
  expect(esc.obj.screen()).toBe(minus.obj.screen());
  expect(esc.currentTable()).toBe(minus.currentTable());
  expect(esc.cart()).toEqual(minus.cart());
  expect(esc.active()).toBe(minus.active());
 }
});

test("Early Escape capture suppresses other handlers only inside keyboard billing",()=>{
 const index=readFileSync(new URL("../src/client/index.html",import.meta.url),"utf8");
 const script=index.match(/function twEarlyBillingEscape\(ev\)\{[\s\S]*?\n\}/)?.[0];
 expect(script).toBeTruthy();
 const handlers:string[]=[];
 let billing=true,dialog=false,prevented=0,stopped=0;
 const mockDoc={
  getElementById:(id:string)=>id==="twkb"&&billing?{}:null,
  querySelector:()=>dialog?{}:null
 };
 const mockWin={
  twBillingHandleEscape:()=>handlers.push("minus-equivalent"),
  twBillingHandleShortcut:(k:string)=>handlers.push("key:"+k),
  twBillingIsViewing:()=>false
 };
 const floorClear=index.match(/function twClearFloorTableNumber\(ev\)\{[\s\S]*?\n\}/)?.[0];
 const capture=new Function("document","window","tab",floorClear+"\n"+script+"; return twEarlyBillingEscape;")(mockDoc,mockWin,"pos");
 const event={key:"Escape",ctrlKey:false,altKey:false,metaKey:false,
  preventDefault:()=>prevented++,stopImmediatePropagation:()=>stopped++};
 capture(event);
 expect(handlers).toEqual(["minus-equivalent"]);
 expect(prevented).toBe(1);
 expect(stopped).toBe(1);
 billing=false;capture(event);
 expect(handlers).toHaveLength(1);
 dialog=true;billing=true;capture(event);
 expect(handlers).toHaveLength(1);
 expect(index.indexOf('window.addEventListener("keydown",twEarlyBillingEscape,true)')).toBeLessThan(index.indexOf('window.addEventListener("error"'));
});


test("Viewing Mode Escape or minus saves the order and returns to Tables without billing",()=>{
 for(const exitKey of ["Escape","-"]){
  const h=harness();
  h.set("kb-code","615");h.key("Enter");h.key("Enter");
  const orderId=h.obj.getActiveOrder();
  h.key("Escape"); // Add mode => Viewing Mode
  h.key(exitKey); // Viewing Mode => Tables
  expect(h.backCalls()).toBe(1);
  expect(h.currentTable()).toBe("");
  expect(h.cart()).toHaveLength(0);
  expect(h.data.orders.find((x:any)=>x.id===orderId)).toMatchObject({
   status:"open",tableId:"t1",cart:[{code:"615",qty:1}]
  });
  expect(h.data.bills).toHaveLength(0);
 }
});
test("1 opens a styled confirmation, Esc keeps the table, and Enter cancels",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.key("Enter");h.key("Escape");
 h.shortcut("1");
 expect(h.obj.kb.step).toBe("cancel");
 expect(h.obj.screen()).toContain('class="kb-overlay kb-confirm-overlay"');
 expect(h.obj.screen()).toContain('role="alertdialog"');
 expect(h.obj.screen()).toContain('Cancel Table 21?');
 expect(h.obj.screen()).toContain('Cancel Entire Table · Enter');
 expect(h.active()).toBe("kb-cancel-confirm");
 expect(h.confirmCalls()).toBe(0);
 expect(h.data.orders[0].status).toBe("open");
 h.shortcut("Escape");
 expect(h.obj.kb.step).toBe("list");
 expect(h.currentTable()).toBe("t1");
 expect(h.backCalls()).toBe(0);
 expect(h.data.orders[0].status).toBe("open");
 h.shortcut("1");
 expect(h.obj.kb.step).toBe("cancel");
 h.shortcut("Enter");
 expect(h.confirmCalls()).toBe(0);
 expect(h.data.orders[0].status).toBe("void");
 expect(h.data.bills).toHaveLength(0);
 expect(h.currentTable()).toBe("");
 expect(h.backCalls()).toBe(1);
 expect(h.data.audit.some((x:any)=>x.action==="table_order_cancelled")).toBe(true);
});
test("Down/up highlights a saved line and Delete removes only that line without confirmation",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.set("kb-code","37");h.key("Enter");h.key("Enter");
 h.key("Escape");
 expect(h.selection("order").map((x:any)=>x.ariaSelected)).toEqual(["true","false"]);
 h.shortcut("ArrowDown"); // early handler delegates here
 expect(h.selection("order").map((x:any)=>x.ariaSelected)).toEqual(["false","true"]);
 h.shortcut("Delete");
 expect(h.confirmCalls()).toBe(0);
 expect(h.cart()).toHaveLength(1);
 expect(h.cart()[0].code).toBe("615");
 expect(h.data.orders[0].cart.map((x:any)=>x.code)).toEqual(["615"]);
 expect(h.obj.kb.mode).toBe("view");
});
test("3 shifts to an empty table without overwriting occupied tables",()=>{
 const h=harness();
 h.data.tables.r1.push({id:"t2",name:"Table 22",sectionId:"s1",active:true},
 {id:"t3",name:"Table 23",sectionId:"s1",active:true},
 {id:"t4",name:"Table 24",sectionId:"s1",active:true});
 h.data.orders.push({id:"o-occupied",restaurantId:"r1",sectionId:"s1",tableId:"t3",status:"open",cart:[]});
 h.set("kb-code","615");h.key("Enter");h.key("Enter");h.key("Escape");
 h.shortcut("3");
 expect(h.obj.kb.step).toBe("shift");
 const shiftScreen=h.obj.screen();
 expect(shiftScreen).toContain("Table 22");
 expect(shiftScreen).toContain("Table 24");
 expect(shiftScreen).not.toContain("Table 23");
 expect(h.active()).toBe("kb-shift-0");
 h.shortcut("ArrowDown");
 expect(h.obj.kb.shiftIndex).toBe(1);
 expect(h.selection("shift")[1].ariaSelected).toBe("true");
 h.shortcut("Enter");
 expect(h.currentTable()).toBe("t4");
 expect(h.data.orders.find((x:any)=>x.tableId==="t4").cart[0].code).toBe("615");
 expect(h.data.orders.find((x:any)=>x.id==="o-occupied").status).toBe("open");
 expect(h.data.orders.some((x:any)=>x.status==="open"&&x.tableId==="t1")).toBe(false);
 expect(h.data.audit.some((x:any)=>x.action==="table_shifted")).toBe(true);
});
test("No vacant target blocks shift and leaves the table unchanged",()=>{
 const h=harness();
 h.data.tables.r1.push({id:"t2",name:"Table 22",sectionId:"s1",active:true});
 h.data.orders.push({id:"o-other",restaurantId:"r1",sectionId:"s1",tableId:"t2",status:"open",cart:[]});
 h.set("kb-code","615");h.key("Enter");h.key("Enter");h.key("Escape");
 h.shortcut("3");
 expect(h.obj.kb.step).toBe("list");
 expect(h.currentTable()).toBe("t1");
 expect(h.data.orders.find((x:any)=>x.tableId==="t1").status).toBe("open");
 expect(h.toasts.at(-1)).toContain("No empty");
});
test("5 opens print preview directly from Viewing Mode",()=>{
 const h=harness();h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("Escape");h.shortcut("5");
 expect(h.obj.kb.step).toBe("preview");
 expect(h.active()).toBe("kb-instruction");
 expect(h.data.bills).toHaveLength(0);
});
test("Legacy handler capture routes Viewing Mode arrows, delete, 1, 3 and 5 before other listeners",()=>{
 const index=readFileSync(new URL("../src/client/index.html",import.meta.url),"utf8");
 const src=index.match(/function twEarlyBillingEscape\(ev\)\{[\s\S]*?\n\}/)?.[0];
 expect(src).toBeTruthy();
 let viewing=true,dialog=false,shown=true;
 const calls:string[]=[];
 const doc:any={
  getElementById:()=>shown?{}:null,
  querySelector:()=>dialog?{}:null
 };
 const host:any={
  twBillingIsViewing:()=>viewing,
  twBillingHandleEscape:()=>calls.push("escape"),
  twBillingHandleShortcut:(key:string)=>calls.push(key)
 };
 const floorClear=index.match(/function twClearFloorTableNumber\(ev\)\{[\s\S]*?\n\}/)?.[0];
 const handler=new Function("document","window","tab",floorClear+"\n"+src+";return twEarlyBillingEscape;")(doc,host,"pos");
 function press(key:string){
  let stopped=0;
  handler({key,ctrlKey:false,altKey:false,metaKey:false,preventDefault:()=>{},stopImmediatePropagation:()=>stopped++});
  return stopped;
 }
 for(const key of ["ArrowDown","ArrowUp","Delete","1","3","5","-"]){
  expect(press(key)).toBe(1);
  expect(calls.at(-1)).toBe(key);
 }
 expect(press("Escape")).toBe(1);
 expect(calls.at(-1)).toBe("escape");
 viewing=false;expect(press("ArrowDown")).toBe(0);
 dialog=true;viewing=true;expect(press("Delete")).toBe(0);
 shown=false;dialog=false;expect(press("Escape")).toBe(0);
});

test("Cancel dialog handles Escape and minus identically without a browser confirmation",()=>{
 for(const exitKey of ["Escape","-","NumpadSubtract"]){
  const h=harness();h.set("kb-code","615");h.key("Enter");h.key("Enter");h.key("Escape");
  h.shortcut("1");expect(h.obj.kb.step).toBe("cancel");
  h.shortcut(exitKey);
  expect(h.obj.kb.step).toBe("list");
  expect(h.currentTable()).toBe("t1");
  expect(h.data.orders[0].status).toBe("open");
  expect(h.confirmCalls()).toBe(0);
  expect(h.active()).toBe("kb-line-0");
 }
});
test("In-app shift price confirmation applies destination prices only on Enter",()=>{
 const h=harness();
 h.data.sections.r1.push({id:"s2",name:"AC",kind:"dine-in",active:true});
 h.data.tables.r1.push({id:"t2",name:"Table 22",sectionId:"s2",active:true});
 for(const item of h.data.menus.r1){item.sectionPrices.s2=item.sectionPrices.s1+2000;}
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.shortcut("Escape");h.shortcut("3");
 expect(h.obj.kb.step).toBe("shift");
 h.shortcut("Enter");
 expect(h.obj.kb.step).toBe("shift-confirm");
 expect(h.obj.screen()).toContain("Apply destination prices?");
 expect(h.obj.screen()).toContain("Table 22");
 expect(h.active()).toBe("kb-shift-confirm");
 expect(h.confirmCalls()).toBe(0);
 h.shortcut("-");
 expect(h.obj.kb.step).toBe("shift");
 expect(h.currentTable()).toBe("t1");
 expect(h.data.orders.find((o:any)=>o.tableId==="t1")?.status).toBe("open");
 h.shortcut("Enter");
 expect(h.obj.kb.step).toBe("shift-confirm");
 h.shortcut("Enter");
 expect(h.currentTable()).toBe("t2");
 expect(h.obj.kb.step).toBe("list");
 expect(h.cart()[0].price).toBe(3500);
 expect(h.data.orders.find((o:any)=>o.tableId==="t2")?.cart[0].price).toBe(3500);
 expect(h.confirmCalls()).toBe(0);
});
test("Billing module no longer calls native browser confirmation dialogs",()=>{
 expect(source).not.toMatch(/window\.confirm\s*\(/);
 expect(source).toContain("kb-confirm-dialog");
 expect(source).toContain('data-kba="cancel-confirm"');
 expect(source).toContain('data-kba="shift-confirm"');
});

test("Numeric table names display as Table 21 in the in-app confirmation",()=>{
 const h=harness();
 h.data.tables.r1[0].name="21";
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("Escape");h.shortcut("1");
 expect(h.obj.screen()).toContain("Cancel Table 21?");
 expect(h.obj.screen()).not.toContain("Cancel 21?");
 expect(h.confirmCalls()).toBe(0);
 h.shortcut("Escape");
 expect(h.obj.kb.step).toBe("list");
});

test("Cancel clears active cart before invoking legacy flBack to prevent reopening the order",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("Escape");h.shortcut("1");h.shortcut("Enter");
 expect(h.backSnapshots).toEqual([{cartLength:0,tableId:"",activeOrderId:""}]);
 expect(h.data.orders.filter((o:any)=>o.tableId==="t1"&&o.status==="open")).toHaveLength(0);
 expect(h.currentTable()).toBe("");
 expect(h.cart()).toHaveLength(0);
});
test("Cancel releases all duplicate open records at the same table but not a different table",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.data.orders.push(
  {id:"legacy-open",restaurantId:"r1",tableId:"t1",sectionId:"s1",status:"open",cart:[{code:"615",qty:1}]},
  {id:"other-table",restaurantId:"r1",tableId:"t2",sectionId:"s1",status:"open",cart:[{code:"37",qty:1}]}
 );
 h.key("Escape");h.shortcut("1");h.shortcut("Enter");
 expect(h.data.orders.filter((o:any)=>o.tableId==="t1"&&o.status==="open")).toHaveLength(0);
 expect(h.data.orders.filter((o:any)=>o.tableId==="t1").every((o:any)=>o.status==="void")).toBe(true);
 expect(h.data.orders.find((o:any)=>o.id==="other-table").status).toBe("open");
 expect(h.data.bills).toHaveLength(0);
 expect(h.backCalls()).toBe(1);
});

test("Desktop uses keyboard shortcuts without item-entry action buttons; phones retain them",()=>{
 expect(source).toContain("@media(min-width:761px)");
 expect(source).toContain("#twkb .kb-edit .kb-editor-controls");
 expect(source).toContain("#twkb .kb-edit .kb-editor-print-control");
 expect(source).toContain("display:none!important");
 expect(source).toContain("@media(max-width:760px)");
 expect(source).toContain("#twkb .kb-touch-controls{display:grid");
 const h=harness();
 const html=h.obj.screen();
 expect(html).toContain("kb-editor-controls kb-actions");
 expect(html).toContain("kb-editor-print-control");
 expect(html).toContain('data-kba="touch-search"');
 expect(html).toContain('data-kba="touch-lookup"');
});
test("Phone item buttons can search, select quantity, and save without a hardware keyboard",()=>{
 const h=harness();
 h.obj.action("touch-search",null);
 expect(h.obj.kb.step).toBe("search");
 h.obj.action("search-back",null);
 expect(h.obj.kb.step).toBe("code");
 h.set("kb-code","615");
 h.obj.action("touch-lookup",null);
 expect(h.obj.kb.step).toBe("qty");
 expect(h.active()).toBe("kb-qty");
 expect(h.obj.screen()).toContain('data-kba="touch-save"');
 h.set("kb-qty","2");h.obj.action("touch-save",null);
 expect(h.cart()).toHaveLength(1);
 expect(h.cart()[0].qty).toBe(2);
 expect(h.data.orders[0].cart[0].qty).toBe(2);
});
test("Phone Viewing Mode buttons select, edit and remove a single order line",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.set("kb-code","37");h.key("Enter");h.key("Enter");
 h.obj.action("view",null);
 const screen=h.obj.screen();
 for(const key of ["touch-up","touch-down","touch-edit","touch-delete",
   "touch-cancel-table","touch-shift"]){
  expect(screen).toContain('data-kba="'+key+'"');
 }
 expect(screen).toContain('data-kba="floor"');
 expect(screen).toContain('data-kba="preview"');
 h.obj.action("touch-down",null);
 expect(h.obj.kb.selected).toBe(1);
 h.obj.action("touch-delete",null);
 expect(h.cart().map((x:any)=>x.code)).toEqual(["615"]);
 h.obj.action("touch-edit",null);
 expect(h.obj.kb.step).toBe("qty");
 expect(h.active()).toBe("kb-qty");
});

test("Bill preview is itemized with rate, qty, separate CGST and SGST, discount and grand total",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.set("kb-qty","3");h.key("Enter");
 h.key("Escape");h.key("5");
 const html=h.obj.screen();
 expect(html).toContain("kb-preview-paper");
 expect(html).toContain("MINERAL WATER 500ML");
 expect(html).toContain("3 × ₹15.00 each");
 expect(html).toContain("₹45.00");
 for(const label of ["Subtotal","Discount","CGST","SGST","Grand total"]){
  expect(html).toContain(label);
 }
 expect(html.indexOf('id="kb-instruction"')).toBeLessThan(html.indexOf('id="kb-discount"'));
 expect(html).toContain('id="kb-unit">%</span>');
 expect(source).toContain("#twkb .kb-bill-preview-dialog .kb-discount-row{display:inline-flex;width:min(185px,100%)");
});
test("Escape or Back returns preview to Viewing Mode, so repeated 5 opens the same preview",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("Escape");
 for(let i=0;i<4;i++){
  h.shortcut("5");
  expect(h.obj.kb.step).toBe("preview");
  expect(h.obj.screen()).toContain("kb-preview-paper");
  expect(h.active()).toBe("kb-instruction");
  expect(h.obj.kb.discountType).toBe("percent");
  expect(h.data.bills).toHaveLength(0);
  if(i%2===0)h.escape();
  else h.obj.action("cancel",null);
  expect(h.obj.kb.step).toBe("list");
  expect(h.obj.kb.mode).toBe("view");
  expect(h.active()).toBe("kb-line-0");
  expect(h.currentTable()).toBe("t1");
 }
});
test("Legacy saveBill cannot display its confirmation in the new keyboard billing screen",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("Escape");
 h.obj.getSaveBill()();
 expect(h.obj.kb.step).toBe("preview");
 expect(h.legacyConfirmCalls()).toBe(0);
 h.obj.getSaveBill()();
 expect(h.obj.kb.step).toBe("preview");
 expect(h.legacyConfirmCalls()).toBe(0);
 h.escape();
 expect(h.obj.kb.step).toBe("list");
});
test("Compact preview touch buttons follow instruction then discount then print",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("Escape");h.key("5");
 const preview=h.obj.screen();
 expect(preview).toContain('data-kba="touch-instruction-next"');
 expect(preview).toContain('data-kba="touch-discount-next"');
 h.obj.action("touch-instruction-next",null);expect(h.active()).toBe("kb-discount");
 h.obj.action("touch-discount-next",null);expect(h.active()).toBe("kb-print");
});


test("Esc and minus on a new empty table go directly back to Tables, skipping Viewing Mode",()=>{
 for(const key of ["Escape","-","Subtract","NumpadSubtract"]){
  const h=harness();
  expect(h.cart()).toHaveLength(0);
  expect(h.currentTable()).toBe("t1");
  h.key(key);
  expect(h.backCalls()).toBe(1);
  expect(h.currentTable()).toBe("");
  expect(h.obj.kb.mode).toBe("add");
  expect(h.obj.kb.step).toBe("code");
  expect(h.data.orders).toHaveLength(0);
  expect(h.data.bills).toHaveLength(0);
  expect(h.backSnapshots).toEqual([{cartLength:0,tableId:"",activeOrderId:""}]);
 }
});
test("Esc on quantity entry without saved lines closes empty table without creating an order",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");
 expect(h.obj.kb.step).toBe("qty");
 expect(h.cart()).toHaveLength(0);
 h.key("Escape");
 expect(h.backCalls()).toBe(1);
 expect(h.currentTable()).toBe("");
 expect(h.data.orders).toHaveLength(0);
});
test("Esc after deleting the final order item releases empty saved table and does not reopen it",()=>{
 const h=harness();
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 expect(h.data.orders[0].status).toBe("open");
 h.key("Escape"); // with an item, first Esc still enters Viewing Mode
 expect(h.obj.kb.mode).toBe("view");
 expect(h.backCalls()).toBe(0);
 h.key("Delete");
 expect(h.cart()).toHaveLength(0);
 expect(h.data.orders[0].status).toBe("open");
 h.key("Escape");
 expect(h.data.orders[0].status).toBe("void");
 expect(h.data.orders[0].voidReason).toBe("Empty table closed");
 expect(h.data.audit.some((x:any)=>x.action==="empty_table_closed")).toBe(true);
 expect(h.currentTable()).toBe("");
 expect(h.data.orders.filter((x:any)=>x.tableId==="t1"&&x.status==="open")).toHaveLength(0);
 expect(h.backCalls()).toBe(1);
 expect(h.backSnapshots).toEqual([{cartLength:0,tableId:"",activeOrderId:""}]);
});
test("Closing an empty table never voids another table's existing order",()=>{
 const h=harness();
 h.data.orders.push({id:"other",restaurantId:"r1",status:"open",tableId:"t2",
  sectionId:"s1",cart:[{id:"m37",name:"MASALA DOSA",code:"37",qty:2,price:9900}]});
 h.key("-");
 expect(h.backCalls()).toBe(1);
 expect(h.data.orders.find((x:any)=>x.id==="other").status).toBe("open");
 expect(h.data.bills).toHaveLength(0);
});
test("An unexpectedly nonempty saved order cannot be discarded by closing an empty editor",()=>{
 const h=harness();
 h.data.orders.push({id:"legacy",restaurantId:"r1",status:"open",tableId:"t1",
  sectionId:"s1",cart:[{id:"m37",name:"MASALA DOSA",code:"37",qty:1,price:9900}]});
 h.key("Escape");
 expect(h.backCalls()).toBe(0);
 expect(h.currentTable()).toBe("t1");
 expect(h.data.orders.find((x:any)=>x.id==="legacy").status).toBe("open");
 expect(h.toasts.at(-1)).toContain("saved order");
});

test("Shortcut labels reflect direct return for empty tables and Viewing Mode for saved items",()=>{
 const h=harness();
 expect(h.obj.screen()).toContain("[Esc / -] Back to Tables");
 expect(h.obj.screen()).toContain("Esc / - · Tables");
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 expect(h.obj.screen()).toContain("[Esc / -] Viewing mode");
 expect(h.obj.screen()).toContain("Esc / - · View");
});

test("Saving a populated parcel with one Escape returns to Tables and leaves its order open",()=>{
 const h=harness(true,{parcel:true});
 h.set("kb-code","615");h.key("Enter");h.set("kb-qty","3");h.key("Enter");
 expect(h.data.orders).toHaveLength(1);
 const pendingId=h.data.orders[0].id;
 expect(h.data.orders[0]).toMatchObject({status:"open",sectionId:"parcel",tableId:"",label:"Parcel"});
 expect(h.data.orders[0].cart[0].qty).toBe(3);
 expect(h.backCalls()).toBe(0);
 h.key("Escape");
 expect(h.backCalls()).toBe(1);
 expect(h.backSnapshots).toEqual([{cartLength:0,tableId:"",activeOrderId:""}]);
 expect(h.data.orders.find((o:any)=>o.id===pendingId)).toMatchObject({
  status:"open",restaurantId:"r1",sectionId:"parcel",tableId:"",cart:[{code:"615",qty:3}]
 });
 expect(h.data.bills).toHaveLength(0);
 expect(h.cart()).toHaveLength(0);
 expect(h.toasts.at(-1)).toContain("Parcel saved");
});
test("Minus from a populated parcel saves it with the same one-key return behavior",()=>{
 const h=harness(true,{parcel:true});
 h.set("kb-code","615");h.key("Enter");h.key("Enter");
 h.key("-");
 expect(h.backCalls()).toBe(1);
 expect(h.data.orders).toHaveLength(1);
 expect(h.data.orders[0].status).toBe("open");
 expect(h.data.orders[0].sectionId).toBe("parcel");
 expect(h.data.orders[0].cart).toHaveLength(1);
});
test("Empty parcel is not saved as an open order when Escape closes it",()=>{
 const h=harness(true,{parcel:true});
 h.key("Escape");
 expect(h.backCalls()).toBe(1);
 expect(h.data.orders).toHaveLength(0);
});

test("Reopening a saved parcel restores its line items and subsequent changes update that same order",()=>{
 const h=harness(true,{parcel:true});
 const original={id:"saved-p1",restaurantId:"r1",sectionId:"parcel",tableId:"",
  status:"open",label:"P-1",createdAt:"2026-11-28T09:00:00.000Z",
  cart:[{id:"m615",code:"615",name:"MINERAL WATER 500ML",qty:3,price:1500}]};
 h.data.orders.push(JSON.parse(JSON.stringify(original)));
 expect(h.window.twOpenSavedParcelOrder(original)).toBe(true);
 expect(h.obj.getActiveOrder()).toBe("saved-p1");
 expect(h.cart()).toHaveLength(1);
 expect(h.cart()[0].qty).toBe(3);
 expect(h.obj.screen()).toContain("MINERAL WATER 500ML");
 h.set("kb-code","37");h.key("Enter");h.key("Enter");
 expect(h.data.orders).toHaveLength(1);
 expect(h.data.orders[0].cart).toHaveLength(2);
 expect(h.data.orders[0].status).toBe("open");
 h.key("Escape");
 expect(h.backCalls()).toBe(1);
 expect(h.data.orders).toHaveLength(1);
 expect(h.data.orders[0].cart[1].code).toBe("37");
});
