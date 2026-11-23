"""Bake the seated-at-counter standing pose and optimize two licensed glTF/VRM guests for WebGL."""
from pathlib import Path
from io import BytesIO
from copy import deepcopy
import struct, json, sys
import numpy as np
from scipy.spatial.transform import Rotation as R
from PIL import Image
from mia_fabric import refine_panel, fit_seams, textile
from mia_portrait import paint_portrait

root=Path(__file__).resolve().parent
out=root/'burger'/'dist'/'guests'
out.mkdir(exist_ok=True)
dtypes={5126:'<f4',5125:'<u4',5123:'<u2',5121:'|u1',5122:'<i2',5120:'|i1'}
ncomp={'MAT4':16,'VEC2':2,'VEC3':3,'VEC4':4,'SCALAR':1}

def bake(key):
    raw=(root/('avatar-'+key+'.vrm')).read_bytes()
    jlen=struct.unpack_from('<I',raw,12)[0]
    src=json.loads(raw[20:20+jlen]);binary=raw[28+jlen:]
    ext=src['extensions'].get('VRMC_vrm') or src['extensions']['VRM']
    print(key,ext['meta'].get('name',ext['meta'].get('title')),flush=True)
    def access(idx):
        a=src['accessors'][idx]
        dt=np.dtype(dtypes[a['componentType']]);m=ncomp[a['type']]
        if 'bufferView' in a:
            v=src['bufferViews'][a['bufferView']]
            stride=v.get('byteStride',dt.itemsize*m)
            arr=np.ndarray((a['count'],m),dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(stride,dt.itemsize))
        else:arr=np.zeros((a['count'],m),dtype=dt)
        if 'sparse'in a:
            sp=a['sparse'];ii=sp['indices'];vv=sp['values'];count=sp['count']
            def off(x):return src['bufferViews'][x['bufferView']].get('byteOffset',0)+x.get('byteOffset',0)
            ix=np.frombuffer(binary,dtype=dtypes[ii['componentType']],offset=off(ii),count=count)
            val=np.frombuffer(binary,dtype=dt,offset=off(vv),count=count*m).reshape(count,m)
            arr=arr.copy();arr[ix]=val
        return arr
    ns=src['nodes'];parents={c:i for i,node in enumerate(ns) for c in node.get('children',[])}
    loc=[]
    for n in ns:
        if 'matrix'in n:mat=np.array(n['matrix'],dtype=float).reshape(4,4).T
        else:
            mat=np.eye(4);mat[:3,:3]=R.from_quat(n.get('rotation',[0,0,0,1])).as_matrix()@np.diag(n.get('scale',[1,1,1]));mat[:3,3]=n.get('translation',[0,0,0])
        loc.append(mat)
    def make_world():
        world={}
        def get(i):
            if i not in world:world[i]=get(parents[i])@loc[i] if i in parents else loc[i].copy()
            return world[i]
        for i in range(len(ns)):get(i)
        return world
    world=make_world()
    human=ext['humanoid']['humanBones']
    bones={k:v['node'] for k,v in human.items()} if isinstance(human,dict) else {v['bone']:v['node']for v in human}
    facing=1 if 'VRMC_vrm' in src['extensions'] else -1
    for side in ('left','right'):
        arm=bones[side+'UpperArm'];fore=bones[side+'LowerArm'];hand=bones[side+'Hand']
        world=make_world();v=world[fore][:3,3]-world[arm][:3,3];sx=1 if v[0]>0 else -1
        def rotate_world(i,delta):
            par=world[parents[i]][:3,:3] if i in parents else np.eye(3)
            loc[i][:3,:3]=np.linalg.inv(par)@delta@par@loc[i][:3,:3]
        rotate_world(arm,R.from_euler('z',-sx*66,degrees=True).as_matrix())
        world=make_world();rotate_world(fore,R.from_euler('x',-facing*(12 if side=='right' else 18),degrees=True).as_matrix())
        # VRM 1.0 can skin a sleeve to a separate shoulder helper that aims
        # at the elbow. Bake that constraint before discarding the skeleton.
        for helper,node in enumerate(ns):
            constraint=node.get('extensions',{}).get('VRMC_node_constraint',{}).get('constraint',{}).get('aim',{})
            if constraint.get('source')!=fore:continue
            world=make_world()
            axis=constraint['aimAxis']
            direction=world[helper][:3,'XYZ'.index(axis[-1])].copy()
            if axis.startswith('Negative'):direction*=-1
            target=world[fore][:3,3]-world[helper][:3,3]
            direction/=np.linalg.norm(direction);target/=np.linalg.norm(target)
            delta,_=R.align_vectors(target[None,:],direction[None,:])
            rotate_world(helper,R.from_rotvec(delta.as_rotvec()*constraint.get('weight',1)).as_matrix())
    world=make_world()
    rest_world=world
    rest_loc=[m.copy() for m in loc]
    def body_pose(name):
        nonlocal world, loc
        loc=[m.copy() for m in rest_loc]
        def swing(bone, degrees):
            nonlocal world
            if bone not in bones:return
            world=make_world()
            rotate_world(bones[bone],R.from_euler('x',degrees*facing,degrees=True).as_matrix())
        # The half-sit draws the feet under the seat before the knees cross the
        # booth's front edge. Shoes remain grounded in the runtime blend.
        for side,sign in [('right',1),('left',-1)]:
            if name in ('seated','mealReach','mealBite','sitHalf'):
                swing(side+'UpperLeg',-30 if name=='sitHalf' else -84)
                swing(side+'LowerLeg',85 if name=='sitHalf' else 134)
                swing(side+'Foot',-50 if name=='sitHalf' else -46)
                swing(side+'UpperArm',-14)
                swing(side+'LowerArm',-32)
            else:
                forward=sign if name=='walkRight' else -sign
                thigh=-23*forward
                knee=11 if forward>0 else 28
                swing(side+'UpperLeg',thigh)
                swing(side+'LowerLeg',knee)
                swing(side+'Foot',-(thigh+knee)*.68)
                swing(side+'UpperArm',13*forward)
                swing(side+'LowerArm',-5 if forward<0 else -2)
        if name in ('seated','mealReach','mealBite','sitHalf'):
            head=rest_world[bones['head']][:3,3]
            for side in ('left','right'):
                upper=bones[side+'UpperArm'];lower=bones[side+'LowerArm'];hand=bones[side+'Hand']
                finger=bones.get(side+'MiddleProximal',bones[side+'IndexProximal'])
                world=make_world();shoulder=world[upper][:3,3]
                u=world[lower][:3,3]-shoulder;v=world[hand][:3,3]-world[lower][:3,3]
                sign=np.sign(shoulder[0]);bite=name=='mealBite'
                destination=np.array([sign*(.162 if bite else .175),head[1]-(.120 if bite else .175),facing*(.175 if bite else .307)])
                resting=name in ('seated','sitHalf')
                on_table=side==('right' if key=='a' else 'left')
                if resting:
                    # Calibrated against the standing-height normalization and
                    # the seated shoe floor in hero.js (2.69 scene units tall).
                    scale,sole=(1.66520,.46487) if key=='a' else (1.70217,.44845)
                    if on_table:
                        x,y,z=(.309,1.094,.344) if key=='a' else (.298,1.151,.23)
                    else:
                        x,y,z=(.202,.828 if key=='a' else .932,.083)
                    if name=='sitHalf':
                        x,y,z=(.255,1.091,.168) if on_table else (.194,.891 if key=='a' else .957,.046)
                    destination=np.array([sign*x/scale,sole+y/scale,facing*(z+.025)/scale])
                ray=destination-shoulder;dist=np.linalg.norm(ray);ray/=dist
                l1=np.linalg.norm(u);l2=np.linalg.norm(v)
                dist=min(dist,l1+l2-.003);along=(dist*dist+l1*l1-l2*l2)/(2*dist)
                if resting:
                    pole=np.array([sign*.19,-.74,-.85*facing]) if on_table else np.array([sign*.56,-.94,-.13*facing])
                    if key=='b':
                        pole=np.array([sign*.40,-.42,-.90*facing]) if on_table else np.array([sign*.50,-.92,.32*facing])
                else:pole=np.array([sign*.9,-.24,-.68*facing])
                pole-=ray*np.dot(pole,ray);pole/=np.linalg.norm(pole)
                elbow=shoulder+ray*along+pole*np.sqrt(max(0,l1*l1-along*along))
                def aim(joint,actual,wanted):
                    nonlocal world
                    r,_=R.align_vectors((wanted/np.linalg.norm(wanted))[None,:],(actual/np.linalg.norm(actual))[None,:])
                    rotate_world(joint,r.as_matrix());world=make_world()
                aim(upper,u,elbow-shoulder)
                aim(lower,world[hand][:3,3]-world[lower][:3,3],shoulder+ray*dist-world[lower][:3,3])
                if resting:
                    # Align both axes of the hand, so its palm lies over the
                    # laminate or lap rather than pinching an invisible handle.
                    axis=np.array([sign*.33,-.112,facing*.94]) if on_table else np.array([-sign*.53,-.125,facing*.78])
                    if key=='b' and on_table:
                        axis=np.array([sign*.26,-.56,facing*.92])
                    index=world[bones[side+'IndexProximal']][:3,3]
                    little=world[bones[side+'LittleProximal']][:3,3]
                    def basis(a,b):
                        a=a/np.linalg.norm(a);b=b-a*np.dot(a,b);b=b/np.linalg.norm(b)
                        return np.column_stack((a,b,np.cross(a,b)))
                    current=basis(world[finger][:3,3]-world[hand][:3,3],index-little)
                    wanted=basis(axis,np.array([-sign,-.035,0]))
                    rotate_world(hand,wanted@current.T);world=make_world()
                else:
                    aim(hand,world[finger][:3,3]-world[hand][:3,3],np.array([-sign*.29,.63 if bite else .22,facing*.69]))
                # Re-aim the separate VRM sleeve helper when it tracks this elbow.
                for helper,node in enumerate(ns):
                    constraint=node.get('extensions',{}).get('VRMC_node_constraint',{}).get('constraint',{}).get('aim',{})
                    if constraint.get('source')!=lower:continue
                    axis=constraint['aimAxis'];direction=world[helper][:3,'XYZ'.index(axis[-1])].copy()
                    if axis.startswith('Negative'):direction*=-1
                    aim(helper,direction,world[lower][:3,3]-world[helper][:3,3])
        posed=make_world()
        loc=[m.copy() for m in rest_loc];world=rest_world
        return posed
    poses={name:body_pose(name) for name in ('walkRight','walkLeft','seated','mealReach','mealBite','sitHalf')}
    outj={'asset':{'version':'2.0','generator':'Burger Club portrait pose and texture preparation','copyright':'pixiv Inc. See vendor/Guest-credits.txt'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'buffers':[{}],'bufferViews':[],'accessors':[],'textures':[],'images':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]}
    grips={}
    for name in ('mealReach','mealBite'):
        palms=[];posed=poses[name]
        for side in ('left','right'):
            wrist=posed[bones[side+'Hand']][:3,3]
            middle=posed[bones.get(side+'MiddleProximal',bones[side+'IndexProximal'])][:3,3]
            palms.append(.46*wrist+.54*middle)
        center=np.mean(palms,axis=0)+np.array([0,.018,.020*facing])
        if facing<0:center[[0,2]]*=-1
        grips[name]=center.tolist()
    outj['scenes'][0]['extras']={'mealGrip':grips}
    buf=bytearray()
    def view(data):
        while len(buf)%4:buf.append(0)
        idx=len(outj['bufferViews']);outj['bufferViews'].append({'buffer':0,'byteOffset':len(buf),'byteLength':len(data)});buf.extend(data);return idx
    def write_acc(arr,kind,ctype=5126,bounds=False):
        arr=np.ascontiguousarray(arr,dtype=dtypes[ctype]);acc={'bufferView':view(arr.tobytes()),'componentType':ctype,'count':len(arr),'type':kind}
        if bounds:acc.update(min=arr.min(0).tolist(),max=arr.max(0).tolist())
        idx=len(outj['accessors']);outj['accessors'].append(acc);return idx
    tex_ids={}
    def texture(t,material):
        im=src['textures'][t]['source']
        if im in tex_ids:return tex_ids[im]
        v=src['bufferViews'][src['images'][im]['bufferView']];start=v.get('byteOffset',0)
        image=Image.open(BytesIO(binary[start:start+v['byteLength']])).convert('RGBA')
        image.thumbnail((2048,2048),Image.Resampling.LANCZOS)
        if key=='a':
            image=textile(image) if material=='Tops_01_CLOTH' else paint_portrait(image,material)
        alpha=image.getchannel('A').getextrema()[0]<252
        data=BytesIO()
        if alpha:image.save(data,format='PNG',optimize=True)
        else:image.convert('RGB').save(data,format='JPEG',quality=94,optimize=True,subsampling=0)
        idx=len(outj['images']);outj['images'].append({'bufferView':view(data.getvalue()),'mimeType':'image/png' if alpha else 'image/jpeg'})
        outj['textures'].append({'source':idx,'sampler':0});tex_ids[im]=idx;return idx
    for m in src['materials']:
        p=m.get('pbrMetallicRoughness',{});clr=p.get('baseColorFactor',[1,1,1,1])
        mat={'name':m.get('name','Guest'),'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':clr,'metallicFactor':0,'roughnessFactor':1}}
        if 'baseColorTexture'in p:mat['pbrMetallicRoughness']['baseColorTexture']={'index':texture(p['baseColorTexture']['index'],m['name'])}
        if m.get('alphaMode','OPAQUE')!='OPAQUE':mat.update(alphaMode='MASK',alphaCutoff=.28)
        outj['materials'].append(mat)
    zero_views={}
    def delta_accessor(delta,ip):
        moving=np.flatnonzero(np.linalg.norm(delta,axis=1)>.000015)
        if len(moving)>=len(delta)*.8:return write_acc(delta,'VEC3',bounds=True)
        delta[np.linalg.norm(delta,axis=1)<=.000015]=0
        acc={'componentType':5126,'count':len(delta),'type':'VEC3','min':delta.min(0).tolist(),'max':delta.max(0).tolist()}
        # Three r128 requires a backed base attribute even for an entirely zero delta.
        if len(delta) not in zero_views:zero_views[len(delta)]=view(bytes(len(delta)*12))
        acc['bufferView']=zero_views[len(delta)]
        if len(moving):acc['sparse']={'count':len(moving),'indices':{'bufferView':view(moving.astype(dtypes[ip]).tobytes()),'componentType':ip},'values':{'bufferView':view(delta[moving].astype('<f4').tobytes())}}
        target_id=len(outj['accessors']);outj['accessors'].append(acc);return target_id
    triangles=0
    for i,n in enumerate(ns):
        if 'mesh'not in n:continue
        mesh=src['meshes'][n['mesh']];newmesh={'name':mesh.get('name','Guest'),'primitives':[]}
        for pr in mesh['primitives']:
            at=pr['attributes'];pos=access(at['POSITION']);normal=access(at['NORMAL'])
            ids=access(pr['indices']).ravel().astype('i4')
            used,indices=np.unique(ids,return_inverse=True);pos=pos[used];normal=normal[used]
            uv=access(at['TEXCOORD_0'])[used] if 'TEXCOORD_0'in at else None
            garment_edges=garment_relief=None
            if 'skin'in n and 'JOINTS_0' in at:
                sk=src['skins'][n['skin']];ib=access(sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
                mats=np.array([world[j]@inv for j,inv in zip(sk['joints'],ib)])
                w=access(at['WEIGHTS_0'])[used].astype(float);w/=np.maximum(w.sum(1,keepdims=True),1e-7)
                jm=access(at['JOINTS_0'])[used].astype('i4')
                if key=='a' and src['materials'][pr['material']]['name']=='Tops_01_CLOTH':
                    pos,normal,uv,indices,jm,w,garment_edges=refine_panel(pos,normal,uv,indices,jm,w)
                    garment_relief=pos[len(used):]-pos[garment_edges].mean(axis=1)
                M=np.einsum('vjab,vj->vab',mats[jm],w)
                pp=np.einsum('vij,vj->vi',M[:,:3,:3],pos)+M[:,:3,3];nn=np.einsum('vij,vj->vi',M[:,:3,:3],normal)
                fit_seams(pp,M,garment_edges,garment_relief)
            else:pp=pos@world[i][:3,:3].T+world[i][:3,3];nn=normal@world[i][:3,:3].T
            if facing<0:pp[:,[0,2]]*=-1;nn[:,[0,2]]*=-1
            attr={'POSITION':write_acc(pp,'VEC3',bounds=True),'NORMAL':write_acc(nn/np.maximum(np.linalg.norm(nn,axis=1,keepdims=True),1e-7),'VEC3')}
            if uv is not None:attr['TEXCOORD_0']=write_acc(uv,'VEC2')
            ip=5123 if len(pos)<65536 else 5125
            primitive={'attributes':attr,'indices':write_acc(indices,'SCALAR',ip),'material':pr['material']}
            face_mesh='Face' in mesh.get('name','')
            target_names=(['blink','relaxed','aa'] if face_mesh else [])+list(poses)
            primitive['targets']=[]
            if face_mesh:
                for expr in ('blink','relaxed','aa'):
                    target_index=ext['expressions']['preset'][expr]['morphTargetBinds'][0]['index']
                    raw_targets=pr.get('targets',[])
                    target=raw_targets[target_index] if len(raw_targets)>target_index else {}
                    delta=access(target['POSITION'])[used] if 'POSITION'in target else np.zeros_like(pos)
                    delta=np.einsum('vij,vj->vi',M[:,:3,:3],delta) if 'skin'in n else delta@rest_world[i][:3,:3].T
                    if facing<0:delta[:,[0,2]]*=-1
                    primitive['targets'].append({'POSITION':delta_accessor(delta,ip),'NORMAL':delta_accessor(np.zeros_like(delta),ip)})
            for pose_name,posed in poses.items():
                if 'skin' in n and 'JOINTS_0' in at:
                    pose_matrices=np.array([posed[j]@inv for j,inv in zip(sk['joints'],ib)])
                    blend=np.einsum('vjab,vj->vab',pose_matrices[jm],w)
                    xyz=np.einsum('vij,vj->vi',blend[:,:3,:3],pos)+blend[:,:3,3]
                    fit_seams(xyz,blend,garment_edges,garment_relief)
                else:xyz=pos@posed[i][:3,:3].T+posed[i][:3,3]
                if facing<0:xyz[:,[0,2]]*=-1
                if pose_name=='seated':seated_xyz=xyz
                delta=xyz-(seated_xyz if pose_name.startswith('meal') else pp)
                posed_n=(np.einsum('vij,vj->vi',blend[:,:3,:3],normal) if 'skin' in n and 'JOINTS_0' in at else normal@posed[i][:3,:3].T)
                if facing<0:posed_n[:,[0,2]]*=-1
                posed_n/=np.maximum(np.linalg.norm(posed_n,axis=1,keepdims=True),1e-7)
                base_n=nn/np.maximum(np.linalg.norm(nn,axis=1,keepdims=True),1e-7)
                if pose_name=='seated':seated_normal=posed_n
                ref_normal=seated_normal if pose_name.startswith('meal') else base_n
                primitive['targets'].append({'POSITION':delta_accessor(delta,ip),'NORMAL':delta_accessor(posed_n-ref_normal,ip)})
            newmesh['weights']=[0]*len(target_names);newmesh['extras']={'targetNames':target_names}
            newmesh['primitives'].append(primitive);triangles+=len(indices)//3
        outj['scenes'][0]['nodes'].append(len(outj['nodes']));outj['nodes'].append({'mesh':len(outj['meshes']),'name':newmesh['name']});outj['meshes'].append(newmesh)
    while len(buf)%4:buf.append(0)
    outj['buffers'][0]['byteLength']=len(buf)
    data=json.dumps(outj,separators=(',',':')).encode()
    while len(data)%4:data+=b' '
    glb=struct.pack('<4sII',b'glTF',2,28+len(data)+len(buf))+struct.pack('<I4s',len(data),b'JSON')+data+struct.pack('<I4s',len(buf),b'BIN\0')+buf
    dest=out/('guest-'+key+'.glb');temporary=dest.with_suffix('.tmp')
    temporary.write_bytes(glb);temporary.replace(dest)
    print(key,triangles,'triangles',len(glb),'bytes',flush=True)
for k in sys.argv[1:]:bake(k)
