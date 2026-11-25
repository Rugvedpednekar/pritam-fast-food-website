/* Bonus attendance ledger: preserves each recorded payroll month's ID and days. */
/* Nested inside payroll archive IIFE to reuse the permanent person and branch helpers. */
(function(){
"use strict";
TP_SECTIONS.splice(TP_SECTIONS.indexOf("sheets")+1,0,"bonus");
TP_TITLES.bonus="Bonus List";
var tpBonusOutletFilter="all",tpBonusRangeFrom=null,tpBonusRangeThrough=null;

function tpBonusMonthShift(month,diff){
 var parts=String(month||tpPeriod).split("-").map(Number);
 return new Date(Date.UTC(parts[0],parts[1]-1+diff,1)).toISOString().slice(0,7);
}
function tpBonusBasis(){
 var value=Number(tpData.settings&&tpData.settings.bonusDaysPerMonth);
 return Number.isSafeInteger(value)&&value>=1&&value<=31?value:null;
}
function tpBonusRange(){
 var to=tpBonusRangeThrough||tpPeriod,from=tpBonusRangeFrom||tpBonusMonthShift(to,-11);
 return {from:from,through:to};
}
function tpBonusMonthCount(from,through){
 var a=from.split("-").map(Number),b=through.split("-").map(Number);
 return (b[0]-a[0])*12+b[1]-a[1]+1;
}
function tpBonusMonths(){
 var range=tpBonusRange(),length=tpBonusMonthCount(range.from,range.through);
 return Array.from({length:Math.max(1,Math.min(12,length))},function(_,index){
  return tpBonusMonthShift(range.from,index);
 });
}
function tpBonusOutletCode(name){
 var words=String(name||"").trim().split(/\s+/).filter(Boolean);
 if(!words.length||name==="Outlet not recorded")return "—";
 return words.map(function(w){return w[0];}).join("").toUpperCase().slice(0,7);
}
function tpBonusCreditedMonths(workdays,basis){
 return basis===null?null:Math.min(12,Math.max(0,Number(workdays)||0)/basis);
}
function tpBonusRawRows(){
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
   var snapshot=snapshots[id]||{},entry=(period.bonusOutlets||{})[id];
   if(entry&&Array.isArray(entry.segments)&&entry.segments.length){
    // Fixed earlier-outlet days + dynamic final-outlet remainder must equal
    // the saved monthly attendance total. No day may be credited twice.
    var available=worked;
    entry.segments.forEach(function(segment,index){
     var amount=index===entry.segments.length-1?available:Math.min(available,Math.max(0,Number(segment.days)||0));
     available=Math.max(0,available-amount);
     if(amount<=0)return;
     entries.push({employee:emp,personId:tpArcPersonId(emp),month:month,
      employeeId:id,outlet:segment.restaurant||"Outlet not recorded",
      outletId:segment.restaurantId||"",monthlyId:tpSerialValue(segment.monthlyId),
      workedDays:amount,source:"Recorded outlet transfer allocation"});
    });
    return;
   }
   // The snapshot stores the restaurant when attendance was originally saved.
   // Do not attribute earlier months to the employee's latest outlet.
   var outlet=String(snapshot.restaurant||((period.bonusOutlets||{})[id]&&period.bonusOutlets[id].restaurant)||"");
   var outletId=((period.bonusOutlets||{})[id]&&period.bonusOutlets[id].restaurantId)||"";
   if(!outlet)outlet="Outlet not recorded";
   else if(!outletId){
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
function tpBonusFullRows(){
 var raw=tpBonusRawRows(),grouped=new Map();
 raw.forEach(function(r){
  var key=r.personId+"|"+r.month,prior=grouped.get(key);
  if(!prior){
   grouped.set(key,Object.assign({},r));
   return;
  }
  // One month, one bonus entry per person, including historic (legacy) splits.
  // Preserve all actual days but prefer the single documented outlet for
  // the month; when legacy data has multiple outlets choose the largest
  // recorded share, using the newer entry to break ties.
  var newDays=prior.workedDays+r.workedDays;
  var primary=Number(prior.primaryDays||prior.workedDays);
  if(r.workedDays>=primary){
   prior.monthlyId=r.monthlyId;prior.outlet=r.outlet;prior.outletId=r.outletId;
   prior.employee=r.employee;prior.employeeId=r.employeeId;
   prior.primaryDays=r.workedDays;
  }
  prior.workedDays=newDays;
 });
 return Array.from(grouped.values()).sort(function(a,b){
  return a.employee.name.localeCompare(b.employee.name)||a.month.localeCompare(b.month);
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
 rows.forEach(function(row){grouped.set(row.personId+"|"+row.month,row);});
 var headings=["Employee"].concat(months.map(function(month){return tpEscape(tpMonthLabel(month));})).concat(["Total","Months / 12"]);
 var body=people.map(function(person){
  var cells=months.map(function(month){
   var entry=grouped.get(person.personId+"|"+month);
   if(!entry)return '<td class="tp-bonus-blank">—</td>';
   var code=tpBonusOutletCode(entry.outlet),monthly=entry.monthlyId===null?"—":String(entry.monthlyId);
   return '<td class="tp-bonus-month-cell"><div class="tp-bonus-mini" title="'+
     tpEscape(entry.outlet+' · '+tpMonthLabel(month)+' · '+entry.workedDays+' days')+'">'+
     '<strong>'+tpEscape(monthly)+'</strong><span>'+tpEscape(String(entry.workedDays))+'</span>'+
     '<small>'+tpEscape(code)+'</small></div></td>';
  }).join("");
  return '<tr><td class="tp-bonus-employee"><strong>'+tpEscape(person.name)+'</strong></td>'+cells+
   '<td><strong>'+person.days+'</strong></td>'+
   '<td><strong>'+(basis===null?"—":tpBonusCreditedMonths(person.days,basis).toFixed(2))+
   '</strong></td></tr>';
 });
 return '<div class="tp-bonus-matrix"><p class="tp-note">One record per employee per month: <strong>monthly number / days / outlet initials</strong>. No repeated entries when changing outlets. Maximum 12 selected months.</p>'+
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
  '</div><form id="tp-bonus-period-form" class="tp-form tp-bonus-period-form">'+
  '<div class="tp-form-grid">'+
  '<div class="tp-field"><label for="tp-bonus-period-from">Bonus from month</label>'+
   '<input id="tp-bonus-period-from" type="month" required value="'+tpEscape(tpBonusRange().from)+'"></div>'+
  '<div class="tp-field"><label for="tp-bonus-period-through">Bonus through month</label>'+
   '<input id="tp-bonus-period-through" type="month" required value="'+tpEscape(tpBonusRange().through)+'"></div></div>'+
  '<div class="tp-actions"><button type="submit" class="tp-button tp-light">Apply Bonus Period</button>'+
  '<small>Choose any consecutive period of 1–12 months.</small></div></form>'+
  '<form id="tp-bonus-basis-form" class="tp-bonus-settings"><label for="tp-bonus-days-month">Actual workdays equal to one bonus month *</label>'+
  '<div class="tp-actions"><input id="tp-bonus-days-month" type="number" min="1" max="31" step="1" inputmode="numeric" placeholder="e.g. 26 or 30" value="'+
  (basis===null?"":basis)+'">'+
  '<button class="tp-button tp-primary" type="submit">Save Bonus Rule</button></div>'+
  '<p class="tp-note">11 equivalent months qualify for full bonus. <strong>Bonus credit is capped at 12 equivalent months per employee, never 13 or more</strong>, even if actual days ÷ the configured conversion rate exceeds 12. Actual worked days remain in history. No bonus amount is calculated until a payout policy is defined.</p></form>'+
  '<h3>Employee bonus sheet</h3>'+tpBonusMatrix(rows,basis)+
  '<h3>Consolidated employee totals · All outlets</h3>'+
  (persons.length?tpTable(["Employee","Recorded months","Total actual days","Equivalent months","Bonus status"],persons.map(function(person){
   var equivalent=basis===null?"Set rule":tpBonusCreditedMonths(person.days,basis).toFixed(2);
   var status=basis===null?"Awaiting conversion rule":person.days>=threshold?"Full bonus eligible":"Below 11 months";
   return '<tr><td><strong>'+tpEscape(person.name)+'</strong></td>'+
    '<td>'+person.months.size+'</td><td><strong>'+person.days+'</strong></td>'+
    '<td>'+equivalent+'</td><td>'+tpEscape(status)+'</td></tr>';
  })):'<p class="tp-note">No employee attendance records within this bonus period.</p>')+
  '<p class="tp-note">Bonus credit is capped at 12 months per employee. Transfers are made at month boundaries, so each person has one monthly number, attendance total and outlet per month. Earlier unusual attendance is consolidated without adding its days twice.</p></section>';
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
 if(!event.target||event.target.id!=="tp-bonus-period-form")return;
 event.preventDefault();event.stopImmediatePropagation();
 var form=event.target,from=form.querySelector("#tp-bonus-period-from")?.value,
     through=form.querySelector("#tp-bonus-period-through")?.value;
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(from))||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(through))||
    from>through||tpBonusMonthCount(from,through)>12)
    return uxAlert("Choose a valid bonus period from 1 to 12 consecutive months.");
 tpBonusRangeFrom=from;tpBonusRangeThrough=through;draw();
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
 var rows=tpBonusDisplayedRows(tpBonusFullRows()),months=tpBonusMonths(),range=tpBonusRange();
 if(!rows.length)return uxAlert("No attendance records exist for the selected bonus period.");
 try{
  var people=tpBonusPersonSummary(rows),basis=tpBonusBasis(),byKey=new Map();
  rows.forEach(function(r){byKey.set(r.personId+"|"+r.month,r);});
  // One complete landscape PDF page containing ALL selected months and employees.
  // Increase the physical landscape paper size when necessary to retain readable
  // row heights rather than splitting the list into many pages.
  var zoom=people.length>80?2.83:people.length>51?2:people.length>30?1.414:1;
  var pdfWidth=Math.round(1191*zoom),pdfHeight=Math.round(842*zoom);
  var canvas=document.createElement("canvas");
  canvas.width=pdfWidth*2;canvas.height=pdfHeight*2;
  var ctx=canvas.getContext("2d");
  if(!ctx)throw Error("Canvas is unavailable");
  ctx.scale(2*zoom,2*zoom);
  ctx.fillStyle="#fff";ctx.fillRect(0,0,1191,842);
  ctx.fillStyle="#146e60";ctx.fillRect(0,0,1191,10);
  var currentOutlet=tpBonusOutletFilter==="all"?"All outlets":
   ((data.restaurants||[]).find(function(r){return r.id===tpBonusOutletFilter;})||{}).name||"Selected outlet";
  tpPdfText(ctx,"BONUS ATTENDANCE SHEET",27,43,23,true,"#163f48",780);
  tpPdfText(ctx,"Landscape · One page · "+tpMonthLabel(range.from)+" – "+tpMonthLabel(range.through),
   28,65,11,false,"#486d72",760);
  tpPdfText(ctx,currentOutlet,1163,43,12,true,"#1b745e",290,"right");
  tpPdfText(ctx,"Monthly cell: ID / actual days / outlet initials     ·     11 months = full bonus     ·     12 months maximum",
   28,83,10,false,"#5a737b",1128);
  var startX=26,nameWidth=139,designationWidth=86,salaryWidth=69,bonusWidth=59;
  var idWidth=29,monthWidth=50,totalWidth=56,monthsWidth=51,statusWidth=62;
  var monthlyStart=startX+idWidth+nameWidth+designationWidth+salaryWidth+bonusWidth;
  var totalX=monthlyStart+monthWidth*months.length,monthsX=totalX+totalWidth,statusX=monthsX+monthsWidth;
  var cols=[
   {name:"#",x:startX,w:idWidth},
   {name:"EMPLOYEE",x:startX+idWidth,w:nameWidth},
   {name:"DESIGNATION",x:startX+idWidth+nameWidth,w:designationWidth},
   {name:"SALARY",x:startX+idWidth+nameWidth+designationWidth,w:salaryWidth},
   {name:"BONUS",x:startX+idWidth+nameWidth+designationWidth+salaryWidth,w:bonusWidth}
  ];
  ctx.fillStyle="#edf5f2";ctx.fillRect(startX,98,Math.min(1140,statusX+statusWidth-startX),36);
  cols.forEach(function(c){
   tpPdfText(ctx,c.name,c.x+3,117,9,true,"#245d55",c.w-6);
  });
  months.forEach(function(month,i){
   tpPdfText(ctx,month.slice(5,7)+"/"+month.slice(2,4),
    monthlyStart+i*monthWidth+monthWidth/2,117,9,true,"#245d55",monthWidth-4,"center");
  });
  tpPdfText(ctx,"DAYS",totalX+totalWidth/2,117,9,true,"#245d55",totalWidth-4,"center");
  tpPdfText(ctx,"MONTHS",monthsX+monthsWidth/2,117,9,true,"#245d55",monthsWidth-4,"center");
  tpPdfText(ctx,"STATUS",statusX+statusWidth/2,117,9,true,"#245d55",statusWidth-4,"center");
  var top=140,available=640,rowHeight=Math.min(28,available/Math.max(people.length,1));
  people.forEach(function(person,index){
   var y=top+index*rowHeight,mid=y+rowHeight*.60,emp=person.employee;
   if(index%2===0){ctx.fillStyle="#f3f8f6";ctx.fillRect(startX,y,Math.min(1140,statusX+statusWidth-startX),rowHeight);}
   ctx.strokeStyle="#e4eeeb";ctx.lineWidth=.5;ctx.beginPath();
   ctx.moveTo(startX,y+rowHeight);ctx.lineTo(statusX+statusWidth,y+rowHeight);ctx.stroke();
   var baseSize=Math.min(10.2,Math.max(6.7,rowHeight*.42));
   var designation=emp&&emp.designation||"—";
   var salary=emp&&!tpIsParcel(emp)?Math.round(tpMonthSalary(emp,range.through)/100).toLocaleString("en-IN"):"—";
   var data=[String(index+1),person.name,designation,salary,"—"];
   cols.forEach(function(c,i){
    tpPdfText(ctx,data[i],c.x+3,mid,i===1?baseSize:Math.max(6.7,baseSize-.7),
     i===1,"#2b4952",c.w-6);
   });
   months.forEach(function(month,j){
    var record=byKey.get(person.personId+"|"+month),x=monthlyStart+j*monthWidth+monthWidth/2;
    if(!record){
     tpPdfText(ctx,"—",x,mid,8,false,"#9eaeb2",monthWidth-4,"center");
     return;
    }
    var monthlyId=record.monthlyId===null?"—":String(record.monthlyId);
    var days=String(record.workedDays),outlet=tpBonusOutletCode(record.outlet);
    if(rowHeight>=18){
     var small=Math.max(6.2,Math.min(9.5,rowHeight*.31));
     tpPdfText(ctx,monthlyId,x,y+rowHeight*.33,small,true,"#254552",monthWidth-5,"center");
     tpPdfText(ctx,days,x,y+rowHeight*.62,small,true,"#335e66",monthWidth-5,"center");
     tpPdfText(ctx,outlet,x,y+rowHeight*.89,Math.max(6,small-.9),true,"#15745d",monthWidth-5,"center");
    }else{
     tpPdfText(ctx,monthlyId+"/"+days+"/"+outlet,x,mid,Math.max(5.8,rowHeight*.38),true,"#254552",monthWidth-5,"center");
    }
   });
   tpPdfText(ctx,String(person.days),totalX+totalWidth/2,mid,Math.max(7,baseSize),true,
    "#28494f",totalWidth-4,"center");
   var credited=basis===null?"—":tpBonusCreditedMonths(person.days,basis).toFixed(2);
   tpPdfText(ctx,credited,monthsX+monthsWidth/2,mid,Math.max(7,baseSize),true,
    "#28494f",monthsWidth-4,"center");
   var status=basis===null?"Unset":person.days>=basis*11?"FULL":"Below";
   tpPdfText(ctx,status,statusX+statusWidth/2,mid,Math.max(7,baseSize-.4),true,
    status==="FULL"?"#0b7050":"#63757b",statusWidth-4,"center");
  });
  var bottom=Math.min(806,top+people.length*rowHeight+14),totalDays=people.reduce(function(v,r){return v+r.days;},0);
  ctx.fillStyle="#f0f7f4";ctx.fillRect(startX,bottom,Math.min(1140,statusX+statusWidth-startX),25);
  tpPdfText(ctx,"TOTAL   "+people.length+" employees",startX+6,bottom+17,10,true,"#194e48",260);
  tpPdfText(ctx,"Actual worked days: "+totalDays,520,bottom+17,10,true,"#194e48",280);
  tpPdfText(ctx,"11-month threshold: "+(basis===null?"not set":basis*11+" days"),1161,bottom+17,10,true,"#194e48",245,"right");
  tpPdfText(ctx,"Bonus amount not calculated: payout policy has not been configured. Salary is shown for reference only.",
   28,829,9,false,"#73868b",1115);
  var image=tpPdfImage({canvas:canvas});
  image.pageWidth=pdfWidth;image.pageHeight=pdfHeight;
  var pdf=tpPdfBuild([image]),url=URL.createObjectURL(pdf),a=document.createElement("a");
  a.href=url;a.download="tablewise-bonus-landscape-"+range.from+"-to-"+range.through+".pdf";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},1500);
 }catch(error){uxAlert("Could not generate landscape bonus PDF: "+(error&&error.message||"Unknown error"));}
}
var bonusCss=document.createElement("style");
bonusCss.textContent=".tp-bonus-matrix .tp-table-wrap{overflow-x:auto;max-width:100%}.tp-bonus-matrix table{min-width:0;width:max-content;table-layout:fixed}.tp-bonus-matrix th,.tp-bonus-matrix td{padding:7px 5px!important;text-align:center;vertical-align:middle;white-space:nowrap}.tp-bonus-matrix th{font-size:10px;max-width:82px}.tp-bonus-matrix .tp-bonus-employee{text-align:left;position:sticky;left:0;z-index:1;background:#fff;min-width:145px;max-width:165px}.tp-bonus-month-cell{width:76px;min-width:76px;max-width:76px}.tp-bonus-mini{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;line-height:1.1;min-height:43px}.tp-bonus-mini strong{font-size:13px;color:#173e4a}.tp-bonus-mini span{font-size:12px;font-weight:700;color:#385d60}.tp-bonus-mini small{font-size:9px;font-weight:850;color:#528178;letter-spacing:.3px}.tp-bonus-blank{color:#9aabb1}.tp-bonus-period-form{margin:0 0 13px;gap:8px}.tp-bonus-period-form .tp-form-grid{gap:11px}.tp-bonus-period-form .tp-actions{align-items:center;gap:10px}.tp-bonus-period-form small{color:#6a8190}.tp-bonus-settings{border:1px solid #d9e6e1;background:#f5faf8;border-radius:12px;padding:16px;margin:18px 0 22px}.tp-bonus-settings>label{font-weight:700;display:block;margin-bottom:8px}.tp-bonus-settings input{border:1px solid #cbdce1;border-radius:9px;max-width:180px;min-height:44px;padding:9px 13px}.tp-bonus-settings .tp-actions{justify-content:flex-start;flex-wrap:wrap}";
document.head.appendChild(bonusCss);
})();