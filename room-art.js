(function(global){
  'use strict';
  const printed=new Map(),menus=new Map();
  function painting(T,index){
    if(!printed.has(index)){
      const tex=new T.TextureLoader().load(global.DinerArtData?.[index]||'art/print-'+index+'.jpg',()=>global.dispatchEvent(new Event('diner-room-art-ready')));
      tex.encoding=T.sRGBEncoding;tex.anisotropy=4;printed.set(index,tex);
    }
    return printed.get(index);
  }
  function ink(T,map){return new T.MeshBasicMaterial({map,color:0xf5efdf,side:T.DoubleSide});}
  function addPoster(T,frame,side,index){
    const print=new T.Mesh(new T.PlaneGeometry(1.13,1.39),ink(T,painting(T,(side===1?2:0)+index)));
    print.position.z=.094;frame.add(print);return true;
  }
  function pages(T,theme){
    if(menus.has(theme))return menus.get(theme);
    const c=document.createElement('canvas');c.width=768;c.height=480;
    const g=c.getContext('2d');g.fillStyle='#fbefd7';g.fillRect(0,0,c.width,c.height);
    g.fillStyle='#1c5145';g.fillRect(0,0,365,c.height);
    const tint=theme?'#8a402d':'#b44425';g.fillStyle=tint;g.fillRect(0,319,365,161);
    g.textAlign='center';g.fillStyle='#fff1cd';g.font='bold 40px Georgia';g.fillText('Burger Club',182,381);
    g.font='bold 19px Georgia';g.fillText('GRIDDLE & GRILL',182,420);
    g.strokeStyle='#d8b073';g.strokeRect(10,10,745,458);g.strokeRect(15,15,735,448);
    const hang=painting(T,theme?2:0);const texture=new T.CanvasTexture(c);texture.encoding=T.sRGBEncoding;texture.anisotropy=4;
    function printCover(){const img=hang.image;if(!img||!img.width)return;
      g.save();g.beginPath();g.rect(20,20,325,300);g.clip();g.drawImage(img,20,-42,325,409);g.restore();texture.needsUpdate=true;}
    if(hang.image?.complete)printCover();else global.addEventListener('diner-room-art-ready',function loaded(){if(hang.image?.width){printCover();global.removeEventListener('diner-room-art-ready',loaded);}});
    g.fillStyle='#2e4737';g.textAlign='left';g.font='bold 44px Georgia';g.fillText('The Menu',411,83);
    g.fillStyle=tint;g.fillRect(411,105,295,4);
    const entries=[['Classic Cheese','经典芝士堡'],['Garden Stack','田园鲜蔬堡'],['Double Pickle','双料酸黄瓜堡'],['Sunset Special','日落特制堡']];
    entries.forEach(([title,cn],n)=>{const y=157+n*69;g.fillStyle='#263e32';g.font='bold 23px Georgia';g.fillText(title,411,y);g.fillStyle='#86573c';g.font='16px sans-serif';g.fillText(cn,412,y+22);});
    const spine=g.createLinearGradient(350,0,397,0);for(const [x,color]of [[0,'#62421b00'],[.47,'#50351c38'],[.53,'#fff8e49c'],[1,'#f9e7ca00']])spine.addColorStop(x,color);g.fillStyle=spine;g.fillRect(350,0,47,480);
    menus.set(theme,texture);return texture;
  }
  function addMenu(T,table,side,index){
    const book=new T.Group();book.position.set(-side*.55,1.036,.69);book.rotation.y=side*.17;table.add(book);
    const bottom=new T.Mesh(new T.BoxGeometry(.47,.011,.31),new T.MeshLambertMaterial({color:0x693b28}));book.add(bottom);
    const geometry=new T.PlaneGeometry(.46,.30,20,4);geometry.rotateX(-Math.PI/2);const pos=geometry.attributes.position;
    for(let n=0;n<pos.count;n++){const x=pos.getX(n),u=Math.abs(x)/.23;pos.setY(n,.009+.017*Math.sin(u*Math.PI)+.003*u);}
    geometry.computeVertexNormals();const sheet=new T.Mesh(geometry,ink(T,pages(T,index%2)));book.add(sheet);return true;
  }
  const streetMaps=new Map();
  function streetMap(T,key){
    if(!streetMaps.has(key)){
      const texture=new T.TextureLoader().load(global.DinerArtData?.[key]||'art/'+key+'.jpg',()=>global.dispatchEvent(new Event('diner-room-art-ready')));
      texture.encoding=T.sRGBEncoding;texture.anisotropy=4;streetMaps.set(key,texture);
    }
    return streetMaps.get(key);
  }
  function addExterior(T,room){
    const mesh=new T.Mesh(new T.PlaneGeometry(29,10.35),new T.MeshBasicMaterial({map:streetMap(T,'coast')}));
    mesh.name='Harbor street';mesh.position.set(0,3.05,-11.8);room.add(mesh);return true;
  }
  function setService(T,room,period){
    const panel=room.getObjectByName('Harbor street');if(!panel)return;
    panel.material.map=streetMap(T,period==='evening'?'dusk':'coast');panel.material.color.setHex(period==='afternoon'?0xffe6cd:0xffffff);
    panel.material.needsUpdate=true;
  }
  global.DinerRoomArt={addPoster,addMenu,addExterior,setService};
})(window);
