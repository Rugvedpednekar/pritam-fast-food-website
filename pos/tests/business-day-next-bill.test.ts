import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../src/client/auto-day-end.js",import.meta.url),"utf8");
const server=readFileSync(new URL("../src/server.ts",import.meta.url),"utf8");

function mount(overrides:{auto?:boolean,closedDay?:string,version?:number}={}){
 const actual=Date.parse("2026-11-26T03:10:00+05:30");
 class FixedDate extends Date{
  constructor(...args:any[]){super(...(args.length?args:[actual]) as [any]);}
  static now(){return actual;}
 }
 const selected="r1",notices:string[]=[];
 const local={
  schema:1,restaurants:[{id:selected,name:"Pritam Fast Food"}],
  menus:{r1:[]},bills:[{id:"billOld",restaurantId:selected,businessDate:"2026-11-25",total:13000}],
  employees:[],orders:[{id:"o1",restaurantId:selected,status:"open"}],closings:[],
  openDays:{},branchSettings:{r1:{autoDayEndEnabled:!!overrides.auto,autoDayEndTime:"03:00"}},audit:[],seq:12
 };
 if(overrides.closedDay)local.closings.push({restaurantId:selected,day:overrides.closedDay,dayId:"r1dayOld",locked:true});
 const remote=structuredClone(local);
 const doc:any={
  addEventListener:()=>{},getElementById:()=>null,
  createElement:()=>({id:"",textContent:""}),head:{appendChild:()=>{}}
 };
 const code=source.replace(/\}\)\(\);\s*$/, "return {getOpenDay,saveBill};})();");
 const fn=new Function(
 "Date","settings","getOpenDay","saveBill","branchCfg","data","selected","today",
 "cloudReady","cloudBusy","cloudConflict","cloudPending","cloudVersion","cloudReq",
 "valid","activeOrderId","ensureReferenceModel","localStorage","KEY","uxAlert",
 "draw","document","tab","showToast","saveTheData","e",
 "return ("+code.trim().replace(/;\s*$/, "")+");"
 );
 const runtime:any=fn(FixedDate,()=>"settings",()=>null,async()=>"bill-completed",
  ()=>local.branchSettings.r1,local,selected,()=>"2026-11-26",
  true,false,false,false,overrides.version??1,
  async()=>({ok:true,body:{version:overrides.version??1,state:remote}}),
  (value:any)=>!!value&&Array.isArray(value.restaurants),"",
  ()=>{},{setItem:()=>{}},"pos-storage", (message:string)=>notices.push(message),
  ()=>{},doc,"pos",()=>{},()=>true,(value:string)=>value
 );
 return {runtime,local,remote,notices};
}

test("After manually closing a business day, the next printed bill opens the following day",async()=>{
 const {runtime,local,notices}=mount({auto:false,closedDay:"2026-11-26"});
 const day=runtime.getOpenDay(true);
 expect(day.date).toBe("2026-11-27");
 expect(local.bills).toHaveLength(1);
 expect(local.orders[0].status).toBe("open");
 expect(notices).toHaveLength(0);
 expect(await runtime.saveBill()).toBe("bill-completed");
});

test("After automatic day-end, the next bill proceeds on the new day without a warning",async()=>{
 const {runtime,local,notices}=mount({auto:true,closedDay:"2026-11-25"});
 expect(await runtime.saveBill()).toBe("bill-completed");
 const day=runtime.getOpenDay(true);
 expect(day.date).toBe("2026-11-26");
 expect(local.orders[0].status).toBe("open");
 expect(local.bills).toHaveLength(1);
 expect(notices).toHaveLength(0);
});

test("The cloud API decodes a historical JSONB string before attempting automatic day-end",()=>{
 expect(server).toContain("const current=rows[0],state=parseRestaurantSnapshot(current.payload)");
 expect(server).toContain("state:parseRestaurantSnapshot(rows[0].payload)");
});
