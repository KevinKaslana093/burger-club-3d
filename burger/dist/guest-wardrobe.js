/* Original workwear appliqués, woven panels and carried tools. All coordinates
   use the existing guest rig in its neutral pose. Details share its draw calls. */
(function(global){
  'use strict';
  const tau=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

  function clothProfile(body){
    // The body starts with its fitted shirt shell. Sample its actual elliptical
    // cross sections so stitching fits the wider overalls and narrower wraps.
    const p=body.attributes.position,rows=[],bottom=p.getY(0);
    let stride=1;
    while(stride<p.count&&Math.abs(p.getY(stride)-bottom)<.00001)stride++;
    for(let j=0;j+stride<=p.count;j+=stride){
      const y=p.getY(j);
      if(rows.length&&y<=rows.at(-1)[0])break;
      let radius=0,front=-Infinity,back=Infinity;
      for(let i=j;i<j+stride;i++){
        radius=Math.max(radius,Math.abs(p.getX(i)));
        front=Math.max(front,p.getZ(i));back=Math.min(back,p.getZ(i));
      }
      rows.push([y,radius,(front-back)*.5,(front+back)*.5]);
    }
    return (x,y,side,offset)=>{
      const v=clamp((y-rows[0][0])/(rows[1][0]-rows[0][0]),0,rows.length-1);
      const i=Math.min(rows.length-2,Math.floor(v)),t=v-i,lo=rows[i],hi=rows[i+1];
      const lerp=k=>lo[k]+(hi[k]-lo[k])*t;
      return [x,y,lerp(3)+side*(lerp(2)*Math.sqrt(Math.max(.018,1-(x/lerp(1))**2))+offset)];
    };
  }

  function refine(index,geometries,T){
    if(index<2||index>12)return geometries;
    const surface=clothProfile(geometries.body),paint=new Map(),parts=new Map();
    const color=hex=>{
      if(!paint.has(hex))paint.set(hex,new T.Color(hex).convertSRGBToLinear());
      return paint.get(hex);
    };
    let part='body',side=1;
    const pt=(x,y,d=0)=>surface(x,y,side,d);
    function add(g,hex,matrix){
      if(matrix)g.applyMatrix4(matrix);
      if(!parts.has(part))parts.set(part,[]);
      parts.get(part).push([g,color(hex)]);
    }
    function line(points,hex,r=.003,closed=false){
      const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed);
      add(new T.TubeGeometry(path,Math.max(5,points.length*2),r,6,closed),hex);
    }
    function stitch(points,hex,d=.026,r=.0027){
      line(points.map(([x,y])=>pt(x,y,d)),hex,r);
    }
    function geometry(pos,norm,indices){
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
      g.setIndex(indices);
      if(norm)g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));else g.computeVertexNormals();
      return g;
    }
    function piece(points,hex,d=.026){
      const vertices=points.map(p=>new T.Vector2(...p)),pos=[],norm=[],ids=[];
      for(const face of T.ShapeUtils.triangulateShape(vertices,[])){
        const [a,b,c]=face.map(i=>vertices[i]);
        const steps=Math.max(1,Math.ceil(Math.max(a.distanceTo(b),a.distanceTo(c),b.distanceTo(c))/.035));
        const at=(u,v)=>{
          const x=a.x+((b.x-a.x)*u+(c.x-a.x)*v)/steps,y=a.y+((b.y-a.y)*u+(c.y-a.y)*v)/steps;
          const p=pt(x,y,d),vx=new T.Vector3(.002,0,pt(x+.001,y,d)[2]-pt(x-.001,y,d)[2]);
          const vy=new T.Vector3(0,.002,pt(x,y+.001,d)[2]-pt(x,y-.001,d)[2]),n=vx.cross(vy).normalize().multiplyScalar(side);
          const k=pos.length/3;pos.push(...p);norm.push(n.x,n.y,n.z);return k;
        };
        const emit=(i,j,k)=>side===1?ids.push(i,j,k):ids.push(i,k,j);
        for(let u=0;u<steps;u++)for(let v=0;v<steps-u;v++){
          emit(at(u,v),at(u+1,v),at(u,v+1));
          if(u+v<steps-1)emit(at(u+1,v),at(u+1,v+1),at(u,v+1));
        }
      }
      add(geometry(pos,norm,ids),hex);
    }
    function oval(hex,p,w,h,depth,roll=0,yaw=0){
      const m=new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(0,yaw,roll,'YXZ')),new T.Vector3(w,h,depth));
      add(new T.SphereGeometry(1,14,9),hex,m);
    }
    function dot(x,y,r,hex,d=.032){oval(hex,pt(x,y,d),r,r,.003);}
    function stripe(x1,y1,x2,y2,width,hex,d){
      const len=Math.hypot(x2-x1,y2-y1),a=-(y2-y1)*width/(2*len),b=(x2-x1)*width/(2*len);
      piece([[x1+a,y1+b],[x2+a,y2+b],[x2-a,y2-b],[x1-a,y1-b]],hex,d);
    }
    const honey='#CDA35F',bone='#E8D3A2',charcoal='#344349';
    if(index===2){
      // Chain-stitched varsity sleeve colours and a winged skateboard on the back yoke.
      for(const k of [-1,1]){
        piece([[k*.255,1.789],[k*.189,1.790],[k*.087,1.761],[k*.041,1.746],[k*.061,1.764],[k*.200,1.812]],'#D6B895',.015);
        stitch([[k*.247,1.782],[k*.195,1.783],[k*.072,1.746]],'#AD5842',.022,.0035);
      }
      dot(.149,1.635,.040,bone,.024);dot(.149,1.635,.032,'#B95239',.031);
      piece([[.128,1.633],[.140,1.650],[.170,1.650],[.161,1.642],[.145,1.641],[.139,1.633],[.163,1.633],[.150,1.618],[.129,1.618],[.135,1.626],[.145,1.626],[.151,1.633]],bone,.036);
      side=-1;
      for(const k of [-1,1])for(let j=0;j<3;j++){
        const y=1.57-j*.027,x=.20-j*.020;
        piece([[k*.05,y-.015],[k*.071,y+.019],[k*x,y+.065],[k*(x-.024),y+.030]],j===1?'#B85D40':bone,.014);
      }
      stitch([[-.105,1.518],[-.079,1.502],[.070,1.521],[.102,1.542]],'#E2CD9B',.023,.010);
      for(const k of [-1,1])dot(k*.060,1.489+k*.009,.010,'#AF633F',.028);
    }else if(index===3){
      // A bias-cut indigo silk neckerchief, tied above the cardigan's open V.
      piece([[-.101,1.842],[-.062,1.867],[-.005,1.834],[.082,1.858],[.108,1.833],[.014,1.782],[-.025,1.774]],'#345966',.042);
      piece([[-.019,1.791],[.009,1.802],[.045,1.725],[.068,1.682],[.039,1.646],[.008,1.684]],'#395864',.047);
      piece([[-.015,1.800],[-.042,1.772],[-.075,1.711],[-.052,1.699],[-.018,1.740],[.005,1.789]],'#47707A',.048);
      piece([[-.033,1.798],[-.009,1.815],[.017,1.803],[.010,1.774],[-.020,1.770]],'#677E7B',.056);
      stitch([[-.076,1.838],[-.043,1.819],[-.028,1.811]],'#CEAF8B',.050,.0028);
      stitch([[.021,1.766],[.034,1.721],[.053,1.676],[.038,1.662]],'#C9A780',.053,.0026);
      for(const [x,y] of [[.016,1.735],[.030,1.708],[-.048,1.735],[-.050,1.821],[.063,1.836]]){
        piece([[x-.006,y],[x,y+.009],[x+.006,y],[x,y-.009]],bone,.054);
      }
      side=-1;
      stitch([[-.245,1.745],[-.128,1.728],[0,1.711],[.128,1.728],[.245,1.745]],'#93556A',.011,.004);
    }else if(index===4){
      // Graded petals follow a dancer's wrap, opening out from the right clavicle.
      const branch=[[.082,1.765],[.133,1.736],[.151,1.684],[.147,1.637],[.165,1.579]];
      stitch(branch,'#99654C',.036,.0032);
      for(const [x,y,k] of [[.128,1.741,-1],[.148,1.696,1],[.146,1.664,-1],[.151,1.624,1]]){
        piece([[x,y],[x+k*.013,y+.022],[x+k*.039,y+.034],[x+k*.031,y+.012]],'#698071',.040);
      }
      for(const [x,y,r] of [[.119,1.753,.016],[.152,1.678,.012],[.164,1.582,.009]]){
        for(let i=0;i<5;i++){
          const a=i*tau/5;
          oval(i%2?'#D4A092':'#ECD4B8',pt(x+r*.7*Math.sin(a),y+r*.72*Math.cos(a),.042),r*.62,r,.0035,-a);
        }
        dot(x,y,r*.36,honey,.048);
      }
      for(let j=0;j<3;j++)stitch([[-.17,1.335-j*.013],[-.08,1.345-j*.014],[.032,1.347-j*.012],[.13,1.358-j*.010]],j===1?'#C47842':'#D6A454',.027,.004);
    }else if(index===5){
      // Carpenter's boxwood folding rule: two exposed leaves, graduations
      // along the upper blade, and a leather sheath over their lower ends.
      for(let j=0;j<2;j++){
        const x=-.104+j*.023,top=1.521-j*.026;
        piece([[x-.012,1.328],[x+.009,1.328],[x+.023,top],[x+.003,top+.003]],j?'#BF985F':'#CDAA65',.051+j*.002);
        for(let n=0;n<10;n++){const y=top-.010-.012*n,xx=x+.003-(top-y)*.08;
          stitch([[xx,y],[xx+(n%5===0?.012:.006),y+.001]],'#68553B',.055+j*.002,.00135);}
        dot(x+.013,top-.008,.0045,'#846C41',.059);
      }
      piece([[-.139,1.376],[-.062,1.381],[-.069,1.208],[-.103,1.18],[-.137,1.201]],'#905F42',.056);
      stitch([[-.133,1.365],[-.132,1.210],[-.104,1.192],[-.075,1.214],[-.070,1.37]],'#C8A16C',.060,.0028);
      for(const x of [-.126,-.078])dot(x,1.36,.0053,honey,.062);
      // Embossed end-grain on the front of the carpenter's bib.
      for(let i=0;i<3;i++){
        const r=.024+i*.008;
        line(Array.from({length:21},(_,j)=>{const a=tau*j/21;return pt(-.044+r*Math.cos(a),1.562+r*.78*Math.sin(a)+.003*Math.sin(a*3),.033);}),i%2?'#B38D61':'#705943',.0018,true);
      }
    }else if(index===6){
      // Corded sailor collar and a star appliqué sewn into the book satchel.
      for(const k of [-1,1])for(let j=0;j<2;j++)stitch([[k*(.083+j*.015),1.855],[k*(.216-j*.012),1.808],[k*(.188-j*.014),1.737],[k*(.035+j*.01),1.611+j*.012]],j?'#B2AC8B':'#617E8B',.032+j*.001,.0030);
      piece([[-.031,1.61],[-.007,1.607],[.004,1.552],[-.054,1.464],[-.065,1.495]],'#D28C6E',.055);
      stitch([[-.060,1.502],[-.048,1.49],[-.043,1.504]],bone,.059,.0024);
      const star=[];
      side=-1;
      for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.027:.052;star.push([-.101+r*Math.cos(a),1.651+r*Math.sin(a)]);}
      // The front flap projects beyond the shirt shell. Fit the patch to its actual ellipsoid.
      function bag(x,y,d){return [x,y,-.242-.060*Math.sqrt(Math.max(.01,1-(x/.212)**2-((y-1.649)/.135)**2))-d];}
      const c=bag(-.101,1.651,.002),verts=[...c],ids=[];
      for(const v of star)verts.push(...bag(...v,.003));
      for(let j=0;j<10;j++)ids.push(0,1+(j+1)%10,j+1);
      add(geometry(verts,null,ids),'#D7BA81');
      line(star.map(v=>bag(...v,.005)),'#A47555',.0023,true);
    }else if(index===7){
      // A two-colour Fair Isle yoke wraps the cardigan shoulders but leaves the
      // shirt and placket clear. The elongated stitches, not a flat badge,
      // make the knit legible both at the table and from the back.
      for(const k of [-1,1]){
        for(let j=0;j<3;j++){
          const x=k*(.130+.041*j),y=1.707-.010*j;
          const r=.024;
          piece([[x-r,y],[x,y+r*1.18],[x+r,y],[x,y-r*1.18]],j===1?'#E0C49E':'#D6B38C',.019);
          piece([[x-r*.40,y],[x,y+r*.58],[x+r*.40,y],[x,y-r*.58]],'#89755E',.022);
          for(const s of [-1,1])dot(x,y+s*.041,.004,'#CBA381',.021);
        }
      }
      side=-1;
      for(let j=-4;j<=4;j++){
        const x=j*.045,y=1.683+.032*(j/4)**2;
        piece([[x-.021,y],[x,y+.029],[x+.021,y],[x,y-.029]],bone,.014);
        piece([[x-.009,y],[x,y+.012],[x+.009,y],[x,y-.012]],'#947D63',.017);
      }
      for(const yy of [1.634,1.733]){
        stitch(Array.from({length:15},(_,j)=>{const t=j/7-1;return [.222*t,yy+.038*t*t];}),'#D7B592',.014,.0036);
      }
    }else if(index===8){
      // A screen-printed live-wave graphic on the cream concert tee.
      for(let j=-5;j<=5;j++){
        const x=-.015+j*.010,h=.012+.036*(.5+.5*Math.cos(j*.92+.35))*(1-Math.abs(j)/7);
        stripe(x,1.598-h,x,1.598+h,.005,j<0?'#977657':'#445D68',.027);
      }
      stitch([[-.071,1.526],[-.036,1.527],[.008,1.526],[.045,1.529]],'#A78A64',.027,.0024);
      // A lapel pin in the shape of a plectrum.
      piece([[.131,1.654],[.157,1.666],[.180,1.661],[.183,1.642],[.151,1.604],[.134,1.625]],'#BD9959',.035);
      piece([[.139,1.650],[.159,1.658],[.174,1.65],[.152,1.617]],'#54717C',.038);
      side=-1;
      for(let j=-2;j<=2;j++){const x=j*.044;
        stripe(x-.017,1.52,x+.017,1.62+.044*Math.cos(j*.86),.007,'#BDA784',.016);}
    }else if(index===9){
      // Embroidered camera strap. Its end tabs land at the metal eyelets on
      // the existing rangefinder, with a broad woven shoulder pad above.
      for(const k of [-1,1]){
        const pose=(t,w)=>[k*(.121+.042*Math.sin(t*Math.PI)+.016*t+w),1.823-.268*t,.097+.178*t-.018*Math.sin(t*tau)];
        const p=[],ids=[];
        for(let row=0;row<=22;row++)for(let j=0;j<2;j++){
          p.push(...pose(row/22,(j-.5)*.030));
          if(row<22&&!j){
            const i=row*2;
            if(k<0)ids.push(i,i+1,i+2,i+1,i+3,i+2);else ids.push(i,i+2,i+1,i+1,i+2,i+3);
          }
        }
        add(geometry(p,null,ids),'#8F674B');
        for(const w of [-.011,.011])line(Array.from({length:13},(_,j)=>pose(j/12,w)),honey,.0027);
        for(let j=0;j<7;j++)line([pose(.19+j*.073,-.008),pose(.204+j*.073,.006)],'#C4AC82',.0019);
        const a=pose(.55,0);line([[a[0]-.018,a[1]+.008,a[2]+.006],[a[0]+.018,a[1]+.008,a[2]+.006],[a[0]+.018,a[1]-.009,a[2]+.014],[a[0]-.018,a[1]-.009,a[2]+.014]],'#AD9F78',.003,true);
      }
    }else if(index===10){
      // Sleeved race jacket with an inset diagonally cut reflective colour block.
      piece([[-.170,1.610],[-.116,1.626],[-.084,1.593],[-.132,1.576]],'#D1C48D',.026);
      piece([[-.153,1.607],[-.121,1.617],[-.103,1.599],[-.137,1.588]],'#427477',.030);
      for(const k of [-1,1]){
        const x=k*.225;
        piece([[x,1.805],[k*.271,1.776],[k*.231,1.758],[k*.197,1.789]],'#68877A',.019);
        stitch([[k*.200,1.796],[k*.229,1.772],[k*.251,1.783]],'#C6C3A0',.023,.004);
      }
      const z=pt(.044,1.727,.067);
      line([z,[z[0]+.006,z[1]-.016,z[2]+.007],[z[0]+.008,z[1]-.035,z[2]+.008]],'#435A54',.004);
      oval('#DD9855',[z[0]+.009,z[1]-.039,z[2]+.009],.007,.014,.004,-.12);
    }else if(index===11){
      // The second half of the florist's botanical embroidery is a poppy
      // paired with an unopened bud. Petals catch window light at different angles.
      stitch([[-.079,1.387],[-.081,1.424],[-.074,1.465],[-.091,1.512],[-.092,1.544]],'#B1B599',.052,.0035);
      stitch([[-.078,1.443],[-.043,1.479],[-.036,1.512]],'#ADB598',.053,.0026);
      for(const [x,y,s] of [[-.081,1.421,-1],[-.077,1.465,1],[-.087,1.497,-1]]){
        piece([[x,y],[x+s*.012,y+.025],[x+s*.036,y+.038],[x+s*.031,y+.016]],'#97A68C',.055);
      }
      for(let j=0;j<5;j++){
        const a=tau*j/5+.32,x=-.093+.016*Math.sin(a),y=1.544+.014*Math.cos(a);
        oval(j%2?'#C99E86':'#D9B3A0',pt(x,y,.054+.001*j),.016,.020,.0035,-a);
      }
      dot(-.093,1.544,.0083,'#786C4E',.066);
      oval('#BC927E',pt(-.035,1.515,.056),.009,.013,.004,-.28);
    }else{
      // The collector's silk pocket square folds into his corduroy breast welt.
      piece([[.104,1.627],[.112,1.681],[.139,1.663],[.158,1.693],[.177,1.667],[.195,1.681],[.191,1.63]],'#8D544D',.051);
      piece([[.116,1.672],[.146,1.642],[.139,1.664]],'#C29675',.056);
      piece([[.143,1.662],[.157,1.688],[.176,1.662],[.162,1.643]],'#B38066',.055);
      stitch([[.108,1.635],[.142,1.639],[.192,1.646]],'#765541',.061,.0055);
      // Quiet herringbone on the turtleneck shoulders behind the lapels.
      for(let j=-2;j<=2;j++){const x=.024*j,y=1.754-.014*Math.abs(j);
        for(const sign of [-1,1])stitch([[x+sign*.009,y+.016],[x,y],[x+sign*.009,y-.014]],'#849280',.030,.0021);
      }
    }

    // Vertical, low-contrast fabric compression below the elbow and at the
    // knee. Move paint and cloth together; held props and bare hands keep
    // their original contact positions. Specialised rolled sleeves are intact.
    for(const k of [-1,1]){
      for(const name of ['shin','arm']){
        if(name==='arm'&&index>=9)continue;
        const geo=geometries[name+k],p=geo.attributes.position,c=geo.attributes.color;
        const knee=name==='shin',cy=knee?.45:1.48,cx=k*(knee?.128:.317),cz=knee?.010:-.008;
        const span=knee?.114:.136;
        for(let j=0;j<p.count;j++){
          const x=p.getX(j),y=p.getY(j),z=p.getZ(j),dx=x-cx,dz=z-cz,r=Math.hypot(dx,dz);
          const a=Math.atan2(dx,dz),v=(y-cy)/span;
          if(Math.abs(v)>1||r<.028)continue;
          const envelope=(1-v*v)**2*(knee?.88-.32*Math.cos(a):.78+.22*Math.sin(k*a));
          const wave=Math.cos(v*5.9+1.5*Math.sin(a)*k+.6*Math.cos(2*a));
          const crease=envelope*(.0043*wave-.0020*Math.cos(v*10.2+2*Math.sin(a)));
          p.setXYZ(j,x+crease*dx/r,y,z+crease*dz/r);
          const shade=1+.065*wave*envelope;
          c.setXYZ(j,c.getX(j)*shade,c.getY(j)*shade,c.getZ(j)*shade);
        }
        geo.computeVertexNormals();geo.computeBoundingSphere();
      }
    }
    // Cut and finish the lower half in the same bind pose as each leg. The
    // amount of ease changes from thigh to ankle, so a dancer's tapered pant
    // and a carpenter's straight work jean have different silhouettes.
    const cuts=[
      [.13,.22,'denim','#627489','#AA9271'],[-.03,-.08,'pressed','#5C525B','#948583'],
      [.02,-.25,'warmup','#665265','#C2998D'],[.14,.12,'cargo','#748071','#BBAB82'],
      [-.045,-.10,'school','#546880','#ACB1AA'],[.10,.12,'pressed','#766053','#AF9B85'],
      [-.065,-.12,'denim','#554A5A','#BA9474'],[.09,.02,'cargo','#616B5E','#9C9A80'],
      [-.06,-.19,'reflective','#455C5C','#B4B69B'],[.065,-.09,'cargo','#727663','#B1A487'],
      [.09,.08,'pressed','#66564B','#AA9B83']
    ];
    const [thighEase,ankleEase,cut,pocketTone,thread]=cuts[index-2];
    function panelGrid(rows,cols,sample,pigment){
      const points=[],faces=[];
      for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++)points.push(...sample(i/rows,j/cols));
      for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
        const a=i*(cols+1)+j,b=a+1,c=a+cols+1;
        faces.push(a,b,c,b,c+1,c);
      }
      add(geometry(points,null,faces),pigment);
    }
    const sequence=(count,get)=>Array.from({length:count+1},(_,i)=>get(i/count));
    for(const k of [-1,1]){
      for(const section of ['thigh','shin']){
        const geo=geometries[section+k],p=geo.attributes.position,col=geo.attributes.color;
        for(let i=0;i<p.count;i++){
          const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
          const cx=k*(section==='shin'?.128:.122),dx=x-cx,dz=z-.003;
          const outward=k*dx>0?1:.30;
          const t=clamp((y-.17)/.75,0,1);
          const ease=ankleEase*(1-t)+thighEase*t;
          const angle=Math.atan2(dx,dz),calf=clamp((.48-y)/.22,0,1);
          const ankleFold=.0035*calf*Math.cos(46*y+1.7*k*Math.sin(angle))*
            Math.exp(-((y-.25)**2)/.010);
          const radius=Math.max(.025,Math.hypot(dx,dz));
          p.setXYZ(i,x+dx*(ease*outward+ankleFold/radius),y,z+dz*(.51*ease+ankleFold/radius));
          if(cut==='pressed'&&dz>0){
            const crease=Math.exp(-((dx/.025)**2)) * Math.max(0,dz/.14);
            p.setZ(i,p.getZ(i)+.006*crease);
            col.setXYZ(i,col.getX(i)*(1+.07*crease),col.getY(i)*(1+.07*crease),col.getZ(i)*(1+.07*crease));
          }
        }
        geo.computeVertexNormals();geo.computeBoundingSphere();
      }
      // Tailor the pocket to the actual thigh shell. Bilinear sampling picks
      // up the same change of width as the leg when its cut is altered.
      const thigh=geometries['thigh'+k].attributes.position;
      function onLeg(y,a,d){
        const rows=20,cols=28,t=clamp((y-.48)/.54,0,1)*rows;
        const row=Math.min(rows-1,Math.floor(t)),u=t-row;
        const v=((a/tau)%1+1)%1*cols,j=Math.floor(v),f=v-j;
        const at=(r,c)=>new T.Vector3().fromBufferAttribute(thigh,r*cols+(c%cols));
        const p=at(row,j).lerp(at(row,j+1),f).lerp(at(row+1,j).lerp(at(row+1,j+1),f),u);
        return [p.x+Math.sin(a)*d,p.y,p.z+Math.cos(a)*d];
      }
      part='thigh'+k;
      if(cut==='cargo'||cut==='denim'){
        const pocket=(u,v,d)=>onLeg(.666+u*.145+.016*Math.abs(2*v-1)**4,
          k*(.72+.95*v),d+.005*Math.sin(v*Math.PI)*Math.sin(u*Math.PI));
        panelGrid(9,10,(u,v)=>pocket(u,k>0?v:1-v,.0045),pocketTone);
        for(const v of [.06,.94])line(sequence(7,u=>pocket(.04+.90*u,v,.007)),thread,.0016);
        line(sequence(8,v=>pocket(.045,.05+.9*v,.007)),thread,.0016);
        if(cut==='cargo'){
          panelGrid(5,10,(u,v)=>pocket(.73+.28*u,k>0?v:1-v,.009),pocketTone);
          line(sequence(8,v=>pocket(.745,v,.011)),thread,.002);
          oval('#987F60',pocket(.80,.5,.012),.0042,.006,.0042);
        }
      }else if(cut==='warmup'||cut==='reflective'){
        const slip=(u,v)=>onLeg(.53+.39*u,k*(1.18+.12*v)+k*.05*Math.sin(Math.PI*u),.004);
        panelGrid(18,2,(u,v)=>slip(u,k>0?v:1-v),cut==='warmup'?'#A68089':'#9CABA0');
      }else{
        // Slanted welt opening in the slacks, visible from the front as well as the side.
        line(sequence(14,t=>onLeg(.836+.098*t,k*(1.37-.69*t),.005)),thread,.0028);
      }
      if(global.DinerGuestFootwear)continue;
      part='foot'+k;
      const cx=k*.128,sport=[2,6,10].includes(index),trim=sport?'#AFAD91':'#8B7059';
      // The toe follows the shoe upper's curved surface. A canvas toe shield
      // and derby broguing both sit above that surface at grazing angles.
      function toe(x,m,d=0){
        const z=.161+m+.011*(x/.066)**2;
        const top=.091+.064*Math.sqrt(Math.max(.008,1-(x/.107)**2-((z-.074)/.154)**2));
        return [cx+x,top+d,z];
      }
      if(sport){
        panelGrid(7,16,(u,v)=>toe((.076-.025*u)*(1-2*v),.008+.045*u,.0018),
          index===10?'#577271':'#D6C7A9');
        line(sequence(18,v=>toe(.073*(v*2-1),.012,.0033)),trim,.0019);
      }else{
        line(sequence(18,v=>toe(.073*(v*2-1),.011,.002)),trim,.0024);
        for(let j=0;j<7;j++)oval('#504138',toe((j-3)*.0158,.018,.0024),.0025,.0015,.0027);
      }
    }
    for(const [name,extra] of parts){
      const base=geometries[name],original=base.attributes.position.count;
      let count=original,nIndex=base.index.count;
      for(const [g] of extra){count+=g.attributes.position.count;nIndex+=g.index.count;}
      const p=new Float32Array(count*3),n=new Float32Array(count*3),c=new Float32Array(count*3);
      p.set(base.attributes.position.array);n.set(base.attributes.normal.array);c.set(base.attributes.color.array);
      const indices=count>65535?new Uint32Array(nIndex):new Uint16Array(nIndex);
      indices.set(base.index.array);let offset=original,j=base.index.count;
      for(const [geo,pigment] of extra){
        const pos=geo.attributes.position;
        p.set(pos.array,offset*3);n.set(geo.attributes.normal.array,offset*3);
        for(let i=0;i<pos.count;i++){const dest=(i+offset)*3;c[dest]=pigment.r;c[dest+1]=pigment.g;c[dest+2]=pigment.b;}
        for(const id of geo.index.array)indices[j++]=offset+id;
        offset+=pos.count;geo.dispose();
      }
      const merged=new T.BufferGeometry();
      merged.setAttribute('position',new T.BufferAttribute(p,3));merged.setAttribute('normal',new T.BufferAttribute(n,3));
      merged.setAttribute('color',new T.BufferAttribute(c,3));merged.setIndex(new T.BufferAttribute(indices,1));
      merged.computeBoundingSphere();geometries[name]=merged;
    }
    global.DinerGuestFootwear?.refine(index,geometries,T);
    return geometries;
  }
  global.DinerGuestWardrobe=Object.freeze({refine});
})(window);
