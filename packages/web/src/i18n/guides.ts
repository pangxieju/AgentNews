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
  },
};