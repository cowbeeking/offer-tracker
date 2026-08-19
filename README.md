# 秋招 Tracker

一个打开即用、无需登录、完全离线的秋招 / 校招投递管理桌面客户端。数据保存在本机 IndexedDB 中，支持完整流程历史、看板拖拽、统计和备份恢复。

## 功能

- 投递记录新增、编辑、删除与历史公司自动补全
- Dashboard、截止日期提醒和今日待办
- 实时搜索，以及状态、公司、地点和日期筛选
- 招聘流程详情、事件日期 / 时间和完整状态历史
- 看板拖拽更新状态并自动记录历史
- 投递趋势、笔试率、面试率和 Offer 率
- JSON 完整备份 / 恢复、CSV 导出
- Light / Dark / System 主题与自定义流程节点
- `Ctrl + N` 新增、`Ctrl + K` 搜索、`Esc` 关闭弹窗

## 本地开发

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

## 检查与构建

```bash
npm run lint
npm run typecheck
npm run build
```

`npm run build` 会在 `release/` 目录生成 Windows x64 NSIS 安装包。若只想检查桌面应用产物而不生成安装程序，可以运行 `npm run build:app`。

## 数据说明

- 首次启动会写入一组带“示例”标记的演示记录，可在“设置 → 数据管理”中一键移除。
- 删除演示数据或清空数据后不会自动重新生成。
- 建议定期在“设置 → 导出 JSON”保存完整备份。
- JSON 导入会校验应用标识、必要字段和流程历史格式后再覆盖本地数据。
