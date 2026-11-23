"""Paint directional chestnut locks, iris fibres and soft facial tints in Mia's UVs."""
import numpy as np
from PIL import Image


def paint_portrait(image, material):
    hair = material in ('HairBack_00_HAIR', 'Hair_00_HAIR')
    eyes = material == 'EyeIris_00_EYE'
    if not (hair or eyes or material == 'Face_00_SKIN'):
        return image
    pixels = np.array(image.convert('RGBA'))
    h,w = pixels.shape[:2]
    y,x = np.mgrid[:h,:w].astype('float32')
    x/=w
    y/=h
    rgb = pixels[:,:,:3].astype('float32')
    def oval(cx,cy,rx,ry):
        return np.exp(-((x-cx)/rx)**2-((y-cy)/ry)**2)
    if hair:
        # The UV islands of the long fringe run lengthwise from root to tip.
        # Offset successive crests slightly so highlights break across locks.
        flow=x+.012*np.sin(5*y+3*x)+.008*np.sin(10*y-8*x)
        phase=2*np.pi*(flow*8+.085*np.sin(flow*31))
        locks=(.5+.5*np.cos(phase))**2
        strand=(.5+.5*np.cos(2*np.pi*flow*96+np.sin(phase*2.4)))**4
        ribbon=np.exp(-((y-.40-.065*np.cos(phase)-.045*np.sin(x*7))/.095)**2)
        broad=np.exp(-((y-.58)/.32)**2)
        light=-.055+.089*locks+.042*strand+.08*broad*locks
        rgb=rgb*(1+light[:,:,None])+((.50+.50*locks)*ribbon)[:,:,None]*[22,13,9]
    elif eyes:
        for cx in [.25,.75]:
            dx=(x-cx)/.105
            dy=(y-.51)/.253
            radius=np.hypot(dx,dy)
            angle=np.arctan2(dy,dx)
            surround=np.exp(-((radius-.67)/.24)**2)*np.clip((dy+.25)*1.6,0,1)
            fibres=(.5+.5*np.cos(24*angle+.8*np.sin(14*angle)+radius*9))**4
            rgb+=(surround*(.5+fibres))[:,:,None]*[26,18,6]
    else:
        cheeks=oval(.35,.64,.082,.045)+oval(.65,.64,.082,.045)
        nose=oval(.50,.69,.025,.022)
        lip=oval(.50,.757,.031,.011)
        rgb*=1-(cheeks*.12+nose*.065+lip*.15)[:,:,None]*[.10,.69,.78]
    pixels[:,:,:3]=np.uint8(np.clip(rgb,0,255))
    return Image.fromarray(pixels)
