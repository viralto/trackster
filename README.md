# Shipment tracker

Tracks UPS and FedEx shipments through Ship24 and puts the troubled ones at the top.

## What is in here

| File | What it is |
|---|---|
| `src/index.js` | The engine: talks to Ship24, stores history, decides each shipment's state |
| `src/page.js` | The board: the single page people look at |
| `schema.sql` | The database layout (already applied to the live database) |
| `wrangler.toml` | Cloudflare settings: database link, 30 minute schedule, limits |
| `test/mock-ship24.mjs` | A stand-in for Ship24, for testing without spending real slots |

## Putting it live

The tool locks itself until sign-in is switched on, so there is no moment where it sits open to the internet.

1. **GitHub.** Create a new **private** repository and upload these files.
2. **Cloudflare.** Workers & Pages > Create > Import a repository > pick the repo. Keep the name `trackster`. Deploy.
3. **Add the Ship24 key.** Open the Worker > Settings > Variables and Secrets > Add. Type: Secret. Name: `SHIP24_API_KEY`. Value: your key. Deploy.
4. **Switch on sign-in.** Settings > Domains & Routes > next to the `workers.dev` address, click **Enable Cloudflare Access**. Then **Manage Cloudflare Access** and list the email addresses allowed in.
5. Open the `workers.dev` address. You get a Cloudflare sign-in, then the board.

If step 5 shows "Locked" after signing in, tell Claude. It means Cloudflare is not passing the sign-in through to the Worker the way its documentation describes, and the fix is on the code side.

## Settings you can change

In `wrangler.toml`:

- `MAX_SHIPMENTS_PER_MONTH`: hard stop on new shipments each calendar month. Set to 10 for the Ship24 free plan.
- `STALL_DAYS`: working days without a scan before a shipment is flagged as Stalled. Set to 3.

## The states

| State | Meaning |
|---|---|
| Customs hold | Customs has flagged a delay, rejection, or missing documents or payment |
| Problem | Failed delivery attempt, refused, being returned, lost, or destroyed |
| Stalled | No scan for the set number of working days, or past its expected delivery date. This is the tool's own judgement |
| Out for delivery | On the van, or waiting to be collected |
| In transit | Moving normally |
| Label created | Registered with the carrier but not yet moving, or no tracking data yet |
| Delivered | Done. Stays on the board for 14 days |

## Not built yet

- Email or Teams alerts
- Reading shipment emails automatically
- Starred shipments currently pin to the top of their group. Once alerts exist, a star will also mean "send me every update"
