import { useState, useRef, useEffect, useCallback } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
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
    const cols = ["#25D366","#3b82f6","#f59e0b","#e03030","#a855f7","#ec4899"];
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
        <div className="skel-line shimmer" style={{ width: "100%", height: 34, borderRadius: 10 }} />
      </div>
    </div>
  );
}

export default function App() {
  const [dark, setDark]               = useState(false);
  const [products, setProducts]       = useState([]);
  const [coupons, setCoupons]         = useState([]);
  const [settings, setSettings]       = useState({
    storeName: "Order Store", whatsapp: "919899563148",
    deliveryFee: "49", freeDeliveryAbove: "999",
    logoUrl: "", tagline: "Fast delivery via WhatsApp",
    primaryColor: "#25D366", phone: "", email: "",
    address: "", hours: "", mapsUrl: "",
  });
  const [loaded, setLoaded]           = useState(false);
  const [tab, setTab]                 = useState(0);
  const [cart, setCart]               = useState([]);
  const [wishlist, setWishlist]       = useState([]);
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
    getDoc(doc(db, "settings", "store")).then(d => { if (d.exists()) setSettings(s => ({...s, ...d.data()})); });
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => { document.documentElement.setAttribute("data-theme", dark ? "dark" : "light"); }, [dark]);

  const freeAbove   = Number(settings.freeDeliveryAbove) || 999;
  const deliveryFee = Number(settings.deliveryFee) || 49;
  const waNumber    = settings.whatsapp || "919899563148";
  const pc          = settings.primaryColor || "#25D366";

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

  const toggleWish = p => {
    setWishlist(prev => {
      const has = prev.includes(p.id);
      toast(has ? "Removed from wishlist" : `${p.emoji} Wishlisted!`, "info");
      return has ? prev.filter(id => id !== p.id) : [...prev, p.id];
    });
  };

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
    setWaUrl(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`);
    setSent(true); setConfetti(true);
    setTimeout(() => setConfetti(false), 200);
  };

  const resetApp = () => {
    setCart([]); setWishlist([]); setAppliedPromo(null); setPromoInput("");
    setPromoMsg(null); setForm({ name: "", phone: "", address: "" }); setErrors({});
    setSent(false); setWaUrl(""); setTab(0);
  };

  const categories = ["All", ...new Set(products.map(p => p.category).filter(Boolean))];
  const filtered = products.filter(p =>
    (cat === "All" || p.category === cat) &&
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`app${dark ? " dark" : ""}`}>
      <Toast toasts={toasts} />
      <Confetti run={confetti} />

      <header className="header">
        <div className="header-topbar">
          {settings.phone && <div className="header-topbar-item"><span>📞</span><span>{settings.phone}</span></div>}
          {settings.email && <div className="header-topbar-item"><span>✉️</span><span>{settings.email}</span></div>}
          {settings.hours && <div className="header-topbar-item"><span>🕐</span><span>{settings.hours}</span></div>}
          {!settings.phone && !settings.email && <div className="header-topbar-item"><span>🚚</span><span>Free delivery above Rs.{settings.freeDeliveryAbove||999}</span></div>}
        </div>
        <div className="header-inner">
          <div className="logo-wrap">
            {settings.logoUrl
              ? <img src={settings.logoUrl} alt="logo" style={{height:44,objectFit:"contain",borderRadius:6}}/>
              : <div style={{width:44,height:44,borderRadius:6,background:pc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#1a1a1a",fontWeight:900}}>
                  {(settings.storeName||"O")[0]}
                </div>
            }
            <div>
              <h1 className="logo">{(settings.storeName||"Order Store").split(" ")[0]}<span style={{color:pc}}>{(settings.storeName||"").split(" ").slice(1).join(" ") ? " "+(settings.storeName||"").split(" ").slice(1).join(" ") : ""}</span></h1>
              <p className="tagline">{settings.tagline || "Industrial & Hardware Store"}</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => setDark(d => !d)}>{dark ? "☀️" : "🌙"}</button>
            <button className={`cart-btn${cartShake ? " shake" : ""}`} onClick={() => setTab(1)} style={{background:pc,color:"#1a1a1a"}}>
              🛒 Cart {itemCount > 0 && <span className="badge" style={{background:"#1a1a1a",color:pc}}>{itemCount}</span>}
            </button>
          </div>
        </div>
        <nav className="tab-bar">
          {["Shop", "Cart", "Checkout"].map((t, i) => (
            <button key={t} className={`tab${tab === i ? " active" : ""}`}
              style={tab===i ? {color:pc, borderBottomColor:pc} : {}}
              onClick={() => setTab(i)}>
              {t}{i === 1 && itemCount > 0 ? ` (${itemCount})` : ""}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {tab === 0 && (
          <div className="hero" style={{background:`linear-gradient(135deg, ${pc} 0%, ${pc}dd 100%)`, borderBottom:`1px solid ${pc}33`}}>
            <div className="hero-inner">
              {settings.logoUrl && <img src={settings.logoUrl} alt="logo" className="hero-logo"/>}
              <div>
                <h2 className="hero-title">{settings.storeName || "Order Store"}</h2>
                <p className="hero-sub">{settings.tagline || "Quality products, fast delivery"}</p>
                {settings.phone && <a href={`tel:${settings.phone}`} className="hero-contact">📞 {settings.phone}</a>}
                <div className="hero-badges">
                  <span className="hero-badge">🚚 Fast Delivery</span>
                  <span className="hero-badge">✅ Quality Products</span>
                  <span className="hero-badge">💬 WhatsApp Orders</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 0 && (
          <div className="trust-bar">
            <div className="trust-inner">
              <div className="trust-item"><span>🚚</span><span>Fast Delivery</span></div>
              <div className="trust-item"><span>💯</span><span>Quality Products</span></div>
              <div className="trust-item"><span>🔒</span><span>Secure Orders</span></div>
              <div className="trust-item"><span>📞</span><span>24/7 Support</span></div>
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
                  style={cat===c ? {background:pc, borderColor:pc} : {}}
                  onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
            {subtotal > 0 && subtotal < freeAbove && (
              <div className="delivery-banner">
                <div className="delivery-text">
                  <span>Add Rs.{(freeAbove - subtotal).toLocaleString()} more for free delivery</span>
                  <span className="free-label">FREE</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (subtotal / freeAbove) * 100)}%`, background: pc }} />
                </div>
              </div>
            )}
            {subtotal >= freeAbove && subtotal > 0 && <div className="free-banner">🎉 Free delivery unlocked!</div>}
            <div className="product-grid">
              {!loaded
                ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} />)
                : filtered.length === 0
                  ? <div className="empty-state"><div>🔍</div><p>No products found</p></div>
                  : filtered.map(p => {
                      const selSize = selectedSizes[p.id];
                      const cartId = selSize ? `${p.id}_${selSize}` : p.id;
                      const inCart = cart.find(i => i.cartId === cartId);
                      const wished = wishlist.includes(p.id);
                      const disc   = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : null;
                      return (
                        <div key={p.id} className="card product-card">
                          {disc && <span className="disc-badge">-{disc}%</span>}
                          <button className="wish-btn" onClick={() => toggleWish(p)}>{wished ? "❤️" : "🤍"}</button>
                          <div className="product-img">
                            {p.image
                              ? <img src={p.image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                              : <span style={{ fontSize: 50 }}>{p.emoji || "🛍️"}</span>}
                          </div>
                          <div className="product-body">
                            <p className="product-name">{p.name}</p>
                            <div className="price-row">
                              <span className="price" style={{color:pc}}>Rs.{getEffectivePrice(p)?.toLocaleString()}</span>
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
                              <button className="add-btn" style={{background:pc}} onClick={() => addToCart(p)}>+ Add to Cart</button>
                            )}
                          </div>
                        </div>
                      );
                    })
              }
            </div>
            {itemCount > 0 && (
              <div className="floater" style={{background:pc}}>
                <span>{itemCount} items · Rs.{animTotal.toLocaleString()}</span>
                <button className="wa-btn-sm" onClick={() => setTab(2)}>Order via WhatsApp →</button>
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
                        ? <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
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
                <button className="btn-dark full" onClick={() => setTab(2)}>Proceed to Checkout →</button>
              </>
            )}
          </div>
        )}

        {tab === 2 && (
          <div className="fade-in">
            {sent ? (
              <div className="success-screen">
                <div className="success-check" style={{background:pc}}>✓</div>
                <h2>Order Placed!</h2>
                <p>Tap below to open WhatsApp and confirm your order.</p>
                <a className="wa-link" href={waUrl} target="_blank" rel="noreferrer">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.975-1.302A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.945 7.945 0 01-4.27-1.24l-.306-.183-3.046.798.813-2.968-.2-.314A7.945 7.945 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/></svg>
                  Open WhatsApp &amp; Send Order
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
      </main>

      {(settings.phone||settings.email||settings.address||settings.hours||settings.mapsUrl) && (
        <footer className="footer" style={{borderTop:`3px solid ${pc}`}}>
          <div className="footer-inner">
            <div className="footer-brand">
              {settings.logoUrl
                ? <img src={settings.logoUrl} alt="logo" style={{height:40,objectFit:"contain",marginBottom:12,filter:"brightness(1.2)"}}/>
                : <div className="footer-brand-name">{(settings.storeName||"Order").split(" ")[0]}<span>{(settings.storeName||"").split(" ").slice(1).join(" ") ? " "+(settings.storeName||"").split(" ").slice(1).join(" ") : ""}</span></div>
              }
              <p style={{fontSize:12,color:"rgba(133, 0, 0, 0.4)",maxWidth:200,lineHeight:1.6}}>{settings.tagline}</p>
              
            </div>
            <div className="footer-contact">
              <p className="footer-heading">Contact Us</p>
              {settings.phone && <a href={`tel:${settings.phone}`} className="footer-link">📞 {settings.phone}</a>}
              {settings.email && <a href={`mailto:${settings.email}`} className="footer-link">✉️ {settings.email}</a>}
              {settings.whatsapp && (
                <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noreferrer"
                  className="footer-wa-btn" style={{background:pc}}>
                  💬 Chat on WhatsApp
                </a>
              )}
            </div>
            <div className="footer-info">
              <p className="footer-heading">Visit Us</p>
              {settings.address && <p className="footer-text">📍 {settings.address}</p>}
              {settings.hours && <p className="footer-text">🕐 {settings.hours}</p>}
              {settings.mapsUrl && (
                <a href={settings.mapsUrl} target="_blank" rel="noreferrer"
                  className="footer-map-btn" style={{borderColor:pc,color:pc}}>
                  🗺️ View on Google Maps
                </a>
              )}
            </div>
          </div>
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} {settings.storeName || "Order Store"}. All rights reserved.</p>
          </div>
        </footer>
      )}
    </div>
  );
}