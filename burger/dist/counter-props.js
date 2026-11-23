/* Turning profiles, rolled rims and printed wraps for the plates and bottles seen at table height. */
(() => {
  'use strict';
  function create(T){
    const templates=new Map();
    const linear=c=>new T.Color(c).convertSRGBToLinear();
    const enamel=(color,roughness=.45)=>new T.MeshStandardMaterial({color:linear(color),roughness,metalness:.015});
    const ivory=enamel(0xf1ddbb,.48),ivoryHighlight=enamel(0xf8ebd7,.44),dark=enamel(0x623d31,.76),strawEdge=enamel(0xfaedce,.72);
    function mesh(parent,geo,mat){const node=new T.Mesh(geo,mat);node.castShadow=true;node.receiveShadow=true;parent.add(node);return node;}
    function lathe(parent,coords,material,segments=48){return mesh(parent,new T.LatheGeometry(coords.map(([r,h])=>new T.Vector2(r,h)),segments),material);}
    function texture(canvas){const result=new T.CanvasTexture(canvas);result.encoding=T.sRGBEncoding;result.anisotropy=4;return result;}
    function sheet(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
    function label(text,ctx,x,y,size,font,color){ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.font=font+' '+size+'px Georgia';ctx.fillText(text,x,y);}
    function condiment(type){
      const mustard=type==='mustard',smoked=type==='smoke',root=new T.Group();
      const tone=smoked?0x742f21:mustard?0xc99e35:0xa33b2c, cap=enamel(smoked?0x492c21:mustard?0xbc9038:0x963122,.49);
      const c=sheet(512,512),g=c.getContext('2d'),base=smoked?'#763825':mustard?'#e3ae40':'#ba4636';g.fillStyle=base;g.fillRect(0,0,512,512);
      // Very broad reflections describe the moulded polyethylene, including in the software renderer.
      for(const [x,alpha] of [[40,.12],[223,.08],[424,.18]]){
        const grad=g.createLinearGradient(x-28,0,x+28,0);grad.addColorStop(0,'rgba(255,220,159,0)');grad.addColorStop(.46,`rgba(255,220,159,${alpha})`);grad.addColorStop(1,'rgba(255,220,159,0)');g.fillStyle=grad;g.fillRect(x-28,0,56,512);
      }
      // Front and back are separately printed die-cut labels on one UV wrap.
      for(const x of [128,384]){
        g.save();g.translate(x,244);g.fillStyle='#f1deaf';g.strokeStyle=mustard?'#365546':'#7e392b';g.lineWidth=3;
        g.beginPath();g.moveTo(-72,-65);g.quadraticCurveTo(0,-102,72,-65);g.lineTo(68,58);g.quadraticCurveTo(0,96,-68,58);g.closePath();g.fill();g.stroke();
        g.strokeStyle='#c7a466';g.lineWidth=1.6;g.strokeRect(-60,-48,120,95);
        label('PALM STREET',g,0,-43,12,'bold','#475847');
        if(smoked){
          g.strokeStyle='#934524';g.lineWidth=3;g.lineCap='round';
          for(const dx of [-12,0,12]){g.beginPath();g.moveTo(dx,-6);g.bezierCurveTo(dx+12,-16,dx-8,-18,dx,-30);g.stroke();}
        }else if(mustard){g.fillStyle='#a7822f';for(const [a,b] of [[-11,-16],[4,-21],[13,-11],[-2,-8]]){g.beginPath();g.ellipse(a,b,6,3,-.52,0,7);g.fill();}}
        else {g.fillStyle='#af3c29';g.beginPath();g.ellipse(0,-14,14,11,0,0,7);g.fill();g.fillStyle='#416046';g.beginPath();g.moveTo(0,-20);g.lineTo(-9,-26);g.lineTo(-2,-25);g.lineTo(0,-30);g.lineTo(2,-24);g.lineTo(9,-26);g.closePath();g.fill();}
        label(smoked?'烟熏酱':mustard?'MUSTARD':'KETCHUP',g,0,12,smoked?27:21,'bold',mustard?'#3e563c':'#87392b');
        label(smoked?'SMOKED BBQ':'HOUSE RECIPE',g,0,38,10,'bold','#5d5c48');g.restore();
      }
      const wrap=new T.MeshStandardMaterial({map:texture(c),roughness:.44,metalness:.015});
      const body=lathe(root,[[.001,.008],[.066,.008],[.080,.012],[.086,.023],[.089,.044],[.090,.073],[.090,.253],[.088,.28],[.085,.298],[.079,.311],[.065,.324],[.05,.329],[.039,.338],[.037,.352]],wrap);
      // Height-based texture coordinates avoid compressing the label between neighbouring shoulder rings.
      const uv=body.geometry.attributes.uv,p=body.geometry.attributes.position;for(let i=0;i<p.count;i++)uv.setY(i,(p.getY(i)-.008)/.344);body.rotation.y=Math.PI*.5-.14;
      const ring=enamel(tone,.48);for(let i=0;i<3;i++){const h=.038+i*.012;lathe(root,[[.087,h],[.091,h+.002],[.091,h+.006],[.087,h+.008]],ring,40);}
      lathe(root,[[.037,.335],[.043,.338],[.045,.343],[.045,.367],[.041,.373],[.032,.374]],ivory);
      lathe(root,[[.031,.373],[.031,.382],[.025,.39],[.012,.430],[.009,.44],[.0038,.44]],cap,36);
      lathe(root,[[.001,.4394],[.0045,.4394],[.0048,.4401]],dark,20);
      const capProfile=new T.CylinderGeometry(.0452,.0452,.021,72,1,true),v=capProfile.attributes.position;
      for(let i=0;i<v.count;i++){const radius=i%3===1?1.018:.989;v.setX(i,v.getX(i)*radius);v.setZ(i,v.getZ(i)*radius);}capProfile.computeVertexNormals();const edge=mesh(root,capProfile,ivoryHighlight);edge.position.y=.354;
      return root;
    }
    function soda(){
      const root=new T.Group(),canvas=sheet(1024,512),g=canvas.getContext('2d');g.fillStyle='#f1dfbe';g.fillRect(0,0,1024,512);
      const map=texture(canvas),im=new Image();im.onload=()=>{for(let i=0;i<2;i++)g.drawImage(im,i*512,0,512,512);map.needsUpdate=true;window.dispatchEvent(new Event('diner-room-art-ready'));};im.src=window.DinerArtData?.cup||'art/cup.jpg';
      const paper=new T.MeshStandardMaterial({map,roughness:.82});
      const sleeve=mesh(root,new T.CylinderGeometry(.137,.105,.344,64,1,true),paper);sleeve.position.y=.193;sleeve.rotation.y=Math.PI*.5-.18;
      lathe(root,[[.001,.004],[.094,.004],[.103,.007],[.106,.011],[.106,.018],[.105,.022]],ivory,48);
      lathe(root,[[.133,.36],[.139,.36],[.145,.364],[.147,.371],[.146,.378],[.141,.380],[.139,.381]],ivoryHighlight);
      lathe(root,[[.142,.371],[.148,.373],[.150,.378],[.150,.386],[.146,.39],[.138,.391],[.136,.402],[.132,.409],[.126,.409],[.121,.405],[.118,.398],[.103,.395],[.10,.397],[.056,.401],[.048,.399],[.038,.397],[.001,.397]],ivoryHighlight,64);
      const straw=new T.Group();straw.position.set(.023,.397,0);straw.rotation.z=-.15;root.add(straw);
      const c=sheet(256,512),ctx=c.getContext('2d');ctx.fillStyle='#f3e7c6';ctx.fillRect(0,0,256,512);ctx.strokeStyle='#a74132';ctx.lineWidth=24;
      for(let k=-4;k<=8;k++){ctx.beginPath();ctx.moveTo(-2,k*77);ctx.lineTo(258,k*77+77);ctx.stroke();}
      const tube=mesh(straw,new T.CylinderGeometry(.014,.014,.225,24,1,true),new T.MeshStandardMaterial({map:texture(c),roughness:.71,side:T.DoubleSide}));tube.position.y=.1125;
      const inside=mesh(straw,new T.CircleGeometry(.012,24),dark);inside.rotation.x=-Math.PI/2;inside.position.y=.223;
      lathe(straw,[[.014,.222],[.014,.225],[.012,.225],[.012,.222]],strawEdge,24);
      return root;
    }
    function add(parent,type,x,y,z,scale=1){if(!templates.has(type))templates.set(type,type==='soda'?soda():condiment(type));const item=templates.get(type).clone();item.name=type;item.position.set(x,y,z);item.scale.setScalar(scale);parent.add(item);return item;}
    return {add};
  }
  window.DinerCounterProps={create};
})();
