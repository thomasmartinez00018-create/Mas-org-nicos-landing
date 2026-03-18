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
  Loader2,
  X
} from 'lucide-react';

// --- Constants & Types ---

const WHATSAPP_NUMBER = "5491164399974"; 
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbwBBS115vlN0WVa0Cb4JVxpin4yY24EobF41WeH8Z-V50ErOFx-kTmu-3X2tYyMlHvIxQ/exec";
const SHEET_URL = import.meta.env.VITE_GOOGLE_SHEET_URL;
const CACHE_KEY = 'mas_organicos_data';

const generateClientId = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MORGAN-${yyyy}${mm}${dd}-${random}`;
};

// Helper for Meta Pixel tracking
const trackEvent = (eventName: string, params?: object) => {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', eventName, params);
  }
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
  const [combos, setCombos] = useState<Combo[]>([
    {
      id: 'fallback-1',
      name: 'Canasta Familiar de Granja',
      price: 36000,
      items: ['1 Pollo Pastoril', 'Combo Ensalada 3kg', '1kg Bananas', '1 Leche Entera La Recria'],
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: 'fallback-2',
      name: 'Canasta Almacén Premium',
      price: 38100,
      items: ['Aceite Oliva Orgánico 500ml', 'Queso Tybo Agro 200gr', 'Quinoa Orgánica 250gr'],
      image: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&q=80&w=800'
    }
  ]);
  const [products, setProducts] = useState<Product[]>([
    {
      id: 'fallback-3',
      name: 'Palta Hass Premium',
      price: 22500,
      unit: 'kg',
      image: 'https://images.unsplash.com/photo-1523049673857-d18f403759d8?auto=format&fit=crop&q=80&w=600'
    },
    {
      id: 'fallback-4',
      name: 'Pollo Pastoril Agro',
      price: 8700,
      unit: 'kg',
      image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&q=80&w=600'
    },
    {
      id: 'fallback-5',
      name: 'Aceite de Oliva Frutos del Norte',
      price: 23600,
      unit: '500ml',
      image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=600'
    }
  ]);
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

const LeadModal = memo(({ isOpen, onClose, initialProduct }: { isOpen: boolean, onClose: () => void, initialProduct: string }) => {
  const [zona, setZona] = useState('');
  const [modalidad, setModalidad] = useState('Envío a domicilio');
  const [queBusca, setQueBusca] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQueBusca(initialProduct || '');
      setZona('');
      setModalidad('Envío a domicilio');
    }
  }, [isOpen, initialProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const clientId = generateClientId();
    
    trackEvent('Lead', {
      external_id: clientId,
      content_name: queBusca,
    });

    const payload: any = {
      action: 'create_lead',
      client_id: clientId,
      zona,
      retiro_envio: modalidad,
      que_busca: queBusca,
      fuente: 'Meta',
      page_url: window.location.href,
    };

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'].forEach(key => {
        if (urlParams.has(key)) payload[key] = urlParams.get(key);
      });
      
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return '';
      };
      payload.fbp = getCookie('_fbp');
      payload.fbc = getCookie('_fbc');
    }

    try {
      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Error enviando lead:', err);
    }

    const waMsg = `Más Orgánicos | ID: ${clientId}\nZona: ${zona}\nModalidad: ${modalidad}\nBusca: ${queBusca}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`, '_blank');
    
    setIsSubmitting(false);
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-emerald-950/40 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-md shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-900 hover:bg-emerald-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2 mb-6">
          <h3 className="text-2xl font-sans font-bold text-emerald-950 tracking-tight">Ya casi estamos</h3>
          <p className="text-sm text-emerald-900/60 font-medium">
            Completá estos datos rápidos para confirmarte disponibilidad y opciones al instante.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-emerald-900 uppercase tracking-wider">¿En qué zona estás?</label>
            <div className="grid grid-cols-2 gap-2">
              {["CABA", "V. López / San Isidro", "Tigre / San Fernando", "Nordelta / Escobar", "San Miguel / D. Torcuato", "Otra zona"].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZona(z)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                    zona === z 
                      ? 'bg-emerald-900 text-white border-emerald-900 shadow-md shadow-emerald-900/20' 
                      : 'bg-white text-emerald-900 border-emerald-900/10 hover:bg-emerald-50'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Modalidad</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModalidad('Envío a domicilio')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                  modalidad === 'Envío a domicilio' 
                    ? 'bg-emerald-900 text-white border-emerald-900 shadow-md shadow-emerald-900/20' 
                    : 'bg-white text-emerald-900 border-emerald-900/10 hover:bg-emerald-50'
                }`}
              >
                Envío a domicilio
              </button>
              <button
                type="button"
                onClick={() => setModalidad('Retiro en sucursal')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                  modalidad === 'Retiro en sucursal' 
                    ? 'bg-emerald-900 text-white border-emerald-900 shadow-md shadow-emerald-900/20' 
                    : 'bg-white text-emerald-900 border-emerald-900/10 hover:bg-emerald-50'
                }`}
              >
                Retiro (Pacheco)
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-emerald-900 uppercase tracking-wider">¿Qué estás buscando?</label>
            <div className="grid grid-cols-2 gap-2">
              {(initialProduct ? [initialProduct, "Catálogo completo", "Combos armados", "Frutas y verduras"] : ["Combos armados", "Frutas y verduras", "Almacén premium", "Catálogo completo"]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQueBusca(q)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                    queBusca === q 
                      ? 'bg-emerald-900 text-white border-emerald-900 shadow-md shadow-emerald-900/20' 
                      : 'bg-white text-emerald-900 border-emerald-900/10 hover:bg-emerald-50'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !zona || !queBusca}
            className="w-full bg-emerald-900 text-white font-bold py-4 rounded-xl shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-2 text-base tracking-tight hover:bg-emerald-800 transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Abriendo WhatsApp...' : 'Continuar a WhatsApp'}
            {!isSubmitting && <MessageCircle className="w-5 h-5" />}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
});

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
    <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-1 rounded-full">
      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
      Abierto
    </div>
  </nav>
));

const Hero = memo(() => (
  <section className="pt-32 pb-16 px-6 overflow-hidden bg-[#fdfcf8]">
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center space-y-8"
    >
      <div className="flex items-center gap-2 text-emerald-800/60 font-medium text-xs uppercase tracking-[0.3em]">
        <span>Curaduría de Alimentos Reales</span>
      </div>
      
      <h1 className="text-3xl md:text-5xl font-sans font-bold text-emerald-950 leading-[1.15] text-balance max-w-2xl tracking-tight">
        Nosotros ya hicimos el trabajo difícil. <span className="text-emerald-800 italic font-medium">Vos solo disfrutá de comer bien.</span>
      </h1>
      
      <p className="text-base md:text-lg text-emerald-900/70 max-w-lg text-balance font-light">
        Filtramos, probamos y seleccionamos lo mejor del campo para que no tengas que dudar de lo que llevás a tu mesa.
      </p>

      <div className="relative w-full aspect-[16/10] max-w-3xl rounded-3xl overflow-hidden shadow-2xl shadow-emerald-900/10 border border-emerald-900/5">
        <img 
          src="https://i.postimg.cc/KY77F5wJ/Whats-App-Image-2025-12-19-at-11-55-23-AM.jpg" 
          alt="Selección manual de productos"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-emerald-950/10" />
      </div>

      <div className="flex flex-col items-center gap-4 w-full max-w-xs">
        <motion.a
          whileTap={{ scale: 0.95 }}
          href="#seleccion"
          onClick={() => trackEvent('ViewContent', { content_name: 'Selección Principal' })}
          className="w-full bg-emerald-900 text-white font-bold py-5 rounded-full shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-3 text-lg tracking-tight"
        >
          Ver nuestra selección
          <ChevronRight className="w-5 h-5" />
        </motion.a>
        <p className="text-[10px] text-emerald-900/40 uppercase tracking-widest font-bold">
          Envío a domicilio • Pedido mínimo desde $35.000
        </p>
      </div>
    </motion.div>
  </section>
));

const Process = memo(() => (
  <section className="py-20 px-6 bg-white">
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
      {[
        { 
          icon: <ShoppingBasket className="w-6 h-6 text-emerald-700" />, 
          title: "Elegís con confianza", 
          desc: "Navegá nuestra selección curada de combos y productos de estación." 
        },
        { 
          icon: <MessageCircle className="w-6 h-6 text-emerald-700" />, 
          title: "Coordinamos simple", 
          desc: "Hacés tu pedido por WhatsApp. Te confirmamos stock y día de entrega al instante." 
        },
        { 
          icon: <Truck className="w-6 h-6 text-emerald-700" />, 
          title: "Recibís en tu casa", 
          desc: "Llevamos la frescura del campo a tu puerta en el día asignado a tu zona." 
        }
      ].map((step, i) => (
        <div key={i} className="flex flex-col items-center text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-2">
            {step.icon}
          </div>
          <h3 className="text-lg font-bold text-emerald-950 tracking-tight">{step.title}</h3>
          <p className="text-sm text-emerald-900/60 leading-relaxed">{step.desc}</p>
        </div>
      ))}
    </div>
  </section>
));

const Manifesto = memo(() => (
  <section className="py-24 px-8 bg-[#5a5a40] text-[#fdfcf8]">
    <div className="max-w-2xl mx-auto space-y-8 text-center">
      <div className="w-16 h-[1px] bg-[#fdfcf8]/20 mx-auto" />
      <p className="text-xl md:text-3xl font-sans font-medium leading-[1.6] italic tracking-tight text-[#fdfcf8]">
        "No somos un catálogo. No vendemos todo lo que dice 'saludable'.<br/>
        Elegimos. Probamos. Descartamos.<br/>
        Conocemos a quienes producen y exigimos trazabilidad.<br/>
        Y recién después, lo ofrecemos en nuestra mesa y en la tuya."
      </p>
      <div className="w-16 h-[1px] bg-[#fdfcf8]/20 mx-auto" />
    </div>
  </section>
));

const ComboSection = memo(({ combos, openModal }: { combos: Combo[], openModal: (p?: string) => void }) => (
  <section id="seleccion" className="py-20 px-6 bg-white">
    <div className="max-w-2xl mx-auto space-y-12">
      <div className="text-center space-y-3">
        <h2 className="text-3xl md:text-4xl font-sans font-bold text-emerald-950 tracking-tight">Los alimentos más elegidos por nuestra comunidad</h2>
        <div className="w-16 h-[2px] bg-emerald-800 mx-auto" />
      </div>

      <div className="space-y-10">
        {combos.map((combo) => (
          <motion.div 
            key={combo.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="group flex flex-col md:flex-row bg-[#fdfcf8] rounded-[2rem] overflow-hidden border border-emerald-900/5 hover:shadow-2xl hover:shadow-emerald-900/5 transition-all duration-500"
          >
            <div className="md:w-1/2 h-64 md:h-auto relative overflow-hidden">
              <img 
                src={combo.image} 
                alt={combo.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            </div>
            <div className="md:w-1/2 p-8 md:p-10 flex flex-col justify-center space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-sans font-bold text-emerald-950 tracking-tight">{combo.name}</h3>
                <p className="text-3xl font-light text-emerald-800 tracking-tighter">${combo.price.toLocaleString('es-AR')}</p>
              </div>
              <ul className="space-y-3">
                {combo.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-emerald-900/70 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-800/30 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  e.preventDefault();
                  handleWhatsAppClick(combo.name, combo.price);
                  openModal(combo.name);
                }}
                className="inline-flex items-center justify-center bg-emerald-900 text-white font-bold py-4 px-8 rounded-full shadow-lg shadow-emerald-900/10 hover:bg-emerald-800 transition-colors w-full md:w-auto"
              >
                Agregar a mi selección
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
));

const ProductGrid = memo(({ products, openModal }: { products: Product[], openModal: (p?: string) => void }) => (
  <section className="pb-24 px-6 bg-white">
    <div className="max-w-2xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        {products.map((product) => (
          <motion.div 
            key={product.id}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex flex-col space-y-4"
          >
            <div className="aspect-square rounded-[2rem] overflow-hidden bg-emerald-50 border border-emerald-900/5">
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" 
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            </div>
            <div className="px-2 space-y-3">
              <div className="flex justify-between items-start gap-4">
                <h4 className="text-lg font-sans font-bold text-emerald-950 leading-tight tracking-tight">{product.name}</h4>
                <p className="text-xl font-light text-emerald-800 tracking-tighter">${product.price.toLocaleString('es-AR')}</p>
              </div>
              <p className="text-sm text-emerald-900/40 font-medium uppercase tracking-widest">por {product.unit}</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.preventDefault();
                  handleWhatsAppClick(product.name, product.price);
                  openModal(product.name);
                }}
                className="flex items-center justify-center w-full border border-emerald-900/10 text-emerald-900 font-bold py-3 rounded-full hover:bg-emerald-50 transition-colors text-sm"
              >
                Agregar a mi selección
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-16 text-center space-y-4"
      >
        <p className="text-sm text-emerald-900/50 font-medium italic">
          Esta es solo una parte de nuestra selección semanal.
        </p>
        <p className="text-emerald-950/80 max-w-sm mx-auto text-sm leading-relaxed">
          Contamos con una variedad extendida de productos de estación y almacén premium. Consultanos por el catálogo completo al hacer tu pedido.
        </p>
      </motion.div>
    </div>
  </section>
));

const LogisticsSection = memo(({ innerRef }: { innerRef: React.RefObject<HTMLDivElement | null> }) => (
  <section ref={innerRef} className="py-24 px-6 bg-[#fdfcf8] border-y border-emerald-900/5">
    <div className="max-w-2xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-3xl md:text-4xl font-sans font-bold text-emerald-950 tracking-tight">Reglas del Juego</h2>
        <p className="text-emerald-900/60 max-w-md mx-auto text-balance font-medium">
          Para garantizar la frescura y calidad, organizamos nuestra logística por zonas. <br/>
          <span className="font-bold text-emerald-900">Revisá tu día antes de pedir:</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { day: "Martes", time: "15:00 a 19:00 hs", zones: "Tigre / San Fernando" },
          { day: "Miércoles", time: "15:00 a 19:00 hs", zones: "San Isidro / V. López" },
          { day: "Jueves", time: "15:00 a 19:00 hs", zones: "Nordelta / Benavídez / Escobar / Garín" },
          { day: "Lunes, Mié y Jue", time: "Varios horarios", zones: "CABA, San Miguel, Don Torcuato", detail: "Consultar horarios específicos por zona." },
        ].map((item, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-emerald-900/5 space-y-3 shadow-sm">
            <div className="flex justify-between items-center">
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-[0.2em]">{item.day}</p>
              <p className="text-[10px] text-emerald-900/40 font-bold">{item.time}</p>
            </div>
            <h4 className="text-lg font-sans font-bold text-emerald-950 tracking-tight">{item.zones}</h4>
            {item.detail && (
              <p className="text-[10px] text-emerald-900/60 font-medium leading-tight">{item.detail}</p>
            )}
            <div className="pt-2">
              <span className="inline-block text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full uppercase tracking-tighter">
                Coordinar por mensaje
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-emerald-900/5 p-8 rounded-[2.5rem] border border-emerald-900/10 space-y-4 text-center">
        <h4 className="font-bold text-emerald-950">Información Importante</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
          <div className="space-y-1">
            <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Pedido Mínimo</p>
            <p className="text-sm text-emerald-900/70">Desde $35.000 (varía según zona, ej. CABA $50.000).</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Fuera de Programa</p>
            <p className="text-sm text-emerald-900/70">Entregas fuera de tu día asignado tienen costo adicional.</p>
          </div>
        </div>
        <p className="text-[11px] text-emerald-900/40 italic pt-4">
          Retiro en sucursal (Pacheco/Benavídez) disponible sin mínimo de compra.
        </p>
      </div>
    </div>
  </section>
));

const Footer = memo(({ openModal }: { openModal: () => void }) => (
  <footer className="pt-24 pb-32 px-6 text-center space-y-12 bg-white">
    <div className="max-w-md mx-auto space-y-8">
      <div className="mx-auto flex items-center justify-center">
        <img 
          src="https://i.postimg.cc/43MYDHxJ/image-removebg-preview.png" 
          alt="Más Orgánicos Logo" 
          className="h-24 w-auto object-contain opacity-80"
          referrerPolicy="no-referrer"
        />
      </div>
      <h2 className="text-2xl md:text-4xl font-sans font-bold text-emerald-950 leading-tight tracking-tight">Nosotros ya filtramos. <br/> <span className="text-emerald-800 italic">Vos solo disfrutá.</span></h2>
      
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={(e) => {
          e.preventDefault();
          handleWhatsAppClick();
          openModal();
        }}
        className="block w-full bg-emerald-900 text-white font-bold py-5 rounded-full shadow-xl shadow-emerald-900/20 text-lg tracking-tight"
      >
        Hacer mi pedido 📱
      </motion.button>
      
      <div className="pt-12 border-t border-emerald-900/5">
        <p className="text-xs font-bold text-emerald-900/20 uppercase tracking-[0.4em]">
          © 2026 Más Orgánicos - Curadores de Alimentos Reales
        </p>
      </div>
    </div>
  </footer>
));

const StickyCTA = memo(({ openModal }: { openModal: () => void }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 500);
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
          className="fixed bottom-8 right-6 z-50"
        >
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.preventDefault();
              handleWhatsAppClick();
              openModal();
            }}
            className="bg-emerald-900 text-white flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl shadow-emerald-950/40 border border-white/10"
          >
            <span className="font-bold tracking-tight">Hacer Pedido 📱</span>
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

const Testimonials = memo(() => (
  <section className="py-20 px-6 bg-white overflow-hidden">
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-2xl font-bold text-emerald-950 tracking-tight">Lo que dicen las familias</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {[
          { 
            text: "La tranquilidad de saber que todo lo que pido es de calidad. Ya no pierdo tiempo leyendo etiquetas.", 
            author: "María G.", 
            role: "Cliente hace 2 años" 
          },
          { 
            text: "La selección de frutas y verduras es impecable. Se nota el criterio que tienen para elegir a los productores.", 
            author: "Juan P.", 
            role: "Zona Nordelta" 
          }
        ].map((t, i) => (
          <div key={i} className="bg-emerald-50/50 p-8 rounded-[2rem] space-y-4 border border-emerald-900/5">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-emerald-600 text-emerald-600" />)}
            </div>
            <p className="text-emerald-900/80 italic font-light leading-relaxed">"{t.text}"</p>
            <div>
              <p className="font-bold text-emerald-950 text-sm">{t.author}</p>
              <p className="text-xs text-emerald-900/40">{t.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
));

export default function App() {
  const { combos, products, loading, error } = useSheetData();
  const logisticsRef = React.useRef<HTMLDivElement>(null);
  const [hasViewedLogistics, setHasViewedLogistics] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, product: '' });

  const openModal = useCallback((product = '') => {
    setModalState({ isOpen: true, product });
  }, []);

  const closeModal = useCallback(() => {
    setModalState({ isOpen: false, product: '' });
  }, []);

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
        <p className="font-sans italic text-emerald-900">Cargando comida real...</p>
      </div>
    );
  }

  if (error && combos.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-50 px-6 text-center gap-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <ShieldCheck className="text-red-600 w-8 h-8" />
        </div>
        <h2 className="text-2xl font-sans font-bold text-emerald-950">¡Ups! Algo salió mal</h2>
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
        <Process />
        <Manifesto />
        {combos.length > 0 && <ComboSection combos={combos} openModal={openModal} />}
        {products.length > 0 && <ProductGrid products={products} openModal={openModal} />}
        <Testimonials />
        <LogisticsSection innerRef={logisticsRef} />
        <Footer openModal={openModal} />
      </main>
      <StickyCTA openModal={openModal} />
      <AnimatePresence>
        {modalState.isOpen && (
          <LeadModal 
            isOpen={modalState.isOpen} 
            onClose={closeModal} 
            initialProduct={modalState.product} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
