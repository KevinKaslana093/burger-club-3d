/* CPU triangle renderer for devices where WebGL is unavailable. Reuses the
   same camera, meshes, depth, vertex colours and canvas decals as the GPU. */
(function (global) {
  'use strict';
  const T = global.THREE, stride = 10;
  const gamma = new Uint8Array(4097);
  for (let i=0;i<gamma.length;i++) {
    const c=i/4096;
    gamma[i]=Math.round(255*(c<=.0031308 ? 12.92*c : 1.055*Math.pow(c,1/2.4)-.055));
  }
  const encode = (x) => gamma[Math.max(0,Math.min(4096,(x*4096+.5)|0))];
  const pack = (r,g,b) => (255<<24) | ((b|0)<<16) | ((g|0)<<8) | (r|0);
  const bg = new T.Color(0xa4dcdf).convertSRGBToLinear();
  const normalized = (x,y,z) => new T.Vector3(x,y,z).normalize();
  const keyLight=normalized(-3.4,6.35,4), fillLight=normalized(4,5,-1.6);

  class DinerCanvasRenderer {
    constructor() {
      this.domElement=document.createElement('canvas');
      this.ctx=this.domElement.getContext('2d',{alpha:false,willReadFrequently:false});
      if(!this.ctx)throw Error('Canvas 2D unavailable');
      this.shadowMap={enabled:false};
      this.capabilities={isWebGL2:false,getMaxAnisotropy:()=>1};
      this.cache=new WeakMap();this.textures=new WeakMap();
      this.projection=new T.Matrix4();this.localProjection=new T.Matrix4();
      this.normal=new T.Matrix3();
      this.sortPoint=new T.Vector3();
      this.frustum=new T.Frustum();
      this.clearColor=bg.clone();this.ratio=1;
    }
    setClearColor(value){this.clearColor.set(value);}
    setPixelRatio(ratio){this.ratio=Math.max(.5,Math.min(1.35,ratio||1));}
    setSize(w,h,style=true){
      const scale=Math.min(this.ratio,1120/Math.max(1,w),740/Math.max(1,h));
      const width=Math.max(1,Math.round(w*scale)),height=Math.max(1,Math.round(h*scale));
      if(!this.image||this.width!==width||this.height!==height){
        this.width=width;this.height=height;
        this.domElement.width=width;this.domElement.height=height;
        this.image=this.ctx.createImageData(width,height);
        this.pixels=new Uint32Array(this.image.data.buffer);
        this.depth=new Float32Array(width*height);
      }
      if(style){this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';}
    }
    texture(map){
      if(!map||!map.image)return null;
      const prior=this.textures.get(map);
      if(prior&&prior.version===map.version)return prior;
      let cv=map.image;
      if(!cv.getContext&&cv.width&&cv.height){
        const img=cv;cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
        cv.getContext('2d').drawImage(img,0,0);
      }
      const context=cv.getContext&&cv.getContext('2d');
      if(!context||!cv.width||!cv.height)return null;
      try{
        const tex={version:map.version,w:cv.width,h:cv.height,flipY:map.flipY,data:context.getImageData(0,0,cv.width,cv.height).data};
        // A tiny order ticket can occupy just a handful of pixels across the aisle.
        // Reuse filtered levels across triangles to keep printed lettering and hair stable in motion.
        tex.levels=[tex];let source=cv;
        while(source.width>3||source.height>3){
          const reduced=document.createElement('canvas');reduced.width=Math.max(1,source.width>>1);reduced.height=Math.max(1,source.height>>1);
          const ctx=reduced.getContext('2d');ctx.drawImage(source,0,0,reduced.width,reduced.height);
          tex.levels.push({w:reduced.width,h:reduced.height,flipY:map.flipY,data:ctx.getImageData(0,0,reduced.width,reduced.height).data});source=reduced;
        }
        this.textures.set(map,tex);return tex;
      }catch(e){return null;}
    }
    transform(mesh,mat){
      const geometry=mesh.geometry, p=geometry.attributes.position;
      const matrix=this.localProjection.multiplyMatrices(this.projection,mesh.matrixWorld);
      let cache=this.cache.get(mesh);
      if(!cache||cache.geometry!==geometry){
        cache={geometry,matrix:new T.Matrix4(),vertex:new Float32Array((p.count+6)*stride)};
        this.cache.set(mesh,cache);
      }
      const color=mat.color, colorKey=color?color.getHex():0xffffff;
      if(cache.light===this.light&&cache.width===this.width&&cache.height===this.height&&cache.matrix.equals(matrix)&&cache.color===colorKey&&cache.version===p.version&&cache.paintVersion===(geometry.attributes.color?.version||0))return cache.vertex;
      cache.matrix.copy(matrix);cache.width=this.width;cache.height=this.height;
      cache.light=this.light;cache.color=colorKey;cache.version=p.version;cache.paintVersion=geometry.attributes.color?.version||0;
      const normal=this.normal.getNormalMatrix(mesh.matrixWorld).elements;
      const mv=matrix.elements, ap=p.array;
      const an=geometry.attributes.normal&&geometry.attributes.normal.array;
      const ac=mat.vertexColors&&geometry.attributes.color&&geometry.attributes.color.array;
      const uv=geometry.attributes.uv&&geometry.attributes.uv.array;
      const out=cache.vertex, rw=this.width*.5,rh=this.height*.5;
      const cr=color?color.r:1,cg=color?color.g:1,cb=color?color.b:1,lit=!mat.isMeshBasicMaterial&&an;
      const light=this.light||[1,1,1];
      for(let i=0,j=0,k=0;i<p.count;i++,j+=3,k+=stride){
        let x=ap[j],y=ap[j+1],z=ap[j+2];
        const cx=mv[0]*x+mv[4]*y+mv[8]*z+mv[12],cy=mv[1]*x+mv[5]*y+mv[9]*z+mv[13],w=mv[3]*x+mv[7]*y+mv[11]*z+mv[15];
        out[k]=cx;out[k+1]=cy;out[k+2]=w;
        out[k+3]=rw*(1+cx/w);out[k+4]=rh*(1-cy/w);
        let r=cr,g=cg,b=cb;
        if(ac){r*=ac[j];g*=ac[j+1];b*=ac[j+2];}
        if(lit){
          x=an[j];y=an[j+1];z=an[j+2];
          const nx=normal[0]*x+normal[3]*y+normal[6]*z,ny=normal[1]*x+normal[4]*y+normal[7]*z,nz=normal[2]*x+normal[5]*y+normal[8]*z;
          const inv=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);
          const sun=Math.max(0,(nx*keyLight.x+ny*keyLight.y+nz*keyLight.z)*inv);
          const fill=Math.max(0,(nx*fillLight.x+ny*fillLight.y+nz*fillLight.z)*inv);
          const sky=.45+.13*(1+ny*inv);
          r*=(sky+.50*sun+.14*fill)*light[0];g*=(sky+.46*sun+.11*fill)*light[1];b*=(sky+.40*sun+.09*fill)*light[2];
        }
        out[k+5]=encode(r);out[k+6]=encode(g);out[k+7]=encode(b);
        if(uv){out[k+8]=uv[i*2];out[k+9]=uv[i*2+1];}
      }
      return out;
    }
    // Clip crossing triangles in homogeneous coordinates, avoiding holes in
    // large walls or counters when an edge passes behind the camera.
    clip(vertex,a,b,c,free,mat,tex,near){
      const input=[a,b,c], polygon=[];
      let last=c, lastIn=vertex[c+2]>=near;
      for (const current of input) {
        const inView=vertex[current+2]>=near;
        if(inView!==lastIn) {
          const t=(near-vertex[last+2])/(vertex[current+2]-vertex[last+2]);
          const k=free;free+=stride;
          for(let j=0;j<stride;j++)vertex[k+j]=vertex[last+j]+t*(vertex[current+j]-vertex[last+j]);
          vertex[k+2]=near;vertex[k+3]=this.width*.5*(1+vertex[k]/near);
          vertex[k+4]=this.height*.5*(1-vertex[k+1]/near);
          polygon.push(k);
        }
        if(inView)polygon.push(current);
        last=current;lastIn=inView;
      }
      for(let i=1;i+1<polygon.length;i++)this.triangle(vertex,polygon[0],polygon[i],polygon[i+1],mat,tex);
    }
    triangle(v,a,b,c,mat,tex){
      const ax=v[a+3],ay=v[a+4],bx=v[b+3],by=v[b+4],cx=v[c+3],cy=v[c+4];
      const abx=bx-ax,aby=by-ay,acx=cx-ax,acy=cy-ay,area=abx*acy-aby*acx;
      if(Math.abs(area)<.008)return;
      if((mat.side===T.FrontSide&&area>0)||(mat.side===T.BackSide&&area<0))return;
      const xmin=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),xmax=Math.min(this.width-1,Math.floor(Math.max(ax,bx,cx)-.5));
      const ymin=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),ymax=Math.min(this.height-1,Math.floor(Math.max(ay,by,cy)-.5));
      if(xmin>xmax||ymin>ymax)return;
      const coeff=1/area,incBx=acy*coeff,incBy=-acx*coeff,incCx=-aby*coeff,incCy=abx*coeff;
      const px=xmin+.5-ax,py=ymin+.5-ay;
      let baseB=(px*acy-py*acx)*coeff,baseC=(py*abx-px*aby)*coeff;
      const ia=1/v[a+2],ib=1/v[b+2],ic=1/v[c+2],db=ib-ia,dc=ic-ia;
      const ar=v[a+5],ag=v[a+6],ab=v[a+7],rb=v[b+5]-ar,rc=v[c+5]-ar,gb=v[b+6]-ag,gc=v[c+6]-ag,bb=v[b+7]-ab,bc=v[c+7]-ab;
      const ua=v[a+8]*ia,ub=v[b+8]*ib-ua,uc=v[c+8]*ic-ua,va=v[a+9]*ia,vb=v[b+9]*ib-va,vc=v[c+9]*ic-va;
      const depth=this.depth,pixels=this.pixels,w=this.width,write=mat.depthWrite!==false,opacity=mat.opacity;
      if(tex?.levels?.length>1){
        const duB=(v[b+8]-v[a+8])*tex.w,duC=(v[c+8]-v[a+8])*tex.w,dvB=(v[b+9]-v[a+9])*tex.h,dvC=(v[c+9]-v[a+9])*tex.h;
        const dx=Math.max(Math.abs(duB*incBx+duC*incCx),Math.abs(dvB*incBx+dvC*incCx));
        const dy=Math.max(Math.abs(duB*incBy+duC*incCy),Math.abs(dvB*incBy+dvC*incCy));
        const footprint=Math.max(1,Math.min((dx+dy)*.5,1.8*Math.min(dx,dy)+.75));
        if(footprint>=2)tex=tex.levels[Math.min(tex.levels.length-1,Math.floor(Math.log2(footprint)))];
      }
      const solid=!tex&&opacity===1&&rb===0&&rc===0&&gb===0&&gc===0&&bb===0&&bc===0;
      const flat=pack(ar,ag,ab);
      for(let y=ymin;y<=ymax;y++,baseB+=incBy,baseC+=incCy) {
        let wb=baseB,wc=baseC;
        for(let x=xmin,k=y*w+xmin;x<=xmax;x++,k++,wb+=incBx,wc+=incCx){
          if(wb<-.000001||wc<-.000001||wb+wc>1.000001)continue;
          const z=ia+db*wb+dc*wc;
          if(z<depth[k]-.0000001)continue;
          if(solid){pixels[k]=flat;if(write)depth[k]=z;continue;}
          let r=ar+rb*wb+rc*wc,g=ag+gb*wb+gc*wc,bcol=ab+bb*wb+bc*wc,alpha=opacity;
          if(tex){
            const u=(ua+ub*wb+uc*wc)/z, vv=(va+vb*wb+vc*wc)/z;
            const tx=Math.max(0,Math.min(tex.w-1,Math.floor(u*tex.w))),ty=Math.max(0,Math.min(tex.h-1,Math.floor((tex.flipY?1-vv:vv)*tex.h)));
            const ti=(ty*tex.w+tx)*4,td=tex.data;
            alpha*=td[ti+3]/255;
            if(alpha<Math.max(.005,mat.alphaTest||0))continue;
            r*=td[ti]/255;g*=td[ti+1]/255;bcol*=td[ti+2]/255;
          }
          if(alpha<1){
            const prev=pixels[k],inv=1-alpha;
            r=r*alpha+(prev&255)*inv;g=g*alpha+((prev>>8)&255)*inv;bcol=bcol*alpha+((prev>>16)&255)*inv;
          }
          pixels[k]=pack(r,g,bcol);if(write)depth[k]=z;
        }
      }
    }
    render(scene,camera){
      if(!this.image)this.setSize(this.domElement.width||300,this.domElement.height||150,false);
      this.light=scene.userData.canvasLight;
      scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
      this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.projection);
      const background=scene.background&&scene.background.isColor?scene.background:this.clearColor;
      this.pixels.fill(pack(encode(background.r),encode(background.g),encode(background.b)));
      this.depth.fill(0);
      const opaque=[],alpha=[];
      scene.traverseVisible(mesh=>{
        if(!mesh.isMesh||!mesh.geometry.attributes.position||!mesh.material.visible)return;
        if(mesh.frustumCulled&&!this.frustum.intersectsObject(mesh))return;
        this.sortPoint.setFromMatrixPosition(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
        const entry={mesh,d:-this.sortPoint.z};
        (mesh.material.transparent?alpha:opaque).push(entry);
      });
      opaque.sort((a,b)=>a.d-b.d);alpha.sort((a,b)=>a.mesh.renderOrder-b.mesh.renderOrder||b.d-a.d);
      for(const {mesh} of opaque.concat(alpha)){
        const geo=mesh.geometry,mat=mesh.material,tex=this.texture(mat.map),v=this.transform(mesh,mat);
        const index=geo.index&&geo.index.array,count=index?index.length:geo.attributes.position.count;
        const end=Math.min(count,geo.drawRange.start+geo.drawRange.count),free=geo.attributes.position.count*stride;
        for(let i=geo.drawRange.start;i+2<end;i+=3){
          const a=(index?index[i]:i)*stride,b=(index?index[i+1]:i+1)*stride,c=(index?index[i+2]:i+2)*stride;
          if(v[a+2]<camera.near||v[b+2]<camera.near||v[c+2]<camera.near){
            if(v[a+2]>=camera.near||v[b+2]>=camera.near||v[c+2]>=camera.near)this.clip(v,a,b,c,free,mat,tex,camera.near);
            continue;
          }
          if(v[a+2]>camera.far&&v[b+2]>camera.far&&v[c+2]>camera.far)continue;
          this.triangle(v,a,b,c,mat,tex);
        }
      }
      this.ctx.putImageData(this.image,0,0);
    }
    dispose(){this.cache=new WeakMap();this.textures=new WeakMap();this.depth=null;this.pixels=null;this.image=null;}
  }
  global.DinerCanvasRenderer=DinerCanvasRenderer;
})(window);
