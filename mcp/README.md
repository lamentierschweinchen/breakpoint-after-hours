# Breakpoint After Hours MCP

`calculate_receipt` runs the same score and rating code as breakpoint.beer. It takes the participant’s selected audit totals and returns the score, rating, finding, and score-only challenge URL. Calculation runs inside the local MCP process over standard input and output.

## Setup

Keep the `mcp` and `dist` folders next to each other. From the extracted folder or repository root, install the locked dependencies.

```sh
npm ci --prefix mcp --ignore-scripts
```

For clients that use an `mcpServers` configuration, add this entry and replace the example path with the absolute path to `mcp/server.mjs`. Use the absolute path to Node as `command` if your client requires it.

```json
{
  "mcpServers": {
    "breakpoint": {
      "command": "node",
      "args": ["/absolute/path/to/breakpoint-after-hours/mcp/server.mjs"]
    }
  }
}
```

## Call the tool

All arguments are optional numeric fields. Include at least one stat. Omit unknowns, and use `0` for a confirmed zero. The tool description gives the units for each field. `sleep` is average hours asleep per night, `favors` is in grams, and `value` is in US dollars.

```json
{
  "pints": 5,
  "cigs": 6,
  "favors": 1,
  "sleep": 4,
  "leads": 10,
  "deals": 3,
  "value": 24000,
  "sideEvents": 3
}
```

```json
{
  "score": 69,
  "rating": "Perfect score",
  "finding": "Approved in full.",
  "challengeUrl": "https://breakpoint.beer/?beat=69"
}
```

If the agent already has WHOOP access, choose the nights to count with the participant. Sum the reported light, deep, and REM sleep durations for each scored overnight record, then average the available nights and convert to hours. Pass the resulting number as `sleep`. Keep the WHOOP connection and raw records in the agent, and report any missing nights there. [WHOOP Sleep data model](https://developer.whoop.com/docs/developing/user-data/sleep/)

## Test

```sh
npm test --prefix mcp
```
