/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { 
  ShoppingBasket, 
  Truck, 
  CreditCard, 
  CheckCircle2, 
  MessageCircle, 
  Star, 
  ChevronRight,
  ShieldCheck,
  Loader2
} from 'lucide-react';

// --- Constants & Types ---

const WHATSAPP_NUMBER = "5491164399974"; 
const WHATSAPP_BASE_MSG = "Hola, vengo de la web. Quiero hacer un pedido que supera el mínimo de $35.000. Vivo en [COMPLETAR ZONA/BARRIO]. ¿Me confirmás disponibilidad?";
const SHEET_URL = import.meta.env.VITE_GOOGLE_SHEET_URL;
const CACHE_KEY = 'mas_organicos_data';

// Helper for Meta Pixel tracking
const trackEvent = (eventName: string, params?: object) => {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', eventName, params);
  }
};

const getWhatsAppLink = (message = WHATSAPP_BASE_MSG) => {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
};

const handleWhatsAppClick = (productName?: string, price?: number) => {
  trackEvent('AddToCart', {
    content_name: productName || 'General WhatsApp Inquiry',
    value: price || 0,
    currency: 'ARS'
  });
};

interface Combo {
  id: string;
  name: string;
  price: number;
  items: string[];
  image: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  image: string;
  featured?: boolean;
}

// --- Hooks ---

const useSheetData = () => {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!SHEET_URL || SHEET_URL === "REPLACE_WITH_YOUR_CSV_URL") {
      setLoading(false);
      return;
    }

    // Intentar cargar desde cache primero para una carga instantánea
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { combos: c, products: p } = JSON.parse(cached);
        setCombos(c);
        setProducts(p);
        setLoading(false);
      } catch (e) {
        console.error("Cache error", e);
      }
    }

    const fetchData = async () => {
      try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
          complete: (results) => {
            const data = results.data as any[];
            
            const getVal = (row: any, ...keys: string[]) => {
              const rowKeys = Object.keys(row);
              for (const k of keys) {
                const found = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase());
                if (found) return row[found];
              }
              return null;
            };

            const cleanPrice = (val: any) => {
              if (!val) return 0;
              let s = String(val).replace(/[$ ]/g, "");
              if (s.includes(",") && s.includes(".")) {
                s = s.replace(/\./g, "").replace(",", ".");
              } else if (s.includes(",")) {
                s = s.replace(",", ".");
              } else if (s.includes(".")) {
                const parts = s.split('.');
                if (parts[parts.length - 1].length === 3) {
                  s = s.replace(/\./g, "");
                }
              }
              return parseFloat(s) || 0;
            };

            const fetchedCombos: Combo[] = data
              .filter(row => {
                const type = String(getVal(row, 'Type', 'Tipo') || '').toLowerCase().trim();
                return type === 'combo';
              })
              .map((row, index) => ({
                id: getVal(row, 'ID') || `combo-${index}`,
                name: getVal(row, 'Name', 'Nombre') || "Combo",
                price: cleanPrice(getVal(row, 'Price', 'Precio')),
                items: getVal(row, 'Description', 'Descripcion') 
                  ? (String(getVal(row, 'Description')).includes(',') ? String(getVal(row, 'Description')).split(',').map((s: string) => s.trim()) : [String(getVal(row, 'Description'))])
                  : [],
                image: getVal(row, 'ImageURL', 'Imagen') || 'https://picsum.photos/seed/error/600/400'
              }));

            const fetchedProducts: Product[] = data
              .filter(row => {
                const type = String(getVal(row, 'Type', 'Tipo') || '').toLowerCase().trim();
                return type.startsWith('prod');
              })
              .map((row, index) => ({
                id: getVal(row, 'ID') || `prod-${index}`,
                name: getVal(row, 'Name', 'Nombre') || "Producto",
                price: cleanPrice(getVal(row, 'Price', 'Precio')),
                unit: getVal(row, 'Unit', 'Unidad') || 'un',
                image: getVal(row, 'ImageURL', 'Imagen') || 'https://picsum.photos/seed/error/400/400',
                featured: String(getVal(row, 'Featured', 'Destacado') || '').toLowerCase().trim() === 'true'
              }));

            setCombos(fetchedCombos);
            setProducts(fetchedProducts);
            setLoading(false);
            
            // Guardar en cache para la próxima vez
            localStorage.setItem(CACHE_KEY, JSON.stringify({ combos: fetchedCombos, products: fetchedProducts }));
          },
          error: (err: any) => {
            console.error('Error parsing CSV:', err);
            if (!cached) setError('Error al procesar los datos.');
            setLoading(false);
          }
        });
      } catch (err) {
        console.error('Error fetching sheet:', err);
        if (!cached) setError('No se pudo conectar con la base de datos.');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { combos, products, loading, error };
};

// --- Components ---

const Navbar = memo(() => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5 px-4 py-2 flex justify-between items-center">
    <div className="flex items-center gap-2">
      <img 
        src="https://i.postimg.cc/43MYDHxJ/image-removebg-preview.png" 
        alt="Más Orgánicos Logo" 
        className="h-10 w-auto object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-1 rounded-full">
      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
      Abierto
    </div>
  </nav>
));

const Hero = memo(() => (
  <section className="pt-24 pb-12 px-6 overflow-hidden">
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center space-y-6"
    >
      <div className="flex items-center gap-1 text-amber-600 font-bold text-xs uppercase tracking-widest">
        <div className="flex">
          {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
        </div>
        <span>+500 familias ya comen de verdad</span>
      </div>
      
      <h1 className="text-4xl md:text-5xl font-serif font-bold text-emerald-950 leading-[1.1] text-balance">
        Comida Real y Pastoril de Nuestra Granja a tu Heladera en <span className="text-emerald-700 italic">Zona Norte.</span>
      </h1>
      
      <p className="text-lg text-emerald-900/70 max-w-md text-balance">
        Sin agroquímicos ni ultraprocesados. Seleccionamos lo mejor para tu familia.
      </p>

      <div className="relative w-full aspect-[4/5] max-w-sm rounded-3xl overflow-hidden shadow-2xl shadow-emerald-900/20 border-4 border-white">
        <img 
          src="https://i.postimg.cc/KY77F5wJ/Whats-App-Image-2025-12-19-at-11-55-23-AM.jpg" 
          alt="Delivery de comida real"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          loading="eager" // Hero image should load fast
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/60 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6">
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Truck className="text-emerald-700 w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-emerald-900 uppercase tracking-tighter">Próxima Entrega</p>
              <p className="text-sm font-medium text-emerald-700">Mañana en Zona Norte</p>
            </div>
          </div>
        </div>
      </div>

      <motion.a
        whileTap={{ scale: 0.95 }}
        href={getWhatsAppLink()}
        onClick={() => handleWhatsAppClick()}
        className="w-full max-w-sm bg-emerald-800 text-white font-bold py-5 rounded-2xl shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-3 text-lg"
      >
        Ver Combos y Pedir por WhatsApp
        <ChevronRight className="w-5 h-5" />
      </motion.a>
    </motion.div>
  </section>
));

const ComboSection = memo(({ combos }: { combos: Combo[] }) => (
  <section className="py-12 px-6 bg-emerald-900 text-white">
    <div className="max-w-md mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-serif font-bold">Ofertas Irresistibles</h2>
        <p className="text-emerald-100/70">Ahorrá tiempo y dinero con nuestras canastas seleccionadas.</p>
      </div>

      <div className="space-y-6">
        {combos.map((combo) => (
          <motion.div 
            key={combo.id}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            className="bg-white rounded-3xl overflow-hidden shadow-xl"
          >
            <div className="h-48 relative">
              <img 
                src={combo.image} 
                alt={combo.name} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute top-4 right-4 bg-emerald-500 text-white font-black px-3 py-1 rounded-full text-sm">
                POPULAR
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-emerald-950 leading-tight">{combo.name}</h3>
                <span className="text-2xl font-black text-emerald-700">${combo.price.toLocaleString('es-AR')}</span>
              </div>
              <ul className="space-y-2">
                {combo.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-emerald-900/80 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <motion.a
                whileTap={{ scale: 0.98 }}
                href={getWhatsAppLink(`Hola! Quiero la ${combo.name}. Vivo en [BARRIO].`)}
                onClick={() => handleWhatsAppClick(combo.name, combo.price)}
                className="block w-full bg-emerald-700 text-white text-center font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20"
              >
                Quiero esta Canasta
              </motion.a>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
));

const ProductGrid = memo(({ products }: { products: Product[] }) => (
  <section className="py-16 px-6">
    <div className="max-w-md mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-serif font-bold text-emerald-950">Los 10 "Winners"</h2>
        <p className="text-emerald-900/60">Nuestros productos más pedidos y frescos.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {products.map((product) => (
          <motion.div 
            key={product.id}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="bg-white p-3 rounded-2xl shadow-sm border border-black/5 flex flex-col gap-2 relative"
          >
            {product.featured && (
              <span className="absolute top-2 left-2 z-10 bg-amber-100 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">
                Destacado
              </span>
            )}
            <div className="aspect-square rounded-xl overflow-hidden bg-emerald-50">
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-emerald-950 leading-tight line-clamp-2 min-h-[2rem]">{product.name}</h4>
              <p className="text-sm font-black text-emerald-700">${product.price.toLocaleString('es-AR')}</p>
              <p className="text-[10px] text-emerald-900/40 font-medium">por {product.unit}</p>
              <motion.a
                whileTap={{ scale: 0.95 }}
                href={getWhatsAppLink(`Hola! Quiero ${product.name}. Vivo en [BARRIO].`)}
                onClick={() => handleWhatsAppClick(product.name, product.price)}
                className="mt-2 block w-full bg-emerald-100 text-emerald-800 text-[10px] font-bold py-2 rounded-lg text-center"
              >
                Pedir
              </motion.a>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
));

const LogisticsSection = memo(({ innerRef }: { innerRef: React.RefObject<HTMLDivElement | null> }) => (
  <section ref={innerRef} className="py-16 px-6 bg-emerald-50 border-y border-emerald-100">
    <div className="max-w-md mx-auto space-y-10">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-serif font-bold text-emerald-950">Reglas del Juego</h2>
        <p className="text-emerald-900/60 italic">Leé con atención antes de pedir.</p>
      </div>

      <div className="grid gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-200/50 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <ShoppingBasket className="text-emerald-700 w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-emerald-950 text-lg">Pedido Mínimo</h4>
            <p className="text-emerald-700 font-black text-2xl">$35.000 ARS</p>
            <p className="text-sm text-emerald-900/60">Para garantizar la frescura y logística de tu pedido.</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-200/50 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Truck className="text-emerald-700 w-6 h-6" />
          </div>
          <div className="space-y-3">
            <h4 className="font-bold text-emerald-950 text-lg">Envíos y Zonas</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">GRATIS</span>
                <p className="text-sm font-medium text-emerald-900">Pacheco y El Talar (Lun a Vie)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">$2.500</span>
                <p className="text-sm font-medium text-emerald-900">Nordelta, Tigre, San Fernando</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-200/50 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CreditCard className="text-emerald-700 w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-emerald-950 text-lg">Métodos de Pago</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {['Transferencia', 'Mercado Pago', 'Cuenta DNI', 'Efectivo'].map(p => (
                <span key={p} className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-lg">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
));

const Footer = memo(() => (
  <footer className="pt-16 pb-32 px-6 text-center space-y-8">
    <div className="max-w-md mx-auto space-y-6">
      <div className="mx-auto flex items-center justify-center">
        <img 
          src="https://i.postimg.cc/43MYDHxJ/image-removebg-preview.png" 
          alt="Más Orgánicos Logo" 
          className="h-20 w-auto object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
      <h2 className="text-3xl font-serif font-bold text-emerald-950">¿Por qué elegirnos?</h2>
      <p className="text-emerald-900/70 text-balance">
        Apoyamos a productores locales, garantizamos sabor real y cuidamos tu salud con alimentos libres de químicos.
      </p>
      
      <motion.a
        whileTap={{ scale: 0.95 }}
        href={getWhatsAppLink()}
        onClick={() => handleWhatsAppClick()}
        className="block w-full bg-emerald-800 text-white font-bold py-5 rounded-2xl shadow-xl shadow-emerald-900/30 text-lg"
      >
        Armar mi pedido por WhatsApp
      </motion.a>
      
      <div className="pt-8 border-t border-black/5">
        <p className="text-[10px] font-bold text-emerald-900/30 uppercase tracking-[0.2em]">
          © 2026 Más Orgánicos - Zona Norte, Buenos Aires
        </p>
      </div>
    </div>
  </footer>
));

const StickyCTA = memo(() => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-6 right-6 z-50 md:hidden"
        >
          <motion.a
            whileTap={{ scale: 0.95 }}
            href={getWhatsAppLink()}
            onClick={() => handleWhatsAppClick()}
            className="bg-emerald-600 text-white flex items-center justify-between px-6 py-4 rounded-2xl shadow-xl shadow-emerald-900/20"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Listo para pedir?</span>
              <span className="font-bold text-lg">Hacer Pedido 📱</span>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
          </motion.a>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default function App() {
  const { combos, products, loading, error } = useSheetData();
  const logisticsRef = React.useRef<HTMLDivElement>(null);
  const [hasViewedLogistics, setHasViewedLogistics] = useState(false);

  useEffect(() => {
    if (!loading && logisticsRef.current && !hasViewedLogistics) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            trackEvent('ViewContent', {
              content_name: 'Reglas del Juego',
              content_category: 'Logistics'
            });
            setHasViewedLogistics(true);
            observer.disconnect();
          }
        },
        { threshold: 0.5 }
      );

      observer.observe(logisticsRef.current);
      return () => observer.disconnect();
    }
  }, [loading, hasViewedLogistics]);

  if (loading && combos.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-50 gap-4">
        <Loader2 className="w-12 h-12 text-emerald-700 animate-spin" />
        <p className="font-serif italic text-emerald-900">Cargando comida real...</p>
      </div>
    );
  }

  if (error && combos.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-50 px-6 text-center gap-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <ShieldCheck className="text-red-600 w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-emerald-950">¡Ups! Algo salió mal</h2>
        <p className="text-emerald-900/60">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-emerald-800 text-white px-8 py-3 rounded-xl font-bold"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen selection:bg-emerald-200 selection:text-emerald-900">
      <Navbar />
      <main>
        <Hero />
        {combos.length > 0 && <ComboSection combos={combos} />}
        {products.length > 0 && <ProductGrid products={products} />}
        <LogisticsSection innerRef={logisticsRef} />
        <Footer />
      </main>
      <StickyCTA />
    </div>
  );
}
