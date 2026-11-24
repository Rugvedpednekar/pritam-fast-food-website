/* TABLEWISE_PAYROLL_MANAGEMENT_DEMO_V3
   Browser-local demonstration. Does not post payroll or employee edits to the POS database.
   Salary basis: 30 days/month, with half days supported. */
(function(){
"use strict";
var TP_KEY="tablewise-payroll-demo-v3", TP_BASIS=30;
var TP_SECTIONS=["dashboard","employees","advances","salary","sheets","history"];
var TP_TITLES={dashboard:"Dashboard",employees:"Employees",advances:"Advances · 5th",salary:"Salary Calculator · 15th",sheets:"Payment Sheets",history:"Payroll History"};
var tpTab="dashboard",tpEditing=null,tpViewing=null,tpPhoto=null,tpPeriod="";
function tpEscape(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function tpMoney(p){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2}).format((Number(p)||0)/100);}
function parsePaise(value){var v=String(value==null?"":value).trim();if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(v))return null;var p=v.split(".");return Number(p[0])*100+Number((p[1]||"").padEnd(2,"0"));}
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
function tpDefaultPeriod(){return{advances:{},deductions:{},days:{},payments:{},snapshots:{},updatedAt:null};}
function tpSample(){
 var first=(data.restaurants&&data.restaurants[0]&&data.restaurants[0].name)||"Pritam Fast Food";
 if(/^Restaurant\s*0*1$/i.test(first))first="Pritam Fast Food";
 var second=(data.restaurants&&data.restaurants[1]&&data.restaurants[1].name)||"Restaurant 02";
 var emps=[
 {id:"demo1",name:"Aarav Patil",designation:"Head Chef",joined:"2023-04-12",restaurant:first,salary:3200000,method:"CASH",photo:"",active:true},
 {id:"demo2",name:"Meera Joshi",designation:"Restaurant Supervisor",joined:"2022-08-05",restaurant:first,salary:2850000,method:"CHEQUE",photo:"",active:true},
 {id:"demo3",name:"Ishaan Shetty",designation:"Cook",joined:"2024-01-18",restaurant:first,salary:2250000,method:"CASH",photo:"",active:true},
 {id:"demo4",name:"Ananya Naik",designation:"Cashier",joined:"2024-06-15",restaurant:first,salary:1950000,method:"CHEQUE",photo:"",active:true},
 {id:"demo5",name:"Kabir Khan",designation:"Delivery Coordinator",joined:"2023-11-10",restaurant:second,salary:2150000,method:"CASH",photo:"",active:true},
 {id:"demo6",name:"Riya Kulkarni",designation:"Kitchen Assistant",joined:"2025-02-03",restaurant:second,salary:1750000,method:"CASH",photo:"",active:true}
 ];
 var s={version:3,employees:emps,periods:{},createdAt:tpStamp()};
 var months=[tpMonth(0),tpMonth(-1),tpMonth(-2)];
 months.forEach(function(m,idx){
  var p=tpDefaultPeriod();s.periods[m]=p;
  emps.forEach(function(emp,i){
   var adv=(i%3===0?500000:i%3===1?400000:300000);
   p.advances[emp.id]={amount:adv,paid:idx>0||i!==5,paidAt:idx>0?m+"-05T10:30:00+05:30":i!==5?tpStamp():null};
   p.deductions[emp.id]={fine:i===2?15000:0,other:i===4?20000:0};
   var days=[26,25.5,27,24,26,25][i]-(idx===2?0.5:0);
   p.days[emp.id]=String(days);
   var calc=tpCompute(emp,p);
   p.snapshots[emp.id]=tpSnapshot(emp,calc,days);
   if(idx>0)p.payments[emp.id]={paid:true,amount:calc.net,method:emp.method,paidAt:m+"-15T16:20:00+05:30",snapshot:p.snapshots[emp.id]};
  });
  p.updatedAt=idx===0?tpStamp():m+"-15T16:25:00+05:30";
 });
 return s;
}
function tpValid(x){return x&&x.version===3&&Array.isArray(x.employees)&&x.periods&&typeof x.periods==="object";}
function tpRead(){try{var x=JSON.parse(localStorage.getItem(TP_KEY));if(tpValid(x))return x;}catch(err){}return tpSample();}
var tpData=tpRead(),tpPeriod=tpMonth(0);
function tpSave(){
 try{localStorage.setItem(TP_KEY,JSON.stringify(tpData));return true;}
 catch(err){uxAlert("Payroll demo cannot save on this device. Free up browser storage or use a smaller employee photo.");return false;}
}
function tpGetPeriod(month){var m=month||tpPeriod;if(!tpData.periods[m])tpData.periods[m]=tpDefaultPeriod();return tpData.periods[m];}
function tpEmployees(includeInactive){return tpData.employees.filter(function(x){return includeInactive||x.active!==false;});}
function tpEmp(id){return tpData.employees.find(function(x){return x.id===id;});}
function tpAvatar(emp,size){
 var cls="tp-avatar"+(size?" tp-avatar-"+size:"");
 return emp.photo?'<span class="'+cls+'"><img alt="" src="'+tpEscape(emp.photo)+'"></span>':'<span class="'+cls+'">'+tpEscape(String(emp.name||"Employee").split(/\s+/).slice(0,2).map(function(a){return a.charAt(0);}).join("").toUpperCase())+'</span>';
}
function tpInputDays(value){
 var s=String(value==null?"":value).trim();
 if(!/^\d{1,2}(?:\.5)?$/.test(s))return null;
 var n=Number(s);return Number.isFinite(n)&&n>=0&&n<=TP_BASIS?n:null;
}
function tpCompute(emp,period,override){
 var raw=override===undefined?period.days[emp.id]:override;
 var days=tpInputDays(raw);
 if(days===null)return null;
 var gross=tpRound(emp.salary*days/TP_BASIS);
 var a=period.advances[emp.id]||{},ded=period.deductions[emp.id]||{};
 var paidAdvance=a.paid===true?(Number(a.amount)||0):0;
 var fine=Number(ded.fine)||0,other=Number(ded.other)||0;
 var withheld=paidAdvance+fine+other;
 return {days:days,gross:gross,paidAdvance:paidAdvance,fine:fine,other:other,withheld:withheld,net:Math.max(0,gross-withheld),shortfall:Math.max(0,withheld-gross),method:emp.method};
}
function tpSnapshot(emp,c,days){
 return {name:emp.name,designation:emp.designation,restaurant:emp.restaurant,method:emp.method,monthly:emp.salary,days:days,gross:c.gross,advance:c.paidAdvance,fine:c.fine,other:c.other,net:c.net,shortfall:c.shortfall};
}
function tpRows(month){var p=tpGetPeriod(month);
 return tpEmployees(false).map(function(emp){
  return{emp:emp,advance:p.advances[emp.id]||{},deductions:p.deductions[emp.id]||{},worked:p.days[emp.id],calc:tpCompute(emp,p),payment:p.payments[emp.id]||null};
 });
}
function tpTotals(rows){
 var t={base:0,adv:0,advPaid:0,cash:0,cheque:0,ready:0,fines:0,other:0,grand:0,paidSalary:0};
 rows.forEach(function(r){
  t.base+=r.emp.salary;t.adv+=Number(r.advance.amount)||0;
  if(r.advance.paid)t.advPaid+=Number(r.advance.amount)||0;
  if(r.calc){t.ready++;t.grand+=r.calc.net;t.fines+=r.calc.fine;t.other+=r.calc.other;
   if(r.emp.method==="CHEQUE")t.cheque+=r.calc.net;else t.cash+=r.calc.net;}
  if(r.payment&&r.payment.paid)t.paidSalary++;
 });return t;
}
function tpCard(label,amount,foot,icon){return'<div class="tp-stat"><div class="tp-stat-head"><span>'+tpEscape(label)+'</span><span class="tp-stat-icon">'+icon+'</span></div><strong>'+amount+'</strong><small>'+tpEscape(foot||"")+'</small></div>';}
function tpButton(act,label,cls,extra){return'<button type="button" class="tp-button '+(cls||"")+'" data-tp-action="'+act+'" '+(extra||"")+'>'+label+'</button>';}
function tpToolbar(title,text,right){return'<div class="tp-header-row"><div><h2>'+title+'</h2><p>'+text+'</p></div>'+(right?'<div class="tp-actions">'+right+'</div>':"")+'</div>';}
function tpTable(columns,rows){return'<div class="tp-table-wrap"><table class="tp-table"><thead><tr>'+columns.map(function(x){return'<th>'+x+'</th>';}).join("")+'</tr></thead><tbody>'+rows.join("")+'</tbody></table></div>';}
function tpBadge(label,positive){return'<span class="tp-badge '+(positive?"tp-badge-positive":"tp-badge-muted")+'">'+tpEscape(label)+'</span>';}
function tpTop(){
 var active=tpEmployees().length,period=tpGetPeriod(),t=tpTotals(tpRows());
 var out='<div class="tp-app"><div class="tp-hero"><div><span class="tp-eyebrow">TABLEWISE / PEOPLE OPERATIONS</span><h1>Restaurant Payroll</h1><p>Monthly payroll, advances and payment sheets — made simple.</p><span class="tp-demo-pill">● DEMO DATA · SAVED ON THIS DEVICE ONLY</span></div><div class="tp-month-box"><label for="tp-month">Payroll month</label><input id="tp-month" type="month" value="'+tpEscape(tpPeriod)+'"><small>Advance: 5th · Salary: 15th</small></div></div>';
 out+='<nav class="tp-nav" aria-label="Payroll sections">'+TP_SECTIONS.map(function(sec){return'<button type="button" data-tp-section="'+sec+'" class="'+(tpTab===sec?"tp-active":"")+'">'+TP_TITLES[sec]+'</button>';}).join("")+'</nav>';
 return out;
}
function tpDashboard(){
 var rows=tpRows(),t=tpTotals(rows),count=tpEmployees().length;
 var out='<div class="tp-stats">'+tpCard("Total employees",String(count),"Active team members","♙")+tpCard("Monthly salary expense",tpMoney(t.base),"Base salaries before deductions","₹")+tpCard("Total advances",tpMoney(t.adv),tpMoney(t.advPaid)+" already paid","↗")+tpCard("Cash salary total",tpMoney(t.cash),"Estimated for "+tpMonthLabel(tpPeriod),"₹")+tpCard("Cheque salary total",tpMoney(t.cheque),"Estimated for "+tpMonthLabel(tpPeriod),"▤")+'</div>';
 out+='<div class="tp-two"><section class="tp-panel">'+tpToolbar("Payroll overview",tpMonthLabel(tpPeriod)+' · 30-day salary basis',tpButton("go-salary","Open Salary Calculator","tp-primary"))+
 '<div class="tp-progress"><div><strong>'+t.ready+' of '+count+'</strong><span>salary calculations ready</span></div><div class="tp-track"><i style="width:'+(count?Math.round(t.ready/count*100):0)+'%"></i></div></div>'+
 '<div class="tp-summary-row"><span>Salary payable</span><strong>'+tpMoney(t.grand)+'</strong></div>'+
 '<div class="tp-summary-row"><span>Paid advances to deduct</span><strong>'+tpMoney(t.advPaid)+'</strong></div>'+
 '<div class="tp-summary-row"><span>Fines and other deductions</span><strong>'+tpMoney(t.fines+t.other)+'</strong></div>'+
 '<div class="tp-note">Formula: monthly salary ÷ 30 × days worked, minus advances that were actually paid and any saved fines or deductions.</div></section>';
 out+='<section class="tp-panel">'+tpToolbar("Upcoming payroll steps","The 5th and 15th are guidance dates; these actions can be performed any day.","")+
 '<div class="tp-step"><span>05</span><div><strong>Advance Distribution</strong><p>Prepare and record cash advances.</p></div>'+tpButton("go-advances","Open","tp-light")+'</div>'+
 '<div class="tp-step"><span>15</span><div><strong>Salary Calculation</strong><p>Enter days worked; deductions apply automatically.</p></div>'+tpButton("go-salary","Open","tp-light")+'</div>'+
 '<div class="tp-step"><span>✓</span><div><strong>Payment Sheets</strong><p>Generate cash and cheque lists separately.</p></div>'+tpButton("go-sheets","Open","tp-light")+'</div></section></div>';
 return out;
}
function tpEmployeeProfile(emp){
 return'<section class="tp-panel tp-profile"><div class="tp-profile-head">'+tpAvatar(emp,"large")+'<div><span class="tp-eyebrow">EMPLOYEE PROFILE</span><h3>'+tpEscape(emp.name)+'</h3><p>'+tpEscape(emp.designation)+'</p></div><button type="button" class="tp-x" data-tp-action="close-profile" aria-label="Close employee profile">×</button></div>'+
 '<div class="tp-profile-grid"><div><small>Restaurant</small><strong>'+tpEscape(emp.restaurant)+'</strong></div><div><small>Joining date</small><strong>'+tpDate(emp.joined)+'</strong></div><div><small>Monthly salary</small><strong>'+tpMoney(emp.salary)+'</strong></div><div><small>Payment method</small><strong>'+tpEscape(emp.method)+'</strong></div></div>'+
 '<div class="tp-actions">'+tpButton("edit-employee","Edit profile","tp-primary",'data-id="'+tpEscape(emp.id)+'"')+tpButton("close-profile","Close","tp-light")+'</div></section>';
}
function tpEmployeeForm(emp){
 var values=emp||{id:"",name:"",designation:"",joined:tpToday(),restaurant:(data.restaurants.find(function(r){return r.active!==false;})||{}).name||"Pritam Fast Food",salary:1800000,method:"CASH",photo:""};
 var possible=(data.restaurants||[]).filter(function(r){return r.active!==false;}).map(function(r){return r.name;});
 if(values.restaurant&&!possible.includes(values.restaurant))possible.push(values.restaurant);
 if(!possible.length)possible=["Pritam Fast Food"];
 var pic=tpPhoto!==null?tpPhoto:values.photo;
 var out='<section class="tp-panel tp-form-panel"><div class="tp-header-row"><div><h3>'+(emp?"Edit employee":"Add employee")+'</h3><p>These changes affect the payroll demo only.</p></div><button type="button" class="tp-x" data-tp-action="cancel-employee" aria-label="Close form">×</button></div>'+
 '<form id="tp-employee-form" class="tp-form"><div class="tp-photo-box">'+(pic?'<img class="tp-form-photo" src="'+tpEscape(pic)+'" alt="Employee photo">':'<div class="tp-photo-placeholder">Photo</div>')+'<div><label for="tp-photo">Employee photo (optional)</label><input type="file" id="tp-photo" accept="image/jpeg,image/png,image/webp"><small>Stored only on this device. Images are resized automatically.</small></div></div>'+
 '<div class="tp-form-grid"><div class="tp-field"><label for="tp-name">Employee name *</label><input id="tp-name" name="name" required maxlength="90" value="'+tpEscape(values.name)+'" placeholder="Full name"></div>'+
 '<div class="tp-field"><label for="tp-role">Designation *</label><input id="tp-role" name="designation" required maxlength="90" value="'+tpEscape(values.designation)+'" placeholder="Chef, cashier, server..."></div>'+
 '<div class="tp-field"><label for="tp-joined">Joining date *</label><input id="tp-joined" name="joined" type="date" required value="'+tpEscape(values.joined)+'"></div>'+
 '<div class="tp-field"><label for="tp-restaurant">Restaurant *</label><select id="tp-restaurant" name="restaurant">'+possible.map(function(name){return'<option value="'+tpEscape(name)+'" '+(name===values.restaurant?"selected":"")+'>'+tpEscape(name)+'</option>';}).join("")+'</select></div>'+
 '<div class="tp-field"><label for="tp-salary">Monthly salary (₹) *</label><input id="tp-salary" name="salary" inputmode="decimal" required value="'+(values.salary/100).toFixed(2)+'"></div>'+
 '<div class="tp-field"><label for="tp-method">Payment method *</label><select id="tp-method" name="method"><option value="CASH" '+(values.method==="CASH"?"selected":"")+'>CASH</option><option value="CHEQUE" '+(values.method==="CHEQUE"?"selected":"")+'>CHEQUE</option></select></div></div>'+
 '<div class="tp-actions"><button class="tp-button tp-primary" type="submit">'+(emp?"Save employee":"Add employee")+'</button>'+tpButton("cancel-employee","Cancel","tp-light")+'</div></form></section>';
 return out;
}
function tpEmployeesPage(){
 var emps=tpEmployees(true),active=tpEmployees().length;
 var out='<section class="tp-panel">'+tpToolbar("Employee Management",active+" active employees · "+emps.length+" total profiles",tpButton("new-employee","+ Add Employee","tp-primary"))+
 '<div class="tp-employee-grid">'+emps.map(function(emp){
 return'<article class="tp-person">'+tpAvatar(emp)+'<div class="tp-person-main"><h3>'+tpEscape(emp.name)+'</h3><p>'+tpEscape(emp.designation)+'</p><small>'+tpEscape(emp.restaurant)+'</small></div><div class="tp-person-extra"><strong>'+tpMoney(emp.salary)+'</strong>'+tpBadge(emp.method,emp.method==="CASH")+(emp.active===false?tpBadge("Archived",false):"")+'</div><div class="tp-person-buttons">'+tpButton("view-employee","View","tp-light",'data-id="'+tpEscape(emp.id)+'"')+tpButton("edit-employee","Edit","tp-light",'data-id="'+tpEscape(emp.id)+'"')+'</div></article>';
 }).join("")+'</div></section>';
 if(tpEditing!==null)out=tpEmployeeForm(tpEditing==="new"?null:tpEmp(tpEditing))+out;
 else if(tpViewing){var emp=tpEmp(tpViewing);if(emp)out=tpEmployeeProfile(emp)+out;}
 return out;
}
function tpAdvances(){
 var rows=tpRows(),total=tpTotals(rows);
 var out='<div class="tp-stats tp-stats-three">'+tpCard("Advance required",tpMoney(total.adv),"Planned advances for "+tpMonthLabel(tpPeriod),"₹")+tpCard("Advance paid",tpMoney(total.advPaid),"Only paid advances reduce salary","✓")+tpCard("Still to distribute",tpMoney(total.adv-total.advPaid),"Pending employee advances","⏳")+'</div>';
 out+='<section class="tp-panel">'+tpToolbar("Advance Management · 5th","Enter amounts, mark each payment as distributed and keep fines separate from salary entry.",tpButton("print-advance","Print Distribution Sheet","tp-primary")+tpButton("csv-advance","Download CSV","tp-light"))+
 '<div class="tp-note">Only advances marked <strong>Paid</strong> are deducted automatically from the salary paid on the 15th. Fines and other deductions are entered here, not in the Salary Calculator.</div>';
 out+=tpTable(["Employee / designation","Advance (₹)","Paid on 5th?","Fine (₹)","Other deduction (₹)"],rows.map(function(r){
 var id=tpEscape(r.emp.id),paid=r.advance.paid===true,hasPaidSalary=!!(r.payment&&r.payment.paid);
 return'<tr data-tp-adv-row="'+id+'"><td><div class="tp-person-cell">'+tpAvatar(r.emp,"small")+'<div><strong>'+tpEscape(r.emp.name)+'</strong><small>'+tpEscape(r.emp.designation)+'</small></div></div></td>'+
 '<td><input class="tp-cell-input" data-tp-field="advance" data-id="'+id+'" inputmode="decimal" value="'+((r.advance.amount||0)/100).toFixed(2)+'" '+(hasPaidSalary?"disabled":"")+'></td>'+
 '<td><label class="tp-check"><input type="checkbox" data-tp-field="advancepaid" data-id="'+id+'" '+(paid?"checked":"")+' '+(hasPaidSalary?"disabled":"")+'> '+(paid?"Paid":"Not paid")+'</label></td>'+
 '<td><input class="tp-cell-input" inputmode="decimal" data-tp-field="fine" data-id="'+id+'" value="'+((r.deductions.fine||0)/100).toFixed(2)+'" '+(hasPaidSalary?"disabled":"")+'></td>'+
 '<td><input class="tp-cell-input" inputmode="decimal" data-tp-field="other" data-id="'+id+'" value="'+((r.deductions.other||0)/100).toFixed(2)+'" '+(hasPaidSalary?"disabled":"")+'></td></tr>';
 }))+'<div class="tp-note">✓ Changes are saved automatically in this browser. Rows with recorded salary payments are locked to preserve payroll history.</div></section>';
 return out;
}
function tpSalary(){
 var rows=tpRows(),total=tpTotals(rows);
 var out='<div class="tp-stats tp-stats-three">'+tpCard("Salary calculated",tpMoney(total.grand),total.ready+" of "+rows.length+" employees completed","₹")+tpCard("Advances deducted",tpMoney(total.advPaid),"Paid advances only","↘")+tpCard("Salary balance",tpMoney(total.grand),"Cash and cheque combined","✓")+'</div>';
 out+='<section class="tp-panel">'+tpToolbar("Salary Calculator · 15th","Only enter days worked. Salary, paid advances, fines and other deductions are filled automatically.",tpButton("go-sheets","View Payment Sheets","tp-primary"))+
 '<div class="tp-note"><strong>Calculation basis:</strong> monthly salary ÷ 30 × days worked (supports half days such as 22.5). The month is selected above. Advancements marked unpaid are not deducted.</div>'+
 tpTable(["Employee / designation","Monthly salary","Days worked (only input)","Earned salary","Advance paid","Fine + other","Net salary"],rows.map(function(r){
 var id=tpEscape(r.emp.id),c=r.calc,paid=!!(r.payment&&r.payment.paid);
 var advance=r.advance.paid?(Number(r.advance.amount)||0):0;
 var ded=(Number(r.deductions.fine)||0)+(Number(r.deductions.other)||0);
 return'<tr data-tp-salary-row="'+id+'"><td><div class="tp-person-cell">'+tpAvatar(r.emp,"small")+'<div><strong>'+tpEscape(r.emp.name)+'</strong><small>'+tpEscape(r.emp.designation)+'</small></div></div></td>'+
 '<td>'+tpMoney(r.emp.salary)+'</td>'+
 '<td><input aria-label="Days worked for '+tpEscape(r.emp.name)+'" class="tp-days-input" type="number" min="0" max="30" step="0.5" placeholder="e.g. 22.5" data-tp-field="days" data-id="'+id+'" value="'+tpEscape(r.worked==null?"":r.worked)+'" '+(paid?"disabled":"")+'><small class="tp-days-hint">'+(paid?"Paid · locked":"0–30, half days allowed")+'</small></td>'+
 '<td data-tp-salary-value="gross">'+(c?tpMoney(c.gross):"Enter days")+'</td>'+
 '<td>'+tpMoney(advance)+'</td><td>'+tpMoney(ded)+'</td>'+
 '<td><strong data-tp-salary-value="net">'+(c?tpMoney(c.net):"—")+'</strong>'+(c&&c.shortfall?'<small class="tp-warning">Excess deductions '+tpMoney(c.shortfall)+'</small>':"")+'</td></tr>';
 }))+
 '<div class="tp-note">Salary calculations save automatically on this device. To correct a paid salary, first remove its Paid status in Payment Sheets.</div></section>';
 return out;
}
function tpSheets(){
 var rows=tpRows(),t=tpTotals(rows);
 var out='<div class="tp-stats tp-stats-three">'+tpCard("Total cash payable",tpMoney(t.cash),"Cash salary distribution","₹")+tpCard("Total cheque payable",tpMoney(t.cheque),"Cheque salary distribution","▤")+tpCard("Grand total",tpMoney(t.grand),"Both payment methods combined","✓")+'</div>';
 out+='<div class="tp-two tp-sheets-layout">';
 ["CASH","CHEQUE"].forEach(function(method){
  var matches=rows.filter(function(r){return r.emp.method===method;}),sum=matches.reduce(function(s,r){return s+(r.calc?r.calc.net:0);},0);
  out+='<section class="tp-panel"><div class="tp-sheet-title"><div><span class="tp-eyebrow">'+method+' PAYROLL</span><h2>'+method+' SHEET</h2><p>'+tpMonthLabel(tpPeriod)+'</p></div><span class="tp-sheet-symbol">'+(method==="CASH"?"₹":"▤")+'</span></div>'+
  '<div class="tp-actions tp-sheet-actions">'+tpButton("print-"+method.toLowerCase(),"Print "+method+" Sheet","tp-primary")+tpButton("csv-"+method.toLowerCase(),"Download CSV","tp-light")+'</div>'+
  tpTable(["Employee","Designation","Net salary","Paid?"],matches.map(function(r){
    var payment=r.payment||{};
    return'<tr><td><strong>'+tpEscape(r.emp.name)+'</strong></td><td>'+tpEscape(r.emp.designation)+'</td><td><strong>'+(r.calc?tpMoney(r.calc.net):"Enter days")+'</strong></td><td><label class="tp-check"><input type="checkbox" data-tp-field="salarypaid" data-id="'+tpEscape(r.emp.id)+'" '+(payment.paid?"checked":"")+' '+(!r.calc?"disabled":"")+' aria-label="Salary paid for '+tpEscape(r.emp.name)+'"> '+(payment.paid?"Paid":"Pending")+'</label></td></tr>';
  }))+'<div class="tp-sheet-total"><span>Total '+method.toLowerCase()+' payable</span><strong>'+tpMoney(sum)+'</strong></div>'+
  '<p class="tp-note">Mark Paid when a salary has actually been distributed. Payment status is saved in Payroll History.</p></section>';
 });
 out+='</div><div class="tp-grand"><span>Combined cash + cheque</span><strong>'+tpMoney(t.grand)+'</strong><small>'+t.ready+' of '+rows.length+' employees calculated</small></div>';
 return out;
}
function tpHistory(){
 var months=Object.keys(tpData.periods).sort().reverse();
 var out='<section class="tp-panel">'+tpToolbar("Payroll History","Previous advance distributions, calculated salaries and payment records","")+
 '<div class="tp-history-list">'+months.map(function(month){
  var p=tpGetPeriod(month),employees=tpData.employees.filter(function(e){return e.active!==false||Object.prototype.hasOwnProperty.call(p.days,e.id)||Object.prototype.hasOwnProperty.call(p.advances,e.id);});
  var net=0,adv=0,paid=0,completed=0;
  var detail=employees.map(function(emp){
   var a=p.advances[emp.id]||{},pay=p.payments[emp.id]||{},snapshot=pay.snapshot||p.snapshots[emp.id]||tpSnapshot(emp,tpCompute(emp,p)||{gross:0,paidAdvance:0,fine:0,other:0,net:0,shortfall:0},p.days[emp.id]??"");
   var amount=Number(snapshot.net)||0;
   net+=amount;if(a.paid)adv+=Number(a.amount)||0;
   if(pay.paid)paid++;if(p.days[emp.id]!==undefined)completed++;
   return'<tr><td>'+tpEscape(snapshot.name||emp.name)+'</td><td>'+tpEscape(snapshot.designation||emp.designation)+'</td><td>'+tpEscape(p.days[emp.id]??"—")+'</td><td>'+tpMoney(a.paid?a.amount||0:0)+'</td><td>'+tpMoney(amount)+'</td><td>'+tpBadge(pay.paid?"Paid":"Pending",!!pay.paid)+'</td></tr>';
  });
  return'<details class="tp-history-entry" '+(month===tpPeriod?'open':'')+'><summary><div><strong>'+tpMonthLabel(month)+'</strong><small>'+completed+' salaries calculated · '+paid+' salary payments recorded</small></div><div><strong>'+tpMoney(net)+'</strong><small>Paid advances '+tpMoney(adv)+'</small></div><span class="tp-chevron">⌄</span></summary>'+tpTable(["Employee","Designation","Days worked","Paid advance","Net salary","Salary status"],detail)+'</details>';
 }).join("")+'</div></section>';
 if(!months.length)out+='<div class="tp-note">No payroll history yet. Enter advances or salary days to create a monthly record.</div>';
 return out;
}
function tpRender(){
 var out=tpTop();
 if(tpTab==="dashboard")out+=tpDashboard();
 else if(tpTab==="employees")out+=tpEmployeesPage();
 else if(tpTab==="advances")out+=tpAdvances();
 else if(tpTab==="salary")out+=tpSalary();
 else if(tpTab==="sheets")out+=tpSheets();
 else out+=tpHistory();
 return out+'<footer class="tp-footer">Tablewise Payroll Demo · Local sample data only · Not a payroll or statutory compliance system</footer></div>';
}

payroll=tpRender;
function tpTouch(period){
 period.updatedAt=tpStamp();
 if(!tpSave())return false;
 draw();return true;
}
function tpSetTab(sec){
 if(!TP_SECTIONS.includes(sec))return;
 tpTab=sec;tpEditing=null;tpViewing=null;tpPhoto=null;draw();
 try{document.querySelector(".tp-app")?.scrollIntoView({behavior:"smooth",block:"start"});}catch(err){}
}
function tpCsv(name,rows){
 var csv="\ufeff"+rows.map(function(row){return row.map(function(cell){return '"'+String(cell==null?"":cell).replace(/"/g,'""')+'"';}).join(",");}).join("\r\n");
 var blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;a.style.display="none";document.body.appendChild(a);a.click();a.remove();
 setTimeout(function(){URL.revokeObjectURL(url);},1500);
}
function tpPrintableTable(title,subtitle,heads,rows,summary,signatures){
 var output='<div class="tp-print-page"><div class="tp-print-head"><span>TABLEWISE RESTAURANT PAYROLL · DEMONSTRATION</span><h1>'+tpEscape(title)+'</h1><p>'+tpEscape(subtitle)+'</p></div>';
 output+='<table><thead><tr>'+heads.map(function(x){return'<th>'+tpEscape(x)+'</th>';}).join("")+'</tr></thead><tbody>'+
 rows.map(function(r){return'<tr>'+r.map(function(cell){return'<td>'+tpEscape(cell)+'</td>';}).join("")+'</tr>';}).join("")+'</tbody></table>';
 output+='<div class="tp-print-total">'+tpEscape(summary)+'</div>';
 if(signatures)output+='<div class="tp-print-signs"><span>Prepared by: ___________________</span><span>Authorised by: ___________________</span></div>';
 return output+'<p class="tp-print-demo">Sample payroll demonstration · Not a statutory payslip or payment authorisation</p></div>';
}
function tpDoPrint(kind){
 var p=tpGetPeriod(),rows=tpRows(),title,sub,heads,records,total=0;
 if(kind==="advance"){
  title="Advance Distribution Sheet";
  sub=tpMonthLabel(tpPeriod)+" · Scheduled distribution: 5th";
  heads=["Employee","Designation","Advance (₹)","Paid?","Signature"];
  records=rows.map(function(r){
    var amount=Number(r.advance.amount)||0;total+=amount;
    return[r.emp.name,r.emp.designation,(amount/100).toFixed(2),r.advance.paid?"Yes":"No",""];
  });
 }else{
  var method=kind.toUpperCase();
  title=method+" Salary Sheet";
  sub=tpMonthLabel(tpPeriod)+" · Scheduled salary distribution: 15th";
  heads=["Employee","Designation","Net salary (₹)","Signature"];
  records=rows.filter(function(r){return r.emp.method===method;}).map(function(r){
    var n=r.calc?r.calc.net:0;total+=n;
    return[r.emp.name,r.emp.designation,r.calc?(n/100).toFixed(2):"Not calculated",""];
  });
 }
 if(!records.length)return uxAlert("No employee rows to print.");
 var printRoot=document.getElementById("tp-payroll-print-root");
 if(!printRoot){printRoot=document.createElement("div");printRoot.id="tp-payroll-print-root";document.body.appendChild(printRoot);}
 printRoot.innerHTML=tpPrintableTable(title,sub,heads,records,(kind==="advance"?"Total advance required: ":"Total "+kind.toUpperCase()+" payable: ")+tpMoney(total),true);
 document.body.classList.add("tp-payroll-printing");
 window.print();
}
window.addEventListener("afterprint",function(){document.body.classList.remove("tp-payroll-printing");});
function tpDoCSV(kind){
 var rows=tpRows(),out;
 if(kind==="advance"){
  out=[["Month","Employee","Designation","Advance INR","Advance paid","Fine INR","Other deduction INR"]];
  rows.forEach(function(r){out.push([tpPeriod,r.emp.name,r.emp.designation,((r.advance.amount||0)/100).toFixed(2),r.advance.paid?"YES":"NO",((r.deductions.fine||0)/100).toFixed(2),((r.deductions.other||0)/100).toFixed(2)]);});
 }else{
  var method=kind.toUpperCase();out=[["Month","Employee","Designation","Net salary INR","Salary paid"]];
  rows.filter(function(r){return r.emp.method===method;}).forEach(function(r){
    out.push([tpPeriod,r.emp.name,r.emp.designation,r.calc?(r.calc.net/100).toFixed(2):"Not calculated",r.payment&&r.payment.paid?"YES":"NO"]);
  });
 }
 tpCsv("restaurant-"+kind+"-sheet-"+tpPeriod+".csv",out);
}
function tpNewEmployee(){
 tpEditing="new";tpViewing=null;tpPhoto=null;tpSetTab("employees");tpEditing="new";draw();
}
function tpHandleAction(button){
 var act=button.dataset.tpAction,id=button.dataset.id;
 if(act==="go-salary")return tpSetTab("salary");
 if(act==="go-advances")return tpSetTab("advances");
 if(act==="go-sheets")return tpSetTab("sheets");
 if(act==="new-employee")return tpNewEmployee();
 if(act==="view-employee"){tpViewing=id;tpEditing=null;tpPhoto=null;return draw();}
 if(act==="edit-employee"){tpEditing=id;tpViewing=null;tpPhoto=null;return draw();}
 if(act==="cancel-employee"||act==="close-profile"){tpEditing=null;tpViewing=null;tpPhoto=null;return draw();}
 if(act==="print-advance")return tpDoPrint("advance");
 if(act==="print-cash")return tpDoPrint("cash");
 if(act==="print-cheque")return tpDoPrint("cheque");
 if(act==="csv-advance")return tpDoCSV("advance");
 if(act==="csv-cash")return tpDoCSV("cash");
 if(act==="csv-cheque")return tpDoCSV("cheque");
}
document.addEventListener("click",function(ev){
 if(tab!=="payroll")return;
 var route=ev.target.closest&&ev.target.closest("button[data-tp-section]");
 if(route){ev.preventDefault();ev.stopImmediatePropagation();return tpSetTab(route.dataset.tpSection);}
 var button=ev.target.closest&&ev.target.closest("button[data-tp-action]");
 if(button){ev.preventDefault();ev.stopImmediatePropagation();return tpHandleAction(button);}
},true);
document.addEventListener("submit",function(ev){
 if(!ev.target||ev.target.id!=="tp-employee-form")return;
 ev.preventDefault();ev.stopImmediatePropagation();
 var form=ev.target;
 var name=tpTrim(form.elements.name.value,90),designation=tpTrim(form.elements.designation.value,90),joined=form.elements.joined.value;
 var restaurant=tpTrim(form.elements.restaurant.value,90),salary=parsePaise(form.elements.salary.value),method=form.elements.method.value;
 if(!name||!designation||!restaurant||!/^\d{4}-\d{2}-\d{2}$/.test(joined)||salary===null||salary<=0||!["CASH","CHEQUE"].includes(method)){
  uxAlert("Enter a name, designation, valid joining date, restaurant, monthly salary and payment method.");return;
 }
 if(salary>1000000000)return uxAlert("For this demo, monthly salary must be at most ₹1,00,00,000.");
 var existing=tpEditing&&tpEditing!=="new"?tpEmp(tpEditing):null;
 if(tpEditing!=="new"&&!existing)return uxAlert("Employee no longer exists. Refresh Payroll.");
 var before=JSON.stringify(tpData);
 if(existing){
  Object.assign(existing,{name:name,designation:designation,joined:joined,restaurant:restaurant,salary:salary,method:method,photo:tpPhoto===null?existing.photo:tpPhoto});
 }else{
  var added={id:tpId(),name:name,designation:designation,joined:joined,restaurant:restaurant,salary:salary,method:method,photo:tpPhoto||"",active:true};
  tpData.employees.push(added);
 }
 if(!tpSave()){tpData=JSON.parse(before);return;}
 tpEditing=null;tpViewing=null;tpPhoto=null;draw();showToast("Employee saved to Payroll Demo on this device.");
},true);
document.addEventListener("change",function(ev){
 var field=ev.target;
 if(tab!=="payroll")return;
 if(field.id==="tp-month"){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(field.value)){uxAlert("Please select a valid payroll month.");return;}
  tpPeriod=field.value;draw();return;
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
 if(p.payments[id]&&p.payments[id].paid&&name!=="salarypaid"){
  uxAlert("This salary is marked Paid. Unmark it in Payment Sheets before editing these values.");draw();return;
 }
 var old=JSON.stringify(tpData);
 if(name==="days"){
  var days=tpInputDays(field.value);
  if(days===null&&field.value.trim()!==""){uxAlert("Days worked must be 0 to 30 in half-day steps, such as 22.5, 25 or 26.");draw();return;}
  if(!field.value.trim()){delete p.days[id];delete p.snapshots[id];}
  else{
   p.days[id]=String(days);
   var c=tpCompute(emp,p);if(c)p.snapshots[id]=tpSnapshot(emp,c,days);
  }
 }else if(name==="advance"||name==="fine"||name==="other"){
  var value=parsePaise(field.value);
  if(value===null||value>100000000){uxAlert("Enter a valid amount from ₹0 to ₹10,00,000.");draw();return;}
  if(name==="advance"){
   var a=p.advances[id]||{amount:0,paid:false,paidAt:null};
   if(a.amount!==value){a.amount=value;a.paid=false;a.paidAt=null;}
   p.advances[id]=a;
  }else{
   var d=p.deductions[id]||{fine:0,other:0};d[name]=value;p.deductions[id]=d;
  }
  var refreshed=tpCompute(emp,p);if(refreshed)p.snapshots[id]=tpSnapshot(emp,refreshed,refreshed.days);
 }else if(name==="advancepaid"){
  var advance=p.advances[id]||{amount:0,paid:false};
  if(field.checked&&!(advance.amount>0)){uxAlert("Enter a positive advance amount before marking it Paid.");draw();return;}
  advance.paid=field.checked;advance.paidAt=field.checked?tpStamp():null;p.advances[id]=advance;
  var c2=tpCompute(emp,p);if(c2)p.snapshots[id]=tpSnapshot(emp,c2,c2.days);
 }else if(name==="salarypaid"){
  var c3=tpCompute(emp,p);
  if(field.checked&&!c3){uxAlert("Enter days worked before marking the salary paid.");draw();return;}
  if(field.checked){p.payments[id]={paid:true,amount:c3.net,method:emp.method,paidAt:tpStamp(),snapshot:tpSnapshot(emp,c3,c3.days)};}
  else{
   if(!confirm("Remove the recorded salary payment for "+emp.name+"?")){draw();return;}
   delete p.payments[id];
  }
 }else return;
 p.updatedAt=tpStamp();
 if(!tpSave())tpData=JSON.parse(old);
 draw();
},true);
document.addEventListener("input",function(ev){
 if(tab!=="payroll"||ev.target.dataset.tpField!=="days")return;
 var field=ev.target,emp=tpEmp(field.dataset.id),p=tpGetPeriod();
 if(!emp)return;
 var c=tpCompute(emp,p,field.value),tr=field.closest("tr");
 if(!tr)return;
 var gross=tr.querySelector('[data-tp-salary-value="gross"]'),net=tr.querySelector('[data-tp-salary-value="net"]');
 if(gross)gross.textContent=c?tpMoney(c.gross):"Enter valid days";
 if(net)net.textContent=c?tpMoney(c.net):"—";
},true);
window.addEventListener("storage",function(ev){
 if(ev.key!==TP_KEY)return;
 try{var incoming=JSON.parse(ev.newValue);if(tpValid(incoming)){tpData=incoming;if(tab==="payroll")draw();}}catch(err){}
});
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
.tp-form-panel{border-color:#b2dfca}.tp-form{display:grid;gap:17px}.tp-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
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
.tp-cell-input,.tp-days-input{border:1px solid #d7e3e8;background:white;color:#264457;padding:9px;border-radius:9px;min-width:90px;width:104px;font-size:12px}
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