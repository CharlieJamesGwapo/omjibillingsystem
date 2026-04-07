# Fix All Bugs & Unify OMJI Billing System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all bugs in web and mobile apps, unify branding/design between web and mobile, make everything fully functional.

**Architecture:** Fix API endpoint mismatches in Messages.tsx, unify auth token keys, update mobile color scheme from red to match web's navy/cyan brand, create proper OMJI SVG logo, update all hardcoded color references.

**Tech Stack:** React 19 + Tailwind (web), Expo/React Native (mobile), Go backend

---

### Task 1: Fix Web Messages.tsx API Bugs

**Files:**
- Modify: `web/src/pages/admin/Messages.tsx:399-448`

- [ ] **Step 1: Fix send-group endpoint and send-template endpoint**

In `web/src/pages/admin/Messages.tsx`, make these changes:

Line 399: Change `/messages/send-group` to `/messages/bulk`
Line 417: Change `/messages/send-template` to `/messages/template`  
Line 418: Change `template_id: selectedTemplateId` to `template: selectedTemplateId`

- [ ] **Step 2: Fix welcome template quick action**

Line 446: The `/messages/template` endpoint doesn't accept `recipient_id`. For sending to a specific customer, use `/messages/send` instead:

```typescript
} else if (action === 'send-welcome' && payload?.customer_id) {
  res = await api.post<{ sent: number; failed: number }>('/messages/send', { 
    recipient_id: payload.customer_id, 
    message: 'Welcome to OMJI Internet! Your account has been set up.' 
  });
}
```

- [ ] **Step 3: Verify no other endpoint mismatches**

Confirm all other API calls in Messages.tsx match backend routes.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/admin/Messages.tsx
git commit -m "fix: correct Messages.tsx API endpoint mismatches"
```

---

### Task 2: Fix Auth Token Keys & Branding References

**Files:**
- Modify: `web/src/lib/auth.ts:4-5`
- Modify: `web/index.html`

- [ ] **Step 1: Update web auth token keys from jdns to omji**

In `web/src/lib/auth.ts`:
```typescript
const ACCESS_TOKEN_KEY = 'omji_access_token'
const REFRESH_TOKEN_KEY = 'omji_refresh_token'
```

- [ ] **Step 2: Update web index.html title and favicon**

Update the title to be clean and update favicon reference.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/auth.ts web/index.html
git commit -m "fix: unify auth token keys to omji prefix"
```

---

### Task 3: Create OMJI SVG Logo

**Files:**
- Create: `web/public/omji-logo.svg`
- Create: `mobile/assets/omji-logo.svg` (same file)

- [ ] **Step 1: Create a professional SVG logo**

Design a clean, modern SVG logo for OMJI Internet with a wifi/network motif using the brand colors (cyan #22d3ee on dark navy #0a1120). The logo should work at small sizes (favicon) and large sizes (login page).

- [ ] **Step 2: Commit**

```bash
git add web/public/omji-logo.svg
git commit -m "feat: add OMJI SVG logo"
```

---

### Task 4: Update Web to Use New Logo

**Files:**
- Modify: `web/src/pages/Login.tsx` (logo references)
- Modify: `web/src/components/AdminLayout.tsx` (logo references)
- Modify: `web/src/components/CustomerLayout.tsx` (logo references)
- Modify: `web/index.html` (favicon)

- [ ] **Step 1: Replace all /lego.jpeg references with /omji-logo.svg**

Update Login.tsx, AdminLayout.tsx, CustomerLayout.tsx to use the new logo.

- [ ] **Step 2: Update favicon in index.html**

```html
<link rel="icon" type="image/svg+xml" href="/omji-logo.svg" />
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Login.tsx web/src/components/AdminLayout.tsx web/src/components/CustomerLayout.tsx web/index.html
git commit -m "feat: update web app to use OMJI SVG logo"
```

---

### Task 5: Unify Mobile Color Scheme

**Files:**
- Modify: `mobile/constants/colors.ts`
- Modify: `mobile/app.json`
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/app/(auth)/login.tsx`
- Modify: `mobile/app/(technician)/_layout.tsx`
- Modify: `mobile/app/(customer)/_layout.tsx`
- Modify: `mobile/components/PlanCard.tsx`

- [ ] **Step 1: Update mobile color palette to match OMJI brand**

In `mobile/constants/colors.ts`, change from red to navy/cyan theme:
```typescript
export const Colors = {
  primary: '#0e7490',        // Cyan dark (matches web)
  primaryDark: '#0a5c73',    // Darker cyan
  primaryLight: '#e0f7fa',   // Light cyan tint
  black: '#0a1120',          // Navy (matches web bg-surface)
  grey700: '#334155',
  grey500: '#64748b',
  grey300: '#94a3b8',
  grey100: '#f1f5f9',
  background: '#f0f4f8',    // Light cool grey
  surface: '#FFFFFF',
  border: '#e2e8f0',
  success: '#10b981',        // Matches web accent
  successLight: '#d1fae5',
  warning: '#f59e0b',        // Matches web
  warningLight: '#fef3c7',
  error: '#ef4444',          // Matches web
  errorLight: '#fee2e2',
  info: '#22d3ee',           // Cyan secondary (matches web)
  infoLight: '#cffafe',
  accent: '#22d3ee',         // Cyan accent for highlights
} as const;
```

- [ ] **Step 2: Update app.json splash/icon colors**

Change `backgroundColor` from `#CC0000` to `#0a1120` (navy) in both splash and adaptive icon.

- [ ] **Step 3: Update root _layout.tsx StatusBar and loading color**

- [ ] **Step 4: Update login.tsx gradient colors**

Change LinearGradient from `[Colors.primary, Colors.primaryDark]` — this will automatically use new colors.

- [ ] **Step 5: Update tab bar active tint colors in both layout files**

Change `tabBarActiveTintColor` from `#CC0000` to the new primary color.

- [ ] **Step 6: Update PlanCard gradient**

Change from `['#CC0000', '#990000']` to `[Colors.primary, Colors.primaryDark]`.

- [ ] **Step 7: Update hardcoded #CC0000 references in technician _layout.tsx badge**

- [ ] **Step 8: Commit**

```bash
git add mobile/constants/colors.ts mobile/app.json mobile/app/_layout.tsx mobile/app/\(auth\)/login.tsx mobile/app/\(technician\)/_layout.tsx mobile/app/\(customer\)/_layout.tsx mobile/components/PlanCard.tsx
git commit -m "feat: unify mobile color scheme with web brand (navy/cyan)"
```

---

### Task 6: Improve Mobile API Configuration

**Files:**
- Modify: `mobile/constants/api.ts`

- [ ] **Step 1: Update API base URL fallback**

The current default `10.0.2.2:8080` only works on Android emulator. Add platform detection:

```typescript
import { Platform } from 'react-native';

const getDefaultApiUrl = () => {
  if (Platform.OS === 'android') return 'http://10.0.2.2:8080';
  if (Platform.OS === 'ios') return 'http://localhost:8080';
  return 'http://localhost:8080';
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || getDefaultApiUrl();
```

- [ ] **Step 2: Commit**

```bash
git add mobile/constants/api.ts
git commit -m "fix: platform-aware API URL fallback for iOS/Android/web"
```

---

### Task 7: Update Mobile Typography Colors

**Files:**
- Modify: `mobile/constants/typography.ts`

- [ ] **Step 1: Update text colors to match new palette**

Change all `#1A1A1A` references to `#0a1120` (the new Colors.black / navy).

- [ ] **Step 2: Commit**

```bash
git add mobile/constants/typography.ts
git commit -m "feat: update typography colors to match brand"
```

---

### Task 8: Final Build Verification

- [ ] **Step 1: Verify web builds**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 2: Verify mobile TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

- [ ] **Step 3: Fix any errors found**

- [ ] **Step 4: Final commit if needed**
