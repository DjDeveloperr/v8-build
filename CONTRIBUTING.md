# 贡献与发布指南

本文档说明了如何提交代码更改、管理版本标签 (Tag) 以及触发 GitHub Actions 构建流程。

## 1. 提交代码更改 (Commit & Push)

当你修改了代码或配置文件（如 `.github/workflows/main.yml`）后，请按照以下步骤提交更改到 `main` 分支。

```bash
# 1. 查看更改状态
git status

# 2. 添加更改文件
git add .
# 或者只添加特定文件
# git add .github/workflows/main.yml

# 3. 提交更改 (附带清晰的提交信息)
git commit -m "描述你的更改内容，例如：fix: update workflow dependencies"

# 4. 推送到远程仓库
git push origin main
```

## 2. 触发构建发布 (Tagging)

本项目的 GitHub Actions 构建流程是通过 **Git Tag** 触发的。只有以 `v` 开头的 Tag (如 `v14.3.92-32`) 才会触发构建。

### 方式 A：创建新版本 (推荐)

如果你想发布一个新的构建版本，请增加版本号或后缀。

```bash
# 1. 创建新 Tag (例如 v14.3.92-32)
git tag v14.3.92-32

# 2. 推送 Tag 到远程，触发构建
git push origin v14.3.92-32
```

### 方式 B：重试当前版本 (调试用)

如果你只是修了构建脚本的 Bug，想重新触发同一个版本的构建，可以删除并重建 Tag。

> **注意**：这会覆盖之前的 Tag，请谨慎使用。

```bash
# 1. 删除本地 Tag
git tag -d v14.3.92-31

# 2. 删除远程 Tag
git push origin :refs/tags/v14.3.92-31

# 3. 重新创建 Tag
git tag v14.3.92-31

# 4. 重新推送触发构建
git push origin v14.3.92-31
```

## 3. 验证构建状态

1. 访问 GitHub 仓库的 **Actions** 页面：
   `https://github.com/haroel/v8-build/actions`

2. 你应该能看到一个新的 Workflow run 正在运行。
   - 标题通常是你最近一次 commit 的信息。
   - 触发事件会显示为 `Tag push`。

3. 点击进入查看详情，确认 `build-android`、`build-ios`、`build-mac` 的 V8 10/11/13 矩阵是否成功执行。

## 4. 常见问题排查

- **构建未触发？**
  - 检查 Tag 是否以 `v` 开头。
  - 检查 `.github/workflows/main.yml` 中的 `on: push: tags` 配置。

- **Release 一直是 Draft 状态？**
  - 这通常意味着 `publish-release` 任务没有执行。
  - 检查 `publish-release` 的 `needs` 依赖是否包含被禁用 (`if: false`) 的任务。如果依赖了被跳过的任务，发布任务也会被跳过。

- **找不到 Tag？**
  - 运行 `git ls-remote --tags origin` 查看远程 Tag 列表。
