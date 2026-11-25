/* TABLEWISE_PAYROLL_MANAGEMENT_DEMO_V3
   Browser-local demonstration. Does not post payroll or employee edits to the POS database.
   Salary basis: 30 days/month, with half days supported. */
(function(){
"use strict";
var TP_KEY="tablewise-payroll-demo-v3", TP_BASIS=30;
var TP_SECTIONS=["dashboard","employees","attendance","advances","sheets","history","settings"];
var TP_TITLES={dashboard:"Dashboard",employees:"Employees",attendance:"Attendance",advances:"Advances",salary:"Salary Calculator",sheets:"Payment Sheets",history:"Payroll History",settings:"Settings"};
var tpTab="dashboard",tpEditing=null,tpViewing=null,tpPhoto=null,tpPeriod="",tpIdRange="all",tpCommissionOpen=null,tpCalculationOpenId=null,tpDesignationEditing=null;
function tpEscape(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function tpMoney(p){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:0,maximumFractionDigits:0}).format((Number(p)||0)/100);}
function tpRupees(p){return String(Math.round((Number(p)||0)/100));}
function parsePaise(value){var v=String(value==null?"":value).trim();if(!/^\d{1,9}(?:\.0{1,2})?$/.test(v))return null;return Number(v.split(".")[0])*100;}
function tpMonth(delta){
 var now=dateIN(new Date()).slice(0,7).split("-").map(Number);
 return new Date(Date.UTC(now[0],now[1]-1+(delta||0),1)).toISOString().slice(0,7);
}
function tpMonthLabel(m){var p=String(m).split("-").map(Number);return new Intl.DateTimeFormat("en-IN",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(p[0],p[1]-1,1)));}
function tpDate(date){if(!date)return "—";var d=new Date(date.length===10?date+"T12:00:00+05:30":date);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(d):"—";}
function tpToday(){return dateIN(new Date());}
function tpStamp(){return new Date().toISOString();}
function tpId(){return "emp-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);}
function tpTrim(v,n){return String(v==null?"":v).trim().slice(0,n);}
function tpRound(p){return Math.round(p);}
function tpDesignationDefaults(){
 return [
  {code:"ek ch",title:"Chinese Helper"},
  {code:"hc",title:"Head Chef"},
  {code:"ch",title:"Chef"},
  {code:"cc",title:"Chinese Cook"},
  {code:"kh",title:"Kitchen Helper"},
  {code:"ca",title:"Cashier"},
  {code:"wt",title:"Waiter"},
  {code:"sv",title:"Server"},
  {code:"sup",title:"Supervisor"},
  {code:"pb",title:"Parcel Boy"},
  {code:"dc",title:"Delivery Coordinator"},
  {code:"cl",title:"Cleaner"}
 ];
}
function tpDesignationCode(value){
 return String(value==null?"":value).trim().toLowerCase().replace(/\s+/g," ");
}
function tpDesignationList(){
 return Array.isArray(tpData.designations)?tpData.designations:[];
}
function tpDesignationFind(value){
 var code=tpDesignationCode(value);
 return tpDesignationList().find(function(item){return tpDesignationCode(item.code)===code;})||null;
}
function tpDesignationExpand(value){
 var match=tpDesignationFind(value);
 return match?match.title:tpTrim(value,90);
}
function tpDesignationValid(code,title){
 return /^[a-z0-9][a-z0-9 -]{0,19}$/.test(code)&&title.length>0&&title.length<=90;
}

function tpDefaultPeriod(){return{advances:{},deductions:{},days:{},serials:{},salaries:{},commissions:{},payments:{},snapshots:{},updatedAt:null};}
function tpSample(){
 var first=(data.restaurants&&data.restaurants[0]&&data.restaurants[0].name)||"Pritam Fast Food";
 if(/^Restaurant\s*0*1$/i.test(first))first="Pritam Fast Food";
 first=tpOfficialRestaurantName(first);
 var second=(data.restaurants&&data.restaurants[1]&&data.restaurants[1].name)||"Restaurant 02";
 var emps=[
 {id:"demo1",name:"Aarav Patil",restaurantId:data.restaurants[0]&&data.restaurants[0].id,designation:"Head Chef",joined:"2023-04-12",restaurant:first,salary:3200000,method:"CASH",photo:"",leaveAllowance:4,active:true},
 {id:"demo2",name:"Meera Joshi",restaurantId:data.restaurants[0]&&data.restaurants[0].id,designation:"Restaurant Supervisor",joined:"2022-08-05",restaurant:first,salary:2850000,method:"CHEQUE",photo:"",leaveAllowance:2,active:true},
 {id:"demo3",name:"Ishaan Shetty",restaurantId:data.restaurants[0]&&data.restaurants[0].id,designation:"Cook",joined:"2024-01-18",restaurant:first,salary:2250000,method:"CASH",photo:"",leaveAllowance:4,active:true},
 {id:"demo4",name:"Ananya Naik",restaurantId:data.restaurants[0]&&data.restaurants[0].id,designation:"Cashier",joined:"2024-06-15",restaurant:first,salary:1950000,method:"CHEQUE",photo:"",leaveAllowance:2,active:true},
 {id:"demo5",name:"Kabir Khan",restaurantId:data.restaurants[1]&&data.restaurants[1].id,designation:"Delivery Coordinator",joined:"2023-11-10",restaurant:second,salary:2150000,method:"CASH",photo:"",leaveAllowance:4,active:true},
 {id:"demo6",name:"Riya Kulkarni",restaurantId:data.restaurants[1]&&data.restaurants[1].id,designation:"Kitchen Assistant",joined:"2025-02-03",restaurant:second,salary:1750000,method:"CASH",photo:"",leaveAllowance:2,active:true},
 {id:"demo7",name:"Mukesh",restaurantId:data.restaurants[0]&&data.restaurants[0].id,designation:"Parcel Delivery Boy",joined:"2025-03-01",restaurant:first,salary:0,method:"CASH",photo:"",leaveAllowance:0,employeeType:"parcel",commissionGstRate:5,active:true}
 ];
 var s={version:3,employees:emps,periods:{},salaryChanges:[],designations:tpDesignationDefaults(),settings:{leaveEarnEveryDays:7},createdAt:tpStamp()};
 var months=[tpMonth(0),tpMonth(-1),tpMonth(-2)];
 months.forEach(function(m,idx){
  var p=tpDefaultPeriod();s.periods[m]=p;
  emps.forEach(function(emp,i){
   p.serials[emp.id]=i<4?i+1:i<6?i-3:5;
   if(tpIsParcel(emp)){
    if(idx===0)p.commissions[emp.id]={mode:"total",
     daily:[1000,1500,1300,1200,1202].concat(Array(25).fill(1000)).map(function(x){return x*100;}),
     total:3120200,gstRate:5};
    return;
   }
   p.salaries[emp.id]=emp.salary;
   var adv=(i%3===0?500000:i%3===1?400000:300000);
   p.advances[emp.id]={amount:adv,enteredAt:m+"-05T10:30:00+05:30"};
   p.deductions[emp.id]={fine:i===2?15000:0,other:i===4?20000:0};
   var days=[26,25.5,27,24,26,25][i]-(idx===2?0.5:0);
   p.days[emp.id]=String(days);
   var calc=tpCompute(emp,p);
   if(calc)p.snapshots[emp.id]=tpSnapshot(emp,calc,days);
    });
  p.updatedAt=idx===0?tpStamp():m+"-15T16:25:00+05:30";
 });
 return s;
}
function tpOfficialRestaurantName(value){
 if(typeof value!=="string")return value;
 return /^\s*pritam\s+fast\s+food(?:\s*[·•|:,\-–—(]\s*|\s+)goregaon\s+east(?:\s*,\s*mumbai)?\s*\)?\s*$/i.test(value)||
  /^\s*pritam\s+fast\s+food\s*$/i.test(value)?"Pritam Fast Food":value;
}
function tpNormalizeRestaurantNames(record){
 if(!record||typeof record!=="object")return false;
 var changed=false;
 Object.keys(record).forEach(function(key){
  var item=record[key];
  if(typeof item==="string"){
   var renamed=tpOfficialRestaurantName(item);
   if(renamed!==item){record[key]=renamed;changed=true;}
  }else if(item&&typeof item==="object"){
   if(tpNormalizeRestaurantNames(item))changed=true;
  }
 });
 return changed;
}
function tpValid(x){return x&&x.version===3&&Array.isArray(x.employees)&&x.periods&&typeof x.periods==="object";}
function tpRead(){
 try{
  var x=JSON.parse(localStorage.getItem(TP_KEY));
  if(tpValid(x)){
   if(!x.settings||typeof x.settings!=="object")x.settings={};
   var rule=Number(x.settings.leaveEarnEveryDays);
   if(!Number.isSafeInteger(rule)||rule<1||rule>30)x.settings.leaveEarnEveryDays=7;
   if(!Array.isArray(x.salaryChanges))x.salaryChanges=[];
   if(!Array.isArray(x.officeLoans))x.officeLoans=[];
   var loanMigrated=false;
   if(!Array.isArray(x.designations))x.designations=tpDesignationDefaults();
   x.employees.forEach(function(emp){
    if(!emp.restaurantId){
     var matches=(data.restaurants||[]).filter(function(r){return String(r.name||"").trim().toLowerCase()===String(emp.restaurant||"").trim().toLowerCase();});
     if(matches.length===1)emp.restaurantId=matches[0].id;
    }
    if(!Number.isSafeInteger(emp.leaveAllowance)||emp.leaveAllowance<0||emp.leaveAllowance>31)emp.leaveAllowance=2;
    if(!tpIsParcel(emp)&&(!Number.isSafeInteger(emp.initialSalary)||emp.initialSalary<=0))emp.initialSalary=emp.salary;
    if(tpIsParcel(emp)&&(!Number.isFinite(emp.commissionGstRate)||emp.commissionGstRate<0||emp.commissionGstRate>100))emp.commissionGstRate=5;
   });
   Object.keys(x.periods).forEach(function(month){
    var p=x.periods[month];
    if(!p||typeof p!=="object")return;
    if(!p.serials||typeof p.serials!=="object")p.serials={};
    if(!p.salaries||typeof p.salaries!=="object")p.salaries={};
    if(!p.commissions||typeof p.commissions!=="object")p.commissions={};
    Object.keys(p.advances||{}).forEach(function(id){
     var loan=p.advances[id];
     if(!loan||loan.kind!=="office-loan")return;
     var key="migrated-loan-"+month+"-"+id;
     if(Number(loan.amount)>0&&!x.officeLoans.some(function(item){return item.id===key;}))
      x.officeLoans.push({id:key,employeeId:id,month:month,issuedAt:loan.enteredAt||month+"-01",amount:Number(loan.amount),note:"Migrated office loan"});
     p.advances[id]={amount:0};loanMigrated=true;
    });
    // Preserve historic salary rates from snapshots created before monthly salary tracking existed.
    x.employees.forEach(function(emp){
     var old=p.snapshots&&p.snapshots[emp.id];
     if(!Object.prototype.hasOwnProperty.call(p.salaries,emp.id)&&old&&Number.isSafeInteger(old.monthly)&&old.monthly>0)
      p.salaries[emp.id]=old.monthly;
    });
   });
   if(tpNormalizeRestaurantNames(x)||loanMigrated){
    try{localStorage.setItem(TP_KEY,JSON.stringify(x));}catch(err){}
   }
   return x;
  }
 }catch(err){}
 return tpSample();
}
var tpData=tpRead(),tpPeriod=tpMonth(0);
function tpSave(){
 try{localStorage.setItem(TP_KEY,JSON.stringify(tpData));return true;}
 catch(err){uxAlert("Payroll demo could not save on this device. Free browser storage or use a smaller photo.");return false;}
}
function tpGetPeriod(month){
 var m=month||tpPeriod;
 if(!tpData.periods[m])tpData.periods[m]=tpDefaultPeriod();
 var p=tpData.periods[m];
 if(!p.serials)p.serials={};
 if(!p.salaries)p.salaries={};
 if(!p.commissions)p.commissions={};
 return p;
}
function tpSerialValue(raw){
 if(raw===null||raw===undefined||String(raw).trim()==="")return null;
 var n=Number(raw);
 return Number.isSafeInteger(n)&&n>=1&&String(n)===String(raw).trim()?n:null;
}
function tpMonthSalary(emp,month){
 if(!tpData)return emp.salary;
 var m=month||tpPeriod,p=tpGetPeriod(m),saved=p.salaries[emp.id];
 if(Number.isSafeInteger(saved)&&saved>0)return saved;
 var history=(tpData.salaryChanges||[]).filter(function(c){return c.employeeId===emp.id&&c.effectiveMonth<=m;})
 .sort(function(a,b){return a.effectiveMonth.localeCompare(b.effectiveMonth)||a.changedAt.localeCompare(b.changedAt);});
 if(history.length)return history[history.length-1].newSalary;
 return emp.initialSalary||emp.salary;
}
function tpSetMonthSalary(emp,month,value,source){
 var m=month||tpPeriod,old=tpMonthSalary(emp,m);
 if(!Number.isSafeInteger(value)||value<=0)throw Error("Invalid salary value");
 if(value===old)return false;
 var period=tpGetPeriod(m);
 period.salaries[emp.id]=value;
 // An increase is effective from this month onward; prior months retain recorded rates.
 // Existing future months using the old rate follow this change, but custom rates remain intact.
 Object.keys(tpData.periods).forEach(function(otherMonth){
  if(otherMonth<=m)return;
  var future=tpGetPeriod(otherMonth);
  if(future.salaries[emp.id]===old)future.salaries[emp.id]=value;
 });
 if(!Array.isArray(tpData.salaryChanges))tpData.salaryChanges=[];
 tpData.salaryChanges.push({employeeId:emp.id,employeeName:emp.name,effectiveMonth:m,
  previousSalary:old,newSalary:value,changedAt:tpStamp(),source:source||"Attendance"});
 // The profile shows the most recently effective salary, while archived months keep their rates.
 emp.salary=tpMonthSalary(emp,tpMonth(0));
 return true;
}
function tpRestaurantIdentity(emp){
 if(!emp)return "";
 if(emp.restaurantId)return "id:"+String(emp.restaurantId);
 var name=String(emp.restaurant||"").trim().toLowerCase();
 var matches=(data.restaurants||[]).filter(function(r){return String(r.name||"").trim().toLowerCase()===name;});
 return matches.length===1?"id:"+matches[0].id:"name:"+name;
}
function tpSameRestaurant(a,b){
 var ak=tpRestaurantIdentity(a),bk=tpRestaurantIdentity(b);
 if(!ak||!bk)return false;
 if(ak.startsWith("id:")&&bk.startsWith("id:"))return ak===bk;
 return String(a.restaurant||"").trim().toLowerCase()===String(b.restaurant||"").trim().toLowerCase();
}
function tpResolveRestaurantId(name,existing){
 if(existing&&existing.restaurant===name&&existing.restaurantId)return existing.restaurantId;
 var selectedBranch=typeof selected!=="undefined"&&(data.restaurants||[]).find(function(r){return r.id===selected&&r.name===name;});
 if(selectedBranch)return selectedBranch.id;
 var matches=(data.restaurants||[]).filter(function(r){return r.name===name;});
 return matches.length===1?matches[0].id:null;
}
function tpSerialConflict(period,number,employeeId){
 var employee=tpEmp(employeeId);
 if(!employee)return null;
 return Object.keys(period.serials||{}).map(tpEmp).find(function(other){
  return other&&other.id!==employeeId&&other.active!==false&&other.left!==true&&
   tpSameRestaurant(other,employee)&&tpSerialValue(period.serials[other.id])===number;
 })||null;
}
function tpSerialInUse(period,number,employeeId){
 return !!tpSerialConflict(period,number,employeeId);
}
function tpSerialSort(a,b){
 var na=a.serial===null?Infinity:a.serial,nb=b.serial===null?Infinity:b.serial;
 return na-nb||a.emp.name.localeCompare(b.emp.name);
}
function tpHistoricEmployees(month){
 var p=tpGetPeriod(month);
 return tpData.employees.filter(function(emp){
  return emp.active!==false||[p.days,p.serials,p.salaries,p.advances,p.snapshots].some(function(obj){
   return obj&&Object.prototype.hasOwnProperty.call(obj,emp.id);
  });
 });
}
function tpEmployees(includeInactive){return tpData.employees.filter(function(x){return includeInactive||x.active!==false;});}
function tpEmp(id){return tpData.employees.find(function(x){return x.id===id;});}
function tpAvatar(emp,size){
 var cls="tp-avatar"+(size?" tp-avatar-"+size:"");
 return emp.photo?'<span class="'+cls+'"><img alt="" src="'+tpEscape(emp.photo)+'"></span>':'<span class="'+cls+'">'+tpEscape(String(emp.name||"Employee").split(/\s+/).slice(0,2).map(function(a){return a.charAt(0);}).join("").toUpperCase())+'</span>';
}
function tpIsParcel(emp){return !!emp&&emp.employeeType==="parcel";}
function tpCommissionRecord(period,employee){
 if(!period.commissions)period.commissions={};
 return period.commissions[employee.id]||null;
}
function tpCommissionMoney(value){
 var n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:0;
}
function tpCommissionCalculate(emp,period){
 var record=tpCommissionRecord(period,emp);
 if(!record)return null;
 var mode=record.mode==="total"?"total":"daily";
 var raw=mode==="total"?record.total:null;
 var valid=mode==="total"?Number.isSafeInteger(raw)&&raw>=0:
  Array.isArray(record.daily)&&record.daily.some(function(v){return v!==null&&v!==undefined&&v!=="";});
 if(!valid)return null;
 var sum=mode==="total"?tpCommissionMoney(raw):
  record.daily.slice(0,30).reduce(function(a,v){return a+tpCommissionMoney(v);},0);
 var rate=Number(record.gstRate);
 if(!Number.isFinite(rate)||rate<0||rate>100){rate=Number(emp.commissionGstRate);if(!Number.isFinite(rate)||rate<0||rate>100)rate=5;}
 var gst=Math.round(sum*rate/100);
 return {days:null,monthly:0,gross:sum,commissionTotal:sum,gst:gst,gstRate:rate,commissionMode:mode,
  leaveEarned:0,leavePay:0,earned:sum,paidAdvance:0,fine:0,other:0,withheld:gst,
  net:Math.max(0,sum-gst),shortfall:0,method:emp.method};
}
function tpInputDays(value){
 var s=String(value==null?"":value).trim();
 if(!/^\d{1,2}(?:\.5)?$/.test(s))return null;
 var n=Number(s);return Number.isFinite(n)&&n>=0&&n<=TP_BASIS?n:null;
}
function tpLeaveEarned(days,allowance,interval){
 var cap=Number(allowance),rate=Number(interval);
 if(!Number.isInteger(cap)||cap<0||cap>31)cap=2;
 if(!Number.isInteger(rate)||rate<1||rate>30)rate=7;
 return Math.min(cap,Math.floor(days/rate));
}
function tpLoanPersonKey(emp){
 if(!emp)return "";
 return String(emp.personId||emp.previousEmploymentId||emp.id);
}
function tpLoanBalance(emp,throughMonth){
 if(!emp||!tpData)return 0;
 if(!throughMonth)throughMonth=tpMonth(0);
 var key=tpLoanPersonKey(emp),borrowed=0,repaid=0,waived=0;
 var ids=new Set(tpData.employees.filter(function(e){return tpLoanPersonKey(e)===key;}).map(function(e){return e.id;}));
 (tpData.officeLoans||[]).forEach(function(loan){
  if(ids.has(loan.employeeId)&&(!throughMonth||loan.month<=throughMonth))borrowed+=Number(loan.amount)||0;
 });
 Object.keys(tpData.periods||{}).forEach(function(month){
  if(throughMonth&&month>throughMonth)return;
  var p=tpData.periods[month];
  if(!p)return;
  ids.forEach(function(id){
   var loan=p.advances&&p.advances[id];
   if(loan&&loan.kind==="office-loan")borrowed+=Number(loan.amount)||0;
   var d=p.deductions&&p.deductions[id];
   if(d)repaid+=Number(d.loanRepayment)||0;
  });
 });
 (tpData.officeLoanWaivers||[]).forEach(function(entry){
  if(ids.has(entry.employeeId)&&(!throughMonth||entry.month<=throughMonth))waived+=Number(entry.amount)||0;
 });
 return Math.max(0,borrowed-repaid-waived);
}
function tpCompute(emp,period,override,month){
 if(tpIsParcel(emp))return tpCommissionCalculate(emp,period);
 var raw=override===undefined?period.days[emp.id]:override;
 var days=tpInputDays(raw);
 if(days===null)return null;
 var monthly=tpMonthSalary(emp,month||tpPeriod);
 var gross=tpRound(monthly*days/TP_BASIS);
 var policy=tpData&&tpData.settings?tpData.settings.leaveEarnEveryDays:7;
 var leaveEarned=tpLeaveEarned(days,emp.leaveAllowance,policy);
 var leavePay=tpRound(monthly*leaveEarned/TP_BASIS);
 var a=period.advances[emp.id]||{},ded=period.deductions[emp.id]||{};
 var paidAdvance=a.kind==="office-loan"?0:Number(a.amount)||0;
 var fine=Number(ded.fine)||0;
  // Recover a configurable loan amount from this month's actual salary,
  // never from an earlier closed month or more than salary/loan remaining.
  if(tpData&&emp.active!==false&&(month||tpPeriod)===tpMonth(0)&&!period.finalized&&!period.locked){
   var earlier=Number(ded.loanRepayment)||0,manualOther=Math.max(0,(Number(ded.other)||0)-earlier);
   var balanceBefore=tpLoanBalance(emp,tpMonth(0))+earlier;
   var scheduled=Number(emp.officeLoanMonthlyDeduction)||0;
   var available=Math.max(0,gross+leavePay-paidAdvance-fine-manualOther);
   var recovery=Math.min(Math.max(0,scheduled),balanceBefore,available);
   if(recovery!==earlier){
    ded.loanRepayment=recovery;ded.other=manualOther+recovery;
    period.deductions[emp.id]=ded;period.updatedAt=tpStamp();
    tpSave();
   }
  }
  var other=Number(ded.other)||0;
 var withheld=paidAdvance+fine+other,earned=gross+leavePay;
 return {days:days,monthly:monthly,gross:gross,leaveEarned:leaveEarned,leavePay:leavePay,
  earned:earned,paidAdvance:paidAdvance,fine:fine,other:other,withheld:withheld,
  net:Math.max(0,earned-withheld),shortfall:Math.max(0,withheld-earned),method:emp.method};
}
function tpSnapshot(emp,c,days){
 return {name:emp.name,designation:emp.designation,restaurant:emp.restaurant,method:emp.method,monthly:c.monthly||tpMonthSalary(emp,tpPeriod),
  days:days,gross:c.gross,leaveEarned:c.leaveEarned||0,leaveAllowance:emp.leaveAllowance,
  leavePay:c.leavePay||0,earned:c.earned||c.gross,advance:c.paidAdvance,fine:c.fine,
  other:c.other,net:c.net,shortfall:c.shortfall};
}
function tpRows(month,includeHistory){
 var m=month||tpPeriod,p=tpGetPeriod(m);
 var emps=includeHistory?tpHistoricEmployees(m):tpEmployees(false);
 return emps.map(function(emp){
  var parcel=tpIsParcel(emp);
  return {emp:emp,serial:tpSerialValue(p.serials[emp.id]),salary:parcel?0:tpMonthSalary(emp,m),
   advance:parcel?{}:p.advances[emp.id]||{},deductions:parcel?{}:p.deductions[emp.id]||{},
   worked:p.days[emp.id],calc:tpCompute(emp,p,undefined,m),payment:null};
 }).sort(tpSerialSort);
}
function tpTotals(rows){
 var t={base:0,adv:0,advPaid:0,cash:0,cheque:0,ready:0,fines:0,other:0,leavePay:0,grand:0};
 rows.forEach(function(r){
  t.base+=r.salary;t.adv+=r.advance.kind==="office-loan"?0:Number(r.advance.amount)||0;t.advPaid+=Number(r.calc&&r.calc.paidAdvance)||0;
  if(r.calc){
   t.ready++;t.grand+=r.calc.net;t.fines+=r.calc.fine;t.other+=r.calc.other;
   t.leavePay+=Number(r.calc.leavePay)||0;
   if(r.emp.method==="CHEQUE")t.cheque+=r.calc.net;else t.cash+=r.calc.net;
  }
 });return t;
}
function tpCard(label,amount,foot,icon){return'<div class="tp-stat"><div class="tp-stat-head"><span>'+tpEscape(label)+'</span><span class="tp-stat-icon">'+icon+'</span></div><strong>'+amount+'</strong><small>'+tpEscape(foot||"")+'</small></div>';}
function tpButton(act,label,cls,extra){return'<button type="button" class="tp-button '+(cls||"")+'" data-tp-action="'+act+'" '+(extra||"")+'>'+label+'</button>';}
function tpToolbar(title,text,right){return'<div class="tp-header-row"><div><h2>'+title+'</h2><p>'+text+'</p></div>'+(right?'<div class="tp-actions">'+right+'</div>':"")+'</div>';}
function tpTable(columns,rows){return'<div class="tp-table-wrap"><table class="tp-table"><thead><tr>'+columns.map(function(x){return'<th>'+x+'</th>';}).join("")+'</tr></thead><tbody>'+rows.join("")+'</tbody></table></div>';}
function tpBadge(label,positive){return'<span class="tp-badge '+(positive?"tp-badge-positive":"tp-badge-muted")+'">'+tpEscape(label)+'</span>';}
function tpTop(){
 var out='<div class="tp-app"><div class="tp-hero"><div><span class="tp-eyebrow">TABLEWISE / PEOPLE OPERATIONS</span><h1>Restaurant Payroll</h1><p>Monthly payroll, paid leave credits, advances and payment sheets.</p><span class="tp-demo-pill">● DEMO DATA · SAVED ON THIS DEVICE ONLY</span></div><div class="tp-month-box"><label for="tp-month">Payroll month</label><input id="tp-month" type="month" value="'+tpEscape(tpPeriod)+'"><small>Leave policy: 1 day per '+tpData.settings.leaveEarnEveryDays+' days worked</small></div></div>';
 out+='<nav class="tp-nav" aria-label="Payroll sections">'+TP_SECTIONS.map(function(sec){return'<button type="button" data-tp-section="'+sec+'" class="'+(tpTab===sec?"tp-active":"")+'">'+TP_TITLES[sec]+'</button>';}).join("")+'</nav>';
 return out;
}
function tpDashboard(){
 var rows=tpRows(),t=tpTotals(rows),count=tpEmployees().length;
 var out='<div class="tp-stats">'+tpCard("Total employees",String(count),"Active team members","♙")+
  tpCard("Monthly salary expense",tpMoney(t.base),"Contractual base salaries","₹")+
  tpCard("Salary advances",tpMoney(t.adv),"Deducted from this month’s salary","↗")+
  tpCard("Cash salary total",tpMoney(t.cash),"Calculated including leave pay","₹")+
  tpCard("Cheque salary total",tpMoney(t.cheque),"Calculated including leave pay","▤")+'</div>';
 out+='<div class="tp-two"><section class="tp-panel">'+tpToolbar("Payroll overview",tpMonthLabel(tpPeriod)+' · 30-day salary basis',tpButton("go-sheets","View Payment Sheets","tp-primary"))+
 '<div class="tp-progress"><div><strong>'+t.ready+' of '+count+'</strong><span>salary calculations ready</span></div><div class="tp-track"><i style="width:'+(count?Math.round(t.ready/count*100):0)+'%"></i></div></div>'+
 '<div class="tp-summary-row"><span>Salary payable</span><strong>'+tpMoney(t.grand)+'</strong></div>'+
 '<div class="tp-summary-row"><span>Paid leave money included</span><strong>'+tpMoney(t.leavePay)+'</strong></div>'+
 '<div class="tp-summary-row"><span>Advances deducted</span><strong>'+tpMoney(t.advPaid)+'</strong></div>'+
 '<div class="tp-summary-row"><span>Fines and other deductions</span><strong>'+tpMoney(t.fines+t.other)+'</strong></div>'+
 '<div class="tp-note">Salary ÷ 30 × days worked + earned leave pay − monthly advance − fines − other deductions. Optional interest-free loans are issued and repaid from Employee Profiles. Leave pay is capped by each employee’s allowance.</div></section>';
 out+='<section class="tp-panel">'+tpToolbar("Payroll workflow","Manage advance amounts, calculate pay and prepare separate payment sheets.","")+
 '<div class="tp-step"><span>₹</span><div><strong>Advances</strong><p>Record employee advances and deductions.</p></div>'+tpButton("go-advances","Open","tp-light")+'</div>'+
 '<div class="tp-step"><span>▦</span><div><strong>Monthly Attendance</strong><p>Enter days once for Attendance and Salary.</p></div>'+tpButton("go-attendance","Open","tp-light")+'</div>'+
 '<div class="tp-step"><span>≡</span><div><strong>Payment Details</strong><p>Review automatically calculated salary and individual pay breakdowns.</p></div>'+tpButton("go-sheets","Open","tp-light")+'</div>'+
 '<div class="tp-step"><span>✓</span><div><strong>Payment Sheets</strong><p>Generate cash and cheque sheets.</p></div>'+tpButton("go-sheets","Open","tp-light")+'</div></section></div>';
 return out;
}
function tpOfficeLoanProfile(emp){
 if(tpIsParcel(emp))return "";
 var amount=tpLoanBalance(emp),ledger=(tpData.officeLoans||[]).filter(function(item){
  var employee=tpEmp(item.employeeId);
  return employee&&tpLoanPersonKey(employee)===tpLoanPersonKey(emp);
 });
 var history=ledger.slice().sort(function(a,b){return String(b.issuedAt).localeCompare(String(a.issuedAt));}).map(function(item){
  return '<tr><td>'+tpDate(item.issuedAt)+'</td><td>'+tpMoney(item.amount)+'</td><td>'+tpEscape(item.note||"—")+'</td></tr>';
 });
 var current=tpGetPeriod(tpMonth(0)),ded=current.deductions[emp.id]||{},
  repaid=Number(ded.loanRepayment)||0;
 return '<div class="tp-office-loan-profile"><h3>Optional Office Loan</h3>'+
  '<div class="tp-note"><strong>Loan remaining to repay: '+tpMoney(amount)+'</strong>'+
  '<p>Interest-free. Unlike a monthly <strong>Advance</strong>, a loan stays attached to this employee until repaid or waived.</p>'+
  '<p>This month deducted from salary: <strong>'+tpMoney(repaid)+'</strong> through Other deductions. Monthly repayment setting: <strong>'+tpMoney(emp.officeLoanMonthlyDeduction||0)+'</strong>.</p></div>'+
  (emp.active!==false&&!emp.left?
   '<div class="tp-form-grid tp-office-loan-forms">'+
   '<form id="tp-office-loan-issue-form" class="tp-form" data-id="'+tpEscape(emp.id)+'">'+
   '<h4>Add a loan (optional)</h4><div class="tp-field"><label for="tp-office-loan-amount">Loan amount (₹)</label>'+
   '<input id="tp-office-loan-amount" type="number" min="1" max="10000000" step="1" inputmode="numeric" required placeholder="e.g. 20000"></div>'+
   '<div class="tp-field"><label for="tp-office-loan-note">Note</label><input id="tp-office-loan-note" maxlength="120" placeholder="Optional reason"></div>'+
   '<div class="tp-actions"><button type="submit" class="tp-button tp-primary">Add Office Loan</button></div></form>'+
   '<form id="tp-office-loan-repayment-form" class="tp-form" data-id="'+tpEscape(emp.id)+'">'+
   '<h4>Monthly loan deduction</h4><div class="tp-field"><label for="tp-office-loan-deduction">Deduct each month (₹)</label>'+
   '<input id="tp-office-loan-deduction" type="number" min="0" max="10000000" step="1" inputmode="numeric" required value="'+tpRupees(emp.officeLoanMonthlyDeduction)+'"></div>'+
   '<small>Set 0 to pause. Repayments automatically reduce salary in each month with attendance, up to the remaining loan and salary payable. Separate from Advance.</small>'+
   '<div class="tp-actions"><button type="submit" class="tp-button tp-primary">Save Monthly Deduction</button></div></form></div>':'')+
  (history.length?'<h4>Loans issued</h4>'+tpTable(["Date","Loan amount","Note"],history):'<p class="tp-note">No office loan has been issued.</p>')+
  '</div>';
}
function tpEmployeeProfile(emp){
 var changes=(tpData.salaryChanges||[]).filter(function(c){return c.employeeId===emp.id;}).slice().reverse();
 return'<section class="tp-panel tp-profile"><div class="tp-profile-head">'+tpAvatar(emp,"large")+'<div><span class="tp-eyebrow">EMPLOYEE PROFILE</span><h3>'+tpEscape(emp.name)+'</h3><p>'+tpEscape(emp.designation)+'</p></div><button type="button" class="tp-x" data-tp-action="close-profile" aria-label="Close employee profile">×</button></div>'+
 '<div class="tp-profile-grid"><div><small>Restaurant</small><strong>'+tpEscape(emp.restaurant)+'</strong></div><div><small>Joining date</small><strong>'+tpDate(emp.joined)+'</strong></div><div><small>Employee type</small><strong>'+(tpIsParcel(emp)?'Parcel Boy (commission)':'Salaried')+'</strong></div><div><small>Payment method</small><strong>'+tpEscape(emp.method)+'</strong></div><div><small>'+(tpIsParcel(emp)?'GST on commission':'Monthly salary for '+tpEscape(tpPeriod))+'</small><strong>'+(tpIsParcel(emp)?tpEscape(emp.commissionGstRate??5)+'%':tpMoney(tpMonthSalary(emp,tpPeriod)))+'</strong></div><div><small>Aadhaar (masked)</small><strong>'+(emp.aadhaarLast4?'XXXX XXXX '+tpEscape(emp.aadhaarLast4):'Not provided')+'</strong></div></div>'+
 '<div class="tp-note">'+(tpIsParcel(emp)?'Commission-only employee: enter daily or monthly total in Attendance. GST is the only deduction.':'Earned paid leave: 1 day per '+tpData.settings.leaveEarnEveryDays+' days worked, up to '+emp.leaveAllowance+' paid leave days.')+'</div>'+
 '<div class="tp-actions tp-profile-actions">'+(emp.active===false?
 tpButton("restore-employee","Restore employee","tp-primary",'data-id="'+tpEscape(emp.id)+'"'):
 tpButton("edit-employee","Edit profile","tp-primary",'data-id="'+tpEscape(emp.id)+'"')+
 '<details class="tp-profile-more"><summary>More actions <span aria-hidden="true">⌄</span></summary>'+
 '<div class="tp-profile-menu">'+tpButton("delete-employee","Delete Employee","tp-danger",'data-id="'+tpEscape(emp.id)+'"')+
 '</div></details>')+
 tpButton("close-profile","Close","tp-light")+'</div>'+
 tpOfficeLoanProfile(emp)+
 (tpIsParcel(emp)?'':'<div class="tp-salary-log"><h3>Salary Change History</h3>'+
 (changes.length?tpTable(["Effective month","Previous salary","New salary","Change","Entered from"],changes.map(function(c){
  var diff=Number(c.newSalary)-Number(c.previousSalary);
  return'<tr><td>'+tpEscape(tpMonthLabel(c.effectiveMonth))+'</td><td>'+tpMoney(c.previousSalary)+'</td>'+
  '<td>'+tpMoney(c.newSalary)+'</td><td>'+tpEscape(diff>=0?"+":"−")+tpMoney(Math.abs(diff))+'</td><td>'+tpEscape(c.source||"Profile")+'</td></tr>';
 })):'<p class="tp-note">No recorded salary changes yet. Changes entered from Employee Management or Attendance appear here.</p>')+'</div>')+'</section>';
}
function tpEmployeeForm(emp){
 var values=emp||{id:"",name:"",designation:"",joined:tpToday(),restaurant:(typeof selected!=="undefined"?(data.restaurants.find(function(r){return r.id===selected&&r.active!==false;})||{}).name:null)||(data.restaurants.find(function(r){return r.active!==false;})||{}).name||"Pritam Fast Food",salary:1800000,leaveAllowance:2,method:"CASH",photo:"",employeeType:"salaried",commissionGstRate:5};
 var parcel=tpIsParcel(values);
 var options=(data.restaurants||[]).filter(function(r){return r.active!==false;}).map(function(r){return r.name;});
 if(values.restaurant&&!options.includes(values.restaurant))options.push(values.restaurant);
 if(!options.length)options=["Pritam Fast Food"];
 var pic=tpPhoto!==null?tpPhoto:values.photo;
 var out='<section class="tp-panel tp-form-panel"><div class="tp-header-row"><div><h3>'+(emp?"Edit employee":"Add employee")+'</h3>'+
 '</div>'+
 '<button type="button" class="tp-x" data-tp-action="cancel-employee" aria-label="Close form">×</button></div>'+
 '<form id="tp-employee-form" class="tp-form" data-employee-type="'+(parcel?"parcel":"salaried")+'">'+
 '<div class="tp-photo-box">'+(pic?'<img class="tp-form-photo" src="'+tpEscape(pic)+'" alt="Employee photo">':'<div class="tp-photo-placeholder">Photo</div>')+
 '<div><label for="tp-photo">Employee photo (optional)</label><input type="file" id="tp-photo" accept="image/jpeg,image/png,image/webp"><small>Stored only on this device.</small></div></div>'+
 '<div class="tp-form-grid">'+
 '<div class="tp-field"><label for="tp-name">Employee name *</label><input id="tp-name" name="name" required maxlength="90" value="'+tpEscape(values.name)+'" placeholder="Full name"></div>'+
 '<div class="tp-field"><label for="tp-employee-type">Employee type *</label><select id="tp-employee-type" name="employeeType" '+(emp?'disabled title="Employee type is fixed after creation to keep past payroll consistent"':'')+'>'+
 '<option value="salaried" '+(!parcel?'selected':'')+'>Salaried employee</option>'+
 '<option value="parcel" '+(parcel?'selected':'')+'>Parcel Boy (commission)</option></select>'+
 ''+'</div>'+
 '<div class="tp-field tp-salaried-only"><label for="tp-role">Designation *</label><input id="tp-role" name="designation" list="tp-role-suggestions" autocomplete="off" '+(!parcel?'required':'disabled')+' maxlength="90" value="'+tpEscape(values.designation)+'" placeholder="Type ek ch or a designation">'+
 '<small>Enter a shortcut such as <strong>ek ch</strong>, then press Enter or Tab.</small>'+
 '<datalist id="tp-role-suggestions">'+tpDesignationList().map(function(item){return'<option value="'+tpEscape(item.code)+'" label="'+tpEscape(item.title)+'"></option>';}).join("")+'</datalist></div>'+
 '<div class="tp-field tp-salaried-only"><label for="tp-role-pick">Quick select designation</label>'+
 '<select id="tp-role-pick" '+(parcel?'disabled':'')+'><option value="">Select a saved designation (optional)</option>'+
 tpDesignationList().slice().sort(function(a,b){return a.title.localeCompare(b.title);}).map(function(item){
  return'<option value="'+tpEscape(item.code)+'">'+tpEscape(item.code)+' — '+tpEscape(item.title)+'</option>';
 }).join("")+'</select>'+
 '<small>Create or change shortcuts in Payroll → Settings → Designation Shortcuts.</small></div>'+
 '<div class="tp-field"><label for="tp-joined">Joining date *</label><input id="tp-joined" name="joined" type="date" required value="'+tpEscape(values.joined)+'"></div>'+
 (emp?'<div class="tp-field"><label>Current outlet</label><strong>'+tpEscape(values.restaurant)+'</strong><input type="hidden" name="restaurant" value="'+tpEscape(values.restaurant)+'"><small>Use Transfer Employee on the profile to change outlets and preserve transfer history.</small></div>':
 '<div class="tp-field"><label for="tp-restaurant">Restaurant *</label><select id="tp-restaurant" name="restaurant">'+options.map(function(name){return'<option value="'+tpEscape(name)+'" '+(name===values.restaurant?'selected':'')+'>'+tpEscape(name)+'</option>';}).join("")+'</select></div>')+
 '<div class="tp-field"><label for="tp-method">Payment method *</label><select id="tp-method" name="method"><option value="CASH" '+(values.method==="CASH"?"selected":"")+'>CASH</option><option value="CHEQUE" '+(values.method==="CHEQUE"?"selected":"")+'>CHEQUE</option></select></div>'+
 '<div class="tp-field"><label for="tp-aadhaar">Aadhaar number (optional)</label><input id="tp-aadhaar" name="aadhaar" type="text" inputmode="numeric" maxlength="12" autocomplete="off" pattern="([0-9]{4}|[0-9]{12})" value="'+tpEscape(values.aadhaarLast4||"")+'" placeholder="4 or 12 digits"><small>For privacy, only the last 4 digits are saved on this device. The full Aadhaar number is never stored in this demo.</small></div>'+
 (emp?'<div class="tp-field tp-salaried-only"><label>Current monthly salary</label><strong>'+tpMoney(tpMonthSalary(emp,tpPeriod))+'</strong><small>To change it, open the employee profile and enter the new salary there.</small></div>':
 '<div class="tp-field tp-salaried-only"><label for="tp-salary">Starting monthly salary (₹) *</label><input id="tp-salary" name="salary" inputmode="numeric" '+(!parcel?'required':'disabled')+' value="'+(parcel?"0":tpRupees(values.salary))+'"></div>')+
 '<div class="tp-field tp-salaried-only"><label for="tp-leaves">Maximum paid leave days per month *</label><input id="tp-leaves" name="leaveAllowance" type="number" min="0" max="31" step="1" '+(!parcel?'required':'disabled')+' value="'+tpEscape(values.leaveAllowance||0)+'"></div>'+
 '<div class="tp-field tp-parcel-only"><label for="tp-parcel-gst">GST deducted from commissions (%)</label><input id="tp-parcel-gst" name="commissionGstRate" type="number" min="0" max="100" step="0.01" inputmode="decimal" '+(parcel?'required':'disabled')+' value="'+tpEscape(values.commissionGstRate==null?5:values.commissionGstRate)+'">'+
 '<small>Default 5%, as in your commission sheet. This is a demo deduction rate, not tax advice.</small></div></div>'+

 
 '<div class="tp-actions"><button class="tp-button tp-primary" type="submit">'+(emp?"Save employee":"Add employee")+'</button>'+tpButton("cancel-employee","Cancel","tp-light")+'</div></form></section>';
 return out;
}
function tpDesignationsPage(){
 var rows=tpDesignationList().slice().sort(function(a,b){return a.code.localeCompare(b.code);});
 var editing=tpDesignationEditing?tpDesignationFind(tpDesignationEditing):null;
 var out='<section class="tp-panel" id="tp-designation-settings">'+tpToolbar("Designation Shortcuts",
  'Add, edit, or delete your own codes for employee designations.',tpButton("go-employees","Open Employees","tp-light"))+
 '<form id="tp-designation-form" class="tp-designation-form">'+
 '<div class="tp-field"><label for="tp-designation-code">Shortcut code *</label>'+
 '<input id="tp-designation-code" name="shortcut" maxlength="20" required autocomplete="off" placeholder="e.g. ek ch" value="'+tpEscape(editing?editing.code:"")+'">'+
 '</div>'+
 '<div class="tp-field"><label for="tp-designation-title">Full designation *</label>'+
 '<input id="tp-designation-title" name="title" maxlength="90" required autocomplete="off" placeholder="e.g. Chinese Helper" value="'+tpEscape(editing?editing.title:"")+'"></div>'+
 '<div class="tp-actions"><button class="tp-button tp-primary" type="submit">'+(editing?"Save Changes":"+ Add Designation")+'</button>'+
 (editing?tpButton("cancel-designation","Cancel","tp-light"):"")+'</div></form>'+
 '<div class="tp-designation-count">'+rows.length+' saved shortcuts · Your changes are saved on this device</div>'+
 tpTable(["Shortcut","Full designation","Actions"],rows.map(function(item){
  return'<tr><td><code class="tp-shortcode">'+tpEscape(item.code)+'</code></td><td><strong>'+tpEscape(item.title)+'</strong></td>'+
  '<td><div class="tp-actions">'+tpButton("edit-designation","Edit","tp-light",'data-code="'+tpEscape(item.code)+'"')+
  tpButton("delete-designation","Delete","tp-danger",'data-code="'+tpEscape(item.code)+'"')+'</div></td></tr>';
 }))+'</section>';
 return out;
}
function tpEmployeesPage(){
 var emps=tpEmployees(false),deleted=tpData.employees.filter(function(emp){return emp.active===false;});
 var out='<section class="tp-panel">'+tpToolbar("Employee Management",emps.length+" active employees · "+deleted.length+" deleted employees",tpButton("new-employee","+ Add Employee","tp-primary"))+
 '<div class="tp-employee-grid">'+emps.map(function(emp){
 return'<article class="tp-person">'+tpAvatar(emp)+'<div class="tp-person-main"><h3>'+tpEscape(emp.name)+'</h3><p>'+tpEscape(emp.designation)+'</p><small>'+tpEscape(emp.restaurant)+'</small></div><div class="tp-person-extra"><strong>'+(tpIsParcel(emp)?'Parcel Boy · Commission':tpMoney(emp.salary))+'</strong><small>'+(tpIsParcel(emp)?'GST '+tpEscape(emp.commissionGstRate??5)+'%':tpEscape(emp.leaveAllowance)+' max paid leave days')+'</small>'+tpBadge(emp.method,emp.method==="CASH")+'</div><div class="tp-person-buttons">'+tpButton("view-employee","View","tp-light",'data-id="'+tpEscape(emp.id)+'"')+
 tpButton("edit-employee","Edit","tp-light",'data-id="'+tpEscape(emp.id)+'"')+
 tpButton("delete-employee","Delete","tp-danger",'data-id="'+tpEscape(emp.id)+'"')+'</div></article>';
 }).join("")+'</div>'+(emps.length===0?'<div class="tp-note">No active employees. Add an employee or restore one from Deleted Employees.</div>':"")+'</section>';
 if(deleted.length){
  out+='<details class="tp-panel tp-deleted-people"><summary>Deleted Employees ('+deleted.length+') · Restore</summary><p class="tp-note">Deleted employees are removed from active payroll and attendance. Their previous monthly data is preserved so they can be restored.</p>'+
   '<div class="tp-deleted-list">'+deleted.map(function(emp){return'<div class="tp-deleted-row">'+tpAvatar(emp,"small")+'<div><strong>'+tpEscape(emp.name)+'</strong><small>'+tpEscape(emp.designation)+'</small></div>'+
    tpButton("restore-employee","Restore","tp-light",'data-id="'+tpEscape(emp.id)+'"')+'</div>';}).join("")+'</div></details>';
 }
 if(tpEditing!==null)out=tpEmployeeForm(tpEditing==="new"?null:tpEmp(tpEditing))+out;
 else if(tpViewing){var emp=tpEmp(tpViewing);if(emp)out=tpEmployeeProfile(emp)+out;}
 return out;
}
function totalsFineOther(rows){return rows.reduce(function(sum,r){return sum+(Number(r.deductions.fine)||0)+(Number(r.deductions.other)||0);},0);}
function tpAdvances(){
 var rows=tpRows().filter(function(r){return !tpIsParcel(r.emp);}),total=tpTotals(rows);
 var balanceTotal=rows.reduce(function(sum,r){return sum+tpLoanBalance(r.emp);},0);
 var out='<div class="tp-stats tp-stats-three">'+tpCard("Monthly salary advances",tpMoney(total.adv),"Deducted from salary","₹")+
  tpCard("Optional loans outstanding",tpMoney(balanceTotal),"Managed in Employee Profiles","↘")+
  tpCard("Other deductions",tpMoney(totalsFineOther(rows)),"Includes scheduled loan repayments","▤")+'</div>';
 out+='<section class="tp-panel">'+tpToolbar("Advance Management","Monthly salary advances are deducted this month. Optional interest-free loans can be issued and repaid from each Employee Profile.",tpButton("print-advance","Print Distribution Sheet","tp-primary")+tpButton("pdf-advance","Download PDF","tp-light"))+
  '<div class="tp-note"><strong>Advance:</strong> deducted from this month’s salary. An <strong>optional office loan</strong> has a separate balance and custom monthly repayment in Employee Profile. Empty fields save as 0. Press Enter for the next Advance.</div>';
 out+=tpTable(["Monthly ID","Employee / designation","Advance (₹)","Fine (₹)","Other deduction (₹)","Office loan remaining (₹)"],rows.map(function(r){
  var id=tpEscape(r.emp.id),loanPart=Number(r.deductions.loanRepayment)||0;
  return'<tr data-tp-adv-row="'+id+'"><td><strong>'+(r.serial===null?"—":r.serial)+'</strong></td><td><div class="tp-person-cell">'+tpAvatar(r.emp,"small")+'<div><strong>'+tpEscape(r.emp.name)+'</strong><small>'+tpEscape(r.emp.designation)+'</small></div></div></td>'+
  '<td><input class="tp-cell-input" data-tp-field="advance" data-id="'+id+'" inputmode="numeric" enterkeyhint="next" value="'+tpRupees(r.advance.kind==="office-loan"?0:r.advance.amount)+'"></td>'+
  '<td><input class="tp-cell-input" inputmode="numeric" data-tp-field="fine" data-id="'+id+'" value="'+tpRupees(r.deductions.fine)+'"></td>'+
  '<td><input class="tp-cell-input" inputmode="numeric" data-tp-field="other" data-id="'+id+'" value="'+tpRupees(Math.max(0,(Number(r.deductions.other)||0)-loanPart))+'"></td>'+
  '<td><strong>'+tpMoney(tpLoanBalance(r.emp))+'</strong><small> · Repaid '+tpMoney(loanPart)+' this month</small></td></tr>';
 }))+'<div class="tp-note">✓ Changes save automatically on this device. No money is transferred.</div></section>';
 return out;
}
function tpCommissionEditor(emp){
 var p=tpGetPeriod(),rec=tpCommissionRecord(p,emp)||{},mode=rec.mode==="daily"?"daily":"total";
 var rate=rec.gstRate==null?(emp.commissionGstRate==null?5:emp.commissionGstRate):rec.gstRate;
 var calc=tpCommissionCalculate(emp,p),total=calc?calc.commissionTotal:0;
 var head='<section class="tp-panel tp-commission-editor" id="tp-commission-editor"><div class="tp-header-row"><div>'+
 '<h2>Parcel Boy Commission — '+tpEscape(emp.name)+'</h2><p>'+tpMonthLabel(tpPeriod)+' · Monthly total is the default entry method</p></div>'+
 tpButton("close-commission","Close","tp-light")+'</div>'+
 '<div class="tp-note">Enter the commission amounts earned from bills, not total bill sales. Monthly commission total is selected by default; 30 daily entries remain optional. GST defaults to 5%.</div>'+
 '<div class="tp-form-grid">'+
 '<div class="tp-field"><label for="tp-commission-mode">Entry method</label><select id="tp-commission-mode" data-tp-field="commissionMode" data-id="'+tpEscape(emp.id)+'">'+
 '<option value="total" '+(mode==="total"?"selected":"")+'>Monthly commission total (default)</option>'+
 '<option value="daily" '+(mode==="daily"?"selected":"")+'>30 daily entries</option></select></div>'+
 '<div class="tp-field"><label for="tp-commission-gst">GST deduction (%)</label><input class="tp-cell-input" id="tp-commission-gst" type="number" step="0.01" min="0" max="100" inputmode="decimal" data-tp-field="commissionGST" data-id="'+tpEscape(emp.id)+'" value="'+tpEscape(rate)+'"></div></div>';
 var daily=Array.isArray(rec.daily)?rec.daily:[];
 if(mode==="daily"){
  head+='<div class="tp-commission-days"><div class="tp-commission-cols"><strong>Date</strong><strong>Commission (₹)</strong></div>'+
  Array.from({length:30},function(_,i){
   var v=daily[i],val=v===null||v===undefined?"0":tpRupees(v);
   return'<div class="tp-commission-day"><label for="tp-commission-day-'+(i+1)+'">Day '+(i+1)+'</label>'+
    '<input id="tp-commission-day-'+(i+1)+'" aria-label="Day '+(i+1)+' commission" class="tp-cell-input" data-tp-field="commissionDaily" data-id="'+tpEscape(emp.id)+'" data-day="'+(i+1)+'" type="text" inputmode="decimal" enterkeyhint="'+(i===29?"done":"next")+'" placeholder="0" value="'+tpEscape(val)+'"></div>';
  }).join("")+'</div>';
 }else{
  head+='<div class="tp-field tp-commission-total-field"><label for="tp-commission-total">Total commission earned (₹)</label>'+
  '<input id="tp-commission-total" class="tp-cell-input" inputmode="decimal" type="text" placeholder="e.g. 31202" data-tp-field="commissionTotal" data-id="'+tpEscape(emp.id)+'" value="'+(rec.total===null||rec.total===undefined?"0":tpRupees(rec.total))+'">'+
  '<small>Enter the monthly total directly. Only GST will be deducted.</small></div>';
 }
 head+='<div class="tp-commission-summary"><div><span>Total commission</span><strong>'+tpMoney(total)+'</strong></div>'+
 '<div><span>GST ('+tpEscape(rate)+'%)</span><strong>− '+tpMoney(calc?calc.gst:0)+'</strong></div>'+
 '<div class="tp-commission-pay"><span>Payable amount</span><strong>'+tpMoney(calc?calc.net:0)+'</strong></div></div>'+
 '<div class="tp-note">Only the selected entry method is used in calculations. Switching methods keeps previously entered daily and total values separately, so you can switch back without losing them.</div>'+
 '<div class="tp-actions">'+tpButton("pdf-parcel","Download Parcel Boy PDF","tp-light",'data-id="'+tpEscape(emp.id)+'"')+'</div></section>';
 return head;
}
function tpAttendance(){
 var all=tpRows(),rows=all.filter(function(r){return !tpIsParcel(r.emp);}),
 parcelRows=all.filter(function(r){return tpIsParcel(r.emp);}),
 entered=rows.filter(function(r){return tpInputDays(r.worked)!==null;});
 var worked=entered.reduce(function(sum,r){return sum+Number(r.worked||0);},0);
 var assigned=rows.filter(function(r){return r.serial!==null;}).length,filter=tpIdRange;
 var visible=rows.filter(function(r){
  if(filter==="unassigned")return r.serial===null;
  if(filter==="all")return true;
  if(filter==="101+")return r.serial!==null&&r.serial>=101;
  var bounds=filter.split("-").map(Number);
  return r.serial!==null&&r.serial>=bounds[0]&&r.serial<=bounds[1];
 });
 var out='<div class="tp-stats tp-stats-three">'+
 tpCard("Salaried employees",String(rows.length),"Standard monthly attendance","♙")+
 tpCard("Salaried IDs assigned",assigned+' / '+rows.length,"Unique within this restaurant each month","▤")+
 tpCard("Attendance recorded",String(rows.filter(function(r){return r.calc!==null;}).length),"Salaried employees this month","✓")+'</div>';
 out+='<section class="tp-panel">'+tpToolbar("Monthly Attendance",tpMonthLabel(tpPeriod)+' · Salaried employee days only.',tpButton("pdf-attendance","Download Attendance PDF","tp-light")+tpButton("go-sheets","View Payment Sheets","tp-primary"))+
 '<div class="tp-note">Assign each salaried employee a monthly ID (1, 2, 3, …), unique only within this restaurant for the selected month, and enter actual days worked. Update salaries in Payroll Settings → Salary Increases. Extra paid leave is excluded. Parcel boys have a separate commission editor below and <strong>will not interrupt pressing Enter between salaried employees.</strong></div>'+
 '<div class="tp-field tp-att-filter"><label for="tp-id-filter">Filter monthly ID</label><select id="tp-id-filter">'+
 [['all','All IDs — ascending'],['1-25','1–25'],['26-50','26–50'],['51-75','51–75'],['76-100','76–100'],['101+','101 and above'],['unassigned','Unassigned IDs']].map(function(opt){
  return'<option value="'+opt[0]+'" '+(filter===opt[0]?'selected':'')+'>'+opt[1]+'</option>';
 }).join("")+'</select></div>'+
 tpTable(["Monthly ID","Employee / designation","Days worked"],visible.map(function(r,i){
  var id=tpEscape(r.emp.id);
  return'<tr data-tp-attendance-row="'+id+'"><td><input aria-label="Monthly ID for '+tpEscape(r.emp.name)+'" class="tp-serial-input" type="number" inputmode="numeric" min="1" step="1" placeholder="1, 2, 3…" data-tp-field="serial" data-id="'+id+'" enterkeyhint="next" value="'+(r.serial===null?"":r.serial)+'"></td>'+
  '<td><div class="tp-person-cell">'+tpAvatar(r.emp,"small")+'<div><strong>'+tpEscape(r.emp.name)+'</strong><small>'+tpEscape(r.emp.designation)+'</small></div></div></td>'+
  
  '<td><input aria-label="Days worked for '+tpEscape(r.emp.name)+'" class="tp-days-input" type="number" inputmode="decimal" min="0" max="30" step="0.5" placeholder="e.g. 27" data-tp-field="days" data-id="'+id+'" enterkeyhint="'+(i===visible.length-1?"done":"next")+'" value="'+tpEscape(r.worked==null?"":r.worked)+'"><small class="tp-days-hint">Worked days only</small></td></tr>';
 }))+
 '<div class="tp-note">Press Enter to save and move to the next salaried employee. Monthly IDs and rates are saved for history.</div></section>';
 if(parcelRows.length){
  out+='<section class="tp-panel"><div class="tp-header-row"><div><h2>Parcel Boys · Commission</h2>'+
  '<p>Open only the parcel boy you want to enter. The 30-day commission form stays closed otherwise.</p></div></div>'+
  tpTable(["Monthly ID","Parcel boy","Entry mode","Commission / GST / Net","Action"],parcelRows.map(function(r){
   var rec=tpCommissionRecord(tpGetPeriod(),r.emp),c=r.calc;
   return'<tr><td><input class="tp-serial-input" type="number" inputmode="numeric" min="1" step="1" data-tp-field="parcelSerial" data-id="'+tpEscape(r.emp.id)+'" value="'+(r.serial===null?"":r.serial)+'" placeholder="1, 2, 3…"></td><td><strong>'+tpEscape(r.emp.name)+'</strong><div class="sub">'+tpEscape(r.emp.designation)+'</div></td>'+
   '<td>'+tpEscape(rec?(rec.mode==="total"?"Monthly total":"30 daily rows"):"Not entered")+'</td>'+
   '<td>'+(c?tpMoney(c.commissionTotal)+' / '+tpMoney(c.gst)+' / <strong>'+tpMoney(c.net)+'</strong>':'No commission entered')+'</td>'+
   '<td>'+tpButton("open-commission","Enter Commission","tp-primary",'data-id="'+tpEscape(r.emp.id)+'"')+'</td></tr>';
  }))+'</section>';
  var open=parcelRows.find(function(r){return r.emp.id===tpCommissionOpen;});
  if(open)out+=tpCommissionEditor(open.emp);
 }
 return out;
}
function tpSalary(){
 var all=tpRows(),rows=all.filter(function(r){return !tpIsParcel(r.emp);}),parcelRows=all.filter(function(r){return tpIsParcel(r.emp);}),total=tpTotals(all);
 var out='<div class="tp-stats tp-stats-three">'+tpCard("Net salary calculated",tpMoney(total.grand),total.ready+" of "+all.length+" employees completed","₹")+
 tpCard("Leave money added",tpMoney(total.leavePay),"Earned paid leave credits","+")+
 tpCard("Advances deducted",tpMoney(total.advPaid),"Entered advance amounts","↘")+'</div>';
 out+='<section class="tp-panel">'+tpToolbar("Salary Calculator","Enter only salaried employee days; parcel boys have their own commission calculations.",tpButton("go-attendance","Open Attendance","tp-light")+tpButton("go-sheets","View Payment Sheets","tp-primary"))+
 '<div class="tp-note"><strong>Fixed 30-day calculation for every month, including January and February:</strong> working salary = monthly salary ÷ 30 × days worked. Leave pay = monthly salary ÷ 30 × earned leave days. Net = working pay + leave pay − advance − fines − other deductions.</div>'+
 tpTable(["Monthly ID","Employee / designation","Monthly salary","Days worked","Working salary","Leave money","Advance","Fine + other","Net salary"],rows.map(function(r,i){
 var id=tpEscape(r.emp.id),c=r.calc,advance=Number(r.advance.amount)||0;
 var ded=(Number(r.deductions.fine)||0)+(Number(r.deductions.other)||0);
 return'<tr data-tp-salary-row="'+id+'"><td><strong>'+(r.serial===null?"—":r.serial)+'</strong></td>'+
 '<td><div class="tp-person-cell">'+tpAvatar(r.emp,"small")+'<div><strong>'+tpEscape(r.emp.name)+'</strong><small>'+tpEscape(r.emp.designation)+' · max '+r.emp.leaveAllowance+' leave days</small></div></div></td>'+
 '<td>'+tpMoney(r.salary)+'</td>'+
 '<td><input aria-label="Days worked for '+tpEscape(r.emp.name)+'" class="tp-days-input" type="number" inputmode="decimal" min="0" max="30" step="0.5" placeholder="e.g. 27" data-tp-field="days" data-id="'+id+'" enterkeyhint="'+(i===rows.length-1?"done":"next")+'" value="'+tpEscape(r.worked==null?"":r.worked)+'"><small class="tp-days-hint">0–30, half days allowed</small></td>'+
 '<td data-tp-salary-value="gross">'+(c?tpMoney(c.gross):"Enter days")+'</td>'+
 '<td data-tp-salary-value="leave">'+(c?c.leaveEarned+' d · '+tpMoney(c.leavePay):"—")+'</td>'+
 '<td>'+tpMoney(advance)+'</td><td>'+tpMoney(ded)+'</td>'+
 '<td><strong data-tp-salary-value="net">'+(c?tpMoney(c.net):"—")+'</strong>'+(c&&c.shortfall?'<small class="tp-warning">Excess deductions '+tpMoney(c.shortfall)+'</small>':"")+'</td></tr>';
 }))+'<div class="tp-note">Enter moves only between salaried employees. Parcel boys are handled in a separate commission entry screen, never in the days-worked Enter sequence.</div></section>';
 if(parcelRows.length){
  out+='<section class="tp-panel">'+tpToolbar("Parcel Boy Commissions",tpMonthLabel(tpPeriod)+" · GST is the only deduction",tpButton("go-attendance","Open Commission Entry","tp-primary"))+
   tpTable(["Monthly ID","Parcel Boy","Commission","GST","Net payable"],parcelRows.map(function(r){
    var c=r.calc;
    return'<tr><td>'+(r.serial===null?"—":r.serial)+'</td><td><strong>'+tpEscape(r.emp.name)+'</strong></td>'+
      '<td>'+(c?tpMoney(c.commissionTotal):"Not entered")+'</td><td>'+(c?tpMoney(c.gst):"—")+'</td>'+
      '<td><strong>'+(c?tpMoney(c.net):"—")+'</strong></td></tr>';
   }))+"</section>";
 }
 return out;
}

function tpSheetBreakdown(row){
 var c=row.calc,parcel=tpIsParcel(row.emp);
 function line(label,value,major){
  return '<div class="tp-sheet-breakdown-line'+(major?' tp-sheet-breakdown-major':'')+'"><span>'+tpEscape(label)+'</span><strong>'+tpEscape(value)+'</strong></div>';
 }
 var out='<div class="tp-sheet-breakdown"><h3>Calculation for '+tpEscape(row.emp.name)+'</h3>'+
  '<p class="tp-note">'+tpEscape(tpMonthLabel(tpPeriod))+' · '+tpEscape(row.emp.restaurant)+' · '+
  (row.serial===null?'Monthly ID not assigned':'Monthly ID '+row.serial)+' · '+tpEscape(row.emp.method)+'</p>';
 if(parcel){
  out+=line("Monthly commission",c?tpMoney(c.commissionTotal):"Enter commission in Attendance")+
   line("GST rate",c?String(c.gstRate)+"%":String(row.emp.commissionGstRate??5)+"%")+
   line("GST deducted",c?tpMoney(c.gst):"—")+
   line("Net payable",c?tpMoney(c.net):"Not calculated",true);
 }else{
  out+=line("Monthly salary",tpMoney(row.salary))+
   (c&&Number.isSafeInteger(c.proratedMonthly)?line("Effective salary for mid-month increment",tpMoney(c.proratedMonthly)):"")+
   line("Days worked",c?String(c.days):"Enter days in Attendance")+
   line("Salary basis","Monthly salary ÷ 30 × days worked")+
   line("Working salary",c?tpMoney(c.gross):"—")+
   line("Earned paid leave days",c?String(c.leaveEarned):"—")+
   line("Leave pay",c?tpMoney(c.leavePay):"—")+
   line("Gross earnings",c?tpMoney(c.earned):"—")+
   line("Salary advance deducted",tpMoney(c?c.paidAdvance:0))+
    (Number(row.deductions.loanRepayment)?line("Office loan repayment",tpMoney(row.deductions.loanRepayment)):"")+
   line("Fine deducted",tpMoney(Number(row.deductions.fine)||0))+
   line("Other deductions",tpMoney(Math.max(0,(Number(row.deductions.other)||0)-(Number(row.deductions.loanRepayment)||0))))+
   line("Net salary payable",c?tpMoney(c.net):"Awaiting Attendance",true)+
   (c&&c.shortfall?'<p class="tp-warning">Deductions exceed earnings by '+tpMoney(c.shortfall)+'. Net payable is capped at zero.</p>':"");
 }
 return out+'</div>';
}
function tpSheetDetailRow(row,columns){
 if(tpCalculationOpenId!==row.emp.id)return '';
 return '<tr class="tp-sheet-calculation-row" id="tp-sheet-calculation-'+tpEscape(row.emp.id)+'"><td colspan="'+columns+'">'+tpSheetBreakdown(row)+'</td></tr>';
}
var tpSheetCSS=document.createElement("style");
tpSheetCSS.textContent=".tp-sheet-calculation-row>td{background:#f2f8f6!important;padding:15px 22px!important}.tp-sheet-breakdown{max-width:800px;border-left:3px solid #168a70;padding:12px 15px;background:#fff;border-radius:9px}.tp-sheet-breakdown h3{margin:0 0 7px;font-size:1.05rem}.tp-sheet-breakdown .tp-note{margin:0 0 13px}.tp-sheet-breakdown-line{display:flex;justify-content:space-between;gap:20px;border-top:1px solid #e7eeea;padding:8px 2px;font-size:.93rem}.tp-sheet-breakdown-line span{color:#4a6670}.tp-sheet-breakdown-line strong{text-align:right}.tp-sheet-breakdown-major{border-top:2px solid #168a70;font-size:1.03rem;color:#0c6b58}.tp-sheet-breakdown-major span{font-weight:700;color:inherit}";
document.head.appendChild(tpSheetCSS);

function tpSheets(){
 var rows=tpRows(),t=tpTotals(rows);
 var out='<div class="tp-stats tp-stats-three">'+tpCard("Total cash payable",tpMoney(t.cash),"Cash salary distribution","₹")+
 tpCard("Total cheque payable",tpMoney(t.cheque),"Cheque salary distribution","▤")+
 tpCard("Grand total",tpMoney(t.grand),"Cash and cheque combined","✓")+'</div>';
 out+='<div class="tp-two tp-sheets-layout">';
 ["CASH","CHEQUE"].forEach(function(method){
  var matches=rows.filter(function(r){return r.emp.method===method;}),sum=matches.reduce(function(n,r){return n+(r.calc?r.calc.net:0);},0);
  out+='<section class="tp-panel"><div class="tp-sheet-title"><div><span class="tp-eyebrow">'+method+' PAYROLL</span><h2>'+method+' SHEET</h2><p>'+tpMonthLabel(tpPeriod)+'</p></div><span class="tp-sheet-symbol">'+(method==="CASH"?"₹":"▤")+'</span></div>'+
  '<div class="tp-actions tp-sheet-actions">'+tpButton("print-"+method.toLowerCase(),"Print "+method+" Sheet","tp-primary")+tpButton("pdf-"+method.toLowerCase(),"Download PDF","tp-light")+'</div>'+
  tpTable(["Monthly ID","Employee","Designation","Net payable","Calculation"],matches.map(function(r){
   var id=tpEscape(r.emp.id),opened=tpCalculationOpenId===r.emp.id;
   return'<tr><td><strong>'+(r.serial===null?"—":r.serial)+'</strong></td><td><strong>'+tpEscape(r.emp.name)+'</strong></td>'+
    '<td>'+tpEscape(r.emp.designation)+(tpIsParcel(r.emp)?'<small class="tp-parcel-sheet-desc">Parcel Boy · GST '+(r.calc?r.calc.gstRate:(r.emp.commissionGstRate??5))+'%</small>':'')+'</td>'+
    '<td><strong>'+(r.calc?tpMoney(r.calc.net):(tpIsParcel(r.emp)?"Enter commission":"Enter days"))+'</strong></td>'+
    '<td>'+tpButton("view-calculation",opened?"Hide Calculation":"View Calculation","tp-light",'data-id="'+id+'" aria-expanded="'+opened+'" aria-controls="tp-sheet-calculation-'+id+'"')+'</td></tr>'+
    tpSheetDetailRow(r,5);
  }))+'<div class="tp-sheet-total"><span>Total '+method.toLowerCase()+' payable</span><strong>'+tpMoney(sum)+'</strong></div>'+
  '<p class="tp-note">Sorted in ascending monthly ID order, separately for CASH and CHEQUE. No payment-status tracking.</p></section>';
 });
 out+='</div>';
 var parcelRows=rows.filter(function(r){return tpIsParcel(r.emp);});
 if(parcelRows.length){
  out+='<section class="tp-panel">'+tpToolbar("Parcel Boy Payment Sheet","Separate parcel commission payment sheet including GST deductions",
   tpButton("pdf-parcel","Download Parcel Boy PDF","tp-primary")+tpButton("print-parcel","Print Parcel Sheet","tp-light"))+
   tpTable(["Monthly ID","Parcel Boy","Commission","GST","Net payable","Calculation"],parcelRows.map(function(r){
    var c=r.calc,id=tpEscape(r.emp.id),opened=tpCalculationOpenId===r.emp.id;
    return'<tr><td>'+(r.serial===null?"—":r.serial)+'</td><td><strong>'+tpEscape(r.emp.name)+'</strong></td>'+
     '<td>'+(c?tpMoney(c.commissionTotal):"Not entered")+'</td><td>'+(c?tpMoney(c.gst):"—")+'</td>'+
     '<td><strong>'+(c?tpMoney(c.net):"—")+'</strong></td>'+
     '<td>'+tpButton("view-calculation",opened?"Hide Calculation":"View Calculation","tp-light",'data-id="'+id+'" aria-expanded="'+opened+'"')+'</td></tr>'+
     tpSheetDetailRow(r,6);
   }))+'</section>';
 }
 out+='<div class="tp-grand"><span>Combined cash + cheque</span><strong>'+tpMoney(t.grand)+'</strong><small>'+t.ready+' of '+rows.length+' employees calculated</small></div>';
 return out;
}
function tpHistory(){
 var months=Object.keys(tpData.periods).sort().reverse();
 var out='<section class="tp-panel">'+tpToolbar("Payroll History","Inspect monthly attendance IDs, salary changes and calculations. Download PDF sheets for any month.",tpButton("pdf-increments","Download Salary Change PDF","tp-light"))+
 '<div class="tp-history-list">'+months.map(function(month){
  var p=tpGetPeriod(month),rows=tpRows(month,true),net=0,advance=0,leaveTotal=0,completed=0;
  var table=rows.map(function(r){
   var c=r.calc,amt=c?c.net:0;
   net+=amt;advance+=Number(r.advance.amount)||0;leaveTotal+=c?c.leavePay:0;
   if(c)completed++;
   return'<tr><td><strong>'+(r.serial===null?"—":r.serial)+'</strong></td>'+
    '<td>'+tpEscape(r.emp.name)+'</td><td>'+tpEscape(r.emp.designation)+'</td>'+
    '<td>'+(tpIsParcel(r.emp)?'Parcel Boy':tpMoney(r.salary))+'</td><td>'+(tpIsParcel(r.emp)?'Commission only':tpEscape(r.worked==null?"—":r.worked))+'</td>'+
    '<td>'+(tpIsParcel(r.emp)?(c?'Commission '+tpMoney(c.commissionTotal)+' · GST '+tpMoney(c.gst):'Not entered'):(c?c.leaveEarned+" d / "+tpMoney(c.leavePay):"—"))+'</td>'+
    '<td>'+tpMoney(Number(r.advance.amount)||0)+'</td><td>'+(c?tpMoney(amt):"Not calculated")+'</td></tr>';
  });
  var changes=(tpData.salaryChanges||[]).filter(function(c){return c.effectiveMonth===month;});
  var actions='<div class="tp-actions tp-history-actions">'+
    tpButton("pdf-history-cash","Download CASH PDF","tp-light",'data-month="'+tpEscape(month)+'"')+
    tpButton("pdf-history-cheque","Download CHEQUE PDF","tp-light",'data-month="'+tpEscape(month)+'"')+
    tpButton("pdf-history-advance","Download Advances PDF","tp-light",'data-month="'+tpEscape(month)+'"')+
    tpButton("pdf-history-attendance","Download Attendance PDF","tp-light",'data-month="'+tpEscape(month)+'"')+
    tpButton("pdf-history-parcel","Download Parcel Commissions PDF","tp-light",'data-month="'+tpEscape(month)+'"')+
    tpButton("print-history-cash","Print CASH","tp-light",'data-month="'+tpEscape(month)+'"')+
    tpButton("print-history-cheque","Print CHEQUE","tp-light",'data-month="'+tpEscape(month)+'"')+
    tpButton("print-history-parcel","Print Parcel Commissions","tp-light",'data-month="'+tpEscape(month)+'"')+'</div>';
  var changeLog=changes.length?'<div class="tp-note"><strong>Salary changes effective this month</strong>'+
    changes.map(function(c){return'<div>'+tpEscape(c.employeeName||tpEmp(c.employeeId)?.name||"Employee")+
      ': '+tpMoney(c.previousSalary)+' → '+tpMoney(c.newSalary)+' ('+tpEscape(c.source)+')</div>';}).join("")+'</div>':"";
  return'<details class="tp-history-entry" '+(month===tpPeriod?'open':'')+'><summary><div><strong>'+tpMonthLabel(month)+'</strong>'+
   '<small>'+completed+' of '+rows.length+' salaries calculated · monthly IDs retained</small></div>'+
   '<div><strong>'+tpMoney(net)+'</strong><small>Leave '+tpMoney(leaveTotal)+' · Advances '+tpMoney(advance)+'</small></div>'+
   '<span class="tp-chevron">⌄</span></summary><div class="tp-history-body">'+actions+changeLog+
   tpTable(["Monthly ID","Employee","Designation","Monthly salary / type","Worked days","Leave / commission & GST","Advance","Net payable"],table)+
   '</div></details>';
 }).join("")+'</div></section>';
 if(!months.length)out+='<div class="tp-note">No history yet. Enter attendance or advances to create the first monthly record.</div>';
 return out;
}
function tpSettings(){
 var rule=tpData.settings.leaveEarnEveryDays;
 var example=tpLeaveEarned(27,4,rule),cap2=tpLeaveEarned(27,2,rule);
 var out='<section class="tp-panel">'+tpToolbar("Payroll Settings","Configure leave money for this browser-local payroll demo.","")+
 '<div class="tp-form-grid"><div class="tp-field"><label for="tp-leave-interval">Earn 1 paid leave day for every ___ days worked</label>'+
 '<input id="tp-leave-interval" type="number" min="1" max="30" step="1" inputmode="numeric" value="'+rule+'">'+
 '<small>Default: 1 leave per 7 days worked. Choose a whole number from 1 to 30.</small></div>'+
 '<div class="tp-note">Each employee also has their own maximum paid leave allowance (for example 2 or 4 days). Set it under Employees → Edit. Earned leave is capped by that amount.</div></div>'+
 '<div class="tp-actions" style="margin-top:16px">'+tpButton("save-leave-settings","Save Leave Settings","tp-primary")+tpButton("go-employees","Edit Employee Allowances","tp-light")+'</div>'+
 '<div class="tp-note">Example: for 27 worked days, a 4-day allowance gives '+example+' paid leave days, and a 2-day allowance gives '+cap2+'. Leave pay = monthly salary ÷ 30 × earned leave days.</div>'+
 '<p class="sub">Changing the rule recalculates unfinalized demo monthly figures, including Payroll History. No real payroll is paid or submitted.</p></section>';
 return out+tpDesignationsPage();
}
function tpRender(){
 var out=tpTop();
 if(tpTab==="dashboard")out+=tpDashboard();
 else if(tpTab==="employees")out+=tpEmployeesPage();
 else if(tpTab==="attendance")out+=tpAttendance();
 else if(tpTab==="advances")out+=tpAdvances();
 else if(tpTab==="sheets")out+=tpSheets();
 else if(tpTab==="history")out+=tpHistory();
 else out+=tpSettings();
 return out+'<footer class="tp-footer">Tablewise Payroll Demo · Local sample data only · Not a payroll or statutory compliance system</footer></div>';
}

payroll=tpRender;
function tpTouch(period){
 period.updatedAt=tpStamp();
 if(!tpSave())return false;
 draw();return true;
}
function tpSetTab(sec){
 if(sec==="salary")sec="sheets";
 if(!TP_SECTIONS.includes(sec))return;
 tpTab=sec;tpEditing=null;tpViewing=null;tpPhoto=null;if(sec!=="settings")tpDesignationEditing=null;if(sec!=="attendance")tpCommissionOpen=null;tpCalculationOpenId=null;draw();
 try{document.querySelector(".tp-app")?.scrollIntoView({behavior:"smooth",block:"start"});}catch(err){}
}
function tpPrintableTable(title,subtitle,heads,rows,summary,signatures){
 var output='<div class="tp-print-page"><div class="tp-print-head"><span>TABLEWISE RESTAURANT PAYROLL · DEMONSTRATION</span><h1>'+tpEscape(title)+'</h1><p>'+tpEscape(subtitle)+'</p></div>';
 output+='<table><thead><tr>'+heads.map(function(x){return'<th>'+tpEscape(x)+'</th>';}).join("")+'</tr></thead><tbody>'+
 rows.map(function(r){return'<tr>'+r.map(function(cell){return'<td>'+tpEscape(cell)+'</td>';}).join("")+'</tr>';}).join("")+'</tbody></table>';
 output+='<div class="tp-print-total">'+tpEscape(summary)+'</div>';
 if(signatures)output+='<div class="tp-print-signs"><span>Prepared by: ___________________</span><span>Authorised by: ___________________</span></div>';
 return output+'<p class="tp-print-demo">Sample payroll demonstration · Not a statutory payslip or payment authorisation</p></div>';
}
// Generate a self-contained, downloadable PDF using canvas text (including Indian currency
// and Unicode employee names) and native browser Blob APIs. No network or PDF service needed.
function tpPdfBuild(jpegPages){
 if(!jpegPages.length)throw Error("PDF needs at least one page");
 var encoder=new TextEncoder(),chunks=[],length=0,offsets=[0];
 function push(data){
  var bytes=typeof data==="string"?encoder.encode(data):data;
  chunks.push(bytes);length+=bytes.byteLength;
 }
 function object(id,body){
  offsets[id]=length;push(id+" 0 obj\n"+body+"\nendobj\n");
 }
 push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
 object(1,"<< /Type /Catalog /Pages 2 0 R >>");
 var kids=jpegPages.map(function(_,i){return (3+i*3)+" 0 R";}).join(" ");
 object(2,"<< /Type /Pages /Kids ["+kids+"] /Count "+jpegPages.length+" >>");
 jpegPages.forEach(function(page,i){
  var pid=3+i*3,cid=pid+1,jid=pid+2;
  // Permit a single landscape bonus sheet without changing existing
  // portrait payroll PDFs or their text/image rendering.
  var pw=Number.isSafeInteger(page.pageWidth)&&page.pageWidth>0?page.pageWidth:595;
  var ph=Number.isSafeInteger(page.pageHeight)&&page.pageHeight>0?page.pageHeight:842;
  object(pid,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+pw+" "+ph+"] "+
   "/Resources << /XObject << /Im0 "+jid+" 0 R >> >> /Contents "+cid+" 0 R >>");
  var stream=encoder.encode("q\n"+pw+" 0 0 "+ph+" 0 0 cm\n/Im0 Do\nQ\n");
  offsets[cid]=length;
  push(cid+" 0 obj\n<< /Length "+stream.byteLength+" >>\nstream\n");
  push(stream);push("\nendstream\nendobj\n");
  offsets[jid]=length;
  push(jid+" 0 obj\n<< /Type /XObject /Subtype /Image /Width "+page.width+
   " /Height "+page.height+" /ColorSpace /DeviceRGB /BitsPerComponent 8 "+
   "/Filter /DCTDecode /Length "+page.bytes.byteLength+" >>\nstream\n");
  push(page.bytes);push("\nendstream\nendobj\n");
 });
 var xref=length,objects=2+jpegPages.length*3;
 push("xref\n0 "+(objects+1)+"\n0000000000 65535 f \n");
 for(var id=1;id<=objects;id++)push(String(offsets[id]).padStart(10,"0")+" 00000 n \n");
 push("trailer\n<< /Size "+(objects+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n");
 return new Blob(chunks,{type:"application/pdf"});
}
function tpPdfCanvas(){
 var canvas=document.createElement("canvas");
 canvas.width=1190;canvas.height=1684;
 var ctx=canvas.getContext("2d");
 if(!ctx)throw Error("Canvas is unavailable");
 ctx.scale(2,2);ctx.fillStyle="#ffffff";ctx.fillRect(0,0,595,842);
 return {canvas:canvas,ctx:ctx};
}
function tpPdfText(ctx,value,x,y,size,bold,color,maxWidth,align){
 var text=String(value==null?"":value);
 ctx.save();ctx.font=(bold?"700 ":"400 ")+(size||11)+"px Arial, sans-serif";
 ctx.fillStyle=color||"#213746";ctx.textBaseline="alphabetic";ctx.textAlign=align||"left";
 if(maxWidth){
  while(text.length>1&&ctx.measureText(text).width>maxWidth)text=text.slice(0,-2)+"…";
 }
 ctx.fillText(text,x,y);ctx.restore();
}
function tpPdfHeader(ctx,title,month,detail){
 ctx.fillStyle="#145b50";ctx.fillRect(0,0,595,13);
 tpPdfText(ctx,typeof selectedName==="function"?selectedName():"RESTAURANT",38,44,17,true,"#14725d",515);
 tpPdfText(ctx,title,38,83,20,true,"#19384a",515);
 tpPdfText(ctx,tpMonthLabel(month)+(detail?"  |  "+detail:""),38,108,11,false,"#71828b",515);
 ctx.strokeStyle="#e1e9eb";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(38,121);ctx.lineTo(557,121);ctx.stroke();
}
function tpPdfFooter(ctx,num){
 ctx.strokeStyle="#e2e9e9";ctx.beginPath();ctx.moveTo(38,796);ctx.lineTo(557,796);ctx.stroke();
 tpPdfText(ctx,"PAYROLL DEMO  ·  VERIFY BEFORE PAYMENT",38,814,8,false,"#819198");
 tpPdfText(ctx,"Page "+num,557,814,8,false,"#819198",0,"right");
}
function tpPdfImage(page){
 var encoded=page.canvas.toDataURL("image/jpeg",0.88);
 if(!encoded.startsWith("data:image/jpeg;base64,"))throw Error("JPEG image generation failed");
 var raw=atob(encoded.slice(encoded.indexOf(",")+1));
 var bytes=new Uint8Array(raw.length);
 for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return {width:page.canvas.width,height:page.canvas.height,bytes:bytes};
}
function tpParcelPdfPages(month,employeeId){
 var m=month||tpPeriod,rows=tpRows(m,!!month).filter(function(r){
  return tpIsParcel(r.emp)&&(!employeeId||r.emp.id===employeeId);
 });
 if(!rows.length)return [];
 var pages=[],summary=rows.reduce(function(sum,r){
  if(r.calc){sum.commission+=r.calc.commissionTotal;sum.gst+=r.calc.gst;sum.net+=r.calc.net;}
  return sum;
 },{commission:0,gst:0,net:0});
 var count=Math.ceil(rows.length/20);
 for(var part=0;part<count;part++){
  var page=tpPdfCanvas(),ctx=page.ctx,group=rows.slice(part*20,(part+1)*20);
  tpPdfHeader(ctx,"PARCEL BOYS - PAYMENT SHEET",m,count>1?"Summary "+(part+1)+"/"+count:"Summary");
  ctx.fillStyle="#eaf4ef";ctx.fillRect(38,140,519,30);
  var pos=[42,87,270,346,450,554],names=["ID","EMPLOYEE","MODE","COMMISSION","GST","NET PAY"];
  names.forEach(function(v,i){tpPdfText(ctx,v,pos[i],159,9,true,"#2c6153",i===1?166:0,i>=3?"right":"left");});
  group.forEach(function(r,i){
   var y=194+i*26,c=r.calc;
   if(i%2===0){ctx.fillStyle="#f7faf9";ctx.fillRect(38,y-17,519,25);}
   tpPdfText(ctx,r.serial===null?"—":r.serial,pos[0],y,10,true);
   tpPdfText(ctx,r.emp.name,pos[1],y,10,true,"#1c3746",169);
   var mode=tpCommissionRecord(tpGetPeriod(m),r.emp)?.mode==="daily"?"Daily":"Monthly";
   tpPdfText(ctx,mode,pos[2],y,9,false,"#526673",76);
   tpPdfText(ctx,c?tpMoney(c.commissionTotal):"Not entered",pos[3],y,9,false,"#274356",76,"right");
   tpPdfText(ctx,c?tpMoney(c.gst):"—",pos[4],y,9,false,"#9a4f41",88,"right");
   tpPdfText(ctx,c?tpMoney(c.net):"—",pos[5],y,10,true,"#116a53",98,"right");
  });
  var base=194+group.length*26+14;
  ctx.fillStyle="#e9f4ee";ctx.fillRect(38,base,519,49);
  tpPdfText(ctx,"TOTAL NET PAYABLE",51,base+29,12,true,"#166e54");
  tpPdfText(ctx,tpMoney(group.reduce(function(n,r){return n+(r.calc?r.calc.net:0);},0)),
   546,base+29,14,true,"#136647",0,"right");
  if(part===count-1){
   tpPdfText(ctx,"ALL PARCEL BOYS  |  COMMISSION "+tpMoney(summary.commission)+
      "   -   GST "+tpMoney(summary.gst)+"   =   NET "+tpMoney(summary.net),40,
      Math.min(base+74,758),10,true,"#334f58",517);
  }
  tpPdfFooter(ctx,pages.length+1);pages.push(tpPdfImage(page));
 }
 rows.forEach(function(r){
  var page=tpPdfCanvas(),ctx=page.ctx,rec=tpCommissionRecord(tpGetPeriod(m),r.emp)||{},
    calc=r.calc,rate=rec.gstRate==null?(r.emp.commissionGstRate??5):rec.gstRate;
  tpPdfHeader(ctx,"PARCEL COMMISSION - EMPLOYEE SHEET",m,r.emp.name);
  ctx.fillStyle="#f3f8f7";ctx.fillRect(38,139,519,63);
  tpPdfText(ctx,"MONTHLY ID",51,159,8,true,"#718592");
  tpPdfText(ctx,r.serial===null?"Not assigned":r.serial,51,184,16,true);
  tpPdfText(ctx,"PAYMENT METHOD",200,159,8,true,"#718592");
  tpPdfText(ctx,r.emp.method||"CASH",200,184,14,true);
  tpPdfText(ctx,"ENTRY TYPE",382,159,8,true,"#718592");
  var isDaily=rec.mode==="daily";
  tpPdfText(ctx,isDaily?"Daily commissions":"Monthly total",382,184,13,true);
  if(isDaily){
   ctx.fillStyle="#eaf4ef";ctx.fillRect(38,229,245,29);ctx.fillRect(312,229,245,29);
   tpPdfText(ctx,"DAY",48,248,10,true);tpPdfText(ctx,"COMMISSION",273,248,10,true,"#34576a",0,"right");
   tpPdfText(ctx,"DAY",322,248,10,true);tpPdfText(ctx,"COMMISSION",547,248,10,true,"#34576a",0,"right");
   for(var d=0;d<30;d++){
    var isRight=d>=15,colX=isRight?312:38,row=d%15,top=269+row*25;
    if(row%2===0){ctx.fillStyle="#f7faf9";ctx.fillRect(colX,top-17,245,25);}
    tpPdfText(ctx,String(d+1),colX+12,top,10,false);
    var amount=Array.isArray(rec.daily)?rec.daily[d]:null;
    tpPdfText(ctx,amount===null||amount===undefined?"—":tpMoney(amount),colX+235,top,10,true,"#28485a",0,"right");
   }
  }else{
   ctx.fillStyle="#f5f9f7";ctx.fillRect(38,238,519,135);
   tpPdfText(ctx,"MONTHLY COMMISSION TOTAL",56,274,11,true,"#58736e");
   tpPdfText(ctx,rec.total===null||rec.total===undefined?"Not entered":tpMoney(rec.total),
    56,327,30,true,"#164e45");
  }
  var y=isDaily?664:408;
  ctx.fillStyle="#f6f9f8";ctx.fillRect(38,y,519,110);
  tpPdfText(ctx,"Total commission",51,y+29,11,false);tpPdfText(ctx,calc?tpMoney(calc.commissionTotal):"—",542,y+29,12,true,"#19384a",0,"right");
  tpPdfText(ctx,"GST deduction ("+rate+"%)",51,y+54,11,false);tpPdfText(ctx,calc?"- "+tpMoney(calc.gst):"—",542,y+54,12,true,"#a04444",0,"right");
  ctx.fillStyle="#e4f3eb";ctx.fillRect(45,y+66,505,37);
  tpPdfText(ctx,"NET PAYABLE",53,y+91,12,true,"#0a6547");
  tpPdfText(ctx,calc?tpMoney(calc.net):"Not calculated",539,y+91,16,true,"#0b704d",0,"right");
  if(!isDaily){
   tpPdfText(ctx,"Employee signature: __________________________",51,681,10,false,"#71828b");
   tpPdfText(ctx,"Prepared by: __________________________",51,717,10,false,"#71828b");
  }
  tpPdfFooter(ctx,pages.length+1);pages.push(tpPdfImage(page));
 });
 return pages;
}
function tpGeneralPdfPages(kind,month){
 var m=month||tpPeriod,rows=tpRows(m,!!month),title="",columns=[],items=[],footer="",detail="";
 if(kind==="cash"||kind==="cheque"){
  var method=kind.toUpperCase();
  rows=rows.filter(function(r){return r.emp.method===method;});
  title=method+" SALARY PAYMENT SHEET";
  detail=rows.length+" employees, sorted by monthly ID";
  columns=[
   {label:"ID",width:38},{label:"EMPLOYEE",width:130},{label:"DESIGNATION",width:150},
   {label:"TYPE",width:86},{label:"NET PAY",width:115,right:true}
  ];
  var sum=0;
  items=rows.map(function(r){if(r.calc)sum+=r.calc.net;return [
   r.serial===null?"—":r.serial,r.emp.name,r.emp.designation,
   tpIsParcel(r.emp)?"Parcel Boy":"Salaried",
   r.calc?tpMoney(r.calc.net):"Not calculated"
  ];});
  footer="TOTAL "+method+" PAYABLE: "+tpMoney(sum);
 }else if(kind==="advance"){
  rows=rows.filter(function(r){return !tpIsParcel(r.emp);});
  title="MONTHLY ADVANCE & DEDUCTION SHEET";
  detail=rows.length+" salaried employees";
  columns=[
   {label:"MONTH ID",width:55},{label:"EMPLOYEE",width:120},{label:"DESIGNATION",width:134},
   {label:"ADVANCE",width:70,right:true},{label:"FINE",width:70,right:true},
   {label:"OTHER",width:70,right:true}
  ];
  var advances=0,fines=0,other=0;
  items=rows.map(function(r){
   var adv=Number(r.advance.amount)||0,fine=Number(r.deductions.fine)||0,ded=Number(r.deductions.other)||0;
   advances+=adv;fines+=fine;other+=ded;
   return [r.serial===null?"—":r.serial,r.emp.name,r.emp.designation,
    tpMoney(adv),tpMoney(fine),tpMoney(ded)];
  });
  footer="TOTAL SALARY ADVANCES: "+tpMoney(advances);
  detail+="  |  Fines: "+tpMoney(fines)+"  |  Other: "+tpMoney(other);
 }else if(kind==="attendance"){
  rows=rows.filter(function(r){return !tpIsParcel(r.emp);});
  title="MONTHLY ATTENDANCE SHEET";
  detail="Worked days only, paid leave excluded";
  columns=[
   {label:"ID",width:40},{label:"EMPLOYEE",width:145},{label:"DESIGNATION",width:155},
   {label:"WORK DAYS",width:100,right:true},{label:"LEAVE",width:79,right:true}
  ];
  var worked=0,recorded=0;
  items=rows.map(function(r){
   var days=tpInputDays(r.worked);
   if(days!==null){worked+=days;recorded++;}
   return [r.serial===null?"—":r.serial,r.emp.name,r.emp.designation,
    days===null?"—":days, r.calc?r.calc.leaveEarned:"—"];
  });
  footer="ATTENDANCE RECORDED: "+recorded+"/"+rows.length;
 }else throw Error("Unknown PDF sheet type");
 if(!items.length)return [];
 var pages=[],perPage=18;
 for(var start=0;start<items.length;start+=perPage){
  var part=items.slice(start,start+perPage),page=tpPdfCanvas(),ctx=page.ctx;
  tpPdfHeader(ctx,title,m,detail);
  ctx.fillStyle="#e9f4ef";ctx.fillRect(38,140,519,30);
  var cursor=38;
  columns.forEach(function(col){
   var x=col.right?cursor+col.width-7:cursor+7;
   tpPdfText(ctx,col.label,x,159,8,true,"#306455",col.width-11,col.right?"right":"left");
   cursor+=col.width;
  });
  part.forEach(function(item,i){
   var y=194+i*27;
   if(i%2===0){ctx.fillStyle="#f7faf9";ctx.fillRect(38,y-17,519,26);}
   var x=38;
   columns.forEach(function(col,j){
    var at=col.right?x+col.width-7:x+7;
    tpPdfText(ctx,item[j],at,y,9,j===0||j===columns.length-1,
      j===columns.length-1?"#125a49":"#203b49",col.width-13,col.right?"right":"left");
    x+=col.width;
   });
  });
  var yTotal=194+part.length*27+10;
  ctx.fillStyle="#e4f3eb";ctx.fillRect(38,yTotal,519,49);
  tpPdfText(ctx,start+part.length<items.length?"Continued on next page":footer,
   49,yTotal+29,11,true,"#146b50",500);
  tpPdfFooter(ctx,pages.length+1);
  pages.push(tpPdfImage(page));
 }
 return pages;
}
function tpDeliverPdf(file,filename){
 var url=URL.createObjectURL(file),link=document.createElement("a");
 var mobile=typeof navigator!=="undefined"&&/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||"");
 if(mobile){
  // A real user tap is needed for iOS Safari / in-app browsers. Synthetic
  // link.click() on a Blob URL can silently do nothing on these devices.
  var existing=document.getElementById("tp-mobile-pdf");
  if(existing)existing.remove();
  var dialog=document.createElement("div");dialog.id="tp-mobile-pdf";
  dialog.style.cssText="position:fixed;inset:0;background:#122923ba;z-index:99999;display:grid;place-items:center;padding:18px";
  var panel=document.createElement("div");panel.style.cssText="width:min(100%,440px);background:white;border-radius:15px;padding:22px;display:grid;gap:13px;box-shadow:0 22px 65px #162c3559";
  var heading=document.createElement("strong");heading.textContent="Your PDF is ready";
  var message=document.createElement("p");message.textContent="Tap Open PDF to view it. Use the phone's Share menu to Print or Save to Files.";
  var open=document.createElement("a");
  open.href=url;open.target="_blank";open.rel="noopener";open.textContent="Open PDF";
  open.style.cssText="padding:13px;background:#137a5c;color:white;border-radius:9px;text-align:center;font-weight:800;text-decoration:none";
  var download=document.createElement("a");
  download.href=url;download.download=filename;download.textContent="Save PDF";
  download.style.cssText="padding:11px;border:1px solid #ceded9;border-radius:9px;text-align:center;text-decoration:none;color:#194b45";
  var close=document.createElement("button");close.type="button";close.textContent="Close";
  close.onclick=function(){dialog.remove();};
  panel.appendChild(heading);panel.appendChild(message);panel.appendChild(open);
  panel.appendChild(download);panel.appendChild(close);
  if(typeof navigator.share==="function"&&typeof File!=="undefined"){
   var share=document.createElement("button");share.type="button";share.textContent="Share / Print";
   share.onclick=function(){
    var attachment=new File([file],filename,{type:"application/pdf"});
    if(navigator.canShare&&!navigator.canShare({files:[attachment]}))return;
    navigator.share({files:[attachment],title:filename}).catch(function(){});
   };
   panel.insertBefore(share,download);
  }
  dialog.appendChild(panel);document.body.appendChild(dialog);
 }else{
  link.href=url;link.download=filename;link.style.display="none";
  document.body.appendChild(link);link.click();link.remove();
 }
 setTimeout(function(){URL.revokeObjectURL(url);},300000);
 return url;
}
function tpDownloadPDF(kind,month,employeeId){
 var m=month||tpPeriod;
 try{
  if(!["cash","cheque","advance","attendance","parcel"].includes(kind))throw Error("Unknown sheet");
  var pages=kind==="parcel"?tpParcelPdfPages(m,employeeId):tpGeneralPdfPages(kind,month);
  if(!pages.length)return uxAlert("No employee records are available for this PDF sheet.");
  var file=tpPdfBuild(pages);
  var employeeTag=employeeId?"-"+String(employeeId).replace(/[^a-z0-9_-]/gi,""):"";
  tpDeliverPdf(file,"restaurant-"+kind+"-payment-sheet-"+m+employeeTag+".pdf");
 }catch(err){uxAlert("Could not download the payroll PDF: "+(err&&err.message||"Unexpected error"));}
}


function tpDoPrint(kind,month){
 var m=month||tpPeriod,rows=tpRows(m,!!month),title,sub,heads,records,total=0;
 if(kind==="parcel"){
  title="Parcel Boy Commission Sheet";
  sub=tpMonthLabel(m);
  heads=["Monthly ID","Parcel Boy","Commission (₹)","GST (₹)","Net payable (₹)"];
  records=rows.filter(function(r){return tpIsParcel(r.emp);}).map(function(r){
   var c=r.calc;if(c)total+=c.net;
   return [r.serial===null?"—":r.serial,r.emp.name,c?tpRupees(c.commissionTotal):"Not entered",
    c?tpRupees(c.gst):"",c?tpRupees(c.net):""];
  });
 }else if(kind==="advance"){
  title="Advance Distribution Sheet";
  sub=tpMonthLabel(m);
  heads=["Monthly ID","Employee","Designation","Advance (₹)","Signature"];
  records=rows.filter(function(r){return !tpIsParcel(r.emp);}).map(function(r){
   var amount=Number(r.advance.amount)||0;total+=amount;
   return[r.serial===null?"—":r.serial,r.emp.name,r.emp.designation,tpRupees(amount),""];
  });
 }else{
  var method=kind.toUpperCase();
  title=method+" Salary Sheet";
  sub=tpMonthLabel(m);
  heads=["Monthly ID","Employee","Designation","Type","Net payable (₹)","Signature"];
  records=rows.filter(function(r){return r.emp.method===method;}).map(function(r){
    var n=r.calc?r.calc.net:0;total+=n;
    return[r.serial===null?"—":r.serial,r.emp.name,r.emp.designation,tpIsParcel(r.emp)?"Parcel Boy":"Salaried",r.calc?tpRupees(n):"Not calculated",""];
  });
 }
 if(!records.length)return uxAlert("No employee rows to print.");
 var printRoot=document.getElementById("tp-payroll-print-root");
 if(!printRoot){printRoot=document.createElement("div");printRoot.id="tp-payroll-print-root";document.body.appendChild(printRoot);}
 printRoot.innerHTML=tpPrintableTable(selectedName()+" — "+title,sub,heads,records,(kind==="advance"?"Total advance: ":"Total "+kind.toUpperCase()+" payable: ")+tpMoney(total),true);
 if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||"")){
  document.body.classList.remove("tp-payroll-printing");
  // Mobile browsers frequently disable window.print(); open a real PDF in
  // their document viewer for Share > Print instead.
  return tpDownloadPDF(kind,m);
 }
 document.body.classList.add("tp-payroll-printing");
 window.print();
}
window.addEventListener("afterprint",function(){document.body.classList.remove("tp-payroll-printing");});
function tpNewEmployee(){
 tpEditing="new";tpViewing=null;tpPhoto=null;tpSetTab("employees");tpEditing="new";draw();
}
function tpHandleAction(button){
 var act=button.dataset.tpAction,id=button.dataset.id;
 if(act==="go-salary")return tpSetTab("sheets");
 if(act==="view-calculation"){
  if(!tpRows().some(function(row){return row.emp.id===id;}))return;
  tpCalculationOpenId=tpCalculationOpenId===id?null:id;
  tpTab="sheets";draw();
  var expanded=document.getElementById("tp-sheet-calculation-"+id);
  if(expanded)expanded.scrollIntoView({block:"nearest",behavior:"smooth"});
  return;
 }
 if(act==="go-attendance")return tpSetTab("attendance");
 if(act==="go-advances")return tpSetTab("advances");
 if(act==="go-sheets")return tpSetTab("sheets");
 if(act==="go-employees")return tpSetTab("employees");
 if(act==="go-designations")return tpSetTab("settings");
 if(act==="edit-designation"){
  var existing=tpDesignationFind(button.dataset.code);
  if(!existing)return;
  tpDesignationEditing=existing.code;draw();return;
 }
 if(act==="cancel-designation"){tpDesignationEditing=null;draw();return;}
 if(act==="delete-designation"){
  var code=tpDesignationCode(button.dataset.code),match=tpDesignationFind(code);
  if(!match)return;
  if(!confirm('Delete shortcut "'+match.code+' → '+match.title+'"? Employee designations already saved will not change.'))return;
  var previous=JSON.stringify(tpData);
  tpData.designations=tpDesignationList().filter(function(item){return tpDesignationCode(item.code)!==code;});
  if(!tpSave()){tpData=JSON.parse(previous);return;}
  if(tpDesignationEditing===code)tpDesignationEditing=null;
  draw();showToast("Designation shortcut deleted.");return;
 }

 if(act==="open-commission"){
  var employee=tpEmp(id);
  if(!tpIsParcel(employee)||employee.active===false)return;
  tpCommissionOpen=id;tpTab="attendance";draw();
  var target=document.getElementById("tp-commission-editor");
  if(target)target.scrollIntoView({behavior:"smooth",block:"start"});
  return;
 }
 if(act==="close-commission"){tpCommissionOpen=null;draw();return;}

 if(act==="save-leave-settings"){
  var field=document.getElementById("tp-leave-interval"),value=Number(field&&field.value);
  if(!Number.isSafeInteger(value)||value<1||value>30)return uxAlert("Enter a whole number of days from 1 to 30.");
  var old=JSON.stringify(tpData);tpData.settings.leaveEarnEveryDays=value;
  if(!tpSave()){tpData=JSON.parse(old);return;}
  draw();showToast("Leave rule saved: one paid leave day per "+value+" days worked.");return;
 }
 if(act==="new-employee")return tpNewEmployee();
 if(act==="view-employee"){tpViewing=id;tpEditing=null;tpPhoto=null;return draw();}
 if(act==="edit-employee"){tpEditing=id;tpViewing=null;tpPhoto=null;return draw();}
 if(act==="cancel-employee"||act==="close-profile"){tpEditing=null;tpViewing=null;tpPhoto=null;return draw();}
 if(act==="delete-employee"){
  var employee=tpEmp(id);
  if(!employee||employee.active===false)return;
  if(!confirm('Delete '+employee.name+' from the active employee roster? Previously entered monthly payroll and attendance data will be kept, and you can restore them under Deleted Employees.'))return;
  var before=JSON.stringify(tpData);
  employee.active=false;employee.deletedAt=tpStamp();
  if(!tpSave()){tpData=JSON.parse(before);return;}
  tpEditing=null;tpViewing=null;tpPhoto=null;draw();showToast(employee.name+" deleted from the active roster.");return;
 }
 if(act==="restore-employee"){
  var employee=tpEmp(id);if(!employee||employee.active!==false)return;
  var before=JSON.stringify(tpData);employee.active=true;delete employee.deletedAt;
  if(!tpSave()){tpData=JSON.parse(before);return;}
  tpEditing=null;tpViewing=null;tpPhoto=null;draw();showToast(employee.name+" restored.");return;
 }
 if(act==="print-advance")return tpDoPrint("advance");
 if(act==="print-cash")return tpDoPrint("cash");
 if(act==="print-cheque")return tpDoPrint("cheque");
 if(act==="print-parcel")return tpDoPrint("parcel");
 if(act==="pdf-advance")return tpDownloadPDF("advance");
 if(act==="pdf-attendance")return tpDownloadPDF("attendance");
 if(act==="pdf-cash")return tpDownloadPDF("cash");
 if(act==="pdf-cheque")return tpDownloadPDF("cheque");
 if(act==="pdf-parcel")return tpDownloadPDF("parcel",null,id||null);
 if(act.startsWith("pdf-history-")||act.startsWith("print-history-")){
  var m=button.dataset.month,kind=act.replace(/^(pdf|print)-history-/,"");
  if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(m)||!tpData.periods[m])return uxAlert("Previous payroll month not found.");
  if(act.startsWith("pdf-"))return tpDownloadPDF(kind,m);
  if(kind!=="attendance")return tpDoPrint(kind,m);
 }
}
document.addEventListener("click",function(ev){
 if(tab!=="payroll")return;
 var route=ev.target.closest&&ev.target.closest("button[data-tp-section]");
 if(route){ev.preventDefault();ev.stopImmediatePropagation();return tpSetTab(route.dataset.tpSection);}
 var button=ev.target.closest&&ev.target.closest("button[data-tp-action]");
 if(button){ev.preventDefault();ev.stopImmediatePropagation();return tpHandleAction(button);}
},true);
document.addEventListener("change",function(ev){
 var field=ev.target;
 if(field.id==="tp-role-pick"){
  var matched=tpDesignationFind(field.value);
  var role=document.getElementById("tp-role");
  if(role&&matched){role.value=matched.title;role.focus();}return;
 }
 if(field.id==="tp-role"){
  var resolved=tpDesignationFind(field.value);
  if(resolved)field.value=resolved.title;
  return;
 }
 if(field.id!=="tp-employee-type")return;
 var form=ev.target.closest("form");
 if(!form)return;
 var parcel=ev.target.value==="parcel";
 form.dataset.employeeType=parcel?"parcel":"salaried";
 form.querySelectorAll(".tp-salaried-only input").forEach(function(input){input.disabled=parcel;input.required=!parcel;});
 var shortcutPicker=form.querySelector("#tp-role-pick");if(shortcutPicker)shortcutPicker.disabled=parcel;
 form.querySelectorAll(".tp-parcel-only input").forEach(function(input){input.disabled=!parcel;input.required=parcel;});
},true);
document.addEventListener("submit",function(ev){
 if(!ev.target||ev.target.id!=="tp-designation-form")return;
 ev.preventDefault();ev.stopImmediatePropagation();
 var form=ev.target;
 var code=tpDesignationCode(form.elements.shortcut.value),title=tpTrim(form.elements.title.value,90);
 if(!tpDesignationValid(code,title)){
  uxAlert("Enter a shortcut of 1–20 letters/numbers/spaces/hyphens and a designation of up to 90 characters.");return;
 }
 var existing=tpDesignationEditing?tpDesignationFind(tpDesignationEditing):null;
 if(tpDesignationEditing&&!existing){uxAlert("Shortcut no longer exists. Open Payroll Settings again.");return;}
 if(tpDesignationList().some(function(item){return tpDesignationCode(item.code)===code&&(!existing||item!==existing)})){
  uxAlert('Shortcut "'+code+'" is already used. Choose a different code.');return;
 }
 var previous=JSON.stringify(tpData);
 if(existing){existing.code=code;existing.title=title;}
 else tpData.designations.push({code:code,title:title});
 if(!tpSave()){tpData=JSON.parse(previous);return;}
 tpDesignationEditing=null;
 draw();showToast("Designation shortcut saved.");return;
},true);
document.addEventListener("submit",function(ev){
 if(!ev.target||!["tp-office-loan-issue-form","tp-office-loan-repayment-form"].includes(ev.target.id))return;
 ev.preventDefault();ev.stopImmediatePropagation();
 var form=ev.target,emp=tpEmp(form.dataset.id),month=tpMonth(0),period=tpGetPeriod(month);
 if(!emp||tpIsParcel(emp)||emp.active===false||emp.left||!tpPayrollMatchesRestaurant(emp))
  return uxAlert("Select an active salaried employee in this outlet.");
 if(period.locked||period.finalized)return uxAlert("This month's payroll is locked; loan changes cannot be made.");
 var before=JSON.stringify(tpData);
 if(form.id==="tp-office-loan-issue-form"){
  var value=parsePaise(form.querySelector("#tp-office-loan-amount")?.value),
      note=tpTrim(form.querySelector("#tp-office-loan-note")?.value||"",120);
  if(value===null||value<=0||value>1000000000)return uxAlert("Enter a whole-rupee loan from ₹1 to ₹1,00,00,000.");
  if(!Array.isArray(tpData.officeLoans))tpData.officeLoans=[];
  tpData.officeLoans.push({id:tpId(),employeeId:emp.id,personId:tpLoanPersonKey(emp),
   month:month,issuedAt:tpToday(),amount:value,note:note});
 }else{
  var deduction=parsePaise(form.querySelector("#tp-office-loan-deduction")?.value||"0");
  if(deduction===null||deduction>1000000000)return uxAlert("Enter a whole-rupee monthly repayment between ₹0 and ₹1,00,00,000.");
  emp.officeLoanMonthlyDeduction=deduction;
 }
 // An existing attendance record applies this month's chosen loan recovery.
 // Without attendance, the setting activates when salary is calculated.
 var days=tpInputDays(period.days[emp.id]);
 if(days!==null){
  var calc=tpCompute(emp,period,undefined,month);
  if(calc)period.snapshots[emp.id]=tpSnapshot(emp,calc,days);
 }
 if(!tpSave()){tpData=JSON.parse(before);return;}
 draw();showToast(form.id==="tp-office-loan-issue-form"?"Office loan added.":"Monthly loan deduction saved.");
},true);
document.addEventListener("submit",function(ev){
 if(!ev.target||ev.target.id!=="tp-employee-form")return;
 ev.preventDefault();ev.stopImmediatePropagation();
 var form=ev.target;
 var name=tpTrim(form.elements.name.value,90),designation=tpTrim(tpDesignationExpand(form.elements.designation.value),90),joined=form.elements.joined.value;
 var restaurant=tpTrim(form.elements.restaurant.value,90),method=form.elements.method.value,
 employeeType=form.elements.employeeType.value==="parcel"?"parcel":"salaried",parcel=employeeType==="parcel",
 salary=parcel?0:(tpEditing&&tpEditing!=="new"&&tpEmp(tpEditing)?tpMonthSalary(tpEmp(tpEditing),tpPeriod):parsePaise(form.elements.salary.value)),
 leaveAllowance=parcel?0:Number(form.elements.leaveAllowance.value),
 salaryEffectiveMonth=tpPeriod,
 aadhaarRaw=String(form.elements.aadhaar&&form.elements.aadhaar.value||"").replace(/\s+/g,""),
 aadhaarLast4=aadhaarRaw?aadhaarRaw.slice(-4):"",
 gstRate=Number(form.elements.commissionGstRate.value);
 if(aadhaarRaw&&!/^(?:[0-9]{4}|[0-9]{12})$/.test(aadhaarRaw))return uxAlert("Enter 4 or 12 Aadhaar digits. Only the last four will be saved.");
 if(parcel)designation=tpTrim(tpEditing&&tpEditing!=="new"&&tpEmp(tpEditing)?.designation||"Parcel Boy",90);
 if(parcel&&(!Number.isFinite(gstRate)||gstRate<0||gstRate>100||Math.round(gstRate*100)!==gstRate*100)){
  uxAlert("Enter a GST rate between 0% and 100%, with at most two decimal places.");return;
 }
 if(!name||!designation||!restaurant||!/^\d{4}-\d{2}-\d{2}$/.test(joined)||(!parcel&&(salary===null||salary<=0))||!["CASH","CHEQUE"].includes(method)||!Number.isSafeInteger(leaveAllowance)||leaveAllowance<0||leaveAllowance>31||!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(salaryEffectiveMonth)){
  uxAlert("Enter a name, designation, joining date, restaurant, salary, CASH/CHEQUE method and whole-number leave allowance (0–31).");return;
 }
 if(!parcel&&salary>1000000000)return uxAlert("For this demo, monthly salary must be at most ₹1,00,00,000.");
 var existing=tpEditing&&tpEditing!=="new"?tpEmp(tpEditing):null;
 if(tpEditing!=="new"&&!existing)return uxAlert("Employee no longer exists. Refresh Payroll.");
 if(existing&&restaurant!==existing.restaurant)return uxAlert("Use Transfer Employee in the employee profile to move outlets while keeping attendance and bonus history.");
 var before=JSON.stringify(tpData);
 if(existing){
  if(tpIsParcel(existing)!==parcel){uxAlert("Employee type is fixed to preserve past payroll. Create a new employee record instead.");return;}
  Object.assign(existing,{name:name,designation:designation,joined:joined,restaurant:restaurant,
    restaurantId:tpResolveRestaurantId(restaurant,existing),aadhaarLast4:aadhaarLast4,
    method:method,leaveAllowance:leaveAllowance,commissionGstRate:parcel?gstRate:undefined,
    photo:tpPhoto===null?existing.photo:tpPhoto});
 }else{
  var added={id:tpId(),name:name,designation:designation,joined:joined,restaurant:restaurant,
    restaurantId:tpResolveRestaurantId(restaurant,null),aadhaarLast4:aadhaarLast4,
    salary:salary,initialSalary:salary,employeeType:employeeType,commissionGstRate:parcel?gstRate:undefined,
    method:method,leaveAllowance:leaveAllowance,photo:tpPhoto||"",active:true};
  tpData.employees.push(added);
  if(!parcel)tpGetPeriod(salaryEffectiveMonth).salaries[added.id]=salary;
 }
 if(!tpSave()){tpData=JSON.parse(before);return;}
 tpEditing=null;tpViewing=null;tpPhoto=null;draw();showToast("Employee saved to Payroll Demo on this device.");
},true);
document.addEventListener("keydown",function(ev){
 if(tab!=="payroll"||tpTab!=="employees")return;
 if(ev.target&&ev.target.id==="tp-role"&&!ev.isComposing&&(ev.key==="Enter"||ev.key==="Tab")){
  var match=tpDesignationFind(ev.target.value);
  if(match){
   ev.target.value=match.title;
   if(ev.key==="Enter"){ev.preventDefault();ev.stopImmediatePropagation();
    var next=document.getElementById("tp-joined");
    if(next)next.focus();
   }
  }
 }
},true);
document.addEventListener("change",function(ev){
 var field=ev.target;
 if(tab!=="payroll")return;
 if(field.id==="tp-id-filter"){
  var option=field.value;
  if(!["all","1-25","26-50","51-75","76-100","101+","unassigned"].includes(option))return;
  tpIdRange=option;draw();return;
 }
 if(field.id==="tp-month"){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(field.value)){uxAlert("Please select a valid payroll month.");return;}
  tpPeriod=field.value;tpIdRange="all";tpCommissionOpen=null;tpCalculationOpenId=null;draw();return;
 }
 if(field.id==="tp-photo"){
  var file=field.files&&field.files[0];if(!file)return;
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>2500000){
   field.value="";return uxAlert("Choose a JPG, PNG or WebP under 2.5 MB.");
  }
  var url=URL.createObjectURL(file),img=new Image();
  img.onload=function(){
   try{
    var canvas=document.createElement("canvas"),size=160,scale=Math.min(size/img.width,size/img.height);
    canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
    canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
    tpPhoto=canvas.toDataURL("image/jpeg",0.76);
    var holder=document.querySelector(".tp-photo-box");
    if(holder){var preview=holder.querySelector(".tp-form-photo,.tp-photo-placeholder");
      if(preview){var el=document.createElement("img");el.className="tp-form-photo";el.alt="Employee photo preview";el.src=tpPhoto;preview.replaceWith(el);}}
   }catch(err){uxAlert("Could not process the employee photo.");}
   finally{URL.revokeObjectURL(url);}
  };
  img.onerror=function(){URL.revokeObjectURL(url);uxAlert("Could not load that image.");};
  img.src=url;return;
 }
 var name=field.dataset.tpField,id=field.dataset.id;
 if(!name||!id)return;
 var emp=tpEmp(id),p=tpGetPeriod();
 if(!emp)return;
 var old=JSON.stringify(tpData);
 if(name==="commissionMode"||name==="commissionGST"||name==="commissionDaily"||name==="commissionTotal"){
  if(!tpIsParcel(emp)){uxAlert("This field is only available for parcel boys.");return;}
  var previous=p.commissions[id],record=previous?JSON.parse(JSON.stringify(previous)):
   {mode:"total",daily:Array(30).fill(null),total:null,gstRate:emp.commissionGstRate==null?5:emp.commissionGstRate};
  if(!Array.isArray(record.daily))record.daily=Array(30).fill(null);
  if(name==="commissionMode"){
   if(field.value!=="daily"&&field.value!=="total")return;
   record.mode=field.value;
  }else if(name==="commissionGST"){
   var gst=Number(field.value);
   if(field.value.trim()===""||!Number.isFinite(gst)||gst<0||gst>100||Math.round(gst*100)!==gst*100){
    uxAlert("GST must be between 0 and 100%, with up to two decimals.");draw();return;
   }
   record.gstRate=gst;
  }else{
   var entered=field.value.trim()===""?null:parsePaise(field.value);
   if(field.value.trim()!==""&&(entered===null||entered>100000000000)){
    uxAlert("Enter a valid positive commission amount (up to ₹100 crore).");draw();return;
   }
   if(name==="commissionTotal")record.total=entered;
   else{
    var day=Number(field.dataset.day);
    if(!Number.isInteger(day)||day<1||day>30)return;
    record.daily[day-1]=entered;
   }
  }
  p.commissions[id]=record;
 }else if(name==="parcelSerial"){
  if(!tpIsParcel(emp))return;
  if(field.value.trim()==="")delete p.serials[id];
  else{
   var num=tpSerialValue(field.value);
   var holder=num===null?null:tpSerialConflict(p,num,id);
   if(num===null||holder){
    uxAlert(num===null?"Monthly ID must be a positive whole number.":"Monthly ID "+num+" is held by "+holder.name+" at "+emp.restaurant+" in "+tpMonthLabel(tpPeriod)+". Select a different ID for this active employee. Other restaurants can reuse this number.");
    draw();return;
   }
   p.serials[id]=num;
  }
 }else if(name==="serial"){
  if(field.value.trim()===""){delete p.serials[id];}
  else{
   var serial=tpSerialValue(field.value);
   if(serial===null){uxAlert("Monthly employee ID must be a positive whole number (1 or higher).");draw();return;}
   var holder=tpSerialConflict(p,serial,id);
   if(holder){
    uxAlert("Monthly ID "+serial+" is held by "+holder.name+" at "+emp.restaurant+" in "+tpMonthLabel(tpPeriod)+". Select a different ID for this active employee. Other restaurants can reuse this number.");
    draw();return;
   }
   p.serials[id]=serial;
  }
 }else if(name==="monthlySalary"){
  var monthly=parsePaise(field.value);
  if(monthly===null||monthly<=0||monthly>1000000000){
   uxAlert("Enter a valid monthly salary from ₹0.01 to ₹1,00,00,000.");draw();return;
  }
  tpSetMonthSalary(emp,tpPeriod,monthly,"Monthly attendance");
  var updated=tpCompute(emp,p);
  if(updated)p.snapshots[id]=tpSnapshot(emp,updated,updated.days);
 }else if(name==="days"){
  var days=tpInputDays(field.value);
  if(days===null&&field.value.trim()!==""){uxAlert("Days worked must be 0–30 in half-day steps, such as 22.5, 25 or 27.");draw();return;}
  if(!field.value.trim()){delete p.days[id];delete p.snapshots[id];}
  else{
   p.days[id]=String(days);
   var c=tpCompute(emp,p);if(c)p.snapshots[id]=tpSnapshot(emp,c,days);
  }
 }else if(name==="advance"||name==="fine"||name==="other"){
  var value=parsePaise(String(field.value||"").trim()===""?"0":field.value);
  if(value===null||value>100000000){uxAlert("Enter a whole-rupee amount from ₹0 to ₹10,00,000 (no paise).");draw();return;}
  field.value=tpRupees(value);
  if(name==="advance"){
   var a=p.advances[id]||{amount:0};
   a.amount=value;delete a.kind;a.enteredAt=tpStamp();
   delete a.paid;delete a.paidAt;
   p.advances[id]=a;
  }else{
   var d=p.deductions[id]||{fine:0,other:0};
   // Other deduction is independent of profile-controlled office loan recovery.
   d[name]=name==="other"?value+(Number(d.loanRepayment)||0):value;
   p.deductions[id]=d;
  }
  var refreshed=tpCompute(emp,p);if(refreshed)p.snapshots[id]=tpSnapshot(emp,refreshed,refreshed.days);
 }else return;
 p.updatedAt=tpStamp();
 if(!tpSave())tpData=JSON.parse(old);
 draw();
},true);
// Enter saves and jumps only within the relevant column: Advances -> next advance, Attendance -> next ID/days, Salary -> next days.
document.addEventListener("keydown",function(ev){
 if(tab!=="payroll"||(tpTab!=="attendance"&&tpTab!=="salary"&&tpTab!=="advances")||ev.key!=="Enter"||ev.isComposing)return;
 var field=ev.target;
 if(!field||!field.matches||!field.matches('input[data-tp-field="days"],input[data-tp-field="serial"],input[data-tp-field="advance"]'))return;
 var kind=field.dataset.tpField,empId=field.dataset.id;
 if((tpTab==="advances")!==(kind==="advance"))return;
 ev.preventDefault();ev.stopImmediatePropagation();
 if(kind==="advance"){
  var amount=parsePaise(String(field.value||"").trim()===""?"0":field.value);
  if(amount===null||amount>100000000){uxAlert("Enter a whole-rupee advance from ₹0 to ₹10,00,000 (no paise).");field.focus();if(field.select)field.select();return;}
  field.value=tpRupees(amount);
 }
 if(kind==="days"&&field.value.trim()!==""&&tpInputDays(field.value)===null){
  uxAlert("Use 0–30 days in half-day steps (such as 22.5 or 27).");field.focus();if(typeof field.select==="function")field.select();return;
 }
 if(kind==="serial"&&field.value.trim()!==""&&tpSerialValue(field.value)===null){
  uxAlert("Monthly ID must be between 1 and 100.");field.focus();return;
 }
 var nextId=null,nextField="days";
 if(tpTab==="advances"&&kind==="advance"){
  var advances=Array.from(document.querySelectorAll('.tp-app input[data-tp-field="advance"]'));
  var advanceIndex=advances.indexOf(field);
  nextId=advanceIndex>=0&&advanceIndex+1<advances.length?advances[advanceIndex+1].dataset.id:null;
  nextField="advance";
 }
 else if(tpTab==="attendance"&&kind==="serial"){
  var serialInputs=Array.from(document.querySelectorAll('.tp-app input[data-tp-field="serial"]'));
  var serialIndex=serialInputs.indexOf(field);
  nextId=serialIndex>=0&&serialIndex+1<serialInputs.length?serialInputs[serialIndex+1].dataset.id:null;
  nextField="serial";
 }
 else if(tpTab==="attendance"&&kind==="monthlySalary"){nextId=empId;nextField="days";}
 else{
  var all=Array.from(document.querySelectorAll('.tp-app input[data-tp-field="days"]'));
  var i=all.indexOf(field);nextId=i>=0&&i+1<all.length?all[i+1].dataset.id:null;
 }
 field.dispatchEvent(new Event("change",{bubbles:true}));
 if(nextId!==null){
  var next=Array.from(document.querySelectorAll('.tp-app input[data-tp-field="'+nextField+'"]'))
   .find(function(input){return input.dataset.id===nextId;});
  if(next){
   next.focus({preventScroll:true});
   if(typeof next.select==="function")next.select();
   next.scrollIntoView({block:"nearest",inline:"nearest"});
  }
 }
},true);
// Daily parcel commission entries have a separate Enter sequence, never joined to salaried days.
document.addEventListener("keydown",function(ev){
 if(tab!=="payroll"||tpTab!=="attendance"||ev.key!=="Enter"||ev.isComposing)return;
 var field=ev.target;
 if(!field||!field.matches||!field.matches('input[data-tp-field="commissionDaily"]'))return;
 ev.preventDefault();ev.stopImmediatePropagation();
 var all=Array.from(document.querySelectorAll('#tp-commission-editor input[data-tp-field="commissionDaily"]'));
 var index=all.indexOf(field),nextDay=index>=0&&index+1<all.length?all[index+1].dataset.day:null;
 field.dispatchEvent(new Event("change",{bubbles:true}));
 if(nextDay){
  var next=document.querySelector('#tp-commission-editor input[data-tp-field="commissionDaily"][data-day="'+nextDay+'"]');
  if(next){next.focus({preventScroll:true});if(next.select)next.select();next.scrollIntoView({block:"nearest"});}
 }
},true);
document.addEventListener("input",function(ev){
 if(tab!=="payroll"||ev.target.dataset.tpField!=="days")return;
 var field=ev.target,emp=tpEmp(field.dataset.id),p=tpGetPeriod();
 if(!emp)return;
 var c=tpCompute(emp,p,field.value),tr=field.closest("tr");
 if(!tr)return;
 var gross=tr.querySelector('[data-tp-salary-value="gross"]'),net=tr.querySelector('[data-tp-salary-value="net"]');
 if(gross)gross.textContent=c?tpMoney(c.gross):"Enter valid days";
 var leave=tr.querySelector('[data-tp-salary-value="leave"]');
 if(leave)leave.textContent=c?c.leaveEarned+" days · "+tpMoney(c.leavePay):"—";
 if(net)net.textContent=c?tpMoney(c.net):"—";
},true);
window.addEventListener("storage",function(ev){
 if(ev.key!==TP_KEY)return;
 try{var incoming=JSON.parse(ev.newValue);if(tpValid(incoming)){tpData=incoming;if(tab==="payroll")draw();}}catch(err){}
});
var tpPreviousRestaurantSettings=settings;
settings=function(){
 var main=tpPreviousRestaurantSettings.apply(this,arguments);
 return main+'<section class="panel" style="margin-top:18px"><h2 class="panel-title">Payroll Leave Settings</h2>'+
 '<p class="panel-sub">Current demo rule: 1 paid leave day per '+tpData.settings.leaveEarnEveryDays+' days worked. Each employee has a maximum paid leave allowance.</p>'+
 '<button type="button" class="btn primary" data-tp-open-settings="1">Configure Payroll Leave Rule</button>'+
 '<p class="sub">Payroll demo settings are saved in this browser only.</p></section>';
};
document.addEventListener("click",function(ev){
 var b=ev.target.closest&&ev.target.closest("button[data-tp-open-settings]");
 if(!b||tab!=="settings")return;
 ev.preventDefault();ev.stopImmediatePropagation();
 tab="payroll";tpTab="settings";tpEditing=null;tpViewing=null;draw();
},true);
var css=document.createElement("style");
css.id="tp-full-demo-css";
css.textContent=String.raw`
.tp-app{--tp-ink:#19354a;--tp-muted:#6c8191;--tp-line:#dde7ed;--tp-green:#0c806a;--tp-bg:#f6f9fb;max-width:1460px;margin:0 auto;color:var(--tp-ink);font-size:14px}
.tp-app *{box-sizing:border-box}.tp-app button,.tp-app input,.tp-app select{font-family:inherit}.tp-app button{cursor:pointer;touch-action:manipulation}
.tp-hero{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;padding:27px 29px;border-radius:20px;background:linear-gradient(112deg,#123b40,#16685d 67%,#238a65);color:white;box-shadow:0 13px 40px #1a4b4b18}
.tp-eyebrow{display:block;text-transform:uppercase;font-size:10px;font-weight:850;letter-spacing:1.8px;color:#118e72}
.tp-hero .tp-eyebrow{color:#a0e1cb}.tp-hero h1{margin:7px 0 6px;font-size:clamp(25px,4vw,36px);font-weight:850;letter-spacing:-.9px;color:white}
.tp-hero p{margin:0 0 15px;color:#c7e7df;font-size:13px}.tp-demo-pill{display:inline-block;color:#def8ed;background:#ffffff19;border:1px solid #ffffff35;padding:7px 12px;border-radius:99px;font-size:10px;font-weight:800;letter-spacing:.6px}
.tp-month-box{display:grid;gap:6px;background:#ffffff1c;border:1px solid #ffffff35;padding:15px 16px;border-radius:14px;min-width:205px}
.tp-month-box label{font-size:11px;font-weight:750;color:#daede6}.tp-month-box input{min-height:41px;color:#1c3c3d;background:#fff;border:0;border-radius:9px;padding:8px 11px;font-size:14px;font-weight:700;color-scheme:light}
.tp-month-box small{color:#d4e9e1;font-size:10px}
.tp-nav{display:flex;gap:6px;overflow-x:auto;scrollbar-width:thin;padding:9px;margin:16px 0 20px;border:1px solid var(--tp-line);border-radius:13px;background:white;-webkit-overflow-scrolling:touch}
.tp-nav button{flex:0 0 auto;min-height:42px;border:0;background:transparent;color:#688092;border-radius:9px;padding:10px 16px;font-size:12px;font-weight:800;white-space:nowrap}
.tp-nav button:hover{background:#edf5f3;color:#1c6b5c}.tp-nav button.tp-active{background:#e3f5ed;color:#087657}
.tp-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:17px}.tp-stats-three{grid-template-columns:repeat(3,minmax(0,1fr))}
.tp-stat{background:white;border:1px solid var(--tp-line);border-radius:14px;padding:18px;box-shadow:0 4px 15px #1a4b4b07;min-width:0;display:flex;flex-direction:column;gap:10px}
.tp-stat-head{display:flex;align-items:center;justify-content:space-between;gap:7px;color:#6b8392;font-size:11px;font-weight:750}
.tp-stat-icon{font-size:16px;color:#11805d;background:#ecf7f2;display:grid;place-items:center;border-radius:10px;min-width:31px;height:31px}
.tp-stat strong{display:block;overflow-wrap:anywhere;font-size:clamp(19px,2vw,27px);line-height:1.2;letter-spacing:-.7px;color:#17394a}
.tp-stat small{font-size:10px;line-height:1.5;color:#8295a2}
.tp-panel{padding:22px;background:white;border:1px solid var(--tp-line);border-radius:15px;min-width:0;margin-bottom:17px;box-shadow:0 3px 18px #1a4b4b06}
.tp-panel h2{margin:0 0 4px;font-size:20px;letter-spacing:-.4px;color:#1c384b}
.tp-panel h3{margin:0 0 6px;font-size:17px;color:#1c384b}
.tp-panel p{line-height:1.55}.tp-header-row{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;margin-bottom:19px}
.tp-header-row p{font-size:12px;color:var(--tp-muted);margin:4px 0}
.tp-actions{display:flex;gap:8px;flex-wrap:wrap}
.tp-profile-actions{align-items:center;gap:8px}
.tp-profile-more{position:relative;display:inline-block}
.tp-profile-more>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;list-style:none;border:1px solid #d9e4e9;background:#f6f9fb;color:#385567;border-radius:9px;min-height:40px;padding:10px 13px;font-size:12px;font-weight:800;white-space:nowrap}
.tp-profile-more>summary::-webkit-details-marker{display:none}
.tp-profile-more>summary:hover,.tp-profile-more[open]>summary{background:#e9f2f1;border-color:#c7d9d6}
.tp-profile-more>summary:focus-visible{outline:3px solid #84b7aa;outline-offset:2px}
.tp-profile-more>summary span{font-size:15px;line-height:1;transition:transform .15s}
.tp-profile-more[open]>summary span{transform:rotate(180deg)}
.tp-profile-menu{position:absolute;z-index:100;left:0;top:calc(100% + 6px);display:grid;gap:5px;min-width:200px;padding:7px;background:white;border:1px solid #d8e3e7;border-radius:11px;box-shadow:0 12px 30px #14374823}
.tp-profile-menu .tp-button{display:block;width:100%;text-align:left;white-space:normal}
@media(max-width:480px){.tp-profile-menu{left:auto;right:0;min-width:190px}}

.tp-button{border:1px solid #d9e4e9;background:#fff;color:#385567;border-radius:9px;padding:10px 13px;min-height:40px;font-size:12px;font-weight:800;white-space:nowrap}
.tp-button:hover{background:#f1f7f7}.tp-button.tp-primary{border-color:#117d64;background:#117d64;color:white}.tp-button.tp-primary:hover{background:#0c6753}.tp-button.tp-light{background:#f6f9fb}
.tp-two{display:grid;grid-template-columns:1.1fr .9fr;gap:15px}.tp-two>.tp-panel{height:100%}.tp-progress{margin:12px 0 20px}
.tp-progress>div:first-child{display:flex;gap:8px;align-items:baseline;color:#678292;margin-bottom:9px}.tp-progress strong{color:#1d4150}
.tp-track{height:9px;background:#e7f1ef;border-radius:99px;overflow:hidden}.tp-track i{display:block;background:linear-gradient(90deg,#16ae78,#118265);height:100%;border-radius:99px}
.tp-summary-row{display:flex;justify-content:space-between;gap:10px;margin:11px 0;padding-bottom:11px;border-bottom:1px solid #eaf0f2}.tp-summary-row span{color:#6d8491;font-size:12px}.tp-summary-row strong{font-size:13px}
.tp-note{font-size:11px;line-height:1.6;border-radius:9px;background:#f0f7f5;color:#4d716b;padding:11px 13px;margin:13px 0}.tp-note strong{color:#275c55}
.tp-step{display:flex;gap:12px;align-items:center;padding:14px 0;border-bottom:1px solid #edf2f4}.tp-step:last-child{border-bottom:0}
.tp-step>span{display:grid;place-items:center;flex:0 0 37px;height:37px;border-radius:11px;background:#e9f7f0;color:#15805f;font-weight:900;font-size:14px}
.tp-step>div{flex:1;min-width:0}.tp-step strong{font-size:12px}.tp-step p{margin:3px 0 0!important;font-size:11px;color:#8095a2}
.tp-employee-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.tp-person{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid #e2ebf0;border-radius:13px;padding:13px;min-width:0;background:#fff}
.tp-avatar{display:grid;place-items:center;flex:0 0 47px;height:47px;border-radius:13px;background:#e6f3ee;color:#0a795e;font-size:15px;font-weight:900;overflow:hidden}
.tp-avatar img{width:100%;height:100%;object-fit:cover}.tp-avatar-small{flex-basis:32px;height:32px;border-radius:9px;font-size:10px}.tp-avatar-large{flex-basis:76px;height:76px;border-radius:19px;font-size:23px}
.tp-person-main{flex:1;min-width:0}.tp-person-main h3{font-size:13px;margin:0 0 3px}.tp-person-main p{font-size:11px;margin:0 0 2px;color:#738a98}.tp-person-main small{font-size:10px;color:#8195a0}
.tp-person-extra{display:flex;align-items:flex-start;gap:4px;flex-direction:column}.tp-person-extra strong{font-size:13px}.tp-badge{display:inline-block;padding:4px 7px;font-size:10px;font-weight:800;border-radius:99px}
.tp-badge-positive{background:#e5f5ed;color:#0e825f}.tp-badge-muted{background:#f1f4f6;color:#61788b}
.tp-person-buttons{display:flex;width:100%;justify-content:flex-end;gap:6px}
.tp-person-buttons button{min-height:33px;padding:7px 12px}
.tp-serial-input{min-width:70px;max-width:86px;text-align:center;font-weight:850;font-size:14px;border:2px solid #b7dbd0;background:#f4faf7}
.tp-month-salary{min-width:110px;width:128px;font-weight:750}
.tp-att-filter{max-width:280px;margin:12px 0 16px}
.tp-att-filter select{width:100%;padding:10px 12px;border-radius:9px;border:1px solid #d7e3e8;background:white;color:#274d57}
.tp-history-actions{padding:14px 3px;gap:7px}
.tp-history-actions .tp-button{white-space:normal}
.tp-history-body{padding:8px 13px 15px;min-width:0}
.tp-salary-log{margin-top:20px;padding-top:18px;border-top:1px solid #e6ecee}
.tp-salary-log .tp-table{min-width:630px}
@media(max-width:760px){.tp-history-body{padding:8px 4px 12px}.tp-history-actions{padding:9px 7px;gap:6px}
.tp-history-actions .tp-button{font-size:10px;min-height:38px;padding:8px}
.tp-att-filter{max-width:100%}.tp-serial-input{width:74px;min-width:74px}}

.tp-button.tp-danger{background:#fff0f0;color:#ad2833;border-color:#ebb7bc}
.tp-button.tp-danger:hover{background:#ffdddd;color:#92202e}
.tp-deleted-people>summary{cursor:pointer;font-weight:800;color:#5a7180;padding:5px 0}
.tp-deleted-list{display:grid;gap:8px;margin-top:12px}
.tp-deleted-row{display:flex;gap:12px;align-items:center;border:1px solid #e6edf0;border-radius:9px;padding:10px}
.tp-deleted-row>div{flex:1;display:grid;gap:3px}
.tp-deleted-row strong{font-size:13px}.tp-deleted-row small{font-size:11px;color:#8a9da7}
.tp-days-input:focus{scroll-margin-block:90px}

.tp-form-panel{border-color:#b2dfca}.tp-form[data-employee-type="parcel"] .tp-salaried-only{display:none!important}
.tp-form[data-employee-type="salaried"] .tp-parcel-only{display:none!important}

.tp-commission-editor{border:1px solid #abdfc8;scroll-margin-top:22px}
.tp-parcel-sheet-desc{display:block;margin-top:4px;font-size:10px;color:#6d8892}
.tp-commission-days{max-width:440px;border:1px solid #dfe8ea;border-radius:12px;overflow:hidden;margin:17px 0}
.tp-commission-cols{display:grid;grid-template-columns:100px 1fr;background:#eaf3f1;padding:11px 13px;font-size:12px;gap:12px}
.tp-commission-day{display:grid;grid-template-columns:100px 1fr;gap:12px;align-items:center;padding:7px 13px;border-top:1px solid #e8eff0}
.tp-commission-day:nth-child(even){background:#fbfdfd}
.tp-commission-day label{font-weight:750;color:#526b77;font-size:12px}
.tp-commission-day .tp-cell-input{max-width:200px;width:100%;height:39px}
.tp-commission-total-field{max-width:450px;margin:17px 0}.tp-commission-total-field .tp-cell-input{width:100%;max-width:250px}
.tp-commission-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}
.tp-commission-summary>div{background:#f5f9f8;border:1px solid #dfe9e6;border-radius:11px;padding:13px;display:grid;gap:6px;min-width:0}
.tp-commission-summary span{font-size:11px;color:#6e8390}.tp-commission-summary strong{font-size:clamp(15px,2vw,20px);overflow-wrap:anywhere}
.tp-commission-summary .tp-commission-pay{background:#e6f5ed;border-color:#b9e1cd;color:#116a4b}
@media(max-width:600px){.tp-commission-summary{grid-template-columns:1fr;gap:7px}.tp-commission-summary>div{display:flex;justify-content:space-between;align-items:center;padding:11px}
.tp-commission-editor .tp-form-grid{grid-template-columns:1fr}.tp-commission-days{width:100%;max-width:none}}

.tp-designation-form{display:grid;grid-template-columns:minmax(160px,.65fr) minmax(220px,1.4fr) auto;gap:13px;align-items:end;padding:15px;background:#f7faf9;border:1px solid #e1ebe8;border-radius:12px;margin-bottom:17px}
.tp-designation-form>.tp-actions{padding-bottom:2px}
.tp-designation-count{font-weight:750;color:#688493;font-size:12px;margin:12px 0}
.tp-shortcode{display:inline-block;border:1px solid #d7eadf;background:#eaf8f0;color:#0c795e;padding:6px 10px;border-radius:8px;font:800 12px ui-monospace,SFMono-Regular,Consolas,monospace}
.tp-designation-form input{min-height:43px}
@media(max-width:800px){.tp-designation-form{grid-template-columns:1fr}}
.tp-form{display:grid;gap:17px}.tp-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.tp-field{display:grid;gap:6px;min-width:0}.tp-field label,.tp-photo-box label{font-size:11px;color:#607889;font-weight:800}
.tp-field input,.tp-field select{width:100%;min-width:0;min-height:43px;border:1px solid #d5e2e8;padding:10px 11px;border-radius:9px;background:white;color:#1e3f4f;font-size:13px}
.tp-field input:focus,.tp-field select:focus,.tp-cell-input:focus,.tp-days-input:focus{outline:2px solid #41ae85;outline-offset:0;border-color:#12a477}
.tp-photo-box{display:flex;gap:14px;align-items:center}.tp-form-photo,.tp-photo-placeholder{width:75px;height:75px;flex:0 0 75px;border-radius:14px;object-fit:cover;background:#eff5f6}
.tp-photo-placeholder{display:grid;place-items:center;color:#94a9b3;font-size:11px}.tp-photo-box input{display:block;max-width:100%;font-size:12px;margin-top:7px}
.tp-photo-box small{display:block;color:#889da8;margin-top:5px;font-size:10px}
.tp-profile-head{display:flex;align-items:center;gap:15px;position:relative}.tp-profile-head>div{flex:1}.tp-profile-head h3{margin:6px 0 4px;font-size:23px}.tp-profile-head p{margin:0;color:#7e929b}
.tp-profile-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:20px 0}
.tp-profile-grid>div{background:#f6f9fa;border:1px solid #e8f0f1;border-radius:10px;padding:13px;min-width:0;overflow-wrap:anywhere}
.tp-profile-grid small{display:block;color:#8196a0;margin-bottom:7px;font-size:10px}.tp-profile-grid strong{font-size:12px}
.tp-x{border:0;background:#f3f7f8;color:#65818f;font-size:25px;line-height:1;width:36px;height:36px;border-radius:9px}
.tp-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #e4edf0;border-radius:11px;margin:12px 0}
.tp-table{border-collapse:collapse;width:100%;min-width:620px;font-size:12px;text-align:left}
.tp-table th{background:#f4f8f8;color:#687f90;font-size:10px;text-transform:uppercase;letter-spacing:.4px;font-weight:850;padding:13px 12px;border-bottom:1px solid #e1e9ed;white-space:nowrap}
.tp-table td{padding:12px;border-bottom:1px solid #edf1f3;vertical-align:middle;color:#344c5c}
.tp-table tbody tr:last-child td{border-bottom:0}.tp-table strong{color:#253e4b}
.tp-person-cell{display:flex;align-items:center;gap:9px;min-width:155px}.tp-person-cell>div{display:grid;gap:3px}.tp-person-cell small{display:block;color:#8297a1;font-size:10px}
.tp-cell-input,.tp-days-input,.tp-serial-input{border:1px solid #d7e3e8;background:white;color:#264457;padding:9px;border-radius:9px;min-width:90px;width:104px;font-size:12px}
.tp-days-input{border:2px solid #17a27c;background:#f3faf6;font-weight:900;font-size:15px;width:102px}
.tp-days-hint{display:block;color:#7794a0;font-size:10px;margin-top:5px;white-space:nowrap}
.tp-check{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;font-size:11px;font-weight:750}.tp-check input{width:17px;height:17px;accent-color:#098566}
.tp-warning{display:block;color:#aa5735;margin-top:5px;font-size:10px}
.tp-sheets-layout .tp-table{min-width:410px}.tp-sheet-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.tp-sheet-title .tp-eyebrow{font-size:10px}.tp-sheet-title h2{margin-top:7px}.tp-sheet-title p{font-size:11px;color:#8496a1;margin:0}.tp-sheet-symbol{display:grid;place-items:center;height:46px;width:46px;border-radius:12px;background:#e8f5ed;color:#128268;font-size:22px}
.tp-sheet-actions{margin-bottom:10px}.tp-sheet-total{display:flex;justify-content:space-between;align-items:center;background:#edf8f2;color:#17674d;border-radius:10px;padding:13px 15px;margin:15px 0}.tp-sheet-total strong{font-size:17px}
.tp-grand{margin-top:15px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;border-radius:14px;background:#153d43;color:white;padding:18px 23px}.tp-grand span{font-size:13px;color:#c4e6d9}.tp-grand strong{font-size:25px}.tp-grand small{margin-left:auto;color:#afd3c6}
.tp-history-list{display:grid;gap:10px}.tp-history-entry{border:1px solid #e1ebee;border-radius:11px;overflow:hidden}
.tp-history-entry>summary{cursor:pointer;padding:14px;display:flex;justify-content:space-between;gap:12px;align-items:center;list-style:none;background:#fbfcfd}
.tp-history-entry>summary::-webkit-details-marker{display:none}.tp-history-entry>summary>div{display:grid;gap:5px}.tp-history-entry>summary strong{font-size:13px}.tp-history-entry>summary small{font-size:10px;color:#8ca0ab}.tp-chevron{font-size:20px;color:#728a96}
.tp-history-entry[open]>summary{border-bottom:1px solid #edf2f3}.tp-history-entry .tp-table-wrap{border:0;margin:0;border-radius:0}
.tp-footer{font-size:11px;color:#98a9b1;text-align:center;padding:13px 0 26px}
#tp-payroll-print-root{display:none}
@media(max-width:1200px){.tp-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.tp-two{grid-template-columns:1fr}.tp-employee-grid{grid-template-columns:1fr}}
@media(max-width:760px){.tp-app{width:100%;max-width:100%;padding-bottom:55px}
.tp-hero{padding:19px;border-radius:13px}.tp-hero h1{font-size:26px}.tp-month-box{width:100%}
.tp-nav{padding:6px;gap:4px;margin:13px 0 15px}.tp-nav button{padding:10px 12px;font-size:11px}
.tp-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tp-stats-three{grid-template-columns:repeat(2,minmax(0,1fr))}
.tp-stat{padding:12px;border-radius:11px}.tp-stat strong{font-size:clamp(17px,5vw,22px)}.tp-stat small{font-size:9px}
.tp-panel{padding:15px;border-radius:13px}.tp-panel h2{font-size:17px}.tp-header-row{gap:10px}.tp-header-row .tp-actions{width:100%}
.tp-employee-grid{grid-template-columns:minmax(0,1fr)}.tp-person{padding:11px}.tp-person-extra{margin-left:auto}
.tp-form-grid,.tp-profile-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tp-button{padding:10px 11px;font-size:11px}
.tp-table{min-width:650px}.tp-table th,.tp-table td{padding:10px 8px}.tp-sheets-layout .tp-table{min-width:430px}
.tp-grand{padding:16px}.tp-grand strong{font-size:21px}.tp-grand small{margin-left:0}
.tp-history-entry>summary{gap:7px;padding:10px}.tp-history-entry>summary strong{font-size:12px}.tp-history-entry>summary small{font-size:9px}
}
@media(max-width:390px){.tp-stat strong{font-size:16px}.tp-hero h1{font-size:24px}.tp-person-extra{width:100%;flex-direction:row;justify-content:flex-end;align-items:center}.tp-profile-grid{grid-template-columns:1fr 1fr}}
@media print{
  @page{size:A4 landscape;margin:12mm}
  body.tp-payroll-printing>*:not(#tp-payroll-print-root){display:none!important}
  body.tp-payroll-printing{margin:0!important;background:white!important}
  body.tp-payroll-printing #tp-payroll-print-root{display:block!important;position:static!important;width:100%!important;color:#121212!important;font:12px Arial,sans-serif!important}
  #tp-payroll-print-root .tp-print-page{display:block!important}
  #tp-payroll-print-root .tp-print-head{text-align:center;margin-bottom:18px}
  #tp-payroll-print-root .tp-print-head span{font-size:9px;letter-spacing:1.5px;color:#666}
  #tp-payroll-print-root .tp-print-head h1{font-size:21px;margin:8px 0 5px}
  #tp-payroll-print-root .tp-print-head p{margin:0;color:#777}
  #tp-payroll-print-root table{width:100%!important;border-collapse:collapse!important;font-size:11px}
  #tp-payroll-print-root th,#tp-payroll-print-root td{border:1px solid #aaa;padding:9px 8px;text-align:left}
  #tp-payroll-print-root th{background:#eee!important;-webkit-print-color-adjust:exact}
  #tp-payroll-print-root tr{break-inside:avoid}
  #tp-payroll-print-root .tp-print-total{text-align:right;font-weight:800;font-size:16px;margin-top:20px}
  #tp-payroll-print-root .tp-print-signs{display:flex;justify-content:space-between;gap:35px;margin:40px 0 24px}
  #tp-payroll-print-root .tp-print-demo{font-size:9px;color:#777;text-align:center;margin-top:30px}
}`;
document.head.appendChild(css);

})();