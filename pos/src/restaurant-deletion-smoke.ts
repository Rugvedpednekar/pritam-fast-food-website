/* Real PostgreSQL smoke test, executed at startup. All inserted fake data,
   deletions and tombstones are inside one transaction that is deliberately
   rolled back. Nothing in the real owner account is modified. */
import {randomBytes} from "node:crypto";
import {deleteRestaurantAccount} from "./owner-reset";

export async function runRestaurantDeletionSmoke(db){
 const accountKey="tw_smoke_"+randomBytes(12).toString("hex");
 const removable="tw_fake_delete",retained="tw_fake_keep";
 const fake={
  schema:1,
  restaurants:[
   {id:retained,name:"SMOKE TEST Keep",active:true},
   {id:removable,name:"SMOKE TEST Delete",active:true}
  ],
  menus:{[retained]:[{id:"item_1",name:"test"}],[removable]:[{id:"item_2",name:"test"}]},
  bills:[
   {id:"test_bill_keep",restaurantId:retained,total:100},
   {id:"test_bill_delete",restaurantId:removable,total:200}
  ],
  employees:[],closings:[],orders:[],sections:{},tables:{},branchSettings:{},
  invoiceCounters:{},openDays:{},seq:1
 };
 const rollbackMarker="TW_FAKE_RESTAURANT_ROLLBACK_"+accountKey;
 let verified=false;
 try{
  await db.begin(async tx=>{
   await tx.unsafe(
    "INSERT INTO demo_snapshots(account_key,version,payload) VALUES($1,1,$2::jsonb)",
    [accountKey,JSON.stringify(fake)]
   );
   // Use the identical SQL code path as a real deletion, but on our
   // transaction-scoped test row rather than the owner's account.
   const txDB={unsafe:(sql,params)=>tx.unsafe(sql,params),begin:fn=>fn(tx)};
   const deleted=await deleteRestaurantAccount({
    db:txDB,accountKey,restaurantId:removable,version:1,confirmation:"DELETE"
   });
   if(!deleted.ok||deleted.version!==2||
      deleted.state.restaurants.length!==1||
      deleted.state.restaurants[0].id!==retained||
      deleted.state.bills.length!==1||
      deleted.state.bills[0].id!=="test_bill_keep"||
      deleted.state.menus[removable]!==undefined||
      !Array.isArray(deleted.state.menus[retained]))
    throw Error("Fake restaurant deletion returned an invalid result");
   const rows=await tx.unsafe(
    "SELECT version,payload::text AS payload FROM demo_snapshots WHERE account_key=$1",
    [accountKey]
   );
   const saved=typeof rows[0]?.payload==="string"?JSON.parse(rows[0].payload):rows[0]?.payload;
   if(Number(rows[0]?.version)!==2||
      !saved?.restaurants?.some(r=>r.id===retained)||
      saved.restaurants.some(r=>r.id===removable)||
      saved.bills.some(b=>b.restaurantId===removable))
    throw Error("Database did not persist the expected fake deletion");
   verified=true;
   // Deliberately throw to ensure the entire test transaction rolls back:
   // not even a test record or tombstone is left behind.
   throw Error(rollbackMarker);
  });
  throw Error("Fake restaurant deletion smoke test did not roll back");
 }catch(err){
  if(!verified||err?.message!==rollbackMarker)throw err;
 }
 const leftovers=await db.unsafe(
  "SELECT COUNT(*)::int AS count FROM demo_snapshots WHERE account_key=$1",[accountKey]
 );
 if(Number(leftovers[0]?.count)!==0)
  throw Error("Fake restaurant deletion left a temporary database record");
 return {passed:true,rolledBack:true,realAccountsAffected:0};
}
