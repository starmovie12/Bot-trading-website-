# Bot Dashboard (website)

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

## Folder
| Folder | Kya |
|---|---|
| `public/` | Page (`index.html`, `app.js`, `style.css`) |
| `api/` | `/api/state`, `/api/health` (Vercel functions) |
| `lib/state.mjs` | Haalat ka dhaancha + signed push ki jaanch (bot ka `dashboard_push.py` yahi signature banata hai) |
| `test/` | Tests: `node --test` |

## Free plan (dekha 10 Nov 2026, https://vercel.com/docs/plans/hobby)
Sirf personal, non-commercial use. Mahine mein 1,000,000 function calls; isliye page har 5 second refresh hota hai.

## Suraksha
Koi npm dependency nahi, koi inline script nahi, sakht CSP aur headers, saara text `textContent` se.
Bot ki haalat sirf signed (HMAC) POST se aayegi; 5 second se purana signature reject. Website ke paas broker ya Telegram ki chaabi kabhi nahi.

## Tests
```bash
node --test
```
