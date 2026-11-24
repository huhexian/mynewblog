# Icy 主题迁移说明

修复日期：2026-11-24。桌面 mynewblog-icy-test 是可用副本，原 mynewblog 没有修改。

## 本地预览

在终端执行：

```shell
cd ~/Desktop/mynewblog-icy-test
hugo server -D
```

打开终端给出的地址，默认 http://localhost:1313/。本次检查用 http://localhost:1314/。
如果默认端口被占用，运行 hugo server -D --port 1314。
-D 包含草稿；正式构建不要加 -D。

## 正式构建

```shell
hugo --minify --panicOnWarning --cleanDestinationDir
```

public 是构建产物。上线前使用上述命令重新生成，避免预览时的草稿进入发布目录。
本次没有发布到线上，也没有提交或推送 Git。

## 修复内容

- 启用 themes/hugo-theme-icy，文章栏目设为 blog，保留原 .html 文章链接和 /feed.xml。
- 迁移中文、图片块、目录、分页、RSS 20 条、搜索页、站点图标和 GoatCounter 统计配置。
- 旧首页及旧主题专用 head 模板移到 migration-backup，使用 Icy 原生首页。
- 修正 lunarbar.md 和 weekly-report-13-2026.md 中两处嵌套错误的 Markdown 链接。原文备份在 migration-backup。
- 旧 public 中存在名为 .html 的目录，导致 Hugo 写入同名文件失败。旧 public 已整体保存在 migration-backup/public-before-icy。
- 所有兼容改动均放在站点 layouts 内，Icy 源码保持原样。

## 历史图片

35 篇文章共 174 处本地图片引用找不到文件，清单是 missing-images.json。抽查线上旧图片返回 404，因此没有把错误页面当成图片下载，也没有用虚构图片代替。

缺图位置显示“图片暂缺”。找回图片后，把文件放入 static/images/ 下对应位置，重新构建即可恢复显示。文章原有图片引用保留。

params.legacyMissingImages = true 控制缺图兼容；改为 false 后，缺图会重新阻止构建。
params.remoteImagesAtBuild = false 让图床图片由浏览器直接加载，避免构建逐张下载。图床图片不生成 Icy 的响应式缩略图或预留尺寸；显示仍依赖原图床可访问。

这两个参数来自站点的 layouts/_partials/func/resolve-media.html 覆盖模板。更新主题时要核对上游模板变化。

Bearneo 的点赞参数和 custom.css 使用旧主题结构，未直接套到 Icy；文件和旧配置仍在副本及备份中。

## 已验证

- Hugo 0.164.0：包含草稿的严格构建成功，无警告。
- 正式压缩构建成功，无警告；Icy 封存验证通过，本站没有受保护文章。
- hugo server -D 成功启动。
- 浏览器检查桌面浅色、手机深色首页和文章；搜索“博客”正常返回结果。
- RSS 保留 /feed.xml，包含 20 条。
- 原文仅修正上述两处链接，原 Icy 主题文件与副本逐字节相同。
