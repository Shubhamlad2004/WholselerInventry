import React, { useState, useEffect } from 'react';
import { Home, CreditCard, UserPlus, Package, CheckCircle2, ChevronRight, Plus, Trash2, MapPin, Phone, Download, RefreshCcw, Minus, Edit2, Save, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Customer, Delivery, CustomPricing, RegularOrder, DeliveryItem } from './types';

// --- Components ---

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string }) => {
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"
      >
        <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm mb-6">{message}</p>
        
        <div className="space-y-1 mb-6">
          <label className="text-[10px] font-bold uppercase text-slate-400">Type "confirm" to proceed</label>
          <input
            type="text"
            placeholder="confirm"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="py-3 rounded-xl font-bold text-slate-500 bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (confirmText.toLowerCase() === 'confirm') {
                onConfirm();
                setConfirmText('');
              }
            }}
            disabled={confirmText.toLowerCase() !== 'confirm'}
            className={`py-3 rounded-xl font-bold text-white shadow-lg ${
              confirmText.toLowerCase() === 'confirm' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-slate-300 shadow-none cursor-not-allowed'
            }`}
          >
            Proceed
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'payments', icon: CreditCard, label: 'Payments' },
    { id: 'customers', icon: UserPlus, label: 'Customers' },
    { id: 'goods', icon: Package, label: 'Goods' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-panel border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === tab.id ? 'text-emerald-600' : 'text-slate-400'
          }`}
        >
          <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

// --- Screens ---

const HomeScreen = () => {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [deliveryItems, setDeliveryItems] = useState<{product_id: number, quantity: number, price_per_unit: number, name: string}[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        fetch('/api/deliveries/today'),
        fetch('/api/products')
      ]);
      setAllCustomers(await custRes.json());
      setProducts(await prodRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerClick = async (customer: Customer) => {
    setSelectedCustomer(customer);
    try {
      const res = await fetch(`/api/customers/${customer.id}/details`);
      const data = await res.json();
      
      // Initialize delivery items with regular orders
      const initialItems = data.orders.map((order: RegularOrder) => {
        const customPrice = data.pricing.find((p: CustomPricing) => p.product_id === order.product_id);
        return {
          product_id: order.product_id,
          quantity: order.quantity,
          price_per_unit: customPrice ? customPrice.price : (order.base_price || 0),
          name: order.product_name || 'Product'
        };
      });
      setDeliveryItems(initialItems);
    } catch (err) {
      console.error(err);
    }
  };

  const updateItemQuantity = (productId: number, delta: number) => {
    setDeliveryItems(prev => prev.map(item => 
      item.product_id === productId 
        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
        : item
    ).filter(item => item.quantity > 0));
  };

  const addExtraProduct = (product: Product) => {
    if (deliveryItems.find(i => i.product_id === product.id)) return;
    setDeliveryItems(prev => [...prev, {
      product_id: product.id,
      quantity: 1,
      price_per_unit: product.base_price,
      name: product.name
    }]);
  };

  const recordDelivery = async () => {
    if (!selectedCustomer || deliveryItems.length === 0) return;

    try {
      const res = await fetch('/api/deliveries/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          items: deliveryItems
        })
      });
      if (res.ok) {
        setSelectedCustomer(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetDay = async () => {
    await fetch('/api/system/reset-day', { method: 'POST' });
    setShowResetConfirm(false);
    fetchData();
  };

  const downloadReport = () => {
    window.open('/api/system/export-csv', '_blank');
    setShowDownloadConfirm(false);
  };

  return (
    <div className="pb-24 p-4">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">DairyFlow</h1>
          <p className="text-slate-500 italic serif">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDownloadConfirm(true)} className="p-2 bg-slate-100 text-slate-600 rounded-xl" title="Export CSV">
            <Download size={20} />
          </button>
          <button onClick={() => setShowResetConfirm(true)} className="p-2 bg-slate-100 text-slate-600 rounded-xl" title="Reset Day">
            <RefreshCcw size={20} />
          </button>
        </div>
      </header>

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={resetDay}
        title="Reset Day?"
        message="This will clear all delivery marks for today and reset all product stocks to 0. This cannot be undone."
      />

      <ConfirmModal
        isOpen={showDownloadConfirm}
        onClose={() => setShowDownloadConfirm(false)}
        onConfirm={downloadReport}
        title="Download CSV?"
        message="This will generate a CSV report of all today's deliveries and current inventory status."
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {allCustomers.map((customer, idx) => (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              key={customer.id}
              onClick={() => handleCustomerClick(customer)}
              className={`glass-panel p-4 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all border-l-4 ${
                customer.delivery_status === 'delivered' ? 'border-l-emerald-500 bg-emerald-50/50' : 'border-l-slate-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  customer.delivery_status === 'delivered' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {customer.delivery_status === 'delivered' ? <CheckCircle2 size={20} /> : idx + 1}
                </div>
                <div>
                  <h3 className={`font-semibold ${customer.delivery_status === 'delivered' ? 'text-emerald-900' : 'text-slate-900'}`}>
                    {customer.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <MapPin size={10} /> {customer.address}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-xs font-bold ${(customer.balance || 0) > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                  Due: ₹{(customer.balance || 0).toFixed(0)}
                </p>
                <ChevronRight size={16} className="text-slate-300 ml-auto" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedCustomer.name}</h2>
                  <p className="text-slate-500 text-sm">Update delivery for today</p>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 p-2">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Delivery Items</h4>
                {deliveryItems.map((item) => (
                  <div key={item.product_id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">{item.name}</p>
                      <p className="text-[10px] text-slate-500">₹{item.price_per_unit} / unit</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateItemQuantity(item.product_id, -1)} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-600">
                        <Minus size={14} />
                      </button>
                      <span className="font-mono font-bold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateItemQuantity(item.product_id, 1)} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-600">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {deliveryItems.length === 0 && (
                  <p className="text-center py-4 text-slate-400 text-sm italic">No items selected</p>
                )}
              </div>

              <div className="mb-6">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Add Extra Product</h4>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addExtraProduct(p)}
                      className="whitespace-nowrap px-3 py-2 bg-slate-100 rounded-lg text-xs font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      + {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mb-6 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Total for today:</span>
                <span className="text-xl font-bold text-emerald-600">
                  ₹{deliveryItems.reduce((sum, i) => sum + (i.quantity * i.price_per_unit), 0).toFixed(2)}
                </span>
              </div>

              <button
                onClick={recordDelivery}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} />
                Confirm & Add to Balance
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PaymentsScreen = () => {
  const [balances, setBalances] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<(Delivery & { items: (DeliveryItem & { product_name: string })[] })[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchBalances();
  }, []);

  const fetchBalances = async () => {
    try {
      const res = await fetch('/api/payments/balances');
      const data = await res.json();
      setBalances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (customer: Customer) => {
    setHistoryCustomer(customer);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/history`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const recordPayment = async () => {
    if (!selectedCustomer || !payAmount) return;
    try {
      const res = await fetch('/api/payments/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          amount: parseFloat(payAmount)
        })
      });
      if (res.ok) {
        setSelectedCustomer(null);
        setPayAmount('');
        fetchBalances();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="pb-24 p-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Payments</h1>
        <p className="text-slate-500 italic serif">Outstanding customer balances</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : balances.length === 0 ? (
        <div className="text-center py-12 glass-panel rounded-2xl">
          <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
          <p className="text-slate-600 font-medium">No outstanding balances!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {balances.map((customer) => (
            <div key={customer.id} className="glass-panel p-4 rounded-2xl flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{customer.name}</h3>
                <p className="text-xs text-slate-500">{customer.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-2">
                  <p className={`font-mono font-bold ${(customer.balance || 0) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    ₹{(customer.balance || 0).toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchHistory(customer)}
                    className="p-2 bg-slate-100 text-slate-600 rounded-lg"
                    title="View History"
                  >
                    <FileText size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedCustomer(customer)}
                    className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm"
                  >
                    Pay
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-1">Record Payment</h3>
              <p className="text-slate-500 text-sm mb-6">Customer: {selectedCustomer.name}</p>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Current Balance:</span>
                  <span className="font-bold text-slate-900">₹{(selectedCustomer.balance || 0).toFixed(2)}</span>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Amount Received</label>
                  <input
                    type="number"
                    placeholder="Enter amount"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-lg font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="py-3 rounded-xl font-bold text-slate-500 bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={recordPayment}
                  className="py-3 rounded-xl font-bold text-white bg-emerald-600 shadow-lg shadow-emerald-100"
                >
                  Save Payment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{historyCustomer.name}</h2>
                  <p className="text-slate-500 text-sm">Statement & Bill History</p>
                </div>
                <button onClick={() => setHistoryCustomer(null)} className="text-slate-400 p-2">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pb-6 scrollbar-hide">
                {historyLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-center text-slate-400 italic py-12">No delivery history found.</p>
                ) : (
                  history.map((delivery) => (
                    <div key={delivery.id} className="border-b border-slate-100 pb-4 last:border-0">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="font-bold text-slate-800">
                            {new Date(delivery.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-600">₹{delivery.total_amount.toFixed(2)}</span>
                      </div>
                      <div className="space-y-2 pl-4">
                        {delivery.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-slate-500">
                            <span>{item.product_name} × {item.quantity}</span>
                            <span>₹{(item.quantity * item.price_per_unit).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Total Outstanding:</span>
                <span className="text-2xl font-bold text-red-500">₹{(historyCustomer.balance || 0).toFixed(2)}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CustomersScreen = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [routeOrder, setRouteOrder] = useState('0');
  const [initialBalance, setInitialBalance] = useState('0');
  const [customPricing, setCustomPricing] = useState<{product_id: number, price: number}[]>([]);
  const [regularOrders, setRegularOrders] = useState<{product_id: number, quantity: number}[]>([]);

  useEffect(() => {
    fetch('/api/products').then(res => res.json()).then(setProducts);
  }, []);

  const addCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, address, phone,
          route_order: parseInt(routeOrder),
          initial_balance: parseFloat(initialBalance),
          custom_pricing: customPricing,
          regular_orders: regularOrders
        })
      });
      if (res.ok) {
        setName(''); setAddress(''); setPhone(''); setRouteOrder('0'); setInitialBalance('0');
        setCustomPricing([]); setRegularOrders([]);
        alert('Customer added successfully!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="pb-24 p-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Customers</h1>
        <p className="text-slate-500 italic serif">Manage your route & pricing</p>
      </header>

      <form onSubmit={addCustomer} className="space-y-6">
        <div className="glass-panel p-6 rounded-3xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-2">Basic Info</h3>
          <input
            type="text" placeholder="Customer Name" value={name} onChange={e => setName(e.target.value)} required
            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <input
            type="text" placeholder="Address" value={address} onChange={e => setAddress(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <input
            type="text" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Route Order</label>
              <input
                type="number" placeholder="Order" value={routeOrder} onChange={e => setRouteOrder(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Initial Balance</label>
              <input
                type="number" placeholder="Balance" value={initialBalance} onChange={e => setInitialBalance(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-2">Regular Order & Custom Pricing</h3>
          {products.map(product => {
            const pricing = customPricing.find(p => p.product_id === product.id);
            const order = regularOrders.find(o => o.product_id === product.id);

            return (
              <div key={product.id} className="p-4 bg-slate-50 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">{product.name}</span>
                  <span className="text-xs text-slate-400">Base: ₹{product.base_price}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Qty</label>
                    <input
                      type="number" step="0.1" placeholder="Qty"
                      value={order?.quantity || ''}
                      onChange={e => {
                        const qty = parseFloat(e.target.value);
                        if (isNaN(qty)) {
                          setRegularOrders(regularOrders.filter(o => o.product_id !== product.id));
                        } else {
                          setRegularOrders([...regularOrders.filter(o => o.product_id !== product.id), { product_id: product.id, quantity: qty }]);
                        }
                      }}
                      className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Custom Price</label>
                    <input
                      type="number" step="0.1" placeholder="Price"
                      value={pricing?.price || ''}
                      onChange={e => {
          const price = parseFloat(e.target.value);
          if (isNaN(price)) {
            setCustomPricing(customPricing.filter(p => p.product_id !== product.id));
          } else {
            setCustomPricing([...customPricing.filter(p => p.product_id !== product.id), { product_id: product.id, price }]);
          }
                      }}
                      className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm outline-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="submit"
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-[0.98] transition-transform"
        >
          Save Customer
        </button>
      </form>
    </div>
  );
};

const GoodsScreen = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [brand, setBrand] = useState('');
  const [type, setType] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [newStockVal, setNewStockVal] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data);
  };

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          brand_name: brand, 
          type, 
          name, 
          base_price: parseFloat(price),
          stock: parseFloat(stock) || 0
        })
      });
      if (res.ok) {
        setBrand(''); setType(''); setName(''); setPrice(''); setStock('');
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateStock = async (id: number) => {
    try {
      const res = await fetch(`/api/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: parseFloat(newStockVal) })
      });
      if (res.ok) {
        setEditingStockId(null);
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="pb-24 p-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Inventory</h1>
        <p className="text-slate-500 italic serif">Manage stock & products</p>
      </header>

      <form onSubmit={addProduct} className="glass-panel p-6 rounded-3xl space-y-4 mb-8">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Add New Product</h3>
        <input
          type="text" placeholder="Brand Name (e.g. Amul)" value={brand} onChange={e => setBrand(e.target.value)} required
          className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text" placeholder="Type (Milk)" value={type} onChange={e => setType(e.target.value)} required
            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="text" placeholder="Name (Gold)" value={name} onChange={e => setName(e.target.value)} required
            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number" step="0.1" placeholder="Price" value={price} onChange={e => setPrice(e.target.value)} required
            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="number" step="0.1" placeholder="Initial Stock" value={stock} onChange={e => setStock(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-100"
        >
          Add Product
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 px-2">Current Inventory</h3>
        {products.map(p => (
          <div key={p.id} className="glass-panel p-4 rounded-2xl flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">{p.brand_name} • {p.type}</p>
              <h4 className="font-semibold text-slate-900">{p.name}</h4>
              <p className="text-xs text-slate-500">Base: ₹{p.base_price}</p>
            </div>
            <div className="text-right">
              {editingStockId === p.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={newStockVal}
                    onChange={e => setNewStockVal(e.target.value)}
                    className="w-16 bg-slate-100 border-none rounded px-2 py-1 text-sm font-mono"
                    autoFocus
                  />
                  <button onClick={() => updateStock(p.id)} className="text-emerald-600"><Save size={18} /></button>
                </div>
              ) : (
                <div className="flex flex-col items-end">
                  <span className={`font-mono font-bold ${(p.stock || 0) < 10 ? 'text-red-500' : 'text-slate-900'}`}>
                    {(p.stock || 0)} units
                  </span>
                  <button 
                    onClick={() => { setEditingStockId(p.id); setNewStockVal((p.stock || 0).toString()); }}
                    className="text-[10px] text-slate-400 flex items-center gap-1"
                  >
                    <Edit2 size={10} /> Edit Stock
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative shadow-2xl shadow-slate-200">
      <main className="min-h-screen">
        {activeTab === 'home' && <HomeScreen />}
        {activeTab === 'payments' && <PaymentsScreen />}
        {activeTab === 'customers' && <CustomersScreen />}
        {activeTab === 'goods' && <GoodsScreen />}
      </main>
      
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

