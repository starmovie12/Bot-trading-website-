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

## Terminal mein kya hai
| Hissa | Kya dikhta hai |
|---|---|
| **Home** | Nifty 50, Bank Nifty, Sensex, India VIX (daam, badlaav, sparkline, din ka range); aaj ka P&L; capital; khule positions; har index ka bot signal aur uske checks; risk (nuksan seema, entry, Profit Lock, Kill Latch, Broker Stop); bot ka log |
| **Chart** | 5/15 minute candlestick, EMA 9/21, pichhla close, bot ke entry/exit nishaan, ungli/mouse se OHLC |
| **Option Chain** | ATM ke aas-paas 15 strike: OI (bar), OI badlaav, IV, LTP; ITM rang; spot line; PCR, Max Pain |
| **Trades** | Positions (SL-Target ke beech LTP), Orders (status), Trade book |
| **Bot** | Bot, Pehredaar, feed, broker API, token expiry, server, static IP ki sehat; Gates; Controls (M7 tak band); setup ki haalat |

- Phone par neeche menu, bade screen par bayen menu. Dark/Light theme (button upar). Phone par "Add to Home screen" se app jaisa khulta hai.
- Har 5 second refresh; tab chhupa ho toh refresh ruk jaata hai (Vercel ke free function calls bachte hain).
- **Abhi saara data NAKLI hai** (upar peela banner). `lib/demo.mjs` ek seed se namoona banata hai. Asli bot judne par yahi dhaancha bot bhejega.
- Market ka samay `lib/market.mjs` mein ek jagah: 9:15-15:30 IST maana hai. F&O ke 15:40 tak chalne ki khabar hai, **verify nahi hua**; chhutti ki list abhi nahi jaanchi.

## Folder
| Folder | Kya |
|---|---|
| `public/` | Page (`index.html`, `app.js`, `style.css`, `icon.svg`, `manifest.webmanifest`) |
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
