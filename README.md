# Footprints · vi 的生活与技术

vi 的个人博客，包含生活随笔、技术文章和作者写作工作台。

在线访问：https://footprints-vi.de5.net/

## 项目目录

- [`footprints-cloudflare/`](footprints-cloudflare/README.md)：当前独立部署的 Cloudflare 版本，使用 Workers、D1 和作者密码登录。
- [`footprints/`](footprints/README.md)：原 ChatGPT Sites 版本，使用 Vinext、D1 和平台作者登录。

两个目录都是完整项目，各自保留依赖锁定文件、数据库迁移、测试和部署说明。文章数据与作者凭证由运行环境管理，不包含在源码仓库中。

## 本地开发

使用 Node.js 22.13 或更新版本。开发当前 Cloudflare 版本：

```sh
cd footprints-cloudflare
npm ci
npm run build
npm test
node scripts/run-wrangler.mjs d1 migrations apply footprints-vi --local
npm run dev
```

本地作者登录的配置方法见 [`footprints-cloudflare/README.md`](footprints-cloudflare/README.md)。Sites 原版的开发步骤见 [`footprints/README.md`](footprints/README.md)。

## 源码与配置

仓库保留源码、图片、配置、迁移和测试。依赖目录、构建产物、部署压缩包、本地数据库及密钥文件通过 `.gitignore` 排除；`.env.example` 仅包含空配置项。

Cloudflare 版本的 `wrangler.jsonc` 指向当前博客的资源。部署到其他账号时，需要更新账号、域名、Worker 和 D1 配置，再单独配置运行时密钥。

图片来源与署名保留在两个项目各自的 README 中。
