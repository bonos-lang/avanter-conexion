(function(root){
 root.ReportUtils={discountDistribution(rows){
  const groups=new Map();let total=0,amount=0,completeAmount=true;
  for(const row of rows){
   const count=row.operaciones??1;total+=count;
   const rate=typeof row.porcentajeDescuento==='number'&&Number.isFinite(row.porcentajeDescuento)&&row.porcentajeDescuento>=0?row.porcentajeDescuento:null;
   const g=groups.get(rate)||{rate,count:0,amount:0};g.count+=count;
   if(row.descuento==null){g.amount=null;completeAmount=false;}else{amount+=row.descuento;if(g.amount!=null)g.amount+=row.descuento;}
   groups.set(rate,g);
  }
  return {total,amount:completeAmount?amount:null,groups:[...groups.values()].sort((a,b)=>a.rate==null?1:b.rate==null?-1:a.rate-b.rate)};
 }};
})(typeof window==='undefined'?globalThis:window);
