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

## Alerts

The tool emails people when a shipment needs attention. Who, what and when are all chosen on the **Alert settings** page, linked from the top of the board. Nothing there needs a code change.

One-off setup in Cloudflare, before any email can be sent:

1. **Email Service > Email Routing:** switch it on for `dot-track.app`.
2. **Email Routing > Destination Addresses:** add each person who should receive alerts. Cloudflare emails them a link, which they click once.
3. On the tool's Alert settings page, list the same addresses and press **Save and send a test email**.

Alerts are sent from `alerts@dot-track.app`. Sending to verified addresses is free. Sending to anyone else needs the Workers Paid plan.

## Settings in the code

In `wrangler.toml`:

- `MAX_SHIPMENTS_PER_MONTH`: hard stop on new shipments each calendar month. Set to 10 for the Ship24 free plan.
- `ALERT_FROM` and `BOARD_URL`: the sender address for alerts and the link they point back to.
- `STALL_DAYS` and `CUSTOMS_HOURS`: starting values only. Once the Alert settings page has been saved, the page decides.

## The states

| State | Meaning |
|---|---|
| Customs hold | Customs wants documents or payment, has rejected it, or has had it for 24 hours without releasing it |
| Problem | Failed delivery attempt, refused, being returned, lost, or destroyed |
| Stalled | No scan for the set number of working days, or past its expected delivery date. This is the tool's own judgement |
| Out for delivery | On the van, or waiting to be collected |
| In transit | Moving normally |
| Not found | Two hours after being added, no carrier recognises the number. Usually a typo |
| Label created | Registered with the carrier but not yet moving |
| Looking it up | Just added. Ship24 is still asking the carrier, which takes a few minutes |
| Delivered | Done. Stays on the board for 14 days |

## Not built yet

- Reading shipment emails automatically
- Personal settings. Everyone shares one set of alert rules, and a star is shared too
