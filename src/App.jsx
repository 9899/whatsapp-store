import { useState, useRef, useEffect, useCallback } from "react";
import { Analytics } from "@vercel/analytics/react";
import "./App.css";

const WA_NUMBER = "919899563148";

const PRODUCTS = [
  { id:1, name:"Classic T-Shirt",    price:499,  orig:699,  emoji:"👕", tag:"Sale",        cat:"Clothing",    stock:12, rating:4.3, reviews:128 },
  { id:2, name:"Premium Sneakers",   price:1999, orig:null, emoji:"👟", tag:"New Arrival",  cat:"Footwear",    stock:3,  rating:4.7, reviews:64  },
  { id:3, name:"Smart Watch",        price:2999, orig:3499, emoji:"⌚", tag:"Sale",        cat:"Electronics", stock:7,  rating:4.5, reviews:210 },
  { id:4, name:"Sunglasses",         price:899,  orig:null, emoji:"🕶️", tag:"Trending",    cat:"Accessories", stock:2,  rating:4.1, reviews:45  },
  { id:5, name:"Leather Wallet",     price:699,  orig:null, emoji:"👝", tag:"Popular",     cat:"Accessories", stock:15, rating:4.6, reviews:89  },
  { id:6, name:"Canvas Backpack",    price:1499, orig:1999, emoji:"🎒", tag:"Sale",        cat:"Bags",        stock:1,  rating:4.4, reviews:156 },
  { id:7, name:"Denim Jacket",       price:2199, orig:null, emoji:"🧥", tag:"New Arrival",  cat:"Clothing",    stock:5,  rating:4.2, reviews:33  },
  { id:8, name:"Running Shorts",     price:599,  orig:799,  emoji:"🩳", tag:"Sale",        cat:"Clothing",    stock:20, rating:4.0, reviews:72  },
];

const CATEGORIES = ["All","Clothing","Footwear","Electronics","Accessories","Bags"];
const PROMOS = { SAVE10:10, FLAT200:null, WELCOME:15 };

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
  const tid = useRef(0);

  useEffect(() => { setTimeout(() => setLoaded(true), 1500); }, []);
  useEffect(() => { document.documentElement.setAttribute("data-theme", dark ? "dark" : "light"); }, [dark]);

  const subtotal  = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount  = appliedPromo ? (PROMOS[appliedPromo] !== null ? Math.round(subtotal * PROMOS[appliedPromo] / 100) : 200) : 0;
  const total     = Math.max(0, subtotal - discount);
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);
  const animTotal = useAnimNum(total);

  const toast = useCallback((msg, type = "default") => {
    const id = ++tid.current;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.map(t => t.id === id ? { ...t, out: true } : t)), 2200);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2550);
  }, []);

  const addToCart = p => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      return ex ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
    });
    setCartShake(true); setTimeout(() => setCartShake(false), 500);
    toast(`${p.emoji} ${p.name} added!`, "success");
  };

  const removeFromCart = id => {
    const p = cart.find(i => i.id === id);
    setCart(prev => prev.filter(i => i.id !== id));
    if (p) toast(`${p.name} removed`, "default");
  };

  const changeQty = (id, d) => setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + d) } : i));

  const toggleWish = p => {
    setWishlist(prev => {
      const has = prev.includes(p.id);
      toast(has ? "Removed from wishlist" : `${p.emoji} Wishlisted!`, "info");
      return has ? prev.filter(id => id !== p.id) : [...prev, p.id];
    });
  };

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (Object.prototype.hasOwnProperty.call(PROMOS, code)) {
      setAppliedPromo(code);
      setPromoMsg({ ok: true, text: `✓ ${code} applied!` });
      toast("Promo applied!", "success");
    } else {
      setAppliedPromo(null);
      setPromoMsg({ ok: false, text: "Invalid. Try SAVE10, FLAT200 or WELCOME" });
    }
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())            e.name    = "Name is required";
    if (!/^\d{10}$/.test(form.phone)) e.phone   = "Enter valid 10-digit number";
    if (!form.address.trim())         e.address = "Address is required";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const buildWhatsAppUrl = () => {
    const sep = "─────────────────────";
    const itemLines = cart.map(i =>
      `  • ${i.emoji} ${i.name} x${i.qty}  =  Rs.${(i.price * i.qty).toLocaleString()}`
    ).join("\n");
    const msg = [
      "🛒 *NEW ORDER*",
      sep,
      "*Items Ordered:*",
      itemLines,
      `💰 *Total: Rs.${total.toLocaleString()}*`,
      appliedPromo ? `🏷️ Promo (${appliedPromo}): -Rs.${discount.toLocaleString()}` : null,
      `🚚 Delivery: ${subtotal >= 999 ? "FREE" : "Rs.49"}`,
      sep,
      "👤 *Customer Details:*",
      `  Name: ${form.name}`,
      `  Phone: ${form.phone}`,
      `  Address: ${form.address}`,
      sep,
      "_Sent via WhatsApp Order App_",
    ].filter(Boolean).join("\n");
    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  };

  const placeOrder = () => {
    if (!validate() || !cart.length) return;
    setWaUrl(buildWhatsAppUrl());
    setSent(true);
    setConfetti(true);
    setTimeout(() => setConfetti(false), 200);
  };

  const resetApp = () => {
    setCart([]); setWishlist([]); setAppliedPromo(null); setPromoInput("");
    setPromoMsg(null); setForm({ name: "", phone: "", address: "" }); setErrors({});
    setSent(false); setWaUrl(""); setTab(0);
  };

  const filtered = PRODUCTS.filter(p =>
    (cat === "All" || p.cat === cat) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`app${dark ? " dark" : ""}`}>
      <Toast toasts={toasts} />
      <Confetti run={confetti} />

      {/* HEADER */}
      <header className="header">
        <div className="header-inner">
          <div>
            <h1 className="logo">Order Store</h1>
            <p className="tagline">Fast delivery via WhatsApp</p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => setDark(d => !d)}>{dark ? "☀️" : "🌙"}</button>
            <button className={`cart-btn${cartShake ? " shake" : ""}`} onClick={() => setTab(1)}>
              🛒 Cart {itemCount > 0 && <span className="badge">{itemCount}</span>}
            </button>
          </div>
        </div>
        <nav className="tab-bar">
          {["Shop", "Cart", "Checkout"].map((t, i) => (
            <button key={t} className={`tab${tab === i ? " active" : ""}`} onClick={() => setTab(i)}>
              {t}{i === 1 && itemCount > 0 ? ` (${itemCount})` : ""}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">

        {/* ── SHOP ── */}
        {tab === 0 && (
          <div className="fade-in">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input className="search-input" placeholder="Search products…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="cat-bar">
              {CATEGORIES.map(c => (
                <button key={c} className={`cat-btn${cat === c ? " active" : ""}`} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>

            {subtotal > 0 && subtotal < 999 && (
              <div className="delivery-banner">
                <div className="delivery-text">
                  <span>Add Rs.{(999 - subtotal).toLocaleString()} more for free delivery</span>
                  <span className="free-label">FREE</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (subtotal / 999) * 100)}%` }} />
                </div>
              </div>
            )}
            {subtotal >= 999 && subtotal > 0 && (
              <div className="free-banner">🎉 Free delivery unlocked!</div>
            )}

            <div className="product-grid">
              {!loaded
                ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} />)
                : filtered.length === 0
                  ? <div className="empty-state"><div>🔍</div><p>No products found</p></div>
                  : filtered.map(p => {
                      const inCart = cart.find(i => i.id === p.id);
                      const wished = wishlist.includes(p.id);
                      const disc   = p.orig ? Math.round((1 - p.price / p.orig) * 100) : null;
                      return (
                        <div key={p.id} className="card product-card">
                          {disc && <span className="disc-badge">-{disc}%</span>}
                          <button className="wish-btn" onClick={() => toggleWish(p)}>{wished ? "❤️" : "🤍"}</button>
                          <div className="product-img">{p.emoji}</div>
                          <div className="product-body">
                            <p className="product-name">{p.name}</p>
                            <div className="stars">
                              {"★".repeat(Math.floor(p.rating))}{"☆".repeat(5 - Math.floor(p.rating))}
                              <span className="reviews"> {p.rating} ({p.reviews})</span>
                            </div>
                            <div className="price-row">
                              <span className="price">Rs.{p.price.toLocaleString()}</span>
                              {p.orig && <span className="orig-price">Rs.{p.orig.toLocaleString()}</span>}
                            </div>
                            {p.stock <= 3 && <p className="low-stock">Only {p.stock} left!</p>}
                            <button className={`add-btn${inCart ? " in-cart" : ""}`} onClick={() => addToCart(p)}>
                              {inCart ? `✓ In Cart (${inCart.qty})` : "+ Add to Cart"}
                            </button>
                          </div>
                        </div>
                      );
                    })
              }
            </div>

            {itemCount > 0 && (
              <div className="floater">
                <span>{itemCount} items · Rs.{animTotal.toLocaleString()}</span>
                <button className="wa-btn-sm" onClick={() => setTab(2)}>Order via WhatsApp →</button>
              </div>
            )}
          </div>
        )}

        {/* ── CART ── */}
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
                  <div key={item.id} className="cart-item">
                    <div className="cart-emoji">{item.emoji}</div>
                    <div className="cart-info">
                      <p className="cart-name">{item.name}</p>
                      <p className="cart-price">Rs.{item.price.toLocaleString()} each</p>
                    </div>
                    <div className="qty-ctrl">
                      <button className="qty-btn" onClick={() => changeQty(item.id, -1)}>−</button>
                      <span className="qty-num">{item.qty}</span>
                      <button className="qty-btn" onClick={() => changeQty(item.id, 1)}>+</button>
                    </div>
                    <div className="cart-total">
                      <p>Rs.{(item.price * item.qty).toLocaleString()}</p>
                      <button className="remove-btn" onClick={() => removeFromCart(item.id)}>Remove</button>
                    </div>
                  </div>
                ))}

                <div className="promo-row">
                  <input className="promo-input" placeholder="Promo: SAVE10, FLAT200, WELCOME"
                    value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} />
                  <button className="btn-dark sm" onClick={applyPromo}>Apply</button>
                </div>
                {promoMsg && <p className={`promo-msg${promoMsg.ok ? " ok" : ""}`}>{promoMsg.text}</p>}

                <div className="surface summary">
                  <div className="sum-row"><span>Subtotal ({itemCount} items)</span><span>Rs.{subtotal.toLocaleString()}</span></div>
                  {appliedPromo && <div className="sum-row green"><span>Discount ({appliedPromo})</span><span>-Rs.{discount.toLocaleString()}</span></div>}
                  <div className="sum-row green"><span>Delivery</span><span>{subtotal >= 999 ? "FREE" : "Rs.49"}</span></div>
                  <div className="sum-row total"><span>Total</span><span>Rs.{animTotal.toLocaleString()}</span></div>
                </div>
                <button className="btn-dark full" onClick={() => setTab(2)}>Proceed to Checkout →</button>
              </>
            )}
          </div>
        )}

        {/* ── CHECKOUT ── */}
        {tab === 2 && (
          <div className="fade-in">
            {sent ? (
              <div className="success-screen">
                <div className="success-check">✓</div>
                <h2>Order Ready!</h2>
                <p>Tap below to open WhatsApp and send your order.</p>
                <a className="wa-link" href={waUrl} target="_blank" rel="noreferrer">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.975-1.302A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.945 7.945 0 01-4.27-1.24l-.306-.183-3.046.798.813-2.968-.2-.314A7.945 7.945 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/>
                  </svg>
                  Open WhatsApp &amp; Send Order
                </a>
                <button className="btn-dark" onClick={resetApp}>Shop Again</button>
              </div>
            ) : (
              <>
                <h2 className="section-title">Customer Details</h2>
                {[
                  { label: "Full Name",    key: "name",  type: "text", ph: "e.g. Rahul Sharma" },
                  { label: "Phone Number", key: "phone", type: "tel",  ph: "10-digit mobile" },
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
                      <div key={i.id} className="sum-row sm">
                        <span>{i.emoji} {i.name} ×{i.qty}</span>
                        <span>Rs.{(i.price * i.qty).toLocaleString()}</span>
                      </div>
                    ))}
                    {appliedPromo && <div className="sum-row green sm"><span>Discount ({appliedPromo})</span><span>-Rs.{discount.toLocaleString()}</span></div>}
                    <div className="sum-row total"><span>Total</span><span>Rs.{total.toLocaleString()}</span></div>
                  </div>
                )}

                {cart.length === 0 && (
                  <div className="warn-box">Cart is empty. <button className="link-btn" onClick={() => setTab(0)}>Add items</button></div>
                )}

                <button className={`wa-place-btn${!cart.length ? " disabled" : ""}`}
                  onClick={placeOrder} disabled={!cart.length}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.975-1.302A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.945 7.945 0 01-4.27-1.24l-.306-.183-3.046.798.813-2.968-.2-.314A7.945 7.945 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/>
                  </svg>
                  Place Order on WhatsApp
                </button>
                <p className="wa-hint">You'll be redirected to WhatsApp to confirm</p>
              </>
            )}
          </div>
        )}
      </main>
      <Analytics />
    </div>
  );
}