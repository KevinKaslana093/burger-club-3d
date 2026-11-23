"""Pack the two licensed pixiv faces already shipped with Burger Club.
See burger/dist/vendor/Guest-credits.txt for attribution and terms.
Blink, vowels and the neutral position are all baked in the same coordinate frame.
"""
from pathlib import Path
from io import BytesIO
import json,struct,base64
import numpy as np
from PIL import Image
from scipy.ndimage import grey_opening
from owner_paint import paint_owner

work=Path(__file__).resolve().parent
dst=work/'burger/dist'
b64=lambda data:base64.b64encode(data).decode('ascii')
tiles={'skin':(0,0,512),'scalp':(512,0,128),'mouth':(640,0,128),'iris':(768,0,256),
       'white':(512,256,256),'line':(768,256,256),'brow':(0,512,256),
       'lash':(256,512,256),'light':(512,512,256)}
def face_field(positions,uv,tri):
    """Map real UV islands back to facial space so paint follows the cheek and lip."""
    size=512
    atlas=np.zeros((size,size,3),dtype='float32');atlas[:,:,2]=-1
    for ids in tri:
        a,b,c=uv[ids]*(size-1);u=b-a;v=c-a;det=u[0]*v[1]-u[1]*v[0]
        if abs(det)<.00001:continue
        x0,y0=np.floor(np.minimum.reduce([a,b,c])).astype(int).clip(0,size-1)
        x1,y1=np.ceil(np.maximum.reduce([a,b,c])).astype(int).clip(0,size-1)
        yy,xx=np.mgrid[y0:y1+1,x0:x1+1];xx=xx-a[0];yy=yy-a[1]
        s=(xx*v[1]-yy*v[0])/det;t=(u[0]*yy-u[1]*xx)/det
        pt=positions[ids[0]]+s[:,:,None]*(positions[ids[1]]-positions[ids[0]])+t[:,:,None]*(positions[ids[2]]-positions[ids[0]])
        target=atlas[y0:y1+1,x0:x1+1]
        inside=(s>=-.01)&(t>=-.01)&(s+t<=1.01)&(target[:,:,2]<pt[:,:,2])
        target[inside]=pt[inside]
    return atlas

def complexion(base,field,key,guest):
    pix=np.array(base).astype(float)
    x,y,z=field.transpose(2,0,1);a=key=='a';xx=x*(3.08 if a else 3.42)
    h=2.285+(y-(1.443 if a else 1.370))*(3.39 if a else 3.67)
    front=np.clip((z-.005)/.025,0,1)
    def wash(mask,rgb):
        w=(mask*front)[:,:,None];pix[:,:,:3]*=1-w*(1-np.array(rgb)/255)
    def bell(u,v,w,t):return np.exp(-((u/w)**2+(v/t)**2))
    # Blood flow at the cheekbone and lower eyelid. The riding instructor and
    # the florist have different blush placements; freckles pick up at the bridge.
    feminine=guest in (3,4,6,7,10,11);older=guest in (5,12)
    wash(bell(abs(xx)-.148,h-2.215,.077,.040)*(.35 if feminine else .17),[255,188,190])
    wash(bell(abs(xx)-.144,h-2.326,.064,.025)*(.45 if feminine else .23),[220,180,184])
    wash(bell(xx,h-2.176,.037,.034)*.30,[255,195,179])
    lip_y=2.0855 if a else 2.0955
    curve=lip_y+.005*(xx/.066)**2
    wash(bell(xx,h-curve,.052,.0077)*(.58 if feminine else .28),[249,170,178])
    rng=np.random.default_rng(11293+guest)
    if guest in (2,6,7,10,11):
        for _ in range(77):
            side=rng.choice([-1,1]);cx=side*rng.uniform(.070,.215);cy=2.222+rng.normal(0,.012)
            w=rng.uniform(.0012,.0028)
            wash(bell(xx-cx,h-cy,w,w*.85)*rng.uniform(.32,.68),[140,103,83])
    if older or guest==9:
        # Moustache is painted directly onto the philtrum with split shafts
        # and directional whiskers, tapering outward with the upper lip.
        span=.100 if guest==12 else .076
        t=abs(xx)/span
        track=lip_y+.028-.017*np.minimum(t,1)**1.2
        thick=.0105*(1-np.minimum(t,1))+.0035
        body=np.exp(-((h-track)/thick)**2)*np.clip((1.04-t)/.22,0,1)*(.56+.44*np.clip(abs(xx)/.012,0,1))
        streak=.43+.57*np.sin(1100*abs(xx)+480*(h-track)+1.4*np.sin(180*xx))**2
        wash(body*streak*(.85 if older else .48),[141,145,156] if guest==12 else [131,118,116])
        stubble=np.clip((2.065+.073*(abs(xx)/.20)**2-h)/.045,0,1)
        wash(stubble*(.16+.15*rng.random(x.shape)),[151,141,141])
        for j in range(2):
            lid=2.24-.012*j+.018*((abs(xx)-.13)/.08)**2
            line=np.exp(-((h-lid)/.0028)**2)*np.exp(-((abs(xx)-.13)/.065)**4)
            wash(line*(.41 if older else .20),[163,119,117])
        if older:
            for j in range(3):
                reach=abs(xx)-.20
                mask=np.exp(-((h-(2.292-.011*j+.29*reach))/.0028)**2)*np.exp(-((reach-.014)/.021)**4)
                wash(mask*.51,[169,125,120])
    return Image.fromarray(pix.clip(0,255).astype('uint8'))
def bake(key):
    data=(dst/'guests'/('guest-'+key+'.glb')).read_bytes()
    length=struct.unpack_from('<I',data,12)[0]
    model=json.loads(data[20:20+length]);blob=data[28+length:]
    def acc(i):
        a=model['accessors'][i];n={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
        typ={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1'}[a['componentType']]
        def offset(ref):return model['bufferViews'][ref['bufferView']].get('byteOffset',0)+ref.get('byteOffset',0)
        arr=np.frombuffer(blob,typ,count=a['count']*n,offset=offset(a)).reshape(-1,n) if 'bufferView' in a else np.zeros((a['count'],n),dtype=typ)
        if 'sparse'in a:
            s=a['sparse'];idx=s['indices']
            ix=np.frombuffer(blob,{5123:'<u2',5125:'<u4',5121:'u1'}[idx['componentType']],s['count'],offset(idx))
            arr=arr.copy();arr[ix]=np.frombuffer(blob,typ,s['count']*n,offset(s['values'])).reshape(-1,n)
        return arr
    atlas=Image.new('RGBA',(2048,2048),'white');packed={};skins={}
    for mesh in model['meshes']:
        names=mesh.get('extras',{}).get('targetNames',[])
        for p in mesh['primitives']:
            mat=model['materials'][p['material']];name=mat['name']
            kind=next((k for n,k in [('Face_00_SKIN','skin'),('Body_00_SKIN','scalp'),('FaceMouth','mouth'),('EyeWhite','white'),('EyeIris','iris'),('FaceBrow','brow'),('FaceEyeline','line'),('EyeHighlight','light'),('FaceEyelash','lash')] if n in name),None)
            if not kind:continue
            at=p['attributes'];xyz=acc(at['POSITION']).copy();inds=acc(p['indices']).reshape(-1,3)
            nr=acc(at['NORMAL']);uv=acc(at['TEXCOORD_0']).copy()
            deltas=[]
            for morph in ['blink','aa']:
                d=acc(p['targets'][names.index(morph)]['POSITION']).copy() if morph in names else np.zeros_like(xyz)
                deltas.append(d)
            if kind=='scalp':
                h=1.39 if key=='a' else 1.32
                keep=(xyz[inds,1]>h).all(1)&(xyz[inds,2]<.023).all(1)
                inds=inds[keep]
            tx=mat['pbrMetallicRoughness']['baseColorTexture']['index']
            view=model['bufferViews'][model['images'][model['textures'][tx]['source']]['bufferView']]
            im=Image.open(BytesIO(blob[view['byteOffset']:][:view['byteLength']])).convert('RGBA')
            x,y,w=tiles[kind];im=im.resize((w,w),Image.Resampling.LANCZOS)
            pix=np.array(im);rgb=pix[:,:,:3].astype('float32')
            if kind=='skin':
                base=np.array([251,235,222] if key=='a' else [205,166,147])
                # Neutralize the original avatar complexion and painted scalp.
                scale=rgb/base
                if key=='b':
                    scalp=(rgb[:,:,2]>rgb[:,:,1]*1.02)&(rgb[:,:,0]<150)
                    scale[scalp]=[.81,.77,.78]
                rgb=248*np.clip(scale,0,1.04)
            elif kind=='scalp':rgb[:]=[231,224,218];pix[:,:,3]=255
            elif kind=='iris':
                lum=(rgb@np.array([.30,.56,.14]))/255
                rgb=np.repeat((255*lum.clip(0,1)**1.11)[:,:,None],3,axis=2)
            elif kind=='light' and key=='b':
                # Two small window reflections on the limbus suit diner lighting.
                yy,xx=np.mgrid[:w,:w]
                oval=lambda cx,cy,rx,ry:np.clip(1.25-((xx-cx)/rx)**2-((yy-cy)/ry)**2,0,1)
                glints=oval(53,116,6.5,8)+oval(77,144,3,3.5)+oval(176,117,6.5,8)+oval(208,146,3,3.5)
                rgb[:]=[255,246,222];pix[:,:,3]=(255*glints.clip(0,1)).astype('uint8')
            elif kind=='line' and key=='b':
                # Tame the original fuchsia liner and separate the actual lashes
                # from the printed lower-lid spikes for everyday looks.
                pink=(rgb[:,:,0]>rgb[:,:,1]*1.6)&(rgb[:,:,0]>50)
                rgb[pink]=rgb[pink]*[.56,.79,.70]
                alpha=pix[:,:,3].astype(float)
                base=grey_opening(alpha,size=(3,7))
                pix[:,:,3]=(base+.38*(alpha-base)).astype('uint8')
                natural=pix.copy()
                natural[:,:,:3]=np.full((w,w,3),[59,44,45],dtype='uint8')
                natural[:,:,3]=grey_opening(alpha,size=(3,13)).astype('uint8')
                natural[122:,:,3]=0
                atlas.paste(Image.fromarray(natural),(768,512))
            elif kind=='brow':
                rgb[:]=[214,194,187]
            pix[:,:,:3]=rgb.clip(0,255).astype('uint8')
            atlas.paste(Image.fromarray(pix),(x,y))
            if kind=='skin':
                field=face_field(xyz,uv,inds)
                ids=[3,5,6,8,9,12] if key=='a' else [2,4,7,10,11]
                for j,guest in enumerate(ids):
                    dx=j%4*512;dy=1024+(j//4)*512
                    atlas.paste(complexion(Image.fromarray(pix),field,key,guest),(dx,dy))
                    skins[guest]=[dx/2048,-dy/2048]
            used,ix=np.unique(inds,return_inverse=True)
            xyz=xyz[used];uv=uv[used];nr=nr[used];deltas=[d[used] for d in deltas]
            uv[:,0]=(x+uv[:,0]*(w-1)+.5)/2048
            uv[:,1]=1-(y+uv[:,1]*(w-1)+.5)/2048
            def quant(a,s):return b64(np.round(a*s).astype('<i2').tobytes())
            packed[kind]={'p':quant(xyz,16000),'n':quant(nr,16384),'uv':quant(uv,30000),'i':b64(ix.astype('<u2').tobytes())}
            for channel,d in zip(['blink','talk'],deltas):
                if np.abs(d).max()>.00005:packed[kind][channel]=quant(d,32000)
    if key=='b':
        paint_owner(atlas,field)
    buf=BytesIO();atlas.save(buf,'PNG',optimize=True)
    # A small but complete atlas supplies skin and cutouts on the first frame.
    preview=atlas.resize((256,256),Image.Resampling.LANCZOS).quantize(128)
    rgba=preview.convert('RGBA');colors,idx=np.unique(np.array(rgba).reshape(-1,4),axis=0,return_inverse=True)
    return {'parts':packed,'atlas':b64(buf.getvalue()),'palette':b64(colors.tobytes()),'thumb':b64(idx.astype('u1').tobytes()),'skins':skins,'ownerPaint':key=='b'}
if __name__=='__main__':
    result={k:bake(k) for k in 'ab'}
    (dst/'portrait-mesh.js').write_text('/* Adapted from the two pixiv samples. See vendor/Guest-credits.txt. */\nwindow.DinerPortraitMesh='+json.dumps(result,separators=(',',':'))+';\n','utf8')
