# Footprints · vi — Cloudflare 版

Footprints 是 vi 的个人博客，主题为生活与技术。此目录是可独立部署到 vi 自己 Cloudflare 账号的版本。原 ChatGPT Sites 网站保留在相邻的 `../footprints` 目录。

## 公网域名

- 博客：https://footprints-vi.de5.net/
- 写作：https://footprints-vi.de5.net/write/
- 作者登录：https://footprints-vi.de5.net/author/login

免费子域名在 vi 的 DNSHE 账户下注册，当前到期时间为 2027-10-14 00:12（UTC+8）。DNSHE 当前提供到期前 180 天内免费续期，实际操作以控制台届时的规则为准。

域名已委派给 vi 自己的 Cloudflare 免费解析区，DNS 服务器为 `josephine.ns.cloudflare.com` 和 `maxim.ns.cloudflare.com`。Workers Custom Domain 绑定到现有 `footprints-vi` 服务，Cloudflare 自动管理 HTTPS 证书。`wrangler.jsonc` 保留域名路由，后续部署会继续使用同一地址。

新域名仍使用现有 D1 数据库和作者密码；在新地址登录时需要重新输入已设置的作者密码。手机真实流量网络的可达性须用手机复测，桌面浏览器模拟不能代替运营商网络。

## 运行方式

- 前端：HTML、CSS、原生 JavaScript，沿用原站界面、手机布局、搜索、分类、收藏和深色模式。
- 后端：Cloudflare Worker，esbuild 打包原生 ES 模块；静态图片、字体和脚本由 Workers Static Assets 提供。
- 文章：Cloudflare D1 数据库，保存草稿和公开版本；编辑已发布文章时，草稿不会自动改变公开内容。
- 作者登录：独立作者密码，PBKDF2 散列、签名会话、Secure/HttpOnly Cookie、登录限流和同源提交校验。外部请求不能通过伪造原 Sites 身份头获得权限。
- 阅读不需要登录。`/write/` 是写作入口，`/author/login` 是作者登录页。

## 账号与数据

`wrangler.jsonc` 中记录部署账号、Worker 与 D1 标识，资源均属于 vi 的 Cloudflare 账号。Cloudflare 维护托管服务，vi 拥有文章与账号管理权限。不要把密码、会话签名密钥或初始化代码提交到代码仓库。

从原站复制文章时保留文章 ID、地址、正文、草稿、公开版本、版本号和时间，作者标识映射为独立作者 `vi`。两边此后使用不同数据库，修改不会自动同步。迁移 SQL 位于忽略的 `.runtime/` 中。

## 开发与部署

```sh
npm ci
npm run build
npm test
node scripts/run-wrangler.mjs d1 migrations apply footprints-vi --local
npm run dev
```

本地登录需在忽略的 `.dev.vars` 文件中配置至少 32 字符的 `SESSION_SECRET`，以及随机初始化代码的 SHA-256 十六进制摘要 `SETUP_TOKEN_HASH`。生产密钥通过 Wrangler secrets 设置，不会随本地密钥文件部署。

```sh
npm run build
node scripts/smoke-worker.mjs
node scripts/run-wrangler.mjs deploy --dry-run
node scripts/run-wrangler.mjs d1 migrations apply footprints-vi --remote
npm run deploy
```

部署前核对账号、Worker 名称和数据库标识；不得用此配置覆盖其他站点。数据库迁移和内容导入是独立操作，普通代码部署不会重置文章。

首次上线后运行 `node scripts/initialize-author.mjs <已确认的 Worker HTTPS 地址>`。它生成随机密钥，通过标准输入上传 Cloudflare，只在本地 `.runtime/author-setup.link` 保存一次性初始化链接。作者打开该私密链接，自行设置至少 12 字符密码。初始化只能完成一次，完成后链接失效；随后从 `/author/login` 登录写作。

如需重设作者密码，应先验证账号所有权，导出文章备份，生成新的初始化代码摘要，清除 `author_auth` 中的作者记录并轮换 `SESSION_SECRET`。这会注销现有会话；不要在日常部署中执行。

## 验证

`npm test` 验证权限隔离、一次性初始化、Cookie 验签/过期/撤销、登录限流、CSRF、草稿和公开版本、Markdown 安全及编辑器操作。`scripts/smoke-worker.mjs` 使用真正的 workerd 和本地 D1，测试完整写作流程，不写入生产数据库。验证结果位于忽略的 `test-results/`。

手机尺寸模拟只能验证布局与交互。公网连接仍受用户的实际网络、浏览器和 Cloudflare 域名访问情况影响，需要在实际手机上再次打开新站确认。

## 图片

沿用原站下载到本地的 Unsplash 图片：山景、咖啡、林间小路、湖泊和工作桌。图片随静态资源部署，文字采用系统字体，页面加载不依赖 Unsplash 或外部字体请求。

- lake.jpg：Tom Wheatley，[原图](https://unsplash.com/photos/body-of-water-near-trees-l9M1q8W-pyA)。
- forest.jpg：Peter Robbins，[原图](https://unsplash.com/photos/_0QWCZdgYPg)。
- coffee.jpg：Юлія Дубина，[原图](https://unsplash.com/photos/JtYm2zwrE9s)。
- desk.jpg：Esra Afşar，[原图](https://unsplash.com/photos/iRixPSVEkp8)。
- mountains.jpg：[原图](https://unsplash.com/photos/a-lake-surrounded-by-trees-and-mountains-under-a-cloudy-sky-YyNI6FCitt8)。

足迹图标为原项目原创 SVG。
