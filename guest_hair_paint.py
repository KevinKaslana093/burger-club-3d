"""Paint the salon hair-card atlas. Each guest has a broad lock and a spray of fine ends."""
from pathlib import Path


import numpy as np
from PIL import Image


# Shadow, local colour, reflected sky, and narrow specular highlight in sRGB.
PALETTES = [
    ('392429','694335','A96950','ECC4A1'),   # skater — chestnut
    ('242134','44394E','866887','D9C9E7'),   # illustrator — ink plum
    ('351F27','633739','AD7261','F9BC87'),   # dancer — auburn
    ('575358','908A83','BFBBB1','F3E4C8'),   # carpenter — iron grey
    ('392235','653735','B5684F','F7C38C'),   # student — cinnamon
    ('713E39','A96143','D79769','FFDEA7'),   # knitter — strawberry
    ('201E31','433345','906C89','DFCFEE'),   # musician — blackberry
    ('272733','41474B','71888A','BDC8BE'),   # photographer — charcoal
    ('38242A','62392E','A9684E','ECC09A'),   # courier — mahogany
    ('482A33','784638','BE8266','F8C696'),   # florist — copper rose
    ('58575E','8B8984','C5C2B6','F2ECDA'),   # record shop — silver
]

def rgb(value):
    return np.array(tuple(bytes.fromhex(value)),dtype=float)

def smooth(x):
    x=np.clip(x,0,1)
    return x*x*(3-2*x)

def tint(a,b,t):
    return a+(b-a)*np.expand_dims(t,-1)

def plate(row, variant):
    n=512
    h,w=n,128
    y,x=np.mgrid[:h,:w]
    x=(x+.5)/w
    y=(y+.5)/h
    seed=1.19*row+4.73*variant
    root,mid,rim,glow=map(rgb,PALETTES[row])
    # Each lock bends across the tangent of its card. The slim highlight lobes
    # mirror the comb strokes and break on separate tiny tufts.
    wave=x+.021*np.sin(y*5.8+seed)+.014*np.cos(y*11-2*x+seed)
    lobe=2*np.pi*(2.55*wave + .15*np.sin(12*wave+seed))
    thread=.5+.5*np.cos(lobe)
    ridge=.5+.5*np.cos(2*np.pi*(18.3*wave+.24*np.sin(lobe)+.13*y))
    bright=.38+.39*np.sin(np.pi*np.clip(y*.92+.07,0,1))+.14*thread+.055*ridge-.17*(1-np.sin(np.pi*x))
    c=tint(root,mid,bright)
    # Wide reflected band interrupted by dark strokes, plus a stepped finer reflection.
    edge=.34+.046*np.sin(11*wave+seed)+.008*np.sin(69*wave+seed)+.018*(x-.48)
    width=(.036+.043*thread)*(.7+.3*np.sin(np.pi*x))
    band=smooth((width*1.9-np.abs(y-edge))/(.075+width/3))
    c=tint(c,rim,.64*band*(.52+.48*thread)+.10*ridge**3*np.sin(np.pi*y))
    chips=smooth((width*.54-np.abs(y-edge+.011))/(.012+.012*(1-thread)))
    broken=smooth((thread+.24*ridge-.32)/.55)
    if row in (3,7,10):
        chips*=.54
    c=tint(c,glow,(.41+.15*np.cos(4*x+seed)**2)*chips*(.28+.72*broken))
    secondary=np.exp(-((y-(.67+.032*np.cos(8*wave+seed)))/.049)**2)
    c=tint(c,rim,secondary*(.11+.16*thread))
    c=tint(c,root,.22*(1-thread)**3*(.4+.6*y)+.20*smooth((.10-y)/.10))
    # A few filaments peel from the edge; four distinct blades split at the tip.
    # Paint through transparent texels so linear filtering cannot create a pale fringe.
    centre=.51+.10*np.sin(seed)
    travel=smooth((y-.44)/.55)
    left=.020+.46*travel*centre
    right=.979-.48*(1-centre)*travel
    mask=smooth((wave-left)*95)*smooth((right-wave)*95)
    end=.69+.29*(.5+.5*np.cos((wave-centre)*8.3))**1.08
    end+=.053*np.cos(24*wave+seed)+.038*np.cos(48*wave+.6*seed)
    if variant:
        end-=.10*(.5+.5*np.sin(53*wave+seed))**3
    mask*=smooth((end-y)/.006)
    root_alpha=smooth((y-.018)/.12)
    alpha=np.uint8(255*np.clip(mask*root_alpha,0,1))
    # Vertex tint is the swatch's bright warm colour. Store its relative albedo.
    paint=np.uint8(np.clip(255*c/glow,0,255))
    return Image.fromarray(np.dstack((paint,alpha)))


def bake():
    atlas=Image.new('RGBA',(1024,2048),'white')
    for i in range(len(PALETTES)):
        for v in range(2):
            atlas.paste(plate(i,v),((i%4)*256+v*128,(i//4)*512))
    # A seamless dense undercoat closes the scalp between separated fringe locks.
    # This row has no perforation so it also works behind the thinner flyaways.
    yy,xx=np.mgrid[0:512,0:1024]
    a=xx/1024*2*np.pi
    length=yy/512
    swirl=a+.085*np.sin(2*a+.9*length)+.04*np.cos(3*a)*length
    lobes=.5+.5*np.cos(27*swirl+1.1*np.sin(4*a)+.46*length)
    fibre=.5+.5*np.cos(137*swirl+.75*np.cos(27*swirl)-length)
    band=np.exp(-((length-(.38+.062*np.sin(2*a+.9)))/.071)**2)
    satin=207+22*lobes+7*fibre+16*band*(.3+.7*lobes)-7*(1-lobes)**3
    atlas.paste(Image.fromarray(np.uint8(np.stack((satin+1,satin,satin+2),axis=-1))), (0,1536))
    atlas.paste('white',(0,0,12,15))
    atlas.save(Path(__file__).resolve().parent/'burger/dist/art/guest-grooms.png',optimize=True)

if __name__=='__main__':
    bake()

