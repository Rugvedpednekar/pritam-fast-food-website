import {test,expect} from "bun:test";
import {businessDateFor,closeDueBusinessDays,parseRestaurantSnapshot} from "../src/day-end";

test("business-date boundary is IST, not browser local time",()=>{
  expect(businessDateFor(new Date("2026-11-25T02:59:00+05:30"),"03:00")).toBe("2026-11-24");
  expect(businessDateFor(new Date("2026-11-25T03:00:00+05:30"),"03:00")).toBe("2026-11-25");
  expect(businessDateFor(new Date("2026-11-25T22:59:00+05:30"),"23:00")).toBe("2026-11-24");
  expect(businessDateFor(new Date("2026-11-25T23:00:00+05:30"),"23:00")).toBe("2026-11-25");
  expect(businessDateFor(new Date("2026-11-25T01:00:00+05:30"),"00:00")).toBe("2026-11-25");
});

test("day ends once at cutoff and preserves pending parcel and table orders",()=>{
  const state={
    openDays:{a:{id:"a-d12",date:"2026-11-24",opened:"2026-11-24T03:02:00+05:30"}},
    branchSettings:{a:{autoDayEndEnabled:true,autoDayEndTime:"03:00"}},
    bills:[{id:"b1",businessDayId:"a-d12",restaurantId:"a",status:"paid",total:12345}],
    orders:[{id:"parcel",restaurantId:"a",status:"open",cart:[{id:"food",qty:3}]}],
    closings:[],audit:[]
  };
  expect(closeDueBusinessDays(state,new Date("2026-11-25T02:59:00+05:30"))).toEqual([]);
  expect(closeDueBusinessDays(state,new Date("2026-11-25T03:00:00+05:30"))).toEqual(["a"]);
  expect(state.closings).toHaveLength(1);
  expect(state.closings[0]).toMatchObject({dayId:"a-d12",net:12345,locked:true,automatic:true,methods:{}});
  expect(state.orders[0].status).toBe("open");
  expect(state.orders[0].cart).toHaveLength(1);
  expect(state.openDays.a).toBeUndefined();
  expect(closeDueBusinessDays(state,new Date("2026-11-25T03:30:00+05:30"))).toEqual([]);
});

test("disabled day-end does not close any business day",()=>{
  const state={openDays:{a:{id:"a-d",date:"2026-11-24",opened:"2026-11-23T10:00:00Z"}},
    branchSettings:{a:{autoDayEndEnabled:false,autoDayEndTime:"03:00"}},closings:[],audit:[],bills:[]};
  expect(closeDueBusinessDays(state,new Date("2026-11-25T04:00:00+05:30"))).toEqual([]);
  expect(state.openDays.a).toBeDefined();
});

test("Realistic double-encoded legacy snapshots are decoded before day-end",()=>{
 const state={
  schema:1,restaurants:[{id:"r1",name:"Pritam Fast Food"}],
  menus:{r1:[]},bills:[{id:"bill1",restaurantId:"r1",businessDayId:"r1day1",status:"paid",total:13000}],
  employees:[],closings:[],orders:[{id:"openOrder",restaurantId:"r1",status:"open"}],audit:[],
  openDays:{r1:{id:"r1day1",date:"2026-11-25",opened:"2026-11-25T04:00:00+05:30"}},
  branchSettings:{r1:{autoDayEndEnabled:true,autoDayEndTime:"03:00"}}
 };
 const raw=JSON.stringify(JSON.stringify(state));
 const parsed=parseRestaurantSnapshot(raw);
 expect(Array.isArray(parsed.restaurants)).toBe(true);
 expect(closeDueBusinessDays(parsed,new Date("2026-11-26T03:05:00+05:30"))).toEqual(["r1"]);
 expect(parsed.openDays.r1).toBeUndefined();
 expect(parsed.closings).toHaveLength(1);
 expect(parsed.closings[0].day).toBe("2026-11-25");
 expect(parsed.bills[0].total).toBe(13000);
 expect(parsed.orders[0].status).toBe("open");
 expect(parseRestaurantSnapshot(JSON.stringify(parsed)).closings).toHaveLength(1);
});

test("Invalid saved snapshot fails closed without erasing bills",()=>{
 for(const value of ["not-json",JSON.stringify("not-json"),JSON.stringify({restaurants:[],bills:[]}),"null"]){
  expect(()=>parseRestaurantSnapshot(value)).toThrow();
 }
});
