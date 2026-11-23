/* Original swept fringe, crown and hair ornaments for the dining-room cast. */
(function (global) {
  'use strict';
  const tau=Math.PI*2, mix=(a,b,t)=>a+(b-a)*t, sat=t=>Math.min(1,Math.max(0,t));
  const smooth=t=>(t=sat(t),t*t*(3-2*t));
  const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
  // Root, midtone, reflected light, specular ribbon, nape height, fringe,
  // part and crown sweep. The surrounding clothing keeps its own palette.
  const styles={
    2:['#36262C','#654539','#98705B','#C69971',2.145,2.418,-.84,.14],
    3:['#262532','#3B3548','#736077','#AEA1AD',2.006,2.444,.54,-.28],
    4:['#32232E','#563633','#946654','#D3A27B',2.194,2.476,-.72,.35],
    5:['#625A5E','#918881','#C2BBAA','#E0D6C4',2.194,2.479,-.69,.25],
    6:['#34232F','#56342C','#8D5140','#CD8B62',2.154,2.408,.36,-.08],
    7:['#815044','#B96E47','#DDA268','#F0CB93',2.112,2.432,.65,-.26],
    8:['#292633','#4D3947','#826475','#B899A0',2.122,2.440,.92,-.54],
    9:['#272B35','#414850','#637170','#9EAB9F',2.223,2.447,-.67,.24],
    10:['#392A32','#66413D','#976650','#CCA27D',2.233,2.448,.22,-.16],
    11:['#49303B','#794A41','#AB7660','#DCAD8B',2.165,2.459,-.61,.21],
    12:['#635F64','#999389','#C2BEAC','#E5DECA',2.222,2.494,.68,-.34]
  };
  const highlights=['#ECC4A1','#D9C9E7','#F9BC87','#F3E4C8','#F7C38C','#FFDEA7','#DFCFEE','#BDC8BE','#ECC09A','#F8C696','#F2ECDA'];
  function refine(id,parts,T){
    const style=styles[id];if(!style||!parts.hair)return parts;
    const vec=(x,y,z)=>new T.Vector3(x,y,z), cache=new Map();
    const color=c=>{if(!cache.has(c))cache.set(c,new T.Color(c).convertSRGBToLinear());return cache.get(c);};
    const pal=style.slice(0,4).map(color);
    const blend=(a,b,t)=>new T.Color().copy(a).lerp(b,sat(t));
    const groups={hair:[],helmet:[]};
    let dest='hair';
    function surface(rows,cols,point,paint,wrap=false,hairUV=false){
      const xyz=[],rgb=[],uv=[],index=[],stride=wrap&&!hairUV?cols:cols+1;
      for(let i=0;i<=rows;i++)for(let j=0;j<stride;j++){
        const u=i/rows,v=j/cols,p=point(u,v),c=paint(u,v,p);
        xyz.push(p.x,p.y,p.z);rgb.push(c.r,c.g,c.b);
        if(hairUV)uv.push(...(typeof hairUV==='function'?hairUV(u,v):[.003,.997]));
      }
      for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
        const a=i*stride+j,b=i*stride+(j+1)%stride;
        index.push(a,b+stride,b,a,a+stride,b+stride);
      }
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
      g.setAttribute('color',new T.Float32BufferAttribute(rgb,3));g.setIndex(index);g.computeVertexNormals();
      if(hairUV){
        g.setAttribute('strandUV',new T.Float32BufferAttribute(uv,2));
        // Duplicate the UV seam while preserving a smooth closed cross section.
        if(wrap){
          const normals=g.attributes.normal,first=vec(),last=vec();
          for(let row=0;row<=rows;row++){
            const start=row*stride,end=start+cols;
            first.fromBufferAttribute(normals,start);last.fromBufferAttribute(normals,end);
            first.add(last).normalize();
            normals.setXYZ(start,first.x,first.y,first.z);normals.setXYZ(end,first.x,first.y,first.z);
          }
        }
      }
      groups[dest].push(g);
    }
    function solid(g,c){const n=g.attributes.position.count,a=new Float32Array(n*3),p=color(c);
      for(let i=0;i<n;i++){a[3*i]=p.r;a[3*i+1]=p.g;a[3*i+2]=p.b;}
      g.setAttribute('color',new T.BufferAttribute(a,3));groups[dest].push(g);}
    function seam(curve,r,c,steps){solid(new T.TubeGeometry(new T.CatmullRomCurve3(curve),steps||Math.max(10,curve.length*2),r,5,false),c);}
    function bead(p,rx,ry,rz,c,spin=0){const g=new T.SphereGeometry(1,12,9);g.scale(rx,ry,rz);g.rotateZ(spin);g.translate(p.x,p.y,p.z);solid(g,c);}
    function series(n,f){return Array.from({length:n},(_,i)=>f(i/(n-1)));}
    function pigment(u,v,seed,band,lum=1){
      const fiber=.5+.5*Math.cos((v*2.45+u*.13)*tau+seed),fine=.5+.5*Math.cos(v*33+u+seed);
      let c=blend(pal[0],pal[1],(.45+.34*Math.sin(u*Math.PI)+.12*fiber)*lum);
      // A broken, sharper inner reflection sits inside the broader coloured band.
      // It crosses a few adjacent locks while their root and outer edge stay dark.
      c=blend(c,pal[2],(.11*fiber**3+.57*band*(.48+.52*fiber))*lum);
      const glint=smooth((band-.36)/.50)*(.24+.76*fine**2);
      return blend(c,pal[3],.56*glint*(.36+.64*fiber)*lum);
    }
    // A convex backed ribbon carries a painted lock. Its two thin wing sections
    // turn towards the neighbouring locks; the scalp remains beneath the feathered ends.
    function strand(curve,width,thickness,seed,outward,bright=1,accent){
      const path=new T.CatmullRomCurve3(curve,false,'centripetal');
      const row=id-2,half=(Math.round(Math.abs(seed)*7)%3===0)?1:0;
      const glint=color(accent||highlights[row]),root=vec(),tangent=vec(),normal=vec(),across=vec();
      const swing=Math.sin(seed*2.171)*.30;
      function uv(u,v){
        v=.018+.964*v;u=.012+.974*u;
        return [(row%4+(half+v)*.5)/4,1-(Math.floor(row/4)+u)/4];
      }
      function frame(u){
        path.getPoint(u,root);path.getTangent(u,tangent);
        normal.copy(outward||vec(root.x*.88,sat((root.y-2.31)*1.9),root.z+.015)).normalize();
        across.crossVectors(normal,tangent).normalize();normal.crossVectors(tangent,across).normalize();
        const twist=swing*Math.sin(u*Math.PI);
        across.applyAxisAngle(tangent,twist);normal.applyAxisAngle(tangent,twist);
      }
      let last=-1;
      surface(22,8,(u,v)=>{
        if(u!==last){frame(u);last=u;}
        const side=2*v-1,arc=Math.max(0,1-side*side);
        const section=(.53+.56*Math.sin(Math.PI*(.08+.81*u)))*(1-.71*u**3);
        const curl=.16*(u**2)*Math.sin(4*u+seed);
        return root.clone().addScaledVector(across,width*section*(side+curl))
          .addScaledVector(normal,thickness*(.24+arc*.79)+width*.16*side*side*Math.sin(seed+3*u));
      },(u,v)=>{
        const variation=.90+.07*Math.sin(seed*1.73)+.055*Math.sin(Math.PI*v);
        return glint.clone().multiplyScalar((.90+.10*bright)*variation);
      },false,uv);
    }
    function crown(u,a,lift=0){
      const delta=Math.abs(angle(a)),front=smooth((1.68-delta)/.77);
      const finish=mix(style[4],style[5]+.050,front)+front*.025*Math.sin(2*a+id)+.019*Math.sin(8*a+id*.6);
      const pole=Math.acos(Math.max(-1,Math.min(1,(Math.max(2.175,finish)-2.324)/.322)));
      const polar=.003+u*pole;
      const sweep=style[7]*Math.sin(u*Math.PI)*(.56+.44*front);
      const theta=a+sweep+.055*Math.sin(3*a+.5)*Math.sin(Math.PI*u);
      const low=Math.max(0,u-.58)/.42;
      const r=Math.sin(polar),drop=Math.max(0,2.175-finish)*low**1.2;
      const taper=id===3?1+.06*low:.995;
      const ripple=.0027*Math.cos(a*14+.8*Math.sin(a*3)+u*.24)*Math.sin(Math.PI*u);
      return vec((.317+lift+ripple)*r*Math.sin(theta)*taper,2.324+(.322+lift)*Math.cos(polar)-drop,
        -.017+(.266+lift+ripple)*r*Math.cos(theta));
    }
    function foundation(){
      surface(38,126,(u,v)=>crown(u,tau*v),(u,v,p)=>{
        const a=tau*v,locks=a*16+.63*Math.sin(a*3)+u*.32;
        const crest=.5+.5*Math.cos(locks),fiber=.5+.5*Math.cos(a*55+.70*Math.sin(locks)+u*.4);
        const gleam=Math.exp(-(((u-.46-.075*Math.sin(3*a+id))/.105)**2));
        return pigment(u,crest*.59,id*.43,gleam*(.60+.40*fiber),.78+.26*crest);
      },true,(u,v)=>[(3+1018*v)/1024,(3+506*(1-u))/2048]);
      // Outer layers split around the earlobes and nape; shorter layers fall
      // under the brim for customers wearing caps.
      for(let j=0;j<14;j++){
        const a=mix(1.87,tau-1.87,j/13),k=Math.sign(Math.sin(a));
        const fall=(id===3?.078:id===4?.061:.046)*(.4+.6*Math.sin(j*1.42+id)**2);
        const path=series(7,h=>{
          const u=mix(.20+.11*Math.sin(j*.9)**2,1.015,h);
          const c=crown(u,a+k*.21*(1-h)*Math.sin(a+.4),.008+.011*Math.sin(Math.PI*h));
          c.y-=fall*h**3;c.x+=k*.012*Math.sin(Math.PI*h*1.6)*h;return c;
        });
        strand(path,.043+.010*Math.sin(j*.9)**2,.013+.004*Math.cos(j)**2,j*1.36);
      }

    }
    // A looped rosette follows the coiled hair itself instead of intersecting
    // a separate spherical bun. Individual waved ridges join at its centre.
    function chignon(c,rad,mirror){
      surface(26,80,(u,v)=>{const p=.003+u*(Math.PI-.006),a=tau*v,t=p/Math.PI;
        const weave=(1+.067*Math.cos(8*a+mirror*5*p+.43*Math.sin(2*a))*.99*Math.sin(p));
        return c.clone().add(vec(rad*1.03*weave*Math.sin(p)*Math.sin(a),rad*.94*Math.cos(p),
          rad*.84*weave*Math.sin(p)*Math.cos(a)-.012*t));
      },(u,v)=>{const w=.5+.5*Math.cos(tau*8*v+mirror*5*Math.PI*u+.43*Math.sin(2*tau*v));
        return pigment(u,w*.58,id,Math.exp(-(((u-.36-.10*Math.sin(v*tau))/.14)**2))*w,.57+.43*w);},true,true);
    }
    function rosette(center,radius,hand){
      chignon(center,radius,hand);
      for(let j=0;j<8;j++){
        const initial=tau*j/8,points=series(9,t=>{
          const p=.15+2.7*t,a=initial+hand*1.47*t;
          return center.clone().add(vec(radius*1.10*Math.sin(p)*Math.sin(a),
            radius*.97*Math.cos(p),radius*.91*Math.sin(p)*Math.cos(a)-.009*t));
        });
        strand(points,radius*.24,.005,j+hand*2.3,null,.95);
      }
    }
    function clothKnot(c,k,hue){
      for(const flip of [-1,1]){
        surface(12,8,(u,v)=>{const w=(v-.5)*2;
          return c.clone().add(vec(flip*.066*u,k*.010*flip+(.014+.019*u)*w+flip*.019*u,.010*Math.sin(Math.PI*w)+.028*Math.sin(u*Math.PI)));
        },(u,v)=>blend(color(hue),color('#F9D4A1'),.13+.27*(.5+.5*Math.cos(v*tau))),false);
      }
      bead(c.clone().add(vec(0,0,.012)),.019,.019,.012,'#E8C78F');
    }
    foundation();
    if(id<=8){
      if(id===4){
        rosette(vec(-.072,2.617,-.167),.156,-1);
        // The bronze hairpin holds three pearl seed heads in the coiled bun.
        seam([vec(-.237,2.590,-.160),vec(-.186,2.646,-.151),vec(-.155,2.685,-.130)],.004,'#B68D58');
        for(let j=0;j<3;j++){const x=-.208+j*.021,y=2.667+.012*Math.sin(j);
          bead(vec(x,y,-.109+j*.006),.011,.013,.010,'#F2DDAD');}
      }else if(id===6){
        for(const k of [-1,1]){
          const c=vec(k*.281,2.489,-.113);rosette(c,.125,k);
          clothKnot(vec(k*.316,2.455,.003),k,'#C78556');
          for(let j=0;j<3;j++){
            const path=[vec(k*(.288+.012*j),2.472,-.102),vec(k*(.366+.014*j),2.380,-.072),
              vec(k*(.370+.010*j),2.245,-.055),vec(k*(.319+.014*j),2.089,-.026),
              vec(k*(.350+.023*j),2.012+.018*j,.001+.005*j)];
            strand(path,.031,.016,j+k+10,vec(k*.6,.12,.8));
          }
        }
      }else if(id===8){
        for(let j=0;j<5;j++){
          const x=j*.021,path=[vec(.165-x,2.553,.116),vec(.068-x,2.645+.014*Math.sin(j),.113),
            vec(-.083-x,2.631,.129),vec(-.193-x,2.537,.164),vec(-.206-x,2.413+.013*j,.166-.009*j)];
          strand(path,.041,.021,j+4,vec(-.1,.6,.8));
        }
      }
    }
    // The sideburns, side curtains, ponytails and napes are cut independently.
    // A short cut follows a different curve to a smooth bob or long waves.
    const silhouettes={
      2:[2.294,.021,.064,.063,6],3:[1.997,.016,.012,.045,10],
      4:[2.155,.031,.027,.036,6],5:[2.216,.013,.010,.032,7],
      6:[2.197,.038,.026,.039,5],7:[1.971,.051,.029,.061,10],
      8:[2.178,.043,.055,.052,8],9:[2.250,.013,.018,.036,6],
      10:[2.204,.019,.042,.030,4],11:[2.073,.046,.014,.048,7],
      12:[2.212,.021,.017,.035,6]
    };
    function salonSides(){
      const [cut,wave,kick,width,panels]=silhouettes[id];
      for(const sign of [-1,1]){
        for(let j=0;j<panels;j++){
          const f=(j+.2)/panels,a=1.05+1.22*f,dx=sign*Math.sin(a),dz=Math.cos(a);
          const long=id===3||id===7||id===11;
          const tip=cut+.054*Math.sin(j*2.54+sign*.41)+(.052+.035*sign)*Math.exp(-((a-1.03)**2)/.15)
            +(id===3?.022*sign:0);
          const start=[2,7,9,10].includes(id)?2.502:2.627;
          const points=series(7,t=>{
            const theta=a+.19*(1-t)*Math.sin(a+id*.64)+sign*.058*Math.sin(Math.PI*t);
            const y=mix(start,tip,t);
            const scalp=.32*Math.sqrt(Math.max(.02,1-(Math.max(2.272,y)-2.324)**2/.325**2));
            const undercut=y<2.22&&!long?.047*smooth((2.22-y)/.17):0;
            const base=scalp-.025*(1-smooth(t/.27))-.012*t-undercut;
            const radius=base+.010*Math.sin(Math.PI*t)+wave*.68*Math.sin((long?2.30:1.48)*Math.PI*t+f*2.1)*Math.sin(Math.PI*t)+kick*.30*t**3;
            const breadth=radius*Math.sin(theta),depth=radius*.82*Math.cos(theta);
            return vec(sign*breadth,y,depth-.011+.018*Math.sin(t*4+f)*t+(f<.20?.026*t:0));
          });
          strand(points,width*(.89+.17*Math.sin(j*4+id)),.009+.005*(1-f),id*4.7+j*.9+sign,vec(dx,.06,dz));
          // Airy split ends continue the sweep past the solid shape.
          if(j%3===1||j===0){
            const tail=points.slice(3).map((p,i)=>p.clone().add(vec(sign*(.007+.004*i),-.008*i,.003+.004*Math.sin(i))));
            strand(tail,width*.36,.004,11+j+id,vec(dx,.04,dz));
          }
        }
      }
    }
    function texturedTemple(){
      // Hair emerges below occupational headwear, leaving the bill, band and straps visible.
      const cap=[2,7,9,10].includes(id),sweep=({2:-.48,3:.63,4:-.90,5:-.79,6:.31,7:.53,8:.88,9:-.65,10:.19,11:-.46,12:.73})[id];
      const rowCount=id===9||id===10?7:id===3||id===8?10:9;
      for(let j=0;j<rowCount;j++){
        const f=j/(rowCount-1),end=mix(-1.22,1.20,f);
        const front=Math.cos(end),sign=Math.sign(end-sweep);
        const shift=(id===5||id===12?.031:0)+(id===8?-.034:0);
        const rootAngle=sweep+.54*end;
        // On an open crown, the upper layer spreads away from a narrow diagonal part.
        const polarStart=cap?.69:.09+(id===11?.15:0);
        const polarEnd=1.31+.095*Math.sin(2.4*j+.57*id)+.20*(1-front)+
          (id===5||id===12?-.105:0)+(id===2||id===8?.105:0);
        const points=series(7,t=>{
          if(cap){
            // Start inside the hat and exit under its seam. Each arc is short
            // and follows its own quadrant instead of crossing the entire bill.
            const sweepAway=(id===7?.54:id===10?.23:id===9?-.39:-.31);
            const a=end-sweepAway*(1-t)+.040*Math.sin(t*Math.PI+j);
            const hem=(id===2?2.365:id===7?2.376:id===9?2.398:2.371)
              +.019*Math.sin(j*2.48+.72*id)-.024*(1-front);
            const y=mix(2.511,hem,t);
            const rx=.306+.017*Math.sin(Math.PI*t);
            const rz=(id===7?.283:id===9?.276:.278)+.012*Math.sin(Math.PI*t);
            return vec(rx*Math.sin(a),y,-.013+rz*Math.cos(a));
          }
          const a=mix(rootAngle,end,.35*t+.65*smooth(t))+sign*.095*Math.sin(Math.PI*t);
          const polar=mix(polarStart,polarEnd,t),s=Math.sin(polar);
          let y=2.324+.325*Math.cos(polar)+.020*Math.sin(Math.PI*t)+shift*t*t;
          const rx=.322+.017*Math.sin(Math.PI*t),rz=.273+.017*Math.sin(Math.PI*t);
          const x=rx*s*Math.sin(a)+.013*Math.sin(3*t+j)*t;
          let z=rz*s*Math.cos(a)-.015+.004*t*t;
          if(id===11){const bandPass=smooth((t-.46)/.18);y-=.020*(1-bandPass);z-=.025*(1-bandPass);}
          return vec(x,y,z);
        });
        const w=(cap?.064:.060)*(.76+.25*Math.sin(f*Math.PI)+.25*Math.sin(j*2.38)**2);
        const colour=id===8&&j===2?'#BAA3F8':id===3&&j===1?'#D5AEC8':null;
        strand(points,w,.009,4.4*j+.83*id,null,1.05,colour);
        if(j%5===2){
          const fine=points.slice(3).map((p,i)=>p.clone().add(vec(sign*(.015+i*.003),-.010*i,.003)));
          strand(fine,.010,.003,j+.31*id,null,.95);
        }
      }
    }
    salonSides();texturedTemple();
    if(id===6){
      // Light twin tails grow out from the fabric ties and swing clear of the collar.
      for(const k of [-1,1])for(let j=0;j<8;j++){
        const a=tau*j/8,dx=Math.sin(a),dz=Math.cos(a);
        const points=series(7,t=>vec(k*(.292+.093*Math.sin(1.55*Math.PI*t)+.072*t+.044*dx*Math.sin(t*Math.PI)),
          2.453-(.52+.047*dz)*t,-.117+.045*dz*Math.sin(t*Math.PI)+.073*t*t));
        strand(points,.042,.012,j+k*2.33,vec(k*.54+dx*.38,.03,dz+.32));
      }
    }
    if(id===10){
      // The gathered ponytail exits the rear of the helmet then splits in a loose fan.
      for(let j=0;j<13;j++){
        const a=tau*j/13,dx=Math.sin(a),dz=Math.cos(a);
        const points=series(7,t=>vec(.025+.174*t+.046*dx*Math.sin(t*Math.PI)+.023*dx*t,
          2.318-(.35+.033*dz)*t,-.262-.134*Math.sin(t*Math.PI)+.042*dz*Math.sin(t*Math.PI)-.019*t));
        strand(points,.036,.009,j+.53,vec(dx,.09,dz-.31));
      }
    }
    // Small original articles in the customers' own colours.
    if(id===2){
      const hat=(p,a)=>vec(.336*Math.sin(p)*Math.sin(a),2.566+.155*Math.cos(p),-.024+.305*Math.sin(p)*Math.cos(a));
      for(const k of [-1,1])for(let j=0;j<4;j++){
        const a=k*(.79+.16*j);
        seam(series(5,f=>hat(1.24+.14*f,a+k*.10*f)),.0025,'#F5C593');
      }
    }else if(id===3){
      // The bob turns inward below the ears. Overlapping side panels carry
      // its weight between the temple and jaw, with room for the spectacles.
      for(const k of [-1,1])for(let j=0;j<6;j++){
        const a=1.20+j*.24,dx=k*Math.sin(a),dz=Math.cos(a),tip=2.014+.026*Math.cos(j*1.17+k*.28);
        const path=[vec(dx*.196,2.573,dz*.175),vec(dx*.284,2.461,dz*.254),
          vec(dx*.327,2.326,dz*.271),vec(dx*.329,2.197,dz*.272),
          vec(dx*.311,2.075,dz*.267+.006),vec(dx*(.291+.009*Math.sin(j)),tip,dz*.260+.012)];
        strand(path,.051+.008*Math.sin(a),.020,4+j+k*.3,vec(dx,.04,dz),.95+.06*Math.cos(j));
      }
      for(let j=0;j<2;j++){
        const a=vec(.205,2.481+j*.023,.180),b=vec(.263,2.458+j*.023,.142),c=vec(.282,2.446+j*.023,.110);
        seam([a,b,c],.0055,j?'#B29078':'#C8AA91');
        bead(a,.008,.007,.005,'#E7CFAC');
      }
    }else if(id===5){
      // Salt and pepper waves fan out from the recession at the temple.
      for(const k of [-1,1])for(let j=0;j<5;j++){
        const a=k*(1.12+.11*j);
        const path=series(6,u=>crown(.33+.67*u,a+k*(1-u)*.28,.018));
        strand(path,.017,.005,j+13,vec(k,.20,.32),1.08);
      }
    }else if(id===7){
      // Stockinette cables wrap the upper knit dome in paired intertwining strands.
      const knit=(p,a)=>vec(.335*Math.sin(p)*Math.sin(a),2.566+.154*Math.cos(p),-.024+.305*Math.sin(p)*Math.cos(a));
      for(let j=0;j<18;j++)for(const k of [-1,1]){
        const a=tau*j/18;
        seam(series(17,u=>knit(.40+1.04*u,a+k*.034*Math.sin(2*tau*u+.4))),.0027,k===1?'#6C9D8F':'#538A7A',24);
      }
    }else if(id===9){
      // Broken herringbone threads over each wool gore stop at the sweatband.
      dest='helmet';
      function tweed(u,a){const p=(1-u)*Math.PI*.52+.001,r=Math.sin(p),f=Math.cos(a),g=.009*Math.cos(6*a-.28)*Math.sin(Math.PI*u)**.7;
        return vec(-.030*u+.016*(1-u)+(.356+g)*r*Math.sin(a),2.480+(.226+.012*Math.sin(a-.3))*Math.cos(p)+.018*(1-f)*r-.021*Math.sin(a+.28)*r,-.006+.012*u+(.312+.049*Math.max(0,f)**4+g)*r*f);}
      for(let j=0;j<24;j++){
        const a=tau*j/24+.057;
        for(let i=0;i<4;i++)seam(series(5,t=>tweed(.12+.142*i+.095*t,a+(j%2?1:-1)*.071*t)),.0017,j%3?'#888576':'#9D927F',5);
      }
      dest='hair';
      for(const k of [-1,1])for(let j=0;j<3;j++)strand([vec(k*.22,2.465,.152),vec(k*(.26+j*.009),2.412,.147),vec(k*(.30+j*.009),2.344-j*.017,.133-j*.009)],.021,.008,j+6,vec(k*.6,.15,.8));
    }else if(id===10){
      for(let j=0;j<5;j++){
        const x=j*.013;
        strand([vec(.031+x,2.32,-.281),vec(.063+x,2.229,-.357),vec(.103+x,2.116,-.378),
          vec(.172+x,2.02+.014*j,-.327),vec(.186+x,1.998+.016*j,-.259)],.026,.012,j+6,vec(.65,.04,-.8));
      }
      dest='helmet';
      function decal(u,b){const a=(u-.5)*Math.PI;return vec(.365*Math.sin(b),2.476+.242*Math.cos(b)*Math.cos(a)-.015*Math.sin(a)+.019*Math.cos(b)*Math.sin(a)**2,-.021+.346*Math.cos(b)*Math.sin(a));}
      for(const k of [-1,1])for(let j=0;j<3;j++){
        surface(8,3,(u,v)=>decal(.69+j*.042+u*.063,k*(.455+.17*u+.024*(k<0?1-v:v))),()=>color(j===0?'#FAE5BD':'#435658'));
      }
      dest='hair';
    }else if(id===11){
      // A tiny pressed-flower comb pinned where the printed scarf crosses her temple.
      const c=vec(-.253,2.528,.159);
      seam([c.clone().add(vec(-.042,-.040,-.021)),c,c.clone().add(vec(.036,.029,.004))],.0035,'#AC9164');
      for(let j=0;j<2;j++){
        const p=c.clone().add(vec(j*.035,j*.018,j*.006));
        for(let k=0;k<5;k++){const a=k*tau/5;bead(p.clone().add(vec(Math.sin(a)*.011,Math.cos(a)*.011,.004)),.0075,.011,.0048,j?'#EDC8A7':'#F3DEA9',-a);}
        bead(p.clone().add(vec(0,0,.010)),.005,.005,.004,'#B98252');
      }
      for(const k of [-1,1])strand([vec(k*.277,2.426,.141),vec(k*.305,2.321,.141),vec(k*.305,2.230,.147),vec(k*.279,2.125,.170),vec(k*.292,2.089,.166)],.021,.008,k+5,vec(k*.65,.08,.8));
    }else if(id===12){
      for(let j=0;j<8;j++){const x=j*.012;
        strand([vec(.138-x,2.595,.039),vec(.072-x,2.627+.006*Math.sin(j),.103),vec(-.040-x,2.609,.157),
          vec(-.117-x,2.543,.178),vec(-.145-x,2.486+.020*Math.sin(j),.183-.006*j)],.021,.008,j+7,vec(-.21,.52,.80),1.12);
      }
    }
    // One material/draw call per moving section; both renderers consume the
    // same indexed colour geometry. Retain the hats built into specialist hair.
    for(const name of Object.keys(groups)){
      if(!groups[name].length)continue;
      const original=parts[name],keep=name==='helmet';
      const input=keep&&original?[original,...groups[name]]:groups[name];
      let count=0,ic=0;
      for(const g of input){count+=g.attributes.position.count;ic+=g.index.count;}
      const xyz=new Float32Array(count*3),norm=new Float32Array(count*3),rgb=new Float32Array(count*3);
      const index=count>65535?new Uint32Array(ic):new Uint16Array(ic),uv=name==='hair'?new Float32Array(count*2):null;
      let k=0,j=0;
      for(const g of input){xyz.set(g.attributes.position.array,k*3);norm.set(g.attributes.normal.array,k*3);rgb.set(g.attributes.color.array,k*3);
        if(uv){
          if(g.attributes.strandUV)uv.set(g.attributes.strandUV.array,k*2);
          else for(let v=k;v<k+g.attributes.position.count;v++){uv[2*v]=.003;uv[2*v+1]=.994;}
        }
        for(const i of g.index.array)index[j++]=k+i;k+=g.attributes.position.count;}
      const merged=new T.BufferGeometry();merged.setAttribute('position',new T.BufferAttribute(xyz,3));merged.setAttribute('normal',new T.BufferAttribute(norm,3));
      merged.setAttribute('color',new T.BufferAttribute(rgb,3));merged.setIndex(new T.BufferAttribute(index,1));merged.computeBoundingSphere();
      if(uv)merged.setAttribute('uv',new T.BufferAttribute(uv,2));
      parts[name]=merged;for(const g of input)g.dispose();
      if(!keep)original?.dispose();
    }
    return parts;
  }
  global.DinerGuestHair=Object.freeze({refine});
})(window);
