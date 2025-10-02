# 🚀 Service Worker Quick Reference

## ✅ **COMPLETE OPLOSSING**

De service worker werkt nu correct met 3 verschillende modi!

## 📊 **De 3 Modi**

### **1. Development (Standaard) - GEEN Service Worker**
```bash
npm start
```
- ✅ Snelle development met hot reload
- ❌ Geen service worker
- ❌ Geen push notifications
- ✅ Gebruik voor normale development

**Environment:**
- `production: false`
- `enableServiceWorker: false`

---

### **2. Development met Service Worker - VOOR TESTEN** ⭐
```bash
npm run serve:dev-sw
```
- ✅ Service worker werkt
- ✅ Push notifications werken
- ✅ Source maps voor debugging
- ⚠️ Handmatige refresh nodig na changes

**Environment:**
- `production: false`
- `enableServiceWorker: true` (via environment.dev-sw.ts)

**Wat gebeurt er:**
1. `ng build --configuration dev-with-sw`
   - Gebruikt `environment.dev-sw.ts` (enableServiceWorker: true)
   - Genereert `ngsw-worker.js`
   - Geen optimalisatie, wel source maps
2. `node scripts/inject-push-handler-sw.js`
   - Injecteert push handler
3. `npx http-server dist -p 4200 -o`
   - Serveert op poort 4200
   - Opent browser automatisch

---

### **3. Production - VOOR DEPLOYMENT**
```bash
npm run build:prod
npx http-server dist -p 8080
```
- ✅ Volledig geoptimaliseerd
- ✅ Service worker werkt
- ✅ Push notifications werken
- ✅ Minified code
- ❌ Geen source maps

**Environment:**
- `production: true`
- `enableServiceWorker: true`

---

## 🔧 **Development Workflow**

### **Normale Development:**
```bash
npm start
# Werk aan features zonder SW overhead
```

### **Service Worker Testen:**
```bash
# Terminal 1: Rebuild bij changes
npm run build:dev-sw

# Open browser op http://localhost:4200

# Maak changes
# Rebuild opnieuw
npm run build:dev-sw

# Hard refresh browser (Ctrl+Shift+R)
```

### **Auto-rebuild (Geavanceerd):**
```bash
# Terminal 1: Watch mode
ng build --watch --configuration dev-with-sw

# Terminal 2: Serve
npx http-server dist -p 4200

# Bij elke change: auto rebuild → hard refresh browser
```

---

## ✅ **Verificatie Checklist**

Na `npm run serve:dev-sw`:

### **Browser Console (F12):**
```javascript
// Check registrations
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registrations:', regs.length); // Should be 1
  regs.forEach(reg => console.log(reg.active?.scriptURL));
});
```

**Verwacht:**
```
✅ Initializing Angular Service Worker update service...
🔧 Push handler: install event
✅ Push handler: activate event  
🔍 Found 1 service worker registration(s)
✅ Service worker OK: http://localhost:4200/ngsw-worker.js
```

### **DevTools → Application → Service Workers:**
- ✅ Status: **ACTIVATED**
- ✅ Script: `http://localhost:4200/ngsw-worker.js`
- ✅ Scope: `http://localhost:4200/`

### **DevTools → Application → Manifest:**
- ✅ Name: "Zaalvoetbal Doorn"
- ✅ Icons loaded

---

## 🔍 **Troubleshooting**

### **"Service Worker not enabled"**

**Oorzaak:** Verkeerde command gebruikt

**Oplossing:**
```bash
# NIET dit:
npm start

# WEL dit:
npm run serve:dev-sw
```

---

### **"404: ngsw-worker.js"**

**Oorzaak:** Gebruikt `ng serve` dat geen SW genereert

**Oplossing:**
```bash
npm run serve:dev-sw
```

---

### **"Found 0 service worker registrations"**

**Oorzaak:** 
- Verkeerde configuratie gebruikt
- Of `npm start` i.p.v. `npm run serve:dev-sw`

**Oplossing:**
```bash
# Stop huidige server
# Start opnieuw met:
npm run serve:dev-sw
```

---

### **Changes worden niet doorgevoerd**

**Oorzaak:** Service worker cached oude versie

**Oplossing:**
```bash
# Optie 1: Hard refresh
Ctrl + Shift + R

# Optie 2: Clear SW in DevTools
# Application → Service Workers → Unregister
# Application → Storage → Clear site data

# Optie 3: Via console
navigator.serviceWorker.getRegistrations()
  .then(regs => Promise.all(regs.map(r => r.unregister())))
  .then(() => location.reload());
```

---

## 📁 **File Structure**

```
src/
├── environments/
│   ├── environment.ts              # Dev (SW disabled)
│   ├── environment.dev-sw.ts       # Dev with SW (SW enabled) ⭐ NEW
│   └── environment.prod.ts         # Production (SW enabled)
├── app/
│   └── app.module.ts               # SW registration logic
└── push-handler-sw.js              # Custom push handler

angular.json
├── configurations
│   ├── development                 # No SW
│   ├── dev-with-sw                 # With SW ⭐ NEW
│   └── production                  # With SW

package.json
├── scripts
│   ├── start                       # npm start (no SW)
│   ├── build:dev-sw                # Build dev with SW ⭐ NEW
│   ├── serve:dev-sw                # Build + serve ⭐ NEW
│   └── build:prod                  # Build production
```

---

## 💡 **Best Practices**

### ✅ **DO:**
- Gebruik `npm start` voor normale development
- Gebruik `npm run serve:dev-sw` om SW te testen
- Test push notifications in `serve:dev-sw` mode
- Deploy met `npm run build:prod`

### ❌ **DON'T:**
- Gebruik `ng serve` NOOIT voor SW testing
- Verander `environment.ts` niet (laat enableServiceWorker: false)
- Vergeet niet hard refresh na SW changes

---

## 🎯 **Summary**

| Wat wil je doen? | Gebruik dit commando |
|------------------|---------------------|
| Normale development | `npm start` |
| Service Worker testen | `npm run serve:dev-sw` |
| Push notifications testen | `npm run serve:dev-sw` |
| Production build | `npm run build:prod` |
| Deploy naar productie | `npm run deploy` |

---

## 📚 **Files Overview**

### **Aangepast:**
- ✅ `angular.json` - Toegevoegd `dev-with-sw` configuratie
- ✅ `package.json` - Toegevoegd `build:dev-sw` en `serve:dev-sw` scripts
- ✅ `app.module.ts` - Vereenvoudigd SW enable logic

### **Nieuw:**
- ✅ `environment.dev-sw.ts` - Environment voor dev met SW
- ✅ `DEVELOPMENT_WITH_SERVICE_WORKER.md` - Uitgebreide docs
- ✅ Dit bestand - Quick reference

---

**🎉 Je bent nu klaar om service workers te testen in development mode!**

```bash
npm run serve:dev-sw
```
