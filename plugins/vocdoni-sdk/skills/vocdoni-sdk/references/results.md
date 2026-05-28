# `references/results.md` — Reading elections and results

Companion to the [[vocdoni-sdk]] skill. Use this when fetching a published election, paginating an organisation's elections, reading vote tallies, or understanding the published-election shape.

## Fetch a single election

```ts
const election = await client.fetchElection(electionId);
// or if you've called client.setElectionId(electionId):
const election = await client.fetchElection();
```

Returns a `PublishedElection`. Important read-only fields:

| Field             | Type                            | Description                                                              |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------ |
| `id`              | `string`                         | The 64-hex election ID.                                                  |
| `organizationId`  | `string`                         | Address of the creator account.                                          |
| `status`          | `ElectionStatus`                 | `UPCOMING` / `ONGOING` / `ENDED` / `CANCELED` / `PAUSED` / `RESULTS`.    |
| `voteCount`       | `number`                         | Total votes cast.                                                        |
| `finalResults`    | `boolean`                        | `true` once the election ended and results are final.                    |
| `results`         | `string[][]`                     | `results[questionIdx][choiceIdx]` = vote tally as a string.              |
| `manuallyEnded`   | `boolean`                        | `true` if `endElection` was called.                                      |
| `chainId`         | `string`                         | Vochain ID.                                                              |
| `creationTime`    | `Date`                           | When the election was created.                                           |
| `metadataURL`     | `string`                         | IPFS URI of the metadata blob.                                           |
| `resultsType`     | `ElectionResultsType`            | Discriminator + properties (per variant). See below.                     |
| `title`, `description`, `header`, `streamUri`, `meta`, `census`, `electionType`, `voteType`, `questions`, `maxCensusSize`, `startDate`, `endDate` | (mirrors of the unpublished shape) |
| `raw`             | `object`                         | Raw API payload — escape hatch when the SDK doesn't surface a field.     |

## Reading tallies

`results[i][j]` is the vote count for choice `j` of question `i`, as a string (because counts are bigints):

```ts
const e = await client.fetchElection(electionId);
e.questions.forEach((q, qi) => {
  console.log(q.title.default);
  q.choices.forEach((c, ci) => {
    console.log(`  ${c.title.default}: ${e.results[qi][ci]}`);
  });
});
```

Some published-election shapes also populate `q.choices[ci].results` directly with the count for that choice — the recipes lean on this when convenient.

## `ElectionResultsType`

Discriminated union; `name` tells you how to render `results`:

```ts
type ElectionResultsType =
  | { name: 'single-choice-multiquestion'; properties: {} }
  | { name: 'multiple-choice'; properties: { canAbstain: boolean; abstainValues: string[]; repeatChoice: boolean; numChoices: { min: number; max: number } } }
  | { name: 'budget-based';   properties: { useCensusWeightAsBudget: boolean; maxBudget: number | null; forceFullBudget: boolean; minStep: number } }
  | { name: 'approval';       properties: { rejectValue: 0; acceptValue: 1 } }
  | { name: 'quadratic';      properties: { useCensusWeightAsBudget: boolean; maxBudget: number | null; forceFullBudget: boolean; minStep: number; quadraticCost: number } };
```

UIs typically branch on `resultsType.name`. For approval, the counts in `results[0]` per choice are total approvals. For quadratic/budget, the counts are total credits allocated, not raw vote count.

## Encrypted-until-end elections

If the election was created with `electionType.secretUntilTheEnd = true`:

- While `ONGOING`, `results` is empty / zeroed.
- Once `ENDED` / `RESULTS`, the chain decrypts and `results` populates.

Polling `fetchElection` repeatedly after end will eventually show the final tally.

## Encrypted-metadata elections

If `electionType.metadata.encrypted = true` was set with a password, the questions/descriptions come back encrypted. Decrypt by passing the password:

```ts
const e = await client.fetchElection(electionId, '<password>');
```

Without the password, sensitive fields appear as `<redacted>`.

## List elections for an account

```ts
const list = await client.fetchElections({
  organizationId: '0xCreatorAddress', // optional; defaults to client.wallet's address
  page: 0,                              // 0-indexed
  // status, withResults, finalResults, manuallyEnded — see API docs for filters
});
```

Returns `{ elections: PublishedElection[], pagination: { … } }` (pagination shape varies; check `list.pagination` at runtime).

## Election status state machine

```
                       createElection
                            │
                            ▼
                       READY (chain)
                       │       │
                  startDate    startDate
                  in future    in past
                       │       │
                       ▼       ▼
                  UPCOMING  ONGOING ◀─────┐
                              │           │
                       endElection      pauseElection
                       cancelElection      │
                              │           │
                              ▼           ▼
                       ENDED/CANCELED   PAUSED
                              │           │
                              │     continueElection
                              │           │
                              │           └─── (back to ONGOING)
                              ▼
                          RESULTS (when finalResults populated)
```

The `READY` intermediate state isn't normally seen — `PublishedElection.getStatus()` reads chain `READY` and resolves it to `UPCOMING` or `ONGOING` based on the start date.

## Waiting for transitions

Common pattern after a state change:

```ts
import { ElectionStatus } from '@vocdoni/sdk';

const waitFor = async (id: string, target: ElectionStatus) => {
  while (true) {
    const e = await client.fetchElection(id);
    if (e.status === target) return e;
    await new Promise((r) => setTimeout(r, 5000));
  }
};

await client.endElection(electionId);
await waitFor(electionId, ElectionStatus.RESULTS);
```

## Cross-references

- `elections.md` — election creation, status transitions, lifecycle methods.
- `voting.md` — submitting votes that contribute to these tallies.
- `anonymous.md` — special caveat: vote IDs are not deterministic, pass `voteId` to check methods.
