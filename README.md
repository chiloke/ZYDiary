# ZY Diary

![ZY Diary Logo](./build/brand-logo.png)

ZY Diary 是一款面向长期生活管理的个人成长应用，围绕每日记录、往日复盘、目标打卡、消费账本、周期报告与本地数据管理展开，帮助用户把日常行动、情绪状态与资源流向沉淀为可回看、可追踪、可恢复的长期轨迹。

## 当前版本

- 版本：`1.0.1`
- Windows 应用标识：`com.zydiary.desktop`
- Android 包名：`com.zydiary.mobile`

## 核心功能

- 每日记录与往日复盘分离
- 目标打卡、月历反馈、奖励惩罚转盘
- 账本记录、预算系统、固定消费与月份切换
- 周报月报与阶段洞察
- 用户名、主题切换、帮助中心、首次引导卡
- 轻提醒与原生本地通知
- 本地存储、导出导入、恢复快照、跨平台数据目录支持

## 安装与运行

### Windows 安装包

`dist/ZY-Diary-Setup-1.0.1.exe`

### Android Release APK

`android/app/build/outputs/apk/release/app-release.apk`

### 开发运行（桌面）

```bash
npm install
npm run dev
```

## 打包命令

### Windows

```bash
npm run dist
```

### Android

```bash
npm run android:prepare
npm run android:sync
cd android
./gradlew assembleRelease
```

## 数据存储说明

- 桌面版支持文件目录存储，可在“档案”页查看和切换目录。
- 安卓支持应用私有目录与设备文档目录两种模式。
- 建议在升级版本、迁移设备前导出一次 JSON 备份。

## 目录结构

- `js/`：业务源码模块
- `app.js`：浏览器/静态页面实际运行入口
- `electron/`：桌面主进程与预加载桥
- `android/`：Capacitor Android 原生工程
- `build/`：图标与安装器资源
- `dist/`：Windows 打包产物

## License

MIT
