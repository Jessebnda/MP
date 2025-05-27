import * as React from "react";
import { Frame } from "framer";
import { logInfo, logError, logWarn } from '../utils/logger'; // Changed from ../lib/logger

export function MercadoPagoFrame({
  // Tu deploy en Vercel
  src = "https://mercadopagoiframe.vercel.app/",
  width = "100%",
  height = "100%",
  // Callback que se dispara cuando recibimos MP_REDIRECT
  onRedirect = (url, meta) => {
    // Por defecto, navegamos a la URL completa
    window.location.href = url;
  },
  // Para mayor seguridad, valida que venga de este origen
  allowedOrigin = "https://mercadopagoiframe.vercel.app",
}) {
  React.useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== allowedOrigin) {
        logWarn(
          `Mensaje ignorado de origen no permitido: ${event.origin}. Esperado: ${allowedOrigin}`
        );
        return;
      }

      if (event.data && event.data.type === "MP_REDIRECT") {
        logInfo("MP_REDIRECT recibido:", event.data);
        if (onRedirect) {
          onRedirect(event.data.url, event.data.meta);
        }
      } else {
        logInfo("Mensaje recibido del iframe:", event.data);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onRedirect, allowedOrigin]);

  // Usar un origen específico en lugar de '*'
  const targetOrigin = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : 'https://alturadivina.com';

  if (window.parent !== window) {
    logInfo("Notificando al contenedor sobre redirección exitosa");
    window.parent.postMessage({
      type: 'MP_PAYMENT_SUCCESS',
      redirectUrl: successUrl,
      paymentData: data
    }, targetOrigin);
  }

  return (
    <Frame
      src={src}
      width={width}
      height={height}
      style={{ border: "none" }}
      allow="payment; allow-top-navigation-by-user-activation" // <-- Cambia aquí
    />
  );
}
