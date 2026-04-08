# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
│   ├── miniDict.js        # 内置迷你词典（可被外部词典覆盖）
│   └── dict.json          # 外部大词典文件
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   │   └── api/translate/  # 翻译API
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   │   └── useBookshelf.ts # 书架管理Hook
│   ├── lib/                # 工具库
│   │   ├── utils.ts        # 通用工具函数 (cn)
│   │   ├── dictionary.ts   # 词典查找、词根还原
│   │   ├── translate.ts    # AI翻译客户端
│   │   └── dictLoader.ts   # 外部词典加载器
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

## 双层词典机制

### 加载优先级
1. **内置迷你词典 (miniDict.js)** - 包含常见1000+词汇，随应用加载
2. **外部大词典 (dict.json)** - 按需从服务器加载并缓存到localStorage
3. **词根还原** - 对未找到的词尝试去后缀还原词根
4. **AI翻译** - 最终回退方案，调用豆包大模型

### 词典缓存
- external dictionary 缓存到 localStorage
- 缓存有效期：24小时
- 可通过 `reloadExternalDictionary()` 强制刷新

### 标注格式
- 格式：`word(中文)`
- 中文部分：字号70%，颜色#E74C3C，字体微软雅黑
- 行高统一：1.8

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

- **项目理解加速**：初始可以依赖项目下`package.json`文件理解项目类型，如果没有或无法理解退化成阅读其他文件。
- **Hydration 错误预防**：严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。


## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**

## 云同步功能

### 功能概述
- 使用同步码方案实现跨设备数据同步，无需注册登录
- 数据包括：书架、书籍内容、标注、书签、阅读进度
- 同步码格式：8位大写字母+数字（如 A3K9M2X7）

### 数据库表结构
```sql
CREATE TABLE sync_data (
  sync_code TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX sync_data_sync_code_idx ON sync_data(sync_code);
```

### API 接口
- `POST /api/sync` - 上传数据，生成同步码
- `GET /api/sync?code=XXX` - 通过同步码下载数据

### 同步组件
- 位置：`src/components/CloudSyncModal.tsx`
- 入口：书架页面右上角的"云同步"按钮

### 数据限制
- 单条数据上限：10MB
- 超过限制提示用户"数据过大，请删除部分书籍后重试"


