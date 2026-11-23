from base64 import b64encode
from pathlib import Path
import re
import zipfile

work = Path(__file__).resolve().parent
dist = work / "burger" / "dist"
out = work / "outputs"
out.mkdir(exist_ok=True)

def embed_script(match):
    name = match.group(1)
    data = (dist / name).read_text("utf-8")
    data = re.sub(r"</script", lambda m: r"<\/script", data, flags=re.I)
    return "<script>\n" + data + "\n</script>"

def embed_font(match):
    encoded = b64encode((dist / match.group(1)).read_bytes()).decode("ascii")
    return 'url(data:font/ttf;base64,' + encoded + ')'

html = (dist / "index.html").read_text("utf-8")
def embed_style(match):
    css = (dist / match.group(1)).read_text('utf-8')
    return '<style>\n' + re.sub(r'url\((vendor/[^)]+\.ttf)\)', embed_font, css) + '\n</style>'
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', embed_style, html)
html = re.sub(r'<script src="([^"]+)"></script>', embed_script, html)
import json
guests = {p.stem.split('-')[-1]: b64encode(p.read_bytes()).decode('ascii') for p in (dist/'guests').glob('*.glb')}
html = html.replace('<head>', '<head><script>window.DinerGuestData='+json.dumps(guests,separators=(',',':'))+';</script>', 1)
music = {p.stem:'data:audio/mpeg;base64,'+b64encode(p.read_bytes()).decode('ascii') for p in (dist/'music').glob('*.mp3')}
html = html.replace('<head>', '<head><script>window.DinerMusicData='+json.dumps(music,separators=(',',':'))+';</script>',1)
image_types={'.jpg':'image/jpeg','.png':'image/png'}
prints={p.stem.split('-')[-1]:'data:'+image_types[p.suffix]+';base64,'+b64encode(p.read_bytes()).decode('ascii') for p in (dist/'art').iterdir() if p.suffix in image_types}
html=html.replace('<head>', '<head><script>window.DinerArtData='+json.dumps(prints,separators=(',',':'))+';</script>',1)
notices = "\n\n".join(p.read_text("utf-8") for p in sorted((dist/"vendor").glob("*.txt")))
notices += "\n\n" + (dist/"music"/"CREDITS.txt").read_text("utf8")
html = html.replace("</body>", '<script type="text/plain" id="third-party-licenses">' + notices + "</script>\n</body>")
(out / "铁板汉堡社.html").write_text(html, encoding="utf-8")

with zipfile.ZipFile(out / "铁板汉堡社-源码.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for p in sorted(dist.rglob("*")):
        if p.is_file():
            archive.write(p, (Path("burger/dist") / p.relative_to(dist)).as_posix())
    for test in ["test-game.cjs", "test-smoke-special.cjs", "test-smoke-model.cjs", "test-tab-progress.cjs", "test-owner.cjs", "test-cast.cjs", "test-faces.cjs", "qa-cheese-heat/contracts.cjs", "qa-cheese-heat/shifted.cjs"]:
        archive.write(work / test, test)
    archive.write(work / "burger" / "人物美术规范.md", "burger/人物美术规范.md")
    for source in ["prepare_avatar.py", "get_avatars.py", "mia_fabric.py", "mia_portrait.py", "guest_textiles.py", "bake_portrait_mesh.py", "guest_hand_mesh.py", "garment_prints.py", "guest_hair_paint.py", "owner_paint.py", "guest_footwear.py", "music-studio/lunch_shift.py"]:
        archive.write(work / source, source)
    archive.writestr("使用说明.txt", "铁板汉堡社 / Burger Club\n\n在解压目录运行 python -m http.server 8000 --directory burger/dist，然后在浏览器打开 http://127.0.0.1:8000/。游戏资产均在本地，无需联网。重复打开同一地址时，可以选择在哪个窗口继续当前这一单。另附的单文件 HTML 可以直接双击运行。\n\n后厨备餐期间，下一位客人可先到门厅候位。交餐评分后，请候位顾客入座；若较早出餐，下一位则从街上进门。等客人坐稳后，点顾客或点桌边接单按钮，按小票煎肉和备餐；完成后送回指定桌号。打烊时可以从可用小费里花 ¥12 进烟熏酱，也可以直接开店。进货只付一次，次日开店后由回头客阿乐点第一份烟熏芝士堡。在芝士上挤烟熏酱，再盖顶包。累计小费保留历次收入。电脑支持全屏，人物手册可查看店主陆川和 13 位常客，支持旋转与面部、半身、全身三个观察距离。面部镜头按各自的脸部尺寸取景。音乐按钮可切换原创《午间出单》与 Kevin MacLeod 的 Bossa Antigua，音量可单独调节。完整授权见 burger/dist/music/CREDITS.txt。轻点配料会居中放置。拖动时，绿色标记是食材落点，松手后每层的偏移会保存在订单中。评价按配方顺序40%、火候25%、叠放整齐20%、上餐速度15%结算，旧收据保留原评分。工作台也可以用数字键 1、2、3 切换。Esc 暂停。浏览器临时丢失 3D 画面时，营业时钟会冻结，恢复后可继续本单。点近景可以拖动观察。交餐后，镜头会绕本单汉堡一圈，点“查看评分”可跳过，也可在评价页重看。特写中可点“停下细看”，拖动旋转或点“看夹层”逐层检查。顶部喇叭可开关音效，暂停菜单可调音量。\n\nlogic.js 管理订单、评分与存档。models.js 管理食材、顾客骨架、衣袖和动作。guests/ 内含前两位常客的授权改编 GLB；其他顾客与店主使用同源的脸部拓扑，由 portrait-mesh.js、guest-faces.js 和 owner-head.js 接入。头发、服装、鞋履和手部由各自的模型与贴图模块组装。人物素材授权与署名见 vendor/Guest-credits.txt。food-surfaces.js 包含食材表面贴图。scene.js 管理 3D 餐厅。audio.js 播放 audio/foley.js 中的厨房实录采样，首次操作后启声。录音来源和授权见 vendor/Audio-credits.txt。\n在解压目录运行 node test-game.cjs 可执行经营逻辑测试，运行 node test-tab-progress.cjs 可检查同一份营业存档在多窗口间接续的行为。node test-smoke-special.cjs 检查新品进货、旧档和跨天点单。node test-owner.cjs 检查店主近景、执笔接触与托盘手势。node test-faces.cjs 检查 11 位常客的眨眼、嘴部变形和独立实例，node test-cast.cjs 检查近远景、托汉堡握位与贴图首帧。新增顾客时可参照 burger/人物美术规范.md 对照实际灯光和动作。\n")
print("已生成可离线运行的单文件游戏和源码包。")
