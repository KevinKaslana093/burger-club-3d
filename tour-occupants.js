(() => {
  'use strict';
  function create(T,rig,requestDraw){
    const root=new T.Group();root.name='Service in progress';rig.scene.add(root);
    const tables=new Map(),owned=new Map(),point=new T.Vector3();
    const combined=new T.Matrix4(),frustum=new T.Frustum();
    const diningOpenings=[
      new T.Box3(new T.Vector3(-5.13,0,4.37),new T.Vector3(-3.80,2.39,4.74)),
      new T.Box3(new T.Vector3(-1.52,1.25,4.34),new T.Vector3(4.64,3.11,4.74))
    ];
    let read=null,timer=0,period='noon';
    // Nodes have independent transforms. Geometry, material and painted textures stay with their original owners.
    function copy(source,links,variants){
      if(!source.visible)return null;
      if(source.userData.detailSources){
        for(const [mesh,high,low] of source.userData.detailSources())variants.set(mesh,[high,low]);
      }
      const pair=variants.get(source),node=source.isMesh?new T.Mesh(pair?.[0]||source.geometry,source.material):new T.Group();
      node.name=source.name;node.position.copy(source.position);node.quaternion.copy(source.quaternion);node.scale.copy(source.scale);
      if(node.isMesh){node.castShadow=source.castShadow;node.receiveShadow=source.receiveShadow;node.renderOrder=source.renderOrder;if(pair&&pair[0]!==pair[1])links.push([node,...pair]);}
      for(const child of source.children){const sub=copy(child,links,variants);if(sub)node.add(sub);}
      return node;
    }
    function actorFor(d){
      if(!d.seat)return d.actor;
      let a=owned.get(d.table);if(!a){
        a=window.DinerGuests?window.DinerGuests.customer(d.customer,window.DinerModels):window.DinerModels.customer(d.customer);
        owned.set(d.table,a);
      }
      a.position.set(d.seat.x,0,d.seat.z);a.rotation.y=d.seat.yaw;a.userData.setVisitPose?.('sit',0,1);
      return a;
    }
    function refresh(){
      if(!read)return;
      const rows=read(),present=new Set();let pending=false,changed=false;
      for(const d of rows){
        present.add(d.table);const actor=actorFor(d);
        const signature=[d.customer,actor?.uuid,actor?.userData.revision,d.tray?.uuid,d.food,d.bite,...(d.extras||[]).map(o=>o.uuid)].join('/');
        const old=tables.get(d.table);pending ||= Boolean(d.pending);
        if(old?.signature===signature)continue;
        if(old)root.remove(old.group);
        const group=new T.Group(),links=[],variants=new Map();group.name=d.waiting?'Waiting at entrance':'Occupied booth '+d.table;
        group.userData={table:d.table,customer:d.customer,bite:d.bite??null,stack:d.stack,stackOffsets:d.stackOffsets,current:Boolean(d.current),waiting:Boolean(d.waiting)};
        for(const source of [actor,d.tray,...(d.extras||[])]){
          if(!source)continue;const node=copy(source,links,variants);if(node)group.add(node);
        }
        root.add(group);group.updateMatrixWorld(true);
        const box=new T.Box3().setFromObject(group);box.expandByScalar(.04);
        tables.set(d.table,{group,links,signature,box,low:false});changed=true;
      }
      for(const [id,v] of tables)if(!present.has(id)){root.remove(v.group);tables.delete(id);changed=true;}
      if(changed){rig.renderer.shadowMap.needsUpdate=true;requestDraw();}
      clearTimeout(timer);if(pending)timer=setTimeout(refresh,140);
    }
    function close(){
      read=null;clearTimeout(timer);root.clear();tables.clear();
      for(const actor of owned.values())actor.userData.dispose?.();owned.clear();
      for(const part of Object.values(rig.building.rooms||{}))part.group.visible=true;
    }
    function open(parts){close();read=parts.visitors;period=parts.period||'noon';lighting();refresh();}
    function lighting(){
      const late=period==='evening',gold=period==='afternoon',l=rig.lights;
      l.hemi.color.setHex(late?0xc6cfe7:gold?0xffebd2:0xfff4de);l.hemi.groundColor.setHex(late?0x977a70:0xadada4);l.hemi.intensity=late?.51:.67;
      l.key.color.setHex(late?0xf3b387:gold?0xffc78d:0xffe4bc);l.key.intensity=late?.35:gold?.65:.77;
      l.fill.color.setHex(late?0xb7c8eb:0xc0e0e5);l.fill.intensity=late?.27:.20;
      rig.scene.background.setHex(late?0x8e8293:gold?0xc8bbbb:0xcbdcdf);
      rig.scene.fog.color.setHex(late?0x96818a:gold?0xe0cbb0:0xe3e7da);
      rig.scene.userData.canvasLight=late?[.75,.64,.70]:gold?[1,.92,.84]:[1,1,1];
      rig.period=period;
    }
    function view(camera,height,walking,moving){
      camera.updateMatrixWorld();combined.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(combined);
      const z=camera.position.z,indoors=walking&&z> -4.07&&Math.abs(camera.position.x)<6.07;
      const crosses=!indoors||diningOpenings.some(box=>frustum.intersectsBox(box));
      const rooms=rig.building.rooms||{};
      for(const [name,room] of Object.entries(rooms)){
        const through=name==='kitchen'?z>=4.45||crosses:name==='hall'?z<=4.66||crosses:true;
        room.group.visible=through&&frustum.intersectsBox(room.box);
      }
      for(const v of tables.values()){
        v.group.visible=(!indoors||z<4.70||crosses)&&frustum.intersectsBox(v.box);
        if(!v.group.visible)continue;
        v.box.getCenter(point);const distance=camera.position.distanceTo(point);
        const pixels=2.45*height/(2*Math.tan(camera.fov*Math.PI/360)*Math.max(1,distance));
        const threshold=rig.gpu?174:moving?335:222;
        const far=distance>2.80&&pixels<threshold*(v.low?1.13:1);
        if(far===v.low)continue;v.low=far;
        for(const [mesh,high,low] of v.links)mesh.geometry=far?low:high;
      }
    }
    window.addEventListener('diner-model-ready',refresh);
    return {open,close,view};
  }
  window.DinerTourOccupants={create};
})();
