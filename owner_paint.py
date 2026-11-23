"""Paint Lu Chuan's diffuse and eye line on the retargeted pixiv sample UVs.

The source atlas is assembled by bake_portrait_mesh.py from the licensed
sample distributed with the game. The owner's patches occupy the top right.
"""
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import median_filter


def paint_owner(atlas, field):
    tile = np.array(atlas.crop((0, 0, 512, 512)))
    rgb = tile[:, :, :3].astype(float)
    x, y, z = np.moveaxis(field, 2, 0)
    valid = z > -0.65
    front = np.clip((z+.005)/.05, 0, 1)
    rng = np.random.default_rng(391)

    def smooth(a):
        a = np.clip(a, 0, 1)
        return a*a*(3-2*a)

    def blend(color, opacity):
        nonlocal rgb
        a = (np.clip(opacity, 0, 1)*valid)[:, :, None]
        rgb = rgb*(1-a) + np.asarray(color)*a

    def spot(cx, cy, w, h):
        return np.exp(-((x-cx)/w)**2-((y-cy)/h)**2)

    # Clear the baked hairline and hard diagonal makeup from the sample.
    # The new part and temple shadows follow the owner's own sculpted hair.
    keep = np.clip(.27+1.2*abs(x),.27,.44) * (1-smooth((y-1.387)/.022))
    keep = np.where((z<.018)&(y<1.393),.78,keep)
    opacity = valid[:, :, None]*(1-keep[:, :, None])
    rgb = rgb*(1-opacity)+np.array([250,246,241])*opacity
    for side in [-1, 1]:
        blend([216,176,169], .23*spot(side*.062,1.349,.033,.012)*front)
        blend([183,157,166], .30*spot(side*.047,1.383,.038,.009)*front)
        blend([230,192,182], .23*spot(side*.046,1.357,.025,.006)*front)
        blend([210,187,182], .34*spot(side*.063,1.321,.030,.026)*front)
        for _ in range(14):
            sx = side*(.044 + rng.random()*.03)
            sy = 1.343 + rng.random()*.013
            blend([157,109,99], (.36+.22*rng.random())*spot(sx,sy,.00055,.00040)*front)
    blend([224,179,166], .36*spot(0,1.337,.013,.008)*front)
    blend([181,139,143], .42*spot(0,1.3175,.019,.0030)*front)
    blend([158,120,124], .56*spot(0,1.31852,.018,.0009)*front)
    beard = smooth((1.310+.019*(np.abs(x)/.08)**2-y)/.027)*front
    blend([179,170,170], .30*beard)
    blend([146,100,94], .68*spot(-.036,1.343,.00084,.00069)*front)
    rgb += rng.normal(0,.70,(512,512,1))*valid[:, :, None]
    tile[:, :, :3] = rgb.clip(0,255).astype('uint8')
    atlas.paste(Image.fromarray(tile), (1024,0))

    # The original eye-line tile includes additional painted lashes and
    # coloured liner. The new upper lash follows the original lid UV edge,
    # tapering at the corners. Short lower accents end before the tear duct.
    original = np.array(atlas.crop((768,256,1024,512)))
    alpha = original[:,:,3]/255
    upper = np.zeros_like(alpha)
    for start,end in ((18,127),(129,239)):
        bottom = np.zeros(end-start); top = np.zeros(end-start)
        for n,i in enumerate(range(start,end)):
            rows = np.flatnonzero(alpha[59:119,i]>.42)
            if len(rows): top[n],bottom[n] = 59+rows[0],59+rows[-1]
        top = median_filter(top,5)
        bottom = median_filter(bottom,5)
        for n,i in enumerate(range(start,end)):
            t=(n+.5)/(end-start)
            width=(4.8+2.6*np.sin(np.pi*t))*np.sin(np.pi*t)**.45
            edge=bottom[n]-width
            yy=np.arange(256)
            upper[:,i]=alpha[:,i]*np.clip((yy-edge)/1.4,0,1)*np.clip(bottom[n]+1.7-yy,0,1)
    cut = np.empty_like(original)
    cut[:,:,:3] = [56,43,48]
    cut[:,:,3] = np.uint8(255*upper)
    atlas.paste(Image.fromarray(cut), (1536,0))
    brow = np.array(atlas.crop((0,512,256,768)))
    original_brow=Image.fromarray(brow[:,:,3])
    brow[:,:,3]=np.array(original_brow.filter(ImageFilter.MaxFilter(7)))
    yy,xx = np.mgrid[:256,:256]
    strand = 174+28*(.5+.5*np.cos(.98*xx+.25*yy+np.sin(.19*xx)))**2
    for c,shift in enumerate((9,3,4)):
        brow[:,:,c]=np.uint8(strand+shift)
    atlas.paste(Image.fromarray(brow), (1792,0))
