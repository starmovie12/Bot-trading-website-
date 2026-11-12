# Bot Terminal (website)

Yeh repo **sirf website** hai (Vercel par). Bot ka code alag repo
[`Bot-trading-`](https://github.com/starmovie12/Bot-trading-) ki `main` branch mein hai,
aur idea/docs usi repo ki branch `idea` mein.

| Repo / branch | Kya hai |
|---|---|
| `Bot-trading-website-` (yeh repo), branch `main` | Yeh website (Vercel isi se banata hai) |
| `Bot-trading-`, branch `main` | Bot ka code (Python, Pehredaar, tests, SETUP_GUIDE) |
| `Bot-trading-`, branch `idea` | Idea v4, audit, tech faisle, strategy, roadmap, research |

## Vercel par naya project (ek baar)
1. Vercel dashboard par upar **Create New → Project**.
2. List mein **`Bot-trading-website-`** chuno → **Import**.
3. **Framework Preset:** Other. **Root Directory:** khaali / `./` (koi folder mat chuno). Build settings mat chhedo.
4. **Deploy** dabao. Production branch apne-aap `main` hogi.
5. **Settings → Deployment Protection → Vercel Authentication** production par bhi chalu karo; Vercel account par 2FA.
6. Purana Vercel project (jo `Bot-trading-` repo se juda tha) ab kaam ka nahi: us project mein **Settings → General** ke sabse neeche **Delete Project → Delete** se hata sakte ho (Vercel docs, dekha 11 Nov 2026).

Website ko build ki zaroorat nahi: `vercel.json` mein framework "Other", install skip, output `public/`.

## Terminal mein kya hai (admin panel)
| Page | Kya hai / kya kaam karta hai |
|---|---|
| **Overview** | Nifty 50, Bank Nifty, Sensex, India VIX cards; aaj ka P&L (hero number + din bhar ka chart, table view); positions; har index ka signal + checks; risk control; bot ki khabar |
| **Chart** | 5/15 min candlestick, EMA 9/21 on-off, entry/exit nishaan, tooltip (mouse, ungli, ← →), table view, "Bada karo" |
| **Option Chain** | ±5/±7 strike, OI bar, OI badlaav, IV, LTP, ITM, spot line, PCR, Max Pain, Resistance/Support; row tap = strike detail |
| **Trades** | Positions / Orders / Trade book; CSV download |
| **Sehat** | Bot, Pehredaar, feed, broker API, token countdown, server, static IP |
| **Controls** | Bot **ON/OFF**, **Paper / Real Money** (Real par "REAL" likhna padta hai), Emergency Pause, Square-off, Kill-Switch ("KILL"), Kill hatao ("RESET"), practice log |
| **Activity log** | Khojo, darja filter, CSV download |
| **Settings** | Risk niyam ka draft (aapke baaki faisle) - validation, save, JSON download/copy; theme, default index, refresh |
| **Setup checklist** | 9 step tick karo (ek hi server wala plan) |

- Upar: market haalat, mode, IST ghadi, **Live/Ruka** (auto-refresh), ⟳ abhi taaza, 🔔 notifications, theme.
- **Controls abhi PRACTICE hain:** bot juda nahi, isliye koi hukm broker tak nahi jaata. Asli hukm M7 mein signed + 2FA ke saath; Real Money bot khud Gates jaanch kar hi chalu karega.
- **Saara data NAKLI hai** (peela banner). Market samay `lib/market.mjs` mein: 9:15-15:30 IST maana; F&O 15:40 **verify nahi hua**.
- Koi npm dependency nahi, koi inline script nahi, sakht CSP, saara text `textContent` se.

## Folder
| Folder | Kya |
|---|---|
| `public/` | Page (`index.html`, `style.css`, `icon.svg`, `manifest.webmanifest`) |
| `public/js/` | `main.js` (routing, header, refresh), `dom.js` (surakshit helpers), `charts.js`, `state.js`, `views/*` (har page) |
| `api/` | `/api/state`, `/api/health` (Vercel functions) |
| `lib/state.mjs` | Haalat ki jaanch + signed push (bot ka `dashboard_push.py` yahi signature banata hai) |
| `lib/demo.mjs`, `lib/market.mjs` | Nakli haalat aur market ka samay (IST) |
| `test/` | Tests: `node --test` |

## Design
Design ke niyam [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT) ke data se padh kar liye: finance dashboard ke liye dark + data-dense, hara/laal ke saath +/− aur arrow (sirf rang par nahi), 44px touch, reduced-motion, candlestick chart. Us skill ka koi code is repo mein nahi.

## Free plan (dekha 10 Nov 2026, https://vercel.com/docs/plans/hobby)
Sirf personal, non-commercial use. Mahine mein 1,000,000 function calls; isliye page har 5 second refresh hota hai.

## Suraksha
Koi npm dependency nahi, koi inline script nahi, sakht CSP aur headers, saara text `textContent` se.
Bot ki haalat sirf signed (HMAC) POST se aayegi; 5 second se purana signature reject. Website ke paas broker ya Telegram ki chaabi kabhi nahi.

## Tests
```bash
node --test
```
