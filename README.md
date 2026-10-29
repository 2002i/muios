# 弹琴助手：发布与安装说明

弹琴助手是《光·遇》的 iOS 弹琴插件，提供游戏内自动弹琴等功能。本站将两个版本统一命名为 **弹琴助手 · 新版（MuCore）** 和 **弹琴助手 · 经典版（0.1-1）**。经典版免费提供，客户端公告说明曲目有限，且不会持续更新。下载文件名、截图及客户端内部标题保留原有名称。

项目访问地址：[https://muios.bbroot.com](https://muios.bbroot.com)。请从本站下载与自己设备环境对应的文件。

## 弹琴助手 · 新版（MuCore）

- [查看新版页面、验证密钥与使用截图](https://muios.bbroot.com/new-version/)
- [直接下载 MuCore.dylib](https://muios.bbroot.com/downloads/MuCore.dylib)

新版以 `MuCore.dylib` 单独提供，架构为 arm64。下载后请在兼容的注入工具中选择目标游戏并导入；打开插件后按界面提示输入页面公开展示的验证密钥。本站无法查询密钥是否已使用或失效。下面的 deb 属于 **经典版（0.1-1）**，不包含 MuCore。

## 经典版下载文件

经典版界面截图和坐标教程见 [经典版页面](https://muios.bbroot.com/free-version/)。

| 使用环境 | 文件 | 直接下载地址 |
| --- | --- | --- |
| TrollStore（巨魔）配合 dylib 注入工具 | `弹琴永久免费版.dylib` | [下载 dylib](https://muios.bbroot.com/downloads/%E5%BC%B9%E7%90%B4%E6%B0%B8%E4%B9%85%E5%85%8D%E8%B4%B9%E7%89%88.dylib) |
| 已越狱的无根环境（如 Dopamine） | `cn.muios.MuIos_0.1-1_iphoneos-arm64.deb` | [下载 deb](https://muios.bbroot.com/downloads/cn.muios.MuIos_0.1-1_iphoneos-arm64.deb) |

两个文件对应经典版的同一版本，均免费提供。deb 包内的 `MuIos-free.dylib` 与单独下载的 dylib 内容一致。**不要把 deb 当作普通 IPA 用 TrollStore 安装；也不需要在同一游戏里同时使用两种方式。**

## 支持的游戏标识符

当前 deb 的注入过滤配置包含以下《光·遇》包名。巨魔注入时请在工具里选择设备上实际安装的游戏，核对其包名：

| 游戏包名 | 说明 |
| --- | --- |
| `com.tgc.sky.ios` | 《光·遇》国际服 |
| `com.netease.sky` | 《光·遇》国服 |

包内还配置了 `com.nival.wtlm` 和 `com.Map.Ios`。本页的游戏操作步骤以截图中的两个《光·遇》包名为准。若游戏重装、渠道变化或包名不同，请先确认实际包名；包名不匹配时插件不会进入目标游戏。

<span id="trollstore"></span>

## 方法一：TrollStore（巨魔）注入 dylib

1. 确认设备已安装可用的 TrollStore 和兼容的 dylib 注入工具，例如 [TrollFools（巨魔注入器）](https://github.com/Lessica/TrollFools)。TrollStore 负责应用安装；单靠 TrollStore 本身不能把这个 dylib 注入游戏。
2. 在设备上下载上面的 **`弹琴永久免费版.dylib`**，保存到“文件”App 中。无需解压，也不要更改扩展名。
3. 打开注入工具，选择设备上已经安装的《光·遇》。对照上表确认是 `com.tgc.sky.ios` 或 `com.netease.sky`，然后从“文件”App 导入该 dylib。
4. 按注入工具提示完成注入；完全退出游戏后重新打开。进入游戏后查找悬浮图标，点击图标可打开弹琴菜单。首次点击可能先显示经典版公告，关闭公告后再点击图标。
5. 如果游戏更新或重新安装后插件消失，按注入工具的提示重新注入。注入工具的菜单名称可能因版本不同而变化。

<span id="rootless"></span>

## 方法二：无根越狱安装 deb

此文件的架构是 `iphoneos-arm64`，安装路径在 `/var/jb/Library/MobileSubstrate/DynamicLibraries/`，适用于已配置兼容注入环境的无根越狱设备。**这是本页的越狱安装文件地址：** [下载 arm64 deb](https://muios.bbroot.com/downloads/cn.muios.MuIos_0.1-1_iphoneos-arm64.deb)。未越狱设备请使用上面的 dylib 方案。

1. 先确认设备已处于无根越狱状态，并且包管理器和 tweak 注入环境正常可用。
2. 下载 **`cn.muios.MuIos_0.1-1_iphoneos-arm64.deb`**，在设备的文件管理器里用 Sileo、Zebra 或当前环境提供的包管理器打开，并确认安装。若提示缺少 `mobilesubstrate` 兼容依赖，请先按所用越狱环境的要求解决依赖，不要强制安装。
3. 安装完成后，按包管理器提示重启用户空间或完全退出并重新打开《光·遇》。插件随包附带的 `MuIos-free.plist` 会按上表的包名筛选目标游戏。
4. 进入游戏后点击悬浮图标打开菜单。若未出现，先核对游戏包名、越狱注入开关、依赖以及插件是否已由包管理器安装成功。

不要下载旧的 `iphoneos-arm` 包替代这里的无根 `iphoneos-arm64` 包。卸载时请通过包管理器移除 `cn.muios.MuIos`。

## 经典版获取琴键坐标

在《光·遇》打开 15 键乐器后，打开经典版菜单，点击右上角关闭按钮左侧的坐标图标，并在提示框中选择「光 遇」。接下来依次点击 **左上角第一个琴键的中心**、**右下角最后一个琴键的中心**。出现「坐标获取完毕」提示后点「确定」，插件会计算其余琴键坐标。若自动弹琴位置偏移，请按相同顺序重新获取。图示和截图见 [经典版页面](https://muios.bbroot.com/free-version/#coordinates)。

## 琴谱浏览与长图导出

首页中间会随机展示几张琴谱卡片；点击卡片可以打开对应谱子，点「换一批」可重新挑选。完整曲库见 [琴谱页面](https://muios.bbroot.com/archive/)。在谱子详情页选择「格子谱」或「数字谱」，再点「导出」，可将当前谱面保存为一张完整长图：普通曲目下载 PNG，超过浏览器画布可靠尺寸的长曲下载 SVG 矢量长图。数字谱可通过「排版」调整每行拍数、拍长及导出宽度，预览和导出均跟随当前主题配色。SVG 可在浏览器中打开、放大或打印，且会保留整首曲子的全部谱面。

## 导入自己的琴谱

打开 [导入转换](https://muios.bbroot.com/convert/)，选择文件、拖入文件，或粘贴谱子内容。支持含 `songNotes` 的 JSON、`A1/B3/C2` 格式的 ABC 按键文本，以及 `a-o,delay` 格式的 MUIOS 文本；ABC 按键文本不等同于标准 ABC 乐谱。文件在浏览器本地处理，单个文件最大 5 MB。

转换后可以切换格子谱与数字简谱、调整数字谱排版、导出 PNG / SVG 长图，或下载转换后的 TXT。页面不展示转换后的原始文本。点击「加入播放器」可将转换结果加入当前播放列表，使用播放、暂停、上一首、下一首及音色切换；点击播放列表中的曲名可进入详情页并播放，在格子谱与数字简谱之间切换，查看高亮琴键和移动的播放指示线。导入曲目与播放列表保存在当前浏览器，切换页面或刷新后仍可继续使用；如果本地存储不可用或已满，播放器会提示仅在当前会话保留。

详情页中的长格子谱每页显示 100 组音符，可以翻页、跳转页码或回到当前播放位置；图片导出仍包含整首琴谱。相同导入内容重新转换后，会同步更新播放列表中的名称和基准拍长，不重复加入，也不会中断正在播放的音乐。曲中空拍始终保留时长；开头空拍无法用目标格式表示时，会给出明确提示。

## 常见问题

- **看不到悬浮图标**：确认已彻底重启游戏进程，游戏包名与上表一致；巨魔方案检查注入记录，越狱方案检查包管理器和 tweak 注入环境。
- **点击后先出现公告**：这是当前经典版的启动提示；关闭后再次点击图标。
- **谱子加载失败**：先检查网络，再访问 [本站琴谱](https://muios.bbroot.com/archive/) 确认站点可用。经典版的曲目范围以客户端实际显示为准。
- **下载失败**：可直接复制上表的下载地址到 Safari；部署时需将整个 `dist/` 目录上传，包含 `downloads/` 和本说明 `README.md`。

## 发布与部署

站点源代码位于 fuwari 项目。执行 `pnpm build` 后，静态站生成到 `dist/`：

```text
dist/
├── CNAME
├── .nojekyll
├── index.html
├── install/index.html
├── free-version/index.html
├── new-version/index.html
├── plugins/index.html
├── archive/index.html
├── posts/index.html
├── README.md
├── 15/（随机文件名的 15 键琴谱 txt 文件）
├── score-index.json（曲名与随机文件名清单）
├── js/score-export.js
├── downloads/
│   ├── MuCore.dylib
│   ├── 弹琴永久免费版.dylib
│   └── cn.muios.MuIos_0.1-1_iphoneos-arm64.deb
├── images/new-version/（8 张新版截图）
└── images/free-version/（经典版主页截图）
```

`dist/README.md` 由本安装说明在每次构建时复制生成。`CNAME` 用于 GitHub Pages 的自定义域名，`.nojekyll` 用于保留 `_astro/` 下的静态资源。将整个 `dist/` 部署到公开的 GitHub Pages 项目或静态托管目录，并把 `muios.bbroot.com` 指向该站点，页面和下载链接才能同时生效。下次替换发布文件时，请同步更新下载文件名与本说明后重新构建。

游戏及商标属于各自权利人。插件、注入器与越狱环境的兼容性取决于设备、系统、游戏和工具版本。
