/* Offline, first-worksheet employee import. Loaded inside payroll-preview.js. */
var TP_IMPORT_COLUMNS=[
 {key:"name",label:"Employee Name",aliases:["name","employeename","fullname","staffname"]},
 {key:"designation",label:"Designation",aliases:["designation","role","jobtitle","position"]},
 {key:"joined",label:"Joining Date",aliases:["joiningdate","joindate","joined","dateofjoining","startdate"]},
 {key:"restaurant",label:"Restaurant",aliases:["restaurant","outlet","branch","restaurantname"]},
 {key:"type",label:"Employee Type",aliases:["employeetype","type","stafftype"]},
 {key:"salary",label:"Monthly Salary (INR)",aliases:["monthlysalaryinr","monthlysalary","salaryinr","salary","basesalary"]},
 {key:"method",label:"Payment Method",aliases:["paymentmethod","method","paymentmode","salarymode"]},
 {key:"leave",label:"Paid Leave Days",aliases:["paidleavedays","paidleaveallowance","leaveallowance","maximumleavedays","leavedays"]},
 {key:"gst",label:"Commission GST (%)",aliases:["commissiongst","commissiongstpercent","gstoncommission","gstrate","commissiongstrate"]},
 {key:"monthlyId",label:"Monthly ID",aliases:["monthlyid","employeeid","payrollid","serial","serialnumber"]}
];
function tpImportHeader(v){return String(v==null?"":v).toLowerCase().trim().replace(/[^a-z0-9]/g,"");}
function tpImportCSV(text){
 var rows=[],row=[],field="",quoted=false;
 text=String(text||"").replace(/^\uFEFF/,"");
 for(var i=0;i<text.length;i++){
  var c=text[i];
  if(quoted){
   if(c==='"'&&text[i+1]==='"'){field+='"';i++;}
   else if(c==='"')quoted=false;
   else field+=c;
  }else if(c==='"'&&field==="")quoted=true;
  else if(c===","){row.push(field);field="";}
  else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(field);rows.push(row);row=[];field="";}
  else field+=c;
 }
 if(quoted)throw Error("CSV has an unclosed quoted field.");
 if(row.length||field!==""){row.push(field);rows.push(row);}
 return rows;
}
function tpImportXmlText(s){
 return String(s||"").replace(/&(?:#x([a-f0-9]+)|#([0-9]+)|amp|lt|gt|quot|apos);/gi,function(raw,h,d){
  if(h||d){var n=parseInt(h||d,h?16:10);return Number.isFinite(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):"";}
  return {"&amp;":"&","&lt;":"<","&gt":">","&gt;":">","&quot;":'"',"&apos;":"'"}[raw.toLowerCase()]||raw;
 });
}
function tpImportXmlAttr(attrs,key){
 // All attribute names used here are fixed known XML names.
 var match=new RegExp("(?:^|\\s)"+key+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27)').exec(attrs);
 return match?tpImportXmlText(match[1]===undefined?match[2]:match[1]):"";
}
function tpImportXmlBlocks(xml,tag){
 var re=new RegExp("<(?:[A-Za-z_][\\w.-]*:)?"+tag+"\\b([^>]*)>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?"+tag+"\\s*>","gi");
 var out=[],match;
 while((match=re.exec(xml))!==null)out.push({attrs:match[1],xml:match[2]});
 return out;
}
function tpImportXmlStrings(xml){
 return tpImportXmlBlocks(xml,"si").map(function(si){
  return tpImportXmlBlocks(si.xml,"t").map(function(t){return tpImportXmlText(t.xml);}).join("");
 });
}
function tpImportA1Column(ref){
 var letters=String(ref||"").match(/^[A-Z]+/i);if(!letters)return -1;
 var n=0;for(var i=0;i<letters[0].length;i++)n=n*26+letters[0].toUpperCase().charCodeAt(i)-64;
 return n-1;
}
function tpImportExcelSheet(xml,strings){
 var rows=[],blocks=tpImportXmlBlocks(xml,"row");
 for(var i=0;i<blocks.length;i++){
  if(rows.length>=550)throw Error("The first Excel sheet exceeds 550 rows. Split into smaller files.");
  var cells=[],body=blocks[i].xml;
  var re=/<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c\s*>)/gi,m;
  while((m=re.exec(body))!==null){
   var column=tpImportA1Column(tpImportXmlAttr(m[1],"r"));if(column<0||column>60)continue;
   var type=tpImportXmlAttr(m[1],"t"),content=m[2]||"",valueNodes=tpImportXmlBlocks(content,"v");
   var value=valueNodes.length?tpImportXmlText(valueNodes[0].xml):"";
   if(type==="s")value=strings[Number(value)]||"";
   else if(type==="inlineStr"||type==="str"){
    var ts=tpImportXmlBlocks(content,"t");if(ts.length)value=ts.map(function(t){return tpImportXmlText(t.xml);}).join("");
   }
   cells[column]=value;
  }
  rows.push(cells);
 }
 return rows;
}
async function tpImportZipRead(buffer){
 var bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 var decoder=new TextDecoder("utf-8"),eocd=-1;
 for(var i=bytes.length-22;i>=Math.max(0,bytes.length-66000);i--){
  if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
 }
 if(eocd<0)throw Error("Invalid .xlsx file: ZIP directory missing.");
 var count=view.getUint16(eocd+10,true),at=view.getUint32(eocd+16,true),entries={};
 if(count>2000||at>=bytes.length)throw Error("Excel file contains too many ZIP entries.");
 for(var j=0;j<count;j++){
  if(at+46>bytes.length||view.getUint32(at,true)!==0x02014b50)throw Error("Invalid Excel ZIP directory.");
  var method=view.getUint16(at+10,true),compressed=view.getUint32(at+20,true),size=view.getUint32(at+24,true),
  nameLen=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),
  offset=view.getUint32(at+42,true),name=decoder.decode(bytes.slice(at+46,at+46+nameLen));
  if(!name.includes("..")&&size<10000000&&compressed<10000000)
   entries[name.replace(/^\//,"")]={method:method,size:size,compressed:compressed,offset:offset};
  at+=46+nameLen+extra+comment;
 }
 async function get(name){
  var entry=entries[name];if(!entry)return null;
  var off=entry.offset;
  if(off+30>bytes.length||view.getUint32(off,true)!==0x04034b50)throw Error("Invalid Excel ZIP entry.");
  var start=off+30+view.getUint16(off+26,true)+view.getUint16(off+28,true);
  if(start+entry.compressed>bytes.length)throw Error("Incomplete Excel file.");
  var compressedBytes=bytes.slice(start,start+entry.compressed),decoded;
  if(entry.method===0)decoded=compressedBytes;
  else if(entry.method===8){
   if(typeof DecompressionStream!=="function")throw Error("This browser cannot extract .xlsx files. Save the sheet as CSV and import that instead.");
   try{var stream=new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    decoded=new Uint8Array(await new Response(stream).arrayBuffer());
   }catch(err){throw Error("Could not extract the Excel workbook. Try saving it as CSV.");}
  }else throw Error("Unsupported Excel compression format.");
  if(decoded.length>10000000)throw Error("Excel worksheet is too large.");
  return decoder.decode(decoded);
 }
 return {get:get};
}
async function tpImportReadWorkbook(buffer){
 if(buffer.byteLength>4000000)throw Error("Choose an Excel file smaller than 4 MB.");
 var zip=await tpImportZipRead(buffer),workbook=await zip.get("xl/workbook.xml"),sheet="xl/worksheets/sheet1.xml";
 if(workbook){
  var first=/<(?:[a-z_][\w.-]*:)?sheet\b([^>]*?)\/?>/i.exec(workbook);
  var relId=first&&tpImportXmlAttr(first[1],"r:id");
  var rels=await zip.get("xl/_rels/workbook.xml.rels");
  if(rels&&relId){
   var re=/<(?:[a-z_][\w.-]*:)?Relationship\b([^>]*?)\/?>/gi,m;
   while((m=re.exec(rels))!==null){
    if(tpImportXmlAttr(m[1],"Id")!==relId)continue;
    var target=tpImportXmlAttr(m[1],"Target").replace(/\\/g,"/").replace(/^\/+/,"");
    if(target.startsWith("xl/"))sheet=target;
    else if(target.startsWith("worksheets/"))sheet="xl/"+target;
    break;
   }
  }
 }
 var xml=await zip.get(sheet);
 if(!xml)xml=await zip.get("xl/worksheets/sheet1.xml");
 if(!xml)throw Error("The Excel workbook has no readable first worksheet.");
 var shared=await zip.get("xl/sharedStrings.xml");
 return tpImportExcelSheet(xml,shared?tpImportXmlStrings(shared):[]);
}
function tpImportExcelDate(v){
 var value=String(v==null?"":v).trim();
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 var match=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(value);
 if(match)return Number(match[3])+"-"+String(Number(match[2])).padStart(2,"0")+"-"+String(Number(match[1])).padStart(2,"0");
 var n=Number(value);
 if(/^\d{5}(?:\.\d+)?$/.test(value)&&Number.isFinite(n)&&n>=20000&&n<=100000)
  return new Date(Date.UTC(1899,11,30)+Math.floor(n)*86400000).toISOString().slice(0,10);
 return value;
}
function tpImportRealDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 var d=new Date(value+"T00:00:00Z");
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function tpImportReadColumns(matrix){
 var start=matrix.findIndex(function(row){return row&&row.some(function(v){return String(v==null?"":v).trim()!=="";});});
 if(start<0)throw Error("The employee Excel file is empty.");
 var heads=matrix[start].map(tpImportHeader),fields={};
 TP_IMPORT_COLUMNS.forEach(function(col){var i=heads.findIndex(function(h){return col.aliases.includes(h);});if(i>=0)fields[col.key]=i;});
 if(fields.name===undefined||fields.joined===undefined)
  throw Error("Employee Name and Joining Date column headings are required. Download the template.");
 var values=matrix.slice(start+1).filter(function(row){return row&&row.some(function(v){return String(v==null?"":v).trim()!=="";});});
 if(!values.length)throw Error("The file has headings but no employees.");
 if(values.length>500)throw Error("Maximum 500 employees per file.");
 return values.map(function(row,i){
  var entry={excelRow:start+i+2};
  TP_IMPORT_COLUMNS.forEach(function(c){entry[c.key]=fields[c.key]===undefined?"":String(row[fields[c.key]]==null?"":row[fields[c.key]]).trim();});
  return entry;
 });
}
function tpImportNormalizeEmployee(raw,restaurants,selectedId){
 var name=String(raw.name||"").trim(),designation=String(raw.designation||"").trim();
 if(name.length<2||name.length>90)throw Error("Employee name must be 2–90 characters.");
 var active=restaurants.filter(function(r){return r.active!==false;}),restaurantName=String(raw.restaurant||"").trim();
 var restaurant=restaurantName?
  active.find(function(r){return String(r.name||"").trim().toLowerCase()===restaurantName.toLowerCase()||r.id===restaurantName;}):
  active.find(function(r){return r.id===selectedId;});
 if(!restaurant)throw Error("Restaurant is missing or does not match an active outlet.");
 var employeeType=/^(parcel|parcel boy|delivery boy|delivery|commission|commission only)$/i.test(raw.type)?"parcel":"salaried";
 if(raw.type&&!/^(parcel|parcel boy|delivery boy|delivery|commission|commission only|salaried|salary|employee|staff)$/i.test(raw.type))
  throw Error("Employee Type must be Salaried or Parcel Boy.");
 if(employeeType==="parcel")designation="Parcel Boy";
 else if(!designation||designation.length>90)throw Error("Designation is required (maximum 90 characters).");
 var joined=tpImportExcelDate(raw.joined);
 if(!tpImportRealDate(joined))throw Error("Invalid Joining Date. Use YYYY-MM-DD or DD/MM/YYYY.");
 var rupees=String(raw.salary||"").replace(/[₹,\s]/g,""),salary=0;
 if(employeeType!=="parcel"){
  if(!/^\d+(?:\.0{1,2})?$/.test(rupees)||Number(rupees)<=0)throw Error("Monthly Salary must be a positive amount in INR.");
  salary=Math.round(Number(rupees)*100);
  if(!Number.isSafeInteger(salary)||salary>1000000000)throw Error("Monthly Salary cannot exceed ₹1,00,00,000.");
 }
 var method=String(raw.method||"CASH").trim().toUpperCase();
 if(method==="CHECK")method="CHEQUE";
 if(!["CASH","CHEQUE"].includes(method))throw Error("Payment Method must be CASH or CHEQUE.");
 var days=employeeType==="parcel"?0:raw.leave===""?2:Number(raw.leave);
 if(!Number.isSafeInteger(days)||days<0||days>31)throw Error("Paid Leave Days must be between 0 and 31.");
 var gst=employeeType==="parcel"?(raw.gst===""?5:Number(String(raw.gst).replace(/%/g,""))):undefined;
 if(employeeType==="parcel"&&(!Number.isFinite(gst)||gst<0||gst>100||Math.abs(Math.round(gst*100)-gst*100)>0.000001))
  throw Error("Commission GST must be between 0 and 100, with at most two decimal places.");
 var serial=null;
 if(String(raw.monthlyId||"").trim()!==""){
  serial=Number(raw.monthlyId);
  if(!Number.isSafeInteger(serial)||serial<1||serial>100)throw Error("Monthly ID must be 1–100 or blank.");
 }
 return {name:name,designation:designation,joined:joined,restaurant:restaurant.name,
  restaurantId:restaurant.id,employeeType:employeeType,salary:salary,initialSalary:salary,
  method:method,leaveAllowance:days,commissionGstRate:gst,monthlyId:serial,
  active:true,photo:"",aadhaarLast4:""};
}

/** Create a standards-compatible .xlsx template locally; no external library or upload. */
function tpImportMakeXlsxTemplate(){
 var encoder=new TextEncoder();
 function xmlEscape(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
 var sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
  '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
  '<cols>'+[26,25,18,24,18,22,20,18,21,15].map(function(width,i){
   return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+width+'" customWidth="1"/>';
  }).join("")+'</cols>'+
  '<sheetData><row r="1">'+TP_IMPORT_COLUMNS.map(function(column,i){
   return '<c r="'+String.fromCharCode(65+i)+'1" s="1" t="inlineStr"><is><t>'+xmlEscape(column.label)+'</t></is></c>';
  }).join("")+'</row></sheetData><autoFilter ref="A1:J1"/></worksheet>';
 var styles='<?xml version="1.0" encoding="UTF-8"?>'+
 '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
 '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>'+
 '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+
 '<fill><patternFill patternType="solid"><fgColor rgb="FF156F5A"/><bgColor indexed="64"/></patternFill></fill></fills>'+
 '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
 '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
 '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
 '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>'+
 '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
 var files={
  "[Content_Types].xml":'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
   '<Default Extension="xml" ContentType="application/xml"/>'+
   '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
   '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
   '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  "_rels/.rels":'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  "xl/workbook.xml":'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
   '<sheets><sheet name="Employees" sheetId="1" r:id="rId1"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels":'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
   '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  "xl/styles.xml":styles,
  "xl/worksheets/sheet1.xml":sheet
 };
 function crc32(bytes){
  var crc=-1;
  for(var i=0;i<bytes.length;i++){
   crc^=bytes[i];
   for(var j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^(-1))>>>0;
 }
 var local=[],central=[],total=0;
 function u16(view,pos,n){view.setUint16(pos,n,true);}
 function u32(view,pos,n){view.setUint32(pos,n,true);}
 Object.keys(files).forEach(function(name){
  var nameBytes=encoder.encode(name),body=encoder.encode(files[name]),crc=crc32(body),offset=total;
  var localEntry=new Uint8Array(30+nameBytes.length+body.length),view=new DataView(localEntry.buffer);
  u32(view,0,0x04034b50);u16(view,4,20);u32(view,14,crc);u32(view,18,body.length);u32(view,22,body.length);u16(view,26,nameBytes.length);
  localEntry.set(nameBytes,30);localEntry.set(body,30+nameBytes.length);local.push(localEntry);total+=localEntry.length;
  var centralEntry=new Uint8Array(46+nameBytes.length),centralView=new DataView(centralEntry.buffer);
  u32(centralView,0,0x02014b50);u16(centralView,4,20);u16(centralView,6,20);
  u32(centralView,16,crc);u32(centralView,20,body.length);u32(centralView,24,body.length);
  u16(centralView,28,nameBytes.length);u32(centralView,42,offset);centralEntry.set(nameBytes,46);central.push(centralEntry);
 });
 var directoryOffset=total,directorySize=central.reduce(function(n,b){return n+b.length;},0);
 var buffer=new Uint8Array(total+directorySize+22),pos=0;
 local.concat(central).forEach(function(b){buffer.set(b,pos);pos+=b.length;});
 var end=new DataView(buffer.buffer),count=central.length;
 u32(end,pos,0x06054b50);u16(end,pos+8,count);u16(end,pos+10,count);u32(end,pos+12,directorySize);u32(end,pos+16,directoryOffset);
 return buffer.buffer;
}
