import type { Locale } from "./config";
import en from "./dictionaries/en.json";
import ms from "./dictionaries/ms.json";
import zh from "./dictionaries/zh.json";

export interface Dictionary {
  nav: {
    services: string;
    packages: string;
    portfolio: string;
    about: string;
    contact: string;
    enquire: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cta: string;
    secondary: string;
  };
  services: {
    title: string;
    subtitle: string;
    items: { title: string; desc: string }[];
  };
  showcase: {
    title: string;
    subtitle: string;
    emptyBody: string;
    emptyInstagram: string;
    emptyPackages: string;
    imageAlt: string;
  };
  about: { title: string; body: string };
  contact: { title: string; subtitle: string; cta: string };
  footer: { tagline: string; rights: string };
  stats: {
    events: string;
    years: string;
    designs: string;
    love: string;
  };
  packages: {
    title: string;
    subtitle: string;
    comingSoon: string;
    enquireNow: string;
    included: string;
    otherCategory: string;
    pagination: string;
  };
  quote: {
    quotation: string;
    preparedFor: string;
    status: Record<string, string>;
    draftNotice: string;
    changesReceived: string;
    expiredNotice: string;
    contactLabel: string;
    replyHint: string;
    referenceAlt: string;
    payment: {
      title: string;
      depositDue: string;
      bankTransfer: string;
      duitnowQr: string;
      copy: string;
      copied: string;
      scanToPay: string;
      qrNotConfigured: string;
      methods: Record<string, string>;
      statuses: Record<string, string>;
    };
    gate: {
      title: string;
      subtitle: string;
      placeholder: string;
      opening: string;
      view: string;
    };
    accept: { cta: string; processing: string };
    changes: {
      success: string;
      open: string;
      prompt: string;
      placeholder: string;
      sending: string;
      send: string;
      cancel: string;
    };
    proof: {
      success: string;
      amount: string;
      method: string;
      reference: string;
      file: string;
      uploading: string;
      submit: string;
    };
    errors: Record<string, string>;
  };
  form: {
    title: string;
    subtitle: string;
    steps: string[];
    fields: {
      eventType: string;
      eventDate: string;
      eventTime: string;
      venue: string;
      theme: string;
      budget: string;
      purpose: string;
      guestCount: string;
      images: string;
      imagesHint: string;
      specialRequest: string;
      name: string;
      email: string;
      phone: string;
      language: string;
    };
    eventTypes: Record<string, string>;
    budgets: Record<string, string>;
    next: string;
    back: string;
    submit: string;
    submitting: string;
    success: { title: string; body: string; ref: string; home: string };
    errorGeneric: string;
    errors: Record<string, string>;
  };
}

const dictionaries: Record<Locale, Dictionary> = {
  en: en as Dictionary,
  ms: ms as Dictionary,
  zh: zh as Dictionary,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
