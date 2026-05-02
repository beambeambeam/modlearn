# Hooks Directory

Custom React hooks สำหรับ data fetching และ mutations ทั้งหมดของ admin panel
แยกตาม module เพื่อให้ reuse และ maintain ได้ง่าย

## โครงสร้าง

```
hooks/
├── analytics/
│   └── use-analytics.ts       ← Analytics overview, content views, view sessions
├── audit/
│   ├── use-audit-logs.ts      ← Admin audit log list + filters
│   └── use-notifications.ts   ← Notification bell (poll ทุก 30 วินาที)
├── category/
│   └── use-categories.ts      ← CRUD categories
├── content/
│   ├── use-content.ts         ← CRUD content + publish/availability/classification
│   └── use-content-pricing.ts ← Pricing windows สำหรับ content
├── file/
│   └── use-file.ts            ← Upload (2-step), download URL, delete
├── playlist/
│   ├── use-playlists.ts       ← List + delete playlists (+ query key factory)
│   ├── use-playlist.ts        ← CRUD playlist + publish/availability
│   ├── use-playlist-episodes.ts ← Add/remove/reorder episodes
│   └── use-playlist-pricing.ts  ← Pricing windows สำหรับ playlist
└── users/
    └── use-users.ts           ← User list + set role + ban/unban (ผ่าน better-auth)
```

---

## Pattern ที่ใช้ทั่วทั้งโปรเจกต์

### 1. Query Key Factory
ทุก module มี `xxxKeys` object สำหรับ manage cache keys

```ts
// ตัวอย่างจาก use-playlists.ts
export const playlistKeys = {
  all:     () => ["playlist"]                        as const,
  lists:   () => ["playlist", "list"]                as const,
  list:    (page, search) => ["playlist", "list", page, search] as const,
  detail:  (id) => ["playlist", "detail", id]        as const,
  episodes:(id) => ["playlist", "episodes", id]      as const,
};
```

ใช้ key เหล่านี้ตอน `invalidateQueries` เสมอ อย่า hardcode string

---

### 2. Mutation + Cache Invalidation

```ts
// หลัง mutate สำเร็จ → invalidate cache → UI refresh อัตโนมัติ
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: playlistKeys.lists() });
}
```

---

### 3. placeholderData

```ts
// ป้องกัน UI flicker ตอนเปลี่ยนหน้า/search
placeholderData: (prev) => prev,
```

ใส่ทุก query ที่มี pagination หรือ filter

---

### 4. Optimistic Update (use-playlist-episodes.ts)

```ts
// drag & drop episodes — อัปเดต UI ทันที ไม่รอ server
onMutate: async (variables) => {
  await queryClient.cancelQueries(...);
  const previous = queryClient.getQueryData(...);
  queryClient.setQueryData(..., newValue);  // อัปเดตทันที
  return { previous };                      // เก็บไว้ rollback
},
onError: (_err, _vars, context) => {
  queryClient.setQueryData(..., context.previous); // rollback ถ้า fail
},
```

---

## Hooks ที่ใช้ได้ทั้ง Admin และ User Side

| Hook | File | หมายเหตุ |
|------|------|----------|
| `useCategories` | `category/use-categories.ts` | ใช้ `orpc.category.list` (public endpoint) |
| `useContents` | `content/use-content.ts` | ถ้าต้องการ public ให้เปลี่ยนเป็น `orpc.content.list` |

---

## การ Connect กับ Backend

hooks ทุกตัวใช้ `orpc` จาก `@/utils/orpc` ยกเว้น `use-users.ts`
ที่ใช้ `authClient.admin` จาก `@/lib/auth-client` โดยตรง
เพราะ user management ผ่าน better-auth ไม่ผ่าน oRPC

```ts
// oRPC pattern (ส่วนใหญ่)
import { orpc } from "@/utils/orpc";
useQuery(orpc.playlist.adminList.queryOptions({ input: { ... } }));

// better-auth pattern (users เท่านั้น)
import { authClient } from "@/lib/auth-client";
await authClient.admin.listUsers({ query: { ... } });
```

---

## สำหรับเพื่อนที่มาทำ User Side

ถ้าต้องการ hooks สำหรับ user side แนะนำให้สร้าง folder แยก เช่น:

```
hooks/
└── user/
    ├── use-my-library.ts    ← watchProgress, library
    ├── use-browse.ts        ← content list, search
    └── use-player.ts        ← playback session
```

และใช้ public endpoints เช่น:
- `orpc.content.list` แทน `orpc.content.adminList`
- `orpc.playlist.list` แทน `orpc.playlist.adminList`
- `orpc.category.list` (ใช้ได้ทั้งสองฝั่ง)