/* Owner-controlled factory reset for the single-account restaurant demo.
   This never runs automatically; it only clears data after a server-side PIN check. */
import {randomBytes, scryptSync, timingSafeEqual} from "node:crypto";

export function freshRestaurantState(){
 const restaurants=[], menus={};
 for(let i=1;i<=5;i++){
  const id="r"+randomBytes(7).toString("hex");
  restaurants.push({id,name:i===1?"Pritam Fast Food":"Restaurant "+String(i).padStart(2,"0")});
  menus[id]=[];
 }
 return {schema:1,restaurants,menus,bills:[],employees:[],closings:[],seq:1,
  orders:[],customers:[],deliveryBoys:[],deliveries:[],invoiceCounters:{},openDays:{},audit:[],
  factoryReset:true};
}


export function purgeRestaurantState(state,restaurantId){
 const restaurant=state?.restaurants?.find(r=>r.id===restaurantId);
 if(!restaurant)throw new Error("Restaurant not found");
 if(restaurant.active!==false&&state.restaurants.filter(r=>r.active!==false).length<=1)throw new Error("At least one restaurant must remain");
 const name=String(restaurant.name||"").trim().toLowerCase();
 const scoped=(record)=>{
  if(!record||typeof record!=="object")return false;
  if(record.restaurantId===restaurantId||record.branchId===restaurantId||record.outletId===restaurantId)return true;
  return !record.restaurantId&&!record.branchId&&!record.outletId&&name&&String(record.restaurant||record.restaurantName||record.branch||"").trim().toLowerCase()===name;
 };
 state.restaurants=state.restaurants.filter(r=>r.id!==restaurantId);
 for(const key of ["menus","branchSettings","sections","tables","openDays","taxRates"]){
  if(state[key]&&typeof state[key]==="object")delete state[key][restaurantId];
 }
 for(const key of ["invoiceCounters","dayEndSettings"]){
  if(state[key]&&typeof state[key]==="object"){
   for(const k of Object.keys(state[key]))if(k===restaurantId||k.startsWith(restaurantId+":"))delete state[key][k];
  }
 }
 for(const key of ["bills","employees","closings","orders","customers","deliveryBoys","deliveries","audit","payments","dayEnds","expenses"]){
  if(Array.isArray(state[key]))state[key]=state[key].filter(record=>!scoped(record));
 }
 return {restaurantId,name:restaurant.name};
}

/**
 * Delete a single outlet from one account's shared snapshot.
 * accountKey is supplied by the server, never by the website request.
 * Uses optimistic version checking and an atomic transaction.
 */
export async function deleteRestaurantAccount({db,accountKey,restaurantId,version,confirmation,employeeIds=[]}){
 if(!accountKey||typeof accountKey!=="string")throw Error("Account key required");
 if(!Array.isArray(employeeIds)||employeeIds.length>500||employeeIds.some(x=>typeof x!=="string"||!/^[a-zA-Z0-9_-]{1,90}$/.test(x)))
  fail(422,"Invalid employee identifiers");
 if(typeof restaurantId!=="string"||!/^[a-zA-Z0-9_-]{1,90}$/.test(restaurantId)||!Number.isSafeInteger(version)||version<1)
  fail(422,"Invalid restaurant deletion request");
 if(confirmation!=="DELETE")fail(422,"Type DELETE exactly to permanently delete this restaurant.");
 // First inspect the stored database row; an unreadable or malformed
 // snapshot must NEVER lead to partial or guessed deletion.
 const rows=await db.unsafe(
  "SELECT version,payload::text AS payload FROM demo_snapshots WHERE account_key=$1",
  [accountKey]
 );
 if(!Array.isArray(rows)||rows.length!==1)
  fail(409,"Restaurant database has not been initialized. Reload and try again.");
 if(Number(rows[0].version)!==version)
  fail(409,"Restaurant data changed on another device. Reload before deleting.");
 let state=rows[0].payload;
 try{
  for(let i=0;i<3&&typeof state==="string";i++)state=JSON.parse(state);
 }catch(err){fail(409,"Could not decode saved restaurant data. No records were deleted.");}
 if(!state||!Array.isArray(state.restaurants)||
    !state.restaurants.every(r=>r&&typeof r.id==="string")||
    !state.menus||typeof state.menus!=="object"||Array.isArray(state.menus)||
    !Array.isArray(state.bills)){
  // Safe structural diagnostics only: no restaurant names, bills or other
  // personally identifying or financial values in the server logs.
  console.error("restaurant-deletion-data-shape",JSON.stringify({
   rootType:Array.isArray(state)?"array":typeof state,
   restaurantType:Array.isArray(state?.restaurants)?"array":typeof state?.restaurants,
   menusType:Array.isArray(state?.menus)?"array":typeof state?.menus,
   billsType:Array.isArray(state?.bills)?"array":typeof state?.bills,
   payloadType:typeof rows[0].payload,
   hasStateWrapper:!!state?.state
  }));
  fail(409,"Saved restaurant data has an unexpected format. No records were deleted.");
 }
 if(!state.restaurants.some(r=>r.id===restaurantId))
  fail(404,"Restaurant no longer exists. Refresh Settings.");
 let info;
 try{info=purgeRestaurantState(state,restaurantId);}
 catch(err){fail(409,err.message);}
 return db.begin(async tx=>{
  const updated=await tx.unsafe(
   "UPDATE demo_snapshots SET payload=$1::jsonb,version=version+1,updated_at=now() WHERE account_key=$3 AND version=$2 RETURNING version",
   [JSON.stringify(state),version,accountKey]
  );
  if(!Array.isArray(updated)||updated.length!==1)
   fail(409,"Restaurant data changed on another device. Reload before deleting.");
  await tx.unsafe(
   "DELETE FROM demo_employee_photos WHERE account_key=$1 AND (restaurant_id=$2 OR employee_id=ANY($3::text[]))",
   [accountKey,restaurantId,employeeIds]
  );
  await tx.unsafe(
   "INSERT INTO demo_deleted_restaurants(account_key,restaurant_id,restaurant_name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
   [accountKey,restaurantId,info.name]
  );
  return {ok:true,version:Number(updated[0].version),state,removed:info};
 });
}

function fail(status,message){
 const error=new Error(message);error.status=status;throw error;
}
function pinMatches(pin,salt,digest){
 if(typeof pin!=="string"||!/^\d{6,8}$/.test(pin)||!salt||!digest)return false;
 const actual=scryptSync(pin,Buffer.from(salt,"hex"),32);
 const expected=Buffer.from(digest,"hex");
 return expected.length===actual.length&&timingSafeEqual(actual,expected);
}

export function createOwnerResetController({db,ready,photosReady,checkOwnerPassword}){
 let initialized=null;
 const attempts={count:0,started:0,lockedUntil:0};
 function rateCheck(){
  const now=Date.now();
  if(now<attempts.lockedUntil)fail(429,"Too many incorrect credentials. Try again in 15 minutes.");
  if(now-attempts.started>900000){attempts.started=now;attempts.count=0;}
 }
 function badAttempt(){
  attempts.count++;
  if(attempts.count>=5)attempts.lockedUntil=Date.now()+900000;
 }
 function clearAttempts(){attempts.count=0;attempts.lockedUntil=0;attempts.started=Date.now();}
 async function initialize(){
  await Promise.all([ready(),photosReady()]);
  if(!initialized)initialized=(async()=>{
   await db.unsafe("CREATE TABLE IF NOT EXISTS demo_owner_security(account_key text PRIMARY KEY, pin_salt text, pin_digest text, reset_generation bigint NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())");
   await db.unsafe("INSERT INTO demo_owner_security(account_key,reset_generation) VALUES('owner',0) ON CONFLICT DO NOTHING");
   await db.unsafe("CREATE TABLE IF NOT EXISTS demo_deleted_restaurants(account_key text NOT NULL,restaurant_id text NOT NULL,restaurant_name text NOT NULL,deleted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(account_key,restaurant_id))");
  })().catch(err=>{initialized=null;throw err;});
  await initialized;
 }
 async function status(){
  await initialize();
  const rows=await db.unsafe("SELECT pin_digest,reset_generation FROM demo_owner_security WHERE account_key='owner'");
  const deleted=await db.unsafe("SELECT restaurant_id AS id,restaurant_name AS name FROM demo_deleted_restaurants WHERE account_key='owner' ORDER BY deleted_at DESC");
  return {pinConfigured:!!rows[0]?.pin_digest,resetGeneration:Number(rows[0]?.reset_generation||0),deletedRestaurants:deleted};
 }
 async function setPin({ownerPassword,pin,confirmPin}){
  rateCheck();
  if(typeof pin!=="string"||!/^\d{6,8}$/.test(pin)||pin!==confirmPin)
   fail(422,"Enter matching owner PINs containing 6 to 8 digits.");
  if(typeof ownerPassword!=="string"||!checkOwnerPassword(ownerPassword)){
   badAttempt();fail(401,"Owner password is incorrect.");
  }
  await initialize();
  const salt=randomBytes(16).toString("hex"),digest=scryptSync(pin,Buffer.from(salt,"hex"),32).toString("hex");
  await db.unsafe("UPDATE demo_owner_security SET pin_salt=$1,pin_digest=$2,updated_at=now() WHERE account_key='owner'",[salt,digest]);
  clearAttempts();
  return {ok:true,pinConfigured:true};
 }
 async function resetEverything({pin,confirmation}){
  rateCheck();
  if(confirmation!=="RESET EVERYTHING")fail(422,"Type RESET EVERYTHING exactly to confirm permanent deletion.");
  await initialize();
  const saved=await db.begin(async tx=>{
   const rows=await tx.unsafe("SELECT pin_salt,pin_digest,reset_generation FROM demo_owner_security WHERE account_key='owner' FOR UPDATE");
   const setting=rows[0];
   if(!setting?.pin_digest)fail(409,"Set up your owner PIN in Settings first.");
   if(!pinMatches(pin,setting.pin_salt,setting.pin_digest)){
    badAttempt();fail(401,"Incorrect owner PIN.");
   }
   const fresh=freshRestaurantState();
   const result=await tx.unsafe("INSERT INTO demo_snapshots(account_key,version,payload,updated_at) VALUES('owner',1,$1::jsonb,now()) ON CONFLICT(account_key) DO UPDATE SET payload=EXCLUDED.payload,version=demo_snapshots.version+1,updated_at=now() RETURNING version",[JSON.stringify(fresh)]);
   await tx.unsafe("DELETE FROM demo_employee_photos WHERE account_key='owner'");
   // Preserve deletion tombstones: an old backup must never restore a deleted restaurant.
   const gen=await tx.unsafe("UPDATE demo_owner_security SET reset_generation=reset_generation+1,updated_at=now() WHERE account_key='owner' RETURNING reset_generation");
   return {ok:true,version:Number(result[0].version),resetGeneration:Number(gen[0].reset_generation),state:fresh};
  });
  clearAttempts();
  return saved;
 }


 async function deleteRestaurant(args){
  await initialize();
  return deleteRestaurantAccount({db,accountKey:"owner",...args});
 }

 return {status,setPin,resetEverything,deleteRestaurant};

}
