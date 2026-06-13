import { Icon } from '@iconify/react'

/**
 * Brand icons for tech-stack chips (Architecture page, Understand panel, landing
 * RepoCard). Iconify loads each icon on-demand from its public API and caches it
 * in localStorage. Only techs we have a confident brand logo for are mapped;
 * everything else returns null so the chip falls back to text-only.
 *
 * We deliberately skip logos that are dark-on-dark (e.g. Express/Flask wordmarks)
 * since they'd be invisible on the dark theme.
 */
const TECH_ICONS: Record<string, string> = {
  // ── Languages ──────────────────────────────────────────────────────────────
  javascript: 'logos:javascript', js: 'logos:javascript',
  typescript: 'logos:typescript-icon', ts: 'logos:typescript-icon',
  python: 'logos:python', py: 'logos:python',
  java: 'logos:java',
  go: 'logos:go', golang: 'logos:go',
  rust: 'logos:rust', rustlang: 'logos:rust',
  ruby: 'logos:ruby',
  php: 'logos:php',
  c: 'logos:c',
  cpp: 'logos:c-plusplus', cplusplus: 'logos:c-plusplus',
  csharp: 'logos:c-sharp', cs: 'logos:c-sharp',
  kotlin: 'logos:kotlin-icon',
  swift: 'logos:swift',
  scala: 'logos:scala',
  dart: 'logos:dart',
  elixir: 'logos:elixir',
  haskell: 'logos:haskell-icon',
  lua: 'logos:lua',
  r: 'logos:r-lang',
  perl: 'logos:perl',
  clojure: 'logos:clojure',
  erlang: 'logos:erlang',
  julia: 'logos:julia',
  bash: 'logos:bash-icon', shell: 'logos:bash-icon',
  html: 'logos:html-5', html5: 'logos:html-5',
  css: 'logos:css-3', css3: 'logos:css-3',
  graphql: 'logos:graphql',
  markdown: 'logos:markdown',

  // ── Frontend frameworks / libraries ─────────────────────────────────────────
  react: 'logos:react', reactjs: 'logos:react', reactvite: 'logos:react',
  reactnative: 'logos:react', reactflow: 'logos:react',
  reactrouter: 'logos:react-router',
  reactquery: 'logos:react-query',
  vue: 'logos:vue', vuejs: 'logos:vue', vue3: 'logos:vue',
  nuxt: 'logos:nuxt-icon', nuxtjs: 'logos:nuxt-icon',
  angular: 'logos:angular-icon',
  svelte: 'logos:svelte-icon', sveltekit: 'logos:svelte-icon',
  solidjs: 'logos:solidjs-icon', solid: 'logos:solidjs-icon',
  preact: 'logos:preact',
  ember: 'logos:ember',
  jquery: 'logos:jquery',
  alpinejs: 'logos:alpinejs',
  astro: 'logos:astro-icon',
  nextjs: 'logos:nextjs-icon', next: 'logos:nextjs-icon',
  gatsby: 'logos:gatsby',
  remix: 'logos:remix-icon',
  redux: 'logos:redux',
  mobx: 'logos:mobx',
  tailwindcss: 'logos:tailwindcss-icon', tailwind: 'logos:tailwindcss-icon',
  bootstrap: 'logos:bootstrap',
  materialui: 'logos:material-ui', mui: 'logos:material-ui',
  chakraui: 'logos:chakra-ui', chakra: 'logos:chakra-ui',
  antdesign: 'logos:ant-design', antd: 'logos:ant-design',
  mantine: 'logos:mantine-icon',
  framermotion: 'logos:framer', framer: 'logos:framer',
  styledcomponents: 'logos:styled-components',
  threejs: 'logos:threejs',
  d3: 'logos:d3', d3js: 'logos:d3',
  storybook: 'logos:storybook-icon',

  // ── Build tools / bundlers / testing ────────────────────────────────────────
  vite: 'logos:vitejs', vitejs: 'logos:vitejs',
  webpack: 'logos:webpack',
  rollup: 'logos:rollupjs', rollupjs: 'logos:rollupjs',
  esbuild: 'logos:esbuild',
  babel: 'logos:babel',
  sass: 'logos:sass', scss: 'logos:sass',
  postcss: 'logos:postcss',
  eslint: 'logos:eslint',
  prettier: 'logos:prettier',
  jest: 'logos:jest',
  vitest: 'logos:vitest',
  cypress: 'logos:cypress',
  playwright: 'logos:playwright',
  selenium: 'logos:selenium',
  storyshots: 'logos:storybook-icon',

  // ── Runtimes / package managers ─────────────────────────────────────────────
  nodejs: 'logos:nodejs-icon', node: 'logos:nodejs-icon',
  deno: 'logos:deno',
  bun: 'logos:bun',
  npm: 'logos:npm-icon',
  yarn: 'logos:yarn',
  pnpm: 'logos:pnpm',
  electron: 'logos:electron',
  flutter: 'logos:flutter',
  android: 'logos:android-icon',

  // ── Backend frameworks ──────────────────────────────────────────────────────
  fastapi: 'logos:fastapi-icon',
  django: 'logos:django-icon',
  nestjs: 'logos:nestjs',
  fastify: 'logos:fastify-icon',
  spring: 'logos:spring-icon', springboot: 'logos:spring-icon',
  rails: 'logos:rails', rubyonrails: 'logos:rails',
  laravel: 'logos:laravel',
  symfony: 'logos:symfony',
  dotnet: 'logos:dotnet', aspnet: 'logos:dotnet',
  phoenix: 'logos:phoenix',
  apollo: 'logos:apollostack', apollographql: 'logos:apollostack',
  prisma: 'logos:prisma',
  sequelize: 'logos:sequelize',
  sqlalchemy: 'logos:sqlalchemy',
  graphene: 'logos:graphql',

  // ── Databases / data stores ─────────────────────────────────────────────────
  mongodb: 'logos:mongodb-icon', mongo: 'logos:mongodb-icon',
  mongoose: 'logos:mongoose',
  postgresql: 'logos:postgresql', postgres: 'logos:postgresql',
  mysql: 'logos:mysql-icon',
  mariadb: 'logos:mariadb-icon',
  sqlite: 'logos:sqlite',
  redis: 'logos:redis',
  elasticsearch: 'logos:elasticsearch',
  cassandra: 'logos:cassandra',
  neo4j: 'logos:neo4j',
  couchdb: 'logos:couchdb',
  supabase: 'logos:supabase-icon',
  firebase: 'logos:firebase',
  planetscale: 'logos:planetscale-icon',

  // ── Cloud / DevOps / infra ──────────────────────────────────────────────────
  aws: 'logos:aws', amazonwebservices: 'logos:aws',
  googlecloud: 'logos:google-cloud', gcp: 'logos:google-cloud',
  azure: 'logos:microsoft-azure',
  docker: 'logos:docker-icon',
  kubernetes: 'logos:kubernetes', k8s: 'logos:kubernetes',
  terraform: 'logos:terraform-icon',
  ansible: 'logos:ansible',
  jenkins: 'logos:jenkins',
  githubactions: 'logos:github-actions',
  gitlab: 'logos:gitlab',
  vercel: 'logos:vercel-icon',
  netlify: 'logos:netlify-icon',
  heroku: 'logos:heroku-icon',
  cloudflare: 'logos:cloudflare-icon',
  nginx: 'logos:nginx',
  apache: 'logos:apache',
  rabbitmq: 'logos:rabbitmq-icon',
  kafka: 'logos:kafka-icon',
  grafana: 'logos:grafana',
  prometheus: 'logos:prometheus',
  sentry: 'logos:sentry-icon',
  datadog: 'logos:datadog',
  git: 'logos:git-icon',

  // ── Auth / payments / APIs ──────────────────────────────────────────────────
  jwt: 'logos:jwt-icon',
  auth0: 'logos:auth0-icon',
  stripe: 'logos:stripe',
  paypal: 'logos:paypal',
  twilio: 'logos:twilio-icon',
  swagger: 'logos:swagger',
  postman: 'logos:postman-icon',

  // ── AI / ML / data science ──────────────────────────────────────────────────
  openai: 'logos:openai-icon',
  gemini: 'logos:google-gemini', googlegemini: 'logos:google-gemini',
  huggingface: 'logos:hugging-face-icon',
  tensorflow: 'logos:tensorflow',
  pytorch: 'logos:pytorch-icon',
  pandas: 'logos:pandas-icon',
  numpy: 'logos:numpy',
  jupyter: 'logos:jupyter',
  scikitlearn: 'logos:scikit-learn',
}

/** Iconify icon name for a tech, or null if we don't have a confident logo. */
export function techIconName(tech: string): string | null {
  const key = tech.toLowerCase().replace(/[\s\-_.+]/g, '')
  return TECH_ICONS[key] ?? null
}

/** Renders the brand icon for a tech, or nothing when there's no mapped logo. */
export default function TechIcon({ tech, className = 'w-3.5 h-3.5' }: { tech: string; className?: string }) {
  const name = techIconName(tech)
  if (!name) return null
  return <Icon icon={name} className={`${className} shrink-0`} aria-hidden />
}
