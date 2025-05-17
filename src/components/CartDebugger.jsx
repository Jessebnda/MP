import { useEffect, useState } from 'react';

export default function CartDebugger() {
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const handleEvent = (event) => {
      setEvents(prev => [...prev.slice(-9), {
        time: new Date().toLocaleTimeString(),
        source: event.detail?.source || 'unknown',
        sessionId: event.detail?.sessionId || 'none'
      }]);
    };
    
    window.addEventListener('ALTURA_DIVINA_CART_UPDATE', handleEvent);
    return () => window.removeEventListener('ALTURA_DIVINA_CART_UPDATE', handleEvent);
  }, []);
  
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div style={{position: 'fixed', bottom: 10, right: 10, background: '#f8f8f8', 
                 padding: 10, border: '1px solid #ddd', borderRadius: 5, zIndex: 9999,
                 maxHeight: 300, overflow: 'auto', fontSize: 12}}>
      <h4>Cart Events</h4>
      <ul style={{padding: 0, margin: 0, listStyle: 'none'}}>
        {events.map((e, i) => (
          <li key={i}>{e.time} | {e.source} | {e.sessionId.substring(0, 8)}...</li>
        ))}
      </ul>
    </div>
  );
}