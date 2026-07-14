// FB-safe prelanding article templates.
// - 20 article templates (all FB ad-policy friendly topics)
// - 5 OG variants per template = 100 unique FB previews
// - Deterministic per short_code (same link = same article = FB-cache safe)
// - JSON-LD Article schema for richer crawler signals

export type PrelandingTemplate =
  | "verify"
  | "reward"
  | "countdown"
  | "article"
  | "article_health"
  | "article_news"
  | "article_finance"
  | "article_lifestyle"
  | "article_tech"
  | "article_celebrity"
  | "article_business"
  | "article_travel"
  | "article_cooking"
  | "article_gardening"
  | "article_pets"
  | "article_sports"
  | "article_education"
  | "article_parenting"
  | "article_music"
  | "article_movies"
  | "article_diy"
  | "article_photography"
  | "article_fitness"
  | "article_crafts";

export type RenderMode = "human" | "fbbot";

export const ARTICLE_TEMPLATES: PrelandingTemplate[] = [
  "article_health", "article_news", "article_finance", "article_lifestyle",
  "article_tech", "article_celebrity", "article_business", "article_travel",
  "article_cooking", "article_gardening", "article_pets", "article_sports",
  "article_education", "article_parenting", "article_music", "article_movies",
  "article_diy", "article_photography", "article_fitness", "article_crafts",
];

export const TEMPLATE_OPTIONS: { value: PrelandingTemplate; label: string; group: string }[] = [
  { value: "article_health", label: "Health & Wellness", group: "Article (FB-safe)" },
  { value: "article_news", label: "Breaking News", group: "Article (FB-safe)" },
  { value: "article_finance", label: "Finance & Money", group: "Article (FB-safe)" },
  { value: "article_lifestyle", label: "Lifestyle", group: "Article (FB-safe)" },
  { value: "article_tech", label: "Technology", group: "Article (FB-safe)" },
  { value: "article_celebrity", label: "Books & Entertainment", group: "Article (FB-safe)" },
  { value: "article_business", label: "Business & Career", group: "Article (FB-safe)" },
  { value: "article_travel", label: "Travel", group: "Article (FB-safe)" },
  { value: "article_cooking", label: "Cooking & Recipes", group: "Article (FB-safe)" },
  { value: "article_gardening", label: "Gardening", group: "Article (FB-safe)" },
  { value: "article_pets", label: "Pets", group: "Article (FB-safe)" },
  { value: "article_sports", label: "Sports", group: "Article (FB-safe)" },
  { value: "article_education", label: "Education", group: "Article (FB-safe)" },
  { value: "article_parenting", label: "Parenting", group: "Article (FB-safe)" },
  { value: "article_music", label: "Music", group: "Article (FB-safe)" },
  { value: "article_movies", label: "Movies & TV", group: "Article (FB-safe)" },
  { value: "article_diy", label: "DIY & Home", group: "Article (FB-safe)" },
  { value: "article_photography", label: "Photography", group: "Article (FB-safe)" },
  { value: "article_fitness", label: "Fitness", group: "Article (FB-safe)" },
  { value: "article_crafts", label: "Crafts & Hobbies", group: "Article (FB-safe)" },
  { value: "verify", label: "Verify (challenge)", group: "Legacy" },
  { value: "reward", label: "Reward (challenge)", group: "Legacy" },
  { value: "countdown", label: "Countdown (challenge)", group: "Legacy" },
  { value: "article", label: "Generic Article", group: "Legacy" },
];

// ---------- Article content ----------
type ArticleContent = {
  title: string;
  description: string;
  category: string;
  author: string;
  heroImage: string;
  intro: string;
  paragraphs: string[];
  highlights: string[];
  related: { title: string; img: string }[];
};

const RELATED_POOL = [
  { title: "5 Habits That Will Transform Your Mornings", img: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=400&q=70" },
  { title: "Why Experts Say This Trend Is Here to Stay", img: "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?auto=format&fit=crop&w=400&q=70" },
  { title: "The Surprising Truth Most People Miss", img: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=400&q=70" },
  { title: "What Doctors Wish You Knew Sooner", img: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=70" },
  { title: "Beginner Tips That Make a Real Difference", img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=70" },
  { title: "Quiet Habits People Swear By This Year", img: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=400&q=70" },
];

const ARTICLES: Record<string, ArticleContent> = {
  article_health: {
    title: "Simple Morning Stretches That Help You Start the Day Feeling Good",
    description: "A gentle stretching sequence many people enjoy in the morning to feel more comfortable and ready for the day.",
    category: "Wellness",
    author: "Sarah Mitchell",
    heroImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=75",
    intro: "A short stretching routine after waking up is something many people find enjoyable. It does not require equipment, gym membership, or any special skill — just a few minutes of quiet movement.",
    paragraphs: [
      "Stretching in the morning has been part of daily life across many cultures for a long time. From traditional yoga in India to qigong in China, gentle morning movement is a familiar idea around the world.",
      "A typical sequence might include a slow neck roll, a seated forward fold, a gentle side stretch, and a few deep breaths. The whole thing can take five to ten minutes and works just as well next to your bed as on a yoga mat.",
      "Many people pair their stretches with a glass of water and a few minutes of quiet time before checking their phone. Others enjoy doing the routine with their partner, a child, or a pet nearby.",
      "Below is a simple sequence you can try at your own pace. Move slowly, breathe deeply, and stop anything that feels uncomfortable.",
    ],
    highlights: ["Takes 5 to 10 minutes", "No equipment needed", "Can be done at home", "Easy to adjust to your pace"],
    related: RELATED_POOL.slice(0, 3),
  },
  article_news: {
    title: "Community Library Adds Weekend Reading Programs for Families",
    description: "Local libraries continue to expand free weekend activities for readers of all ages, including story hours and book clubs.",
    category: "Community",
    author: "Michael Reynolds",
    heroImage: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=75",
    intro: "Public libraries in many cities have been quietly expanding their weekend programming for families, offering story hours, craft sessions, and casual book clubs that anyone can join.",
    paragraphs: [
      "Weekend reading programs have grown in popularity as more families look for low-cost activities they can do together. Most libraries publish their schedules online and welcome walk-in visitors.",
      "Story hours are typically aimed at younger children, with librarians reading picture books and leading simple craft activities. Older children often enjoy themed book clubs that read one short novel together over a few weeks.",
      "Adult reading circles are also common. These groups usually meet once or twice a month, choose a book by vote, and discuss it over coffee. New members are almost always welcome.",
      "If you are curious about what your local library offers, the easiest first step is to drop by and ask at the front desk, or browse their events calendar online.",
    ],
    highlights: ["Free to attend", "Programs for all ages", "Walk-ins welcome at most branches", "Schedules posted online"],
    related: RELATED_POOL.slice(1, 4),
  },
  article_finance: {
    title: "A Simple Way to Organize Your Monthly Household Budget",
    description: "A clear, no-frills approach to writing down what you earn and what you spend each month, used by many families.",
    category: "Personal Budgeting",
    author: "Emma Carter",
    heroImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=75",
    intro: "Keeping track of household spending does not require an app, a spreadsheet, or any financial background. Many families use a simple notebook system that takes only a few minutes a week.",
    paragraphs: [
      "The idea is straightforward: write down what comes in and what goes out, in clear categories. Over a few months, patterns start to appear, and small adjustments become easier to make.",
      "Common categories include rent or mortgage, utilities, groceries, transportation, and a small amount for entertainment. Some people add a separate line for unexpected expenses like repairs.",
      "Reviewing the notebook once a week, perhaps on a Sunday evening, is enough for most households. The point is awareness, not perfection.",
      "Below is a sample layout you can copy into your own notebook to get started this weekend.",
    ],
    highlights: ["Pen and paper is enough", "Takes a few minutes per week", "Easy for the whole family to follow", "No apps required"],
    related: RELATED_POOL.slice(0, 3),
  },
  article_lifestyle: {
    title: "A Calm Evening Routine That Many People Find Relaxing",
    description: "Simple end-of-day habits that help you wind down before bed, drawn from common practices around the world.",
    category: "Lifestyle",
    author: "Jessica Tan",
    heroImage: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=75",
    intro: "The last hour of the day shapes how relaxed you feel before sleep. A short, calm routine — done at your own pace — can make evenings feel a little more peaceful.",
    paragraphs: [
      "Many people enjoy a quiet evening that includes tidying up a small space, preparing tomorrow's clothes, and dimming the lights about an hour before bed.",
      "Some add a cup of caffeine-free tea, a few pages of a book, or quiet music. Others prefer silence, journaling, or a short walk around the block.",
      "The exact ingredients matter less than the consistency. Doing roughly the same calm things each night helps the evening feel familiar and unhurried.",
      "Below are a few simple ideas to mix and match into a routine that fits your home and schedule.",
    ],
    highlights: ["Works in any home", "No cost involved", "Easy to adjust", "Suits most schedules"],
    related: RELATED_POOL.slice(1, 4),
  },
  article_tech: {
    title: "Beginner-Friendly Apps for Keeping Notes and To-Do Lists",
    description: "A look at a few popular free note-taking apps and how everyday people use them to stay organized.",
    category: "Technology",
    author: "David Park",
    heroImage: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=75",
    intro: "Note-taking apps have become a normal part of daily life — for shopping lists, recipes, work notes, or simply remembering ideas. There are now plenty of beginner-friendly options that cost nothing to try.",
    paragraphs: [
      "Most modern note apps work on both phones and computers and keep your notes in sync. That means a list you start on your phone in the kitchen is ready on your laptop later.",
      "Common features include simple folders, checklists, and the ability to add photos. Most apps have a generous free tier that is enough for everyday use at home.",
      "If you are new to digital notes, the easiest starting point is a single notebook for everything — groceries, ideas, reminders — and then split it later as you find what works for you.",
      "Below is a short overview of a few well-known free apps and the kinds of people who tend to enjoy each one.",
    ],
    highlights: ["Free options available", "Works on phone and computer", "Beginner-friendly", "Useful for daily lists"],
    related: RELATED_POOL.slice(0, 3),
  },
  article_celebrity: {
    title: "Why Cozy Book Recommendations Are Trending This Season",
    description: "Readers are sharing their favorite comfort reads online, sparking new interest in older novels and short story collections.",
    category: "Books & Reading",
    author: "Sophia Bennett",
    heroImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=75",
    intro: "Cozy reading lists have been popping up everywhere online this season — from short story collections to gentle novels readers describe as a warm cup of tea in book form.",
    paragraphs: [
      "Book communities on social platforms have leaned into the idea of comfort reading: stories with kind characters, low-stakes plots, and a strong sense of place. Many of the most-shared titles are older books rediscovered by new readers.",
      "Public libraries report a quiet uptick in requests for these gentle reads, and a number of independent bookshops have started displaying them on dedicated tables near the entrance.",
      "Popular themes include small-town life, food and cooking, gardening, and friendship across generations. Many of the books are short enough to finish in a weekend.",
      "Below are a few categories worth exploring if you are looking for your next quiet read.",
    ],
    highlights: ["Easy to borrow from libraries", "Short and gentle reads", "Great for weekends", "Wide range of styles"],
    related: RELATED_POOL.slice(1, 4),
  },
  article_business: {
    title: "Time-Management Habits Many Remote Workers Find Helpful",
    description: "Simple daily habits that many people who work from home use to stay focused and end the day on time.",
    category: "Work & Career",
    author: "Marcus Lee",
    heroImage: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=75",
    intro: "Working from home gives a lot of flexibility, but it can also make the day feel a little blurry. A few simple habits help many remote workers separate work from rest.",
    paragraphs: [
      "Starting the day with a short walk, even a few minutes around the block, acts as a kind of commute. It signals that the workday is beginning and helps you settle in when you sit down at your desk.",
      "Time blocking is another common habit. Many people sketch out their day in rough blocks — focused work in the morning, meetings in the afternoon, a clear stop time — without trying to plan every minute.",
      "Taking a real lunch break, away from the desk, helps the afternoon feel less heavy. Closing the laptop at a regular time each evening helps the boundary between work and home stay clear.",
      "Below is a small sample of routines that real remote workers describe as part of a good day.",
    ],
    highlights: ["Works in any home setup", "No special tools needed", "Easy to adjust over time", "Helps end the day on time"],
    related: RELATED_POOL.slice(0, 3),
  },
  article_travel: {
    title: "A Beginner's Guide to Planning a Relaxed Weekend Trip",
    description: "Practical, no-stress tips for putting together a short weekend trip close to home, without overpacking the schedule.",
    category: "Travel",
    author: "Olivia Brooks",
    heroImage: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=75",
    intro: "A short weekend trip does not have to involve flights, complicated planning, or a long packing list. Some of the most enjoyable trips happen within a couple of hours of home.",
    paragraphs: [
      "A relaxed weekend often works best with one main destination and a couple of soft ideas — a cafe, a park, a small museum — rather than a packed schedule.",
      "Picking a place you can reach in two or three hours keeps travel time short and leaves more of the weekend for the actual trip. Trains, buses, and short drives all work well.",
      "Packing light is part of the relaxation. A small bag with a change of clothes, a book, a refillable water bottle, and a basic toiletry kit covers most short trips.",
      "Below is a simple checklist you can adapt for your own weekend, whether you are travelling solo, with a partner, or with family.",
    ],
    highlights: ["Close-to-home destinations", "Easy packing list", "Flexible schedule", "Works for solo or family trips"],
    related: RELATED_POOL.slice(1, 4),
  },
  article_cooking: {
    title: "Easy One-Pot Dinners That Make Weeknight Cooking Simpler",
    description: "A handful of simple one-pot meals that many home cooks turn to when they want a comforting dinner without a sink full of dishes.",
    category: "Cooking",
    author: "Hannah Foster",
    heroImage: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=75",
    intro: "One-pot dinners are a quiet favorite in many kitchens for a reason: less cleanup, fewer ingredients, and a warm meal on the table in under an hour.",
    paragraphs: [
      "Classics like pasta in a tomato-and-vegetable sauce, hearty bean soups, and simple rice-and-chicken dishes can all be cooked in a single pot from start to finish.",
      "The trick is usually layering: start with the aromatics like onion and garlic, add the proteins, then the longest-cooking vegetables, and finish with quick-cooking items like greens or fresh herbs.",
      "Most one-pot recipes are forgiving. Missing one vegetable? Swap it. Out of one spice? A pinch of something similar usually works just fine.",
      "Below are a few beginner-friendly ideas you can adapt with whatever is already in your kitchen this week.",
    ],
    highlights: ["Less cleanup", "Beginner-friendly", "Forgiving ingredient swaps", "Ready in under an hour"],
    related: RELATED_POOL.slice(0, 3),
  },
  article_gardening: {
    title: "A Friendly Guide to Starting a Small Container Garden at Home",
    description: "How beginners are growing herbs, salad greens, and a few easy vegetables on balconies, windowsills, and small patios.",
    category: "Gardening",
    author: "Daniel Whitfield",
    heroImage: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=75",
    intro: "Container gardening has become a popular way for beginners to grow a little something at home, even without a yard. A few pots on a sunny balcony are often enough to start.",
    paragraphs: [
      "Herbs like basil, mint, and parsley are forgiving choices for first-time growers. Salad greens such as lettuce and arugula are also quick to sprout and easy to harvest a leaf at a time.",
      "Most containers need good drainage holes, a quality potting mix, and a spot that gets several hours of sunlight a day. Watering routines vary by plant, but a finger-test in the soil usually tells you enough.",
      "Many gardeners enjoy keeping a small notebook with planting dates, watering notes, and the weather. Over the season, patterns start to emerge and the next round of planting gets easier.",
      "Below are a few beginner-friendly plants and the kind of container each one tends to thrive in.",
    ],
    highlights: ["Works on small balconies", "Beginner-friendly plants", "Low startup cost", "Suits most climates"],
    related: RELATED_POOL.slice(1, 4),
  },
  article_pets: {
    title: "Simple Daily Routines That Help Indoor Cats Stay Happy",
    description: "Small things many cat owners do each day that keep their indoor cat curious, comfortable, and engaged.",
    category: "Pets",
    author: "Rachel Nguyen",
    heroImage: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=75",
    intro: "Indoor cats can be wonderfully content, especially when their day includes a little play, a quiet spot to nap, and a small bit of mental stimulation.",
    paragraphs: [
      "A short play session with a feather wand or a small toy in the morning and the evening is something many owners build into their routine. Most cats enjoy short bursts of activity rather than long sessions.",
      "Cats also tend to appreciate a window perch where they can watch birds, leaves, and changing light. A cardboard box, a paper bag, or a covered bed offers a calm hiding spot.",
      "Food puzzles — simple toys that release a few kibbles when batted around — keep mealtime more interesting and engage a cat's natural hunting instincts.",
      "Below is a sample daily rhythm many indoor-cat owners describe as a good day for their cat.",
    ],
    highlights: ["Short play sessions", "Window perch helps", "Food puzzles add fun", "Calm hiding spots matter"],
    related: RELATED_POOL.slice(2, 5),
  },
  article_sports: {
    title: "Why Casual Pickup Basketball Is Making a Comeback in Local Parks",
    description: "Community pickup games are quietly drawing weekend crowds again, with players of all ages joining in for a few easy-going matches.",
    category: "Sports",
    author: "James Carter",
    heroImage: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=75",
    intro: "Saturday-morning pickup basketball at the local park has been quietly growing again in many cities. There are no teams, no fees, and no commitment — just turn up and play.",
    paragraphs: [
      "Most pickup groups follow simple rules: first team to a set number of points wins, winners stay on the court, and substitutions happen between games.",
      "Players range widely in skill and age, and the friendly, low-pressure atmosphere is part of what keeps people coming back. Many groups end up sharing snacks and chatting after the games end.",
      "If you are new to a court, the easiest start is usually to watch one game, ask who is up next, and join the next available team. Most regulars are welcoming.",
      "Below are a few tips for getting comfortable at a local pickup court for the first time.",
    ],
    highlights: ["Free and open to all", "No commitment needed", "Beginner-friendly atmosphere", "Great way to meet neighbors"],
    related: RELATED_POOL.slice(0, 3),
  },
  article_education: {
    title: "A Calm Approach to Studying a New Language at Home",
    description: "A relaxed, no-pressure study routine that many adult language learners use to make slow, steady progress.",
    category: "Education",
    author: "Linh Tran",
    heroImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=75",
    intro: "Learning a new language as an adult is more comfortable when the routine is small, regular, and free of pressure. Many people make real progress with just fifteen quiet minutes a day.",
    paragraphs: [
      "A typical home routine might include a short app session in the morning, listening to a podcast in the target language during the commute, and a few minutes of reading before bed.",
      "Vocabulary builds slowly through repeated exposure rather than memorization marathons. Many learners keep a small notebook of new words and revisit it once a week.",
      "Speaking practice is the part most beginners delay, but short voice-note conversations with a friend or a tutor — even a few sentences a day — make a noticeable difference over a few months.",
      "Below is a sample weekly rhythm a calm self-study routine often looks like.",
    ],
    highlights: ["15 minutes a day adds up", "Apps and podcasts pair well", "Notebooks beat memorization", "Steady beats intense"],
    related: RELATED_POOL.slice(1, 4),
  },
  article_parenting: {
    title: "Quiet Weekend Activities Families Enjoy at Home Together",
    description: "Low-key indoor and backyard ideas many families turn to for a relaxed weekend without any planning.",
    category: "Family",
    author: "Megan Howard",
    heroImage: "https://images.unsplash.com/photo-1484820301400-9d6c5dc6df58?auto=format&fit=crop&w=1200&q=75",
    intro: "Not every weekend needs to be a big outing. Many families enjoy simple, slower-paced days at home that leave everyone feeling rested by Sunday evening.",
    paragraphs: [
      "Board games, jigsaw puzzles, and reading time are quiet classics that work across a wide range of ages. Pulling a few favorites out of the cupboard often turns into hours of relaxed time together.",
      "Backyard or balcony activities like planting a few seeds, drawing with chalk, or building a small fort with cushions keep younger children happily occupied with very little setup.",
      "Cooking something simple together — pancakes, cookies, or a homemade pizza — gives kids a small project and an easy way to be part of the day.",
      "Below are a few ideas you can pick from to put together your own gentle weekend at home.",
    ],
    highlights: ["No planning required", "Suits a range of ages", "Low cost", "Easy to adjust by weather"],
    related: RELATED_POOL.slice(0, 3),
  },
  article_music: {
    title: "How Casual Listeners Are Rediscovering Vinyl Records at Home",
    description: "A friendly look at why beginner-friendly turntables and second-hand vinyl have quietly become a popular home hobby again.",
    category: "Music",
    author: "Andre Williams",
    heroImage: "https://images.unsplash.com/photo-1483821432-7cc0db04ad7c?auto=format&fit=crop&w=1200&q=75",
    intro: "Vinyl records have quietly returned to many living rooms over the past few years, helped along by affordable beginner turntables and a steady supply of second-hand records at thrift shops.",
    paragraphs: [
      "Casual listeners often start with a simple all-in-one turntable and a small stack of records — sometimes inherited from a parent, sometimes picked up for a few dollars at a local market.",
      "Listening to vinyl tends to be a slower, more intentional experience. Flipping a record halfway through, looking at the album art, and sitting still for forty minutes is part of what people enjoy.",
      "Caring for records is straightforward: a soft brush before play, a cloth sleeve for storage, and a dust cover on the turntable cover most of what is needed.",
      "Below is a friendly starter guide for anyone curious about trying vinyl at home for the first time.",
    ],
    highlights: ["Affordable beginner setups", "Second-hand records are easy to find", "Slower, calmer listening", "Low maintenance"],
    related: RELATED_POOL.slice(1, 4),
  },
  article_movies: {
    title: "Comfort Films People Keep Returning to on Quiet Evenings",
    description: "A look at the gentle, low-stakes films many viewers describe as their go-to choice for a relaxed night in.",
    category: "Movies & TV",
    author: "Claire Donovan",
    heroImage: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=75",
    intro: "Some films feel like a warm blanket — gentle, familiar, and easy to revisit. They are the ones many viewers reach for on quiet evenings when they want something comforting rather than challenging.",
    paragraphs: [
      "Common picks include feel-good comedies, animated family films, and slow-paced dramas with a strong sense of place. The plots are often light, and the endings tend to be hopeful.",
      "Many people describe a small personal list — five or six films they return to every year. The familiarity is part of the appeal: knowing the story lets you relax into it without effort.",
      "Comfort films also tend to do well as background viewing while folding laundry, sketching, or sharing a meal at home.",
      "Below are a few categories of comfort films worth exploring if you are building a list of your own.",
    ],
    highlights: ["Easy, low-stakes plots", "Great background viewing", "Often family-friendly", "Familiar and rewatchable"],
    related: RELATED_POOL.slice(2, 5),
  },
  article_diy: {
    title: "Small Weekend DIY Projects That Refresh a Room Without a Big Budget",
    description: "Simple, low-cost home projects many people complete in a weekend to give a small space a fresh feel.",
    category: "DIY & Home",
    author: "Tom Bradley",
    heroImage: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=75",
    intro: "Refreshing a room does not always mean a renovation. A handful of small weekend projects — done one at a time — can make a familiar space feel new again.",
    paragraphs: [
      "Repainting a single wall, swapping out drawer handles, or hanging a few framed prints are common starter projects. Each one takes a few hours and leaves a visible result.",
      "Decluttering is often the most powerful change of all. Many people set a small goal — one shelf, one drawer, one corner — and stop there before getting tired.",
      "Tools needed are usually minimal: a basic screwdriver, a small hammer, a level, and a measuring tape cover most beginner projects.",
      "Below are a few easy weekend ideas you can pick from to refresh a room this month.",
    ],
    highlights: ["Done in a weekend", "Low budget", "Minimal tools required", "Visible results"],
    related: RELATED_POOL.slice(0, 3),
  },
  article_photography: {
    title: "Phone-Camera Tips That Quietly Improve Everyday Photos",
    description: "A few simple habits that help casual smartphone photographers take better pictures of family, food, and travel.",
    category: "Photography",
    author: "Priya Ramanathan",
    heroImage: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=75",
    intro: "Modern phone cameras can produce surprisingly good photos with just a few small habits — no extra gear, no editing apps, and no technical background needed.",
    paragraphs: [
      "Good light makes the biggest difference. Soft natural light from a window or in the hour after sunrise tends to flatter both people and food without any effort.",
      "Composition is the second easy win. Most phones have a grid setting that helps with the rule of thirds, and leaving a little empty space in the frame often makes the subject stand out more.",
      "A steady hold — both elbows tucked in, or a hand braced against a wall — sharpens many photos that would otherwise come out slightly blurred.",
      "Below are a few small habits to try the next time you reach for your phone to capture something at home or on a trip.",
    ],
    highlights: ["Use natural light", "Turn on the grid", "Brace for steady shots", "Leave breathing space"],
    related: RELATED_POOL.slice(1, 4),
  },
  article_fitness: {
    title: "Easy Walking Routines People Use to Stay Active Year-Round",
    description: "Relaxed walking habits many people build into their week to feel a bit more active without joining a gym.",
    category: "Fitness",
    author: "Kevin O'Sullivan",
    heroImage: "https://images.unsplash.com/photo-1487700160041-babef9c3cb55?auto=format&fit=crop&w=1200&q=75",
    intro: "Walking remains one of the most popular ways to stay a little more active. It needs no equipment, no membership, and fits into almost any schedule.",
    paragraphs: [
      "Many people start with a short loop near home — fifteen or twenty minutes after breakfast or after dinner — and slowly let it grow as it becomes habit.",
      "Listening to a podcast, calling a family member, or walking with a friend turns the time into something to look forward to. Others enjoy the quiet and walk without headphones.",
      "Comfortable shoes and a small water bottle are usually all that is needed. Weather-appropriate layers make winter walks just as pleasant as summer ones.",
      "Below are a few sample weekly walking patterns that many casual walkers describe as a comfortable rhythm.",
    ],
    highlights: ["No equipment needed", "Fits any schedule", "Easy to grow over time", "Works year-round"],
    related: RELATED_POOL.slice(0, 3),
  },
  article_crafts: {
    title: "Beginner-Friendly Hobbies for Quiet Evenings at Home",
    description: "A gentle look at handcrafts like knitting, watercolor, and origami that many beginners pick up for a relaxed evening hobby.",
    category: "Crafts & Hobbies",
    author: "Naomi Fischer",
    heroImage: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=75",
    intro: "A small handcraft is a lovely way to fill an evening at home. Many people enjoy the slow, repetitive nature of crafts like knitting, watercolor painting, or simple origami.",
    paragraphs: [
      "Knitting and crochet are popular starting points because the supplies are inexpensive and there are plenty of free beginner videos online. A simple scarf can be a full-evening project for weeks.",
      "Watercolor sets for beginners cost very little and travel well, making them a natural hobby for those who like to sketch in a park or at the kitchen table.",
      "Origami needs nothing but paper and a quiet surface. Many beginners enjoy folding a few classic shapes — cranes, boxes, or simple animals — while listening to music or a podcast.",
      "Below are a few beginner-friendly hobby ideas worth exploring if you are looking for something calm to do this winter.",
    ],
    highlights: ["Low startup cost", "Free beginner tutorials online", "Calm and meditative", "Easy to pick up and put down"],
    related: RELATED_POOL.slice(1, 4),
  },
};

// ---------- OG variants (5 per template, picked deterministically by short_code) ----------
// 5 variants × 20 templates = 100 unique FB previews. Same short_code always picks
// the same variant (FB cache friendly + ad reviewer + first share match).
type OgVariant = { title: string; description: string; heroImage: string };

const VARIANTS: Record<string, OgVariant[]> = {
  article_health: [
    { title: "Simple Morning Stretches That Help You Start the Day Feeling Good",
      description: "A gentle stretching sequence many people enjoy in the morning to feel a little more comfortable.",
      heroImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Short Stretching Routine You Can Do Next to Your Bed",
      description: "Five to ten minutes of gentle movement, no equipment needed, suitable for most home settings.",
      heroImage: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=75" },
    { title: "Calm Morning Habits Many People Around the World Enjoy",
      description: "Looking at simple morning routines from different cultures and how everyday people adapt them at home.",
      heroImage: "https://images.unsplash.com/photo-1494390248081-4e521a5940db?auto=format&fit=crop&w=1200&q=75" },
    { title: "Gentle Movement Ideas for People Who Sit at a Desk All Day",
      description: "Small stretches and short walks that many office workers fit into their daily routine.",
      heroImage: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=75" },
    { title: "Quiet Wellness Habits Worth Knowing About This Year",
      description: "A friendly look at the small daily habits people credit with feeling a little more rested.",
      heroImage: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_news: [
    { title: "Community Library Adds Weekend Reading Programs for Families",
      description: "Local libraries continue to expand free weekend activities for readers of all ages.",
      heroImage: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=75" },
    { title: "Free Weekend Story Hours and Book Clubs at Your Local Library",
      description: "An overview of family-friendly library programming and how to find a schedule near you.",
      heroImage: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=75" },
    { title: "How Reading Circles Bring Neighbors Together on Weekends",
      description: "A friendly look at adult and family reading groups in public libraries across many cities.",
      heroImage: "https://images.unsplash.com/photo-1568992687947-868a62a9f521?auto=format&fit=crop&w=1200&q=75" },
    { title: "Local Libraries Quietly Become Weekend Family Hubs Again",
      description: "Why more parents are choosing the local branch as a relaxed Saturday-morning stop.",
      heroImage: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1200&q=75" },
    { title: "Small-Town Libraries Reporting Steady Growth in Weekend Visits",
      description: "A short look at the free programs drawing more families into branches on weekends.",
      heroImage: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_finance: [
    { title: "A Simple Way to Organize Your Monthly Household Budget",
      description: "A clear, no-frills approach to writing down what you earn and what you spend each month.",
      heroImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=75" },
    { title: "Pen-and-Paper Budgeting: A Calm Way to Track Spending",
      description: "Many families use a simple notebook to keep an eye on monthly spending without any apps.",
      heroImage: "https://images.unsplash.com/photo-1579621970590-9d624316904b?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Sunday Evening Habit That Helps With Household Planning",
      description: "A few quiet minutes once a week is often enough to keep household spending notes up to date.",
      heroImage: "https://images.unsplash.com/photo-1543286386-713bdd548da4?auto=format&fit=crop&w=1200&q=75" },
    { title: "How Families Are Building Calmer Money Habits This Year",
      description: "Small weekly routines that many households use to feel more in control of their spending.",
      heroImage: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=75" },
    { title: "The Simple Notebook Method for Tracking Monthly Expenses",
      description: "A gentle introduction to writing down income and spending without spreadsheets or apps.",
      heroImage: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_lifestyle: [
    { title: "A Calm Evening Routine That Many People Find Relaxing",
      description: "Simple end-of-day habits that help you wind down before bed, drawn from common everyday practices.",
      heroImage: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=75" },
    { title: "Small Bedtime Habits That Make Evenings Feel Peaceful",
      description: "A short collection of low-key habits — tea, a book, dim lights — that many people enjoy at night.",
      heroImage: "https://images.unsplash.com/photo-1455642305367-68834a9c4cee?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Gentle End-of-Day Routine You Can Adjust to Your Schedule",
      description: "Mix-and-match ideas for a quiet hour before bed that fits any home and any lifestyle.",
      heroImage: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=1200&q=75" },
    { title: "Slow Evening Habits That Make Going to Bed Feel Easier",
      description: "Familiar, repeatable rituals that many people use to wind down comfortably each night.",
      heroImage: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1200&q=75" },
    { title: "How Quiet Evenings at Home Became a Small Trend This Year",
      description: "A friendly look at the calmer pace many people are building into their weeknights.",
      heroImage: "https://images.unsplash.com/photo-1493106819501-66d381c466f1?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_tech: [
    { title: "Beginner-Friendly Apps for Keeping Notes and To-Do Lists",
      description: "A look at a few popular free note-taking apps and how everyday people use them at home.",
      heroImage: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=75" },
    { title: "Simple Ways to Keep Shopping Lists and Reminders on Your Phone",
      description: "An overview of common note apps that work on both phone and computer, with no learning curve.",
      heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Friendly Guide to Free Note Apps for Everyday Life",
      description: "Picking a beginner-friendly app for groceries, recipes, and small reminders around the home.",
      heroImage: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=75" },
    { title: "How Casual Users Are Staying Organized With Free Apps",
      description: "Small ways everyday people use beginner-friendly tools to keep track of daily life.",
      heroImage: "https://images.unsplash.com/photo-1573164713619-24c711fe7878?auto=format&fit=crop&w=1200&q=75" },
    { title: "The Easiest Way to Start Using Digital Notes at Home",
      description: "A short walkthrough of how to set up a single notebook app and grow it slowly over time.",
      heroImage: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_celebrity: [
    { title: "Why Cozy Book Recommendations Are Trending This Season",
      description: "Readers are sharing their favorite comfort reads online, sparking new interest in gentle novels.",
      heroImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=75" },
    { title: "Comfort Reading Lists That Book Clubs Are Talking About",
      description: "A look at the kinds of warm, low-stakes stories people are recommending to each other this season.",
      heroImage: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=75" },
    { title: "Short, Gentle Novels Worth Borrowing From the Library",
      description: "A friendly roundup of cozy book categories you can find on the shelves at your local library.",
      heroImage: "https://images.unsplash.com/photo-1574267432553-4b4628081c31?auto=format&fit=crop&w=1200&q=75" },
    { title: "Quiet Reads Becoming a Quiet Favorite This Year",
      description: "Why more readers are reaching for gentle, low-drama stories on their evenings off.",
      heroImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Friendly Roundup of Comfort Books for the Season",
      description: "Cozy, easy-going titles that are getting passed around book clubs and reading apps.",
      heroImage: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_business: [
    { title: "Time-Management Habits Many Remote Workers Find Helpful",
      description: "Simple daily habits that many work-from-home professionals use to stay focused without overworking.",
      heroImage: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=75" },
    { title: "Small Daily Routines That Make Working From Home Easier",
      description: "A look at the morning walks, time blocks, and stop-time habits remote workers commonly use.",
      heroImage: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=75" },
    { title: "How Remote Workers Keep Work and Home Life Separate",
      description: "Friendly ideas for starting the day, taking lunch breaks, and signing off on time at home.",
      heroImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=75" },
    { title: "Calm Workday Habits That Help People Working From Home",
      description: "A friendly collection of small routines remote workers say make the day feel less blurry.",
      heroImage: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=75" },
    { title: "The Small Routines Behind a Good Work-From-Home Day",
      description: "Quiet habits — short walks, lunch breaks, set stop times — that many remote workers swear by.",
      heroImage: "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_travel: [
    { title: "A Beginner's Guide to Planning a Relaxed Weekend Trip",
      description: "Practical, no-stress tips for putting together a short weekend trip close to home.",
      heroImage: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=75" },
    { title: "Short Weekend Getaways You Can Plan in One Evening",
      description: "Simple ideas for a relaxed weekend within a couple of hours of home, with a light packing list.",
      heroImage: "https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1200&q=75" },
    { title: "Friendly Tips for a Calm, Easy-Going Weekend Trip",
      description: "Pick one destination, pack light, leave room in the schedule — a calm guide to short trips.",
      heroImage: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=75" },
    { title: "Small Weekend Trips That Don't Need a Lot of Planning",
      description: "Friendly, low-effort getaways that feel like a real break without complicated logistics.",
      heroImage: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=75" },
    { title: "How to Put Together a Relaxed Weekend Away From Home",
      description: "Simple steps for a short, easy-going trip that leaves you actually rested by Monday.",
      heroImage: "https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_cooking: [
    { title: "Easy One-Pot Dinners That Make Weeknight Cooking Simpler",
      description: "A handful of simple one-pot meals many home cooks turn to for a comforting dinner without piles of dishes.",
      heroImage: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=75" },
    { title: "Simple Weeknight Meals You Can Make in a Single Pot",
      description: "Beginner-friendly ideas for hearty dinners that come together in under an hour with minimal cleanup.",
      heroImage: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=75" },
    { title: "Cozy One-Pot Recipes Worth Adding to Your Weekly Rotation",
      description: "Warm, comforting meals — pasta, soup, rice dishes — that work for busy weeknights and quiet weekends.",
      heroImage: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Friendly Guide to Cooking Dinner in One Pot",
      description: "Easy beginner recipes, smart ingredient swaps, and tips for keeping cleanup to a minimum.",
      heroImage: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1200&q=75" },
    { title: "Comforting One-Pot Meals That Don't Take All Evening",
      description: "Simple dinner ideas many home cooks rely on when they want a real meal without the dishes.",
      heroImage: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_gardening: [
    { title: "A Friendly Guide to Starting a Small Container Garden at Home",
      description: "How beginners are growing herbs, salad greens, and a few easy vegetables on balconies and windowsills.",
      heroImage: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=75" },
    { title: "Easy Herbs and Salad Greens for First-Time Balcony Gardeners",
      description: "Beginner-friendly plants that thrive in pots, with simple tips on light, water, and soil.",
      heroImage: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=75" },
    { title: "Starting Your First Container Garden With Just a Few Pots",
      description: "What beginners need to know about pots, soil, and the easiest plants to grow at home.",
      heroImage: "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=1200&q=75" },
    { title: "Small-Space Gardening Ideas That Work on Any Balcony",
      description: "A look at how beginners are growing fresh herbs and greens in compact, low-maintenance setups.",
      heroImage: "https://images.unsplash.com/photo-1428908728789-d2de25dbd4e2?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Calm Beginner's Guide to Growing Plants on a Windowsill",
      description: "Friendly, low-pressure advice on starting a tiny indoor garden without expensive equipment.",
      heroImage: "https://images.unsplash.com/photo-1463936575829-25148e1db1b8?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_pets: [
    { title: "Simple Daily Routines That Help Indoor Cats Stay Happy",
      description: "Small things many cat owners do each day to keep their indoor cat curious and engaged.",
      heroImage: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=75" },
    { title: "Easy Ways to Keep an Indoor Cat Content and Comfortable",
      description: "Window perches, short play sessions, and food puzzles — small additions many cats enjoy.",
      heroImage: "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?auto=format&fit=crop&w=1200&q=75" },
    { title: "Small Daily Habits That Make Indoor Cats Happier",
      description: "A friendly look at the calm, low-effort routines many cat owners describe as a good day.",
      heroImage: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=1200&q=75" },
    { title: "Friendly Ideas for Enriching the Day of an Indoor Cat",
      description: "Play, perches, and puzzle feeders — gentle additions that suit a wide range of cats.",
      heroImage: "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?auto=format&fit=crop&w=1200&q=75" },
    { title: "Quiet Routines That Help Indoor Cats Feel at Home",
      description: "A short list of small, calm habits that many cat owners build into their daily life.",
      heroImage: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_sports: [
    { title: "Why Casual Pickup Basketball Is Making a Comeback in Local Parks",
      description: "Community pickup games are quietly drawing weekend crowds again, with players of all ages joining in.",
      heroImage: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=75" },
    { title: "Local Parks Quietly Become Weekend Hubs for Pickup Games",
      description: "A friendly look at the casual, no-fee community games taking place in neighborhoods on weekends.",
      heroImage: "https://images.unsplash.com/photo-1574623452334-1e0ac2b3ccb4?auto=format&fit=crop&w=1200&q=75" },
    { title: "How Pickup Basketball Brings Neighbors Together on Saturdays",
      description: "Why casual community games at the local court are growing again — and how to join in.",
      heroImage: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Friendly Guide to Joining Pickup Games at Your Local Park",
      description: "Simple tips for showing up, fitting in, and enjoying a relaxed afternoon of community sport.",
      heroImage: "https://images.unsplash.com/photo-1577471488278-16eec37ffcc2?auto=format&fit=crop&w=1200&q=75" },
    { title: "Community Pickup Games Are Quietly Trending Again This Year",
      description: "A short look at the casual park-court culture that more people are turning out for.",
      heroImage: "https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_education: [
    { title: "A Calm Approach to Studying a New Language at Home",
      description: "A relaxed, no-pressure study routine that many adult language learners use to make steady progress.",
      heroImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=75" },
    { title: "Small Daily Habits That Help Adult Language Learners",
      description: "Apps in the morning, podcasts in the day, a notebook in the evening — a friendly weekly rhythm.",
      heroImage: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=75" },
    { title: "How Adults Are Quietly Picking Up New Languages at Home",
      description: "A short look at the calm, fifteen-minute-a-day habits behind real long-term progress.",
      heroImage: "https://images.unsplash.com/photo-1488998427799-e3362cec87c3?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Gentle Weekly Routine for Self-Study Language Learners",
      description: "Friendly ideas for building a calm study habit without burning out.",
      heroImage: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=75" },
    { title: "Low-Pressure Tips for Studying a Language in Your Free Time",
      description: "Small, sustainable habits that work for busy adults learning at their own pace.",
      heroImage: "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_parenting: [
    { title: "Quiet Weekend Activities Families Enjoy at Home Together",
      description: "Low-key indoor and backyard ideas many families turn to for a relaxed weekend.",
      heroImage: "https://images.unsplash.com/photo-1484820301400-9d6c5dc6df58?auto=format&fit=crop&w=1200&q=75" },
    { title: "Simple At-Home Ideas for a Calm Family Weekend",
      description: "Board games, baking, and small backyard projects that suit a wide range of ages.",
      heroImage: "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1200&q=75" },
    { title: "Easy Weekend Plans Families Are Quietly Loving This Year",
      description: "A friendly roundup of low-key home activities that leave everyone feeling rested by Sunday.",
      heroImage: "https://images.unsplash.com/photo-1490489944526-99f3a9e09e72?auto=format&fit=crop&w=1200&q=75" },
    { title: "How Families Are Building Slower, Cozier Weekends at Home",
      description: "Friendly indoor and backyard ideas that suit kids of different ages and need almost no planning.",
      heroImage: "https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Friendly Guide to Quiet Saturdays With the Whole Family",
      description: "Simple, low-cost activities that turn a slow weekend into something everyone enjoys.",
      heroImage: "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_music: [
    { title: "How Casual Listeners Are Rediscovering Vinyl Records at Home",
      description: "Affordable beginner turntables and second-hand vinyl are quietly turning into a popular home hobby again.",
      heroImage: "https://images.unsplash.com/photo-1483821432-7cc0db04ad7c?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Friendly Beginner's Guide to Starting a Small Vinyl Collection",
      description: "What you actually need to get going — a basic turntable, a few records, and a quiet evening.",
      heroImage: "https://images.unsplash.com/photo-1471478331149-c72f17e33c73?auto=format&fit=crop&w=1200&q=75" },
    { title: "Why Slow Listening Is Becoming a Quiet Trend Again",
      description: "Vinyl, full-album playthroughs, and intentional listening sessions are making a calm comeback.",
      heroImage: "https://images.unsplash.com/photo-1535992165812-68d1861aa71e?auto=format&fit=crop&w=1200&q=75" },
    { title: "Small Home Hobbies: A Beginner's Look at Vinyl Records",
      description: "Affordable, beginner-friendly setups and a few simple tips for caring for your records.",
      heroImage: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=75" },
    { title: "How Vinyl Records Quietly Returned to Living Rooms Everywhere",
      description: "A friendly look at the second-hand records and beginner turntables driving the calm comeback.",
      heroImage: "https://images.unsplash.com/photo-1461360228754-6e81c478b882?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_movies: [
    { title: "Comfort Films People Keep Returning to on Quiet Evenings",
      description: "Gentle, low-stakes films many viewers describe as their go-to choice for a relaxed night in.",
      heroImage: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=75" },
    { title: "Gentle Movies That Feel Like a Warm Blanket at the End of the Day",
      description: "A friendly roundup of the comforting films viewers reach for over and over.",
      heroImage: "https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&w=1200&q=75" },
    { title: "Why Comfort Rewatches Are Quietly a Favorite Evening Habit",
      description: "Familiar films, light plots, and hopeful endings — the small details that keep people coming back.",
      heroImage: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=75" },
    { title: "Low-Stakes Films Worth Adding to Your Comfort List",
      description: "A relaxed roundup of feel-good movies and gentle animated classics.",
      heroImage: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Friendly Guide to Building Your Own Comfort-Film List",
      description: "Categories, picks, and ideas for the kind of cozy films most viewers happily rewatch.",
      heroImage: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_diy: [
    { title: "Small Weekend DIY Projects That Refresh a Room Without a Big Budget",
      description: "Simple, low-cost home projects that many people complete in a weekend.",
      heroImage: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=75" },
    { title: "Easy One-Weekend Home Updates That Give a Fresh Feel",
      description: "Paint, drawer handles, framed prints — small swaps that make a familiar room feel new.",
      heroImage: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=75" },
    { title: "Friendly Beginner DIY Ideas for a Refresh on a Small Budget",
      description: "Low-pressure projects you can finish in a weekend, with very few tools required.",
      heroImage: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Calm Approach to Refreshing a Room One Weekend at a Time",
      description: "Small, satisfying projects you can pick from depending on your time and mood.",
      heroImage: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1200&q=75" },
    { title: "Beginner-Friendly Home Projects That Don't Take a Whole Weekend",
      description: "Friendly, no-stress ideas for refreshing a room in a few quiet hours.",
      heroImage: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_photography: [
    { title: "Phone-Camera Tips That Quietly Improve Everyday Photos",
      description: "A few simple habits that help casual smartphone photographers take better pictures.",
      heroImage: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=75" },
    { title: "Simple Habits for Taking Better Photos With Your Phone",
      description: "Light, composition, and steady hands — three small changes that quietly improve your photos.",
      heroImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Friendly Guide to Better Everyday Smartphone Photography",
      description: "Tips on using natural light, the grid, and a steady hold — no apps or extra gear required.",
      heroImage: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=1200&q=75" },
    { title: "Easy Ways to Take Nicer Photos of Family, Food, and Trips",
      description: "Small adjustments that make smartphone photos look thoughtful without any editing.",
      heroImage: "https://images.unsplash.com/photo-1500051638674-ff996a0ec29e?auto=format&fit=crop&w=1200&q=75" },
    { title: "Small Habits That Make Casual Phone Photos Look Better",
      description: "Friendly, beginner-level tips you can apply the next time you reach for your phone.",
      heroImage: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_fitness: [
    { title: "Easy Walking Routines People Use to Stay Active Year-Round",
      description: "Relaxed walking habits many people build into their week to feel a bit more active.",
      heroImage: "https://images.unsplash.com/photo-1487700160041-babef9c3cb55?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Gentle Walking Routine That Fits Almost Any Schedule",
      description: "Short loops, a podcast, and a comfortable pair of shoes — that's all most walkers need.",
      heroImage: "https://images.unsplash.com/photo-1538677053842-79bb433f4cdc?auto=format&fit=crop&w=1200&q=75" },
    { title: "Why Casual Walking Is the Quiet Favorite for Staying Active",
      description: "Friendly, no-gym walking habits that many people stick with for years.",
      heroImage: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=75" },
    { title: "Friendly Ideas for Building a Daily Walking Habit at Home",
      description: "Short loops near home, easy ways to make the time enjoyable, and tips for sticking with it.",
      heroImage: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Calm, Beginner-Friendly Guide to Walking More Each Week",
      description: "Simple weekly rhythms many casual walkers describe as comfortable and sustainable.",
      heroImage: "https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=1200&q=75" },
  ],
  article_crafts: [
    { title: "Beginner-Friendly Hobbies for Quiet Evenings at Home",
      description: "A gentle look at handcrafts like knitting, watercolor, and origami for relaxed evenings.",
      heroImage: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=75" },
    { title: "Calm Hobbies People Are Picking Up for a Slower Evening",
      description: "Knitting, sketching, paper folding — slow, repetitive crafts that suit a quiet hour at home.",
      heroImage: "https://images.unsplash.com/photo-1606761568499-6d2451b23c66?auto=format&fit=crop&w=1200&q=75" },
    { title: "A Friendly Guide to Picking Up a Small Handcraft This Winter",
      description: "Low-cost hobbies that are easy to start and easy to set down at the end of the evening.",
      heroImage: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?auto=format&fit=crop&w=1200&q=75" },
    { title: "Slow, Meditative Crafts That Beginners Are Quietly Enjoying",
      description: "A short look at the small, repetitive hobbies people use to wind down in the evening.",
      heroImage: "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=1200&q=75" },
    { title: "Tiny, Calming Hobbies for People Who Want a Quieter Evening",
      description: "Friendly, beginner-friendly ideas for hobbies that don't need expensive supplies.",
      heroImage: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1200&q=75" },
  ],
};

// djb2 hash — stable across processes (don't use Math.random; would break across PM2 workers)
function hashCode(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

// Publisher brand rotation — deterministic per short_code. Removes the
// "every link looks like DailyInsight" fingerprint that FB pattern-matches.
type Brand = { name: string; accent: string; tagline: string; email: string };
const BRANDS: Brand[] = [
  { name: "DailyInsight", accent: "#b91c1c", tagline: "Independent daily reporting", email: "hello@dailyinsight.example" },
  { name: "MorningLedger", accent: "#0f766e", tagline: "Practical news, every morning", email: "team@morningledger.example" },
  { name: "The Weekly Note", accent: "#1d4ed8", tagline: "Clear reporting, honest tone", email: "editor@weeklynote.example" },
  { name: "OpenDesk Review", accent: "#7c3aed", tagline: "Everyday stories that matter", email: "desk@opendeskreview.example" },
  { name: "SignalPost", accent: "#c2410c", tagline: "Signal over noise", email: "contact@signalpost.example" },
];
function pickBrand(code: string): Brand {
  return BRANDS[hashCode(`brand:${code}`) % BRANDS.length];
}

// Deterministically pick OG variant for this short_code. Same code → same variant.
function pickVariant(template: string, code: string): OgVariant | null {
  const list = VARIANTS[template];
  if (!list || list.length === 0) return null;
  return list[hashCode(`${template}:${code}`) % list.length];
}

// Deterministically pick which article template a short_code uses across all
// article templates. Used by the FB-bot path so the same link consistently
// shows the same article (matching what the ad reviewer first cached).
export function pickArticleTemplateForCode(code: string): PrelandingTemplate {
  const list = ARTICLE_TEMPLATES;
  return list[hashCode(`tpl:${code}`) % list.length];
}

// Simple HTML escape for JSON-LD safety
function jsonEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").replace(/\r/g, "");
}

// HTML-attribute escape — keeps meta/og tags valid even if content has " < > & '
function attrEscape(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

// Generic FB-safe fallbacks. Used whenever a template/variant field is missing,
// empty, or accidentally whitespace — so /r/ pages NEVER ship without og:title,
// og:description, or og:image. Facebook then renders a clean preview card
// instead of a blank URL-only attachment.
const OG_FALLBACK = {
  title: "Today's Featured Story — DailyInsight",
  description:
    "A short, easy-to-read story from the DailyInsight desk. Updated daily with practical, friendly reporting.",
  heroImage:
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=75",
  author: "DailyInsight Editorial",
  category: "Featured",
} as const;

function nonEmpty(s: string | null | undefined, fallback: string): string {
  const v = (s ?? "").toString().trim();
  return v.length > 0 ? v : fallback;
}



// ---------- Premium article HTML ----------
function articleHtml(baseContent: ArticleContent, templateKey: string, code: string, _token: string, mode: RenderMode, requestOrigin?: string): string {
  // Deterministically swap OG title/description/heroImage for this short_code so
  // different links → different FB previews while the same link stays stable
  // (matches whatever the FB reviewer first cached).
  const variant = pickVariant(templateKey, code);
  const merged: ArticleContent = variant
    ? { ...baseContent, title: variant.title, description: variant.description, heroImage: variant.heroImage }
    : baseContent;

  // Defensive OG fallback layer. If a template/variant ever ships with an empty
  // title/description/heroImage (data bug, future template added without copy,
  // variant returns null) the /r/ landing page MUST still expose a valid FB
  // preview card — otherwise Facebook falls back to "URL-only" attachments,
  // which look like spam and tank CTR + ad approval.
  const content: ArticleContent = {
    ...merged,
    title: nonEmpty(merged.title, OG_FALLBACK.title),
    description: nonEmpty(merged.description, OG_FALLBACK.description),
    heroImage: nonEmpty(merged.heroImage, OG_FALLBACK.heroImage),
    author: nonEmpty(merged.author, OG_FALLBACK.author),
    category: nonEmpty(merged.category, OG_FALLBACK.category),
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const initials = (content.author.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()) || "DI";
  // For FB bot keep robots-friendly. For (rare) human fallback, no-index.
  const robots = mode === "human" ? `<meta name="robots" content="noindex,nofollow">` : "";

  // Pre-escape every value used inside meta/og tag attributes so quotes,
  // ampersands, and angle brackets in copy never break the head.
  const titleAttr = attrEscape(content.title);
  const descAttr = attrEscape(content.description);
  const heroAttr = attrEscape(content.heroImage);
  const authorAttr = attrEscape(content.author);
  const categoryAttr = attrEscape(content.category);
  const brand = pickBrand(code);
  const brandNameAttr = attrEscape(brand.name);

  // JSON-LD Article schema — Facebook & Google preview crawlers use this as a stronger
  // "real article" signal than OG tags alone. Required for richer link previews.
  const jsonLd = `{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "${jsonEscape(content.title)}",
  "description": "${jsonEscape(content.description)}",
  "image": ["${content.heroImage}"],
  "datePublished": "${today.toISOString()}",
  "dateModified": "${today.toISOString()}",
  "author": { "@type": "Person", "name": "${jsonEscape(content.author)}" },
  "publisher": {
    "@type": "Organization",
    "name": "${jsonEscape(brand.name)}",
    "logo": { "@type": "ImageObject", "url": "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=200&q=75" }
  },
  "articleSection": "${jsonEscape(content.category)}"
}`;

  // Canonical short-link URL — MUST match the host the crawler actually
  // fetched from. If og:url/canonical points to a different domain than
  // the URL the FB ad reviewer hit, Meta flags it as cloaking/mismatch
  // and rejects the ad. Prefer the live request origin; fall back to
  // SHORTENER_BASE_URL only when called outside a request context.
  const shortenerBase = (requestOrigin || process.env.SHORTENER_BASE_URL || "https://breezysocial.com").replace(/\/+$/, "");
  // Clean URL (no /r/ prefix) — matches what users actually see/share.
  const canonicalUrl = `${shortenerBase}/${encodeURIComponent(code)}`;
  const canonicalAttr = attrEscape(canonicalUrl);

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titleAttr}</title>
<meta name="description" content="${descAttr}">
${robots}
<link rel="canonical" href="${canonicalAttr}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonicalAttr}">
<meta property="og:title" content="${titleAttr}">
<meta property="og:description" content="${descAttr}">
<meta property="og:image" content="${heroAttr}">
<meta property="og:image:secure_url" content="${heroAttr}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${titleAttr}">
<meta property="og:site_name" content="${brandNameAttr}">
<meta property="og:locale" content="en_US">
<meta property="article:published_time" content="${today.toISOString()}">
<meta property="article:author" content="${authorAttr}">
<meta property="article:section" content="${categoryAttr}">
<meta name="twitter:url" content="${canonicalAttr}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titleAttr}">
<meta name="twitter:description" content="${descAttr}">
<meta name="twitter:image" content="${heroAttr}">
<meta name="twitter:image:alt" content="${titleAttr}">
<script type="application/ld+json">${jsonLd}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:'Source Sans 3',-apple-system,sans-serif;background:#f7f7f8;color:#1a1a1a;line-height:1.65;font-size:17px}
  .topbar{background:#0a0a0a;color:#fff;font-size:.75rem;padding:6px 0;text-align:center;letter-spacing:.5px}
  .nav{background:#fff;border-bottom:1px solid #ececec;padding:18px 24px;position:sticky;top:0;z-index:10;box-shadow:0 1px 0 rgba(0,0,0,.02)}
  .nav-inner{max-width:1100px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:24px}
  .logo{font-family:'Playfair Display',serif;font-weight:900;font-size:1.6rem;color:#b91c1c;letter-spacing:-1px;line-height:1}
  .logo span{color:#0a0a0a;font-weight:700}
  .nav-links{display:flex;gap:22px;flex-wrap:wrap}
  .nav-links a{color:#444;text-decoration:none;font-size:.9rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  .nav-links a:hover{color:#b91c1c}
  .layout{max-width:1100px;margin:0 auto;padding:32px 24px 80px;display:grid;grid-template-columns:1fr 300px;gap:48px}
  article{background:#fff;padding:48px 56px;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.04)}
  .crumbs{font-size:.78rem;color:#888;margin-bottom:14px;letter-spacing:.5px}
  .crumbs a{color:#888;text-decoration:none}
  .cat-pill{display:inline-block;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:1.8px;color:#fff;background:#b91c1c;padding:5px 12px;border-radius:2px;margin-bottom:18px}
  h1{font-family:'Playfair Display',Georgia,serif;font-size:2.6rem;line-height:1.18;font-weight:800;margin-bottom:18px;color:#0a0a0a;letter-spacing:-.5px}
  .deck{font-size:1.18rem;color:#555;font-weight:400;line-height:1.55;margin-bottom:26px;font-family:'Source Sans 3',sans-serif}
  .byline{display:flex;align-items:center;gap:14px;padding:18px 0;border-top:1px solid #eee;border-bottom:1px solid #eee;margin-bottom:28px}
  .avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#b91c1c,#7c2d12);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.95rem;flex-shrink:0}
  .byline-text{font-size:.88rem;color:#555;line-height:1.4}
  .byline-text strong{color:#0a0a0a;font-weight:700;display:block;font-size:.95rem}
  .share-row{margin-left:auto;display:flex;gap:8px}
  .share-btn{width:32px;height:32px;border-radius:50%;background:#f3f3f3;display:inline-flex;align-items:center;justify-content:center;font-size:.8rem;color:#666;text-decoration:none}
  .hero{width:100%;height:auto;border-radius:4px;margin:0 0 12px;display:block}
  .hero-cap{font-size:.82rem;color:#888;font-style:italic;margin-bottom:32px;padding-bottom:18px;border-bottom:1px solid #f0f0f0}
  .intro{font-size:1.22rem;line-height:1.6;color:#222;margin-bottom:26px;font-weight:400}
  .intro::first-letter{font-family:'Playfair Display',serif;font-size:3.6rem;float:left;line-height:.9;padding:6px 12px 0 0;color:#b91c1c;font-weight:800}
  p{margin-bottom:22px;font-size:1.08rem;color:#222;line-height:1.7}
  .highlights{background:linear-gradient(135deg,#fff8e6 0%,#fff3d0 100%);border-left:5px solid #f59e0b;padding:24px 28px;margin:32px 0;border-radius:0 8px 8px 0;box-shadow:0 2px 8px rgba(245,158,11,.08)}
  .highlights h3{font-size:.85rem;text-transform:uppercase;letter-spacing:1.5px;color:#92400e;margin-bottom:14px;font-weight:800}
  .highlights ul{list-style:none;padding:0}
  .highlights li{padding:8px 0 8px 30px;position:relative;font-size:1rem;color:#3a2a06;font-weight:500}
  .highlights li:before{content:'✓';position:absolute;left:0;color:#15803d;font-weight:900;font-size:1.1rem}
  .ad-slot{background:#fafafa;border:1px solid #ececec;text-align:center;padding:20px;margin:28px 0;border-radius:4px;color:#aaa;font-size:.7rem;letter-spacing:1px;text-transform:uppercase}
  .ad-slot small{display:block;margin-bottom:8px;color:#bbb}
  .ad-slot-inner{height:90px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px dashed #e0e0e0;color:#bbb;border-radius:2px}
  .tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:32px;padding-top:24px;border-top:1px solid #eee}
  .tag{font-size:.8rem;color:#666;background:#f3f3f3;padding:6px 12px;border-radius:20px;text-decoration:none}
  aside{position:relative}
  .side-card{background:#fff;border-radius:4px;padding:24px;margin-bottom:24px;box-shadow:0 2px 12px rgba(0,0,0,.04)}
  .side-card h3{font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:800;margin-bottom:16px;color:#0a0a0a;padding-bottom:10px;border-bottom:3px solid #b91c1c}
  .related-item{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0}
  .related-item:last-child{border-bottom:0}
  .related-item img{width:72px;height:72px;object-fit:cover;border-radius:3px;flex-shrink:0}
  .related-item h4{font-size:.9rem;font-weight:600;line-height:1.35;color:#0a0a0a;font-family:'Source Sans 3',sans-serif}
  .newsletter{background:linear-gradient(135deg,#0a0a0a 0%,#1f1f1f 100%);color:#fff;padding:28px 22px;border-radius:4px;text-align:center;margin-bottom:24px}
  .newsletter h3{font-family:'Playfair Display',serif;font-size:1.25rem;margin-bottom:8px;color:#fff;border:0;padding:0}
  .newsletter p{color:#bbb;font-size:.88rem;margin-bottom:14px}
  .newsletter input{width:100%;padding:11px 14px;border:0;border-radius:3px;font-size:.9rem;margin-bottom:8px;font-family:inherit}
  .newsletter button{width:100%;padding:11px;background:#b91c1c;color:#fff;border:0;border-radius:3px;font-weight:700;font-size:.9rem;cursor:pointer;text-transform:uppercase;letter-spacing:1px}
  footer{background:#0a0a0a;color:#999;padding:36px 24px;text-align:center;font-size:.82rem;line-height:1.7}
  footer strong{color:#fff;display:block;font-family:'Playfair Display',serif;font-size:1.2rem;margin-bottom:8px}
  footer a{color:#bbb;text-decoration:none;margin:0 8px}
  @media (max-width:900px){
    .layout{grid-template-columns:1fr;gap:24px;padding:20px 16px 50px}
    article{padding:28px 22px}
    h1{font-size:1.85rem}
    .deck{font-size:1.05rem}
    aside{order:2}
    .nav-links{display:none}
  }
</style>
</head><body>
<div class="topbar">📰 ${brand.tagline}  ·  Updated daily  ·  Free to read</div>
<nav class="nav"><div class="nav-inner">
  <div class="logo">${brand.name}</div>
  <div class="nav-links">
    <a href="/">Home</a><a href="/about">About</a><a href="/contact">Contact</a>
    <a href="/privacy">Privacy</a><a href="/terms">Terms</a>
  </div>
</div></nav>

<div class="layout">
<article>
  <div class="crumbs"><a href="/">Home</a> › <span>${content.category}</span> › Article</div>
  <span class="cat-pill">${content.category}</span>
  <h1>${content.title}</h1>
  <p class="deck">${content.description}</p>
  <div class="byline">
    <span class="avatar">${initials}</span>
    <div class="byline-text">
      <strong>By ${content.author}</strong>
      ${dateStr} · 5 min read
    </div>
    <div class="share-row">
      <a href="/" class="share-btn" aria-label="Home">⌂</a>
    </div>
  </div>
  <img class="hero" src="${content.heroImage}" alt="${content.title}" loading="eager" width="1200" height="630">
  <p class="hero-cap">Photo: Editorial / ${brand.name}</p>
  <p class="intro">${content.intro}</p>
  ${content.paragraphs.slice(0, 2).map((p) => `<p>${p}</p>`).join("\n  ")}
  <div class="ad-slot"><small>Advertisement</small><div class="ad-slot-inner">Sponsored content</div></div>
  ${content.paragraphs.slice(2).map((p) => `<p>${p}</p>`).join("\n  ")}
  <div class="highlights">
    <h3>★ Key Takeaways</h3>
    <ul>${content.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>
  </div>
  <p>You'll find the full details — including sources, notes, and a short summary — in the complete report below. Read at your own pace and share only what feels useful.</p>
  <div class="tags">
    <span class="tag">#${content.category.toLowerCase().replace(/[^a-z]/g,"")}</span>
    <span class="tag">#daily-read</span>
    <span class="tag">#${today.getFullYear()}</span>
  </div>
</article>

<aside>
  <div class="newsletter">
    <h3>Get the Daily Brief</h3>
    <p>A short recap in your inbox. Free.</p>
    <input type="email" placeholder="your@email.com" aria-label="Email address">
    <button type="button">Subscribe Free</button>
  </div>
  <div class="side-card">
    <h3>Trending Now</h3>
    ${content.related.map((r) => `<div class="related-item"><img src="${r.img}" alt=""><h4>${r.title}</h4></div>`).join("")}
  </div>
  <div class="ad-slot" style="margin:0"><small>Advertisement</small><div class="ad-slot-inner" style="height:250px">Sponsored</div></div>
</aside>
</div>

<footer>
  <strong>${brand.name}</strong>
  © ${today.getFullYear()} ${brand.name} · ${brand.tagline}<br>
  <a href="/about">About</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/contact">Contact</a>
</footer>
</body></html>`;
}

// ---------- Public API ----------
export function renderPrelanding(
  template: PrelandingTemplate,
  code: string,
  token: string,
  mode: RenderMode = "fbbot",
  requestOrigin?: string,
): string {
  // Article variant — pick by name
  if (template in ARTICLES) return articleHtml(ARTICLES[template], template, code, token, mode, requestOrigin);
  // Generic "article" or legacy templates → default to health (best safe content)
  return articleHtml(ARTICLES.article_health, "article_health", code, token, mode, requestOrigin);
}

export function pickArticleTemplate(template: PrelandingTemplate): PrelandingTemplate {
  if (template in ARTICLES) return template;
  return "article_health";
}
