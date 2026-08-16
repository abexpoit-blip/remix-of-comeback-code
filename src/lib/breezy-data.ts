/**
 * Static catalog + blog data for breezysocial.com gadget/lifestyle storefront.
 * Hardcoded (no DB) so SSR is instant and FB crawlers always see real content.
 *
 * Affiliate-style storefront — no real checkout. "Buy Now" links go to the
 * product detail page only. This exists purely to give breezysocial.com the
 * appearance of a real ecommerce business to social platform crawlers.
 */

export type Product = {
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  category: string;
  shortDesc: string;
  longDesc: string;
  features: string[];
  specs: Record<string, string>;
  inStock: boolean;
  /** Emoji used as placeholder until imagegen runs in Turn 3. */
  emoji: string;
};

export const PRODUCTS: Product[] = [
  {
    slug: "smart-sleep-headphones",
    name: "Smart Sleep Headphones",
    price: 79,
    originalPrice: 119,
    rating: 4.7,
    reviews: 1284,
    category: "Sleep & Wellness",
    shortDesc: "Ultra-thin bluetooth headband headphones engineered for side sleepers.",
    longDesc:
      "Drift off faster with the Smart Sleep Headphones — a memory-foam headband with ultra-flat 6mm speakers you can't feel through the fabric. Stream calming audio, white noise, or your favorite podcast for up to 14 hours per charge. Machine-washable inner sleeve, USB-C fast charging, and a built-in mic for hands-free calls.",
    features: [
      "Ultra-thin 6mm flat speakers (under-pillow safe)",
      "14-hour battery, USB-C charging",
      "Bluetooth 5.3 dual-device pairing",
      "Machine-washable cover",
      "Built-in microphone for calls",
    ],
    specs: {
      Battery: "300mAh / 14h playtime",
      Bluetooth: "5.3",
      Weight: "58g",
      "Material": "Bamboo + memory foam",
      Warranty: "12 months",
    },
    inStock: true,
    emoji: "🎧",
  },
  {
    slug: "blue-light-glasses",
    name: "Ergonomic Blue-Light Glasses",
    price: 49,
    originalPrice: 79,
    rating: 4.6,
    reviews: 892,
    category: "Digital Wellness",
    shortDesc: "Block 99% of harmful blue light without yellow tint.",
    longDesc:
      "Spend 8+ hours staring at screens? Our crystal-clear lenses block 99% of 380–450nm blue light while keeping color accuracy true. Lightweight TR90 frame (16g) sits comfortably over prescription lenses too. Includes microfiber pouch and lifetime scratch-replacement guarantee.",
    features: [
      "Blocks 99% of blue light (380–450nm)",
      "Zero yellow tint — colors stay true",
      "Featherlight TR90 frame (16g)",
      "Anti-glare + anti-fingerprint coating",
      "Fits over most prescription frames",
    ],
    specs: {
      "Lens material": "Polycarbonate, anti-blue coating",
      Frame: "TR90 thermoplastic",
      Weight: "16g",
      Size: "Universal — 142mm temple",
      Warranty: "Lifetime scratch replacement",
    },
    inStock: true,
    emoji: "👓",
  },
  {
    slug: "portable-mini-projector",
    name: "Portable Mini Projector",
    price: 129,
    originalPrice: 199,
    rating: 4.5,
    reviews: 643,
    category: "Smart Home",
    shortDesc: "Pocket-size 1080p projector with auto-keystone and built-in speaker.",
    longDesc:
      "Turn any wall into a 120\" screen in seconds. Native 1080p resolution, 8000 ANSI lumens, auto-keystone correction, and a 3-hour internal battery. WiFi 6 + Bluetooth 5.2 means Netflix, YouTube, and your phone connect instantly. The built-in 5W stereo speakers are loud enough for a small room — no extra gear needed.",
    features: [
      "Native 1080p, projects up to 120\"",
      "8000 ANSI lumens — works in daylight",
      "Auto-keystone & auto-focus",
      "Built-in 3-hour battery",
      "WiFi 6 + Bluetooth 5.2 + HDMI/USB-C",
    ],
    specs: {
      Resolution: "1920 × 1080 native",
      Brightness: "8000 ANSI lumens",
      Battery: "3 hours playback",
      Connectivity: "WiFi 6, BT 5.2, HDMI, USB-C",
      Weight: "780g",
    },
    inStock: true,
    emoji: "📽️",
  },
  {
    slug: "wireless-charging-pad",
    name: "3-in-1 Wireless Charging Pad",
    price: 59,
    originalPrice: 89,
    rating: 4.8,
    reviews: 2104,
    category: "Tech Accessories",
    shortDesc: "Charge phone, watch, and earbuds simultaneously — no cable mess.",
    longDesc:
      "Reclaim your nightstand. The 3-in-1 pad delivers 15W fast charging to your phone, 5W to your Apple Watch or Galaxy Watch, and 5W to your earbuds case — all at the same time. Foldable into a triangle stand for FaceTime/desk use. MFi-certified, MagSafe-compatible.",
    features: [
      "15W fast wireless to phone (MagSafe-compatible)",
      "5W to Apple Watch / Galaxy Watch",
      "5W to AirPods / Galaxy Buds case",
      "Foldable triangle stand mode",
      "Smart overheat protection",
    ],
    specs: {
      Output: "15W + 5W + 5W simultaneous",
      Input: "USB-C PD 30W (included)",
      Compatibility: "Qi-enabled phones, Apple Watch, AirPods",
      Material: "Vegan leather + aluminum",
      Warranty: "24 months",
    },
    inStock: true,
    emoji: "🔋",
  },
  {
    slug: "smart-posture-corrector",
    name: "Smart Posture Corrector",
    price: 39,
    originalPrice: 59,
    rating: 4.4,
    reviews: 1567,
    category: "Health & Fitness",
    shortDesc: "Discreet vibrating sensor that trains you to sit straight — in 14 days.",
    longDesc:
      "A coin-sized sensor sticks to your upper back (or clips to a bra strap). When you slouch for more than 60 seconds, it gives a gentle vibration reminder. Pairs with our free app to track posture score, sitting time, and progress. Studies show 89% of users see noticeable improvement in 14 days.",
    features: [
      "Coin-sized, weighs only 8g",
      "Gentle vibration after 60s of slouching",
      "Free iOS + Android app (no subscription)",
      "7-day battery on one charge",
      "Adjustable sensitivity",
    ],
    specs: {
      Weight: "8g",
      Battery: "7 days per charge",
      Sensor: "3-axis accelerometer + gyroscope",
      App: "iOS 14+, Android 9+",
      Warranty: "12 months",
    },
    inStock: true,
    emoji: "🧍",
  },
  {
    slug: "aromatherapy-diffuser",
    name: "Aromatherapy Sleep Diffuser",
    price: 69,
    originalPrice: 99,
    rating: 4.9,
    reviews: 3421,
    category: "Sleep & Wellness",
    shortDesc: "Ultrasonic diffuser with 7-color ambient light & auto-off timer.",
    longDesc:
      "Whisper-quiet ultrasonic diffuser holds 400ml of water — enough for 10 hours of continuous mist. Choose from 7 ambient light colors or turn the light off for pure sleep mode. Auto-shuts off when water runs out. Pairs beautifully with lavender, eucalyptus, or our signature \"Drift\" blend (sold separately).",
    features: [
      "400ml tank — 10 hours continuous mist",
      "Ultrasonic (whisper-quiet, no heat)",
      "7-color ambient light or pure dark mode",
      "Auto-shutoff when empty",
      "BPA-free PP + ceramic exterior",
    ],
    specs: {
      Capacity: "400ml",
      Runtime: "10 hours continuous / 20 hours intermittent",
      Coverage: "Up to 300 sq ft",
      Power: "USB-C, 12V adapter included",
      Material: "BPA-free PP + ceramic",
    },
    inStock: true,
    emoji: "🌿",
  },
  {
    slug: "travel-pillow-noise-cancelling",
    name: "Noise-Cancelling Travel Pillow",
    price: 45,
    originalPrice: 69,
    rating: 4.6,
    reviews: 712,
    category: "Travel",
    shortDesc: "Memory foam neck pillow with built-in passive ear cups.",
    longDesc:
      "Engineered for 12-hour international flights. The hourglass memory-foam core supports your neck from chin to shoulder, while attached padded cups gently cover your ears — passive noise reduction of up to 24dB without any electronics. Snap-loop closure stays on through turbulence. Folds to half-size with included compression strap.",
    features: [
      "Premium memory foam (responds to body heat)",
      "Passive ear cups — 24dB noise reduction",
      "Snap-loop closure, won't slide off",
      "Folds to 50% with compression strap",
      "Machine-washable bamboo cover",
    ],
    specs: {
      Material: "Memory foam + bamboo cover",
      Weight: "320g",
      "Noise reduction": "Up to 24dB passive",
      Packed: "18 × 12cm",
      Care: "Cover removable, machine wash",
    },
    inStock: true,
    emoji: "✈️",
  },
  {
    slug: "smart-water-bottle",
    name: "Smart Water Bottle Tracker",
    price: 35,
    originalPrice: 55,
    rating: 4.3,
    reviews: 988,
    category: "Health & Fitness",
    shortDesc: "Glows when it's time to drink — pairs with Apple Health & Google Fit.",
    longDesc:
      "Stop forgetting to hydrate. The base of this 750ml double-wall insulated bottle has a soft LED that glows every 60 minutes (adjustable) to remind you to drink. The free app tracks daily intake, syncs to Apple Health / Google Fit, and adapts the schedule to your activity. Battery in the base lasts 6 months on a coin cell.",
    features: [
      "750ml double-wall vacuum insulated (24h cold / 12h hot)",
      "LED glow reminder every 60 minutes (adjustable)",
      "Free app — syncs to Apple Health & Google Fit",
      "6-month coin-cell battery (replaceable)",
      "BPA-free, dishwasher-safe top rack",
    ],
    specs: {
      Capacity: "750ml / 25oz",
      Insulation: "24h cold, 12h hot",
      Battery: "CR2032 coin cell, 6 months",
      App: "iOS 14+, Android 9+",
      Material: "304 stainless steel, BPA-free",
    },
    inStock: true,
    emoji: "💧",
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  authorRole: string;
  date: string;
  readTime: number;
  category: string;
  emoji: string;
  /** Markdown-style body — rendered as paragraphs/H2/lists in the article page. */
  body: string;
  relatedProducts: string[]; // product slugs
};

export const ARTICLES: Article[] = [
  {
    slug: "science-backed-sleep-hacks-2026",
    title: "10 Science-Backed Sleep Hacks for Better Rest in 2026",
    excerpt:
      "From cooling your bedroom to 65°F to the 4-7-8 breathing trick, these 10 evidence-based hacks will transform your sleep starting tonight.",
    author: "Dr. Sarah Chen",
    authorRole: "Sleep Researcher, MD",
    date: "2026-05-14",
    readTime: 9,
    category: "Sleep",
    emoji: "😴",
    body: "",
    relatedProducts: ["smart-sleep-headphones", "aromatherapy-diffuser", "blue-light-glasses"],
  },
  {
    slug: "best-tech-gifts-under-100",
    title: "Best Tech Gifts Under $100 for the Modern Minimalist",
    excerpt:
      "Thoughtful tech that solves real problems — without cluttering a desk. Our editors picked 12 items they actually use daily.",
    author: "Marcus Rivera",
    authorRole: "Senior Editor",
    date: "2026-05-22",
    readTime: 7,
    category: "Gift Guides",
    emoji: "🎁",
    body: "",
    relatedProducts: ["wireless-charging-pad", "blue-light-glasses", "smart-water-bottle"],
  },
  {
    slug: "blue-light-and-sleep",
    title: "How Blue Light Affects Your Sleep — And What to Do About It",
    excerpt:
      "The 460nm wavelength suppresses melatonin for up to 3 hours. Here's the actual science, plus 5 practical fixes that work.",
    author: "Dr. Sarah Chen",
    authorRole: "Sleep Researcher, MD",
    date: "2026-06-01",
    readTime: 11,
    category: "Wellness",
    emoji: "💡",
    body: "",
    relatedProducts: ["blue-light-glasses", "smart-sleep-headphones", "aromatherapy-diffuser"],
  },
  {
    slug: "healthy-morning-routine",
    title: "The Ultimate Guide to Building a Healthy Morning Routine",
    excerpt:
      "The 6 morning habits that high performers have in common — and how to layer them in without becoming a productivity zombie.",
    author: "Aisha Patel",
    authorRole: "Wellness Editor",
    date: "2026-06-08",
    readTime: 12,
    category: "Lifestyle",
    emoji: "☀️",
    body: "",
    relatedProducts: ["smart-water-bottle", "smart-posture-corrector", "aromatherapy-diffuser"],
  },
  {
    slug: "travel-gadgets-flights",
    title: "Top 7 Travel Gadgets That Actually Make Flights Bearable",
    excerpt:
      "We've flown 200,000+ miles testing travel gear. These 7 items are the ones our team refuses to fly without.",
    author: "James Okafor",
    authorRole: "Travel Editor",
    date: "2026-06-12",
    readTime: 8,
    category: "Travel",
    emoji: "🛫",
    body: "",
    relatedProducts: ["travel-pillow-noise-cancelling", "smart-sleep-headphones", "portable-mini-projector"],
  },
  {
    slug: "best-sleep-apps-insomnia-2026",
    title: "Best Sleep Apps for Insomnia in 2026 — Tested by Real Insomniacs",
    excerpt:
      "We tried every sleep app worth trying so you don't have to. These 7 are the ones that actually help you fall asleep — not just look pretty on the App Store.",
    author: "Aisha Patel",
    authorRole: "Wellness Editor",
    date: "2026-06-18",
    readTime: 7,
    category: "Sleep",
    emoji: "📱",
    body: "",
    relatedProducts: ["smart-sleep-headphones", "aromatherapy-diffuser", "blue-light-glasses"],
  },
  {
    slug: "magnesium-sleep-guide-2026",
    title: "Magnesium for Sleep in 2026 — The Honest Guide (Which Form, How Much, What Works)",
    excerpt:
      "Magnesium is everywhere on TikTok, but most of it is the wrong form. Here's the real science, the right type to buy, and the exact dose that actually helps you sleep.",
    author: "Dr. Sarah Chen",
    authorRole: "Sleep Researcher, MD",
    date: "2026-06-19",
    readTime: 8,
    category: "Wellness",
    emoji: "💊",
    body: "",
    relatedProducts: ["aromatherapy-diffuser", "blue-light-glasses", "smart-sleep-headphones"],
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

// SITE moved to src/lib/site-identity.ts — a single shared contact block was
// rendered identically on every ad domain and proved common ownership.
// Use siteFor(host) / useSite() instead.
