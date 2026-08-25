# Coding Agent Prompt — Agreement Builder

Implement the **Agreement Builder** section of the Saral Setu residential rent-agreement workflow.

## Context

The following journey already exists:

```text
Intent
→ Guided Details
→ Requirements
→ Agreement Builder   ← BUILD THIS
→ Review / Negotiate
→ Finalize
→ Stamp
→ Verify
→ Notary
→ Sign
→ Complete
```

The previous screens have already collected structured tenancy information such as:

- landlord and tenant
- property address
- city/state
- monthly rent
- security deposit
- tenancy duration
- start date

The Requirements screen has already determined the execution requirements.

The purpose of this section is to help ordinary users create a **complete, understandable and configurable rental agreement** without making them write legal clauses themselves.

The experience should feel like:

> **Choose what matters for your home. We’ll build the agreement.**

Do not present users with an intimidating legal form.

---

# 1. Core UX

Create a two-part Agreement Builder.

On desktop:

```text
┌───────────────────────────┬───────────────────────────────┐
│ CUSTOMIZE YOUR AGREEMENT  │ AGREEMENT PREVIEW             │
│                           │                               │
│ ✓ Basics                  │ RESIDENTIAL RENT AGREEMENT    │
│ ▼ Rent & Deposit          │                               │
│ ▼ Term & Exit             │ 1. Parties                    │
│ ▼ Maintenance             │ 2. Property                   │
│ ▼ Usage                   │ 3. Term                       │
│ ▼ Furnishing & Inventory  │ ...                           │
│ ▼ Additional Terms        │                               │
│                           │                               │
└───────────────────────────┴───────────────────────────────┘
```

On mobile, show the configuration interface first and allow:

**Preview Agreement**

to open the generated document in a full-screen sheet/page.

The agreement preview should update based on the user's selections.

---

# 2. Clause Selection Model

Do not show dozens of individual legal clauses in one giant checklist.

Organize clauses into **collapsible categories**.

Each category should have:

- checkbox/toggle
- category title
- short plain-English description
- expand/collapse control
- configurable fields inside it

Example:

```text
☑ Security Deposit
  How the deposit is paid and returned
                         ▼
```

Expanded:

```text
Security Deposit

Amount
₹1,20,000

Refund within
[ 30 ] days

Deductions permitted for:
☑ Unpaid rent
☑ Utility bills
☑ Damage beyond normal wear and tear

☐ Other
```

Selections should directly influence the generated agreement.

---

# 3. Clause Importance

Support three levels.

## Essential

These should be selected and locked because they define the fundamental transaction.

Display a small:

**Essential**

badge.

Include:

- Parties
- Property
- Tenancy term
- Monthly rent
- Security deposit
- Signatures / execution

Do not allow these categories to be accidentally removed.

---

## Recommended

Selected by default, but users may deselect them.

If deselected, do not block the user, but optionally show a subtle warning such as:

> Usually included to avoid ambiguity later.

Recommended categories should include:

- Rent payment terms
- Deposit refund
- Maintenance
- Utilities
- Repairs and damage
- Notice and termination
- Permitted use
- Subletting
- Property access / inspection

---

## Optional

Not selected unless appropriate.

Examples:

- Lock-in period
- Rent escalation
- Pets
- Parking
- Guests/additional occupants
- Work from home
- Painting/restoration
- Furnishing inventory
- Appliance maintenance
- Renewal terms
- Early-exit conditions
- Additional custom terms

Do not imply these classifications are universal legal requirements.

They are product defaults for the demo.

---

# 4. Clause Categories

Implement the following collapsible groups.

---

## A. Agreement Basics

**Essential — always selected**

Populate automatically from the guided-details state.

Show:

- landlord name
- tenant name
- property address
- agreement commencement date
- tenancy duration

This section primarily allows users to review existing information rather than re-enter it.

The generated agreement should contain clauses defining:

- landlord/licensor
- tenant/licensee
- residential premises
- commencement date
- duration

Use the terminology already established by the project.

Do not inconsistently switch between lease / license terminology throughout the document.

---

# 5. Rent & Payments

Category selected by default.

### Monthly Rent

Essential.

Show:

```text
Monthly rent
₹40,000

Payment due by
[ 5th ] of every month

Payment mode
☑ Bank transfer / UPI
☐ Cash
☐ Other
```

Generate corresponding agreement language.

---

### Late Payment

Recommended but independently togglable.

Options:

```text
☑ Include late-payment terms

Grace period
[ 5 ] days

Consequences
[ configurable simple text/value ]
```

Avoid automatically inventing punitive terms.

---

### Rent Escalation

Optional.

```text
☐ Rent escalation

Increase by
[ 5 ] %

After
[ 11 ] months
```

Only generate the escalation clause when enabled.

---

# 6. Security Deposit

Essential.

Use security deposit amount from existing state.

Configuration:

```text
Security deposit
₹1,20,000

Refund within
[ 30 ] days after handover
```

Default to **30 days** because this value will be used later in the negotiation demo.

Allow deductions for:

```text
☑ Unpaid rent
☑ Outstanding utility bills
☑ Damage beyond normal wear and tear
☐ Other agreed charges
```

Include the concept of **normal wear and tear**.

The resulting clause should be structured so that the later Review workflow can change:

```diff
- refunded within 30 days
+ refunded within 7 days
```

Give this clause a stable ID such as:

```ts
"security-deposit-refund"
```

This is important for the subsequent collaborative-review flow.

---

# 7. Duration, Renewal & Exit

Create a collapsible category containing:

### Tenancy Duration

Essential.

Already populated from guided details.

---

### Notice Period

Recommended.

Example:

```text
☑ Notice period

Either party must provide
[ 1 month ] notice
```

Options could include:

- 15 days
- 1 month
- 2 months
- custom

---

### Lock-in Period

Optional.

```text
☐ Lock-in period

Duration
[ 6 months ]

Applies to
◉ Both parties
○ Tenant only
○ Landlord only
```

If enabled, generate a corresponding clause.

---

### Renewal

Optional.

```text
☐ Renewal terms

◉ Renewal by mutual written agreement
○ Automatically renew
```

Prefer mutual written agreement as the demo default.

---

### Early Termination

Recommended.

Allow basic reasons such as:

```text
☑ Non-payment of rent
☑ Material breach of agreement
☑ Illegal use of premises
☐ Other
```

Do not generate unnecessarily aggressive eviction language.

---

# 8. Maintenance & Society Charges

Recommended.

Configuration:

```text
Society / maintenance charges

Paid by:
○ Landlord
● Tenant
○ Included in rent
```

Optionally separate:

```text
Regular society maintenance
[ Tenant ]

Major society assessments
[ Landlord ]
```

Generate the agreement accordingly.

---

# 9. Utilities

Recommended.

Allow individual responsibility selection:

```text
Electricity          Tenant
Water                Tenant
Piped gas            Tenant
Internet             Tenant
DTH / Cable          Tenant
Society charges      Tenant
Property tax         Landlord
```

Use a compact UI rather than individual verbose cards.

Do not include utilities that the user deselects.

---

# 10. Repairs & Damage

Recommended.

Clearly distinguish between:

### Tenant responsibilities

Examples:

- routine upkeep
- minor consumables
- damage caused by tenant or occupants
- damage beyond normal wear and tear

### Landlord responsibilities

Examples:

- structural repairs
- major plumbing/electrical defects not caused by tenant
- defects to provided fixtures/appliances depending on configured responsibility

Allow simple customization.

Avoid presenting these defaults as statutory rules.

---

# 11. Property Usage

Recommended category.

### Permitted Use

Default:

```text
☑ Residential use
```

Optional:

```text
☐ Work from home permitted
```

Do not include commercial-use options in the MVP.

---

### Subletting

Default:

```text
☑ Subletting requires landlord's written consent
```

Options:

```text
● Not allowed without written consent
○ Allowed
```

---

### Alterations

Recommended.

Example:

```text
☑ Material alterations require landlord approval
```

---

# 12. Occupancy

Optional category.

Allow:

### Additional occupants

```text
Occupants

+ Add occupant

Name
Relationship
```

Do not collect sensitive identity information.

---

### Guests

Optional:

```text
☐ Guest-stay conditions
```

Keep this simple and avoid overly intrusive defaults.

---

### Pets

Optional:

```text
☐ Include pet clause

○ Pets allowed
○ Pets allowed with conditions
○ Pets not permitted
```

If "with conditions" is selected, allow a short condition field.

---

# 13. Landlord Access / Inspection

Recommended.

Example configuration:

```text
☑ Property inspection / access

Prior notice
[ 24 hours ]

Exceptions
☑ Emergency situations
```

Generated language should explain that reasonable prior notice is expected except in emergencies.

Do not present the default notice period as universally mandated law.

---

# 14. Parking

Optional.

```text
☐ Parking included

Type
○ Car
○ Two-wheeler
○ Both

Parking identifier
[ B-42 ]
```

Include it in both:

- property description
- agreement terms

when enabled.

---

# 15. Painting / Restoration at Exit

Optional.

Example:

```text
☐ Include move-out restoration terms
```

Options:

```text
○ Tenant returns property in substantially the same condition,
  excluding normal wear and tear

○ Painting cost deducted as agreed

○ Custom
```

Do not default to arbitrary monetary deductions.

---

# 16. Furnishing Level

This is an important product feature.

Create a dedicated prominent category:

> **Furnishing & Inventory**

First ask:

```text
How is the property furnished?

○ Unfurnished
○ Semi-furnished
○ Fully furnished
```

The selection should determine sensible default inventory categories.

However, the user must always be able to customize the actual inventory.

---

# 17. Furnishing Inventory

After furnishing level selection, show collapsible inventory categories.

Each category should have a category checkbox.

Each individual item should support:

```text
Item
Quantity
Condition
Notes
```

Suggested condition values:

- New
- Good
- Fair
- Existing damage
- Not checked

Do not require every field.

---

## Furniture

Possible items:

```text
☐ Bed
☐ Mattress
☐ Wardrobe
☐ Sofa
☐ Dining table
☐ Dining chairs
☐ Coffee table
☐ Study table
☐ Office chair
☐ Bookshelf
☐ Shoe rack
☐ TV unit
☐ Side tables
```

Allow:

**+ Add custom item**

---

## Major Appliances

```text
☐ Refrigerator
☐ Washing machine
☐ Air conditioner
☐ Television
☐ Geyser / water heater
☐ Microwave
☐ Dishwasher
☐ Water purifier
☐ Inverter / UPS
```

For applicable appliances optionally capture:

- brand
- model
- quantity
- condition

Do not make brand/model mandatory.

---

## Kitchen Appliances

Separate these from major household appliances.

```text
☐ Gas stove
☐ Induction cooktop
☐ Chimney
☐ Oven
☐ Microwave
☐ Mixer / grinder
☐ Electric kettle
☐ Toaster
```

---

## Kitchenware

For fully furnished properties, allow:

```text
☐ Cookware
☐ Plates / bowls
☐ Glasses / cups
☐ Cutlery
☐ Cooking utensils
☐ Storage containers
```

Allow quantities where useful.

The UI should not force users to inventory every spoon individually.

Keep categories practical.

---

## Fixtures & Fittings

Examples:

```text
☐ Ceiling fans
☐ Lights
☐ Curtains
☐ Curtain rods
☐ Wardrobes
☐ Modular kitchen
☐ Bathroom mirrors
☐ Exhaust fans
☐ Shower fittings
```

---

## Electronics / Smart Devices

Optional:

```text
☐ Wi-Fi router
☐ Smart TV
☐ Video doorbell
☐ Smart lock
☐ Intercom
```

---

## Keys & Access

Include:

```text
Main-door keys        [ 2 ]
Bedroom keys          [ 2 ]
Mailbox keys          [ 1 ]
Parking access card   [ 1 ]
Society access card   [ 2 ]
```

Allow custom access items.

---

# 18. Meter Readings

Provide an optional section:

```text
☐ Record move-in meter readings
```

Fields:

```text
Electricity
[ ______ ]

Water
[ ______ ]

Gas
[ ______ ]
```

Only show relevant utilities.

---

# 19. Inventory Schedule

Do **not** clutter the main body of the rent agreement with every inventory item.

Generate a separate section at the end:

> **Schedule A — Furnishings, Fixtures & Inventory**

Example:

```text
Schedule A — Furnishings, Fixtures & Inventory

Item                 Qty     Condition
------------------------------------------------
Double Bed            1      Good
Wardrobe              2      Good
Refrigerator          1      Fair
Washing Machine       1      Good
Gas Stove             1      Good
Dining Chairs         4      Good
```

Include optional notes.

The main agreement should reference this schedule.

For example conceptually:

> The premises are provided together with the furnishings, fixtures and appliances listed in Schedule A.

Do not make this wording unnecessarily complex.

---

# 20. Custom Terms

At the bottom of the configuration, provide:

> **Add another term**

The user should be able to provide a plain-language condition such as:

> “Tenant can install a wall-mounted television with landlord approval.”

For the MVP, this can create a simple custom clause.

Do not call an LLM.

Clearly label custom clauses as:

**Custom term**

---

# 21. Generated Agreement

Generate the actual agreement from structured data.

Do not create one giant hard-coded agreement string.

Prefer something conceptually like:

```ts
interface AgreementClause {
  id: string;
  category: string;
  title: string;
  enabled: boolean;
  text: string;
}
```

Then:

```ts
generateAgreement({
  agreementDetails,
  clauseConfiguration,
  furnishingInventory
})
```

should produce the ordered clauses.

Changing a selection must alter the generated agreement.

For example:

```text
Pets OFF
→ no pet clause exists in agreement

Parking ON
→ parking appears in property description and terms

Lock-in OFF
→ no lock-in clause

Fully Furnished
→ Schedule A is generated

Deposit refund = 30 days
→ generated deposit clause contains 30 days
```

The preview must represent the **actual configuration**, not a separate static mock document.

---

# 22. Agreement Structure

A generated agreement could use an order similar to:

```text
RESIDENTIAL RENT AGREEMENT

1. Parties
2. Premises
3. Term
4. Monthly Rent
5. Security Deposit
6. Maintenance and Society Charges
7. Utilities
8. Repairs and Maintenance
9. Permitted Use
10. Subletting
11. Alterations
12. Access and Inspection
13. Lock-in Period              [if enabled]
14. Notice and Termination
15. Renewal                    [if enabled]
16. Pets                       [if enabled]
17. Parking                    [if enabled]
18. Restoration                [if enabled]
19. Additional Terms           [if provided]
20. Dispute / Jurisdiction
21. Execution

Schedule A — Furnishings & Inventory [if applicable]
```

Do not render disabled clauses.

Renumber sections automatically.

---

# 23. Agreement Preview UX

Make the document look like a real agreement without trying to recreate Microsoft Word.

Requirements:

- strong document title
- readable typography
- numbered sections
- clear party names
- readable paragraph widths
- highlighted configurable values where appropriate
- inventory table
- good print appearance

The user should be able to quickly understand:

> “This is the document I am creating.”

---

# 24. Explainability

Where useful, provide small:

**What does this mean?**

interactions for terms such as:

- lock-in period
- notice period
- subletting
- normal wear and tear
- rent escalation

Explanations should use plain English.

Do not build a generic chatbot in this stage.

The richer document-chat experience belongs to the subsequent Review section.

---

# 25. CTA

The primary CTA should be:

> **Continue to Review**

Before continuing, show a brief summary:

```text
Your agreement

12 clauses included
3 optional clauses selected
8 inventory items recorded

[ Continue to Review ]
```

The next workflow will allow the landlord and tenant to understand, negotiate and approve the generated agreement.

Do **not** jump directly to signing.

---

# 26. State Persistence

All selections must survive navigation backward and forward.

Persist:

- selected clause categories
- individual clause settings
- furnishing level
- inventory
- quantities
- conditions
- custom terms
- generated agreement version

Reuse the application's existing state architecture.

Do not introduce another independent state store unless necessary.

---

# 27. Demo Defaults

Configure the canonical demo so it looks complete immediately.

Suggested defaults:

```text
Rent                         ₹40,000
Deposit                      ₹1,20,000
Deposit refund               30 days
Duration                     11 months
Notice                       1 month
Maintenance                  Tenant
Electricity                  Tenant
Water                        Tenant
Property tax                 Landlord
Subletting                   Written consent required
Access notice                24 hours
Furnishing                   Semi-furnished
```

Suggested demo inventory:

```text
Wardrobe          2     Good
Ceiling Fan       4     Good
Geyser            2     Good
Air Conditioner   2     Good
Modular Kitchen   1     Good
Chimney           1     Good
Gas Stove         1     Good
```

These are demo defaults, not claimed Indian standards.

---

# 28. Product Guardrails

This is a hackathon prototype, not legal advice.

Do not tell the user:

> “This agreement is legally valid because these clauses are selected.”

Do not label every default as legally mandatory.

Do not claim optional terms are required by Indian law.

Where necessary, use:

> “Recommended for clarity”

rather than:

> “Required by law.”

State-specific legal requirements are handled elsewhere in the Saral Setu workflow.

The Agreement Builder's purpose is primarily:

> **helping the parties clearly express the terms they have agreed upon.**

---

# 29. Design Requirements

Reuse the existing Saral Setu visual system.

Do not redesign previous screens.

The builder should feel:

- approachable
- structured
- trustworthy
- significantly easier than editing a legal document manually

Avoid:

- giant forms
- dozens of checkboxes visible simultaneously
- dense legal prose in the configuration pane
- modal overload
- excessive animations

Collapsible categories are central to this interaction.

At a glance the user should see something like:

```text
Agreement Basics             ✓ Essential
Rent & Deposit               ✓ Included
Duration & Exit              ✓ Included
Maintenance & Utilities      ✓ Included
Property Usage               ✓ Included
Furnishing & Inventory       ✓ 7 items
Pets                         ○ Not included
Parking                      ○ Not included
Additional Terms             ○ None
```

---

# 30. Implementation Approach

Before coding:

1. Inspect the existing application.
2. Understand the current tenancy state.
3. Understand the existing design system.
4. Identify the current next-step navigation.
5. Reuse existing types where appropriate.
6. Propose any significant state-model additions before large refactors.

Prefer separating:

```text
Agreement configuration
        ↓
Clause generation
        ↓
Agreement rendering
```

rather than mixing all three concerns into one large React component.

Suggested conceptual modules:

```text
agreement/
├── AgreementBuilder
├── ClauseCategory
├── ClauseConfiguration
├── FurnishingInventory
├── AgreementPreview
└── AgreementSummary

domain/
├── clauseDefinitions
├── agreementConfiguration
├── generateAgreement
└── inventoryTypes
```

Adapt this to the existing repository rather than forcing this exact structure.

---

# 31. Definition of Done

This section is complete when:

1. Existing tenancy details populate automatically.
2. Clause categories are collapsible.
3. Categories show their selected state without expansion.
4. Essential clauses cannot accidentally disappear.
5. Recommended/optional clauses can be enabled or disabled.
6. Configuration values alter generated clause text.
7. Deposit refund defaults to 30 days.
8. Furnishing level supports:
   - unfurnished,
   - semi-furnished,
   - fully furnished.
9. Furnishing inventory supports multiple categories.
10. Gas stove and kitchenware are represented.
11. Items support quantity and condition.
12. Custom inventory items can be added.
13. Schedule A is automatically generated.
14. Disabled clauses do not appear in the agreement.
15. Sections renumber correctly.
16. Agreement preview works on desktop.
17. Agreement preview works on mobile.
18. Selections persist through navigation.
19. Continue to Review works.
20. `npm run build` succeeds.
21. Existing workflow screens remain unaffected.

After implementation, summarize:

- files changed,
- state-model changes,
- clause categories implemented,
- how agreement generation works,
- known shortcuts taken for the demo,
- build/test status.

Do not implement the collaborative negotiation/chat workflow yet. That is the next milestone.