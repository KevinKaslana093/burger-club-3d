// The three physical copies use the same carbon impression. Blank lines appear as the server writes.
window.DinerOrderSlip = (() => {
  'use strict';
  const sans='"Microsoft YaHei", "Noto Sans SC", sans-serif',mono='"Courier New", monospace';
  function create(T){
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=512;
    const c=canvas.getContext('2d'),texture=new T.CanvasTexture(canvas);
    texture.encoding=T.sRGBEncoding;texture.anisotropy=2;
    const material=new T.MeshStandardMaterial({map:texture,color:0xffffff,roughness:.94,side:T.DoubleSide});
    const paper=document.createElement('canvas');paper.width=384;paper.height=512;
    const b=paper.getContext('2d'),gradient=b.createLinearGradient(0,0,310,512);
    gradient.addColorStop(0,'#fff4d8');gradient.addColorStop(.76,'#f7e6bd');gradient.addColorStop(1,'#e2cc9e');b.fillStyle=gradient;b.fillRect(0,0,384,512);
    let seed=705;const random=()=>((seed=Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
    for(let n=0;n<2800;n++){b.fillStyle=n%2?'rgba(126,95,60,.095)':'rgba(255,255,235,.52)';b.fillRect(random()*384,random()*512,.5+random()*3,.8);}
    b.lineWidth=2;b.strokeStyle='#75918a';b.strokeRect(20,23,344,465);b.fillStyle='#316b5e';b.fillRect(20,23,344,58);
    function type(ctx,text,x,y,font,color,align='left'){ctx.fillStyle=color;ctx.font=font;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(text,x,y);}
    type(b,'BURGER CLUB',37,61,'bold 31px Georgia','#fff5d8');type(b,'出餐联',347,60,'bold 18px '+sans,'#fff5d8','right');
    for(let i=0;i<=8;i++){const y=196+i*29;b.strokeStyle='#c9b995';b.lineWidth=1;b.beginPath();b.moveTo(37,y);b.lineTo(348,y);b.stroke();}
    type(b,'PALM STREET  /  KITCHEN COPY',36,474,'bold 13px '+mono,'#687d72');
    let key='';
    function update(state){
      const items=state.recipe||[],writing=state.visit==='ordering';
      const count=writing?Math.min(items.length,Math.max(0,Math.ceil((state.visitProgress-.15)*items.length/.7))):items.length;
      const stamped=['carrying','delivering','served'].includes(state.visit)||state.phase==='result'||state.phase==='dayEnd';
      const current=[state.day,state.orderNo,state.table,state.customer,state.recipeName,count,stamped].join('|');if(current===key)return;key=current;
      c.drawImage(paper,0,0);const ink='#314a66';
      type(c,'TABLE  '+String(state.table||1).padStart(2,'0'),36,123,'bold 32px '+mono,ink);
      type(c,'#'+String(state.day||1).padStart(2,'0')+'-'+String(state.orderNo||1).padStart(2,'0'),347,122,'bold 21px '+mono,'#ad5541','right');
      type(c,state.recipeName||'点餐单',36,166,'bold 29px '+sans,ink);type(c,state.customerName||'',347,165,'18px '+sans,ink,'right');
      if(items.includes('smoke'))type(c,'本店招牌',37,188,'bold 15px '+sans,'#9b4b34');
      for(let i=0;i<count;i++){
        const y=216+i*29;c.save();c.translate(37,y);c.rotate((i%3-1)*.009);
        c.strokeStyle=ink;c.lineWidth=1.6;c.strokeRect(1,-14,13,13);c.beginPath();c.moveTo(3,-8);c.lineTo(7,-3);c.lineTo(16,-16);c.stroke();
        type(c,window.DinerGame.names[items[i]]||items[i],26,0,'19px '+sans,ink);
        type(c,'× 1',309,0,'17px '+mono,ink,'right');c.restore();
      }
      if(stamped){c.save();c.translate(287,405);c.rotate(-.13);c.strokeStyle='#a14936';c.lineWidth=4;c.strokeRect(-44,-21,88,37);type(c,'已出餐',0,6,'bold 23px '+sans,'#a14936','center');c.restore();}
      texture.needsUpdate=true;
    }
    // The bottom corners lift off the clip board, with a separate short bend at the perforation.
    function sheet(w,h,bend=0){const g=new T.PlaneGeometry(w,h,10,14),pos=g.attributes.position;
      for(let i=0;i<pos.count;i++){const u=pos.getX(i)/w+.5,v=.5-pos.getY(i)/h;pos.setZ(i,bend*(v*v+.28*v*Math.pow(2*u-1,2))+.001*Math.sin(v*Math.PI*2));}
      g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;mesh.castShadow=false;return mesh;}
    return {update,sheet};
  }
  return {create};
})();
