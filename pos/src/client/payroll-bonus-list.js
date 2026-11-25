/* Bonus attendance ledger: preserves each recorded payroll month's ID and days. */
/* Nested inside payroll archive IIFE to reuse the permanent person and branch helpers. */
(function(){
"use strict";
TP_SECTIONS.splice(TP_SECTIONS.indexOf("sheets")+1,0,"bonus");
TP_TITLES.bonus="Bonus List";
var tpBonusOutletFilter="all";

function tpBonusMonthShift(month,diff){
 var parts=String(month||tpPeriod).split("-").map(Number);
 return new Date(Date.UTC(parts[0],parts[1]-1+diff,1)).toISOString().slice(0,7);
}
function tpBonusBasis(){
 var value=Number(tpData.settings&&tpData.settings.bonusDaysPerMonth);
 return Number.isSafeInteger(value)&&value>=1&&value<=31?value:null;
}
function tpBonusMonths(){
 // Strictly twelve calendar months, even where attendance is missing.
 return Array.from({length:12},function(_,index){return tpBonusMonthShift(tpPeriod,index-11);});
}
function tpBonusCreditedMonths(workdays,basis){
 return basis===null?null:Math.min(12,Math.max(0,Number(workdays)||0)/basis);
}
function tpBonusFullRows(){
 var entries=[];
 tpBonusMonths().forEach(function(month){
  var period=tpData.periods[month]||{},days=period.days||{},serials=period.serials||{},snapshots=period.snapshots||{};
  var employeeIds=new Set(Object.keys(days).concat(Object.keys(snapshots)));
  employeeIds.forEach(function(id){
   var emp=tpEmp(id);
   if(!emp)return;
   var saved=Object.prototype.hasOwnProperty.call(days,id)?days[id]:(snapshots[id]&&snapshots[id].days);
   var worked=tpInputDays(saved);
   if(worked===null)return;
   var snapshot=snapshots[id]||{};
   // The snapshot stores the restaurant at the time the attendance was taken.
   // Never attribute a historical month to a transferred employee's current outlet.
   var outlet=String(snapshot.restaurant||((period.bonusOutlets||{})[id]&&period.bonusOutlets[id].restaurant)||"");
   var outletId=((period.bonusOutlets||{})[id]&&period.bonusOutlets[id].restaurantId)||"";
   if(!outlet){
    // Legacy rows with no location evidence must be flagged, rather than silently
    // attributing all earlier attendance to today's outlet.
    outlet="Outlet not recorded";
   }else if(!outletId){
    var known=(data.restaurants||[]).filter(function(r){return r.name===outlet;});
    if(known.length===1)outletId=known[0].id;
   }
   entries.push({employee:emp,personId:tpArcPersonId(emp),month:month,
    employeeId:id,outlet:outlet,outletId:outletId,monthlyId:tpSerialValue(serials[id]),
    workedDays:worked,source:snapshot.restaurant?"Historic attendance snapshot":"Monthly attendance entry"});
  });
 });
 return entries.sort(function(a,b){
  return a.employee.name.localeCompare(b.employee.name)||a.month.localeCompare(b.month)||
   a.employeeId.localeCompare(b.employeeId);
 });
}
function tpBonusPersonSummary(rows){
 var groups=new Map();
 rows.forEach(function(row){
  var person=groups.get(row.personId);
  if(!person){
   person={personId:row.personId,name:row.employee.name,days:0,months:new Set(),outlets:new Set(),records:0};
   groups.set(row.personId,person);
  }
  person.name=row.employee.name;person.days+=row.workedDays;
  person.months.add(row.month);
  if(row.outlet!=="Outlet not recorded")person.outlets.add(row.outlet);
  person.records++;
 });
 return Array.from(groups.values()).sort(function(a,b){return a.name.localeCompare(b.name);});
}
function tpBonusMatrix(rows,basis){
 var months=tpBonusMonths(),people=tpBonusPersonSummary(rows),grouped=new Map();
 rows.forEach(function(row){
  var key=row.personId+"|"+row.month,arr=grouped.get(key)||[];
  arr.push(row);grouped.set(key,arr);
 });
 var headings=["Employee"].concat(months.map(function(month){return tpEscape(tpMonthLabel(month));})).concat(["Total days","Credited months / 12"]);
 var body=people.map(function(person){
  var cells=months.map(function(month){
   var monthRows=grouped.get(person.personId+"|"+month)||[];
   if(!monthRows.length)return '<td class="tp-bonus-blank">—</td>';
   return '<td class="tp-bonus-month-cell">'+monthRows.map(function(r){
    return '<div><strong>ID '+(r.monthlyId===null?"—":r.monthlyId)+'</strong> · '+r.workedDays+' days'+
     '<small>'+tpEscape(r.outlet)+'</small></div>';
   }).join("")+'</td>';
  }).join("");
  return '<tr><td><strong>'+tpEscape(person.name)+'</strong></td>'+cells+
   '<td><strong>'+person.days+'</strong></td>'+
   '<td><strong>'+(basis===null?"Set rule":tpBonusCreditedMonths(person.days,basis).toFixed(2))+
   '</strong></td></tr>';
 });
 return '<div class="tp-bonus-matrix"><p class="tp-note"><strong>Exactly 12 monthly columns.</strong> Each cell shows that month’s employee ID, days worked, and outlet. Older months remain in historical payroll but never become a 13th bonus month.</p>'+
  tpTable(headings,body)+'</div>';
}
function tpBonusDisplayedRows(rows){
 if(tpBonusOutletFilter==="all")return rows;
 return rows.filter(function(row){return row.outletId===tpBonusOutletFilter;});
}
function tpBonusList(){
 var all=tpBonusFullRows(),rows=tpBonusDisplayedRows(all),persons=tpBonusPersonSummary(all),
  basis=tpBonusBasis(),threshold=basis===null?null:basis*11,unique=persons.length,
  full=basis===null?null:persons.filter(function(p){return p.days>=threshold;}).length,
  visibleDays=rows.reduce(function(sum,r){return sum+r.workedDays;},0);
 var options='<option value="all"'+(tpBonusOutletFilter==="all"?" selected":"")+
  '>All outlets · Company-wide bonus</option>'+
  (data.restaurants||[]).filter(function(r){return r.active!==false;}).map(function(outlet){
   return '<option value="'+tpEscape(outlet.id)+'"'+(tpBonusOutletFilter===outlet.id?" selected":"")+
    '>'+tpEscape(outlet.name)+'</option>';
  }).join("");
 var stats='<div class="tp-stats tp-stats-three">'+
  tpCard("Employees with attendance",String(unique),"Across all outlets in bonus period","♙")+
  tpCard("Days shown",String(visibleDays),"Actual worked days, not earned paid leave","▦")+
  tpCard("Full bonus eligible",basis===null?"Set days / month":String(full),
   basis===null?"11-month rule needs a days-to-month conversion":"At least "+threshold+" actual worked days","✓")+'</div>';
 var form='<section class="tp-panel">'+tpToolbar("Bonus Attendance List",
  'Monthly employee IDs, worked days and their original outlet are preserved for every payroll month.',
  tpButton("pdf-bonus-list","Download Bonus List PDF","tp-light"))+
  '<p class="tp-note">A row represents the employee’s actual work in a particular month, using the <strong>Monthly ID assigned in that month</strong>. When somebody transfers or rejoins, older monthly IDs and days stay in their original records. All-outlet totals combine the employee’s linked employment periods.</p>'+
  '<div class="tp-form-grid">'+
  '<div class="tp-field"><label for="tp-bonus-outlet">Bonus report · Outlet</label>'+
   '<select id="tp-bonus-outlet">'+options+'</select></div>'+
  '<div class="tp-field"><label>Bonus period</label><div class="tp-bonus-period">'+
  tpEscape(tpMonthLabel(tpBonusMonthShift(tpPeriod,-11)))+' – '+tpEscape(tpMonthLabel(tpPeriod))+
  '<small>Rolling 12 months ending in the selected payroll month above</small></div></div></div>'+
  '<form id="tp-bonus-basis-form" class="tp-bonus-settings"><label for="tp-bonus-days-month">Actual workdays equal to one bonus month *</label>'+
  '<div class="tp-actions"><input id="tp-bonus-days-month" type="number" min="1" max="31" step="1" inputmode="numeric" placeholder="e.g. 26 or 30" value="'+
  (basis===null?"":basis)+'">'+
  '<button class="tp-button tp-primary" type="submit">Save Bonus Rule</button></div>'+
  '<p class="tp-note">11 equivalent months qualify for full bonus. <strong>Bonus credit is capped at 12 equivalent months per employee, never 13 or more</strong>, even if actual days ÷ the configured conversion rate exceeds 12. Actual worked days remain in history. No bonus amount is calculated until a payout policy is defined.</p></form>'+
  '<h3>12-month employee bonus sheet</h3>'+tpBonusMatrix(all,basis)+
  '<h3>Detailed month-by-month bonus list</h3>'+
  (rows.length?tpTable(["Employee","Worked month","Restaurant where worked","ID in that month","Days worked","Equivalent months"],rows.map(function(r){
   return '<tr><td><strong>'+tpEscape(r.employee.name)+'</strong></td>'+
    '<td>'+tpEscape(tpMonthLabel(r.month))+'</td>'+
    '<td>'+tpEscape(r.outlet)+'</td>'+
    '<td><strong>'+(r.monthlyId===null?"Not assigned":r.monthlyId)+'</strong></td>'+
    '<td><strong>'+r.workedDays+'</strong></td>'+
    '<td>'+(basis===null?"Set rule":Math.min(12,r.workedDays/basis).toFixed(2))+'</td></tr>';
  })):'<p class="tp-note">No recorded attendance in this outlet and 12-month period.</p>')+
  '<h3>Consolidated employee totals · All outlets</h3>'+
  (persons.length?tpTable(["Employee","Recorded months","Total actual days","Equivalent months","Bonus status"],persons.map(function(person){
   var equivalent=basis===null?"Set rule":tpBonusCreditedMonths(person.days,basis).toFixed(2);
   var status=basis===null?"Awaiting conversion rule":person.days>=threshold?"Full bonus eligible":"Below 11 months";
   return '<tr><td><strong>'+tpEscape(person.name)+'</strong></td>'+
    '<td>'+person.months.size+'</td><td><strong>'+person.days+'</strong></td>'+
    '<td>'+equivalent+'</td><td>'+tpEscape(status)+'</td></tr>';
  })):'<p class="tp-note">No employee attendance records within this bonus period.</p>')+
  '<p class="tp-note">The list includes only 12 calendar months per employee, and equivalent bonus months are capped at 12. Mid-month transfers may need explicit outlet-day allocations because standard attendance holds one total per employee per month. No historical split is guessed.</p></section>';
 return stats+form;
}
var tpBonusBeforeRender=tpRender;
tpRender=function(){
 if(tpTab==="bonus")return tpTop()+tpBonusList()+
  '<footer class="tp-footer">Bonus attendance data is stored locally in this browser · Verify monthly records before approving bonus payments</footer></div>';
 return tpBonusBeforeRender();
};
payroll=tpRender;
var tpBonusBeforeAction=tpHandleAction;
tpHandleAction=function(button){
 if(button.dataset.tpAction==="pdf-bonus-list")return tpBonusPDF();
 return tpBonusBeforeAction(button);
};
document.addEventListener("change",function(event){
 if(!event.target||event.target.id!=="tp-bonus-outlet")return;
 var val=event.target.value;
 if(val!=="all"&&!(data.restaurants||[]).some(function(r){return r.id===val;}))return;
 tpBonusOutletFilter=val;draw();
},true);
document.addEventListener("submit",function(event){
 if(!event.target||event.target.id!=="tp-bonus-basis-form")return;
 event.preventDefault();event.stopImmediatePropagation();
 var input=event.target.querySelector("#tp-bonus-days-month"),number=Number(input&&input.value);
 if(!Number.isInteger(number)||number<1||number>31)return uxAlert("Enter a whole number from 1 to 31 workdays per bonus month.");
 var previous=JSON.stringify(tpData);
 tpData.settings.bonusDaysPerMonth=number;
 if(!tpSave()){tpData=JSON.parse(previous);return;}
 draw();showToast("Bonus rule saved: "+number+" workdays = one bonus month; full bonus at "+(number*11)+" days.");
},true);
function tpBonusPDF(){
 var all=tpBonusFullRows(),rows=tpBonusDisplayedRows(all),people=tpBonusPersonSummary(all),basis=tpBonusBasis();
 if(!rows.length)return uxAlert("No monthly attendance records exist for this bonus PDF report.");
 try{
  var pages=[],perPage=20,number=Math.ceil(rows.length/perPage);
  for(var n=0;n<number;n++){
   var page=tpPdfCanvas(),ctx=page.ctx,group=rows.slice(n*perPage,(n+1)*perPage);
   tpPdfHeader(ctx,"BONUS ATTENDANCE LIST",tpPeriod,
    tpMonthLabel(tpBonusMonthShift(tpPeriod,-11))+" – "+tpMonthLabel(tpPeriod));
   ctx.fillStyle="#e9f4ef";ctx.fillRect(38,142,519,32);
   var x=[43,180,280,447,507],names=["EMPLOYEE","MONTH","OUTLET","ID","DAYS"],widths=[126,92,157,48,41];
   names.forEach(function(name,i){tpPdfText(ctx,name,x[i],162,8,true,"#326657",widths[i]);});
   group.forEach(function(row,i){
    var y=199+i*27;
    if(i%2===0){ctx.fillStyle="#f4f8f7";ctx.fillRect(38,y-18,519,26);}
    var vals=[row.employee.name,tpMonthLabel(row.month),row.outlet,
      row.monthlyId===null?"—":String(row.monthlyId),String(row.workedDays)];
    vals.forEach(function(value,j){tpPdfText(ctx,value,x[j],y,9,j===0||j===4,"#294654",widths[j]);});
   });
   tpPdfText(ctx,"Records "+(n*perPage+1)+"–"+(n*perPage+group.length)+" of "+rows.length+
    " · Days shown: "+rows.reduce(function(t,r){return t+r.workedDays;},0),38,760,9,true,"#4f6a72",519);
   tpPdfFooter(ctx,pages.length+1);pages.push(tpPdfImage(page));
  }
  var totalPages=Math.ceil(people.length/19);
  for(var i=0;i<totalPages;i++){
   var page=tpPdfCanvas(),ctx=page.ctx,group=people.slice(i*19,(i+1)*19);
   tpPdfHeader(ctx,"BONUS SERVICE SUMMARY",tpPeriod,"All restaurants · Linked employment records");
   ctx.fillStyle="#e9f4ef";ctx.fillRect(38,142,519,32);
   var x=[43,237,314,395],heads=["EMPLOYEE","DAYS","MONTHS","STATUS"];
   heads.forEach(function(v,j){tpPdfText(ctx,v,x[j],162,8,true,"#326657");});
   group.forEach(function(person,j){
    var y=199+j*27;
    if(j%2===0){ctx.fillStyle="#f4f8f7";ctx.fillRect(38,y-18,519,26);}
    var status=basis===null?"Set conversion rule":person.days>=basis*11?"FULL BONUS":"Below 11 months";
    var vals=[person.name,String(person.days),basis===null?"—":tpBonusCreditedMonths(person.days,basis).toFixed(2),status];
    vals.forEach(function(v,k){tpPdfText(ctx,v,x[k],y,9,k===0||k===3,"#294654",k===0?184:k===3?155:70);});
   });
   tpPdfText(ctx,"11-month full-bonus threshold: "+(basis===null?"Not configured":basis*11+" actual days")+
    ". Bonus payout amounts require a separate approved policy.",38,757,9,false,"#526875",519);
   tpPdfFooter(ctx,pages.length+1);pages.push(tpPdfImage(page));
  }
  var pdf=tpPdfBuild(pages),url=URL.createObjectURL(pdf),a=document.createElement("a");
  a.href=url;a.download="tablewise-bonus-attendance-"+tpPeriod+".pdf";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},1500);
 }catch(error){uxAlert("Could not generate bonus PDF: "+(error&&error.message||"Unknown error"));}
}
var bonusCss=document.createElement("style");
bonusCss.textContent=".tp-bonus-matrix .tp-table-wrap{overflow-x:auto;max-width:100%}.tp-bonus-matrix table{min-width:1900px}.tp-bonus-month-cell{min-width:130px;font-size:12px}.tp-bonus-month-cell>div{padding:4px 0}.tp-bonus-month-cell small{display:block;color:#587377;max-width:160px}.tp-bonus-blank{color:#9aabb1}.tp-bonus-settings{border:1px solid #d9e6e1;background:#f5faf8;border-radius:12px;padding:16px;margin:18px 0 22px}.tp-bonus-settings>label{font-weight:700;display:block;margin-bottom:8px}.tp-bonus-settings input{border:1px solid #cbdce1;border-radius:9px;max-width:180px;min-height:44px;padding:9px 13px}.tp-bonus-period{min-height:48px;border:1px solid #d7e4e7;padding:12px;border-radius:9px}.tp-bonus-period small{display:block;color:#5a717b}.tp-bonus-settings .tp-actions{justify-content:flex-start;flex-wrap:wrap}";
document.head.appendChild(bonusCss);
})();