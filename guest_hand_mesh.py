"""Extract a neutral hand from the credited pixiv VRM and fit it to the diner rig."""
import base64
from io import BytesIO
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation


root = Path(__file__).resolve().parent
raw = (root / "avatar-a.vrm").read_bytes()
size = struct.unpack_from("<I", raw, 12)[0]
src = json.loads(raw[20:20+size])
binary = raw[28+size:]


def view(index):
    item = src["bufferViews"][index]
    start = item.get("byteOffset", 0)
    return binary[start:start+item["byteLength"]]


def attribute(index):
    a = src["accessors"][index]
    dtype = {5126:"<f4", 5125:"<u4", 5123:"<u2", 5121:"u1"}[a["componentType"]]
    dims = {"VEC3":3, "VEC2":2, "SCALAR":1}[a["type"]]
    return np.frombuffer(view(a["bufferView"]),dtype,count=a["count"]*dims,
                         offset=a.get("byteOffset",0)).reshape(-1,dims)


world = {}
def visit(i, parent):
    node = src["nodes"][i]
    mat = np.eye(4)
    mat[:3,:3] = Rotation.from_quat(node.get("rotation",[0,0,0,1])).as_matrix() @ np.diag(node.get("scale",[1,1,1]))
    mat[:3,3] = node.get("translation",[0,0,0])
    world[i] = parent @ mat
    for child in node.get("children",[]):
        visit(child, world[i])


for i in src["scenes"][0]["nodes"]:
    visit(i,np.eye(4))
bones = src["extensions"]["VRMC_vrm"]["humanoid"]["humanBones"]
def joint(name):
    return world[bones["left"+name]["node"]][:3,3]


def unit(v):
    return v/np.linalg.norm(v)


body = next(n for n in src["nodes"] if n["name"]=="Body")
pr = next(p for p in src["meshes"][body["mesh"]]["primitives"] if src["materials"][p["material"]]["name"]=="Body_00_SKIN")
uv = attribute(pr["attributes"]["TEXCOORD_0"])
xyz = attribute(pr["attributes"]["POSITION"])
raw_tri = attribute(pr["indices"]).reshape(-1,3)
forward = unit(joint("MiddleProximal")-joint("Hand"))
width = joint("IndexProximal")-joint("LittleProximal")
width = unit(width-forward*np.dot(width,forward))
dorsal = unit(np.cross(width,forward))
if dorsal[1]<0:
    dorsal *= -1
basis = np.column_stack([dorsal,forward,width])
local = (xyz-joint("Hand"))@basis
select = (local[:,1]>-.033)&(np.abs(local[:,2])<.11)&(np.abs(local[:,0])<.07)
tri = raw_tri[select[raw_tri].all(axis=1)]
used,idx = np.unique(tri,return_inverse=True)
verts = local[used]
assert 150<len(used)<3000
# Convert to the neutral game axes for the positive-X side. Thumb faces forward.
verts = verts*np.array([1.48,-1.34,1.47])
if np.linalg.det(basis)*-1<0:
    idx=idx.reshape(-1,3)[:,[0,2,1]]
tex = src["materials"][pr["material"]]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
image = src["images"][src["textures"][tex]["source"]]
bitmap = np.array(Image.open(BytesIO(view(image["bufferView"]))).convert("RGB"))
st = np.clip(uv[used],0,.999999)*[bitmap.shape[1],bitmap.shape[0]]
pixels = bitmap[st[:,1].astype(int),st[:,0].astype(int)].astype(float)
pigment = np.clip(pixels/np.percentile(pixels,80,axis=0),.65,1.09)
def pack(a,dt):
    return base64.b64encode(np.asarray(a,dtype=dt).tobytes()).decode("ascii")

output=root/"burger/dist/hand-form.js"
output.write_text("// Adapted from pixiv's VRM1_Constraint_Twist_Sample. See vendor/Guest-credits.txt.\n"+
    "window.DinerHandForm="+json.dumps({"points":pack(np.round(verts*1e5),"<i2"),
    "triangles":pack(idx,"<u2"),"tone":pack(np.round(pigment*230),"u1")},separators=(",",":"))+";\n","utf8")
print(len(verts),"vertices;",len(tri),"triangles;",np.round(verts.min(0),3),np.round(verts.max(0),3))
