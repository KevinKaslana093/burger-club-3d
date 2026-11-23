"""Screen-printed cotton tee authored for Mia's existing UV and skin weights."""
import numpy as np
from PIL import Image, ImageDraw


def fold_field(u, v):
    """Height of tension ridges in metres; fade out before split UV borders."""
    y = np.where(v > .5, v - .5, v)
    front = np.where(v > .5, -.015, .010)
    folds = np.zeros_like(u + y)
    for side in (-1, 1):
        x = (u - .5) * side
        for start, slope, spread, strength in [(.20, -.32, .013, .0032),
                                                (.30, -.53, .014, .0038),
                                                (.35, .58, .017, .0031)]:
            distance = (y - start - slope * (x - .18) - front * side -
                        .19 * (x - .16) ** 2)
            taper = np.exp(-((x - .16) / .106) ** 2)
            folds += strength * taper * np.exp(-(distance / spread) ** 2)
    vertical = (.0024 * np.sin(47*u + 3*np.sin(9*y)) ** 2 *
                np.exp(-((y - .35) / .06) ** 2))
    edge = np.clip((.258 - np.abs(u - .5)) / .055, 0, 1)
    panel = edge * np.clip((y-.14)/.042,0,1) * np.clip((.405-y)/.020,0,1)
    return (folds + vertical) * panel


def refine_panel(positions, normals, uv, triangles, joints, weights):
    """Split the cotton panel once; skin new vertices to the original bones."""
    faces = triangles.reshape(-1, 3)
    edges = np.stack((faces[:,[0,1]], faces[:,[1,2]], faces[:,[2,0]]),axis=1)
    ends, mids = np.unique(np.sort(edges.reshape(-1,2),axis=1),axis=0,return_inverse=True)
    ab,bc,ca = (mids.reshape(-1,3) + len(positions)).T
    a,b,c = faces.T
    refined_faces = np.stack(([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]),axis=2).transpose(1,2,0).reshape(-1,3)
    def interpolate(arr):
        return np.concatenate((arr,arr[ends].mean(axis=1)))
    positions, normals, uv = map(interpolate,(positions,normals,uv))
    normals = normals/np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-10)
    before=positions.copy()
    positions += normals*fold_field(*uv.T)[:,None]
    def vertex_normals(p):
        vertices=p[refined_faces]
        face_normals=np.cross(vertices[:,1]-vertices[:,0],vertices[:,2]-vertices[:,0])
        out=np.zeros_like(p)
        for column in refined_faces.T:np.add.at(out,column,face_normals)
        return out/np.maximum(np.linalg.norm(out,axis=1,keepdims=True),1e-10)
    normals += vertex_normals(positions)-vertex_normals(before)
    normals /= np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-10)
    # Merge shared influences on each edge. The shader accepts four joints.
    merged=np.zeros((len(ends),int(joints.max())+1))
    for endpoint in ends.T:
        np.add.at(merged,(np.arange(len(ends))[:,None],joints[endpoint]),weights[endpoint]*.5)
    selected=np.argsort(-merged,axis=1,kind='stable')[:,:4]
    values=np.take_along_axis(merged,selected,axis=1)
    values/=np.maximum(values.sum(axis=1,keepdims=True),1e-10)
    return positions,normals,uv,refined_faces.ravel(),np.concatenate((joints,selected)),np.concatenate((weights,values)),ends


def fit_seams(posed, skin_matrix, edges, relief):
    """Keep subdivided shoulder vertices on the deformed source panel."""
    if edges is not None:
        first=len(posed)-len(edges)
        posed[first:]=posed[edges].mean(axis=1)+np.einsum('vij,vj->vi',skin_matrix[first:,:3,:3],relief)


def textile(image):
    w,h=image.size
    u=(np.arange(w,dtype='f4')[None,:]+.5)/w
    v=(np.arange(h,dtype='f4')[:,None]+.5)/h
    original=np.asarray(image.convert('RGB'),dtype='f4').mean(axis=2)/255
    height=fold_field(u,v)
    # Fine yarn is baked into albedo, so it also survives the software renderer.
    grain=np.sin(u*w*2.22+v*h*.15)*.58+np.sin(v*h*2.35-u*w*.06)*.45
    shade=np.clip((original-.97)*56 + np.gradient(height,axis=1)*18500
                  + np.gradient(height,axis=0)*31000 + grain,-27,16)
    img=Image.fromarray(np.uint8(np.clip(np.array([194,199,187])+shade[:,:,None],0,255)))
    d=ImageDraw.Draw(img)
    def pt(x,y):return round(x*w),round(y*h)
    def line(points,color,size):d.line([pt(*p) for p in points],fill=color,width=max(1,round(size*w)),joint='curve')
    def poly(points,color):d.polygon([pt(*p) for p in points],fill=color)
    def ellipse(x,y,rx,ry,color):d.ellipse([pt(x-rx,y-ry),pt(x+rx,y+ry)],fill=color)
    def quadratic(p0,p1,p2):
        return [tuple((1-t)**2*np.array(p0)+2*(1-t)*t*np.array(p1)+t*t*np.array(p2)) for t in np.linspace(0,1,32)]
    # Bias-bound neck, twin-needle sleeve bands and shoulders of the two UV panels.
    for back in (False,True):
        off=.5 if back else 0
        collar=[(.402,.09),(.418,.102),(.431,.110),(.445,.117),(.475,.122),(.50,.124),
                (.525,.122),(.555,.117),(.569,.110),(.582,.102),(.598,.09)]
        collar=[(x,off+(.091+(y-.09)*.29 if back else y)) for x,y in collar]
        line(collar,'#677c70',.023)
        line([(x,y+.006) for x,y in collar],'#9ca491',.0025)
        for side in (False,True):
            def mirror(points):return [(1-x if side else x,y+off) for x,y in points]
            line(mirror([(.050,.132),(.112,.226)]),'#6e8376',.028)
            line(mirror([(.062,.130),(.127,.226)]),'#a1ab96',.003)
            line(mirror(quadratic((.399,.093),(.319,.147),(.239,.217))),'#829486',.004)
            line(mirror(quadratic((.405,.093),(.328,.147),(.246,.219))),'#b3baa6',.0025)
        for dy in (0,.0025):
            line([(x,off+.395+dy+.006*(abs(x-.5)/.27)**1.5) for x in np.linspace(.228,.772,120)],'#a3ab99',.0021)
    # Small three-ink still life, like a student exercise in colour registration.
    # Cut citrus, two broad leaves, unprinted radial laces, and four ink swatches.
    ink='#3f6c65'; mid='#799487'; rust='#b96d4b'; flesh='#dea474'; cream='#e2d7b4'
    leaf=quadratic((.55,.203),(.50,.203),(.493,.175))+quadratic((.493,.175),(.538,.178),(.55,.203))
    poly(leaf,ink)
    leaf=quadratic((.543,.201),(.550,.176),(.581,.172))+quadratic((.581,.172),(.578,.192),(.543,.201))
    poly(leaf,mid)
    line(quadratic((.509,.184),(.536,.196),(.555,.217)),cream,.002)
    ellipse(.564,.216,.031,.017,rust)
    ellipse(.557,.217,.028,.0155,flesh)
    for angle in np.linspace(-2.9,2.5,7):
        line([(.558+.005*np.cos(angle),.218+.003*np.sin(angle)),
              (.557+.023*np.cos(angle),.217+.0124*np.sin(angle))],cream,.0023)
    for i,color in enumerate([ink,mid,rust,flesh]):
        x=.497+.013*i;poly([(x,.236),(x+.009,.236),(x+.009,.239),(x,.239)],color)
    img=img.convert('RGBA');img.putalpha(image.getchannel('A'));return img
