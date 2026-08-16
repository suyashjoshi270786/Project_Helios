// @ts-nocheck
import { useState } from "react";
import {
  ChevronDown, Plus, ArrowRight, CheckCircle2, XCircle, ShieldCheck, BarChart3, Bot,
  Brain, FlaskConical, Code2, Bug, Sparkles, TrendingUp,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useTheme } from "../theme/ThemeContext";

const trendData = [
  { day: "May 20", passed: 1150, failed: 90 },
  { day: "May 21", passed: 1280, failed: 110 },
  { day: "May 22", passed: 1220, failed: 95 },
  { day: "May 23", passed: 1400, failed: 130 },
  { day: "May 24", passed: 1350, failed: 100 },
  { day: "May 25", passed: 1500, failed: 140 },
  { day: "May 26", passed: 1673, failed: 169 },
];

const failureReasons = [
  { name: "Assertion Failure", value: 32, color: "#3B82F6" },
  { name: "Element Not Found", value: 21, color: "#22C55E" },
  { name: "Timeout", value: 15, color: "#F97316" },
  { name: "Data Mismatch", value: 12, color: "#EF4444" },
  { name: "API Error", value: 10, color: "#A855F7" },
  { name: "Others", value: 10, color: "#64748B" },
];

const recentRuns = [
  { name: "Regression Suite", time: "May 26, 2025 10:30 AM", tests: 512, pass: 92, ok: true },
  { name: "API Test Suite", time: "May 26, 2025 09:15 AM", tests: 280, pass: 94, ok: true },
  { name: "Payment Module Tests", time: "May 26, 2025 08:45 AM", tests: 132, pass: 71, ok: false },
  { name: "Smoke Tests", time: "May 26, 2025 08:00 AM", tests: 56, pass: 100, ok: true },
  { name: "UI Regression", time: "May 25, 2025 11:20 PM", tests: 862, pass: 91, ok: true },
];

const failureQueue = [
  { sev: "High", sevColor: "bg-red-500/15 text-red-400 border-red-500/30", title: "Login Test - Invalid Credentials", meta: "Assertion Failure · Login.spec.ts:45", time: "12m ago" },
  { sev: "Medium", sevColor: "bg-amber-500/15 text-amber-400 border-amber-500/30", title: "Checkout Flow - Payment", meta: "Element Not Found · checkout.spec.ts:87", time: "18m ago" },
  { sev: "Low", sevColor: "bg-slate-500/15 text-slate-400 border-slate-500/30", title: "User Profile - Update", meta: "Timeout · profile.spec.ts:120", time: "25m ago" },
];

const projects = [
  { name: "Digital Banking Platform", pct: 89, tests: 1520 },
  { name: "Insurance Portal", pct: 76, tests: 1120 },
  { name: "E-Commerce Platform", pct: 68, tests: 980 },
  { name: "Lending Application", pct: 92, tests: 1340 },
];

const agents = [
  { icon: Brain, title: "Requirement Analyzer", desc: "Extracts & analyzes requirements and identifies key flows", cta: "Analyze now", tint: "text-blue-400 bg-blue-500/10", btn: "bg-blue-600 hover:bg-blue-500" },
  { icon: FlaskConical, title: "Test Case Generator", desc: "Generates comprehensive test cases using AI", cta: "Generate now", tint: "text-purple-400 bg-purple-500/10", btn: "bg-purple-600 hover:bg-purple-500" },
  { icon: Code2, title: "Automation Generator", desc: "Creates automation scripts using best practices", cta: "Generate now", tint: "text-teal-400 bg-teal-500/10", btn: "bg-teal-600 hover:bg-teal-500" },
  { icon: Bug, title: "Failure Analyzer", desc: "Analyzes failures and suggests root cause & fixes", cta: "Analyze now", tint: "text-orange-400 bg-orange-500/10", btn: "bg-orange-600 hover:bg-orange-500" },
  { icon: Sparkles, title: "Test Data Generator", desc: "Generates realistic and comprehensive test data", cta: "Generate now", tint: "text-pink-400 bg-pink-500/10", btn: "bg-pink-600 hover:bg-pink-500" },
  { icon: TrendingUp, title: "Release Predictor", desc: "Predicts release risk and recommendations", cta: "Predict now", tint: "text-sky-400 bg-sky-500/10", btn: "bg-sky-600 hover:bg-sky-500" },
];

function StatCard({ label, value, sub, subColor, icon: Icon, iconTint, trendUp }) {
  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex-1 min-w-[150px]">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`w-7 h-7 rounded-md flex items-center justify-center ${iconTint}`}>
          <Icon size={15} />
        </span>
      </div>
      <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      <div className={`text-xs mt-1 ${subColor}`}>{trendUp ? "▲" : "▼"} {sub}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [range] = useState("Last 7 Days");
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const total = failureReasons.reduce((a, b) => a + b.value, 0);

  return (
    <>
      <div className="flex items-center justify-end gap-3 -mt-1">
        <button className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">
          {range} <ChevronDown size={12} />
        </button>
        <button className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 transition-colors rounded-lg px-3 py-1.5 text-xs text-white font-medium">
          <Plus size={13} /> New Project
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <StatCard label="Overall Quality Score" value="91%" sub="8%" subColor="text-emerald-400" icon={ShieldCheck} iconTint="bg-emerald-500/10 text-emerald-400" trendUp />
        <StatCard label="Tests Executed" value="1,842" sub="12%" subColor="text-blue-400" icon={BarChart3} iconTint="bg-blue-500/10 text-blue-400" trendUp />
        <StatCard label="Passed" value="1,673 (90.8%)" sub="10%" subColor="text-emerald-400" icon={CheckCircle2} iconTint="bg-emerald-500/10 text-emerald-400" trendUp />
        <StatCard label="Failed" value="169 (9.2%)" sub="4%" subColor="text-red-400" icon={XCircle} iconTint="bg-red-500/10 text-red-400" trendUp={false} />
        <StatCard label="Automation Coverage" value="78%" sub="6%" subColor="text-emerald-400" icon={Bot} iconTint="bg-purple-500/10 text-purple-400" trendUp />
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex-1 min-w-[150px]">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">Release Readiness</div>
          <div className="text-xl font-semibold text-amber-400">High</div>
          <div className="text-xs mt-1 text-slate-400 dark:text-slate-500">
            Risk: <span className="text-emerald-400">Low</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Release Readiness Overview</h3>
          <div className="flex flex-col items-center justify-center py-2">
            <div className="text-4xl font-bold text-slate-900 dark:text-white">91%</div>
            <div className="text-emerald-400 text-xs mt-1">High Confidence</div>
          </div>
          <div className="space-y-2 mt-4 text-xs">
            {[["Requirements Coverage", "96%"], ["Test Case Coverage", "93%"], ["Automation Coverage", "78%"], ["Critical Test Cases", "100%"], ["Regression Status", "Passed"], ["Performance", "Passed"], ["Security", "Passed"]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <CheckCircle2 size={12} className="text-emerald-400" /> {k}
                </span>
                <span className="text-slate-800 dark:text-slate-200">{v}</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-medium rounded-lg py-2 flex items-center justify-center gap-1.5">
            View Release Commander <ArrowRight size={12} />
          </button>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Execution Trend</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
              Daily <ChevronDown size={12} />
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <XAxis
                dataKey="day"
                stroke={isDark ? "#475569" : "#94a3b8"}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis stroke={isDark ? "#475569" : "#94a3b8"} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: isDark ? "#0f172a" : "#ffffff",
                  border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="passed" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} name="Passed" />
              <Line type="monotone" dataKey="failed" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} name="Failed" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Test Runs</h3>
            <button className="text-xs text-blue-400">View All</button>
          </div>
          <div className="space-y-3">
            {recentRuns.map((r) => (
              <div
                key={r.name}
                className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 last:border-0 last:pb-0"
              >
                <div className="flex items-start gap-2 min-w-0">
                  {r.ok
                    ? <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                    : <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-xs text-slate-800 dark:text-slate-200 font-medium truncate">{r.name}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-600">{r.time}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-800 dark:text-slate-200">{r.tests}</div>
                  <div className={`text-[10px] ${r.ok ? "text-emerald-400" : "text-red-400"}`}>{r.pass}% Passed</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {agents.map((a) => (
          <div key={a.title} className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${a.tint}`}>
              <a.icon size={16} />
            </span>
            <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{a.title}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 flex-1 mb-3 leading-snug">{a.desc}</div>
            <button className={`${a.btn} transition-colors text-white text-xs font-medium rounded-lg py-1.5 flex items-center justify-center gap-1`}>
              {a.cta} <ArrowRight size={11} />
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Top Failure Reasons</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={failureReasons} dataKey="value" innerRadius={38} outerRadius={60} paddingAngle={2}>
                  {failureReasons.map((entry) => <Cell key={entry.name} fill={entry.color} stroke="none" />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5 text-xs">
              {failureReasons.map((r) => (
                <div key={r.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full" style={{ background: r.color }} /> {r.name}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">{Math.round((r.value / total) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Failure Intelligence</h3>
            <button className="text-xs text-blue-400">View All</button>
          </div>
          <div className="space-y-3">
            {failureQueue.map((f) => (
              <div
                key={f.title}
                className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${f.sevColor}`}>{f.sev}</span>
                  <div className="text-xs text-slate-800 dark:text-slate-200 font-medium mt-1 truncate">
                    {f.title}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{f.meta}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-400 dark:text-slate-600 mb-1">{f.time}</div>
                  <button className="text-[11px] text-blue-400">Analyze</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Projects</h3>
            <button className="text-xs text-blue-400">View All</button>
          </div>
          <div className="space-y-3.5">
            {projects.map((p) => (
              <div key={p.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-800 dark:text-slate-200">{p.name}</span>
                  <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${p.pct}%` }} />
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 w-8 text-right">{p.pct}%</span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5">{p.tests} Tests</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
