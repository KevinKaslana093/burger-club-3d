"""Fit the two credited VRoid shoe lasts and paint occupation-specific uppers and soles."""
from base64 import b64encode
from io import BytesIO
from pathlib import Path
import json
import re
import struct

import numpy as np
from PIL import Image, ImageDraw
from scipy.interpolate import CubicSpline

DIST=Path(__file__).resolve().parent/'burger'/'dist'
# Source, upper, accent stripe, foxing/welt, laces. Matches the diner's outfit.
COLORS=[
    ('a','E6D7B8','386D70','C9B89F','C17A45'), # skater
    ('a','59444E','BC9090','654C49','C3A991'), # illustrator
    ('a','825E5C','DBA261','A07C6C','E8CE9D'), # dancer
    ('b','895D40','A68259','554438','DCBD87'), # carpenter
    ('a','E2D7BD','698AA8','C6B79B','CBD3D3'), # student
    ('a','804D43','9D7464','634A40','D6BB96'), # knitter
    ('b','493E54','A58AA8','72656C','C0ACB4'), # musician
    ('b','675541','857453','564C40','B9A880'), # photographer
    ('c','426461','D8B578','54716C','D1B487'), # courier
    ('b','A58367','A49271','695F4A','D3BD9B'), # florist
    ('a','6D5145','A77A56','594B42','B4A18C'), # record shop
]


def source(key):
    cycling=key=='c'
    if cycling:key='b'
    blob=(DIST/'guests'/f'guest-{key}.glb').read_bytes()
    length=struct.unpack_from('<I',blob,12)[0];g=json.loads(blob[20:20+length]);binchunk=blob[28+length:]
    mi=next(i for i,m in enumerate(g['materials']) if 'shoes' in m['name'].lower())
    image=g['images'][g['textures'][g['materials'][mi]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
    def buffer(i):
        v=g['bufferViews'][i];s=v.get('byteOffset',0);return binchunk[s:s+v['byteLength']]
    def data(i):
        a=g['accessors'][i];raw=buffer(a['bufferView']);dim={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
        return np.frombuffer(raw,{5126:'<f4',5123:'<u2'}[a['componentType']],a['count']*dim,a.get('byteOffset',0)).reshape(-1,dim)
    prim=next(p for m in g['meshes'] for p in m['primitives'] if p['material']==mi)
    p,n,uv=(data(prim['attributes'][a]) for a in ['POSITION','NORMAL','TEXCOORD_0'])
    faces=data(prim['indices']).reshape(-1,3)
    ids=np.where(p[:,0]>0)[0]; remap=np.full(len(p),-1,dtype=np.int32);remap[ids]=np.arange(len(ids))
    faces=remap[faces[(p[faces,0]>0).all(1)]]
    p=p[ids];span=p.max(0)-p.min(0)
    norm=(p-p.min(0))/span
    # The sample's loose bow is a cluster of flat strips using the very top of the
    # atlas. Replace those strips and the printed crossings with round, fitted laces.
    uv=uv[ids];normals=n[ids];faces=faces[(uv[faces,1]>.095).all(1)]
    keep=np.unique(faces);remap=np.zeros(len(norm),dtype='i4');remap[keep]=np.arange(len(keep))
    norm,uv,normals,faces=norm[keep],uv[keep],normals[keep],remap[faces]
    points=list(norm);dirs=list(normals);coords=list(uv);tri=list(faces)
    def tube(knots,r,shade,samples):
        controls=np.array(knots)*span
        curve=CubicSpline(np.arange(len(controls)),controls)
        t=np.linspace(0,len(controls)-1,samples);path=curve(t);tangent=curve(t,1)
        tangent/=np.linalg.norm(tangent,axis=1)[:,None]
        side=np.cross(tangent,[0,1,0]);side/=np.maximum(np.linalg.norm(side,axis=1)[:,None],1e-8)
        face=np.cross(tangent,side);start=len(points);radials=8
        for h,(c,a,b) in enumerate(zip(path,side,face)):
            for l in range(radials):
                ang=l*2*np.pi/radials;d=a*np.cos(ang)+b*np.sin(ang)
                points.append((c+d*r)/span);dirs.append(d);coords.append([.02+.026*shade,.025])
                if h<samples-1:
                    ix=start+h*radials+l;k=start+h*radials+(l+1)%radials
                    tri.extend([[ix,k,ix+radials],[k,k+radials,ix+radials]])
    def shoetop(x,y):
        # Look up the real instep at the exact artwork UV, preserving the toe pitch.
        target=np.array([x,y]);best=None
        for f in faces:
            a,b,c=uv[f];mat=np.column_stack((b-a,c-a))
            if abs(np.linalg.det(mat))<1e-8:continue
            i,j=np.linalg.solve(mat,target-a);weights=np.array([1-i-j,i,j]);err=max(0,-weights.min())
            if best is None or err<best[0]:best=(err,weights@norm[f])
        return best[1].copy()
    if cycling:
        # Two broad hook-and-loop straps follow the cycling last over the arch.
        for row in range(2):
            start=len(points);su=16;sv=3
            for v in range(sv+1):
                for u in range(su+1):
                    x=.385+.22*u/su; y=.573+.105*row+.040*v/sv+.020*u/su
                    pt=shoetop(x,y);pt[1]+=.022+.014*np.sin(np.pi*u/su)
                    points.append(pt);dirs.append([0,.94,.34])
                    coords.append([.09+.038*u/su,.012+.043*v/sv])
            for v in range(sv):
                for u in range(su):
                    a=start+v*(su+1)+u;b=a+1;c=a+su+1
                    tri.extend([[a,c,b],[b,c,c+1]])
            # Rib at the leading edge and its reflective pull tab have separate pigments.
            path=[]
            for t in np.linspace(0,1,8):
                pt=shoetop(.392+.207*t,.573+.105*row+.020*t)
                pt[1]+=.025+.014*np.sin(np.pi*t)
                path.append(pt)
            tube(path,.0016,1,15)
    else:
        for row in range(4):
            y0=(308+24*row)/512 if key=='a' else (301+21*row)/512
            y1=y0+.031
            for direction in [-1,1]:
                x0=.5+direction*.065;x1=.5-direction*.065
                steps=[]
                for t in np.linspace(0,1,5):
                    pt=shoetop(x0+t*(x1-x0),y0+t*(y1-y0))
                    pt[1]+=.009+.019*np.sin(np.pi*t)+(.009 if direction==1 else 0)
                    steps.append(pt)
                tube(steps,.0017,0,9)
        peak=.883 if key=='a' else .826
        centre=.469 if key=='a' else .452
        for side in [-1,1]:
            def knot(x,y,z):
                return [.508+side*x,peak+y,centre+z]
            tube([knot(0,.003,0),knot(.13,.023,-.008),knot(.257,-.012,.006),knot(.29,-.049,.043),
                  knot(.205,-.075,.066),knot(.088,-.029,.041),knot(0,0,.012)],.00195,0,29)
            tail=[knot(0,.002,.011),knot(.088,-.044,.047),knot(.167,-.108,.083),
                  knot(.175,-.181,.147),knot(.22,-.225,.173)]
            tube(tail,.0017,0,17)
            tube(tail[-2:],.00179,1,5)
    def enc(buf):return b64encode(buf.tobytes()).decode()
    return {
        'p':enc(np.rint(np.array(points)*32767).astype('<i2')),
        'n':enc(np.rint(np.array(dirs)*127).astype('i1')),
        'uv':enc(np.rint(np.array(coords)*65535).astype('<u2')),'i':enc(np.array(tri).astype('<u2')),
        'span':span.tolist(),
    }, Image.open(BytesIO(buffer(image['bufferView']))).convert('RGBA')


def paint(original,spec):
    key,*colors=spec
    cycling=key=='c'
    if cycling:key='b'
    upper,accent,rubber,laces=[np.array(tuple(bytes.fromhex(h)),dtype=float) for h in colors]
    src=np.array(original).astype(float);r,g,b=src[:,:,0],src[:,:,1],src[:,:,2]
    light=.24*r+.65*g+.11*b
    yy,xx=np.mgrid[0:512,0:512]
    pigment=upper[None,None,:]*(.67+np.clip(light/75,0,.73))[...,None]
    def coat(mask,col,factor):
        pigment[mask]=np.broadcast_to(col*factor[...,None],pigment.shape)[mask]
    if key=='a':
        welt=light>137
        coat(welt,rubber,.72+.30*light/255)
        stripe=(yy>302)&(yy<365)&(np.abs(xx-256)>39)&welt
        coat(stripe,accent,.66+.32*light/255)
        tongue=(np.abs(xx-256)<38)&(yy>294)&(yy<416)
        coat(tongue&(light>100),upper,.70+.25*light/255)
        coat(tongue&(light<=100),laces,.41+.63*np.clip(light/45,0,1))
    else:
        sole=light>138
        coat(sole,rubber,.72+.29*light/255)
        cyan=(g>r+28)&(b>r+28)
        coat(cyan,accent,.65+.34*np.clip(light/160,0,1))
        lace=(np.abs(xx-256)<39)&(yy>289)&(yy<389)
        coat(lace&(light>47),laces,.50+.42*np.clip(light/72,0,1))
    # Replace the flat printed lace crossings with a softly sheened tongue;
    # the actual crossings follow this patch's matching 3D instep.
    start,end=(294,414) if key=='a' else (290,389)
    tongue=np.clip((36-np.abs(xx-256))/5,0,1)*np.clip((yy-start)/5,0,1)*np.clip((end-yy)/7,0,1)
    tongue_tint=upper*(.75+.17*np.cos((xx-256)*.066)+.04*np.cos(yy*.21))[...,None]
    pigment+=tongue[...,None]*(tongue_tint-pigment)
    # The sole preserves the sample's actual relief pattern while using the correct leather/rubber tint.
    outsole=(yy<182)
    coat(outsole,rubber,.57+.41*light/255)
    col=Image.fromarray(np.uint8(np.dstack((np.clip(pigment,0,255),src[:,:,3]))))
    ink=ImageDraw.Draw(col)
    def tone(rgb,amount):return tuple(map(int,(rgb*amount).clip(0,255)))+(255,)
    if key=='b':
        for mirror in [False,True]:
            def side(pts):return [(511-x if mirror else x,y) for x,y in pts]
            for pts in [[(104,258),(199,263),(196,285),(114,281)],[(86,327),(194,301),(194,322),(98,354)]]:
                ink.polygon(side(pts),fill=tone(upper,.81))
                edge=side([pts[0],pts[1]]);ink.line(edge,fill=tone(accent,1.02),width=3)
            for x,y in [(186,279),(183,309),(174,318)]:
                if mirror:x=511-x
                ink.ellipse((x-2,y-2,x+2,y+2),fill=tone(laces,.72))
    # Two curved rows mark the lasting stitch across the front vamp.
    ybase=436 if key=='a' else 402
    for u in np.linspace(-.98,.98,31):
        x=256+51*u;y=ybase+8*(1-u*u)
        ink.line([(x,y),(x+1.5,y-.25*u)],fill=tone(laces,.77),width=1)
    col.putalpha(original.getchannel('A'))
    ink.rectangle((4,5,17,21),fill=tone(laces,.91));ink.rectangle((19,5,30,21),fill=tone(rubber,.74))
    if cycling:
        ink.rectangle((44,4,68,32),fill=tone(upper,.84))
        ink.line((44,8,68,8),fill=tone(accent,1.0),width=3)
        for x in [57,62,66]:ink.line((x,10,x-3,28),fill=tone(accent,.9),width=2)
    return col


def main():
    geometry={};textures={}
    for k in 'abc':geometry[k],textures[k]=source(k)
    atlas=Image.new('RGBA',(2048,2048),(100,88,79,0))
    for i,spec in enumerate(COLORS):
        img=paint(textures[spec[0]],spec)
        atlas.paste(img,((i%4)*512,(i//4)*512))
    # Equal-colour transparent texels outside each chart already carry the upper hue.
    atlas.save(DIST/'art'/'guest-footwear.png',optimize=True)
    js=DIST/'footwear.js';s=js.read_text('utf8')
    s=re.sub(r'  const shapes=.*?; // baked shoe lasts',lambda _:'  const shapes='+json.dumps(geometry,separators=(',',':'))+'; // baked shoe lasts',s,count=1)
    js.write_text(s,'utf8')

if __name__=='__main__':
    main()
