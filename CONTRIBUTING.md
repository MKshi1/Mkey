# 参与 MKey 开发

感谢你愿意改进 MKey。请先在 Issue 中说明较大的功能或行为变更，修复明确问题的小型 Pull Request 可以直接提交。

## 开发环境

需要 Node.js LTS、npm、Rust stable，以及当前平台对应的 [Tauri 系统依赖](https://v2.tauri.app/start/prerequisites/)。

```bash
git clone https://github.com/MKshi1/Mkey.git
cd Mkey
npm ci
npm run tauri dev
```

## 提交前检查

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Pull Request 应当保持范围清晰，说明用户可见变化，并为行为修改补充对应测试。不要提交 `node_modules`、`dist`、`src-tauri/target` 或本地安装包。

## 数据安全

- 不要提交真实的 `vault.json`、主密码、账号、密码或导出 JSON。
- 测试和截图只能使用明显虚构的数据，例如 `example.test` 域名。
- 不要把真实保险库附加到 Issue、Discussion 或 Pull Request。
- 安全问题不要公开披露，请按照 [SECURITY.md](SECURITY.md) 报告。

## 代码风格

- 沿用现有 React、TypeScript 和 Rust 结构，避免与目标无关的大型重构。
- UI 文案以简洁中文为主，并保持键盘操作和辅助技术可访问性。
- Rust 错误应返回可理解的信息，不要在日志中输出秘密内容。

提交代码即表示你同意按照项目的 [MIT License](LICENSE) 发布贡献。
