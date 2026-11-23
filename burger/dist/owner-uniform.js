/* Garments for the dining-room owner, fitted to the existing service rig. */
(function(global){
  'use strict';
  function build(T,makeSection,skin='#D6A484'){
    const sections={},tau=Math.PI*2,sat=t=>Math.min(1,Math.max(0,t));
    function bone(name){
      const s=makeSection();sections[name]=s;
      // Garment edges have small radii. One stitch interval per guide point
      // gives a clean silhouette and keeps the moving outfit affordable.
      s.line=(color,coords,radius,closed=false)=>{
        const curve=new T.CatmullRomCurve3(coords.map(p=>new T.Vector3(...p)),closed,'centripetal');
        const geometry=new T.TubeGeometry(curve,Math.max(6,Math.ceil(coords.length*1.28)),radius,5,closed);
        s.part(geometry,color);geometry.dispose();
      };
      return s;
    }
    const col=hex=>new T.Color(hex).convertSRGBToLinear();
    const P={shirtLow:'#A4937C',shirtHigh:'#D8C6A5',greenLow:'#203E36',greenHigh:'#507464',
      leather:'#825B3F',leatherEdge:'#AB825A',brass:'#B88E54',brassLight:'#D9B77A',pants:'#41494A',pantsLow:'#2D3438',pantsHigh:'#51595A',
      sole:'#362F2C',shoe:'#594233',welt:'#79614B',laces:'#3D302A'};
    // u moves from one cross section to the next, v follows the contour.
    function patch(s,nu,nv,map,low,high,light,reverse=false,wrap=false){
      const positions=[],colors=[],idx=[],a=col(low),b=col(high),c=new T.Color();
      const stride=wrap?nv:nv+1;
      for(let i=0;i<=nu;i++)for(let j=0;j<stride;j++){
        const u=i/nu,v=j/nv,p=map(u,v);positions.push(...p);
        c.copy(a).lerp(b,sat(light(u,v,p)));colors.push(c.r,c.g,c.b);
      }
      for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
        const a=i*stride+j,b=i*stride+(j+1)%stride,c=a+stride,d=b+stride;
        if(reverse)idx.push(a,c,b,c,d,b);else idx.push(a,b,c,b,d,c);
      }
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      g.setIndex(idx);g.computeVertexNormals();s.part(g,'#FFFFFF');g.dispose();
    }
    function profile(rows,y){
      let i=1;while(i<rows.length-1&&y>rows[i][0])i++;
      const a=rows[i-1],b=rows[i],t=sat((y-a[0])/(b[0]-a[0]));
      return a.slice(1).map((v,j)=>v+(b[j+1]-v)*t);
    }
    function run(n,fn){return Array.from({length:n},(_,i)=>fn(i/(n-1)));}
    function ovalLine(s,color,map,rad){s.line(color,run(33,t=>map(t*tau)).slice(0,-1),rad,true);}
    function strip(s,points,width,color,edge,thick=.004,reverse=false){
      const curve=new T.CatmullRomCurve3(points.map(a=>new T.Vector3(...a)),false,'centripetal');
      function at(u,v){
        const p=curve.getPointAt(u),offset=(v-.5)*width;
        return [p.x+offset,p.y+thick*.4*Math.sin(Math.PI*v),p.z+Math.sign(p.z||1)*thick*Math.sin(Math.PI*v)];
      }
      patch(s,29,6,at,color,edge,(u,v)=>.15+.20*Math.abs(2*v-1)+.13*Math.sin(Math.PI*u),reverse);
      for(const v of [0,1])s.line(edge,run(17,t=>at(t,v)),.0022);
    }
    const trunk=bone('body');
    const bodyRows=[
      [.87,.207,.16,-.004],[.96,.239,.167,-.004],[1.08,.237,.160,0],[1.20,.228,.151,.002],[1.30,.225,.149,.006],
      [1.43,.245,.155,.005],[1.56,.268,.165,.008],[1.68,.291,.171,.002],[1.755,.302,.156,-.004],
      [1.81,.254,.131,-.011],[1.855,.165,.105,-.007],[1.892,.098,.083,-.005]
    ];
    function shirtAt(y,a){
      const [rx,rz,cz]=profile(bodyRows,y),sv=Math.sin(a),cv=Math.cos(a);
      const gather=(.008*Math.sin(13*a+3*y)+.004*Math.sin(21*a-4*y))*Math.exp(-(((y-1.27)/.22)**2));
      const tension=.0045*Math.sin(23*y-3*Math.abs(sv))*Math.abs(sv)**3*Math.exp(-(((y-1.64)/.15)**2));
      return [sv*(rx+gather+tension),y,cz+cv*(rz+gather+tension)];
    }
    const hips=[[.839,.193,.147,-.003],[.903,.231,.164,-.009],[.962,.245,.169,-.012],[1.036,.238,.165,-.012],[1.143,.231,.157,-.009],
      [1.212,.230,.154,-.003],[1.276,.228,.153,.001],[1.312,.221,.147,.001]];
    patch(trunk,22,52,(u,v)=>{
      const a=tau*v,s=Math.sin(a),c=Math.cos(a),base=.839+.070*s*s,y=base+(1.312-base)*u;
      const [rx,rz,z]=profile(hips,y),soft=.15*sat((1.17-y)/.14);
      return [rx*Math.sign(s)*Math.abs(s)**(1-soft),y,z+rz*Math.sign(c)*Math.abs(c)**(1-soft)];
    },P.pantsLow,P.pantsHigh,(u,v)=>.52+.05*u+.09*Math.cos(tau*v-.7),false,true);
    function neckline(a){return 1.894-.131*Math.max(0,Math.cos(a))*Math.max(0,1-Math.abs(Math.sin(a))/.65);}
    patch(trunk,40,80,(u,v)=>shirtAt(1.297+(neckline(tau*v)-1.297)*u,tau*v),P.shirtLow,P.shirtHigh,(u,v)=>{
      const a=v*tau;return .58+.13*u+.055*Math.cos(a-1)+.10*Math.sin(13*a+u*4)*Math.exp(-(((u-.19)/.25)**2));
    },false,true);
    // Sternum, neck and nape are continuous beneath the open placket.
    // This single surface continues from the clavicles around the cervical
    // column to the occiput so a turned head never exposes a cylindrical cut.
    const neck=[[1.746,.123,.148,.002],[1.788,.119,.145,.003],[1.831,.113,.120,.004],[1.867,.100,.100,.002],
      [1.906,.086,.082,-.001],[1.962,.083,.080,-.003],[2.007,.084,.083,-.006],[2.048,.087,.091,-.010],
      [2.096,.095,.100,-.015],[2.143,.114,.113,-.018],[2.195,.131,.124,-.022],[2.226,.132,.127,-.022]];
    patch(trunk,37,52,(u,v)=>{
      const y=1.746+.480*u,a=v*tau,[rx,rz,z]=profile(neck,y),c=Math.cos(a);
      const hollow=.004*Math.max(0,c)**12*Math.exp(-(((y-1.831)/.042)**2));
      return [rx*Math.sin(a),y,z+(rz-hollow)*c*(1-.18*sat((y-1.97)/.18)*Math.max(0,c))];
    },'#B57F69',skin,(u,v)=>.68+.13*Math.cos(v*tau-.4)+.09*u,false,true);
    function chest(x,y,off=0){
      const [rx]=profile(bodyRows,y),a=Math.asin(Math.max(-.998,Math.min(.998,x/rx)));
      const p=shirtAt(y,a);p[2]+=off;return p;
    }
    const neckBand=(u,v)=>{
      const a=.75+(tau-1.50)*v,y=1.849+.057*u-.027*Math.max(0,Math.cos(a));
      return [(.125-.024*u)*Math.sin(a),y,(.103-.016*u)*Math.cos(a)-.003];
    };
    patch(trunk,8,40,neckBand,'#98866B','#C8B492',(u,v)=>.40+.38*u);
    trunk.line('#BDAB8B',run(32,v=>neckBand(.985,v)),.0018);
    for(const side of [-1,1]){
      function collar(u,v){
        const x=side*((1-v)*(.079-.067*u)+v*(.137-.039*u));
        const y=(1-v)*(1.896-.127*u)+v*(1.847-.106*u);
        return chest(x,y,.006+.011*Math.sin(Math.PI*v)*(.45+.55*u));
      }
      patch(trunk,16,14,collar,'#AA987D','#E0CFB0',(u,v)=>.50+.32*(1-v)+.11*Math.sin(Math.PI*u),side>0);
      trunk.line('#B5A183',run(12,t=>collar(1,t)),.0020);
    }
    strip(trunk,[[.002,1.763,.156],[.002,1.739,.166],[.002,1.704,.174],[.002,1.67,.178]],.022,'#B5A385','#C7B697',.002,true);
    trunk.oval('#A7987E',.002,1.724,.175,.007,.007,.003);
    // A folded cotton neckerchief follows the neck, with a small side knot.
    // Both tails are curved surfaces, cut on the bias and piped at the edge.
    const silk='#953F36',fold='#5B2C31',trim='#D7AE7C';
    function necker(u,v){
      const a=v*tau,front=Math.max(0,Math.cos(a)),crease=.004*Math.cos(u*10+.8*Math.sin(2*a));
      const y=1.891+.040*u-.035*front**3+.009*Math.sin(a+.2),r=.005+crease+.004*Math.sin(a*3+.5*u);
      return [(.093+r+.006*(1-u))*Math.sin(a),y,(.089+r+.012*(1-u))*Math.cos(a)-.001];
    }
    patch(trunk,15,72,necker,fold,silk,(u,v)=>.52+.25*Math.sin(u*9+v*3)+.14*Math.cos(tau*v+.5),false,true);
    ovalLine(trunk,'#B87855',a=>necker(.84,a/tau),.00145);
    function kerchiefTail(side,u,v){
      const w=(.016+.002*side)*(1-.24*u)*(1-.93*u**3);
      const x=.043+side*.028*u+.016*Math.sin(Math.PI*u)+(2*v-1)*w;
      const y=1.875-u*(side>0?.109:.129)-.005*Math.sin(Math.PI*v);
      const surface=chest(x,Math.min(y,1.87),.009);
      return [x,y,surface[2]+.007*Math.sin(v*Math.PI)+.014*(1-u)**3];
    }
    for(const k of [-1,1]){
      patch(trunk,25,8,(u,v)=>kerchiefTail(k,u,v),fold,silk,(u,v)=>.4+.30*Math.sin(v*Math.PI)+.11*Math.cos(u*7),true);
      trunk.line(trim,run(13,t=>kerchiefTail(k,.12+.79*t,.86)),.00145);
    }
    trunk.oval('#973E35',.044,1.867,.111,.020,.015,.017,.22,-.27,-.65);
    trunk.line('#BC755D',[[.032,1.861,.123],[.043,1.872,.129],[.053,1.874,.119]],.0020);
    // Broad bib, deep waist and short split hem. Folds converge towards the belt.
    const apronRows=[[.831,1.29,.225,.197],[.937,1.32,.251,.207],[1.13,1.27,.249,.179],[1.29,1.31,.242,.161],
      [1.39,.92,.250,.164],[1.52,.62,.277,.175],[1.69,.57,.302,.188]];
    function apron(u,v,raise=0){
      const t=2*v-1,y0=.831+.859*u;
      const cut=.073*Math.exp(-((t/.25)**2))*(1-u)**7;
      const y=y0+cut+.009*Math.sin(t*3.7+.5)*(1-u)**4;
      const [width,rx,rz]=profile(apronRows,y0),a=width*t;
      const lower=(1-u)**1.55,ridge=(.009*Math.cos(t*11+u*4)+.004*Math.cos(t*19-u*6))*lower+
        .0035*Math.sin(t*7-u*27)*Math.abs(t)*Math.exp(-(((y-1.34)/.13)**2));
      return [(rx+ridge*.43+raise)*Math.sin(a),y,.015+(rz+ridge+raise)*Math.cos(a)];
    }
    patch(trunk,50,62,(u,v)=>apron(u,v),P.greenLow,P.greenHigh,(u,v)=>{
      const t=v*2-1;return .59+.12*Math.cos(t*9+u*3)*(1-u)+.06*Math.sin(23*u-4*t)*Math.abs(t)+.10*Math.sin(Math.PI*u)-.10*t*t;
    });
    for(const v of [.011,.989])trunk.line('#59776A',run(21,t=>apron(t,v,.0018)),.0028);
    trunk.line('#263F39',run(33,t=>apron(.006,t,.002)),.0041);
    trunk.line('#779080',run(24,t=>apron(.020,t,.002)),.0020);
    trunk.line('#527165',run(24,t=>apron(.992,t,.002)),.0034);
    // A small curved welt pocket has a visible opening and two bar tacks.
    const pocket=(u,v)=>{
      const av=.5+(v-.5)*(.56+.055*u),au=.245+.222*u+.018*Math.cos((v-.5)*Math.PI);
      return apron(au,av,.005+.006*Math.sin(Math.PI*v)*(.4+.6*u));
    };
    patch(trunk,16,32,pocket,P.greenLow,P.greenHigh,(u,v)=>.61+.08*Math.sin(v*6+u)+.07*Math.cos(v*11));
    trunk.line('#526D5E',run(21,t=>pocket(1,t)),.0035);
    trunk.line('#738775',run(18,t=>pocket(.979,t)),.0018);
    for(const v of [.018,.979])trunk.line('#698271',run(11,t=>pocket(t,v)),.0021);
    trunk.line('#627B6B',run(19,t=>pocket(.011,t)),.0021);
    for(const v of [.037,.955])trunk.line('#A6A183',[pocket(.929,v),pocket(.980,v+.004)],.0027);
    function beltAt(y,theta,raise=0){
      const a=Math.atan2(Math.sin(theta),Math.cos(theta)),[width]=profile(apronRows,y),u=(y-.831)/.859;
      const angle=Math.max(-width,Math.min(width,a)),av=.5+.5*angle/width;
      const surface=apron(u,av),shirt=shirtAt(y,a),edge=shirtAt(y,angle),blend=sat(1-(Math.abs(a)-width)/.34);
      const x=shirt[0]+(surface[0]-edge[0])*blend,z=shirt[2]+(surface[2]-edge[2])*blend;
      const [hx,hz,hc]=profile(hips,y),s=Math.sin(a),c=Math.cos(a);
      const lift=.006+raise+Math.max(0,(hx*s-x)*s+(hc+hz*c-z)*c);
      return [x+lift*s,y,z+lift*c];
    }
    patch(trunk,6,80,(u,v)=>beltAt(1.274+.044*u,tau*v),P.leather,P.leatherEdge,(u,v)=>.29+.15*u+.07*Math.cos(v*tau),false,true);
    for(const u of [.11,.91])ovalLine(trunk,'#957250',a=>beltAt(1.274+.044*u,a,.0014),.0015);
    // The apron buckles to saddle leather at each shoulder. The straps cross
    // on the back so the bib stays flat when the cook leans over a notepad.
    function shirtDepth(x,y,back=false){
      const [rx]=profile(bodyRows,y),a=Math.asin(Math.max(-.999,Math.min(.999,x/rx)));
      return shirtAt(y,back?Math.PI-a:a)[2];
    }
    function shoulderHeight(x,z){
      let lo=1.78,hi=1.892;
      for(let i=0;i<13;i++){
        const y=(lo+hi)/2,[rx]=profile(bodyRows,y);
        if(Math.abs(x)>rx||z>shirtDepth(x,y)||z<shirtDepth(x,y,true))hi=y;else lo=y;
      }
      return (lo+hi)/2;
    }
    function apronPoint(x,y,raise=0){
      const [width,rx]=profile(apronRows,y),a=Math.asin(Math.max(-.998,Math.min(.998,x/rx)));
      return apron((y-.831)/.859,.5+.5*a/width,raise);
    }
    for(const k of [-1,1]){
      function leather(u,v,extra=0){
        const offset=(v-.5)*.033,h=.0035+.0018*Math.sin(Math.PI*v)+extra;
        if(u<=.25){
          const t=u*4,y=1.648+.162*t,x=k*(.132+.017*t)+offset;
          const cloth=shirtDepth(x,y),edge=apronPoint(x,Math.min(1.69,y));
          const bibLift=Math.max(0,edge[2]-cloth)*sat((1.716-y)/.027);
          return [x,y,cloth+bibLift+h];
        }
        if(u<=.55){
          const t=(u-.25)/.30,x=k*.149+offset;
          const z=shirtDepth(x,1.81)*(1-t)+shirtDepth(x,1.80,true)*t;
          return [x,shoulderHeight(x,z)+h*Math.sin(Math.PI*t),z+h*Math.cos(Math.PI*t)];
        }
        const t=(u-.55)/.45,y=1.80-.515*t;
        const ramp=sat((t-.12)/.88),x=k*(.149-.325*ramp**1.10)+offset;
        return [x,y,shirtDepth(x,y,true)-h-(k>0?.007*Math.sin(Math.PI*ramp)**4:0)];
      }
      patch(trunk,72,5,leather,P.leather,'#9C7754',(u,v)=>.26+.13*Math.abs(2*v-1)+.12*Math.sin(Math.PI*u));
      for(const v of [.04,.96])trunk.line('#92714D',run(45,t=>leather(t,v,.0006)),.0015);
      const b=(u,v)=>leather(u,v,.0032);
      trunk.line(P.brass,[b(.078,-.05),b(.078,1.05),b(.106,1.05),b(.106,-.05)],.0031,true);
      const pin=leather(.030,.50,.0033);trunk.oval(P.brass,...pin,.0053,.0053,.0026);
    }
    // Embroidered cloche and serving line on the left chest.
    const mark=(x,y)=>apronPoint(.063+x,1.584+y,.0028),thread='#B8AA7D';
    trunk.line(thread,run(13,t=>mark(.025*Math.cos(Math.PI*t),.019*Math.sin(Math.PI*t))),.0022);
    trunk.line(thread,[mark(-.030,-.004),mark(.030,-.004)],.0022);
    trunk.line(thread,[mark(-.014,-.010),mark(.014,-.010)],.0018);
    const top=mark(0,.022);trunk.oval(thread,...top,.0036,.0026,.0024);
    // The owner's folded striped service towel tucks behind the upper belt.
    // A turned back corner and offset selvedges show both layers in side view.
    const towel=(u,v)=>{
      const x=-.13+.063*(2*v-1)-.010*u+.010*Math.sin(Math.PI*u);
      const y=1.294-.200*u+.006*Math.cos(2*Math.PI*v)*u-.022*v*u;
      const p=apronPoint(x,y,.011+.009*Math.sin(v*Math.PI));
      return [x,y,p[2]+(.005*Math.sin(tau*(1.6*v+.14*u))+.006*Math.sin(Math.PI*u))];
    };
    patch(trunk,24,28,towel,'#BDB3A0','#DDD3B6',(u,v)=>.38+.46*Math.sin((v+.25)*Math.PI)+.13*u,true);
    for(const v of [.15,.19,.78,.82])trunk.line('#93705F',run(13,u=>towel(u,v)),.0017);
    trunk.line('#C3AA8D',run(15,v=>towel(.975,v)),.0016);
    // A patch pocket and the visible tip of an order pencil sit below the
    // leather attachment. All of this follows the upper chest when writing.
    function chestPocket(u,v){
      const x=-.079+(v-.5)*.080,y=1.550+.069*u+.007*v-.009*(1-u)**3*Math.sin(v*Math.PI);
      return apronPoint(x,y,.005+.006*Math.sin(v*Math.PI)*Math.sin(u*Math.PI*.78));
    }
    const pencil=(y,x,off)=>apronPoint(x,y,off);
    trunk.line('#AD794D',[pencil(1.612,-.079,.008),pencil(1.682,-.068,.010)],.0046);
    trunk.line('#D3BC8F',[pencil(1.677,-.069,.010),pencil(1.687,-.067,.010)],.0044);
    patch(trunk,14,19,chestPocket,'#2D493D','#557160',(u,v)=>.44+.18*u+.16*Math.sin(v*Math.PI));
    trunk.line('#9A9B78',run(10,t=>chestPocket(.94,t)),.0017);
    for(const v of [.028,.972])trunk.line('#77866F',run(10,t=>chestPocket(t,v)),.0014);
    const shades=(u,v)=>.48+.23*u+.14*Math.cos(v*tau-.55)+.06*Math.cos(v*tau*2);
    // Rolled short sleeves are attached above the elbow. The shaded inner
    // edge overlaps the bare forearm throughout the service reach.
    for(const k of [-1,1]){
      const upper=bone('arm'+k),fore=bone('fore'+k);
      const sleeveRows=[[1.352,.072,.074,.336,.011],[1.389,.085,.087,.335,.009],[1.453,.090,.095,.330,.004],
        [1.53,.087,.098,.322,-.002],[1.615,.092,.108,.309,-.007],[1.71,.101,.118,.285,-.011],
        [1.775,.081,.092,.264,-.014],[1.81,.025,.040,.243,-.016]];
      function sleeve(u,v){
        const y=1.352+.458*u,a=v*tau,[rx,rz,x,z]=profile(sleeveRows,y);
        const cloth=.0035*Math.sin(5*a+6*u)+.004*Math.sin(27*u+1.7*Math.cos(a))*Math.exp(-(((u-.26)/.17)**2));
        return [k*x+(rx+cloth)*Math.sin(a),y,z+(rz+cloth)*Math.cos(a)];
      }
      patch(upper,27,32,sleeve,P.shirtLow,P.shirtHigh,(u,v)=>shades(u,v)+.06*Math.sin(20*u+v*7),false,true);
      function cuff(u,v){
        const a=v*tau,y=1.366+.073*u+.0055*Math.sin(a+k*.7),[rx,rz,x,z]=profile(sleeveRows,y);
        const rim=.008+.010*Math.sin(Math.PI*u)**.65+.003*Math.sin(3*a-.45);
        return [k*x+(rx+rim)*Math.sin(a),y,z+(rz+rim)*Math.cos(a)];
      }
      patch(upper,11,36,cuff,'#A39073','#D2BFA0',(u,v)=>.46+.20*u+.14*Math.sin(Math.PI*u)+.07*Math.sin(tau*v+k),false,true);
      ovalLine(upper,'#A99478',a=>cuff(.035,a/tau),.0029);
      ovalLine(upper,'#C7B697',a=>cuff(.79,a/tau),.0025);
      upper.line('#B9A88C',run(14,t=>sleeve(.24+.58*t,.5+k*.112)),.0022);
      const armRows=[[.971,.041,.036,.324,.067],[1.015,.045,.043,.325,.060],[1.069,.049,.048,.327,.051],
        [1.16,.059,.058,.331,.034],[1.236,.069,.066,.335,.018],[1.306,.068,.068,.337,.003],
        [1.355,.062,.066,.336,.007],[1.402,.055,.054,.334,.013]];
      const armAt=(u,v)=>{
        const a=v*tau,y=.971+.431*u,[rx,rz,x,z]=profile(armRows,y),m=.0022*Math.cos(a*3+k)*Math.sin(Math.PI*u)**2;
        return [k*x+(rx+m)*Math.sin(a),y,z+(rz+m)*Math.cos(a)];
      };
      patch(fore,19,28,armAt,'#B57F69',skin,(u,v)=>.69+.17*Math.cos(tau*v-k*.32)+.10*Math.sin(Math.PI*u),false,true);
      const thigh=bone('thigh'+k),shin=bone('shin'+k),foot=bone('foot'+k);
      const upperRows=[[.480,.097,.101,.128,.010],[.503,.102,.108,.128,.011],[.528,.104,.111,.127,.012],[.56,.106,.113,.126,.011],
        [.65,.111,.119,.122,.004],[.79,.120,.133,.120,-.001],[.900,.124,.140,.117,-.005],[.971,.118,.131,.114,-.003],[1.012,.105,.117,.110,0]];
      const lowerRows=[[.154,.084,.083,.129,-.006],[.199,.092,.090,.129,-.004],[.238,.094,.092,.128,.001],
        [.306,.093,.092,.128,-.002],[.395,.098,.103,.128,-.001],[.465,.102,.109,.127,.007],[.500,.104,.110,.128,.011],
        [.52,.103,.109,.128,.012],[.548,.097,.103,.127,.014]];
      function slacks(rows,u,v,isCalf){
        const a=v*tau,y=rows[0][0]+(rows.at(-1)[0]-rows[0][0])*u,[rx,rz,x,z]=profile(rows,y);
        const sa=Math.sin(a),ca=Math.cos(a),front=.23+.77*Math.max(0,ca*.9+sa*k*.43)**2;
        const back=.16+.84*Math.max(0,-ca*.86+sa*k*.50)**2;
        const fold=(center,span)=>Math.exp(-(((y-center)/span)**2));
        const ripple=isCalf ? .008*front*fold(.207+.022*k*sa,.017)-.005*front*fold(.238+.026*k*sa,.017)+.005*back*fold(.265-.025*k*sa,.019)
          : .006*back*fold(.563-.034*k*sa,.022)-.004*front*fold(.577+.043*k*sa,.023)+.004*front*fold(.625+.054*k*sa,.027);
        const crease=.005*Math.max(0,Math.cos(a))**20+.002*Math.max(0,-Math.cos(a))**14;
        return [k*x+(rx+ripple)*Math.sin(a),y,z+(rz+crease+ripple)*Math.cos(a)];
      }
      for(const [node,rows,calf] of [[thigh,upperRows,false],[shin,lowerRows,true]]){
        const at=(u,v)=>slacks(rows,u,v,calf);
        patch(node,29,36,at,P.pantsLow,P.pantsHigh,(u,v)=>.50+.09*u+.13*Math.cos(tau*v-.7)+.06*Math.cos(2*tau*v)+.10*Math.max(0,Math.cos(tau*v))**20,false,true);
        node.line('#535B59',run(12,t=>at(.05+.89*t,k===1?.25:.75)),.0026);
        if(calf)ovalLine(node,'#4D5552',a=>at(.12,a/tau),.0027);
      }
      shin.oval(P.pants,k*.128,.515,.012,.091,.079,.094);
      // Broad toe, narrow heel and stacked welt of a lace-up service derby.
      const fx=k*.128;
      function shoeOutline(a){
        const c=Math.cos(a),s=Math.sin(a);
        return [(c<0?.085:.106)*Math.sign(s)*Math.abs(s)**.86+k*.007*Math.max(0,c),.049+.186*c];
      }
      function soleAt(y,a,scale=1){
        const [x,z]=shoeOutline(a);return [fx+x*scale,y+.014*Math.max(0,Math.cos(a))**6,(z-.05)*scale+.05];
      }
      patch(foot,7,48,(u,v)=>soleAt(.010+.037*u,v*tau,.97+.035*Math.sin(u*Math.PI*.85)),P.sole,'#665448',(u,v)=>.23+.53*u,false,true);
      patch(foot,5,48,(u,v)=>soleAt(.046+.013*u,v*tau,1.014-.022*u),P.welt,'#A58B64',(u,v)=>.26+.24*Math.sin(u*Math.PI),false,true);
      patch(foot,1,48,(u,v)=>soleAt(.010,v*tau,.0001+.97*u),P.sole,P.sole,()=>.5,false,true);
      function vamp(u,v){
        const a=v*tau,c=Math.cos(a),base=soleAt(.055,a,.981),ease=Math.sin(Math.PI*u*.5);
        const shrink=1-.91*ease**2;
        return [fx+(base[0]-fx)*shrink,.055+.015*Math.max(0,c)**6+ease*(.085+.031*(1-c)),(base[2]+.038)*shrink-.038];
      }
      patch(foot,20,52,vamp,'#4B382F','#86644B',(u,v)=>.43+.22*u+.12*Math.cos(tau*v-.7),false,true);
      foot.oval(P.shoe,fx,.158,-.031,.081,.084,.088,-.10);
      const tongue=(u,v)=>[fx+.052*(2*v-1)*(1-.2*u),.125+.060*u+.010*Math.sin(Math.PI*v),.108-.126*u];
      patch(foot,12,13,tongue,P.shoe,'#927157',(u,v)=>.32+.22*Math.sin(Math.PI*v));
      for(const side of [-1,1]){
        const flap=(u,v)=>[fx+side*(.041+.044*v-.008*u),.129+.046*u-.019*v,.109-.121*u-.013*v];
        patch(foot,10,7,flap,'#583F30','#85654A',(u,v)=>.38+.28*(1-v),side<0);
        foot.line('#9B7C5B',run(8,t=>flap(.04+.87*t,.84)),.0019);
      }
      for(let row=0;row<3;row++){
        const u=.13+row*.262,y=.137+.047*u,z=.102-.118*u,w=.044-.006*u;
        for(const side of [-1,1])foot.oval('#96754F',fx+side*w,y,z,.006,.003,.006);
        foot.line(P.laces,[[fx-w,y+.003,z],[fx-.012,y+.011,z-.005],[fx+w,y+.004,z-.011]],.0031);
        if(row<2)foot.line(P.laces,[[fx+w,y+.003,z],[fx+.010,y+.014,z-.014],[fx-w+.002,y+.018,z-.030]],.0027);
      }
      foot.line('#745A44',run(15,t=>vamp(.20+.04*Math.sin(t*Math.PI),(.85+.30*t)%1)),.0024);
    }
    return Object.fromEntries(Object.entries(sections).map(([name,s])=>[name,s.finishMesh().geometry]));
  }
  global.DinerOwnerUniform={build};
})(typeof window==='object'?window:globalThis);
