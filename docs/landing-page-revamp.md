# Landing Page Revamp: Kitchen Chaos Edition

## Overview

The current landing page is generic SaaS boilerplate. It needs to feel like a confident restaurant insider wrote it — someone who knows the chaos of a Friday night rush, the pain of discovering inventory shrinkage, and the relief of actually hitting margin targets.

**Goal:** Make visitors immediately understand "This helps me run my restaurant better" through bold copy and animated visuals that show the actual product experience.

---

## Hero Section

### Headline Options (pick one)

**Primary recommendation:**
> **Your margins are bleeding. Let's stop the hemorrhage.**

**Alternatives:**
> **Stop guessing what's eating your profits.**
>
> **Finally know where the money's actually going.**
>
> **Kitchen chaos? Same. But your numbers don't have to be.**

### Subhead

> Track inventory, nail your costs, and spot the fishy stuff before it tanks your margins. Built by restaurant people who got tired of spreadsheet hell.

### Visual: Animated Dashboard Preview

A hero illustration showing a stylized dashboard that animates on page load:

1. **Animated metric cards** that count up:
   - "Today's Haul" counting from $0 to $2,847
   - "What You're Actually Making" counting to $1,993
   - Margin % bar filling to 70%

2. **Subtle pulse animation** on the "Running on Fumes" alert showing 2 items low

3. **Recent activity feed** with items sliding in one by one (like the actual dashboard)

The preview should be slightly angled/3D to give depth, with a soft shadow. Not a screenshot — a crafted illustration that captures the essence without being a 1:1 replica.

### CTA

**Primary:** "Start Free — No Credit Card" (button)
**Secondary:** "Watch the 60-second tour" (text link below)

---

## Value Props Section

### Section Header

> **What you get (besides fewer grey hairs)**

### Four Value Props

#### 1. Know What You've Got

**Headline:** "Inventory that doesn't lie"

**Description:** Scan receipts with your phone, count stock without a clipboard, and always know exactly what's in the walk-in. No more "I thought we had tomatoes" moments mid-service.

**Visual/Animation:**
- Receipt photo transforming into structured inventory list
- Phone scanning animation with items populating
- Before/after: messy clipboard vs. clean digital list

#### 2. See Where the Money Goes

**Headline:** "Costs that make sense"

**Description:** Automatic food cost calculation for every menu item. See your actual margins — not the ones you hoped for when you priced the menu six months ago.

**Visual/Animation:**
- Animated pie chart showing cost breakdown (food/labor/profit)
- Numbers counting up as menu items get added
- "Recipe cost: $3.42" badge appearing on a menu item

#### 3. Catch the Fishy Stuff

**Headline:** "Variance analysis that actually works"

**Description:** Spot waste, theft, and "oops I dropped it" before they tank your month. The system flags when usage doesn't match sales — you decide what to do about it.

**Visual/Animation:**
- Alert card pulsing (like the dashboard "Fishy Business" section)
- Graph showing expected vs. actual usage with gap highlighted
- Before/after: mystery shrinkage vs. identified issue

#### 4. AI That Gets Restaurant Life

**Headline:** "Insights from someone who's seen your chaos"

**Description:** Not generic business advice. Actual recommendations based on your data — like "Your burger margin dropped 8% this month, here's why" and "You're ordering too much cilantro."

**Visual/Animation:**
- Chat-style AI insight bubbles appearing
- Lightbulb icon with recommendations sliding in
- Graph with AI annotation highlighting a trend

---

## Social Proof / Demo Section

### Section Header

> **See it in action (no demo request forms, we promise)**

### Interactive Demo Experience

Two options for showing the product:

**Option A: Restaurant Type Selector (Recommended)**

Let visitors pick their restaurant type and see sample data:

```
What kind of joint are you running?

[Fast Casual]  [Fine Dining]  [Bar/Brewery]  [Cafe]  [Food Truck]
```

When they click, the demo area below transforms to show that restaurant type's sample dashboard:
- Fast Casual: $2,847 daily sales, 70% margin, Ground Beef and Lettuce running low
- Fine Dining: $8,420 daily sales, 65% margin, Wagyu and Lobster alerts
- Bar/Brewery: $4,215 daily sales, 75% margin, IPA keg and lime juice alerts
- Cafe: $1,856 daily sales, 75% margin, Espresso beans and vanilla syrup low
- Food Truck: $1,420 daily sales, 75% margin, Tortillas and cotija cheese alerts

Each selection triggers a smooth transition with:
1. Numbers counting up to the new values
2. Activity feed refreshing with relevant items
3. Alert cards updating with type-specific inventory

**Option B: Animated Walkthrough**

Auto-playing sequence showing:
1. Dashboard overview (3 seconds)
2. Zooming into inventory section (3 seconds)
3. Showing a receipt being scanned (3 seconds)
4. AI insight appearing (3 seconds)
5. Loop or end on CTA

### Supporting Metrics

Below the demo, show aggregate proof:

> **3,200+** restaurants tracking inventory
> **$2.4M** in shrinkage identified last month
> **12 minutes** average daily time savings

(Note: Use real numbers when available, or omit this section until you have them)

---

## Final CTA Section

### Section Header

> **Ready to stop the bleeding?**

### Copy

> Your margins won't fix themselves. But 10 minutes from now, you could be staring at a dashboard that actually makes sense.
>
> Free to start. No credit card. No sales calls.

### CTA Buttons

**Primary:** "Launch Your Dashboard" (large, terracotta button)

**Secondary:** "Questions? We actually answer." (link to contact/chat)

### Trust Elements

Small icons/text below CTA:
- "Free tier available"
- "Your data stays yours"
- "Cancel anytime"

---

## Design Notes

### Typography

Keep the existing font pairing:
- **Display:** Crimson Pro (or Fraunces from onboarding) for headlines
- **Body:** DM Sans (or Plus Jakarta Sans) for everything else

### Color Palette

Use the warm palette already established:
- Cream background (#FFF8F0 or oklch warm-50)
- Espresso for text (#2A1810)
- Terracotta for CTAs and accents (#C45D35)
- Sage for success states (#7A8B6E)

### Animation Guidelines

1. **Entrance animations:** Stagger elements on scroll-into-view (not on page load)
2. **Number counters:** Use easing that starts fast, ends slow (like the dashboard's AnimatedNumber component)
3. **Hover states:** Subtle lift + shadow increase (like existing feature cards)
4. **Reduced motion:** Respect prefers-reduced-motion for all animations

### Mobile Considerations

- Dashboard preview should simplify on mobile (show 2 metrics instead of 4)
- Restaurant type selector becomes a scrollable horizontal strip
- CTAs should be sticky on mobile when scrolled past hero

---

## Implementation Priority

1. **Must have:** Hero with animated preview, value props, final CTA
2. **Should have:** Interactive restaurant type demo
3. **Nice to have:** Social proof metrics, video tour

---

## Copy Tone Checklist

Before finalizing any copy, check:
- [ ] Would a burnt-out restaurant manager crack a smile?
- [ ] Does it acknowledge the reality of restaurant chaos?
- [ ] Is it confident without being arrogant?
- [ ] Does it focus on outcomes, not features?
- [ ] Zero buzzwords (no "leverage," "synergy," "best-in-class")
