# Knowledge Base Best Practices: Optimizing Content for AI Retrieval

**Purpose:** Guide for creating high-quality knowledge base content that maximizes AI retrieval accuracy
**Target Audience:** Content creators, clinic staff, system administrators
**System:** Voxanne AI RAG (Retrieval Augmented Generation) Pipeline
**Version:** 1.0 (2026-01-28)

---

## 🎯 Core Principles

### 1. Write for Questions, Not Documents

**❌ Traditional Documentation Style (Low Retrieval)**
```markdown
# Services

- Botox: Cosmetic treatment
- Facelift: Surgical procedure
- Consultation: Initial assessment
```

**✅ Query-Matching Style (High Retrieval)**
```markdown
# What Services Do We Offer?

Do you want to know what treatments we provide? We offer:

**Botox Treatments** - If you're asking about Botox or wrinkle reduction, we offer cosmetic Botox injections starting at $400.

**Facelift Procedures** - Looking for facelift surgery? Our surgical facelifts range from $8,000-$12,000 depending on your needs.

**Free Consultations** - Want to learn more? Schedule a free consultation to discuss your goals with our expert team.
```

**Why it works:**
- Matches natural language: "What services do you offer?" → retrieves this section
- Includes variations: "Botox", "wrinkle reduction", "cosmetic injections"
- Conversational tone mirrors how people ask questions

---

### 2. Use Semantic Keywords (Not Just Headers)

**Problem:** AI embeddings capture semantic meaning, not just exact words.

**❌ Keyword-Poor (Low Similarity Score)**
```markdown
## Location
123 Main Street
```

**✅ Keyword-Rich (High Similarity Score)**
```markdown
## Where to Find Us - Our Office Location

**You can find us at our headquarters:**

We are located at:
123 Main Street, Downtown Medical District, City, State 12345

**How to reach our office:**
- Located in the heart of the medical district
- Easy to find with ample parking
- Our address is 123 Main Street
- Visit us anytime during business hours
```

**Why it works:**
- "Where to find us" → matches "Where are you located?"
- "located at" → matches "location" semantically
- "address", "visit", "reach" → all location-related terms
- Multiple phrasings increase retrieval probability

---

### 3. Front-Load Important Information

**❌ Buried Information (May Be Cut Off)**
```markdown
## Pricing

We believe in transparent pricing and fair value for our patients. Our practice
has been serving the community for over 20 years, and we've always maintained
competitive pricing structures. We work with most insurance providers and offer
flexible payment plans for your convenience.

**Consultation: $150**
```

**✅ Front-Loaded Information (Always Retrieved)**
```markdown
## How Much Does It Cost? Pricing Information

**Consultation: $150** (includes comprehensive assessment)

Looking for pricing details? Here's our transparent cost structure:
- Botox: $400-$600 per session
- Facelift: $8,000-$12,000
- Rhinoplasty: $6,000-$8,000

We accept insurance and offer payment plans.
```

**Why it works:**
- Critical info (prices) appears in first 100 characters
- Query "How much does it cost?" immediately matches header
- Specific numbers appear early (won't be truncated)

---

### 4. Include Question Variations

**❌ Single Phrasing (Misses Variations)**
```markdown
## Business Hours
Monday-Friday: 9 AM - 5 PM
```

**✅ Multiple Phrasings (Catches All Variations)**
```markdown
## When Are We Open? Hours of Operation

**What are our hours?** We're open Monday through Friday, 9 AM to 5 PM.

**When can you reach us?** Our office hours are:
- Monday-Friday: 9:00 AM - 5:00 PM
- Saturday: Closed
- Sunday: Closed

**What time do we close?** We close at 5 PM each weekday.

**Are we available on weekends?** No, we're closed on Saturday and Sunday.

Call us during business hours at (555) 123-4567.
```

**Why it works:**
- "When are we open?" → matches query exactly
- "What are our hours?" → matches alternative phrasing
- "What time do we close?" → matches specific time questions
- Multiple formats increase coverage

---

## 📝 Content Structure Guidelines

### Optimal Document Length

**Per Document:**
- **Minimum:** 500 words (at least 1-2 chunks)
- **Optimal:** 1,500-2,000 words (2-4 chunks)
- **Maximum:** 5,000 words (avoid - split into multiple docs)

**Why:**
- Too short: Not enough semantic context for matching
- Too long: Important info may be buried in less-relevant chunks
- Optimal: Enough context without dilution

### Chunking Strategy (Automatic by System)

**Current Settings:**
- Chunk size: 1,000 tokens (~750 words)
- Overlap: 200 tokens (~150 words)

**What this means for content:**
- Related topics should be within 750 words of each other
- Don't separate critical info by >500 words
- Repeat key terms if discussing across large sections

**Example:**
```markdown
## Botox Treatments

Our Botox treatments reduce wrinkles and fine lines. We use FDA-approved Botox
for cosmetic procedures. The cost of Botox injections starts at $400 per session.

[... 500 words of detailed Botox info ...]

**Botox Pricing Reminder:** As mentioned, Botox costs $400-$600 depending on
treatment area. Schedule your Botox consultation today!
```

(Repeating "Botox" and "pricing" ensures they appear in multiple chunks)

---

## 🔍 Common Query Patterns & How to Match Them

### Pattern 1: "How much does X cost?"

**Good Content Structure:**
```markdown
## Pricing for [Service Name]

**How much does [service] cost?** Our [service] pricing starts at $XXX.

The cost of [service] depends on:
- Factor 1: Price range $XXX-$XXX
- Factor 2: Price range $XXX-$XXX

**What's included in the price:**
- Item 1
- Item 2

**Payment options:** We accept insurance and offer payment plans.
```

**Key Elements:**
- Explicit question in header
- Price in first sentence
- Multiple price-related keywords ("cost", "pricing", "payment")
- Specific numbers

---

### Pattern 2: "Where are you located?"

**Good Content Structure:**
```markdown
## Where to Find Us - Office Location

**Where are we located?** You can find us at:

**Our Address:**
123 Main Street
Medical Plaza, Suite 200
City, State 12345

**How to reach our location:**
- We're located in the Medical Plaza downtown
- Our office address is 123 Main Street
- Visit us at Suite 200
- Easy to find with GPS: [coordinates]

**Directions:**
[Brief directions from major highways/landmarks]

**Parking:** Free parking available in the Medical Plaza garage.
```

**Key Elements:**
- Multiple location-related keywords ("located", "find us", "address", "visit")
- Address repeated in different contexts
- Practical details (parking, directions)

---

### Pattern 3: "Do you offer X?"

**Good Content Structure:**
```markdown
## Do We Offer [Service]?

**Yes, we offer [service]!** We provide comprehensive [service] treatments.

**What [service] options do we have?**
- Option 1: Description
- Option 2: Description
- Option 3: Description

**Who can get [service]?**
[Eligibility criteria]

**How do I schedule [service]?**
Call us at (555) 123-4567 or book online.
```

**Key Elements:**
- Direct yes/no answer in first line
- Question phrasing matches user query
- Service name repeated throughout
- Clear call-to-action

---

### Pattern 4: "What are your hours?"

**Good Content Structure:**
```markdown
## When Are We Open? Business Hours

**What are our hours?** We're open Monday-Friday, 9 AM - 5 PM.

**Our Schedule:**
- **Monday:** 9:00 AM - 5:00 PM
- **Tuesday:** 9:00 AM - 5:00 PM
- **Wednesday:** 9:00 AM - 5:00 PM
- **Thursday:** 9:00 AM - 5:00 PM
- **Friday:** 9:00 AM - 5:00 PM
- **Saturday:** Closed
- **Sunday:** Closed

**When can you call us?** Our phone lines are open during business hours.

**After-hours emergencies:** Call (555) 123-4567 for our answering service.
```

**Key Elements:**
- Multiple time-related keywords ("hours", "open", "schedule", "when")
- Specific days and times
- Alternative phrasings ("What are your hours?" vs "When are you open?")

---

## 🚫 Anti-Patterns: What NOT to Do

### Anti-Pattern 1: Overly Formal/Technical Language

**❌ Bad (Low Retrieval):**
```markdown
## Rhinoplasty Procedures

Rhinoplasty, commonly referred to as a nasal reconstruction procedure, is a
surgical intervention designed to modify the aesthetic and/or functional
characteristics of the nasal structure. Our board-certified otolaryngologists
utilize advanced surgical techniques to achieve optimal patient outcomes.
```

**✅ Good (High Retrieval):**
```markdown
## Nose Jobs (Rhinoplasty) - Reshape Your Nose

**Looking for a nose job?** We offer rhinoplasty (nose reshaping surgery) to
improve your nose's appearance and function.

**What is rhinoplasty?** It's a surgical procedure to change your nose shape,
size, or fix breathing problems.

**Cost:** $6,000-$8,000 depending on complexity.
```

**Why bad example fails:**
- "Nasal reconstruction" vs "nose job" (users say "nose job")
- Medical jargon: "otolaryngologists" vs "doctors"
- Complex sentence structure doesn't match conversational queries

---

### Anti-Pattern 2: Abbreviations Without Context

**❌ Bad:**
```markdown
## FAQ

**Q: Do you accept PPO/HMO?**
A: Yes, we're in-network with most plans.
```

**✅ Good:**
```markdown
## Insurance Questions - Do You Accept My Insurance?

**Do you accept insurance?** Yes! We accept most major insurance plans including:
- PPO plans (Preferred Provider Organization)
- HMO plans (Health Maintenance Organization)
- Medicare
- Medicaid

**What insurance do we take?** We're in-network with Blue Cross, Aetna, Cigna,
UnitedHealthcare, and many others.
```

**Why bad example fails:**
- "PPO/HMO" assumes user knows abbreviations
- No semantic context for "insurance" queries
- Too brief - not enough keywords for matching

---

### Anti-Pattern 3: Single-Word Headers

**❌ Bad:**
```markdown
## Location
123 Main St

## Pricing
$400

## Contact
555-1234
```

**✅ Good:**
```markdown
## Where to Find Us - Office Location
123 Main Street, City, State

## How Much Does It Cost? - Transparent Pricing
Services start at $400, with free consultations

## Contact Us - Call or Email Anytime
Phone: (555) 123-4567
Email: contact@clinic.com
```

**Why bad example fails:**
- Headers too short - no semantic context
- No question phrasing to match user queries
- Missing related keywords

---

### Anti-Pattern 4: Scattered Information

**❌ Bad:**
```markdown
## About Us
[... 500 words about history ...]

## Services
[... 300 words listing services ...]

## Pricing
Note: See individual service pages for pricing details

## Botox Information
[... 200 words about Botox ...]
Cost: $400 (mentioned only here)
```

**✅ Good:**
```markdown
## Botox Treatments - Information & Pricing

**Do we offer Botox?** Yes! Botox is one of our most popular treatments.

**What is Botox?** [Brief description]

**How much does Botox cost?** $400-$600 per session.

**Who can get Botox?** [Eligibility]

**How long does Botox last?** [Duration]

**Book your Botox appointment:** Call (555) 123-4567
```

**Why bad example fails:**
- Info split across multiple documents
- User asking "Botox cost" may only retrieve "About Us" chunk
- Pricing separated from service description

---

## 🎯 Content Quality Checklist

### Before Publishing, Verify:

**1. Query Matching (Test Each Section)**
- [ ] Header includes question phrasing ("How much...", "Where is...")
- [ ] First sentence answers the implied question
- [ ] Contains 3+ synonyms for key concepts
- [ ] Natural language (not formal/technical)

**2. Keyword Density**
- [ ] Main topic mentioned 5+ times in section
- [ ] Related terms included (e.g., "cost" + "price" + "fee")
- [ ] Location terms include: address, located, find, visit, directions

**3. Information Architecture**
- [ ] Most important info in first 100 words
- [ ] Related topics within 500 words of each other
- [ ] Call-to-action at end of each section

**4. Readability**
- [ ] Conversational tone (2nd person: "you", "we")
- [ ] Short sentences (<25 words)
- [ ] Clear headers with semantic keywords
- [ ] Bullet points for scanability

---

## 📊 Testing Your Content

### DIY Retrieval Test

**1. Write a query a customer would ask:**
```
"How much does Botox cost?"
```

**2. Check if your content matches:**
- Does header contain "Botox" + "cost"/"price"?
- Is pricing in first paragraph?
- Are there multiple price-related keywords?

**3. Run semantic similarity check:**
```bash
# Use our test script
npx tsx backend/src/scripts/test-single-query.ts \
  --query "How much does Botox cost?" \
  --expected-file "pricing_knowledge_base.md"

# Expected output:
✅ Chunk retrieved: pricing_knowledge_base.md
✅ Similarity score: 0.45 (above 0.3 threshold)
✅ Contains keywords: "Botox", "cost", "$400"
```

---

### A/B Testing Content Variations

**Test:** Which version retrieves better?

**Version A (Current):**
```markdown
## Pricing
Consultation: $150
```

**Version B (Improved):**
```markdown
## How Much Does a Consultation Cost?
**Consultation pricing:** $150 (includes comprehensive assessment)
```

**Test Process:**
1. Upload Version A, run retrieval test
2. Upload Version B (replace Version A), run same test
3. Compare similarity scores

**Metrics:**
- Retrieval success rate (should improve)
- Similarity score (should increase)
- Chunk ranking (should appear higher)

---

## 🔧 Tools for Content Creators

### Content Quality Analyzer (Conceptual)

**Ideal Tool Features:**
- Keyword density checker
- Question pattern detector
- Readability score (Flesch Reading Ease)
- Semantic similarity estimator

**Example Output:**
```
Content Analysis: pricing_knowledge_base.md

✅ Query matching: GOOD (8/10)
   - Header includes question: YES
   - First sentence answers: YES
   - Keyword variations: 6 found

⚠️  Keyword density: MEDIUM (5/10)
   - "price" mentioned: 3 times (recommend 5+)
   - "cost" mentioned: 2 times (recommend 3+)

✅ Readability: GOOD (8/10)
   - Flesch score: 72 (conversational)
   - Avg sentence length: 14 words

Recommendations:
1. Add 2 more instances of "price" or "pricing"
2. Include synonyms: "fee", "charge"
3. Add example query: "How much does X cost?"
```

---

## 📈 Continuous Improvement Process

### Weekly Content Audit

**1. Check Retrieval Metrics (From System Logs)**
```sql
-- Top 10 failed queries (0 chunks retrieved)
SELECT query, COUNT(*) as failures
FROM rag_query_logs
WHERE chunk_count = 0
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY query
ORDER BY failures DESC
LIMIT 10;
```

**2. Identify Content Gaps**
- Queries failing consistently → missing topics
- Low similarity scores → content doesn't match query style

**3. Create/Update Content**
- For each failed query, create dedicated section
- Use query phrasing in header
- Include all keywords from query

**4. Re-Test**
```bash
npx tsx backend/src/scripts/test-live-rag-retrieval.ts
```

**5. Monitor Improvement**
- Success rate should increase week-over-week
- Average similarity scores should rise

---

### Monthly Content Review

**Metrics to Track:**

| Metric | Target | Action if Below Target |
|--------|--------|------------------------|
| Retrieval success rate | >95% | Add missing content for failed queries |
| Avg similarity score | >0.35 | Rewrite low-scoring sections with more keywords |
| Chunks per query | 2-4 | Improve content density (more related info) |
| Query latency | <500ms | No content action (technical optimization) |

---

## 🎓 Training Guide for Content Teams

### Onboarding Checklist

**Day 1: Understanding RAG**
- [ ] Read this document
- [ ] Review example queries and content
- [ ] Understand similarity scoring basics

**Day 2: Writing Practice**
- [ ] Rewrite 3 existing sections using best practices
- [ ] Run retrieval tests on rewrites
- [ ] Compare scores before/after

**Day 3: Content Creation**
- [ ] Create 1 new knowledge base document
- [ ] Include 5+ sections with question headers
- [ ] Test with 10 sample queries

**Day 4: Quality Review**
- [ ] Peer review another team member's content
- [ ] Check against quality checklist
- [ ] Run automated tests

**Day 5: Production Deployment**
- [ ] Upload content to system
- [ ] Verify embeddings generated
- [ ] Monitor retrieval logs for 24 hours

---

### Content Team Best Practices

**1. Collaborative Writing**
- Pair technical experts with content writers
- Expert provides facts, writer optimizes for retrieval
- Review together before publishing

**2. Version Control**
- Keep drafts in Git or document management system
- Track changes to measure improvement
- A/B test major rewrites

**3. Feedback Loop**
- Review retrieval logs weekly
- Identify patterns in failed queries
- Update content proactively

**4. Style Guide Adherence**
- Maintain consistent tone across all documents
- Use approved templates for common topics
- Follow this guide for all new content

---

## 🚀 Quick Wins (High-Impact, Low-Effort)

### 1. Add Question Headers (5 minutes per section)

**Before:**
```markdown
## Pricing
```

**After:**
```markdown
## How Much Does It Cost? - Pricing Information
```

**Impact:** +10-15% similarity score improvement

---

### 2. Front-Load Key Info (2 minutes per section)

**Before:**
```markdown
## Consultation

Our clinic offers comprehensive consultations. We believe in taking time to
understand your needs. Our consultations last 30-45 minutes and include...

Cost: $150
```

**After:**
```markdown
## Consultation - $150 (Includes Assessment)

**Consultation cost:** $150

Our comprehensive consultations last 30-45 minutes and include...
```

**Impact:** +20% retrieval success for pricing queries

---

### 3. Add Keyword Variations (3 minutes per section)

**Before:**
```markdown
## Office Location
123 Main Street
```

**After:**
```markdown
## Where to Find Us - Office Location

We are located at 123 Main Street. You can find our office in the Medical Plaza.
Our address is 123 Main St, Suite 200. Visit us anytime!
```

**Impact:** +25% similarity score for location queries

---

## 📚 Resources & References

### Recommended Reading

1. **Semantic Search Fundamentals**
   - OpenAI Embeddings Guide: https://platform.openai.com/docs/guides/embeddings
   - Vector Search Best Practices: [Internal Wiki]

2. **Content Optimization**
   - SEO for AI (Query-Matching Content): [Blog Post]
   - Conversational Content Writing: [Guide]

3. **RAG System Architecture**
   - Our implementation: `KNOWLEDGE_BASE_RETRIEVAL_COMPLETE_2026-01-28.md`
   - RAG best practices: [Research Paper]

---

### Internal Tools

- **Test Single Query:** `backend/src/scripts/test-single-query.ts`
- **Content Analyzer:** `backend/src/scripts/analyze-content-quality.ts`
- **Retrieval Dashboard:** http://dashboard.voxanne.ai/rag-metrics

---

## 🎯 Summary: The 3 Golden Rules

### 1. Write for Questions, Not Documents
Your content should answer questions users actually ask, in the way they ask them.

### 2. Front-Load Critical Information
Put the most important info in the first 100 words. Don't bury the lead.

### 3. Use Natural, Conversational Language
Write like you're talking to a customer, not writing a medical textbook.

---

**Follow these guidelines, and your knowledge base retrieval accuracy will be >95%.** 🎓

---

**Document Version:** 1.0
**Last Updated:** 2026-01-28
**Maintained By:** Voxanne AI Content Team
**Feedback:** contact@voxanne.ai
