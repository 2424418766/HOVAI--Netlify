# HOVAI — Netlify project

这是 HOVAI / 张活海摄影作品网站的可直接部署版本。

## 目录

- `public/`：网站前台、后台和作品图片
- `netlify/functions/`：内容保存、登录、媒体分块上传与读取
- `netlify/lib/`：后台数据、认证和 Netlify Blobs 封装
- `netlify.toml`：Netlify 构建配置
- `package.json`：Node / Netlify Blobs 依赖

## 直接部署到 Netlify

### 1. 上传到 GitHub

把本 ZIP 解压后，**将里面的文件直接放到 GitHub 仓库根目录**。仓库根目录应该直接看到：

```text
package.json
netlify.toml
public/
netlify/
README.md
```

不要再多套一层目录。

### 2. 连接 Netlify

在 Netlify 中选择现有站点或新建站点，然后连接刚才的 GitHub 仓库。

本项目已经包含 `netlify.toml`，Netlify 会自动读取：

```text
Build command: npm run build
Publish directory: public
Functions directory: netlify/functions
Node: 22
```

通常不需要手动填写。

### 3. 如果要使用 EDIT 后台

在 Netlify：

`Project configuration → Environment variables`

添加：

```text
ADMIN_PASSWORD=你自己的后台密码
SESSION_SECRET=至少 24 位、建议 32 位以上的随机字符串
```

保存后重新 Deploy。

后台地址：

```text
https://你的域名/admin.html
```

如果不配置这两个变量，网站前台仍然可以正常运行，只是 EDIT 后台不会开放登录。

## 内容与图片

首页包含 4 个入口：

1. Still Life / 静物
2. People & Still Life / 人与静物
3. Fashion / 时装
4. Past Works / 更多案例

首页 3 秒自动轮播；桌面端支持悬停切换，移动端保留独立入口列表。

后台可以修改分类封面、桌面/手机封面、项目、排序、图片旋转、跨项目移动、About 内容、更多案例，并支持图片/视频上传。图片上传会在浏览器端自动转为较高质量 WebP，避免直接上传超大原图拖慢网站。

## 图片清晰度

静态作品图片不会经过 Netlify 的二次代码压缩。当前项目使用 WebP 作品文件，并把静态图片缓存时间控制为 1 天，避免你以后重新部署同名图片时浏览器长期显示旧版本。

若以后希望首页大图达到更高的 4K 屏显示精度，可直接在 `public/assets/` 替换对应同名文件，或在后台上传更高分辨率版本。

## 本地检查

```bash
npm install
npm run build
```

构建检查通过后即可推送到 GitHub。
