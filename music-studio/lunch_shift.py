"""The 32-bar instrumental 午间出单. All voices and room reflections are original."""
from pathlib import Path
from functools import lru_cache
import numpy as np
from scipy import signal
from scipy.io import wavfile

studio = Path(__file__).parent
sr = 44100
bpm = 104
beat = 60 / bpm
bars = 32
samples = round(bars*4*beat*sr)
music = np.zeros((samples,2), dtype='float32')
rng = np.random.default_rng(7018)

def butter(wave, cutoff, mode='low', order=2):
    sos=signal.butter(order,cutoff,fs=sr,btype=mode,output='sos')
    return signal.sosfilt(sos,wave)

def freq(note):
    return 440 * 2 ** ((note-69)/12)

def release(t,off,time):
    return np.exp(-np.maximum(t-off,0)/time)

def put(wave, bar, pos, amp, pan=0, loose=0):
    # Wrap musical tails and pickups at the barline so the loop starts in its room.
    first=int(round(((bar*4+pos)*beat+loose)*sr))%samples
    signal2=(amp*wave[:,None]*np.array([np.cos((pan+1)*np.pi/4),np.sin((pan+1)*np.pi/4)])).astype('f')
    n=min(samples-first,len(wave))
    music[first:first+n]+=signal2[:n]
    if n<len(wave):music[:len(wave)-n]+=signal2[n:]

@lru_cache(maxsize=300)
def rhodes(pitch, length, touch):
    f=freq(pitch)
    t=np.arange(int(sr*(length+.70)))/sr
    phase=2*np.pi*f*t
    # A tine with a soft hammer and a tine-bar partial that dulls as it rings.
    tine=phase+(.19+.40*touch)*np.exp(-t/.22)*np.sin(phase*2.002)
    tone=(np.sin(tine)*np.exp(-t/2.0)+.23*np.sin(phase*2.005+.14)*np.exp(-t/.62)+
        .095*np.sin(phase*3.012+.4)*np.exp(-t/.37)+.052*touch*np.sin(phase*7.02)*np.exp(-t/.075))
    return (tone*(1-np.exp(-t/.005))*release(t,length,.080)).astype('f')

@lru_cache(maxsize=160)
def vibes(pitch, length):
    t=np.arange(int(sr*(length+1.4)))/sr
    p=2*np.pi*freq(pitch)*t
    partial=(np.sin(p)*np.exp(-t/1.54)+.39*np.sin(4.014*p+.4)*np.exp(-t/.14)+
        .065*np.sin(9.92*p+.1)*np.exp(-t/.058))
    return (partial*(1-np.exp(-t/.0032))*(.94+.06*np.cos(2*np.pi*5.1*t))*release(t,length,.135)).astype('f')

def bass(pitch,length):
    # Pizzicato string, including finger release and short body resonance.
    t=np.arange(int(sr*(length+.24)))/sr
    f=freq(pitch); phase=2*np.pi*f*(t+.0006*(1-np.exp(-t/.046)))
    waveform=np.zeros_like(t)
    for h in range(1,13):
        amp=np.sin(h*.21*np.pi)/(h**1.29)
        waveform+=amp*np.sin(phase*h+.07*h)*np.exp(-t*(1.10+.54*h))
    slide=butter(rng.normal(size=len(t)),(400,1250),'bandpass')*.053*np.exp(-t/.018)
    body=.063*np.sin(2*np.pi*98*t)*np.exp(-t/.036)
    return ((waveform*(1-np.exp(-t/.005))+body+slide)*release(t,length,.046)).astype('f')

def percussion(voice, variant=0):
    durations={'kick':.27,'brush':.32,'rim':.12,'hat':.11,'open':.45,'ride':.70,'swish':.42}
    t=np.arange(round(durations[voice]*sr))/sr; noise=rng.normal(size=len(t))
    if voice=='kick':
        phase=2*np.pi*(48*t+55*.029*(1-np.exp(-t/.029)))
        out=(np.sin(phase)*np.exp(-t/.068)+.21*np.sin(phase*1.64)*np.exp(-t/.023))
    elif voice=='brush':
        sand=butter(noise,(1050,7200),'bandpass')
        shell=.15*np.sin(2*np.pi*184*t)*np.exp(-t/.045)
        out=sand*(.64*np.exp(-t/.026)+.28*np.exp(-t/.085))+shell
    elif voice=='swish':
        sand=butter(noise,(1300,5700),'bandpass')
        out=sand*np.sin(np.pi*t/t[-1])**1.9*(.75+.25*np.sin(28*t+.5))
    elif voice=='rim':
        out=.6*np.sin(2*np.pi*(753+variant*13)*t)*np.exp(-t/.009)+.44*np.sin(2*np.pi*1143*t)*np.exp(-t/.014)
    else:
        decay={'ride':.18,'open':.10,'hat':.029}[voice]
        raw=butter(noise,(5100,13000),'bandpass')
        p=2*np.pi*(2860+18*variant)*t
        metal=np.sin(p+.7*np.sin(1.36*p)+.36*np.sin(.731*p))
        out=(.76*raw+.17*metal)*np.exp(-t/decay)
    return (out*(1-np.exp(-t/.0008))).astype('f')

kit={k:[percussion(k,i) for i in range(5)] for k in ('kick','brush','rim','hat','open','ride','swish')}
def drum(k,bar,at,amp,pan=0):
    put(kit[k][rng.integers(5)],bar,at,amp*rng.uniform(.94,1.05),pan,rng.normal(0,.003))

# Shell-and-colour voicings leave the low register free for the bass.
# Each chord names its bass root, walking steps, and electric-piano voicing.
harm={
 'F6': (41,[45,48,50],[57,62,64,67]), 'Dm9':(38,[41,45,44],[53,60,64,69]),
 'Gm9':(43,[46,50,49],[58,62,65,69]), 'C13':(36,[40,43,47],[58,62,64,69]),
 'Am7':(45,[48,52,49],[55,60,64,71]), 'D7':(38,[42,45,44],[54,60,64,68]),
 'Bb6':(34,[38,41,42],[53,58,62,67]), 'Bdim':(35,[38,41,44],[53,59,62,68]),
 'F/C':(36,[41,45,40],[57,60,64,67]), 'A7':(33,[37,40,39],[55,61,64,70]),
 'Eb9':(39,[43,46,48],[55,61,65,70]), 'Ab6':(32,[36,39,40],[55,60,63,65]),
 'Fm9':(41,[44,48,47],[56,60,63,67]), 'Bb13':(34,[38,41,42],[56,60,62,67]),
 'Em7b5':(40,[43,46,44],[55,58,62,65]), 'C9':(36,[40,43,40],[52,58,62,67])}
form_a=[('F6',),('Dm9',),('Gm9',),('C13',),('Am7','D7'),('Gm9',),('Bb6','Bdim'),('F/C','C9')]
form_b=[('Bb6',),('Bb13',),('Eb9',),('Ab6',),('Gm9',),('Em7b5','A7'),('Dm9','Gm9'),('C13',)]
form=form_a+form_a+form_b+form_a

# Melodic phrases are written in beats, MIDI note, held beats, with room for responses.
A=[
 [(0.58,69,.35),(1,72,.66),(2,74,.41),(2.62,72,.73)],
 [(0,69,.89),(1.64,65,.33),(2,64,.41),(2.63,65,.98)],
 [(0.60,67,.38),(1,70,.75),(2.65,74,.32),(3,77,.59)],
 [(0,76,.58),(0.67,74,.31),(1,72,1.2),(3.02,67,.46)],
 [(0.61,69,.33),(1,72,.52),(1.66,76,.35),(2.3,78,.29),(2.66,76,.32),(3,74,.67)],
 [(0,70,1.0),(1.65,69,.31),(2,67,1.12)],
 [(0.61,65,.35),(1,67,.60),(2,68,.50),(2.64,71,.35),(3,74,.72)],
 [(0,72,1.26),(2.63,67,.33),(3,64,.56)]]
B=[
 [(0,74,1.33),(1.65,72,.32),(2,70,.49),(2.63,69,.82)],
 [(0.62,68,.34),(1,65,.81),(2.63,67,.34),(3,68,.55)],
 [(0,70,.61),(0.66,73,.35),(1,77,1.22),(3,75,.75)],
 [(0.62,72,.33),(1,68,.77),(2.62,67,.34),(3,65,.74)],
 [(0,67,.56),(0.63,70,.32),(1,74,1.31),(3,72,.56)],
 [(0,70,.74),(1.61,67,.32),(2,69,.62),(2.67,73,.31),(3,76,.64)],
 [(0,77,.91),(1.67,76,.31),(2,74,.65),(3.01,70,.63)],
 [(0,69,.61),(0.64,67,.31),(1,64,.86),(2.67,62,.32),(3,64,.65)]]
melody=[list(p) for p in A+A+B+A]
melody[9]=[(0,69,.68),(1,67,.44),(1.64,65,.31),(2,64,.42),(2.65,62,.89)]
melody[11]=[(0,76,.61),(.65,74,.34),(1,72,.71),(2.67,69,.32),(3,67,.41),(3.66,64,.31)]
melody[15]=[(0,72,1),(1.65,69,.33),(2,67,.75),(3.66,72,.28)]
melody[25]=[(0,69,1.30),(1.66,67,.31),(2,65,.62),(2.67,64,.32),(3,62,.64)]
melody[29]=[(0,70,.86),(1.63,69,.31),(2,67,.59),(2.64,65,.34),(3,62,.67)]
melody[31]=[(0,72,1.1),(1.64,69,.32),(2,67,.47),(2.63,64,.33),(3,60,.63)]

for bar,(chords,phrase) in enumerate(zip(form,melody)):
    bridge=16<=bar<24
    # Sparse syncopated chords, with little variations in the left hand.
    onsets=[(.01,.58),(1.66,.45),(3.63,.33)] if bar%2==0 else [(.66,.49),(2.0,.77)]
    if len(chords)==2:onsets=[(.04,.67),(1.59,.36),(2.06,.73),(3.63,.32)]
    for tick,hold in onsets:
        ch=chords[int(len(chords)==2 and tick>=2)]
        notes=harm[ch][2]
        for j,note in enumerate(notes):
            put(rhodes(note,round(hold*beat,2),.50),bar,tick,.068*rng.uniform(.87,1.11),-.31+.105*j,rng.normal(.003*j,.004))
    # Upright bass leans back slightly while the top line plays ahead.
    for t in range(4):
        chord=chords[int(len(chords)==2 and t>=2)]
        root,walk,_=harm[chord]
        if t==0 or (len(chords)==2 and t==2):n=root
        elif t==3:n=harm[form[(bar+1)%bars][0]][0]+(1 if (bar%3) else -1)
        else:n=walk[t-1]
        if not bridge and t==1 and bar%4==1: continue
        put(bass(n,(.67 if t%2 else .79)*beat),bar,t,.292 if t in (0,2) else .24,-.055,rng.normal(.009,.004))
    for at,n,d in phrase:
        if bridge or 8<=bar<16:
            put(rhodes(n,round(d*beat,2),.91),bar,at,.201,.13,rng.normal(0,.005))
            if bridge and (d>.7 or at==0):
                put(vibes(n,round(.65*d*beat,2)),bar,at,.049,.31,.008)
        else:
            put(vibes(n,round(d*beat,2)),bar,at,.182,.16,rng.normal(0,.004))
    # Short answers in the holes between phrases, answered by the other timbre.
    if bar in (1,5,13,17,25,29):
        for j,n in enumerate(([77,74] if bar%8==1 else [74,70])):
            wave=(vibes if 8<=bar<24 else lambda note,ln:rhodes(note,ln,.48))(n,.14)
            put(wave,bar,3.21+j*.43,.084,-.28)
    for t in range(4):
        drum('ride' if bridge or bar>=24 else 'hat',bar,t,.041 if t%2==0 else .055,.37)
        if t in (1,3):
            drum('open' if (bar%4==3 and t==3) else 'hat',bar,t+.655,.029,.31)
            drum('brush',bar,t+.018,.065 if t==1 else .075,-.32)
        if t==0 or (t==2 and bar%4!=3):drum('kick',bar,t,.155 if t==0 else .120,-.02)
    if bar%2==1:drum('swish',bar,2.17,.032,-.42)
    if bar%4==3:
        for at,a in ((2.66,.030),(3.32,.044),(3.66,.051)):drum('brush',bar,at,a,-.28)
    if bar%8 in (2,6):drum('rim',bar,3.65,.040,-.28)

# Warm studio early reflections and filtered stereo room bloom.
def wrap_delay(stereo,time):
    return np.roll(stereo,round(time*sr),axis=0)
room = np.zeros_like(music)
for offset,level,flip in [(.027,.078,True),(.043,.053,False),(.061,.047,True),(.083,.035,False),(.117,.032,True),(.163,.018,False),(.213,.010,True)]:
    room+=wrap_delay(music[:,::-1] if flip else music,offset)*level
for side in range(2):
    room[:,side]=butter(room[:,side],(185,5200),'bandpass')
music+=room
music=np.tanh(music*1.24)/1.24
wavfile.write(studio/'original-mix.wav',sr,music.astype('f'))
print(f'{bars} bars at {bpm} BPM, {samples/sr:.3f}s stereo')
