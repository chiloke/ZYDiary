# ZY Diary 1.0.1

版本发布日期：2026-04-08

## 本版重点

- 新增帮助中心页面，集中介绍产品功能、推荐流程、提醒机制与数据备份说明。
- 首页新增首次引导卡，会根据用户名、目标、首条记录和帮助页访问情况自动判断完成进度。
- 重新打包桌面版与安卓版本，收口本轮界面与体验更新。
- 延续启动转场、用户名系统、目标打卡、预算账本、周期报告、个人档案与跨平台存储能力。

## 发布产物

- Windows 安装包：`dist/`
- Android Debug APK：`android/app/build/outputs/apk/debug/`
- Android Release APK：`android/app/build/outputs/apk/release/`

## 已知说明

- 安卓端由于系统权限模型限制，不支持像桌面端那样任意浏览整个文件系统选择目录，而是提供“应用私有目录”和“设备文档目录”两种可用存储模式。
- 发布升级时请务必妥善保管签名文件 `android/app/zy-diary-release.jks` 与 `android/keystore.properties`。
