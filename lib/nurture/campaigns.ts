// ─────────────────────────────────────────────────────────────
//  Predefined nurturing (drip) sequences. Defined in code (config,
//  not user-generated) for the MVP — move to a DB table later if
//  campaign editing in-app is needed. Templates support {{name}}
//  and {{product}} placeholders.
// ─────────────────────────────────────────────────────────────
import type { Campaign } from "../types";

export const CAMPAIGNS: Campaign[] = [
  {
    id: "warmup",
    name: "חימום ליד קר",
    description: "רצף 3 מסרים ללידים קרים שאינם בשלים — בונה עניין לאורך זמן.",
    audience: "cold",
    steps: [
      {
        channel: "whatsapp",
        delayHours: 24,
        template: "היי {{name}}, תודה על ההתעניינות! ריכזנו עבורך מידע קצר על {{product}}. אפשר לשלוח?",
      },
      {
        channel: "whatsapp",
        delayHours: 72,
        template: "{{name}}, רצינו לוודא שקיבלת את המידע. יש שאלה שנוכל לעזור בה?",
      },
      {
        channel: "email",
        delayHours: 120,
        template: "שלום {{name}}, מצרפים מקרה לקוח רלוונטי ל{{product}}. נשמח לתאם שיחה קצרה.",
      },
    ],
  },
  {
    id: "engage",
    name: "מעורבות ליד פושר",
    description: "רצף 2 מסרים ללידים פושרים — דוחף לפגישה/שיחה.",
    audience: "warm",
    steps: [
      {
        channel: "whatsapp",
        delayHours: 4,
        template: "{{name}}, אשמח לתאם שיחה קצרה על {{product}}. מתי נוח לך היום או מחר?",
      },
      {
        channel: "whatsapp",
        delayHours: 48,
        template: "{{name}}, עדיין רלוונטי? אפשר גם לשלוח הצעת מחיר ראשונית ל{{product}}.",
      },
    ],
  },
  {
    id: "crosssell",
    name: "הרחבה ללקוח קיים",
    description: "רצף Cross-sell/Upsell ללקוחות קיימים — ממנף את מערכת היחסים.",
    audience: "existing_customer",
    steps: [
      {
        channel: "whatsapp",
        delayHours: 2,
        template: "היי {{name}}, כלקוח שלנו — הכנו לך הצעה משתלמת ל{{product}}. אפשר לפרט?",
      },
      {
        channel: "email",
        delayHours: 72,
        template: "שלום {{name}}, כהטבת לקוח קיים מצורפת הצעה ל{{product}}. נשמח לעדכן אותך.",
      },
    ],
  },
];

export function getCampaign(id: string): Campaign | undefined {
  return CAMPAIGNS.find((c) => c.id === id);
}

export function renderTemplate(tpl: string, vars: { name?: string | null; product?: string | null }): string {
  return tpl
    .replaceAll("{{name}}", vars.name?.trim() || "שלום")
    .replaceAll("{{product}}", vars.product?.trim() || "המוצרים שלנו");
}
