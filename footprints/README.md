# Footprints · vi 的生活与技术

“足迹”的英文译名是 **Footprints**。这是 vi 的个人博客，包含生活随笔和技术手记两类内容。

## 本地运行

使用 Node.js 22.13 或更新版本，安装依赖后运行：

    npm install
    npm run db:generate
    npm run dev

开发预览地址为 http://127.0.0.1:5173。Ctrl+C 停止本地服务器。

静态基准检查、前后端交互测试和正式构建：

    npm run build:static
    npm run check
    npm test
    npm run build

测试使用 jsdom 和 Node.js SQLite，覆盖真实业务路由与 SQL。开发服务器的作者模拟账号为 `seedy@sites.test`，在未跟踪的 `.env` 中设置 `AUTHOR_EMAIL=seedy@sites.test` 后通过本地登录入口使用。正式环境的作者邮箱由 Sites 环境变量设置，生产运行时只信任平台认证身份。

本地 D1 数据与正式数据独立。首次预览需要按 Sites 模板说明应用 `drizzle/0000_gigantic_zeigeist.sql`，正式部署由平台应用迁移；不要在请求处理中建表。

Windows 如 npm 命令包装器不能正确解析路径，可用 `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"` 执行相同 npm 命令。

## 更新博客

在网站导航中点击 **写作**，使用当前博客作者的 ChatGPT 账号登录，即可直接新增文章。填写标题、分类、正文，可选摘要、日期、标签、封面和文章地址。

- **保存草稿**：写入云端 D1 数据库，换设备登录后仍可以继续写；未发布草稿不进入公开列表或搜索。
- **预览**：查看阅读页面，不会保存或发布。
- **发布文章**：文章立即进入首页、搜索、归档、RSS 和站点地图，无需重新部署。
- 修改已发布文章时，**保存草稿**保留私密修改；点击 **更新发布**才替换公开版本。
- **导出文字**下载当前编辑内容的 JSON 备份。断网时也有本地恢复提示；本地备份不能代替云端保存。
- **取消发布**保留草稿并撤下公开文章；删除仅允许未发布草稿，操作前会再次确认。
- 多窗口同时编辑时使用版本检查，过时版本不会覆盖较新内容；请先导出文字，再重新打开文章。
- 文章地址在首次保存后固定。当前支持选择现有的五张封面；图片上传暂未实现。

初始示例文章保留在 `content/posts.mjs`；下列说明用于修改网站源码和示例内容：

- 修改 content/site.json：博客名称、作者、介绍和正式域名。
- 修改 content/posts.mjs：每篇文章的标题、路径、日期、分类、摘要、标签、图片和正文。life 是生活随笔，tech 是技术手记。
- 初始的 8 篇文章均为**示例**。替换为自己的内容后，将对应 demo 设置为 false，示例提示会自动消失。
- 正文由 sections 组成。每节支持标题、多个自然段以及可选的代码块。
- 图片存放在 src/assets；图像署名如下。
- 页面样式和交互分别在 src/style.css、src/app.js；写作工作台在 src/editor.css、src/editor.js。纯渲染模块在 lib/render.mjs；业务路由与权限在 lib/server.mjs。
- 改完运行上述检查与构建，然后在本对话要求重新部署。dist 和 public 下的前端资源均为构建产物，不要手动修改。

## 已实现

响应式首页、独立文章地址、文章目录与阅读进度、分类筛选、分页展开、全文搜索、键盘搜索（Ctrl/⌘ K）、收藏与收藏检索、明暗主题、本地偏好保存、归档、作者介绍、文章分享、代码复制、RSS、站点地图、404 页面、搜索与社交分享元信息。

收藏和主题设置保存在访客的浏览器中。作者写作使用 ChatGPT 登录，新增文章与草稿持久保存在 D1。项目没有访客注册或评论服务。

## 公网部署

通过 Sites 托管，服务器采用官方 Vinext / Cloudflare Workers 模板。`.openai/hosting.json` 保留原项目 ID，并声明 D1 的 `DB` 绑定。`sites()` 构建集成负责部署元数据与 Drizzle 迁移，继续更新时应复用同一 project_id。

本站保持 **public**；作者的写作权限由服务器单独检查。源码凭证只通过发布助手的隐藏标准输入使用，不写入项目文件。生产 `AUTHOR_EMAIL` 是托管环境变量，不写入前端或 Git。手机网络曾出现 Cloudflare 安全层拦截，该问题不能通过修改博客代码解除，排查记录保存在未跟踪的 test-results 目录。

## 图像来源

全部为 Unsplash 上可免费下载的图片，使用本地副本保证线上访问不依赖第三方图片请求：

- lake.jpg：Tom Wheatley，[原图](https://unsplash.com/photos/body-of-water-near-trees-l9M1q8W-pyA)。
- forest.jpg：Peter Robbins，[原图](https://unsplash.com/photos/_0QWCZdgYPg)。
- coffee.jpg：Юлія Дубина，[原图](https://unsplash.com/photos/JtYm2zwrE9s)。
- desk.jpg：Esra Afşar，[原图](https://unsplash.com/photos/iRixPSVEkp8)。
- mountains.jpg：[原图](https://unsplash.com/photos/a-lake-surrounded-by-trees-and-mountains-under-a-cloudy-sky-YyNI6FCitt8)。

足迹图标为本项目原创 SVG。
