/* Original house owner sculpt, authored in the diner's y-up, +z-forward joint space. */
(function (global) {
  'use strict';
  const eyeY=2.252,mouthY=2.095,tau=2*Math.PI;
  const clamp=t=>Math.max(0,Math.min(1,t));
  const smooth=t=>(t=clamp(t),t*t*(3-2*t));
  const mix=(a,b,t)=>a+(b-a)*t;
  const bell=(x,y,cx,cy,w,h)=>Math.exp(-(((x-cx)/w)**2)-((y-cy)/h)**2);
  function create(T){
    const sections={},colors=new Map();
    function rgb(hex){
      if(!colors.has(hex))colors.set(hex,new T.Color(hex).convertSRGBToLinear().toArray());
      return colors.get(hex);
    }
    function tint(a,b,t){t=clamp(t);return [mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];}
    // Every patch supplies its outward direction. This also keeps the two
    // opposite-facing ears and the lower eyelids front-facing in Canvas.
    function patch(part,rows,cols,wrap,vertex,outward){
      const mesh=sections[part]??=({position:[],color:[],index:[],uv:[]}),base=mesh.position.length/3;
      const stride=wrap?cols:cols+1;
      for(let i=0;i<=rows;i++)for(let j=0;j<stride;j++){
        const [x,y,z,c,uv]=vertex(i/rows,j/cols);
        mesh.position.push(x,y,z);mesh.color.push(...c);
        if(uv)mesh.uv.push(...uv);
        else if(part==='head'&&z>.025)mesh.uv.push(clamp(.5+x/.43),clamp((y-1.96)/.575));
        else mesh.uv.push(.005,.995);
      }
      const p=mesh.position;
      function triangle(a,b,c){
        const ia=a*3,ib=b*3,ic=c*3,ux=p[ib]-p[ia],uy=p[ib+1]-p[ia+1],uz=p[ib+2]-p[ia+2];
        const vx=p[ic]-p[ia],vy=p[ic+1]-p[ia+1],vz=p[ic+2]-p[ia+2];
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
        if(nx*nx+ny*ny+nz*nz<1e-23)return;
        const n=outward(p[ia],p[ia+1],p[ia+2],Math.floor((a-base)/stride)/rows);
        if(nx*n[0]+ny*n[1]+nz*n[2]>=0)mesh.index.push(a,b,c);else mesh.index.push(a,c,b);
      }
      for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
        const a=base+i*stride+j,b=base+i*stride+(j+1)%stride,c=b+stride,d=a+stride;
        triangle(a,b,d);triangle(d,b,c);
      }
    }
    const front=()=>[0,0,1];
    const skin=rgb('#D6A484'),highSkin=rgb('#E4B99A'),warmSkin=rgb('#BD8973'),shadowSkin=rgb('#A57666');
    const hairDark=rgb('#202230'),hairBase=rgb('#3D3744'),hairLight=rgb('#8D736D');
    // Transverse sections vary independently in the face and occiput.
    // The flat mandibular plane rolls into the narrower mental eminence.
    const head=[
      [1.978,.012,.144,.117],[1.988,.043,.169,.062],[2.007,.074,.183,.012],
      [2.039,.112,.180,-.072],[2.074,.144,.174,-.124],[2.111,.165,.171,-.151],
      [2.163,.178,.174,-.172],[2.202,.189,.176,-.185],[2.251,.184,.177,-.194],
      [2.302,.185,.186,-.197],[2.35,.185,.183,-.196],[2.405,.176,.167,-.188],
      [2.452,.152,.139,-.164],[2.477,.125,.107,-.140],[2.498,.085,.065,-.105],
      [2.508,.044,.027,-.063],[2.512,.003,-.014,-.020]
    ];
    function profile(y){
      let i=0;while(i<head.length-2&&y>head[i+1][0])i++;
      const a=head[i],b=head[i+1],prev=head[Math.max(0,i-1)],next=head[Math.min(head.length-1,i+2)];
      const h=b[0]-a[0],t=clamp((y-a[0])/h),t2=t*t,t3=t2*t;
      function cubic(k){
        const da=(b[k]-prev[k])/(b[0]-prev[0]),db=(next[k]-a[k])/(next[0]-a[0]);
        return (2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*h*da+(-2*t3+3*t2)*b[k]+(t3-t2)*h*db;
      }
      return [cubic(1),cubic(2),cubic(3)];
    }
    function relief(x,y,c){
      const a=Math.abs(x),g=(cx,cy,w,h)=>bell(a,y,cx,cy,w,h);
      const nose=.026*g(0,2.219,.022,.090)+.033*g(0,2.170,.025,.028)
        +.009*g(0,2.154,.014,.024)+.010*g(.025,2.155,.015,.013)-.005*g(.019,2.146,.011,.011);
      const bone=.009*g(.079,2.284,.055,.025)-.010*g(.092,2.251,.061,.035)
        +.007*g(.123,2.203,.066,.053)-.003*g(.132,2.133,.055,.061)
        +.007*g(.140,2.086,.034,.034)+.012*g(0,2.025,.074,.035);
      const muzzle=.009*g(0,2.095,.077,.041)+.0035*g(.014,2.124,.013,.024)
        -.002*g(0,2.126,.009,.027)-.0025*g(0,2.064,.052,.012);
      return Math.max(0,c)**1.4*(nose+bone+muzzle);
    }
    function faceZ(x,y){
      const [radius,f,b]=profile(y),c=Math.sqrt(Math.max(0,1-(x/radius)**2));
      const center=(f+b)*.5;return center+(f-center)*c**.77+relief(x,y,c);
    }
    function skinColor(x,y,z,c){
      const a=Math.abs(x),g=(cx,cy,w,h)=>bell(a,y,cx,cy,w,h),vis=Math.max(0,c);
      let color=tint(skin,highSkin,.10+.26*vis*g(.069,2.324,.123,.13)+.19*vis*g(.104,2.202,.080,.050));
      color=tint(color,warmSkin,.39*vis*g(.124,2.189,.052,.039)+.33*g(.026,2.157,.036,.025)+.26*vis*g(.087,2.237,.051,.015)+.17*vis*g(.093,2.283,.065,.028));
      color=tint(color,shadowSkin,.34*vis*g(.092,2.272,.051,.028)+.18*(1-vis)+.15*vis*g(0,2.067,.053,.012));
      // A cool, close-shaven beard plane is strongest below the jaw, and
      // fades along the sideburn instead of drawing a border around the face.
      const beard=smooth((2.064+.101*(a/.185)**2-y)/.055)*smooth((y-1.975)/.033);
      const upper=.20*g(.030,2.113,.039,.010);
      return tint(color,rgb('#8E7F7C'),(.25*beard+upper*.27)*(.76+.24*vis));
    }
    function skull(u,v){
      const y=mix(head[0][0],head.at(-1)[0],u),[rx,f,b]=profile(y),ang=tau*v;
      const c=Math.cos(ang),x=rx*Math.sin(ang),center=(f+b)*.5;
      const z=center+(f-center)*Math.sign(c)*Math.abs(c)**(c>0?.77:.96)+relief(x,y,c);
      return [x,y,z,skinColor(x,y,z,c)];
    }
    const licensed=global.DinerPortraitMesh&&global.DinerGuestFaces?.source;
    if(!licensed){
    patch('head',88,108,true,skull,(x,y,z)=>[x,(y-2.235)*.35,z+.012]);
    function onFace(x,y,offset,c){return [x,y,faceZ(x,y)+offset,c];}
    // The bridge, tip, alae and philtral columns are part of the continuous
    // face mesh. Only the occluded nostril opening needs a separate patch.
    for(const side of [-1,1]){
      patch('head',4,16,false,(u,v)=>{
        const bell=Math.sin(Math.PI*v)**.78,x=side*(.014+.016*v),y=2.1493-.0023*Math.sin(Math.PI*v)+.0021*(u-.5)*bell;
        return onFace(x,y,.0006,tint(rgb('#926752'),rgb('#BB8C73'),.34+.46*u));
      },front);
    }
    function aperture(t){
      t=clamp(t);const h=Math.sin(Math.PI*t),y=eyeY-.0052+.0105*t;
      return [y-.0148*h**.78,y+.0209*h**.78];
    }
    for(const side of [-1,1]){
      const eye='eyes'+side,iris='iris'+side;
      const eyeX=t=>side*(.034+.104*t);
      function eyeSurface(t,u){
        const x=eyeX(t),[lo,hi]=aperture(t),y=mix(lo,hi,u),bulge=Math.sin(Math.PI*t)*Math.sin(Math.PI*u);
        return [x,y,faceZ(x,y)+.0037+.0038*bulge];
      }
      patch(eye,8,29,false,(u,v)=>{
        const [x,y,z]=eyeSurface(v,u),ends=(1-Math.sin(v*Math.PI))**2;
        let color=tint(rgb('#FAEFE0'),rgb('#AC9BAB'),.05+.43*u*u+.17*ends);
        color=tint(color,rgb('#C78D79'),.48*Math.exp(-((v/.11)**2)));
        return [x,y,z,color];
      },front);
      // Fleshy eyelids turn into a dark tapered lash root at the top. The
      // outer corner has no drawn wing. The lower rim picks up warm light.
      for(const upper of [false,true]){
        patch(eye,5,30,false,(u,v)=>{
          const [x,y0,z]=eyeSurface(v,upper?1:0),w=Math.sin(v*Math.PI)**.67;
          const y=y0+(upper?1:-1)*(upper?.0092:.0045)*u*w;
          const color=upper?tint(rgb('#332B36'),warmSkin,smooth((u-.35)/.63)):tint(rgb('#996C65'),highSkin,.24+.60*u);
          return [x,y,mix(z+.0012,faceZ(x,y)+.0016,u),color];
        },front);
      }
      // The outer end of each upper lid tapers to a narrow lash instead of
      // terminating abruptly in the temporal canthus.
      patch(eye,3,13,false,(u,v)=>{
        const x=side*(.128+.016*v),y=eyeY+.006+v*.006+(u-.5)*.0037*(1-v);
        return onFace(x,y,.0043,tint(rgb('#382735'),rgb('#7C5757'),.23*v));
      },front);
      const ex=side*.0805-.0014,ey=eyeY+.0045;
      function irisDisc(rx,ry,col,offset,cx=ex,cy=ey){
        patch(iris,14,60,true,(u,v)=>{
          const theta=v*tau,x=cx+Math.cos(theta)*rx*u,raw=cy+Math.sin(theta)*ry*u;
          const t=clamp((Math.abs(x)-.034)/.104),[lo,hi]=aperture(t),y=Math.max(lo+.0007,Math.min(hi-.0007,raw));
          const lidDepth=.0037+.0038*Math.sin(Math.PI*t)*Math.sin(Math.PI*(y-lo)/Math.max(.0001,hi-lo));
          return onFace(x,y,lidDepth+offset,typeof col==='function'?col(u,theta,y):col);
        },front);
      }
      irisDisc(.0272,.0280,(r,a,y)=>{
        const lower=clamp((eyeY+.019-y)/.035),rays=.5+.5*Math.sin(28*a+.92*Math.sin(a*13)+r*4);
        const inner=tint(rgb('#40302E'),rgb('#D3A460'),.10+.59*lower+.16*rays*lower);
        const amber=tint(inner,rgb('#F4C980'),.45*lower*smooth((r-.45)/.22)*rays);
        return tint(amber,rgb('#382B32'),smooth((r-.78)/.22)*.94);
      },.0030);
      irisDisc(.0140,.0160,rgb('#2A2730'),.0043);
      irisDisc(.0054,.0042,rgb('#FFF9E9'),.0052,ex-.0076,ey+.0088);
      irisDisc(.0029,.0020,rgb('#FADEB7'),.0050,ex+.0129,ey-.0098);
      // Supraorbital ridge with a brushed, tapered dark brow over its crest.
      patch('head',7,38,false,(u,v)=>{
        const x=side*(.039+.100*v),arch=.008*Math.sin(Math.PI*v)+.005*Math.exp(-(((v-.69)/.21)**2));
        const y=2.282+.005*v+arch+.002*side*Math.sin(Math.PI*v)+(u-.5)*(.008+.004*Math.sin(Math.PI*v))*(.34+.66*Math.sin(Math.PI*v)**.55)*(1-.82*v**3);
        const edge=Math.sin(Math.PI*u),fiber=.5+.5*Math.cos(70*v+6*u);
        const tails=Math.exp(-((v/.12)**2))+v**4;
        return onFace(x,y,.0017+.0013*edge,tint(rgb('#3C3038'),rgb('#997E73'),.04+.12*edge+.14*fiber+.25*tails));
      },front);
      patch('head',2,28,false,(u,v)=>{
        const t=.11+.81*v,[,hi]=aperture(t),x=eyeX(t),y=hi+.010+.0028*Math.sin(Math.PI*t)+.0015*u*Math.sin(Math.PI*v);
        return onFace(x,y,.0007,tint(shadowSkin,warmSkin,.43+.3*u));
      },front);
    }
    function lipSeam(x){
      const t=x/.064;return mouthY+.0063*t*t+.0018*t-.0011*Math.exp(-((t/.23)**2));
    }
    for(const upper of [false,true]){
      patch('mouth',8,48,false,(u,v)=>{
        const t=v*2-1,x=.064*t,weight=(1-t*t)**.72,base=lipSeam(x);
        const height=upper?(.0058+.0027*Math.exp(-(((Math.abs(t)-.32)/.20)**2)))*weight:.0107*weight;
        const y=base+(upper?1:-1)*height*u,ridge=Math.sin(Math.PI*u)**2*weight;
        let tone=upper?tint(rgb('#AC7C6C'),rgb('#CA9980'),.24+.50*u):tint(rgb('#B48673'),rgb('#D5A68A'),.24+.62*Math.sin(Math.PI*u*.82));
        if(!upper)tone=tint(tone,rgb('#BD857E'),.48*(1-t*t)*Math.sin(Math.PI*(.16+.68*u)));
        const surface=skinColor(x,y,faceZ(x,y),Math.sqrt(1-(x/profile(y)[0])**2));
        const pigment=tint(tone,surface,clamp(smooth((u-.31)/.68)+.22*Math.abs(t)**3));
        return onFace(x,y,.00028+(upper?.00028:.00048)*ridge+.00028*(1-u)**2*weight,pigment);
      },front);
    }
    patch('mouth',2,47,false,(u,v)=>{
      const t=2*v-1,x=.064*t,y=lipSeam(x)+(u-.5)*.0018*(1-t*t)**.63;
      return onFace(x,y,.0013,tint(rgb('#755452'),warmSkin,.15+.50*Math.abs(t)**3));
    },front);
    for(const side of [-1,1]){
      // A single folded auricle with a helix, antihelix, concha and tragus.
      // Its outer edge returns into the head behind the mandible.
      patch('head',27,52,true,(r,v)=>{
        const a=tau*v,cs=Math.cos(a),sn=Math.sin(a);
        const u=r*cs,w=r*sn,horiz=(.037+.007*w)*u;
        const helix=.017*Math.exp(-(((r-.80)/.125)**2))*(.62+.38*clamp(w+.70));
        const anti=.0075*Math.exp(-(((u+.10-.26*w)/.15)**2)-(((w-.03)/.64)**2))
          +.0045*bell(u,w,.01,.40,.33,.13);
        const concha=.008*bell(u,w,.25,-.05,.39,.34),tragus=.008*bell(u,w,.52,-.24,.14,.19);
        const depth=.005*(1-r*r)+helix+anti+tragus-concha-.0045*r**5;
        const x=side*(.182+.015*(1-r*r)+.94*depth-.19*horiz+.013*w);
        const y=2.205+w*.059-.003*u,z=-.020+.98*horiz+.35*depth;
        let paint=tint(warmSkin,highSkin,.31+.39*clamp(helix/.016)+.13*w);
        paint=tint(paint,rgb('#A77569'),.63*clamp(concha/.008));
        return [x,y,z,paint];
      },()=>[side*.94,0,.34]);
    }
    }
    function angle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
    function hairline(a){
      const signed=angle(a),d=Math.abs(signed),burn=Math.exp(-(((d-1.27)/.078)**2));
      const forehead=.134*Math.exp(-((d/1.11)**2));
      const temple=.045*Math.exp(-(((d-.82)/.32)**2))+.052*Math.exp(-(((d-1.81)/.36)**2));
      const widow=.010*Math.exp(-((angle(a+.12)/.18)**2));
      const nape=.101*smooth((d-1.89)/1.12);
      const irregular=(.0032*Math.sin(16*a+.8)+.0018*Math.sin(23*a))*smooth((d-1.80)/.54);
      const openPart=.034*Math.exp(-((angle(a-.58)/.40)**2))-.012*Math.exp(-((angle(a+.48)/.34)**2));
      return 2.205+forehead+temple-.036*burn-widow-nape+irregular+.006*Math.sin(signed*2)+openPart
        +.028*Math.exp(-((signed/1.18)**2));
    }
    // Raked waves follow a true side part. The phase and thickness turn
    // together over the crown and fade into a short, tapered occiput.
    function hairPoint(u,a,extra=0){
      const line=hairline(a),baseY=mix(line,2.512,Math.sin(u*Math.PI*.5));
      const [rx,f,b]=profile(baseY),center=(f+b)*.5,c=Math.cos(a),s=Math.sin(a),frontness=clamp((c+.12)/1.08);
      const leftWave=Math.exp(-((angle(a+.34)/1.15)**2)),crown=Math.sin(Math.PI*u);
      const section=Math.exp(-((angle(a+.27)/1.31)**2));
      const turn=section*1.23*smooth(u/.89);
      const flow=a+(.45+.12*frontness)*(1-section)*Math.sin(u*Math.PI*.78)-turn;
      const sweepPhase=flow*13+.51*Math.sin(3.7*flow+.26)+.32*Math.sin(3.6*u+.4);
      const ridge=(.5+.5*Math.cos(sweepPhase))**2.1;
      const sidePart=Math.exp(-((angle(a-(.48+.83*u))/.056)**2))*(.32+.68*crown)*frontness;
      const taper=(1-u**6);
      const crest=(.0034+.010*section)*ridge*Math.sin(Math.PI*(.08+.90*u))**.87;
      const thickness=(.0028+.007*crown+.013*crown*leftWave+crest-.0030*sidePart+extra)*taper;
      const point=smooth((u-.975)/.025);
      const x=(rx+thickness)*s*(1-point)-.010*u*u;
      const z=mix(center+(f-center)*Math.sign(c)*Math.abs(c)**(c<0?.95:.78)+thickness*c,-.018,point);
      const quiff=.025*leftWave*clamp((c+.85)/1.7)*smooth(u/.43)*(1-u**5);
      const templeTips=.010*Math.exp(-((angle(a+.86)/.085)**2))+.008*Math.exp(-((angle(a+.37)/.065)**2));
      const ends=(1-smooth(u/.13))*(section*(.0044*ridge+.0018*Math.cos(8*flow))+templeTips);
      const y=baseY+.003+quiff+.0040*ridge*crown+.009*u**3-ends;
      return [x,y,z,{ridge,sidePart,frontness,crown,flow,sweepPhase,section}];
    }
    function hairColor(u,a,p){
      const sheen=.21+.37*Math.exp(-(((u-.55-.095*Math.cos(a+.55))/.22)**2));
      const strand=(.5+.5*Math.cos(p.sweepPhase+.40))**5;
      let c=tint(hairDark,hairBase,.33+.37*p.frontness+.16*p.crown);
      const fine=(.5+.5*Math.cos(4*p.sweepPhase+.72*Math.sin(p.flow*17)))**4;
      c=tint(c,hairLight,.028+(.23+.19*p.section)*strand*sheen+.14*p.ridge*sheen+.065*fine*sheen+.048*p.frontness);
      const brush=p.section*Math.exp(-(((u-.49-.07*Math.cos(a))/.25)**2));
      c=tint(c,rgb('#987564'),brush*(.062*strand+.048*fine));
      c=tint(c,rgb('#937564'),p.sidePart*.19*(.42+.58*p.crown));
      const back=smooth((Math.abs(angle(a))-1.67)/.77);
      const fade=back*(1-smooth(u/.28));
      const grain=.5+.5*Math.cos(p.flow*83+Math.sin(p.flow*29)+u*18);
      return tint(c,rgb('#977A66'),fade*(.23+.29*(1-smooth(u/.06))+.12*grain));
    }
    patch('hair',54,192,true,(u,v)=>{
      const a=v*tau,[x,y,z,p]=hairPoint(u,a);
      const band=reflectedWindow(x,y,z,p.ridge,.72);
      return [x,y,z,tint(hairColor(u,a,p),rgb('#AFA3A8'),band),[.035+v*.93,.04+.91*u]];
    },(x,y,z)=>[x,(y-2.255)*.86,z+.018]);
    // The outer hairstyle has its own silhouette. Each convex, tapered lock
    // has a root, a lifted crest and an overhanging tip; the undercut shows
    // through the gaps, particularly behind the ear.
    const vec=(x,y,z)=>new T.Vector3(x,y,z);
    function reflectedWindow(x,y,z,channel,strength){
      const center=2.463+.03*x-.012*Math.cos(18*x)-.041*Math.sin(4*z);
      const front=smooth((z+.068)/.171);
      const core=Math.exp(-(((y-center)/.016)**2));
      const glass=Math.exp(-(((y-center-.021)/.0065)**2));
      return strength*front*(.48*core+.16*glass)*(.14+.86*channel);
    }
    function lock(points,width,depth,seed,lit){
      const path=new T.CatmullRomCurve3(points,false,'centripetal');
      const origin=vec(0,0,0),tangent=vec(0,0,0),out=vec(0,0,0),lateral=vec(0,0,0);
      patch('hair',32,12,false,(u,v)=>{
        path.getPoint(u,origin);path.getTangent(u,tangent);
        out.set(origin.x,(origin.y-2.29)*1.34,origin.z+.017).normalize();
        lateral.crossVectors(tangent,out).normalize();out.crossVectors(lateral,tangent).normalize();
        const a=tau*v,r=(.24+.85*Math.sin(Math.PI*(.055+.88*u))**.70)*(1-.997*u**2.4);
        const arc=Math.cos(a),litSide=Math.max(0,arc),groove=.77+.23*Math.cos(2*a+u*2.8+seed);
        const pos=origin.clone().addScaledVector(lateral,width*r*Math.sin(a)).addScaledVector(out,depth*r*arc*groove);
        const glint=Math.exp(-(((u-.45-.08*Math.sin(seed+.6*v))/.11)**2));
        const edge=(.5+.5*Math.cos(v*3*tau+seed*.38+u*1.65))**3;
        let c=tint(hairDark,hairBase,.17+.61*litSide+.12*Math.sin(u*Math.PI));
        c=tint(c,hairLight,lit*(.035+.13*litSide+.46*glint*(.38+.62*edge)*litSide));
        c=tint(c,rgb('#B7ABB5'),reflectedWindow(pos.x,pos.y,pos.z,edge,lit)*(.32+.68*litSide));
        return [pos.x,pos.y,pos.z,c,[.04+.92*v,.06+.90*(1-u)]];
      },(x,y,z,u)=>{
        path.getPoint(u,origin);
        const dx=x-origin.x,dy=y-origin.y,dz=z-origin.z;
        return [dx,dy,dz];
      });
    }
    function comb(root,tip,seed,start,end,drop,lift,width,depth,lit,flip=1){
      const points=Array.from({length:9},(_,j)=>{
        const u=j/8,bow=Math.sin(Math.PI*u),a=mix(root,tip,.20*u+.80*smooth(u))+.15*bow*flip;
        const t=mix(start,end,u),p=hairPoint(t,a,.003+lift*bow);
        const projection=.007*u**2,sweep=.009*flip*bow+(.015+.014*Math.sin(seed*1.79))*flip*u**2.7;
        return vec(p[0]+projection*Math.sin(a)+sweep,p[1]+lift*.48*bow-drop*u**3,p[2]+projection*Math.cos(a));
      });
      lock(points,width,depth,seed,lit);
    }
    // The long half of the side part crosses the brow in three overlapping
    // tiers. The short half follows the temple to a pointed sideburn.
    for(let j=0;j<12;j++){
      const f=j/11,a=-1.71+f*2.02+.06*Math.sin(j*2.14),wave=.5+.5*Math.sin(j*2.07);
      const drop=.042+.021*wave+.046*Math.exp(-(((a+.17)/.47)**2));
      comb(.59+.13*(1-f),a,2+j,.79-.05*wave,.012+.023*wave,drop,.024+.011*f,.035+.006*wave,.0125,1,-1);
    }
    for(let j=0;j<8;j++){
      const f=j/7,a=.51+f*1.63,wave=.5+.5*Math.cos(j*2.14);
      comb(.80+f*.35,a,23+j,.77-.13*f,.014+.05*wave,.038+.022*wave,.017,.030+.006*wave,.0115,.90);
    }
    for(let j=0;j<14;j++){
      const f=j/13,a=1.96+f*2.50,wave=.5+.5*Math.sin(j*2.32);
      comb(a-.36,a,41+j,.73,.11+.075*wave,.015+.026*wave,.009+.005*wave,.027,.009,.70);
    }
    for(let j=0;j<12;j++){
      const f=j/11,a=-1.63+f*1.96,wave=.5+.5*Math.cos(2.5*j);
      comb(.91+.06*Math.cos(f*4),a,60+j,.95,.18+.10*wave,.017+.013*wave,.027+.009*wave,.032,.0127,1,-1);
    }
    const loose=[
      [[.093,2.485,.080],[.068,2.535,.090],[.013,2.553,.075],[-.034,2.536,.076]],
      [[.076,2.492,.075],[.048,2.541,.076],[-.008,2.553,.050],[-.061,2.522,.057]],
      [[-.119,2.466,.102],[-.167,2.451,.112],[-.199,2.415,.105],[-.211,2.386,.107]],
      [[.138,2.451,.101],[.178,2.423,.092],[.204,2.380,.100],[.198,2.353,.110]]
    ];
    loose.forEach((p,i)=>lock(p.map(p=>vec(...p)),i<2?.019:.014,.007,79+i,.85));
    const geometries={};
    for(const [name,data] of Object.entries(sections)){
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(data.position,3));
      g.setAttribute('color',new T.Float32BufferAttribute(data.color,3));g.setIndex(data.index);
      g.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));
      g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();geometries[name]=g;
    }
    if(licensed)Object.assign(geometries,atelierPortrait(T));
    return geometries;
  }
  // Retarget the licensed sample in its original face space, before the
  // head and animated eyelid joints are placed on the owner's service rig.
  // The asymmetric hair is fitted to the brow and lateral parietal planes.
  function atelierPortrait(T){
    const faces=global.DinerGuestFaces,key='b',template=faces.source(key);
    const target=Object.fromEntries(['head','mouth','eyes-1','eyes1','iris-1','iris1'].map(n=>[n,faces.bucket()]));
    const skin=new T.Color('#DAAB91').convertSRGBToLinear(),temple=new T.Color('#C38A7F').convertSRGBToLinear();
    const shadow=new T.Color('#A18C87').convertSRGBToLinear(),brow=new T.Color('#4A3A41').convertSRGBToLinear();
    const amber=new T.Color('#F2CE98').convertSRGBToLinear(),white=new T.Color('#FFFFFF').convertSRGBToLinear(),paint=new T.Color();
    function mapped(x,y,z,kind){
      const ab=Math.abs(x),front=smooth((z+.012)/.057),lo=smooth((1.363-y)/.076);
      const depth=bell(ab,y,.041,1.37,.039,.031)*front;
      const h0=eyeY+(y-1.370)*(y<1.37?3.07+.17*lo:1.86);
      const h=eyeY+(h0-eyeY)*(1-.40*depth)+.008*(ab-.041)/.041*depth;
      const cheek=smooth((1.358-y)/.025)*(1-smooth((1.325-y)/.04));
      let X=x*(2.19+.49*lo+.075*cheek);
      let Y=h;
      const jawline=smooth((1.328-y)/.035);
      Y+=jawline*(.015*Math.exp(-(x*x/.00038))-.007*smooth((ab-.018)/.025));
      // Relax the open sample lips to a small smile at the corners.
      Y-=(y-1.3185)*1.84*bell(x,y,0,1.3185,.029,.008)*front;
      Y+=.005*bell(ab,y,.021,1.3184,.011,.007)*front;
      const cap=smooth((Y-2.34)/.172);
      X*=1-.12*cap;
      let Z=(z<0?1.46:2.08)*z+.013-.019*cap;
      Z+=front*(.009*bell(ab,y,0,1.341,.023,.026)+.009*bell(ab,y,0,1.300,.041,.030)
        +.006*bell(ab,y,.045,1.387,.030,.020)-.004*bell(ab,y,.060,1.326,.023,.024));
      if(kind==='brow'){
        // A lower, heavier medial brow breaks into a fine, raised tail.
        Y-=.012*front*(1-.52*ab/.087);
        Z+=.010*front;
      }
      if(kind==='lash'){
        X-=Math.sign(x)*.22*Math.max(0,ab-.056);
      }
      return [X,Y,Z];
    }
    for(const [kind,data] of Object.entries(template)){
      const skinPart=kind==='skin'||kind==='scalp',base=skinPart||kind==='brow'||kind==='mouth';
      for(const side of base?[0]:[-1,1]){
        const group=target[base?(kind==='mouth'?'mouth':'head'):((kind==='iris'||kind==='light')?'iris':'eyes')+side];
        const index=new Map();
        for(const v of data.i){
          const x=data.p[3*v]/16000;
          if(side&&Math.sign(x)!==side)continue;
          if(!index.has(v)){
            const y=data.p[3*v+1]/16000,z=data.p[3*v+2]/16000,pt=mapped(x,y,z,kind);
            index.set(v,group.p.length/3);group.p.push(...pt);
            // Transform normals by the local deformation's inverse transpose.
            const h=.0002,px=mapped(x+h,y,z,kind),py=mapped(x,y+h,z,kind),pz=mapped(x,y,z+h,kind);
            const A=px.map((q,j)=>q-pt[j]),B=py.map((q,j)=>q-pt[j]),C=pz.map((q,j)=>q-pt[j]);
            const nx=data.n[3*v],ny=data.n[3*v+1],nz=data.n[3*v+2],normal=new T.Vector3();
            normal.set(nx*(B[1]*C[2]-B[2]*C[1])+ny*(C[1]*A[2]-C[2]*A[1])+nz*(A[1]*B[2]-A[2]*B[1]),
              nx*(B[2]*C[0]-B[0]*C[2])+ny*(C[2]*A[0]-C[0]*A[2])+nz*(A[2]*B[0]-A[0]*B[2]),
              nx*(B[0]*C[1]-B[1]*C[0])+ny*(C[0]*A[1]-C[1]*A[0])+nz*(A[0]*B[1]-A[1]*B[0])).normalize();
            group.n.push(normal.x,normal.y,normal.z);
            paint.copy(skinPart?skin:kind==='brow'?brow:kind==='iris'?amber:white);
            if(skinPart&&z>.005){
              const beard=smooth((2.048+.074*(Math.abs(pt[0])/.20)**2-pt[1])/.075);
              paint.lerp(shadow,.32*beard);
              paint.lerp(temple,.22*bell(Math.abs(pt[0]),pt[1],.124,2.206,.062,.039));
            }
            group.c.push(paint.r,paint.g,paint.b);
            let u=data.uv[v*2]/30000,vv=data.uv[v*2+1]/30000;
            if(global.DinerPortraitMesh.b.ownerPaint){
              if(kind==='skin')u+=.5;
              if(kind==='line'){u+=.375;vv+=.125;}
              if(kind==='brow'){u+=.875;vv+=.25;}
            }
            group.uv.push(u,vv);
            for(const morph of ['blink','talk']){
              const d=data[morph];
              if(!d){group[morph].push(0,0,0);continue;}
              const mt=mapped(x+d[v*3]/32000,y+d[v*3+1]/32000,z+d[v*3+2]/32000,kind);
              group[morph].push(mt[0]-pt[0],mt[1]-pt[1],mt[2]-pt[2]);
            }
          }
          group.i.push(index.get(v));
        }
      }
    }
    return Object.fromEntries(Object.entries(target).map(([name,part])=>[name,faces.mesh(part,T,key)]));
  }
  const finishes=new WeakMap(),surfaces=new Map();
  function paintedSurface(T,key){
    if(surfaces.has(key))return surfaces.get(key);
    const cv=document.createElement('canvas');cv.width=key==='face'?640:384;cv.height=key==='face'?768:512;
    const ctx=cv.getContext('2d'),W=cv.width,H=cv.height;
    const grid=ctx.createImageData(W,H),pix=grid.data;
    let rng=39;
    const random=()=>(rng=(1664525*rng+1013904223)>>>0)/4294967296;
    for(let y=0,i=0;y<H;y++)for(let x=0;x<W;x++,i+=4){
      const u=x/W,v=y/H,g=random()-.5;let r,b,k;
      if(key==='hair'){
        const flow=u+.014*Math.sin(5*v+u*3)+.024*v*v;
        const streak=(.5+.5*Math.cos(tau*(24*flow+.15*Math.sin(54*flow))))**7;
        const groove=(.5+.5*Math.cos(tau*69*flow+2*Math.sin(27*flow)))**6;
        const reflection=Math.exp(-(((v-.39-.05*Math.sin(6.6*u))/.090)**2));
        k=230-19*groove-15*(1-reflection)+12*streak+18*reflection;
        r=k+2.3*g;b=k+3+2*g;
      }else if(key==='cloth'){
        const warp=Math.cos(tau*(u*83+.10*Math.cos(tau*67*v)));
        const weft=Math.cos(tau*(v*72+.07*Math.sin(tau*83*u)));
        const rib=Math.cos(tau*(89*u+44*v));
        k=242+3.5*warp+2.3*weft+2.1*rib+2.7*g;r=k+1;b=k-.7;
      }else{r=251+1.6*g;k=250+1.6*g;b=249+1.6*g;}
      pix[i]=r;pix[i+1]=k;pix[i+2]=b;pix[i+3]=255;
    }
    ctx.putImageData(grid,0,0);
    if(key==='face'){
      const X=x=>(.5+x/.43)*W,Y=y=>(1-(y-1.96)/.575)*H;
      function wash(x,y,w,h,color,opacity){
        ctx.save();ctx.translate(X(x),Y(y));ctx.scale(w*W/.43,h*H/.575);
        const g=ctx.createRadialGradient(0,0,0,0,0,1);
        g.addColorStop(0,color);g.addColorStop(.52,color+'8c');g.addColorStop(1,color+'00');
        ctx.fillStyle=g;ctx.globalAlpha=opacity;ctx.fillRect(-1,-1,2,2);ctx.restore();
      }
      for(const side of [-1,1]){
        wash(side*.122,2.205,.077,.046,'#EDAB9C',.35);
        wash(side*.085,2.266,.066,.027,'#B597AC',.46);
        wash(side*.098,2.232,.044,.016,'#D0B0BC',.32);
        wash(side*.160,2.128,.041,.095,'#BDAEB9',.32);
        wash(side*.034,2.172,.012,.032,'#DCB1AA',.31);
        for(let n=0;n<37;n++){
          const x=side*(.098+.059*random()),y=2.199+.021*random();
          ctx.strokeStyle='rgba(168,83,83,.15)';ctx.lineWidth=.58+.70*random();
          ctx.beginPath();ctx.moveTo(X(x),Y(y));ctx.lineTo(X(x+side*.003),Y(y+.0037));ctx.stroke();
        }
        for(let n=0;n<16;n++){
          const x=side*(.109+.050*random()),y=2.192+.029*random();
          wash(x,y,.0008+.0006*random(),.0013,'#945C54',.57);
        }
      }
      wash(-.003,2.172,.025,.020,'#EDB3AC',.55);
      wash(0,2.094,.065,.024,'#DDA9AE',.31);
      wash(-.079,2.167,.0027,.0029,'#70504B',.9);
      wash(0,2.061,.045,.021,'#C8B9C9',.26);
    }
    ctx.fillStyle='white';ctx.fillRect(0,0,5,5);
    const texture=new T.CanvasTexture(cv);
    texture.encoding=T.sRGBEncoding;texture.anisotropy=4;texture.name='luchuan-'+key;
    surfaces.set(key,texture);return texture;
  }
  function material(g,base,T,name){
    if(g.userData.portraitKey)return global.DinerGuestFaces.material(g,base);
    if(!global.document)return base;
    const fabric=name==='body'||/^arm|^thigh|^shin/.test(name);
    const key=name==='head'?'face':name==='hair'?'hair':fabric?'cloth':null;
    if(!key)return base;
    if(!finishes.has(g)){
      if(fabric){
        const pos=g.attributes.position,col=g.attributes.color,uv=new Float32Array(2*pos.count);
        for(let i=0;i<pos.count;i++){
          const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
          const neckline=name==='body'&&y>1.79&&Math.abs(x)<.118&&col.getX(i)>1.45*col.getY(i);
          uv[2*i]=neckline?.005:clamp(.50+x*.88+z*.38);
          uv[2*i+1]=neckline?.995:clamp(.035+(y-.12)*.49);
        }
        g.setAttribute('uv',new T.BufferAttribute(uv,2));
      }
      const mat=base.clone();mat.map=paintedSurface(T,key);mat.roughness=key==='hair'?.55:.83;
      finishes.set(g,mat);
    }
    return finishes.get(g);
  }
  global.DinerOwnerHead=Object.freeze({create,material,eyeY,mouthY});
})(window);
