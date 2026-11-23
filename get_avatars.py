from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests, time, struct

base=Path(__file__).resolve().parent
specs=[
 ('a','https://raw.githubusercontent.com/pixiv/three-vrm/release/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm',10776032),
 ('b','https://raw.githubusercontent.com/pixiv/ChatVRM/main/public/AvatarSample_B.vrm',21047556)]
def retrieve(spec):
 key,url,size=spec
 dest=base/('avatar-'+key+'.vrm')
 if dest.exists() and dest.stat().st_size==size:return
 def block(rng):
  start,end=rng
  for attempt in range(4):
   try:
    r=requests.get(url+'?part='+str(start),headers={'Range':f'bytes={start}-{end}','Accept-Encoding':'identity'},timeout=(10,45))
    r.raise_for_status()
    if len(r.content)==size:return r.content[start:end+1]
    if r.headers.get('Content-Range','').startswith(f'bytes {start}-{end}/') and len(r.content)==end-start+1:return r.content
    raise ValueError((r.status_code,len(r.content),r.headers.get('Content-Range')))
   except Exception:
    if attempt==3:raise
    time.sleep(1.2)
 with ThreadPoolExecutor(max_workers=5) as pool:
  chunks=pool.map(block,[(i,min(size-1,i+524287))for i in range(0,size,524288)])
  data=b''.join(chunks)
 assert data[:4]==b'glTF' and struct.unpack_from('<I',data,8)[0]==len(data)==size
 dest.write_bytes(data);print(key,len(data),flush=True)
with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(retrieve,specs))
