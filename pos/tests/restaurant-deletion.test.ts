import {test,expect} from "bun:test";
import {createOwnerResetController,purgeRestaurantState} from "../src/owner-reset";

function restaurantState(){
 return {
  schema:1,
  restaurants:[{id:"r1",name:"Pritam Fast Food",active:true},{id:"r2",name:"Second Outlet",active:true}],
  menus:{r1:[{id:"a"}],r2:[{id:"b"}]},
  bills:[{id:"1",restaurantId:"r1",total:10000},{id:"2",restaurantId:"r2",total:20000}],
  orders:[{id:"o1",restaurantId:"r1"},{id:"o2",restaurantId:"r2"}],
  employees:[{id:"e1",restaurantId:"r1"},{id:"e2",restaurantId:"r2"}],
  closings:[],customers:[],deliveryBoys:[],deliveries:[],audit:[],
  branchSettings:{r1:{},r2:{}},sections:{r1:[],r2:[]},tables:{r1:[],r2:[]},
  openDays:{},invoiceCounters:{r1:3,r2:8},seq:10
 };
}

function fakeDB(initial:any, opts:{raced?:boolean,doubleEncoded?:boolean,malformed?:boolean}={}){
 let snapshot=structuredClone(initial),version=7,deletedPhotos=0,tombstones=0,updateAttempts=0,unrecognizedQuery="";
 async function sql(query:string,params:any[]=[],within=false):Promise<any[]>{
  if(query.startsWith("SELECT version,payload::text")){
   if(within)throw Error("Should not read the snapshot from transaction SELECT");
   return [{version,payload:opts.malformed?"{not-json":opts.doubleEncoded?JSON.stringify(JSON.stringify(snapshot)):JSON.stringify(snapshot)}];
  }
  if(query.startsWith("UPDATE demo_snapshots SET payload=")){
   updateAttempts++;
   if(opts.raced||params[1]!==version)return [];
   snapshot=JSON.parse(params[0]);version++;
   return [{version}];
  }
  if(query.startsWith("DELETE FROM demo_employee_photos")){deletedPhotos++;return [];}
  if(query.startsWith("INSERT INTO demo_deleted_restaurants")){tombstones++;return [];}
  if(query.startsWith("CREATE TABLE")||query.startsWith("INSERT INTO demo_owner_security"))return [];
  unrecognizedQuery=query;throw Error("Unexpected SQL in deletion test");
 }
 const db={
  unsafe:(query:string,params?:any[])=>sql(query,params||[],false),
  begin:async(fn:(tx:any)=>Promise<any>)=>fn({unsafe:(query:string,params?:any[])=>sql(query,params||[],true)})
 };
 return {
  controller:createOwnerResetController({db,ready:async()=>{},photosReady:async()=>{},checkOwnerPassword:()=>true}),
  get:()=>({snapshot,version,deletedPhotos,tombstones,updateAttempts,unrecognizedQuery})
 };
}

test("Permanently deleting one restaurant preserves every other outlet and its bills",async()=>{
 const {controller,get}=fakeDB(restaurantState());
 const r=await controller.deleteRestaurant({restaurantId:"r2",version:7,confirmation:"DELETE",employeeIds:["e2"]});
 expect(r.ok).toBe(true);
 expect(r.version).toBe(8);
 expect(r.state.restaurants.map((x:any)=>x.id)).toEqual(["r1"]);
 expect(r.state.menus.r2).toBeUndefined();
 expect(r.state.menus.r1).toHaveLength(1);
 expect(r.state.bills.map((x:any)=>x.id)).toEqual(["1"]);
 expect(r.state.orders.map((x:any)=>x.id)).toEqual(["o1"]);
 expect(r.state.employees.map((x:any)=>x.id)).toEqual(["e1"]);
 expect(get()).toMatchObject({version:8,deletedPhotos:1,tombstones:1,updateAttempts:1});
});

test("An unreadable restaurant list fails closed before any destructive SQL runs",async()=>{
 const {controller,get}=fakeDB({schema:1,menus:{},bills:[],seq:1});
 await expect(controller.deleteRestaurant({restaurantId:"r2",version:7,confirmation:"DELETE"}))
  .rejects.toThrow("unexpected format");
 expect(get()).toMatchObject({version:7,deletedPhotos:0,tombstones:0,updateAttempts:0});
});

test("A stale version cannot remove a restaurant or any associated photos",async()=>{
 const {controller,get}=fakeDB(restaurantState(),{raced:true});
 await expect(controller.deleteRestaurant({restaurantId:"r2",version:7,confirmation:"DELETE"}))
  .rejects.toThrow("changed on another device");
 expect(get()).toMatchObject({version:7,deletedPhotos:0,tombstones:0,updateAttempts:1});
});

test("Wrong confirmation and last-restaurant protection block permanent deletion",async()=>{
 const {controller,get}=fakeDB(restaurantState());
 await expect(controller.deleteRestaurant({restaurantId:"r2",version:7,confirmation:"DELETE Second Outlet"}))
  .rejects.toThrow("Type DELETE exactly");
 expect(get().updateAttempts).toBe(0);
 const only=restaurantState();
 only.restaurants=[only.restaurants[0]];
 expect(()=>purgeRestaurantState(only,"r1")).toThrow("At least one restaurant must remain");
 expect(only.restaurants).toHaveLength(1);
});

test("Delete a fake restaurant stored as a legacy double-encoded JSONB string",async()=>{
 const {controller,get}=fakeDB(restaurantState(),{doubleEncoded:true});
 const result=await controller.deleteRestaurant({
  restaurantId:"r2",version:7,confirmation:"DELETE",employeeIds:["e2"]
 });
 expect(result.ok).toBe(true);
 expect(result.state.restaurants.map((r:any)=>r.id)).toEqual(["r1"]);
 expect(result.state.bills.map((b:any)=>b.id)).toEqual(["1"]);
 expect(result.state.menus).toHaveProperty("r1");
 expect(result.state.menus).not.toHaveProperty("r2");
 expect(get()).toMatchObject({version:8,deletedPhotos:1,tombstones:1});
});

test("Malformed JSON fails safely before any delete or database update",async()=>{
 const {controller,get}=fakeDB(restaurantState(),{malformed:true});
 await expect(controller.deleteRestaurant({restaurantId:"r2",version:7,confirmation:"DELETE"}))
  .rejects.toThrow("Could not decode saved restaurant data");
 expect(get()).toMatchObject({version:7,deletedPhotos:0,tombstones:0,updateAttempts:0});
});

