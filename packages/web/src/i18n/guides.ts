import type { Lang } from './dict';

export type FormGuide = {
  /** 形态的英文短名（两种语言都显示它） */
  en: string;
  tagline: string;
  fit: string[];
  tradeoff: string[];
  watch: string;
};

export const FORM_GUIDES: Record<Lang, Record<string, FormGuide>> = {
  zh: {
    cli: {
      en: 'Terminal',
      tagline: '在终端里跑、能改你仓库的编码 agent。',
      fit: ['习惯终端与 git 工作流', '要脚本化 / CI 里跑', '想用自己的 API key 控成本'],
      tradeoff: ['没有图形界面，配置靠文件', '上下文范围要自己圈定'],
      watch: '看 Star 增速与发版频率：这类工具迭代快，停更就基本不能用。',
    },
    'ide-plugin': {
      en: 'IDE Extension',
      tagline: '装在编辑器里的插件，行内 diff、就近上下文。',
      fit: ['不想离开 IDE', '要边写边改、逐行确认', '团队已在用 VS Code / JetBrains'],
      tradeoff: ['能力受宿主编辑器限制', '大型重构不如 CLI 灵活'],
      watch: '看安装量与活跃度：插件生态里「装得多」通常等于「坑被踩平了」。',
    },
    'ide-app': {
      en: 'AI IDE',
      tagline: '把编辑器、agent、索引打包成一体化的 IDE。',
      fit: ['想要开箱即用', '团队要统一环境', '接受订阅制'],
      tradeoff: ['迁移成本高', '闭源为主，数据不可审计'],
      watch: '闭源产品多数没有公开安装量，只能看收录与口碑，别只看分数。',
    },
    desktop: {
      en: 'Desktop',
      tagline: '独立桌面应用，长任务、多窗口、本地文件。',
      fit: ['长时间挂着跑任务', '需要图形界面与本地文件权限', '非工程岗位也想用'],
      tradeoff: ['跨设备同步弱', '与 IDE / 终端工作流割裂'],
      watch: '优先看数据完整度：桌面端安装量通常不公开。',
    },
    browser: {
      en: 'Browser',
      tagline: '操作网页的 agent：填表、抓取、走流程。',
      fit: ['流程在网页里', '要替代重复点击', '做信息采集与核对'],
      tradeoff: ['站点反爬会导致不稳定', '权限与账号安全要自己评估'],
      watch: '看安全公告与更新频率：浏览器 agent 拿的是你的登录态。',
    },
    framework: {
      en: 'Framework',
      tagline: '自己造 agent 的编排框架，工具调用 + 工作流。',
      fit: ['要写代码、要可控', '需要多模型 / 多工具编排', '做产品或内部平台'],
      tradeoff: ['不是开箱即用的产品', '抽象层会绑定生态'],
      watch: '看贡献者与发版节奏：框架的长期维护比 star 数更重要。',
    },
    autonomous: {
      en: 'Autonomous',
      tagline: '给定目标后自己拆解、自己执行的 agent。',
      fit: ['任务可验收、可回滚', '研究 / 报告 / 运维类长任务', '能接受异步交付'],
      tradeoff: ['过程可观测性差', '失败成本与 token 成本都更高'],
      watch: '看活跃度与安全公告：自主执行的权限面更大。',
    },
  },
  en: {
    cli: {
      en: 'Terminal',
      tagline: 'A coding agent that runs in your terminal and edits your repo.',
      fit: ['You live in a terminal and a git workflow', 'You want it scripted / in CI', 'You want your own API key and cost control'],
      tradeoff: ['No GUI; configuration lives in files', 'You define the context boundary yourself'],
      watch: 'Watch star growth and release cadence: this category iterates fast, and stalled projects stop working.',
    },
    'ide-plugin': {
      en: 'IDE Extension',
      tagline: 'Installed in your editor: inline diffs and nearby context.',
      fit: ['You do not want to leave the editor', 'You want line-by-line review', 'Your team already uses VS Code / JetBrains'],
      tradeoff: ['Capability capped by the host editor', 'Large refactors are clumsier than in a CLI'],
      watch: 'Watch installs and activity: in extension ecosystems, “widely installed” usually means “rough edges are gone”.',
    },
    'ide-app': {
      en: 'AI IDE',
      tagline: 'Editor, agent and code index bundled into one IDE.',
      fit: ['You want it to work out of the box', 'Your team wants a uniform environment', 'You accept a subscription'],
      tradeoff: ['High switching cost', 'Mostly closed source; data is not auditable'],
      watch: 'Most closed products publish no install numbers — look at listing and reputation, not just the score.',
    },
    desktop: {
      en: 'Desktop',
      tagline: 'A standalone desktop app for long tasks, multiple windows and local files.',
      fit: ['Long-running tasks you leave running', 'You need a GUI and local file access', 'Non-engineering roles want to use it too'],
      tradeoff: ['Weak cross-device sync', 'Sits apart from IDE / terminal workflows'],
      watch: 'Check data level first: desktop install numbers are usually not public.',
    },
    browser: {
      en: 'Browser',
      tagline: 'An agent that operates web pages: forms, scraping, flows.',
      fit: ['The workflow lives in a browser', 'You want to replace repetitive clicking', 'You do collection and verification'],
      tradeoff: ['Anti-bot measures make it unstable', 'You must assess permissions and account safety'],
      watch: 'Watch advisories and update frequency: a browser agent holds your logged-in session.',
    },
    framework: {
      en: 'Framework',
      tagline: 'An orchestration framework for building your own agents: tools + workflows.',
      fit: ['You write code and want control', 'You need multi-model / multi-tool orchestration', 'You are building a product or internal platform'],
      tradeoff: ['Not a ready-made product', 'Abstractions tie you to an ecosystem'],
      watch: 'Watch contributors and release cadence: long-term maintenance matters more than star count.',
    },
    autonomous: {
      en: 'Autonomous',
      tagline: 'Given a goal, it decomposes and executes on its own.',
      fit: ['Tasks are verifiable and reversible', 'Research / reporting / ops work', 'You can accept asynchronous delivery'],
      tradeoff: ['Poor process observability', 'Both failure and token costs are higher'],
      watch: 'Watch activity and advisories: autonomous execution has a larger permission surface.',
    },
  },
};
