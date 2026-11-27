import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/client/compact-parcel-floor.js",import.meta.url),"utf8");
const server=readFileSync(new URL("../src/server.ts",import.meta.url),"utf8");
const index=readFileSync(new URL("../src/client/index.html",import.meta.url),"utf8");
function harness(){
 const data:any={schema:1,seq:100,sections:{r1:[{id:"s1",name:"Non AC",kind:"dine-in"},{id:"parcel",name:"Parcel",kind:"takeaway"}]},
  tables:{r1:[{id:"t1",name:"1",sectionId:"s1"},{id:"t21",name:"21",sectionId:"s1"}]},
  openDays:{r1:{id:"r1d1",date:"2026-11-28"}},orders:[],bills:[],audit:[],closings:[]};
 const logs:any={style:"",clicks:[],toasts:[],saves:0,oldDraw:0,events:[],value:"",focused:false};
 const input:any={
  value:"",tagName:"INPUT",disabled:false,readOnly:false,
  getAttribute:(name:string)=>name==="placeholder"?"1, 2, 3...":name==="aria-label"?"Table number":null,
  setAttribute:()=>{},
  dispatchEvent:(ev:any)=>{logs.events.push(ev.type);return true;},
  focus:()=>{logs.focused=true;},
  parentElement:{textContent:"Table number",querySelectorAll:()=>[input]}
 };
 const parcelButtons:any[]=[],tableButtons:any[]=[];
 const parcels:any={
  querySelectorAll:(selector:string)=>selector==='button[data-fl="parcel-open"]'?parcelButtons:[],
  replaceChildren:(...nodes:any[])=>{
   parcelButtons.splice(0,parcelButtons.length,...nodes.filter(n=>n.dataset?.fl==="parcel-open"));
  }
 };
 const tables:any={querySelectorAll:(selector:string)=>selector==="button"?tableButtons:[]};
 const newParcel:any={textContent:"+ New parcel",click:()=>logs.clicks.push("new")};
 const floor:any={
  querySelector:(q:string)=>q===".fl-parcels"?parcels:q===".fl-table-grid"?tables:null,
  querySelectorAll:(q:string)=>q==="input"?[input]:q==="button"?[newParcel]:
   q==='.fl-parcels button[data-fl="parcel-open"]'?parcelButtons:[]
 };
 const doc:any={
  body:{tagName:"BODY"},
  head:{appendChild:(n:any)=>logs.style=n.textContent},
  createElement:(tag:string)=>{
   const handlers:Record<string,Function>={};
   return {id:"",tagName:tag.toUpperCase(),textContent:"",dataset:{},className:"",
    title:"",attributes:{} as Record<string,string>,
    setAttribute:function(k:string,v:string){this.attributes[k]=v;},
    getAttribute:function(k:string){return this.attributes[k]||null;},
    addEventListener:function(k:string,fn:Function){handlers[k]=fn;},
    click:function(){logs.clicks.push(this.dataset.id);handlers.click?.({stopImmediatePropagation:()=>{}});}
   };
  },
  querySelector:(q:string)=>q==="#content .fl-root:not(.fl-billing)"?floor:null
 };
 const window:any={};
 class EventMock{type:string;constructor(type:string){this.type=type;}}
 const src=source.replace(/\}\)\(\);\s*$/,
  "return {ensureNumbers,sequenceFor,parcelOrders,displayNumbers,nextOrderCandidate,renderFloor,tableInput,keyFor,dayFor,jump, getDraw:function(){return draw;},getSave:function(){return saveTheData;},getSelection:function(){return {sectionId,tableId,activeOrderId,cart};}};})();");
 if(src===source)throw Error("Missing module footer");
 const args=["document","window","Event","tab","data","selected","draw","saveTheData","getOpenDay","showToast",
  "sectionId","tableId","activeOrderId","cart"];
 const api:any=new Function(...args,"return "+src.replace(/^\s*\/\*[\s\S]*?\*\/\s*/,""))(
  doc,window,EventMock,"pos",data,"r1",()=>{logs.oldDraw++;},
  ()=>{logs.saves++;return true;},
  (create:boolean)=>data.openDays.r1,
  (msg:string)=>logs.toasts.push(msg),"s1","","",[]
 );
 function add(id:string,when:string,day="r1d1"){
  data.orders.push({id,restaurantId:"r1",sectionId:"parcel",tableId:"",
   status:"open",label:"Parcel",createdAt:when,cart:[{id:"m1",name:"Item",qty:1,price:100}]});
 }
 function pendingButton(id:string){
  const b:any={dataset:{id},textContent:"Parcel · 1 items",title:"",
   setAttribute:()=>{},getAttribute:()=>null,
   click:()=>logs.clicks.push(id)};
  parcelButtons.push(b);return b;
 }
 function key(k:string,target:any=input){
  let prevented=0,stopped=0;
  const ev={key:k,target,ctrlKey:false,altKey:false,metaKey:false,
   preventDefault:()=>prevented++,stopImmediatePropagation:()=>stopped++};
  const result=window.twFloorParcelShortcut(ev);
  return {result,prevented,stopped};
 }
 return {api,data,logs,input,window,doc,add,pendingButton,key,floor,parcelButtons,tableButtons};
}
test("Occupied table cards match the red outline size and free tiles remain hidden",()=>{
 const h=harness();
 expect(h.logs.style).toContain("grid-template-columns:repeat(auto-fill,96px)");
 expect(h.logs.style).toContain("width:96px!important");
 expect(h.logs.style).toContain("height:102px!important");
 expect(h.logs.style).toContain("button:not(.tw-table-occupied):not(.occupied)");
 expect(h.logs.style).toContain("grid-template-columns:repeat(auto-fill,110px)");
 expect(h.logs.style).toContain("width:110px!important");
 expect(h.logs.style).toContain("height:68px!important");
});
test("Assign P-1, P-2 per restaurant business day, retaining existing order numbers",()=>{
 const h=harness();
 h.add("a","2026-11-28T09:00:00Z");
 h.add("b","2026-11-28T10:00:00Z");
 expect(h.api.ensureNumbers()).toBe(true);
 expect(h.data.orders.map((o:any)=>o.parcelSeq)).toEqual([1,2]);
 expect(h.data.orders.map((o:any)=>o.parcelDayId)).toEqual(["r1d1","r1d1"]);
 expect(h.api.ensureNumbers()).toBe(false);
 h.add("c","2026-11-28T11:00:00Z");
 h.api.getSave()("{}");
 expect(h.data.orders.map((o:any)=>o.parcelSeq)).toEqual([1,2,3]);
 expect(h.logs.saves).toBe(1);
});
test("Day-end changes the business-day key and P numbering restarts from 1",()=>{
 const h=harness();
 h.add("old","2026-11-28T09:00:00Z");h.api.ensureNumbers();
 expect(h.data.orders[0].parcelSeq).toBe(1);
 h.data.orders[0].status="billed";
 h.data.bills.push({restaurantId:"r1",number:"P-1",businessDayId:"r1d1",parcelSeq:1});
 h.data.openDays.r1={id:"r1d2",date:"2026-11-29"};
 h.add("new","2026-11-29T10:00:00Z");
 h.api.ensureNumbers();
 expect(h.data.orders.find((o:any)=>o.id==="new").parcelSeq).toBe(1);
 expect(h.data.orders.find((o:any)=>o.id==="new").parcelDayId).toBe("r1d2");
 expect(h.data.orders.find((o:any)=>o.id==="old").parcelSeq).toBe(1);
 const result=h.window.twParcelInvoiceNumber(h.data.orders.find((o:any)=>o.id==="new"),h.data.openDays.r1);
 expect(result).toBe("P-1");
});
test("P only fills the floor lookup field; Enter on P opens New Parcel",()=>{
 const h=harness();
 const start=h.key("p",h.doc.body);
 expect(start).toEqual({result:true,prevented:1,stopped:1});
 expect(h.input.value).toBe("P");
 expect(h.logs.focused).toBe(true);
 expect(h.logs.clicks).toHaveLength(0);
 expect(h.logs.events).toHaveLength(0); // P alone must not trigger legacy input listeners.
 const entered=h.key("Enter");
 expect(entered).toEqual({result:true,prevented:1,stopped:1});
 expect(h.logs.clicks).toEqual(["new"]);
 expect(h.input.value).toBe("");
});
test("Typing P2 then Enter reopens only the matching pending parcel",()=>{
 const h=harness();
 h.add("a","2026-11-28T09:00:00Z");
 h.add("b","2026-11-28T10:00:00Z");
 h.api.ensureNumbers();
 const a=h.pendingButton("a"),b=h.pendingButton("b");
 h.api.renderFloor();
 expect(a.textContent).toBe("P-1");
 expect(b.textContent).toBe("P-2");
 h.input.value="p2";
 const entered=h.key("Enter");
 expect(entered.result).toBe(true);
 expect(h.logs.clicks).toEqual(["b"]);
 expect(h.input.value).toBe("");
 expect(h.logs.clicks).not.toContain("new");
});
test("Missing parcel token is not allowed to accidentally start a new order",()=>{
 const h=harness();h.input.value="P8";const r=h.key("Enter");
 expect(r.result).toBe(true);
 expect(h.logs.clicks).toHaveLength(0);
 expect(h.logs.toasts.at(-1)).toContain("No pending parcel P-8");
});
test("Existing numeric table shortcuts are not intercepted",()=>{
 const h=harness();
 h.input.value="21";const r=h.key("Enter");
 expect(r.result).toBe(false);expect(h.input.value).toBe("21");
});
test("Shared host captures parcel keys ahead of the legacy P hotkey",()=>{
 expect(index).toContain('window.twFloorParcelShortcut==="function"&&window.twFloorParcelShortcut(ev)');
 expect(index).toContain('window.twFloorParcelKeyup==="function"&&window.twFloorParcelKeyup(ev)');
 expect(server).toContain("./client/compact-parcel-floor.js");
});
test("The keyboard invoice generator uses P parcel number in bill history and receipt",()=>{
 const kb=readFileSync(new URL("../src/client/keyboard-billing.js",import.meta.url),"utf8");
 expect(kb).toContain('window.twParcelInvoiceNumber(open,day)');
 expect(kb).toContain('var number=parcel||newInvoiceNumber(day);');
 expect(kb).toContain('tableName:parcel||table?.name||""');
 expect(kb).toContain("parcelDayId:parcel?open?.parcelDayId:null");
});

test("An open parcel is rendered as a P-number card even when legacy floor has no cards",()=>{
 const h=harness();
 h.add("saved-parcel","2026-11-28T09:00:00Z");
 h.api.ensureNumbers();h.api.renderFloor();
 expect(h.parcelButtons).toHaveLength(1);
 expect(h.parcelButtons[0].textContent).toBe("P-1");
 expect(h.parcelButtons[0].dataset.twParcelOrderId).toBe("saved-parcel");
 expect(h.parcelButtons[0].attributes["aria-label"]).toContain("Open pending parcel P-1");
 expect(h.logs.clicks).toHaveLength(0);
});
test("Newly rendered P-1 parcel card restores the saved order for continuing the bill",()=>{
 const h=harness();h.add("saved","2026-11-28T09:00:00Z");
 h.data.orders[0].cart=[{id:"m1",code:"615",name:"Item",qty:4,price:1500}];
 h.api.ensureNumbers();h.api.renderFloor();
 h.parcelButtons[0].click();
 expect(h.api.getSelection()).toMatchObject({
  sectionId:"parcel",tableId:"",activeOrderId:"saved",
  cart:[{code:"615",qty:4}]
 });
 expect(h.logs.oldDraw).toBe(1);
});
test("Occupied table cards show only their table number and free tables stay hidden",()=>{
 const h=harness();
 function table(id:string,number:string){
  const classes=new Set<string>(),el:any={dataset:{id},textContent:number+" NON AC · 5 items · ₹550.00",
   labels:[] as any[],
   classList:{toggle:(name:string,active:boolean)=>{active?classes.add(name):classes.delete(name);}},
   querySelector:(selector:string)=>selector==="strong,b"?{textContent:number}:
       selector===".tw-table-only-number"?el.labels[0]||null:null,
   appendChild:(label:any)=>{el.labels.push(label);},
   setAttribute:()=>{},getAttribute:()=>null};
  return {el,classes};
 }
 const a=table("t1","1"),b=table("t21","21");
 h.tableButtons.push(a.el,b.el);
 h.data.orders.push({id:"dine",restaurantId:"r1",sectionId:"s1",tableId:"t1",
  status:"open",cart:[{id:"m1",qty:5}]});
 h.api.renderFloor();
 expect(a.classes.has("tw-table-number-card")).toBe(true);
 expect(a.classes.has("tw-table-occupied")).toBe(true);
 expect(a.el.labels).toHaveLength(1);
 expect(a.el.labels[0].textContent).toBe("1");
 expect(b.classes.has("tw-table-hidden")).toBe(true);
 expect(h.logs.style).toContain(">*:not(.tw-table-only-number){display:none!important}");
 expect(h.logs.style).toContain(".fl-table-grid>button.tw-table-hidden{display:none!important}");
 expect(h.logs.style).toContain("button.tw-table-number-card{font-size:0!important;color:transparent!important}");
});
test("Legacy parcel orders without a matching section still remain visible by Parcel label",()=>{
 const h=harness();
 h.add("legacy","2026-11-28T09:00:00Z");
 h.data.orders[0].sectionId="old-deleted-parcel-section";
 expect(h.api.parcelOrders()).toHaveLength(1);
 h.api.renderFloor();
 expect(h.parcelButtons).toHaveLength(1);
 expect(h.parcelButtons[0].textContent).toBe("P-1");
});
