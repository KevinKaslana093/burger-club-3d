# 铁板汉堡社 · Burger Club 3D

一家开在海边的 3D 汉堡店。等顾客坐稳，到桌边记单，把肉饼两面煎好，按小票叠汉堡，再把餐盘送回客人的桌边。客人会按配料顺序、火候、叠放整齐度和上餐速度评分并付小费。

**[浏览器试玩](https://kevinkaslana093.github.io/burger-club-3d/)** · **[下载离线单文件 HTML](https://github.com/KevinKaslana093/burger-club-3d/releases/latest/download/burger-club-3d.html)**

![打烊进货、阿乐点单、挤酱和成品拆层](preview/smoked-cheeseburger.jpg)

## 第一次开店

- 第一天接三单。在煎烤台等指针进入绿区，翻面，再等另一面进入绿区后出锅。轻点配料可以居中放置，也可以拖动调整落点。
- 打烊时可用 ¥12 小费进烟熏酱。次日，阿乐会点黑板上的烟熏芝士堡。把酱挤在芝士上，再盖顶包。交餐后的 360° 特写可以暂停、旋转和拆层。
- 人物手册可以近看店主陆川和 13 位常客。电脑支持全屏，数字键 1、2、3 切换工作台，Esc 暂停。营业进度保存在当前浏览器。

## 本地运行

游戏使用 Three.js，模型、字体、音效和两首配乐都随项目提供。下载 Release 的 HTML 后，用浏览器打开即可离线游玩。运行源码时，在仓库根目录执行以下命令，再打开 <http://127.0.0.1:8000/>。

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory burger/dist
```

## 开发与验证

游戏入口是 `burger/dist/index.html`。订单、评分和存档在 `logic.js`，餐厅和角色在 `scene.js`、`models.js` 及其相邻模块。经营和新品回归可在仓库根目录用 Node.js 运行。

```sh
node test-game.cjs
node test-smoke-special.cjs
node test-smoke-model.cjs
node test-tab-progress.cjs
```

运行 `python export_game.py` 可在仓库内的 `outputs/` 生成离线版与源码包。GitHub Pages 从 `gh-pages` 分支根目录发布。更新 `main` 的游戏文件后，可用 `git subtree push --prefix=burger/dist origin gh-pages` 同步试玩版。

## 素材署名

角色原型及其改编、厨房录音、音乐、字体和 Three.js 各有相应许可，详见[角色署名](burger/dist/vendor/Guest-credits.txt)、[音效署名](burger/dist/vendor/Audio-credits.txt)、[配乐署名](burger/dist/music/CREDITS.txt)及[随附许可文件](burger/dist/vendor/)。
