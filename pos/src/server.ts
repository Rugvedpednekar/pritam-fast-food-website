import {closeDueBusinessDays} from "./day-end";
import {normalizeRestaurantNames} from "./restaurant-name";
const htmlTemplate = await Bun.file(new URL("./client/index.html", import.meta.url)).text();
const menuExtension = Bun.env.MENU_EXTENSION_JS;
if(!menuExtension || !menuExtension.includes('var mView=')) throw Error('Menu assets unavailable');
const employeeExtension=Bun.env.EMPLOYEE_EXTENSION_JS;
if(!employeeExtension||!employeeExtension.includes('promptEmployee='))throw Error('Employee modal asset missing');
const categoryDeleteExtension=Bun.env.CATEGORY_DELETE_JS;
if(!categoryDeleteExtension||!categoryDeleteExtension.includes("category_deleted"))throw Error("Category delete asset missing");
const uxExtension=Bun.env.DIALOG_EXTENSION_JS;
if(!uxExtension||!uxExtension.includes("function uxPrompt("))throw Error("Dialog styling asset missing");
function replaceNativeDialogs(v){
 return v.replace(/\bprompt\s*\(/g,"await uxPrompt(").replace(/\bconfirm\s*\(/g,"await uxConfirm(").replace(/\balert\s*\(/g,"uxAlert(").replace(/document\.addEventListener\("click",function\(/g,'document.addEventListener("click",async function(').replace(/function mmApply\(/g,"async function mmApply(");
}
const excelImportExtension=Bun.env.MENU_EXCEL_IMPORT_JS;
if(!excelImportExtension||!excelImportExtension.includes("mxReadExcel("))throw Error("Excel menu asset missing");
new Function(excelImportExtension);
const posKeyboard=Bun.env.POS_KEYBOARD_JS;
if(!posKeyboard||!posKeyboard.includes("function posAddCode("))throw Error("POS keyboard asset missing");
new Function(posKeyboard);
let reportExtension=Bun.env.REPORTS_WORKSPACE_JS||"";
try{if(!reportExtension.includes("repBuild("))throw Error("Missing report module");new Function(reportExtension);}catch(error){console.error("Report module unavailable:",error);reportExtension="";}
let receiptExtension=Bun.env.RECEIPT_PRINT_JS||"";
try{if(!receiptExtension.includes("function receiptPDF("))throw Error("Receipt module missing");new Function(receiptExtension);}catch(err){console.error("Receipt asset is invalid",err);receiptExtension="";}
let billingTablesExtension=Bun.env.BILLING_TABLE_TOOLS_JS||"";
try{
 if(!billingTablesExtension.includes("btEffectivePrice(")||!billingTablesExtension.includes("btImportApply("))throw Error("Billing table tools unavailable");
 // Window-level change capture processes the selected table before legacy document handlers.
 billingTablesExtension=billingTablesExtension.replace('document.addEventListener("change",async function(ev){','window.addEventListener("change",async function(ev){');
 billingTablesExtension=billingTablesExtension.replace('Number.isInteger(v)&&v>0?(v/100).toFixed(2):""','typeof v==="string"?btEsc(v):(Number.isInteger(v)&&v>0?(v/100).toFixed(2):"")');

 billingTablesExtension=billingTablesExtension.replace('function btTableSave(){','async function btTableSave(){');
 billingTablesExtension=billingTablesExtension.replace('var before=JSON.stringify(data);\n t.name=name;', 'if(tableId===t.id&&cart.length&&(!active||sectionId!==section)){if(!await uxConfirm("This table change will clear the current unsaved bill. Continue?"))return;}\n var before=JSON.stringify(data);\n t.name=name;');
 billingTablesExtension=billingTablesExtension.replace('if(act==="table-save")return btTableSave();','if(act==="table-save")return await btTableSave();');

 new Function(billingTablesExtension);
}catch(err){console.error("Billing table tools unavailable",err);billingTablesExtension="";}

let tableDeleteExtension=Bun.env.TABLE_DELETE_JS||"";
try{if(!tableDeleteExtension.includes("sectionsView=function()"))throw Error("Table deletion asset missing");new Function(tableDeleteExtension);}catch(error){console.error("Table deletion unavailable",error);tableDeleteExtension="";}
let html=htmlTemplate.replace("/*__TABLEWISE_MENU_JS__*/",replaceNativeDialogs(menuExtension)).replace("/*__EMP_MODAL_JS__*/",replaceNativeDialogs(employeeExtension)).replace("/*__CATEGORY_DELETE_JS__*/",replaceNativeDialogs(categoryDeleteExtension)).replace("/*__UX_DIALOG_JS__*/",uxExtension).replace("/*__MENU_EXCEL_IMPORT_JS__*/",excelImportExtension).replace("/*__POS_KEYBOARD_JS__*/","try{\n"+posKeyboard+"\n}catch(bootError){console.error('Keyboard shortcut startup failed',bootError);\n}").replace("/*__REPORT_WORKSPACE_JS__*/","try{\n"+reportExtension+"\n}catch(reportError){console.error('Report workspace failed',reportError);\n}").replace("/*__RECEIPT_PRINT_JS__*/","try{\n"+receiptExtension+"\n}catch(receiptError){console.error('Receipt module failed',receiptError);\n}").replace("/*__BILLING_TABLE_TOOLS_JS__*/","try{\n"+billingTablesExtension+"\n}catch(billingError){console.error('Billing table module failed',billingError);\n}").replace("/*__TABLE_DELETE_JS__*/","try{\n"+tableDeleteExtension+"\n}catch(tableDeleteError){console.error('Table delete module failed',tableDeleteError);\n}");

html=html.replace("</style>",((Bun.env.TW_POS_CSS||"")+(Bun.env.TW_POS_OPTIONS_CSS||""))+"</style>").replace("startupFinished=true;\ncloudStart();\n})();",((Bun.env.TW_POS_OPTIONS_JS||"")+(Bun.env.TW_POS_JS||"")+(Bun.env.TW_POS_CLOSE_JS||""))+"\nstartupFinished=true;\ncloudStart();\n})();").replace('if(typeof showSavedBillModal==="function")showSavedBillModal(inv);else showToast("Bill "+inv.number+" saved.");','showToast("Bill "+inv.number+" saved.");');
html=html.replace("Save & go to tables","Close table (auto-save)");
// Only the receipt modal print button should invoke browser printing.
html=html.replace('if(printOnSave)requestAnimationFrame(function(){document.body.classList.add("fl-printing");window.print();});','');
html=html.replace("startupFinished=true;\ncloudStart();\n})();", "\n/* TABLEWISE_PREVIEW_THEN_PRINT_V2 */\nvar twReceiptSaveBefore=saveBill;\nsaveBill=async function(){\n  printOnSave=false;\n  return await twReceiptSaveBefore.apply(this,arguments);\n};\nif(typeof flBillView===\"function\"){\n  var twBillMarkupBefore=flBillView;\n  flBillView=function(){\n    var markup=twBillMarkupBefore.apply(this,arguments);\n    return markup.replace(\"Generate bill & print\",\"Generate bill\");\n  };\n}\n"+"\nstartupFinished=true;\ncloudStart();\n})();");
// TW_PRINT_FLAG_DISABLED_AT_SOURCE_V3: bill saves never start browser printing
const twPrintFlagsBefore=html.split("printOnSave=true").length-1;
html=html.split("printOnSave=true").join("printOnSave=false");
html=html.replace('if(printOnSave)requestAnimationFrame(function(){document.body.classList.add("fl-printing");window.print();});','');
html=html.replace("Generate bill & print","Generate bill");
console.log("TW_POS_PRINT_OPTION_V3", "autoPrintFlagsDisabled="+twPrintFlagsBefore, "option5="+html.includes('else if(n===5){flHideOptions();printOnSave=false;await saveBill();}'));
// GitHub-managed menu bulk delete UI (runs after Railway-injected extensions).
const fullMenuDeleteModule=await Bun.file(new URL("./client/delete-full-menu.js",import.meta.url)).text();
const bulkMenuBootMarker="startupFinished=true;\ncloudStart();\n})();";
if(!html.includes(bulkMenuBootMarker))throw Error("Menu delete insertion point missing");
html=html.replace(bulkMenuBootMarker,fullMenuDeleteModule+"\n"+bulkMenuBootMarker);
// GitHub-controlled mobile billing scrolling and pending-parcel access.
const twMobileLayoutModule=await Bun.file(new URL("./client/mobile-billing-layout.js",import.meta.url)).text();
const twMobileBootMarker="startupFinished=true;\ncloudStart();\n})();";
if(!html.includes(twMobileBootMarker))throw Error("Mobile layout insertion point missing");
html=html.replace(twMobileBootMarker,twMobileLayoutModule+"\n"+twMobileBootMarker);
// GitHub-owned POS module: remove the no-longer-used payment controls from billing.
const twNoPaymentFields=await Bun.file(new URL("./client/no-payment-type.js",import.meta.url)).text();
const twNoPaymentBoot="startupFinished=true;\ncloudStart();\n})();";
if(!html.includes(twNoPaymentBoot))throw Error("No-payment UI injection point missing");
html=html.replace(twNoPaymentBoot,twNoPaymentFields+"\n"+twNoPaymentBoot);
// GitHub-managed shift Settings UI, bill-save synchronization, and Bills actions.
const autoDayEndClient=await Bun.file(new URL("./client/auto-day-end.js",import.meta.url)).text();
const autoDayEndBoot="startupFinished=true;\ncloudStart();\n})();";
if(!html.includes(autoDayEndBoot))throw Error("Auto day-end insertion point not found");
html=html.replace(autoDayEndBoot,autoDayEndClient+"\n"+autoDayEndBoot);
// Restaurant archive and restore Settings.
const twExtension1=await Bun.file(new URL("./client/manage-restaurants.js",import.meta.url)).text();
if(!html.includes("startupFinished=true;\ncloudStart();\n})();"))throw Error("manage-restaurants.js insertion point missing");
html=html.replace("startupFinished=true;\ncloudStart();\n})();",twExtension1+"\n"+"startupFinished=true;\ncloudStart();\n})();");

// Payroll testing UI.
const payrollBase=await Bun.file(new URL("./client/payroll-preview.js",import.meta.url)).text();
const payrollArchiveIncrements=await Bun.file(new URL("./client/payroll-archive-increments.js",import.meta.url)).text();
const payrollBonusList=await Bun.file(new URL("./client/payroll-bonus-list.js",import.meta.url)).text();
const payrollTransfers=await Bun.file(new URL("./client/payroll-transfers.js",import.meta.url)).text();
const payrollBonusWithTransfers=payrollBonusList.replace(/\}\)\(\);\s*$/,payrollTransfers+"\n})();");
if(payrollBonusWithTransfers===payrollBonusList)throw Error("Payroll transfer insertion point missing");
const payrollArchiveWithBonus=payrollArchiveIncrements.replace(/\}\)\(\);\s*$/,payrollBonusWithTransfers+"\n})();");
if(payrollArchiveWithBonus===payrollArchiveIncrements)throw Error("Payroll bonus insertion point missing");
const twExtension2=payrollBase.replace(/\}\)\(\);\s*$/,payrollArchiveWithBonus+"\n})();");
if(twExtension2===payrollBase)throw Error("Payroll archive insertion point missing");
if(!html.includes("startupFinished=true;\ncloudStart();\n})();"))throw Error("payroll-preview.js insertion point missing");
html=html.replace("startupFinished=true;\ncloudStart();\n})();",twExtension2+"\n"+"startupFinished=true;\ncloudStart();\n})();");

// Zomato parcel shortcut.
const twExtension3=await Bun.file(new URL("./client/zomato-shortcut.js",import.meta.url)).text();
if(!html.includes("startupFinished=true;\ncloudStart();\n})();"))throw Error("zomato-shortcut.js insertion point missing");
html=html.replace("startupFinished=true;\ncloudStart();\n})();",twExtension3+"\n"+"startupFinished=true;\ncloudStart();\n})();");

// Phone Back navigation.
const twExtension4=await Bun.file(new URL("./client/mobile-back.js",import.meta.url)).text();
if(!html.includes("startupFinished=true;\ncloudStart();\n})();"))throw Error("mobile-back.js insertion point missing");
html=html.replace("startupFinished=true;\ncloudStart();\n})();",twExtension4+"\n"+"startupFinished=true;\ncloudStart();\n})();");
const dailyBillsModule=await Bun.file(new URL("./client/daily-bills-mobile.js",import.meta.url)).text();
if(!dailyBillsModule.includes("newInvoiceNumber=function(day)"))throw Error("Daily bill workflow asset missing");
if(!html.includes("startupFinished=true;\ncloudStart();\n})();"))throw Error("Daily bill insertion point missing");
html=html.replace("startupFinished=true;\ncloudStart();\n})();",
 dailyBillsModule+"\n"+"startupFinished=true;\ncloudStart();\n})();");
const clientScript=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if(!clientScript)throw Error("Compiled client code missing");
new Function(clientScript);

import { SQL } from "bun";
import {createHmac,timingSafeEqual,scryptSync} from "node:crypto";
const db=new SQL(Bun.env.DATABASE_URL,{max:4});
const secret=Bun.env.DEMO_SESSION_SECRET,user=Bun.env.DEMO_USERNAME,hash=Bun.env.DEMO_PASSWORD_SCRYPT;
if(!secret||!user||!hash)throw Error("Login configuration missing");
const [salt,digest]=hash.split(":");
function checkLogin(u,p){if(typeof u!=="string"||typeof p!=="string"||p.length>128)return false;const d=scryptSync(p,Buffer.from(salt,"hex"),32).toString("hex");return same(u,user)&&same(d,digest);}
let init;
function ready(){if(!init)init=db.unsafe("CREATE TABLE IF NOT EXISTS demo_snapshots(account_key text PRIMARY KEY,version bigint NOT NULL,payload jsonb NOT NULL,updated_at timestamptz DEFAULT now())").catch(e=>{init=null;throw e});return init;}
const cookie="tw_demo_session";
function sign(v){return createHmac("sha256",secret).update(v).digest("hex");}
function same(a,b){let x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function auth(req){let str=(req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(cookie+"="))?.slice(cookie.length+1)||"";let [exp,sig]=str.split(".");return !!exp&&!!sig&&/^\d{13}$/.test(exp)&&Number(exp)>Date.now()&&same(sig,sign(exp));}
function origin(req){try{return new URL(req.headers.get("origin")||"").host===(req.headers.get("host")||new URL(req.url).host)}catch{return false;}}
function res(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store",...extra}})}

/* Time-driven automatic close of configured business days.
   Uses optimistic version-checked snapshot updates to protect concurrent edits. */
async function runAutomaticDayEnd() {
  await ready();
  for (let attempt=0;attempt<5;attempt++) {
    const rows=await db.unsafe("SELECT version,payload::text AS payload FROM demo_snapshots WHERE account_key='owner'");
    if (!rows.length) return;
    const current=rows[0],state=JSON.parse(current.payload);
    const renamed=normalizeRestaurantNames(state);
    const due=closeDueBusinessDays(state,new Date());
    if (!due.length&&!renamed) return;
    const saved=await db.unsafe(
      "UPDATE demo_snapshots SET payload=$1::jsonb,version=version+1,updated_at=now() WHERE account_key='owner' AND version=$2 RETURNING version",
      [JSON.stringify(state),Number(current.version)]
    );
    if (saved.length) {
      if(due.length)console.log("Auto business day ended for "+due.join(", "));
      if(renamed)console.log("Normalized legacy restaurant name to Pritam Fast Food.");
      return;
    }
  }
  throw Error("Automatic day-end postponed due to concurrent updates.");
}
const automaticDayEndTimer=setInterval(() => {
  runAutomaticDayEnd().catch(err => console.error("Auto day-end retry pending:",err.message));
},30000);
automaticDayEndTimer.unref?.();
runAutomaticDayEnd().catch(err => console.error("Auto day-end startup:",err.message));

const failures=new Map();
Bun.serve({port:Number(Bun.env.PORT||3000),async fetch(req){
 const path=new URL(req.url).pathname;
 if(path==="/health"){try{await ready();await db.unsafe("SELECT 1");return res({ok:true,database:true});}catch(e){console.error("Health DB",e.message);return res({ok:false,database:false},503)}}
 if(path==="/"&&req.method==="GET")return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","x-frame-options":"DENY","content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
 if(!path.startsWith("/api/"))return res({error:"Not found"},404);
 if(path==="/api/session"&&req.method==="GET")return auth(req)?res({authenticated:true}):res({authenticated:false},401);
 if(path==="/api/login"&&req.method==="POST"){
  if(!origin(req))return res({error:"Origin rejected"},403);
  const ip=req.headers.get("x-real-ip")||"shared",f=failures.get(ip)||{n:0,t:Date.now()};
  if(Date.now()-f.t>900000){f.n=0;f.t=Date.now()}
  if(f.n>=8)return res({error:"Too many attempts. Try later."},429);
  let b;try{b=await req.json()}catch{return res({error:"Invalid JSON"},400)}
  if(!checkLogin(b.username,b.password)){f.n++;failures.set(ip,f);return res({error:"Incorrect username or password"},401);}
  failures.delete(ip);const exp=String(Date.now()+604800000),token=exp+"."+sign(exp);
  return res({authenticated:true},200,{"set-cookie":cookie+"="+token+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800"});
 }
 if(!auth(req))return res({error:"Authentication required"},401);
 if(path==="/api/logout"&&req.method==="POST"){if(!origin(req))return res({error:"Origin rejected"},403);return res({ok:true},200,{"set-cookie":cookie+"=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"});}
 if(path==="/api/state"&&req.method==="GET"){try{await ready();await runAutomaticDayEnd();const rows=await db.unsafe("SELECT version,payload::text AS payload FROM demo_snapshots WHERE account_key='owner'");return res(rows.length?{version:Number(rows[0].version),state:JSON.parse(rows[0].payload)}:{version:0,state:null})}catch(e){console.error("read",e.message);return res({error:"Database unavailable"},503)}}
 if(path==="/api/state"&&req.method==="PUT"){
  if(!origin(req))return res({error:"Origin rejected"},403);
  const text=await req.text();if(text.length>2500000)return res({error:"Payload too large"},413);
  let b;try{b=JSON.parse(text)}catch{return res({error:"Invalid JSON"},400)}
  let v=b?.version,state=b?.state;
  if(!Number.isSafeInteger(v)||v<0||state?.schema!==1||!Array.isArray(state.restaurants)||(state.restaurants.length<1||state.restaurants.length>50||!state.restaurants.some(r=>r&&r.active!==false))||!Array.isArray(state.bills)||!Array.isArray(state.employees)||!Array.isArray(state.closings)||!state.menus||!Number.isSafeInteger(state.seq))return res({error:"Invalid demo schema"},422);
  normalizeRestaurantNames(state);
  try{await ready();await runAutomaticDayEnd();let rows;if(v===0)rows=await db.unsafe("INSERT INTO demo_snapshots(account_key,version,payload) VALUES('owner',1,$1::jsonb) ON CONFLICT DO NOTHING RETURNING version",[JSON.stringify(state)]);
  else rows=await db.unsafe("UPDATE demo_snapshots SET payload=$1::jsonb,version=version+1,updated_at=now() WHERE account_key='owner' AND version=$2 RETURNING version",[JSON.stringify(state),v]);
  return rows.length?res({ok:true,version:Number(rows[0].version)}):res({error:"Concurrent update detected. Reload cloud data.",code:"VERSION_CONFLICT"},409)
  }catch(e){console.error("write",e.message);return res({error:"Database save failed"},503)}
 }
 return res({error:"Not found"},404);
}});

// TEST_SOURCE_MARKER_228
// TW_SAFE_DEPLOY_TEST_1122
