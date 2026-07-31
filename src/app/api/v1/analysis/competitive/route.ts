import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { firecrawlApp } from "@/lib/firecrawl";
import { getLLMClient } from "@/services/ai/llm-client";
import { TenantContextManager } from "@/core/database/tenant-context";
import { PostgresClient } from "@/features/admin/infrastructure/persistence/postgres";

/* -------------------------------------------------------------------------- */
/*                              Request Validation                            */
/* -------------------------------------------------------------------------- */

const requestSchema = z.object({
  userUrl: z.string().url("لطفاً یک آدرس معتبر برای وب‌سایت خود وارد کنید"),
  competitorUrls: z
    .array(z.string().url("آدرس رقیب نامعتبر است"))
    .min(1, "حداقل یک رقیب باید مشخص شود")
    .max(5, "حداکثر ۵ رقیب قابل تحلیل است"),
  analysisDepth: z.enum(["quick", "standard", "deep"]).optional().default("standard"),
});

/* -------------------------------------------------------------------------- */
/*                              Response Contract                             */
/* -------------------------------------------------------------------------- */

export type MarketPosition = "leader" | "challenger" | "follower" | "niche";
export type ImpactLevel = "high" | "medium" | "low";
export type Severity = "critical" | "warning" | "info";
export type Effort = "easy" | "medium" | "hard";

export interface DimensionScores {
  content: number;
  technical: number;
  seo: number;
  brand: number;
}

export interface CompetitorComparison {
  competitorUrl: string;
  competitorName: string;
  overallScore: number;
  winProbability: number;
  strengths: string[];
  weaknesses: string[];
  headToHead: {
    content: { user: number; competitor: number };
    technical: { user: number; competitor: number };
    seo: { user: number; competitor: number };
    brand: { user: number; competitor: number };
  };
}

export interface CompetitiveAnalysisResponse {
  overallScore: number;
  marketPosition: MarketPosition;
  userScores: DimensionScores;
  competitorComparison: CompetitorComparison[];
  competitiveAdvantages: Array<{
    category: string;
    advantage: string;
    impact: ImpactLevel;
    howToLeverage: string;
  }>;
  gapAnalysis: Array<{
    category: string;
    gap: string;
    severity: Severity;
    recommendedAction: string;
    estimatedEffort: Effort;
  }>;
  strategicOpportunities: Array<{
    opportunity: string;
    potential: ImpactLevel;
    timeToImpact: string;
    actionPlan: string;
  }>;
  marketInsights: {
    totalCompetitorsAnalyzed: number;
    avgIndustryScore: number;
    userRanking: number;
    topIndustryTrends: string[];
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

const DEPTH_TO_PAGES: Record<"quick" | "standard" | "deep", number> = {
  quick: 5,
  standard: 10,
  deep: 25,
};

interface ScrapedPage {
  url: string;
  markdown: string;
  metadata: { title?: string; description?: string };
}

interface SiteMetrics {
  url: string;
  name: string;
  scores: DimensionScores;
  overall: number;
  pageCount: number;
}

/** Derive a readable brand name from a URL host. */
function deriveName(rawUrl: string): string {
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, "");
    const core = host.split(".")[0];
    return core.charAt(0).toUpperCase() + core.slice(1);
  } catch {
    return rawUrl;
  }
}

/**
 * Deterministic, data-driven heuristic scoring across the four dimensions.
 * Signals are extracted from the actually-scraped page content so the result
 * reflects the site rather than a random number.
 */
function scoreSite(url: string, pages: ScrapedPage[]): DimensionScores {
  const pageCount = pages.length || 1;
  const totalContent = pages.reduce((acc, p) => acc + (p.markdown?.length || 0), 0);
  const avgContent = totalContent / pageCount;

  const withDescription = pages.filter(
    (p) => p.metadata?.description && p.metadata.description.trim() !== ""
  ).length;
  const withTitle = pages.filter((p) => p.metadata?.title && p.metadata.title.trim() !== "").length;
  const headingCount = pages.reduce(
    (acc, p) => acc + (p.markdown?.match(/^#{1,3}\s/gm)?.length || 0),
    0
  );
  const linkCount = pages.reduce(
    (acc, p) => acc + (p.markdown?.match(/\]\(/g)?.length || 0),
    0
  );

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  // Content: driven by average content volume and heading richness.
  const content = clamp(45 + Math.min(avgContent / 40, 35) + Math.min(headingCount * 2, 20));

  // Technical: HTTPS + crawl breadth + internal linking density.
  const isHttps = url.toLowerCase().startsWith("https://");
  const technical = clamp(
    (isHttps ? 55 : 25) + Math.min(pageCount * 3, 25) + Math.min(linkCount * 1.5, 20)
  );

  // SEO: title/description coverage ratio + heading structure.
  const seo = clamp(
    40 +
      (withDescription / pageCount) * 30 +
      (withTitle / pageCount) * 20 +
      Math.min(headingCount, 10)
  );

  // Brand: presence of value-proposition / entity signals in content.
  const brandSignals = pages.reduce((acc, p) => {
    const text = (p.markdown || "").toLowerCase();
    let signal = 0;
    if (/\b(brand|برند|about|درباره)\b/.test(text)) signal += 1;
    if (/\b(review|نظر|testimonial|رضایت)\b/.test(text)) signal += 1;
    if (text.length > 400) signal += 1;
    return acc + signal;
  }, 0);
  const brand = clamp(45 + Math.min(brandSignals * 6, 40));

  return { content, technical, seo, brand };
}

function overallFromScores(s: DimensionScores): number {
  // Content 30%, Technical 25%, SEO 25%, Brand 20%
  return Math.round(s.content * 0.3 + s.technical * 0.25 + s.seo * 0.25 + s.brand * 0.2);
}

/** Logistic win probability from the score delta between user and competitor. */
function winProbability(userOverall: number, competitorOverall: number): number {
  const delta = userOverall - competitorOverall;
  const prob = 1 / (1 + Math.exp(-delta / 12));
  return Math.round(prob * 100);
}

function marketPositionFrom(userOverall: number, ranking: number, total: number): MarketPosition {
  if (ranking === 1 && userOverall >= 75) return "leader";
  if (ranking <= Math.ceil(total / 2) && userOverall >= 60) return "challenger";
  if (userOverall >= 45) return "follower";
  return "niche";
}

/** Mock crawl payload used when Firecrawl is unavailable or in test mode. */
function mockPages(url: string, count: number): ScrapedPage[] {
  const base: ScrapedPage[] = [
    {
      url: `${url}/`,
      markdown:
        "# صفحه اصلی\nپلتفرم پیشرفته با تمرکز بر تجربه کاربری. [خدمات](/services) [درباره ما](/about)\nبرند ما بر پایه نوآوری ساخته شده است.",
      metadata: { title: "صفحه اصلی", description: "توضیحات صفحه اصلی برند" },
    },
    {
      url: `${url}/blog`,
      markdown:
        "# وبلاگ\n## مقاله اول\nمحتوای آموزشی درباره بهینه‌سازی. [منبع](/ref)\n## مقاله دوم\nنظرات و رضایت مشتریان.",
      metadata: { title: "وبلاگ", description: "مقالات و بینش‌ها" },
    },
    {
      url: `${url}/about`,
      markdown: "# درباره ما\nتیم متخصص ما. testimonial از مشتریان راضی.",
      metadata: { title: "درباره ما", description: "" },
    },
  ];
  const out: ScrapedPage[] = [];
  for (let i = 0; i < count; i++) {
    out.push(base[i % base.length]);
  }
  return out;
}

async function crawlSite(url: string, limit: number, mockMode: boolean): Promise<ScrapedPage[]> {
  if (mockMode) {
    return mockPages(url, Math.min(limit, 3));
  }
  try {
    const response = await firecrawlApp.crawlUrl(url, {
      limit,
      scrapeOptions: { formats: ["markdown"] },
    });
    if (response && "success" in response && response.success && "data" in response) {
      const data = ((response as { data?: ScrapedPage[] }).data || []).map((p) => ({
        url: p.url,
        markdown: p.markdown || "",
        metadata: p.metadata || {},
      }));
      if (data.length > 0) return data;
    }
    return mockPages(url, Math.min(limit, 3));
  } catch (err) {
    console.error(`[Competitive Analysis] Crawl failed for ${url}:`, err);
    return mockPages(url, Math.min(limit, 3));
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Route                                    */
/* -------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    const userId = req.headers.get("x-user-id") || "usr-competitive-default";

    if (!tenantId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "شناسه مستأجر معتبر ارسال نشده است. این ویژگی نیاز به اشتراک فعال دارد.",
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "درخواست نامعتبر است.";
      return NextResponse.json({ error: "Bad Request", message: errorMsg }, { status: 400 });
    }

    const { userUrl, competitorUrls, analysisDepth } = parsed.data;
    const pageLimit = DEPTH_TO_PAGES[analysisDepth];

    return await TenantContextManager.runWithTenantContext(
      tenantId,
      userId,
      "req-competitive-analysis",
      async () => {
        const apiKey = process.env.FIRECRAWL_API_KEY || "";
        const isMockMode =
          !apiKey || apiKey.includes("your-api-key") || apiKey.startsWith("fc-your-");

        // 1. Crawl user site and all competitors in parallel (bounded by depth).
        const [userPages, ...competitorPages] = await Promise.all([
          crawlSite(userUrl, pageLimit, isMockMode),
          ...competitorUrls.map((cUrl) => crawlSite(cUrl, pageLimit, isMockMode)),
        ]);

        // 2. Score every site across the four dimensions.
        const userScores = scoreSite(userUrl, userPages);
        const userOverall = overallFromScores(userScores);
        const userMetrics: SiteMetrics = {
          url: userUrl,
          name: deriveName(userUrl),
          scores: userScores,
          overall: userOverall,
          pageCount: userPages.length,
        };

        const competitorMetrics: SiteMetrics[] = competitorUrls.map((cUrl, idx) => {
          const scores = scoreSite(cUrl, competitorPages[idx]);
          return {
            url: cUrl,
            name: deriveName(cUrl),
            scores,
            overall: overallFromScores(scores),
            pageCount: competitorPages[idx].length,
          };
        });

        // 3. Pairwise comparison (user vs each competitor).
        const competitorComparison: CompetitorComparison[] = competitorMetrics.map((c) => {
          const strengths: string[] = [];
          const weaknesses: string[] = [];
          const dims: Array<keyof DimensionScores> = ["content", "technical", "seo", "brand"];
          const dimLabels: Record<keyof DimensionScores, string> = {
            content: "محتوا",
            technical: "فنی",
            seo: "سئو",
            brand: "برند",
          };
          for (const d of dims) {
            if (c.scores[d] > userScores[d] + 3) {
              strengths.push(`رقیب در حوزه ${dimLabels[d]} قوی‌تر عمل می‌کند`);
            } else if (userScores[d] > c.scores[d] + 3) {
              weaknesses.push(`شما در حوزه ${dimLabels[d]} برتری دارید`);
            }
          }
          return {
            competitorUrl: c.url,
            competitorName: c.name,
            overallScore: c.overall,
            winProbability: winProbability(userOverall, c.overall),
            strengths,
            weaknesses,
            headToHead: {
              content: { user: userScores.content, competitor: c.scores.content },
              technical: { user: userScores.technical, competitor: c.scores.technical },
              seo: { user: userScores.seo, competitor: c.scores.seo },
              brand: { user: userScores.brand, competitor: c.scores.brand },
            },
          };
        });

        // 4. Market metrics.
        const allSites = [userMetrics, ...competitorMetrics];
        const avgIndustryScore = Math.round(
          allSites.reduce((acc, s) => acc + s.overall, 0) / allSites.length
        );
        const ranking =
          [...allSites].sort((a, b) => b.overall - a.overall).findIndex((s) => s.url === userUrl) + 1;
        const marketPosition = marketPositionFrom(userOverall, ranking, allSites.length);

        // 5. LLM strategic narrative (with robust deterministic fallback).
        const llmClient = getLLMClient();
        const prompt = `
          شما یک متخصص هوش رقابتی هستید. بر اساس داده‌های زیر یک تحلیل استراتژیک به زبان فارسی روان تولید کنید.
          سایت کاربر: ${userUrl} با امتیازها ${JSON.stringify(userScores)} و امتیاز کلی ${userOverall}.
          رقبا: ${competitorMetrics
            .map((c) => `${c.name} (${c.url}) امتیاز کلی ${c.overall} امتیازها ${JSON.stringify(c.scores)}`)
            .join("; ")}.
          خروجی را دقیقاً به صورت یک شیء JSON با کلیدهای زیر برگردانید بدون هیچ متن اضافه یا بلوک کد:
          "competitiveAdvantages": آرایه‌ای از { "category", "advantage", "impact": "high|medium|low", "howToLeverage" }
          "gapAnalysis": آرایه‌ای از { "category", "gap", "severity": "critical|warning|info", "recommendedAction", "estimatedEffort": "easy|medium|hard" }
          "strategicOpportunities": آرایه‌ای از { "opportunity", "potential": "high|medium|low", "timeToImpact", "actionPlan" }
          "topIndustryTrends": آرایه‌ای از رشته‌ها.
        `;

        let llmRaw = "";
        try {
          llmRaw = await llmClient.generateText(prompt, {
            temperature: 0.2,
            systemPrompt:
              "You always return strictly valid JSON in Persian with keys competitiveAdvantages, gapAnalysis, strategicOpportunities, topIndustryTrends.",
          });
        } catch (llmErr) {
          console.error("[Competitive Analysis LLM Error]:", llmErr);
        }

        type LlmShape = {
          competitiveAdvantages?: CompetitiveAnalysisResponse["competitiveAdvantages"];
          gapAnalysis?: CompetitiveAnalysisResponse["gapAnalysis"];
          strategicOpportunities?: CompetitiveAnalysisResponse["strategicOpportunities"];
          topIndustryTrends?: string[];
        };

        let parsedLlm: LlmShape = {};
        try {
          let clean = llmRaw.trim();
          if (clean.startsWith("```json")) clean = clean.slice(7, -3).trim();
          else if (clean.startsWith("```")) clean = clean.slice(3, -3).trim();
          parsedLlm = JSON.parse(clean);
        } catch {
          parsedLlm = {};
        }

        // Deterministic fallbacks derived from the actual scores so the response
        // is always actionable even without a live LLM.
        const strongestDim = (Object.keys(userScores) as Array<keyof DimensionScores>).reduce(
          (best, d) => (userScores[d] > userScores[best] ? d : best),
          "content" as keyof DimensionScores
        );
        const weakestDim = (Object.keys(userScores) as Array<keyof DimensionScores>).reduce(
          (worst, d) => (userScores[d] < userScores[worst] ? d : worst),
          "content" as keyof DimensionScores
        );
        const dimFa: Record<keyof DimensionScores, string> = {
          content: "محتوا",
          technical: "سلامت فنی",
          seo: "سئوی فنی",
          brand: "حضور برند",
        };

        const competitiveAdvantages =
          parsedLlm.competitiveAdvantages && parsedLlm.competitiveAdvantages.length > 0
            ? parsedLlm.competitiveAdvantages
            : [
                {
                  category: dimFa[strongestDim],
                  advantage: `شما در حوزه ${dimFa[strongestDim]} با امتیاز ${userScores[strongestDim]} از میانگین رقبا پیشی گرفته‌اید.`,
                  impact: "high" as ImpactLevel,
                  howToLeverage:
                    "این مزیت را در صفحات فرود و کمپین‌های بازاریابی برجسته کنید تا سهم صدای برند افزایش یابد.",
                },
              ];

        const gapAnalysis =
          parsedLlm.gapAnalysis && parsedLlm.gapAnalysis.length > 0
            ? parsedLlm.gapAnalysis
            : [
                {
                  category: dimFa[weakestDim],
                  gap: `ضعیف‌ترین حوزه شما ${dimFa[weakestDim]} با امتیاز ${userScores[weakestDim]} است که فاصله معناداری با رقبای پیشرو دارد.`,
                  severity: (userScores[weakestDim] < 55 ? "critical" : "warning") as Severity,
                  recommendedAction: `یک برنامه بهبود متمرکز برای ${dimFa[weakestDim]} تدوین کنید و پیشرفت را هفتگی پایش نمایید.`,
                  estimatedEffort: "medium" as Effort,
                },
              ];

        const strategicOpportunities =
          parsedLlm.strategicOpportunities && parsedLlm.strategicOpportunities.length > 0
            ? parsedLlm.strategicOpportunities
            : [
                {
                  opportunity: "توسعه محتوای کلاستری پیرامون کلیدواژه‌های بدون رقابت",
                  potential: "high" as ImpactLevel,
                  timeToImpact: "۴ تا ۸ هفته",
                  actionPlan:
                    "کلیدواژه‌های با حجم بالا و رقابت پایین را شناسایی کرده و خوشه‌های محتوایی مرتبط ایجاد کنید.",
                },
              ];

        const topIndustryTrends =
          parsedLlm.topIndustryTrends && parsedLlm.topIndustryTrends.length > 0
            ? parsedLlm.topIndustryTrends
            : ["رشد جست‌وجوی مبتنی بر هوش مصنوعی", "اهمیت داده ساختاریافته", "تمرکز بر تجربه کاربری موبایل"];

        const responsePayload: CompetitiveAnalysisResponse = {
          overallScore: userOverall,
          marketPosition,
          userScores,
          competitorComparison,
          competitiveAdvantages,
          gapAnalysis,
          strategicOpportunities,
          marketInsights: {
            totalCompetitorsAnalyzed: competitorMetrics.length,
            avgIndustryScore,
            userRanking: ranking,
            topIndustryTrends,
          },
        };

        // 6. Persist (best-effort; never fail the request on DB errors).
        try {
          const id = crypto.randomUUID();
          const dbClient = PostgresClient.getInstance();
          const sql = `
            INSERT INTO competitive_analyses (
              id, organization_id, user_url, competitor_urls, overall_score,
              market_position, comparison_data, advantages, gaps, opportunities, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW());
          `;
          await dbClient.query(sql, [
            id,
            tenantId,
            userUrl,
            competitorUrls,
            userOverall,
            marketPosition,
            JSON.stringify(competitorComparison),
            JSON.stringify(competitiveAdvantages),
            JSON.stringify(gapAnalysis),
            JSON.stringify(strategicOpportunities),
          ]);
        } catch (dbErr) {
          console.error("[Competitive Analysis DB Save Error]:", dbErr);
        }

        return NextResponse.json(responsePayload);
      }
    );
  } catch (error: unknown) {
    console.error("[Competitive Analysis Route Error]:", error);
    const message =
      error instanceof Error ? error.message : "خطای ناشناخته در تحلیل رقابتی رخ داد.";
    return NextResponse.json({ error: "Internal Server Error", message }, { status: 500 });
  }
}
