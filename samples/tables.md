## Comparing the options

| Existing option | What I wanted to evaluate | Cost |
| --- | --- | ---: |
| Gmail's built-in features | Whether it already covers my use case | Free |
| Third-party email tools | Feature fit, pricing and subscription | $12/mo |
| Automation platforms | Setup effort, flexibility and ongoing costs | $20/mo |
| Building my own | Effort, security and maintenance | Time |

### The core function

```typescript
interface Email {
  id: string
  subject: string
  priority: 'high' | 'normal'
}

export function triage(inbox: Email[]): Email[] {
  return inbox.filter((mail) => mail.priority === 'high')
}
```

> [!WARNING]
> Images from web URLs do not load, because the plugin frame has no network.
