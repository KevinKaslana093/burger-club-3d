"""Paint eleven original clothing textiles in garment space."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw


size = 512
y,x = np.mgrid[:size,:size]
u,v = (x+.5)/size,(y+.5)/size
rng = np.random.default_rng(3813)
album=Image.new('RGB',(2048,2048),'white')


def floral(draw,i,j,r,tone):
    for a in np.arange(5)*np.pi*.4+.26:
        cx=i+.59*r*np.cos(a);cy=j+.59*r*np.sin(a)
        draw.ellipse((cx-.33*r,cy-.39*r,cx+.33*r,cy+.39*r),fill=tone)
    draw.ellipse((i-r*.20,j-r*.20,i+r*.20,j+r*.20),fill='#F1CF8B')


for number in range(2,13):
    h=np.cos(2*np.pi*(x/5.3+.18*np.sin(y/6.1)))
    w=np.sin(2*np.pi*(y/4.1+.15*np.sin(x/5.9)))
    base=246+1.5*h+1.8*w+rng.normal(0,.9,(size,size))
    if number in (2,5,9):
        base+=2.0*np.sin((x+.54*y)*2*np.pi/8)
    if number==3:
        base-=9*np.maximum(0,np.cos(2*np.pi*u*17))**9
    if number==4:
        base-=12*v+4*np.cos(x*.049+y*.04)
    if number in (5,6,11):
        base-=10*((x%43)<3)+8*((y%43)<3)+4*((x%43)>35)
    if number==7:
        base+=4*np.cos(2*np.pi*x/12)+3*np.cos(2*np.pi*y/8+1.9*np.cos(x*.61))
    if number==8:
        base-=8*(.5+.5*np.cos(.19*x+.17*y))**7
    if number==10:
        base-=5*(x%23<2)+4*(y%23<2)
    if number==12:
        tooth=((x//6+y//6)%4==0)|(((x//6)%4<2)&((y//6)%4<2))
        base-=14*tooth
    # Hand-painted folds: the central front is broad. The side seams
    # converge under the arm and open into larger, looser folds at the waist.
    hollow=(np.abs(u-.5)-.24-.06*np.cos(v*8+number))/.052
    shading=13*np.exp(-hollow**2)*np.sin(np.pi*v)**2
    val=base-shading
    img=Image.fromarray(np.uint8(np.clip(np.stack((val+1,val,val-1.6),axis=2),0,255)))
    d=ImageDraw.Draw(img)
    if number==7:   # Fair Isle yoke. The tiny crossing stitches form stepped diamonds.
        for cx in range(-28,560,28):
            for dy in range(-15,16,3):
                dx=15-abs(dy)
                for side in (-1,1):
                    px=cx+side*dx;py=122+dy
                    d.line((px-2,py-1,px,py+2,px+2,py-1),fill='#D8AE82',width=2)
            d.line((cx-6,151,cx,156,cx+6,151),fill='#C9A582',width=2)
    if number in (4,11):
        for _ in range(90 if number==11 else 45):
            cx,cy=rng.integers(0,512,2)
            if number==4 and not .09<cx/512-.38*cy/512<.26:continue
            radius=rng.integers(4,9)
            floral(d,cx,cy,radius,'#E3B7AB' if number==11 else '#E8BE81')
            d.line((cx+3,cy+3,cx+8,cy+9,cx+14,cy+9),fill='#BEC9A8',width=2)
    if number==3:
        for j in range(7):
            for i in range(10):
                cx=24+51*i+23*(j%2);cy=42+65*j
                d.arc((cx-5,cy-4,cx+5,cy+8),10,173,fill='#D6BFC6',width=2)
    if number==10:
        for k in range(5):
            d.polygon([(55+7*k,118),(59+7*k,118),(45+7*k,140),(41+7*k,140)],fill='#E4CDA3')
    album.paste(img,(((number-2)%4)*size,((number-2)//4)*size))

album.save(Path(__file__).resolve().parent/'burger/dist/art/guest-textiles.jpg',quality=94,subsampling=0,optimize=True)
