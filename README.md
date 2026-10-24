# 花花弹琴：发布与安装说明

花花弹琴是《光·遇》的 iOS 弹琴插件。本站提供 **新版本 MuCore** 和 **0.1-1 免费版**。免费版客户端公告说明曲目有限，且不会持续更新。

项目访问地址：[https://muios.bbroot.com](https://muios.bbroot.com)。请从本站下载与自己设备环境对应的文件。

## 新版本 MuCore

- [查看新版本页面、验证密钥与使用截图](https://muios.bbroot.com/new-version/)
- [直接下载 MuCore.dylib](https://muios.bbroot.com/downloads/MuCore.dylib)

MuCore 是单独提供的 arm64 dylib。下载后请在兼容的注入工具中选择目标游戏并导入；打开插件后按界面提示输入页面公开展示的验证密钥。本站无法查询密钥是否已使用或失效。下面的 deb 属于 **0.1-1 免费版**，不包含 MuCore。

## 免费版下载文件

免费版界面截图和坐标教程见 [免费弹琴页面](https://muios.bbroot.com/free-version/)。

| 使用环境 | 文件 | 直接下载地址 |
| --- | --- | --- |
| TrollStore（巨魔）配合 dylib 注入工具 | `弹琴永久免费版.dylib` | [下载 dylib](https://muios.bbroot.com/downloads/%E5%BC%B9%E7%90%B4%E6%B0%B8%E4%B9%85%E5%85%8D%E8%B4%B9%E7%89%88.dylib) |
| 已越狱的无根环境（如 Dopamine） | `cn.muios.MuIos_0.1-1_iphoneos-arm64.deb` | [下载 deb](https://muios.bbroot.com/downloads/cn.muios.MuIos_0.1-1_iphoneos-arm64.deb) |

两个文件对应同一版免费插件。deb 包内的 `MuIos-free.dylib` 与单独下载的 dylib 内容一致。**不要把 deb 当作普通 IPA 用 TrollStore 安装；也不需要在同一游戏里同时使用两种方式。**

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
4. 按注入工具提示完成注入；完全退出游戏后重新打开。进入游戏后查找悬浮图标，点击图标可打开弹琴菜单。首次点击可能先显示免费版公告，关闭公告后再点击图标。
5. 如果游戏更新或重新安装后插件消失，按注入工具的提示重新注入。注入工具的菜单名称可能因版本不同而变化。

<span id="rootless"></span>

## 方法二：无根越狱安装 deb

此文件的架构是 `iphoneos-arm64`，安装路径在 `/var/jb/Library/MobileSubstrate/DynamicLibraries/`，适用于已配置兼容注入环境的无根越狱设备。**这是本页的越狱安装文件地址：** [下载 arm64 deb](https://muios.bbroot.com/downloads/cn.muios.MuIos_0.1-1_iphoneos-arm64.deb)。未越狱设备请使用上面的 dylib 方案。

1. 先确认设备已处于无根越狱状态，并且包管理器和 tweak 注入环境正常可用。
2. 下载 **`cn.muios.MuIos_0.1-1_iphoneos-arm64.deb`**，在设备的文件管理器里用 Sileo、Zebra 或当前环境提供的包管理器打开，并确认安装。若提示缺少 `mobilesubstrate` 兼容依赖，请先按所用越狱环境的要求解决依赖，不要强制安装。
3. 安装完成后，按包管理器提示重启用户空间或完全退出并重新打开《光·遇》。插件随包附带的 `MuIos-free.plist` 会按上表的包名筛选目标游戏。
4. 进入游戏后点击悬浮图标打开菜单。若未出现，先核对游戏包名、越狱注入开关、依赖以及插件是否已由包管理器安装成功。

不要下载旧的 `iphoneos-arm` 包替代这里的无根 `iphoneos-arm64` 包。卸载时请通过包管理器移除 `cn.muios.MuIos`。

## 免费版获取琴键坐标

在《光·遇》打开 15 键乐器后，打开免费版菜单，点击右上角关闭按钮左侧的坐标图标，并在提示框中选择「光 遇」。接下来依次点击 **左上角第一个琴键的中心**、**右下角最后一个琴键的中心**。出现「坐标获取完毕」提示后点「确定」，插件会计算其余琴键坐标。若自动弹琴位置偏移，请按相同顺序重新获取。图示和截图见 [免费弹琴页面](https://muios.bbroot.com/free-version/#coordinates)。

## 琴谱浏览与长图导出

首页中间会随机展示几张琴谱卡片；点击卡片可以打开对应谱子，点「换一批」可重新挑选。完整曲库见 [琴谱页面](https://muios.bbroot.com/archive/)。在谱子详情页点击「导出格子谱长图」，可将 15 键谱面保存为一张长图：普通曲目下载 PNG，超过浏览器画布可靠高度的长曲下载 SVG 矢量长图。SVG 可在浏览器中打开、放大或打印，且会保留整首曲子的全部格子。

## 常见问题

- **看不到悬浮图标**：确认已彻底重启游戏进程，游戏包名与上表一致；巨魔方案检查注入记录，越狱方案检查包管理器和 tweak 注入环境。
- **点击后先出现公告**：这是当前免费版的启动提示；关闭后再次点击图标。
- **谱子加载失败**：先检查网络，再访问 [本站琴谱](https://muios.bbroot.com/archive/) 确认站点可用。免费版的曲目范围以客户端实际显示为准。
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
├── images/new-version/（8 张新版本截图）
└── images/free-version/（免费版主页截图）
```

`dist/README.md` 由本安装说明在每次构建时复制生成。`CNAME` 用于 GitHub Pages 的自定义域名，`.nojekyll` 用于保留 `_astro/` 下的静态资源。将整个 `dist/` 部署到公开的 GitHub Pages 项目或静态托管目录，并把 `muios.bbroot.com` 指向该站点，页面和下载链接才能同时生效。下次替换发布文件时，请同步更新下载文件名与本说明后重新构建。

游戏及商标属于各自权利人。插件、注入器与越狱环境的兼容性取决于设备、系统、游戏和工具版本。
