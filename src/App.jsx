import { useState, useRef, useEffect, useCallback } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, updateDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import "./App.css";

function useAnimNum(target) {
  const [v, setV] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const diff = target - prev.current;
    if (!diff) return;
    const start = prev.current, t0 = performance.now();
    const go = now => {
      const p = Math.min((now - t0) / 400, 1);
      setV(Math.round(start + diff * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(go); else prev.current = target;
    };
    requestAnimationFrame(go);
  }, [target]);
  return v;
}

function Toast({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}${t.out ? " out" : ""}`}>{t.msg}</div>
      ))}
    </div>
  );
}

function Confetti({ run }) {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (!run) return;
    const cols = ["#3cb37a","#1a1a18","#f0f0eb","#2a9965","#a8a8a2"];
    setPieces(Array.from({ length: 60 }, (_, i) => ({
      id: i, x: Math.random() * 100, delay: Math.random() * .8,
      color: cols[i % cols.length], size: 6 + Math.random() * 8, rot: Math.random() * 360,
    })));
    const t = setTimeout(() => setPieces([]), 3200);
    return () => clearTimeout(t);
  }, [run]);
  if (!pieces.length) return null;
  return (
    <div className="confetti-wrap">
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: `${p.x}%`, width: p.size, height: p.size,
          background: p.color, borderRadius: p.size > 10 ? "50%" : 2,
          animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)`,
        }} />
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="card skel">
      <div className="skel-img shimmer" />
      <div className="skel-body">
        <div className="skel-line shimmer" style={{ width: "75%" }} />
        <div className="skel-line shimmer" style={{ width: "50%" }} />
        <div className="skel-line shimmer" style={{ width: "100%", height: 34 }} />
      </div>
    </div>
  );
}

export default function App() {
  const [products, setProducts]       = useState([]);
  const [coupons, setCoupons]         = useState([]);
  const [settings, setSettings]       = useState({
    storeName: "AV Traders", whatsapp: "919899563148", primaryColor: "#3ecf8e",
    deliveryFee: "49", freeDeliveryAbove: "999",
    logoUrl: "", tagline: "Fast delivery via WhatsApp",
    phone: "", email: "", address: "", hours: "", mapsUrl: "",
    shopImageUrl: "", ownerName: "", ownerImageUrl: "", ownerTitle: "", foundedYear: "", ownerStory: "", aboutEnabled: true, customersCount: "500", avgRating: "4.9", emailjsPublicKey: "", emailjsServiceId: "", emailjsTemplateId: "",
  });
  const [loaded, setLoaded]           = useState(false);
  const [tab, setTab]                 = useState(0);
  const [cart, setCart]               = useState([]);
  const [search, setSearch]           = useState("");
  const [cat, setCat]                 = useState("All");
  const [toasts, setToasts]           = useState([]);
  const [promoInput, setPromoInput]   = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoMsg, setPromoMsg]       = useState(null);
  const [form, setForm]               = useState({ name: "", phone: "", address: "" });
  const [errors, setErrors]           = useState({});
  const [sent, setSent]               = useState(false);
  const [waUrl, setWaUrl]             = useState("");
  const [confetti, setConfetti]       = useState(false);
  const [cartShake, setCartShake]     = useState(false);
  const [selectedSizes, setSelectedSizes] = useState({});
  const [heroEmail, setHeroEmail]         = useState("");
  const [heroSubmitting, setHeroSubmitting] = useState(false);
  const tid = useRef(0);

  const getEffectivePrice = (p) => {
    const sel = selectedSizes[p.id];
    if (p.sizeOptions?.length && sel) {
      const opt = p.sizeOptions.find(s => s.size === sel);
      return opt ? Number(opt.price) : p.price;
    }
    return p.price;
  };

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "products"), s => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoaded(true);
    });
    const u2 = onSnapshot(collection(db, "coupons"), s => {
      setCoupons(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.active));
    });
    const u3 = onSnapshot(doc(db, "settings", "store"), d => { if (d.exists()) setSettings(s => ({...s, ...d.data()})); });
    return () => { u1(); u2(); u3(); };
  }, []);

  // Set light theme permanently
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  useEffect(() => {
    const pc = settings.primaryColor || "#3ecf8e";
    const root = document.documentElement;
    root.style.setProperty("--accent", pc);
    root.style.setProperty("--accent2", pc + "cc");
    root.style.setProperty("--accent-dim", pc + "1a");
    root.style.setProperty("--accent-border", pc + "4d");
  }, [settings.primaryColor]);

  const freeDeliveryAboveRaw = settings.freeDeliveryAbove;
  const freeAbove = freeDeliveryAboveRaw === "" || freeDeliveryAboveRaw === undefined ? 999 : Number(freeDeliveryAboveRaw);
  const deliveryFee = Number(settings.deliveryFee) || 49;
  const waNumber    = settings.whatsapp || "919899563148";

  const subtotal  = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount  = appliedPromo
    ? (appliedPromo.type === "percent"
        ? Math.round(subtotal * appliedPromo.value / 100)
        : appliedPromo.value)
    : 0;
  const delivery  = subtotal >= freeAbove ? 0 : deliveryFee;
  const total     = Math.max(0, subtotal - discount + delivery);
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);
  const animTotal = useAnimNum(total);

  const toast = useCallback((msg, type = "default") => {
    const id = ++tid.current;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.map(t => t.id === id ? { ...t, out: true } : t)), 2200);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2550);
  }, []);

  const addToCart = p => {
    const size = selectedSizes[p.id] || null;
    if (p.sizeOptions?.length && !size) {
      toast("Please select a size first", "error"); return;
    }
    const effectivePrice = getEffectivePrice(p);
    const cartId = size ? `${p.id}_${size}` : p.id;
    setCart(prev => {
      const ex = prev.find(i => i.cartId === cartId);
      return ex
        ? prev.map(i => i.cartId === cartId ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { ...p, cartId, size, price: effectivePrice, qty: 1 }];
    });
    setCartShake(true); setTimeout(() => setCartShake(false), 500);
    toast(`${p.emoji} ${p.name}${size ? ` (${size})` : ""} added!`, "success");
  };

  const removeFromCart = id => {
    const p = cart.find(i => i.cartId === id || i.id === id);
    setCart(prev => prev.filter(i => i.cartId !== id && i.id !== id));
    if (p) toast(`${p.name} removed`, "default");
  };

  const changeQty = (id, d) => setCart(prev => {
    const item = prev.find(i => i.cartId === id || i.id === id);
    if (item && item.qty + d < 1) return prev.filter(i => i.cartId !== id && i.id !== id);
    return prev.map(i => (i.cartId === id || i.id === id) ? { ...i, qty: i.qty + d } : i);
  });


  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    const found = coupons.find(c => c.code === code);
    if (found) {
      if (found.minOrder && subtotal < found.minOrder) {
        setPromoMsg({ ok: false, text: `Min order Rs.${found.minOrder} required` }); return;
      }
      setAppliedPromo(found);
      setPromoMsg({ ok: true, text: `✓ ${code} applied!` });
      toast("Promo applied!", "success");
    } else {
      setAppliedPromo(null);
      setPromoMsg({ ok: false, text: "Invalid coupon code" });
    }
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())             e.name    = "Name is required";
    if (!/^\d{10}$/.test(form.phone))  e.phone   = "Enter valid 10-digit number";
    if (!form.address.trim())          e.address = "Address is required";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const placeOrder = async () => {
    if (!validate() || !cart.length) return;
    const orderData = {
      customerName: form.name, phone: form.phone, address: form.address,
      items: cart.map(i => ({ id: i.id, name: i.name, emoji: i.emoji, price: i.price, qty: i.qty, unit: i.unit || "", size: i.size || "" })),
      subtotal, discount, delivery, total,
      coupon: appliedPromo?.code || null,
      status: "pending",
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(db, "orders"), orderData);
    const sep = "─────────────────────";
    const itemLines = cart.map(i => `  • ${i.emoji} ${i.name}${i.size ? ` (${i.size})` : ""} x${i.qty}${i.unit ? " " + i.unit : ""}  =  Rs.${(i.price * i.qty).toLocaleString()}`).join("\n");
    const msg = [
      "🛒 *NEW ORDER*", sep, "*Items Ordered:*", itemLines,
      `💰 *Total: Rs.${total.toLocaleString()}*`,
      appliedPromo ? `🏷️ Promo (${appliedPromo.code}): -Rs.${discount.toLocaleString()}` : null,
      `🚚 Delivery: ${delivery === 0 ? "FREE" : `Rs.${delivery}`}`, sep,
      "👤 *Customer Details:*",
      `  Name: ${form.name}`, `  Phone: ${form.phone}`, `  Address: ${form.address}`,
      sep, "_Sent via WhatsApp Order App_",
    ].filter(Boolean).join("\n");
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
    setWaUrl(url);
    setSent(true); setConfetti(true);
    setTimeout(() => setConfetti(false), 200);
    // Auto-open WhatsApp immediately
    window.open(url, "_blank");
  };


  // Paste your Vercel mailer URL here after deploying

  const submitCatalogue = async () => {
    const email = heroEmail.trim();
    if (!email || !email.includes("@") || !email.includes(".")) {
      toast("Please enter a valid email", "error"); return;
    }
    setHeroSubmitting(true);

    // Step 1 — Save to Firestore (always, regardless of email config)
    let ref = null;
    try {
      ref = await addDoc(collection(db, "subscribers"), {
        email,
        createdAt: serverTimestamp(),
        sent: false,
      });
    } catch (err) {
      console.error("Firestore error:", err);
      toast("Could not save — check Firestore rules.", "error");
      setHeroSubmitting(false);
      return;
    }

    // Step 2 — Notify via Web3Forms (free, unlimited, no CORS, no backend)
    // Web3Forms sends YOU (the admin) a notification with the subscriber email
    // You can then manually send the catalogue, or set up auto-reply in Web3Forms dashboard
    const { web3formsKey, catalogueUrl, storeName } = settings;

    if (!web3formsKey || !catalogueUrl) {
      toast("Subscribed! ✓", "success");
      setHeroEmail("");
      setHeroSubmitting(false);
      return;
    }

    try {
      const resp = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: web3formsKey,
          subject: `New Catalogue Request — ${storeName || "Your Store"}`,
          from_name: storeName || "Your Store",
          // Send catalogue link directly to subscriber via Web3Forms autoresponder
          email: email,
          replyto: email,
          message: `New subscriber: ${email}

Catalogue link: ${catalogueUrl}`,
          catalogue_url: catalogueUrl,
          subscriber_email: email,
          store_name: storeName || "Our Store",
          // Autoresponder fields — Web3Forms sends this back to the subscriber
          "autorespond-subject": `Your ${storeName || "Store"} Catalogue 📦`,
          "autorespond-message": `Hi!

Thank you for your interest in ${storeName || "our store"}.

Here is your catalogue: ${catalogueUrl}

Feel free to reply if you have questions!

Best regards,
${storeName || "Our Store"}`,
        }),
      });

      const data = await resp.json();

      if (data.success) {
        await updateDoc(doc(db, "subscribers", ref.id), { sent: true, sentAt: serverTimestamp() });
        toast("Catalogue sent to your inbox! 📬", "success");
      } else {
        console.error("Web3Forms error:", data);
        toast("Subscribed! ✓", "success");
      }
    } catch (err) {
      console.error("Web3Forms error:", err.message);
      toast("Subscribed! ✓", "success");
    }

    setHeroEmail("");
    setHeroSubmitting(false);
  };

  const resetApp = () => {
    setCart([]); setAppliedPromo(null); setPromoInput("");
    setPromoMsg(null); setForm({ name: "", phone: "", address: "" }); setErrors({});
    setSent(false); setWaUrl(""); setTab(0);
  };

  const categories = ["All", ...new Set(products.map(p => p.category).filter(Boolean))];
  const bestsellers = products.filter(p => p.tag === "Bestseller");
  const filtered = products.filter(p =>
    (cat === "All" || p.category === cat) &&
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app">
      <Toast toasts={toasts} />
      <Confetti run={confetti} />

      <div className="ticker-bar">
        <div className="ticker-inner">
          {[
            freeAbove > 0 ? `Free delivery above Rs.${freeAbove.toLocaleString()}` : "Always free delivery",
            settings.storeName || "AV Traders",
            "WhatsApp ordering",
            "Same day dispatch",
            freeAbove > 0 ? `Free delivery above Rs.${freeAbove.toLocaleString()}` : "Always free delivery",
            settings.storeName || "AV Traders",
            "WhatsApp ordering",
            "Same day dispatch",
          ].map((t,i) => (
            <span key={i} className="ticker-item">{t}<span className="ticker-dot"/></span>
          ))}
        </div>
      </div>
      <header className="header">
        <div className="header-inner">
          <div className="logo-wrap">
            {settings.logoUrl && <img src={settings.logoUrl} alt="logo" className="header-logo-img" />}
            <h1 className="logo">{(settings.storeName || "AV Traders").split(" ")[0]}<span>{(settings.storeName||"AV Traders").split(" ").slice(1).join(" ") ? " "+(settings.storeName||"AV Traders").split(" ").slice(1).join(" ") : "*"}</span></h1>
          </div>
          <nav className="tab-bar">
            <button className={`tab${tab === 0 ? " active" : ""}`} onClick={() => setTab(0)}>Shop</button>
            {bestsellers.length > 0 && (
              <button className={`tab${tab === 1 ? " active" : ""}`} onClick={() => setTab(1)}>Bestsellers</button>
            )}
            {settings.aboutEnabled !== false && (
              <button className={`tab${tab === 4 ? " active" : ""}`} onClick={() => setTab(4)}>About</button>
            )}
          </nav>
          <div className="header-actions">
            <button className={`cart-btn${cartShake ? " shake" : ""}`} onClick={() => setTab(2)}>
              Cart <span className="badge">{itemCount}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {tab === 0 && (
          <div className="hero">
            <div className="hero-inner">
              <div className="hero-content">
                <div className="hero-badge-wrap">
                  <span className="hero-badge-dot"/>
                  <span className="hero-badge-text">New arrivals this week</span>
                </div>
                {settings.logoUrl && <img src={settings.logoUrl} alt="logo" className="hero-logo-img" />}
                <h2 className="hero-title">
                  {(settings.storeName || "AV Traders").split(" ").map((w, i) => (
                    <span key={i}>{w}</span>
                  ))}
                </h2>
                <p className="hero-sub-text">{settings.tagline || "Quality products, delivered fast. Browse our latest collection and order directly via WhatsApp."}</p>
                <p className="hero-form-label">Get the Catalogue</p>
                <div className="hero-form-row">
                  <input className="hero-form-input" placeholder="Enter your e-mail" type="email" value={heroEmail} onChange={e => setHeroEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submitCatalogue()} />
                  <button className="hero-form-btn" onClick={submitCatalogue} disabled={heroSubmitting}>{heroSubmitting ? "Sending…" : "Sign Up"}</button>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div className="hero-counter">{products.length || "∞"}</div>
                <div className="hero-counter-label">Products</div>
              </div>
            </div>
          </div>
        )}

        {tab === 0 && (
          <div className="trust-bar">
            <div className="trust-inner">
              {freeAbove > 0
                ? <div className="trust-item"><span>🚚</span><span>Free delivery above Rs.{freeAbove.toLocaleString()}</span></div>
                : <div className="trust-item"><span>🚚</span><span>Always free delivery</span></div>
              }
              <div className="trust-item"><span>💯</span><span>Quality Products</span></div>
              <div className="trust-item"><span>🔒</span><span>Secure Orders</span></div>
              {settings.phone
                ? <div className="trust-item"><span>📞</span><span>{settings.phone}</span></div>
                : <div className="trust-item"><span>💬</span><span>WhatsApp Orders</span></div>
              }
            </div>
          </div>
        )}

        {tab === 0 && (
          <div className="fade-in">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input className="search-input" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="cat-bar">
              {categories.map(c => (
                <button key={c} className={`cat-btn${cat === c ? " active" : ""}`}
                  onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
            {freeAbove > 0 && subtotal > 0 && subtotal < freeAbove && (
              <div className="delivery-banner">
                <div className="delivery-text">
                  <span>Add Rs.{(freeAbove - subtotal).toLocaleString()} more for free delivery</span>
                  <span className="free-label">FREE</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (subtotal / freeAbove) * 100)}%` }} />
                </div>
              </div>
            )}
            {freeAbove > 0 && subtotal >= freeAbove && subtotal > 0 && <div className="free-banner">🎉 Free delivery unlocked!</div>}
            <div className="product-grid">
              {!loaded
                ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} />)
                : filtered.length === 0
                  ? <div className="empty-state"><div>🔍</div><p>No products found</p></div>
                  : filtered.map(p => {
                      const selSize = selectedSizes[p.id];
                      const cartId = selSize ? `${p.id}_${selSize}` : p.id;
                      const inCart = cart.find(i => i.cartId === cartId);
                      const disc   = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : null;
                      return (
                        <div key={p.id} className="card product-card">
                          {disc && <span className="disc-badge">-{disc}%</span>}
                          <div className="product-img">
                            {p.image
                              ? <img src={p.image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                              : <span style={{ fontSize: 50 }}>{p.emoji || "🛍️"}</span>}
                          </div>
                          <div className="product-body">
                            <p className="product-name">{p.name}</p>
                            <div className="price-row">
                              <span className="price">Rs.{getEffectivePrice(p)?.toLocaleString()}</span>
                              {p.unit && <span className="unit-label">/ {p.unit}</span>}
                              {p.originalPrice && !selSize && <span className="orig-price">Rs.{p.originalPrice?.toLocaleString()}</span>}
                            </div>
                            {p.unitLabel && <p className="unit-sublabel">{p.unitLabel}</p>}
                            {p.sizeOptions?.length > 0 && (
                              <select className="size-select"
                                value={selSize || ""}
                                onChange={e => setSelectedSizes(prev => ({ ...prev, [p.id]: e.target.value }))}>
                                <option value="">-- Select Size --</option>
                                {p.sizeOptions.map(so => (
                                  <option key={so.size} value={so.size}>
                                    {so.size} — Rs.{Number(so.price).toLocaleString()}
                                  </option>
                                ))}
                              </select>
                            )}
                            {inCart ? (
                              <div className="inline-qty">
                                <button className="iq-btn" onClick={() => changeQty(inCart.cartId, -1)}>−</button>
                                <span className="iq-num">{inCart.qty}</span>
                                <button className="iq-btn" onClick={() => changeQty(inCart.cartId, 1)}>+</button>
                              </div>
                            ) : (
                              <button className="add-btn" onClick={() => addToCart(p)}>
                                <em className="add-btn-icon">✦</em> Add to Cart
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
              }
            </div>
            {itemCount > 0 && (
              <div className="floater">
                <span>{itemCount} items · Rs.{animTotal.toLocaleString()}</span>
                <button className="wa-btn-sm" onClick={() => setTab(2)}>View Cart →</button>
              </div>
            )}

            <div className="why-us">
              <p className="why-us-title">Why Choose Us</p>
              <div className="why-grid">
                {[
                  { icon: "🚚", label: "Fast Delivery", desc: "Same day delivery available" },
                  { icon: "✅", label: "Quality Assured", desc: "100% genuine products" },
                  { icon: "💬", label: "Easy Ordering", desc: "Order via WhatsApp instantly" },
                  { icon: "↩️", label: "Easy Returns", desc: "Hassle-free return policy" },
                ].map(w => (
                  <div key={w.label} className="why-card">
                    <div className="why-icon">{w.icon}</div>
                    <div className="why-label">{w.label}</div>
                    <div className="why-desc">{w.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 1 && (
          <div className="fade-in">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input className="search-input" placeholder="Search bestsellers…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="product-grid">
              {bestsellers.filter(p => p.name?.toLowerCase().includes(search.toLowerCase())).map(p => {
                const selSize = selectedSizes[p.id];
                const cartId = selSize ? `${p.id}_${selSize}` : p.id;
                const inCart = cart.find(i => i.cartId === cartId);
                const disc   = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : null;
                return (
                  <div key={p.id} className="card product-card">
                    {disc && <span className="disc-badge">-{disc}%</span>}
                    <div className="product-img">
                      {p.image
                        ? <img src={p.image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        : <span style={{ fontSize: 50 }}>{p.emoji || "🛍️"}</span>}
                    </div>
                    <div className="product-body">
                      <p className="product-name">{p.name}</p>
                      <div className="price-row">
                        <span className="price">Rs.{getEffectivePrice(p)?.toLocaleString()}</span>
                        {p.unit && <span className="unit-label">/ {p.unit}</span>}
                        {p.originalPrice && !selSize && <span className="orig-price">Rs.{p.originalPrice?.toLocaleString()}</span>}
                      </div>
                      {p.unitLabel && <p className="unit-sublabel">{p.unitLabel}</p>}
                      {p.sizeOptions?.length > 0 && (
                        <select className="size-select" value={selSize || ""} onChange={e => setSelectedSizes(prev => ({ ...prev, [p.id]: e.target.value }))}>
                          <option value="">-- Select Size --</option>
                          {p.sizeOptions.map(so => <option key={so.size} value={so.size}>{so.size} — Rs.{Number(so.price).toLocaleString()}</option>)}
                        </select>
                      )}
                      {inCart ? (
                        <div className="inline-qty">
                          <button className="iq-btn" onClick={() => changeQty(inCart.cartId, -1)}>−</button>
                          <span className="iq-num">{inCart.qty}</span>
                          <button className="iq-btn" onClick={() => changeQty(inCart.cartId, 1)}>+</button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={() => addToCart(p)}><em className="add-btn-icon">✦</em> Add to Cart</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {itemCount > 0 && (
              <div className="floater">
                <span>{itemCount} items · Rs.{animTotal.toLocaleString()}</span>
                <button className="wa-btn-sm" onClick={() => setTab(2)}>View Cart →</button>
              </div>
            )}
          </div>
        )}

        {tab === 2 && (
          <div className="fade-in">
            <h2 className="section-title">Your Cart</h2>
            {cart.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: 48 }}>🛒</div>
                <p>Cart is empty</p>
                <button className="btn-dark" onClick={() => setTab(0)}>Browse Products</button>
              </div>
            ) : (
              <>
                {cart.map(item => (
                  <div key={item.cartId || item.id} className="cart-item">
                    <div className="cart-emoji">
                      {item.image
                        ? <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : item.emoji}
                    </div>
                    <div className="cart-info">
                      <p className="cart-name">{item.name}{item.size ? <span className="cart-size"> — {item.size}</span> : ""}</p>
                      <p className="cart-price">Rs.{item.price?.toLocaleString()} {item.unit ? `/ ${item.unit}` : "each"}</p>
                    </div>
                    <div className="qty-ctrl">
                      <button className="qty-btn" onClick={() => changeQty(item.cartId || item.id, -1)}>−</button>
                      <span className="qty-num">{item.qty}</span>
                      <button className="qty-btn" onClick={() => changeQty(item.cartId || item.id, 1)}>+</button>
                    </div>
                    <div className="cart-total">
                      <p>Rs.{(item.price * item.qty).toLocaleString()}</p>
                      <button className="remove-btn" onClick={() => removeFromCart(item.cartId || item.id)}>Remove</button>
                    </div>
                  </div>
                ))}
                <div className="promo-row">
                  <input className="promo-input" placeholder="Enter coupon code…" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} />
                  <button className="btn-dark sm" onClick={applyPromo}>Apply</button>
                </div>
                {promoMsg && <p className={`promo-msg${promoMsg.ok ? " ok" : ""}`}>{promoMsg.text}</p>}
                <div className="surface summary">
                  <div className="sum-row"><span>Subtotal ({itemCount} items)</span><span>Rs.{subtotal.toLocaleString()}</span></div>
                  {appliedPromo && <div className="sum-row green"><span>Discount ({appliedPromo.code})</span><span>-Rs.{discount.toLocaleString()}</span></div>}
                  <div className="sum-row green"><span>Delivery</span><span>{delivery === 0 ? "FREE 🎉" : `Rs.${delivery}`}</span></div>
                  <div className="sum-row total"><span>Total</span><span>Rs.{animTotal.toLocaleString()}</span></div>
                </div>
                <button className="btn-dark full" onClick={() => setTab(3)}>Proceed to Checkout →</button>
              </>
            )}
          </div>
        )}

        {tab === 3 && (
          <div className="fade-in">
            {sent ? (
              <div className="success-screen">
                <div className="success-check">✓</div>
                <h2>Order Placed!</h2>
                <p>WhatsApp has opened automatically with your order details. Just press <strong>Send</strong> to confirm.</p>
                <p style={{fontSize:12,color:"var(--tx3)"}}>WhatsApp didn't open?</p>
                <a className="wa-link" href={waUrl} target="_blank" rel="noreferrer">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.975-1.302A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.945 7.945 0 01-4.27-1.24l-.306-.183-3.046.798.813-2.968-.2-.314A7.945 7.945 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/></svg>
                  Open WhatsApp Manually
                </a>
                <button className="btn-dark" onClick={resetApp}>Shop Again</button>
              </div>
            ) : (
              <>
                <h2 className="section-title">Customer Details</h2>
                {[
                  { label: "Full Name", key: "name", type: "text", ph: "e.g. Rahul Sharma" },
                  { label: "Phone Number", key: "phone", type: "tel", ph: "10-digit mobile" },
                ].map(({ label, key, type, ph }) => (
                  <div key={key} className="field">
                    <label>{label}</label>
                    <input type={type} placeholder={ph} value={form[key]}
                      className={errors[key] ? "err" : ""}
                      onChange={e => { setForm({ ...form, [key]: e.target.value }); setErrors({ ...errors, [key]: "" }); }} />
                    {errors[key] && <span className="field-err">{errors[key]}</span>}
                  </div>
                ))}
                <div className="field">
                  <label>Delivery Address</label>
                  <textarea rows={3} placeholder="House no., Street, City, PIN…"
                    className={errors.address ? "err" : ""}
                    value={form.address}
                    onChange={e => { setForm({ ...form, address: e.target.value }); setErrors({ ...errors, address: "" }); }} />
                  {errors.address && <span className="field-err">{errors.address}</span>}
                </div>
                {cart.length > 0 && (
                  <div className="surface summary" style={{ marginBottom: 20 }}>
                    <p className="sum-heading">Order Summary</p>
                    {cart.map(i => (
                      <div key={i.cartId || i.id} className="sum-row sm">
                        <span>{i.emoji} {i.name}{i.size ? ` (${i.size})` : ""} ×{i.qty}{i.unit ? ` ${i.unit}` : ""}</span>
                        <span>Rs.{(i.price * i.qty).toLocaleString()}</span>
                      </div>
                    ))}
                    {appliedPromo && <div className="sum-row green sm"><span>Discount</span><span>-Rs.{discount.toLocaleString()}</span></div>}
                    <div className="sum-row green sm"><span>Delivery</span><span>{delivery === 0 ? "FREE" : `Rs.${delivery}`}</span></div>
                    <div className="sum-row total"><span>Total</span><span>Rs.{total.toLocaleString()}</span></div>
                  </div>
                )}
                {cart.length === 0 && (
                  <div className="warn-box">Cart is empty. <button className="link-btn" onClick={() => setTab(0)}>Add items</button></div>
                )}
                <button className={`wa-place-btn${!cart.length ? " disabled" : ""}`} onClick={placeOrder} disabled={!cart.length}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.975-1.302A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.945 7.945 0 01-4.27-1.24l-.306-.183-3.046.798.813-2.968-.2-.314A7.945 7.945 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/></svg>
                  Place Order on WhatsApp
                </button>
                <p className="wa-hint">You'll be redirected to WhatsApp to confirm</p>
              </>
            )}
          </div>
        )}

        {/* ── ABOUT ── */}
        {tab === 4 && settings.aboutEnabled !== false && (
          <div className="about-page fade-in">

            {/* Hero banner — shop image */}
            {settings.shopImageUrl && (
              <div className="about-shop-hero">
                <img src={settings.shopImageUrl} alt="Our Shop" className="about-shop-img" />
                <div className="about-shop-overlay">
                  <div className="about-shop-overlay-content">
                    <span className="about-est">Est. {settings.foundedYear || "2018"}</span>
                    <h2 className="about-shop-name">{settings.storeName || "AV Traders"}</h2>
                    <p className="about-shop-sub">{settings.tagline || ""}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Stats row */}
            <div className="about-stats">
              {settings.foundedYear && (
                <div className="about-stat">
                  <span className="about-stat-num">{new Date().getFullYear() - Number(settings.foundedYear)}+</span>
                  <span className="about-stat-label">Years in Business</span>
                </div>
              )}
              <div className="about-stat">
                <span className="about-stat-num">{products.length}+</span>
                <span className="about-stat-label">Products</span>
              </div>
              {settings.customersCount && (
                <div className="about-stat">
                  <span className="about-stat-num">{settings.customersCount}+</span>
                  <span className="about-stat-label">Happy Customers</span>
                </div>
              )}
              {settings.avgRating && (
                <div className="about-stat">
                  <span className="about-stat-num">⭐ {settings.avgRating}</span>
                  <span className="about-stat-label">Avg Rating</span>
                </div>
              )}
            </div>

            {/* Owner section */}
            <div className="about-owner-section">
              <div className="about-owner-left">
                {settings.ownerImageUrl
                  ? <div className="about-owner-img-wrap">
                      <img src={settings.ownerImageUrl} alt={settings.ownerName} className="about-owner-img" />
                    </div>
                  : <div className="about-owner-avatar">{(settings.ownerName || settings.storeName || "A")[0]}</div>
                }
                <div className="about-owner-badge">
                  <span className="about-owner-name">{settings.ownerName || "The Owner"}</span>
                  <span className="about-owner-title">{settings.ownerTitle || "Founder & Owner"}</span>
                </div>
              </div>
              <div className="about-owner-right">
                <div className="about-section-label">
                  <span className="about-section-accent"/>
                  <span className="about-section-tag">Our Story</span>
                </div>
                <h3 className="about-story-heading">
                  Built with passion,<br/>driven by quality.
                </h3>
                <p className="about-story-text">
                  {settings.ownerStory || `Welcome to ${settings.storeName || "our store"}! We are committed to bringing you the best quality products at competitive prices. Our journey started with a simple mission — make quality accessible to everyone.`}
                </p>
                {settings.whatsapp && (
                  <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noreferrer" className="about-wa-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.975-1.302A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.945 7.945 0 01-4.27-1.24l-.306-.183-3.046.798.813-2.968-.2-.314A7.945 7.945 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/></svg>
                    Chat with us on WhatsApp
                  </a>
                )}
              </div>
            </div>

            {/* Contact & Info grid */}
            <div className="about-info-grid">

              {settings.phone && (
                <a href={`tel:${settings.phone}`} className="about-info-card">
                  <div className="about-info-icon">📞</div>
                  <div className="about-info-label">Call Us</div>
                  <div className="about-info-value">{settings.phone}</div>
                </a>
              )}

              {settings.hours && (
                <div className="about-info-card">
                  <div className="about-info-icon">🕐</div>
                  <div className="about-info-label">Shop Hours</div>
                  <div className="about-info-value">{settings.hours}</div>
                </div>
              )}

              {settings.email && (
                <a href={`mailto:${settings.email}`} className="about-info-card">
                  <div className="about-info-icon">✉️</div>
                  <div className="about-info-label">Email Us</div>
                  <div className="about-info-value">{settings.email}</div>
                </a>
              )}

              {settings.address && (
                <a href={settings.mapsUrl || "#"} target={settings.mapsUrl ? "_blank" : "_self"} rel="noreferrer" className="about-info-card">
                  <div className="about-info-icon">📍</div>
                  <div className="about-info-label">Visit Us</div>
                  <div className="about-info-value">{settings.address}</div>
                </a>
              )}

            </div>

            {/* Map embed */}
            {settings.mapsUrl && (
              <div className="about-map-wrap">
                <div className="about-section-label" style={{marginBottom:16}}>
                  <span className="about-section-accent"/>
                  <span className="about-section-tag">Find Us</span>
                </div>
                <a href={settings.mapsUrl} target="_blank" rel="noreferrer" className="about-map-btn">
                  🗺️ Open in Google Maps
                </a>
              </div>
            )}

            {/* Values */}
            <div className="about-values">
              <div className="about-section-label" style={{marginBottom:24}}>
                <span className="about-section-accent"/>
                <span className="about-section-tag">Why Choose Us</span>
              </div>
              <div className="about-values-grid">
                {[
                  { icon: "🏆", title: "Quality First", desc: "Every product is handpicked and quality-checked before reaching you." },
                  { icon: "🚚", title: "Fast Delivery", desc: freeAbove > 0 ? `Free delivery on orders above Rs.${freeAbove.toLocaleString()}. Same day dispatch available.` : "Always free delivery. Same day dispatch available." },
                  { icon: "💬", title: "WhatsApp Ordering", desc: "Order instantly via WhatsApp — no apps, no hassle, just a quick message." },
                  { icon: "🤝", title: "Trusted Service", desc: "Hundreds of happy customers and counting. Your satisfaction is our priority." },
                ].map(v => (
                  <div key={v.title} className="about-value-card">
                    <div className="about-value-icon">{v.icon}</div>
                    <h4 className="about-value-title">{v.title}</h4>
                    <p className="about-value-desc">{v.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </main>

      {(settings.phone||settings.email||settings.address||settings.hours||settings.mapsUrl) && (
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <div className="footer-brand-name">{settings.storeName || "AV Traders"}</div>
              <p className="footer-text" style={{maxWidth:200}}>{settings.tagline}</p>

            </div>
            <div className="footer-contact">
              <p className="footer-heading">Contact Us</p>
              {settings.phone && <a href={`tel:${settings.phone}`} className="footer-link">📞 {settings.phone}</a>}
              {settings.email && <a href={`mailto:${settings.email}`} className="footer-link">✉️ {settings.email}</a>}
              {settings.whatsapp && (
                <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noreferrer" className="footer-wa-btn">
                  💬 Chat on WhatsApp
                </a>
              )}
            </div>
            <div className="footer-info">
              <p className="footer-heading">Visit Us</p>
              {settings.address && <p className="footer-text">📍 {settings.address}</p>}
              {settings.hours && <p className="footer-text">🕐 {settings.hours}</p>}
              {settings.mapsUrl && (
                <a href={settings.mapsUrl} target="_blank" rel="noreferrer" className="footer-map-btn">
                  🗺️ View on Google Maps
                </a>
              )}
            </div>
          </div>
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} {settings.storeName || "AV Traders"}. All rights reserved.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
