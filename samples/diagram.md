---
title: Gmail assistant
week: 01
tags:
  - build-my-own
  - ai
status: draft
---

## How it works

```mermaid
flowchart LR
  A[Inbox] --> B(Fetch new mail)
  B --> C{Needs a reply?}
  C -->|yes| D[Draft with AI]
  C -->|no| E[Label and archive]
  D --> F[Review and send]
```

> [!NOTE]
> Front matter shows as a card, and Mermaid blocks draw as diagrams. Click either one to edit its source.

---

1. Fetch the mail
2. Classify each thread
   1. Urgent
   2. Can wait
3. Draft the replies
