"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/components/ThemeProvider";
import {
  Search,
  Gauge,
  Globe,
  Zap,
  Accessibility,
  Shield,
  Sparkles,
  Loader2,
  AlertTriangle,
  ChevronDown,
  AlertCircle,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type CategoryKey = "performance" | "accessibility" | "seo" | "security";

interface CategoryResult {
  key: CategoryKey;
  score: number;
  issuesCount: number;
}

interface CriticalIssue {
  issue: string;
  impact: "high" | "medium" | "low";
  effort: "easy" | "medium" | "hard";
  affectedPages: number;
  recommendation: string;
  codeExample?: string;
}

interface OptimizationResult {
  overallScore: number;
  categories: CategoryResult[];
  criticalIssues: CriticalIssue[];
}

/* -------------------------------------------------------------------------- */
/*                              Static Metadata                               */
/* -------------------------------------------------------------------------- */

const CATEGORY_ICONS: Record<CategoryKey, LucideIcon> = {
  performance: Zap,
  accessibility: Accessibility,
  seo: Globe,
  security: Shield,
};

/* -------------------------------------------------------------------------- */
/*                          Mock Analysis Generator                           */
/* -------------------------------------------------------------------------- */

function buildMockResult(): OptimizationResult {
  const categories: CategoryResult[] = [
    { key: "performance", score: 72, issuesCount: 4 },
    { key: "accessibility", score: 88, issuesCount: 2 },
    { key: "seo", score: 54, issuesCount: 6 },
    { key: "security", score: 91, issuesCount: 1 },
  ];

  const overallScore = Math.round(
    categories.reduce((acc, c) => acc + c.score, 0) / categories.length
  );

  const criticalIssues: CriticalIssue[] = [
    {
      issue: "نبود تگ‌های متای توضیحات در صفحات کلیدی",
      impact: "high",
      effort: "easy",
      affectedPages: 12,
      recommendation:
        "برای هر صفحه یک توضیح متای منحصربه‌فرد بین ۱۵۰ تا ۱۶۰ کاراکتر بنویسید تا نرخ کلیک در نتایج جست‌وجو و درک موتورهای پاسخ‌دهی بهبود یابد.",
      codeExample: `<meta name="description"
  content="پلتفرم هوشمند تحلیل سئو معنایی برای برندهای ایرانی" />`,
    },
    {
      issue: "تصاویر بدون بارگذاری تنبل (Lazy Loading)",
      impact: "high",
      effort: "easy",
      affectedPages: 27,
      recommendation:
        "با افزودن ویژگی loading=\"lazy\" به تصاویر زیر خط تا (below the fold)، زمان بارگذاری اولیه و شاخص LCP را به‌طور محسوس کاهش دهید.",
      codeExample: `<img src="/hero.webp" alt="نمای محصول" loading="lazy" decoding="async" />`,
    },
    {
      issue: "نبود داده‌ساختاریافته (Schema.org / JSON-LD)",
      impact: "medium",
      effort: "medium",
      affectedPages: 8,
      recommendation:
        "با افزودن نشانه‌گذاری JSON-LD، به موتورهای هوش مصنوعی در درک موجودیت‌های برند و نمایش نتایج غنی کمک کنید.",
      codeExample: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "اپتیموس هوش مصنوعی",
  "url": "https://example.ir"
}
</script>`,
    },
    {
      issue: "تضاد رنگی ناکافی در دکمه‌های فراخوان",
      impact: "medium",
      effort: "easy",
      affectedPages: 5,
      recommendation:
        "نسبت تضاد رنگ متن و پس‌زمینه را حداقل به ۴٫۵ به ۱ برسانید تا معیار دسترس‌پذیری WCAG AA رعایت شود.",
    },
  ];

  return { overallScore, categories, criticalIssues };
}

/* -------------------------------------------------------------------------- */
/*                              Color Utilities                               */
/* -------------------------------------------------------------------------- */

function scoreBg(score: number) {
  if (score >= 80) return "bg-emerald-500/15";
  if (score >= 60) return "bg-amber-500/15";
  return "bg-red-500/15";
}

function scoreText(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function scoreBar(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

/* -------------------------------------------------------------------------- */
/*                            Category Card Piece                             */
/* -------------------------------------------------------------------------- */

const CategoryCard: React.FC<{
  category: CategoryResult;
  label: string;
  issuesSuffix: string;
  index: number;
}> = ({ category, label, issuesSuffix, index }) => {
  const Icon = CATEGORY_ICONS[category.key];
  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimatedWidth(category.score), 120 + index * 90);
    return () => clearTimeout(t);
  }, [category.score, index]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -6 }}
      className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-6 shadow-[var(--glass-shadow)] transition-shadow duration-300 hover:shadow-[0_20px_40px_rgba(56,189,248,0.15)]"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${scoreBg(category.score)}`}>
          <Icon size={24} className={scoreText(category.score)} />
        </div>
        <span className={`text-3xl font-black font-display leading-none ${scoreText(category.score)}`}>
          {category.score}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{label}</h3>

      <div className="h-2 bg-[var(--muted-surface)] rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${scoreBar(category.score)}`}
          initial={{ width: 0 }}
          animate={{ width: `${animatedWidth}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>

      <p className="text-xs text-[var(--text-muted)] mt-3 flex items-center gap-1.5">
        <span
          className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${scoreBg(
            category.score
          )} ${scoreText(category.score)}`}
        >
          {category.issuesCount}
        </span>
        <span>{issuesSuffix}</span>
      </p>
    </motion.div>
  );
};

/* -------------------------------------------------------------------------- */
/*                                Main Panel                                  */
/* -------------------------------------------------------------------------- */

export const TechnicalOptimizationPanel: React.FC = () => {
  const { language, direction } = useTheme();
  const isRtl = language === "fa";

  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const strings = {
    title: isRtl ? "بهینه‌سازی فنی وب‌سایت" : "Technical Optimization",
    desc: isRtl
      ? "پایش عملکرد، دسترس‌پذیری، سئوی فنی و امنیت وب‌سایت شما به همراه پیشنهادهای قابل اجرا."
      : "Audit performance, accessibility, technical SEO and security with actionable fixes.",
    placeholder: isRtl ? "آدرس کامل وب‌سایت (مثال: https://example.com)" : "Root website URL",
    analyze: isRtl ? "شروع بهینه‌سازی فنی" : "Run Technical Audit",
    analyzing: isRtl ? "در حال تحلیل..." : "Analyzing...",
    overall: isRtl ? "امتیاز کلی فنی" : "Overall Technical Score",
    categoriesTitle: isRtl ? "امتیاز دسته‌بندی‌ها" : "Category Scores",
    criticalTitle: isRtl ? "مشکلات بحرانی شناسایی‌شده" : "Detected Critical Issues",
    affected: isRtl ? "صفحه تحت تأثیر" : "affected pages",
    impactLabel: isRtl ? "تأثیر:" : "Impact:",
    effortLabel: isRtl ? "تلاش:" : "Effort:",
    errorEmpty: isRtl ? "لطفاً آدرس وب‌سایت را وارد کنید." : "Please enter a website URL.",
  };

  const categoryLabels: Record<CategoryKey, string> = {
    performance: isRtl ? "عملکرد" : "Performance",
    accessibility: isRtl ? "دسترس‌پذیری" : "Accessibility",
    seo: isRtl ? "سئوی فنی" : "Technical SEO",
    security: isRtl ? "امنیت" : "Security",
  };

  const steps: { label: string; icon: LucideIcon }[] = [
    { label: isRtl ? "در حال خزش صفحات سایت..." : "Crawling site pages...", icon: Globe },
    { label: isRtl ? "تحلیل عملکرد و سرعت..." : "Analyzing performance...", icon: Zap },
    { label: isRtl ? "بررسی دسترس‌پذیری..." : "Checking accessibility...", icon: Accessibility },
    { label: isRtl ? "ارزیابی امنیت و سئوی فنی..." : "Evaluating security & SEO...", icon: Shield },
    { label: isRtl ? "تولید پیشنهادهای بهینه‌سازی..." : "Generating recommendations...", icon: Sparkles },
  ];

  const impactText = (impact: CriticalIssue["impact"]) =>
    isRtl
      ? impact === "high" ? "زیاد" : impact === "medium" ? "متوسط" : "کم"
      : impact === "high" ? "High" : impact === "medium" ? "Medium" : "Low";

  const effortText = (effort: CriticalIssue["effort"]) =>
    isRtl
      ? effort === "easy" ? "آسان" : effort === "medium" ? "متوسط" : "سخت"
      : effort === "easy" ? "Easy" : effort === "medium" ? "Medium" : "Hard";

  // Clean up any pending timers on unmount
  useEffect(() => {
    return () => {
      stepTimers.current.forEach(clearTimeout);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError(strings.errorEmpty);
      return;
    }

    setError(null);
    setResult(null);
    setExpanded(null);
    setCurrentStep(0);
    setStatus("loading");

    // Clear previous timers
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = [];

    // Animate through the steps, then reveal the (mock) result
    const stepDuration = 750;
    steps.forEach((_, idx) => {
      const t = setTimeout(() => setCurrentStep(idx), idx * stepDuration);
      stepTimers.current.push(t);
    });

    const finish = setTimeout(() => {
      setResult(buildMockResult());
      setStatus("done");
    }, steps.length * stepDuration);
    stepTimers.current.push(finish);
  };

  return (
    <div className="space-y-6 animate-fade-in" dir={direction}>
      {/* Input Card */}
      <Card className="border border-white/[0.06] bg-white/[0.01] backdrop-blur-md shadow-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-[var(--sky-blue-500)] to-[var(--orange-500)] rounded-xl text-white shadow-lg">
              <Wrench size={18} />
            </div>
            <div>
              <CardTitle>{strings.title}</CardTitle>
              <CardDescription>{strings.desc}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className={`absolute top-1/2 -translate-y-1/2 text-[var(--text-muted)] ${isRtl ? "right-4" : "left-4"}`}
              />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={strings.placeholder}
                disabled={status === "loading"}
                className={`w-full py-3 text-xs rounded-xl outline-none transition-all duration-300 bg-[var(--muted-surface)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--sky-blue-500)] focus:ring-1 focus:ring-[var(--sky-blue-500)]/30 placeholder:text-[var(--text-muted)] ${
                  isRtl ? "pr-11 pl-4" : "pl-11 pr-4"
                }`}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={status === "loading" || !url.trim()}
              className="gap-2 px-6 py-3 font-bold rounded-xl bg-gradient-to-r from-[var(--sky-blue-500)] to-[var(--orange-500)] border-none text-white shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all duration-300"
            >
              {status === "loading" ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{strings.analyzing}</span>
                </>
              ) : (
                <>
                  <Gauge size={16} />
                  <span>{strings.analyze}</span>
                </>
              )}
            </Button>
          </form>

          {error && (
            <div className="mt-4 p-4 rounded-xl border border-red-500/10 bg-red-500/5 text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          {/* Multi-step loader */}
          {status === "loading" && (
            <div className="mt-6 space-y-3">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isActive = idx === currentStep;
                const isCompleted = idx < currentStep;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
                      isActive
                        ? "bg-[var(--sky-blue-500)]/15 border-[var(--sky-blue-500)]/40"
                        : isCompleted
                          ? "bg-emerald-500/10 border-emerald-500/25"
                          : "bg-[var(--muted-surface)]/40 border-transparent"
                    }`}
                  >
                    <Icon
                      size={18}
                      className={
                        isCompleted
                          ? "text-emerald-400"
                          : isActive
                            ? "text-[var(--sky-blue-500)]"
                            : "text-[var(--text-muted)]"
                      }
                    />
                    <span
                      className={`text-sm ${
                        isCompleted
                          ? "text-emerald-400"
                          : isActive
                            ? "text-[var(--text-primary)]"
                            : "text-[var(--text-muted)]"
                      }`}
                    >
                      {step.label}
                    </span>
                    {isActive && (
                      <Loader2 size={16} className={`animate-spin text-[var(--sky-blue-500)] ${isRtl ? "mr-auto" : "ml-auto"}`} />
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <AnimatePresence>
        {status === "done" && result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Overall + category cards */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Gauge size={16} className="text-[var(--sky-blue-500)]" />
                  {strings.categoriesTitle}
                </h3>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>{strings.overall}</span>
                  <span className={`text-lg font-black font-display ${scoreText(result.overallScore)}`}>
                    {result.overallScore}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {result.categories.map((cat, idx) => (
                  <CategoryCard
                    key={cat.key}
                    category={cat}
                    label={categoryLabels[cat.key]}
                    issuesSuffix={isRtl ? "مورد نیاز به بهبود" : "issues to fix"}
                    index={idx}
                  />
                ))}
              </div>
            </div>

            {/* Critical issues */}
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4">
                <AlertTriangle size={16} className="text-red-400" />
                {strings.criticalTitle}
              </h3>

              <div className="space-y-3">
                {result.criticalIssues.map((issue, idx) => {
                  const isOpen = expanded === idx;
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : idx)}
                        aria-expanded={isOpen}
                        className="w-full text-start p-4 cursor-pointer hover:bg-[var(--muted-surface)] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <AlertTriangle
                              size={20}
                              className={issue.impact === "high" ? "text-red-400 flex-shrink-0" : "text-amber-400 flex-shrink-0"}
                            />
                            <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">{issue.issue}</h4>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`px-2 py-1 text-[10px] font-bold rounded-full ${
                                issue.impact === "high"
                                  ? "bg-red-500/15 text-red-400"
                                  : "bg-amber-500/15 text-amber-400"
                              }`}
                            >
                              {issue.impact === "high" ? (isRtl ? "بحرانی" : "Critical") : isRtl ? "هشدار" : "Warning"}
                            </span>
                            <ChevronDown
                              size={16}
                              className={`text-[var(--text-muted)] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-2">
                          {issue.affectedPages} {strings.affected}
                        </p>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="border-t border-[var(--glass-border)] bg-[var(--muted-surface)]/30 overflow-hidden"
                          >
                            <div className="p-4 space-y-3">
                              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{issue.recommendation}</p>
                              {issue.codeExample && (
                                <pre
                                  dir="ltr"
                                  className="bg-[var(--card-bg)] border border-[var(--border)] p-3 rounded-lg overflow-x-auto text-xs text-[var(--text-primary)] font-mono text-left"
                                >
                                  <code>{issue.codeExample}</code>
                                </pre>
                              )}
                              <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                                <span>
                                  {strings.impactLabel} <span className="font-semibold">{impactText(issue.impact)}</span>
                                </span>
                                <span>
                                  {strings.effortLabel} <span className="font-semibold">{effortText(issue.effort)}</span>
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
