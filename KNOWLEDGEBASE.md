# Xlink Knowledge Base: Unified Enterprise Entity Architecture & Complete Facilities Specification

---
version: 1.1.0
product: Xlink (Cleanroom Unified Enterprise Entity Engine)
classification: Sovereign Product Knowledge Base
compliance: Google Core Infra L6/L7 & Microsoft Azure Core L65–L67 Standards
architecture: Hexagonal Clean Architecture / Bounded Context Isolation
---

## 1. Executive Architecture & Mission

Xlink is a cleanroom, enterprise-grade, high-performance **Unified Entity & Resource Gateway**. It provides single-endpoint integration across identity, directory objects, messaging, collaboration, cloud storage, security intelligence, and real-time event streams behind a high-concurrency API gateway (`https://xlink.xcorp.io`).

### 1.1 Architectural Philosophy: The Single Endpoint Gateway
Xlink implements the single-endpoint gateway model:
* **Production Endpoint (`v1.0`)**: `https://xlink.xcorp.io/v1.0/` — Strictly additive public contracts, following the Expand/Contract (Parallel Run) migration pattern. No breaking changes or field removals allowed.
* **Preview / Fast-Track Endpoint (`beta`)**: `https://xlink.xcorp.io/beta/` — Experimental and staging endpoints for newly drafted specifications before graduation to `v1.0`.

```
                  +-------------------------------------------------------+
                  |         Client SDKs (.NET, TS, Go, Python, Java)      |
                  +-------------------------------------------------------+
                                              |
                                              | HTTPS (TLS 1.3 / HTTP/2 & 3)
                                              v
+-----------------------------------------------------------------------------------------+
|                                 XLINK API GATEWAY                                       |
|  - TLS Handshake & Token Validation (Sentinel / XID RS256 JWT Verification)             |
|  - Rate Limiter & Throttling Guard (Redis Leaky-Bucket / 429 Retry-After)               |
|  - Keyset Query Parser ($select, $filter, $expand, $top, $skipToken, $search)           |
|  - JSON Batch Engine (POST /$batch - Max 20 Requests with Dependency DAG)                |
+-----------------------------------------------------------------------------------------+
       |                           |                          |                     |
       v                           v                          v                     v
+--------------+           +---------------+          +---------------+     +---------------+
| Identity &   |           | Messaging &   |          | Drive & File  |     | Event & Sync  |
| Directory    |           | Collaboration |          | Engine        |     | Engine        |
| - /users     |           | - /messages   |          | - /drives     |     | - /delta      |
| - /groups    |           | - /events     |          | - /driveItems |     | - Webhooks    |
| - /directory |           | - /teams      |          | - UploadSess  |     | - Rich Alerts |
+--------------+           +---------------+          +---------------+     +---------------+
       |                           |                          |                     |
       +---------------------------+--------------------------+---------------------+
                                   | Internal Ports
                                   v
+-----------------------------------------------------------------------------------------+
|                                  PLATFORM CORE ADAPTERS                                 |
|  - XDB (PostgreSQL / MongoDB Vaults with Cursor Keyset Pagination)                      |
|  - Blitz (Ultra-Low Latency Messaging, WebSocket Pub/Sub & Webhook Delivery)            |
|  - Sentinel (OIDC / OAuth2 Token Minting & RBAC Policy Check)                           |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Authentication, Authorization & Security Model

Xlink operates a zero-trust OAuth 2.0 and OpenID Connect (OIDC) security framework federated through **Sentinel** and **XID**.

### 2.1 Complete Permissions & Scopes Catalog

| Scope | Type | Workload / Capability | Description |
| :--- | :--- | :--- | :--- |
| `User.Read` | Delegated | Identity | Read signed-in user's full profile and basic tenant metadata. |
| `User.ReadWrite` | Delegated | Identity | Read and update signed-in user's profile properties. |
| `User.ReadBasic.All` | Delegated / App | Identity | Read basic public directory attributes of all tenant users. |
| `User.Read.All` | Delegated / App | Identity | Read all user profiles across the directory. |
| `User.ReadWrite.All` | Application | Identity | Full administrative provisioning, updating, and de-provisioning of users. |
| `Directory.Read.All` | Application | Directory | Read all directory objects (users, groups, service principals). |
| `Directory.ReadWrite.All`| Application | Directory | Administrative mutation across all directory objects. |
| `Mail.Read` | Delegated | Messaging | Read user emails, attachments, and folder hierarchies. |
| `Mail.ReadWrite` | Delegated | Messaging | Read, create, draft, update, and organize user emails. |
| `Mail.Send` | Delegated / App | Messaging | Send emails as the user or as a background service. |
| `Calendars.Read` | Delegated | Calendar | Read user calendars, meeting schedules, and availability. |
| `Calendars.ReadWrite` | Delegated | Calendar | Create, update, reschedule, and delete calendar events. |
| `Files.Read` | Delegated | Storage | Read user's files and documents. |
| `Files.ReadWrite` | Delegated | Storage | Create, edit, and manage files in user's drive. |
| `Files.Read.All` | Delegated / App | Storage | Read all files accessible in the enterprise tenant. |
| `Files.ReadWrite.All`| Application | Storage | Full read/write across all cloud drives and document libraries. |
| `Chat.Read` | Delegated | Collaboration| Read 1:1 and group chat threads and messages. |
| `Chat.ReadWrite` | Delegated | Collaboration| Send and manage chat messages and conversation streams. |
| `ChannelMessage.Send`| Delegated / App | Collaboration| Post messages into team channels. |
| `Team.Create` | Delegated / App | Collaboration| Create new teams and channels. |
| `SecurityAlert.Read.All`| Application| Security | Read security incidents, alerts, and threat scores. |

### 2.2 Security Perimeter Validation
* **Bearer Token Handshake**:
  - `Authorization: Bearer <JWT>`
  - Algorithm: RS256 with asymmetric key rotation.
  - Required Claims: `iss` (Sentinel), `aud` (`https://xlink.xcorp.io`), `exp`, `nbf`, `sub`, `scp` (delegated) or `roles` (application).
* **RFC 7807 Authorization Failures**:
  - Missing token: `401 Unauthorized` with `application/problem+json`.
  - Insufficient scope: `403 Forbidden` with required scope details in the `detail` block.

---

## 3. Core Resource Schemas & Endpoint Specifications

### 3.1 Identity & Directory Workload

#### `/v1.0/users`
* **Fields**:
  - `id`: Nominal branded `UserId` (`UUIDv4`).
  - `userPrincipalName`: Canonical user email identifier (e.g., `user@domain.xcorp.io`).
  - `displayName`: Formatted full name.
  - `givenName`: First name.
  - `surname`: Last name.
  - `mail`: Primary SMTP address.
  - `mobilePhone`: E.164 formatted telephone number.
  - `officeLocation`: Physical location.
  - `preferredLanguage`: BCP-47 locale code (e.g., `en-US`).
  - `accountEnabled`: Boolean status flag.
  - `jobTitle`: Corporate title.
  - `department`: Organization unit.
  - `createdDateTime`: ISO 8601 UTC timestamp.
* **Supported Operations**:
  - `GET /v1.0/users`: Keyset paginated user listing.
  - `GET /v1.0/users/{id}` or `GET /v1.0/me`: Single user retrieval.
  - `POST /v1.0/users`: Provision user (requires `User.ReadWrite.All`).
  - `PATCH /v1.0/users/{id}`: Additive property mutation.
  - `DELETE /v1.0/users/{id}`: Soft delete with 30-day tombstone retention.
  - `GET /v1.0/users/{id}/photo/$value`: Binary stream of profile photo.

#### `/v1.0/groups`
* **Fields**: `id`, `displayName`, `description`, `groupTypes` (`["Unified"]` or `[]`), `securityEnabled`, `mailEnabled`.
* **Sub-resources**: `/v1.0/groups/{id}/members`, `/v1.0/groups/{id}/owners`, `/v1.0/groups/{id}/transitiveMembers`.

---

### 3.2 Productivity & Messaging Workload

#### `/v1.0/me/messages` & `/v1.0/users/{id}/messages`
* **Fields**:
  - `id`: Nominal branded `MessageId`.
  - `subject`: Message subject string.
  - `body`: `{ contentType: "html" | "text", content: string }`.
  - `from`: `{ emailAddress: { name: string, address: string } }`.
  - `toRecipients`, `ccRecipients`, `bccRecipients`: Array of recipient objects.
  - `isRead`: Boolean read receipt status.
  - `hasAttachments`: Boolean flag.
  - `attachments`: Array of attachment metadata (`id`, `name`, `contentType`, `size`, `isInline`).
  - `receivedDateTime`: UTC timestamp.
* **Special Actions**:
  - `POST /v1.0/me/sendMail`: Dispatches message without draft persistence.
  - `POST /v1.0/me/messages/{id}/reply`: In-thread reply.
  - `POST /v1.0/me/messages/{id}/forward`: Message forwarding.

#### `/v1.0/me/events` & `/v1.0/me/calendars`
* **Fields**:
  - `id`: Nominal branded `EventId`.
  - `subject`: Event title.
  - `start`, `end`: `{ dateTime: string, timeZone: string }`.
  - `location`: `{ displayName: string, address?: Record<string, string> }`.
  - `attendees`: Array of attendees with response status (`accepted`, `declined`, `tentativelyAccepted`).
  - `isAllDay`: Boolean flag.
  - `recurrence`: Patterned recurrence (daily, weekly, absoluteMonthly, relativeMonthly).

---

### 3.3 Storage & Content Workload: Drives & Resumable Uploads

#### `/v1.0/drives` & `/v1.0/drives/{driveId}/items/{itemId}`
* **Hierarchical Tree**: Folders and files are uniformly typed as `XlinkDriveItem`.
* **Fields**: `id`, `name`, `size`, `webUrl`, `file` (mimeType, hashes), `folder` (childCount), `parentReference`, `sharingLink`.
* **Resilient Large File Upload Engine**:
  - **Simple Upload (`< 4MB`)**: Atomic `PUT /v1.0/drives/{driveId}/items/{itemId}/content`.
  - **Chunked Resumable Upload Session (`> 4MB` up to 250GB)**:
    1. Initiation: `POST /v1.0/drives/{driveId}/items/{itemId}/createUploadSession`.
    2. Response: Returns `uploadUrl` and `expirationDateTime`.
    3. **The 320 KiB Alignment Rule**: Every chunk except the final one MUST be an exact multiple of 320 KiB ($327,680\text{ bytes}$).
    4. Chunk Headers: `Content-Range: bytes <start>-<end>/<totalBytes>`.
    5. In-flight status: `GET <uploadUrl>` returns `nextExpectedRanges`.
    6. Cancellation: `DELETE <uploadUrl>`.

---

### 3.4 Collaboration & Chat Workload: Teams & Channels

#### `/v1.0/teams` & `/v1.0/teams/{teamId}/channels`
* **Team**: Configured with template specifications (`standard`, `enterprise`).
* **Channels**: Dedicated communication streams (`General`, topic channels, private channels).
* **Messages**: `POST /v1.0/teams/{teamId}/channels/{channelId}/messages`.
* **Presence**: `GET /v1.0/communications/presences/{userId}` returns availability (`Available`, `Away`, `Busy`, `DoNotDisturb`).

---

## 4. Advanced High-Performance Protocols

### 4.1 Delta Query Engine (`/delta`)
Delta query enables applications to track incremental state changes (creations, mutations, soft deletions) without full database scans:
1. **Initial Full Sync Request**: `GET /v1.0/users/delta?$select=displayName,mail`.
2. **Paged Responses**: Response contains `@odata.nextLink` with opaque cursor.
3. **Completion Checkpoint**: Final page returns `@odata.deltaLink` token.
4. **Tombstone Semantics**: Deleted entities contain `@removed: { reason: "deleted" }`.

---

### 4.2 Change Notifications & Webhooks (Push Architecture)

#### A. Subscription Lifecycle (`POST /v1.0/subscriptions`)
```json
{
  "changeType": "created,updated",
  "notificationUrl": "https://client.domain.com/api/webhook",
  "resource": "users",
  "expirationDateTime": "2026-11-25T18:23:45.935Z",
  "clientState": "SecretTokenVerificationKey99"
}
```

#### B. Validation Handshake Protocol
Before activating a subscription, Xlink dispatches an HTTP validation handshake to `notificationUrl`:
```http
POST https://client.domain.com/api/webhook?validationToken=RandomToken12345 HTTP/1.1
Content-Type: text/plain
```
The client MUST reply within **10 seconds** with HTTP `200 OK` and the plain text `validationToken` in the response body.

#### C. Rich Encrypted Notifications
To avoid N+1 queries upon receipt of an alert, Xlink supports encrypted payload delivery using asymmetric keys:
1. Client generates RSA key pair and registers public certificate thumbprint.
2. Xlink generates symmetric AES-256-GCM session key (`dataKey`).
3. Payload is encrypted via AES-256-GCM; `dataKey` is encrypted via client's RSA public key.
4. Client decrypts `dataKey` via its private key and unpacks the resource payload immediately.

---

### 4.3 JSON Batching Engine (`POST /v1.0/$batch`)
Optimizes network round-trips by bundling up to 20 individual operations into a single HTTP payload.

* **Constraints**:
  - Maximum 20 sub-requests per batch.
  - Sub-request IDs must be unique strings.
  - Dependency Graph (`dependsOn`): Must form a Directed Acyclic Graph (DAG).
* **Topological Execution Order**:
  - Independent requests are dispatched concurrently.
  - Dependent requests execute strictly after their prerequisites succeed.
  - If a prerequisite fails, dependents are halted with HTTP `424 Failed Dependency`.
* **Outer Envelope**: Returns HTTP `200 OK`; each sub-response carries its discrete HTTP status.

---

### 4.4 Throttling, Rate Limiting & Resilience Mechanics

Xlink enforces adaptive rate limits to prevent cascading service degradation.

#### A. Wire Response on Rate Limit Violation
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json
Retry-After: 12

{
  "type": "https://xlink.xcorp.io/errors/too-many-requests",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "Application exceeded the request quota for the Identity workload.",
  "code": "ActivityLimitReached",
  "instance": "/v1.0/users",
  "trace_id": "c2a06c71-90cc-4846-952d-1fe5f0753748"
}
```

#### B. Client Retry Algorithm: Exponential Backoff with Full Jitter
Client SDKs must NEVER retry immediately. The backoff interval is calculated as:
$$\text{Delay} = \text{random}(0, \, \min(M, \, B \times 2^{\text{attempt}}))$$
If a `Retry-After` header is present, clients must pause for at least $\text{Retry-After}$ seconds before retrying.

#### C. High-Volume Bulk Data Connect Engine
For massive analytics workflows (e.g. syncing 500,000 users or millions of emails), regular REST endpoints are bypassed. Xlink implements a Bulk Data Connect pipeline:
- Direct snapshot extraction to Parquet/JSONL blob storage.
- Governed by tenant consent and bounded export schedules to prevent online database lock contention.

---

### 4.5 Keyset Query Parameters & Cursor Paging

| Parameter | Syntax & Behavior |
| :--- | :--- |
| **`$select`** | Field projection to reduce wire footprint (e.g., `?$select=id,displayName,mail`). |
| **`$filter`** | Boolean evaluation predicates: `eq`, `ne`, `gt`, `ge`, `lt`, `le`, `startswith`, `endswith`, `contains`, `in`. |
| **`$expand`** | Eager-loading related navigation properties (e.g., `?$expand=manager,directReports`). |
| **`$top`** | Page size constraint (Default: 25, Maximum: 999). |
| **`$skipToken`** | Opaque B-tree cursor token for continuous keyset navigation (Never use SQL OFFSET). |
| **`$orderby`** | Sorting criteria (e.g., `?$orderby=receivedDateTime desc`). |
| **`$search`** | Full-text search queries (e.g., `?$search="quarterly earnings"`). |
| **`$count`** | Returns total entity count alongside results (`$count=true`). |

---

## 5. RFC 7807 Enterprise Error Engineering

All failures across all Xlink endpoints strictly adhere to **RFC 7807 (`application/problem+json`)** with zero stack trace or internal database infrastructure leakage:

```json
{
  "type": "https://xlink.xcorp.io/errors/resource-not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "User with principal identifier 'alice@domain.xcorp.io' does not exist in tenant.",
  "code": "Request_ResourceNotFound",
  "instance": "/v1.0/users/alice@domain.xcorp.io",
  "trace_id": "7f8b9a2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c"
}
```

---

## 6. Official Client SDK Integration Matrix

Xlink client libraries are fully standard across 6 official language stacks in XCorp:

1. **TypeScript / JavaScript**: `@ralph7789/xlink` (via `xcorp-suite` monorepo).
2. **.NET (C#)**: `XCorp.Xlink.Sdk` (`netstandard2.0` / `.NET 8.0`).
3. **Go**: `github.com/ralph7789/xlink/gateway/sdk`.
4. **Python**: `xlink-sdk-python` (AsyncIO + Pydantic v2).
5. **Java**: `com.xcorp.xlink:xlink-sdk` (Java 17+ Reactive).
6. **PowerShell**: `Xlink.PowerShell` Module.
