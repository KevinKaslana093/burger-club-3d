"""Bake woven samples used by the returning diners' vertex-painted clothes."""
from pathlib import Path
import numpy as np
from PIL import Image


def bake():
    size = 384
    yy, xx = np.mgrid[:size, :size] / size
    rng = np.random.default_rng(417)
    swatches = []
    for kind in range(8):
        fine = rng.normal(0, .8, xx.shape)
        yarn = np.sin(2*np.pi*(61*xx + .14*np.sin(2*np.pi*5*yy)))
        weft = np.cos(2*np.pi*(74*yy + .09*np.sin(2*np.pi*xx*7)))
        diag = np.cos((xx + .53*yy)*np.pi*2*42)
        if kind == 0:   # Dense jersey with small V loops
            fabric = 245+3.4*np.cos(2*np.pi*(42*yy+.24*yarn))+2.2*yarn
        elif kind == 1: # A chalk stripe on cotton poplin
            stripe = np.maximum(0,np.cos(2*np.pi*xx*11))**9
            fabric = 239+12*stripe+2.4*yarn+1.5*weft
        elif kind == 2: # The nap changes direction between herringbone bands
            chevron = np.abs((xx*12)%1-.5)*.65
            fabric = 243+5*np.cos(2*np.pi*(yy*61+chevron))+1.7*yarn
        elif kind == 3: # Work denim, broken twill
            fabric = 236+6*diag+3*weft+2*np.sin(2*np.pi*xx*22)
        elif kind == 4: # A lightweight checked weave
            xline = np.maximum(0,np.cos(2*np.pi*xx*9))**8
            yline = np.maximum(0,np.cos(2*np.pi*yy*12))**8
            fabric = 247-10*xline-8*yline+1.6*yarn
        elif kind == 5: # Cardigan rib with alternating knitted stitches
            fabric = 241+7*np.cos(2*np.pi*xx*26)+3*np.cos(2*np.pi*(yy*48+.28*yarn))
        elif kind == 6: # Double-strand ripstop grid
            fabric = 246-7*(xx*18%1<.12)-8*(yy*24%1<.10)+2.6*diag
        else:           # Slub linen
            fabric = 243+4*yarn+4*weft+2*np.sin(2*np.pi*(17*xx+yy))
        rgb = np.stack((fabric+.5, fabric, fabric-.8),axis=-1) + fine[:,:,None]
        swatches.append(Image.fromarray(np.uint8(np.clip(rgb,0,255))))
    image = Image.new('RGB',(4*size,2*size),'white')
    for i,sample in enumerate(swatches):
        image.paste(sample,((i%4)*size,(i//4)*size))
    image.paste('white',(0,0,14,14))
    image.save(Path(__file__).resolve().parent/'burger/dist/art/guest-fabrics.jpg',quality=93,subsampling=0,optimize=True)
    # A second atlas follows the actual root-to-tip coordinates of the hair
    # ribbons. Fine fibres taper below the broad, broken specular band.
    y,x=np.mgrid[0:640,0:512]
    u,v=x/512,y/640
    sweep=u+.017*np.sin(5.4*v)+.008*np.sin(10*v-4*u)
    grooves=np.maximum(0,np.cos(2*np.pi*(11*sweep+.12*np.sin(47*sweep))))**4
    fibres=(.5+.5*np.cos(2*np.pi*sweep*77+3*np.sin(19*sweep)+v))**4
    halo=np.exp(-((v-.40-.06*np.sin(2*np.pi*3*sweep))/.095)**2)
    broken=halo*(.68+.32*np.cos(2*np.pi*8*sweep))*np.clip(1-grooves*.73,0,1)
    value=221+7*fibres-14*grooves-6*(1-v)**3+35*broken
    hair=Image.fromarray(np.uint8(np.clip(np.stack([value+2*broken,value,value+3*(1-halo)],axis=-1),0,255)))
    hair.paste('white',(0,0,12,12))
    hair.save(Path(__file__).resolve().parent/'burger/dist/art/guest-locks.jpg',quality=95,subsampling=0,optimize=True)


if __name__ == '__main__':
    bake()
