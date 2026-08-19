/* ============================================================
   NEXUS//OS — core type definitions
   Mirrors the PostgreSQL schema documented in the Blueprint.
   ============================================================ */

export type Scope = "READ" | "WRITE" | "FINANCIAL" | "ADMIN";

export type EventKind =
  | "order"
  | "alert"
  | "ai"
  | "tick"
  | "social"
  | "freelance"
  | "system"
  | "settings";

export interface BusEvent {
  kind: EventKind;
  msg?: string;
}

export interface Product {
  id: string;
  name: string;
  spec: string;
  cost: number;
  price: number;
  stock: number;
  views: number;
  conv: number; // conversion rate %
  velocity: number; // units / week
}

export type OrderStatus = "paid" | "processing" | "shipped" | "delivered";

export interface Order {
  id: string;
  at: number;
  customer: string;
  productId: string;
  qty: number;
  revenue: number;
  profit: number;
  status: OrderStatus;
  source: "WooCommerce" | "Instagram" | "TikTok" | "WhatsApp" | "Walk-in";
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  spent: number;
  orders: number;
  last: number;
}

export interface Expense {
  id: string;
  at: number;
  label: string;
  category: string;
  amount: number;
  recurring: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  platform: "Meta" | "TikTok" | "Google";
  spend: number;
  conversions: number;
  revenue: number;
  active: boolean;
}

export type LeadStage = "lead" | "contacted" | "proposal" | "negotiation" | "won" | "lost";

export interface Lead {
  id: string;
  name: string;
  service: string;
  value: number;
  stage: LeadStage;
  deadline: number;
  note: string;
}

export interface Skill {
  id: string;
  name: string;
  level: number; // 0-100
  demand: number; // market demand 0-100
}

export interface AuditEntry {
  id: string;
  at: number;
  actor: "AI" | "YOU" | "SYSTEM";
  module: string;
  action: string;
  scope: Scope;
  outcome: string;
}

export type NoticeKind = "sale" | "alert" | "ai" | "social" | "freelance" | "system";

export interface Notice {
  id: string;
  at: number;
  kind: NoticeKind;
  text: string;
  read: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  trigger: string;
  steps: string[];
  enabled: boolean;
  runs: number;
  lastRun: number | null;
}

export type IntegrationStatus = "connected" | "disconnected" | "error";

export interface Integration {
  id: string;
  name: string;
  desc: string;
  status: IntegrationStatus;
  scopes: Scope[];
  syncMin: number; // minutes since last sync
  free: boolean;
}

export interface SocialStats {
  followers: number;
  growth7d: number;
  engRate: number;
  reach: number[]; // last 14 days
}

export interface Lesson {
  id: string;
  title: string;
  mins: number;
  level: string;
  tool: string;
  steps: string[];
  money: string;
}

export interface Settings {
  sound: boolean;
  volume: number;
  telegram: boolean;
  email: boolean;
  push: boolean;
  sim: boolean; // live operations simulator
}

export interface MemoryPrefs {
  customers: boolean;
  finances: boolean;
  commands: boolean;
}

export interface State {
  v: number;
  products: Product[];
  orders: Order[];
  customers: Customer[];
  expenses: Expense[];
  campaigns: Campaign[];
  leads: Lead[];
  skills: Skill[];
  audit: AuditEntry[];
  notices: Notice[];
  workflows: Workflow[];
  integrations: Integration[];
  social: { instagram: SocialStats; tiktok: SocialStats };
  lessonsDone: string[];
  settings: Settings;
  memory: MemoryPrefs;
}
