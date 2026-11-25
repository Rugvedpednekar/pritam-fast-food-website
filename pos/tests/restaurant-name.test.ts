import {test,expect} from "bun:test";
import {canonicalRestaurantName,normalizeRestaurantNames} from "../src/restaurant-name";

test("Pritam Fast Food is the consistent official outlet name",()=>{
 for(const old of [
  "Pritam Fast Food · Goregaon East",
  "Pritam Fast Food - Goregaon East",
  "Pritam Fast Food – Goregaon East",
  "Pritam Fast Food Goregaon East",
  "Pritam Fast Food (Goregaon East)",
  "Pritam Fast Food, Goregaon East, Mumbai",
  "pritam fast food",
 ]){
  expect(canonicalRestaurantName(old)).toBe("Pritam Fast Food");
 }
});
test("Historical POS records are renamed without resetting IDs, staff, menus, monthly payroll or addresses",()=>{
 const oldName="Pritam Fast Food · Goregaon East";
 const state={
  schema:1,
  restaurants:[{id:"r1",name:oldName},{id:"r2",name:"Classic Veg"}],
  menus:{r1:[{id:"m1",name:"Pav Bhaji"}]},
  bills:[{id:"bill1",restaurantId:"r1",restaurantName:oldName,amount:12345}],
  employees:[{id:"e1",restaurantId:"r1",restaurant:oldName}],
  transfers:[{employeeId:"e1",fromRestaurant:oldName,toRestaurant:"Classic Veg"}],
  snapshots:{month:"2026-11",restaurant:oldName,details:{restaurant:oldName},days:26},
  settings:{address:"Goregaon East, Mumbai",legalName:oldName}
 };
 expect(normalizeRestaurantNames(state)).toBe(true);
 expect(state.restaurants[0].name).toBe("Pritam Fast Food");
 expect(state.restaurants[1].name).toBe("Classic Veg");
 expect(state.employees[0].restaurant).toBe("Pritam Fast Food");
 expect(state.bills[0].restaurantName).toBe("Pritam Fast Food");
 expect(state.transfers[0].fromRestaurant).toBe("Pritam Fast Food");
 expect(state.snapshots.restaurant).toBe("Pritam Fast Food");
 expect(state.snapshots.details.restaurant).toBe("Pritam Fast Food");
 expect(state.settings.legalName).toBe("Pritam Fast Food");
 expect(state.settings.address).toBe("Goregaon East, Mumbai");
 expect(state.bills[0].restaurantId).toBe("r1");
 expect(state.snapshots.days).toBe(26);
 expect(normalizeRestaurantNames(state)).toBe(false);
});
test("It never renames a location address or distinct business",()=>{
 for(const other of ["Goregaon East, Mumbai","Pritam Veg Treat","Pritam Fast Food Express","Classic Veg","Pritam Fast Food — Mumbai"]){
  expect(canonicalRestaurantName(other)).toBe(other);
 }
});
