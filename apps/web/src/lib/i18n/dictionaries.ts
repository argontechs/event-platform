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
  showcase: { title: string; subtitle: string };
  about: { title: string; body: string };
  contact: { title: string; subtitle: string; cta: string };
  footer: { tagline: string; rights: string };
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
