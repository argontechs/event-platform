"use client";

import { useActionState } from "react";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";
import type { CompanyFormState } from "@/lib/companies/actions";
import type { CompanyFormValues } from "@/lib/companies/schema";

type Action = (
  prev: CompanyFormState,
  formData: FormData,
) => Promise<CompanyFormState>;

const initialState: CompanyFormState = { error: "" };

const EMPTY: CompanyFormValues = {
  name: "",
  legalName: "",
  ssmRegNo: "",
  sstRegistered: false,
  sstRegNo: "",
  sstRate: "8.00",
  logoUrl: "",
  brandPrimary: "#2f6fed",
  brandSecondary: "#2a2440",
  brandFont: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postcode: "",
  phone: "",
  email: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNo: "",
  duitnowQrUrl: "",
  quotePrefix: "Q",
  invoicePrefix: "INV",
  defaultProfitPercent: "30.00",
  defaultDepositPercent: "50.00",
  defaultLanguage: "EN",
  customDomains: "",
  aiEnabled: true,
  aiModel: "gpt-4o",
  waPhoneNumberId: "",
  waBusinessId: "",
  waBotEnabled: true,
  waBotContext: "",
  termsAndConditions: "",
  seoTitle: "",
  seoDescription: "",
  ogImageUrl: "",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  youtubeUrl: "",
  cloudflareZoneId: "",
};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-5">
      <legend className="px-2 text-sm font-medium text-accent">{title}</legend>
      {hint ? <p className="mb-3 text-xs text-slate-400">{hint}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
  error,
  full,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  error?: string;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent"
      />
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </label>
  );
}

export function CompanyForm({
  action,
  initial,
  aiKeySet = false,
  waTokenSet = false,
  cfTokenSet = false,
  submitLabel,
}: {
  action: Action;
  initial?: CompanyFormValues;
  aiKeySet?: boolean;
  waTokenSet?: boolean;
  cfTokenSet?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const t = makeT(useBoLang());
  const v = initial ?? EMPTY;
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-5">
      <Section title={t("Identity")}>
        <Field name="name" label={t("Company name")} defaultValue={v.name} error={fe.name} />
        <Field name="legalName" label={t("Legal name (Sdn Bhd)")} defaultValue={v.legalName} />
        <Field name="ssmRegNo" label={t("SSM registration no.")} defaultValue={v.ssmRegNo} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Default language")}</span>
          <select
            name="defaultLanguage"
            defaultValue={v.defaultLanguage}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent"
          >
            <option value="EN">English</option>
            <option value="MS">Bahasa Malaysia</option>
            <option value="ZH">中文</option>
          </select>
        </label>
      </Section>

      <Section title={t("SST")} hint={t("Some companies are SST-registered, some are not. This drives quotes & invoices (overridable per document).")}>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="sstRegistered" defaultChecked={v.sstRegistered} />
          <span className="text-slate-800">{t("This company is SST-registered")}</span>
        </label>
        <Field name="sstRegNo" label={t("SST registration no.")} defaultValue={v.sstRegNo} />
        <Field name="sstRate" label={t("SST rate (%)")} defaultValue={v.sstRate} error={fe.sstRate} />
      </Section>

      <Section title={t("Branding")} hint={t("Drives the company's site, quotes, invoices and emails.")}>
        <Field name="logoUrl" label={t("Logo URL")} defaultValue={v.logoUrl} full />
        <Field name="brandPrimary" label={t("Primary colour (hex)")} defaultValue={v.brandPrimary} />
        <Field name="brandSecondary" label={t("Secondary colour (hex)")} defaultValue={v.brandSecondary} />
        <Field name="brandFont" label={t("Brand font")} defaultValue={v.brandFont} />
      </Section>

      <Section title={t("Contact & address")}>
        <Field name="email" label={t("Email")} type="email" defaultValue={v.email} error={fe.email} />
        <Field name="phone" label={t("Phone")} defaultValue={v.phone} placeholder="+60 3-1234 5678" />
        <Field name="addressLine1" label={t("Address line 1")} defaultValue={v.addressLine1} full />
        <Field name="addressLine2" label={t("Address line 2")} defaultValue={v.addressLine2} full />
        <Field name="city" label={t("City")} defaultValue={v.city} />
        <Field name="state" label={t("State")} defaultValue={v.state} />
        <Field name="postcode" label={t("Postcode")} defaultValue={v.postcode} />
      </Section>

      <Section title={t("Payment details")} hint={t("Manual deposit flow — shown to customers on the quote page.")}>
        <Field name="bankName" label={t("Bank name")} defaultValue={v.bankName} />
        <Field name="bankAccountName" label={t("Account name")} defaultValue={v.bankAccountName} />
        <Field name="bankAccountNo" label={t("Account number")} defaultValue={v.bankAccountNo} />
        <Field name="duitnowQrUrl" label={t("DuitNow QR image URL")} defaultValue={v.duitnowQrUrl} />
      </Section>

      <Section title={t("Quoting & numbering")}>
        <Field name="quotePrefix" label={t("Quote number prefix")} defaultValue={v.quotePrefix} error={fe.quotePrefix} />
        <Field name="invoicePrefix" label={t("Invoice number prefix")} defaultValue={v.invoicePrefix} error={fe.invoicePrefix} />
        <Field name="defaultProfitPercent" label={t("Default profit %")} defaultValue={v.defaultProfitPercent} error={fe.defaultProfitPercent} />
        <Field name="defaultDepositPercent" label={t("Default deposit %")} defaultValue={v.defaultDepositPercent} error={fe.defaultDepositPercent} />
      </Section>

      <Section title={t("Public site")} hint={t("Each company runs on its own custom domain(s). Comma or newline separated.")}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600">{t("Custom domains")}</span>
          <textarea
            name="customDomains"
            defaultValue={v.customDomains}
            rows={2}
            placeholder="acme-events.com, www.acme-events.com"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent"
          />
        </label>
      </Section>

      <Section title={t("AI (smart quoting)")} hint={t("Powered by OpenAI. The API key is encrypted at rest — leave blank to keep the existing one. Used for quote drafting, the WhatsApp bot, receipt OCR, and concept image generation.")}>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="aiEnabled" defaultChecked={v.aiEnabled} />
          <span className="text-slate-800">{t("Enable AI planning & quotation")}</span>
        </label>
        <Field
          name="aiModel"
          label={t("AI model")}
          defaultValue={v.aiModel}
          error={fe.aiModel}
          placeholder="gpt-4o"
        />
        <Field
          name="aiApiKey"
          label={t("OpenAI API key")}
          type="password"
          placeholder={aiKeySet ? t("•••••••• (saved — leave blank to keep)") : "sk-…"}
          full
        />
      </Section>

      <Section title={t("SEO & marketing")} hint={t("Used in the public site's page title, description and social share preview.")}>
        <Field name="seoTitle" label={t("SEO title")} defaultValue={v.seoTitle} placeholder="Party Eventilicious — Event & Balloon Decor" full />
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600">{t("SEO description")}</span>
          <textarea name="seoDescription" defaultValue={v.seoDescription} rows={2}
            placeholder="Premium event styling, backdrops and balloon decor in Johor & KL."
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent" />
        </label>
        <Field name="ogImageUrl" label={t("Social share image URL (OG image)")} defaultValue={v.ogImageUrl} full />
      </Section>

      <Section title={t("Social accounts")} hint={t("Linked in the public site footer.")}>
        <Field name="facebookUrl" label={t("Facebook URL")} defaultValue={v.facebookUrl} placeholder="https://facebook.com/…" />
        <Field name="instagramUrl" label={t("Instagram URL")} defaultValue={v.instagramUrl} placeholder="https://instagram.com/…" />
        <Field name="tiktokUrl" label={t("TikTok URL")} defaultValue={v.tiktokUrl} placeholder="https://tiktok.com/@…" />
        <Field name="youtubeUrl" label={t("YouTube URL")} defaultValue={v.youtubeUrl} placeholder="https://youtube.com/@…" />
      </Section>

      <Section title={t("Custom domain (Cloudflare)")} hint={t("Paste a Cloudflare API token + Zone ID, then bind a domain on the company page. Token is encrypted at rest — leave blank to keep the existing one.")}>
        <Field name="cloudflareZoneId" label={t("Cloudflare Zone ID")} defaultValue={v.cloudflareZoneId} />
        <Field name="cloudflareApiToken" label={t("Cloudflare API token")} type="password"
          placeholder={cfTokenSet ? t("•••••••• (saved — leave blank to keep)") : "DNS:Edit token"} />
      </Section>

      <Section title={t("Terms & Conditions")} hint={t("Printed on the last page of every quotation and invoice.")}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600">{t("Terms & conditions")}</span>
          <textarea
            name="termsAndConditions"
            defaultValue={v.termsAndConditions}
            rows={6}
            placeholder={t("Deposit, payment, refund, design-change and other terms…")}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent"
          />
        </label>
      </Section>

      <Section title={t("WhatsApp Business")} hint={t("Meta Cloud API. Point your Meta webhook at /api/whatsapp/webhook. Access token is encrypted at rest — leave blank to keep the existing one.")}>
        <Field name="waPhoneNumberId" label={t("Phone number ID")} defaultValue={v.waPhoneNumberId} placeholder="1029384756…" />
        <Field name="waBusinessId" label={t("WhatsApp Business account ID")} defaultValue={v.waBusinessId} />
        <Field
          name="waAccessToken"
          label={t("Access token")}
          type="password"
          placeholder={waTokenSet ? t("•••••••• (saved — leave blank to keep)") : "EAAG…"}
          full
        />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="waBotEnabled" defaultChecked={v.waBotEnabled} />
          <span className="text-slate-800">{t("Auto-reply enquiry bot (answers questions & creates a lead)")}</span>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600">{t("Bot knowledge (services, pricing, FAQ)")}</span>
          <textarea
            name="waBotContext"
            defaultValue={v.waBotContext}
            rows={5}
            placeholder={t("What the AI bot may tell customers: services, typical packages & pricing, areas covered, lead time, FAQs. With AI enabled, the bot answers from this and captures the lead. Leave blank to only collect enquiry details.")}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent"
          />
        </label>
      </Section>

      {state.error ? (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? t("Saving…") : submitLabel}
        </button>
      </div>
    </form>
  );
}
